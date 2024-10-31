import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { STSClient, GetCallerIdentityCommand, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { CodeCommitClient, PutFileCommand } from '@aws-sdk/client-codecommit';
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
      const { directoryPath } = ctx.input;

      const stsClient = new STSClient({ region: 'us-east-1' });
      const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: 'arn:aws:iam::082144427333:role/backstage-codecommit-account-vending', 
        RoleSessionName: 'Backstage-CrossAccount'
      });

      const assumedRole = await stsClient.send(assumeRoleCommand);

      const { AccessKeyId, SecretAccessKey, SessionToken } = assumedRole.Credentials!;



      const codeCommitClient = new CodeCommitClient({
        region: 'us-east-1',
        credentials: {
          accessKeyId: AccessKeyId!,
          secretAccessKey: SecretAccessKey!,
          sessionToken: SessionToken!
        }
      });

      const readFilesRecursively = (dir: string): Array<{path: string, content: Buffer }> => {
        const files: Array<{ path: string, content: Buffer }> = [];
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            files.push(...readFilesRecursively(fullPath));
          } else {
            files.push({
              path: path.relative(directoryPath, fullPath),
              content: fs.readFileSync(fullPath)
            });
          }
        }
        return files;
      };

      const filesToCommit = readFilesRecursively(directoryPath);

      for (const file of filesToCommit) {
        const putFileCommand = new PutFileCommand({
          repositoryName: 'lanci-testing-respository',
          branchName: 'main',
          filePath: file.path,
          fileContent: file.content,
          commitMessage: `Adding ${file.path}`,
        });

        await codeCommitClient.send(putFileCommand);
        ctx.logger.info(`Commited ${file.path} to lanci-testing-respository`);
      }
      // const stsClient = new STSClient({
      //   region: 'us-east-1',
      // });
      // try {
      //   const command = new GetCallerIdentityCommand({});
      //   const response = await stsClient.send(command);
      //   ctx.logger.info(`AWS Caller ID: ${JSON.stringify(response)}`);
      //   ctx.output('Account', response.Account);
      //   ctx.output('Arn', response.Arn);
      //   ctx.output('UserId', response.UserId);
      // } catch (error) {
      //   ctx.logger.error(`Failed to retrieve credentials ${error}`);
      //   throw error;
      // }
    },
  });
}
