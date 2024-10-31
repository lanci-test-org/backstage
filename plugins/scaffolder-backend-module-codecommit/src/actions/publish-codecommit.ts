import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { STSClient, GetCallerIdentityCommand, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { CodeCommitClient, CreateCommitCommand, GetBranchCommand, PutFileCommand } from '@aws-sdk/client-codecommit';
import fs from 'fs';
import path from 'path';

/**
 * Creates an `acme:example` Scaffolder action.
 *
 * @remarks
 *
 * See {@link https://example.com} for more information.
 *
 * @public
 */
export function codeCommitAction() {
  // For more information on how to define custom actions, see
  //   https://backstage.io/docs/features/software-templates/writing-custom-actions
  return createTemplateAction<{
    ownerEmail: string;
    directoryPath: string;
    accountName: string;
    environment: string;
  }>({
    id: 'codecommit:actions:commit',
    description: 'Pushes code to AFTs codecommit repository',
    schema: {
      input: {
        type: 'object',
        required: ['ownerEmail', 'directoryPath'],
        properties: {
          ownerEmail: {
            title: 'Committer',
            description: "The email address of the person who submitted the request",
            type: 'string',
          },
          directoryPath: {
            title: 'Directory',
            description: 'The directory path of the files to be committed to codecommit',
            type: 'string',
          },
          accountName: {
            title: 'Account Name',
            description: 'Account name of the AWS account. This will be used to form the name like this example: nhl-{accountName}-{environment}',
            type: 'string',
          },
          environment: {
            title: 'Environment',
            description: 'The environment for account',
            type: 'string'
          }
        },
      },
      output: {
        type: 'object',
        properties: {
          Account: { type: 'string', description: 'AWS Account ID'},
          Arn: {type: 'string', description: 'AWS ARN of caller'},
          UserId: {type:'string', description: 'UserID of caller'},
        }
      }
    },
    async handler(ctx) {
      const { directoryPath, accountName, environment, ownerEmail } = ctx.input;

      ctx.logger.info(`directoryPath from input ${directoryPath}`);

      const currDir = process.cwd()
      const filesAndDirs = fs.readdirSync(currDir);
      filesAndDirs.forEach((fileOrDir) => {
        const fullPath = path.join(currDir, fileOrDir);
        const isDirectory = fs.statSync(fullPath).isDirectory();
        ctx.logger.info(`${fileOrDir} - ${isDirectory ? 'Directory' : 'File'}`);
      });

      const stsClient = new STSClient({ region: 'us-east-1' });
      const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: 'arn:aws:iam::082144427333:role/backstage-codecommit-account-vending', 
        RoleSessionName: 'Backstage-CrossAccount'
      });

      const assumedRole = await stsClient.send(assumeRoleCommand);

      const { AccessKeyId, SecretAccessKey, SessionToken } = assumedRole.Credentials!;

      const command = new GetCallerIdentityCommand({});
      const response = await stsClient.send(command);
      ctx.logger.info(`AWS Caller ID: ${JSON.stringify(response)}`);

      const codeCommitClient = new CodeCommitClient({
        region: 'us-east-1',
        credentials: {
          accessKeyId: AccessKeyId!,
          secretAccessKey: SecretAccessKey!,
          sessionToken: SessionToken!
        }
      });

      // const readFilesRecursively = (dir: string): Array<{path: string, content: Buffer }> => {
      //   const files: Array<{ path: string, content: Buffer }> = [];
      //   const items = fs.readdirSync(dir, { withFileTypes: true });

      //   for (const item of items) {
      //     const fullPath = path.join(dir, item.name);
      //     if (item.isDirectory()) {
      //       files.push(...readFilesRecursively(fullPath));
      //     } else {
      //       files.push({
      //         path: path.relative(directoryPath, fullPath),
      //         content: fs.readFileSync(fullPath)
      //       });
      //     }
      //   }
      //   return files;
      // };

      // const filesToCommit = readFilesRecursively(directoryPath);

      const fileName = `${accountName}.tf`
      const fileContent = `
        # Managed by Backstage
        module "aft_${accountName}_account" {
          source = "./modules/aft-account-request"

          control_tower_parameters = {
            AccountEmail = "awsadmin+aws-${accountName}-${environment}@nhl.com"
            AccountName  = "nhl-${accountName}-${environment}"
            # Syntax for top-level OU
            ManagedOrganizationalUnit = "ControlTowerOnboard"
            # Syntax for nested OU
            # ManagedOrganizationalUnit = "Sandbox (ou-xfe5-a8hb8ml8)"
            SSOUserEmail     = "awsadmin+aws-${accountName}-${environment}@nhl.com"
            SSOUserFirstName = "Admin"
            SSOUserLastName  = "User"
          }

          account_tags = {
            "ABC:Owner"       = "${ownerEmail}"
          }

          change_management_parameters = {
            change_requested_by = "${ownerEmail}
            change_reason       = "New account creation for ${accountName} project by Backstage"
          }
        }
      `.trim();

      const tempDir = '/tmp/codecommit-changes';
      const filePath = path.join(tempDir, fileName);

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      fs.writeFileSync(filePath, fileContent);

      const branchName = 'main';
      const getBranchCommand = new GetBranchCommand({
        repositoryName: 'lanci-testing-respository',
        branchName,
      });
      const branchData = await codeCommitClient.send(getBranchCommand);
      const parentCommitId = branchData.branch?.commitId;

      if (!parentCommitId) {
        throw new Error(`Could not retrieve parent commit ID for branch ${branchName}`);
      }

      const createCommitCommand = new CreateCommitCommand({
        repositoryName: 'lanci-testing-respository',
        branchName,
        parentCommitId,
        putFiles: [
          {
            filePath: fileName,
            fileContent: Buffer.from(fileContent),
          },
        ],
        commitMessage: `Adding ${fileName} for account ${accountName}`,
        authorName: ownerEmail,
        email: ownerEmail
      });

      const commitResponse = await codeCommitClient.send(createCommitCommand);
      ctx.logger.info(`Commit successful: ${commitResponse.commitId}`);

      
      // for (const file of filesToCommit) {
      //   const putFileCommand = new PutFileCommand({
      //     repositoryName: 'lanci-testing-respository',
      //     branchName: 'main',
      //     filePath: file.path,
      //     fileContent: file.content,
      //     commitMessage: `Adding ${file.path}`,
      //   });

      //   await codeCommitClient.send(putFileCommand);
      //   ctx.logger.info(`Commited ${file.path} to lanci-testing-respository`);
      // }
      // const stsClient = new STSClient({
      //   region: 'us-east-1',
      // });
      // try {

      // } catch (error) {
      //   ctx.logger.error(`Failed to retrieve credentials ${error}`);
      //   throw error;
      // }
    },
  });
}
