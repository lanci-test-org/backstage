import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

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
  }>({
    id: 'codecommit:actions:commit',
    description: 'Pushes code to AFTs codecommit repository',
    schema: {
      input: {
        type: 'object',
        required: ['ownerEmail'],
        properties: {
          ownerEmail: {
            title: 'Committer',
            description: "The email address of the person who submitted the request",
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
      const stsClient = new STSClient({
        region: 'us-east-1',
      });
      try {
        const command = new GetCallerIdentityCommand({});
        const response = await stsClient.send(command);
        ctx.logger.info(`AWS Caller ID: ${JSON.stringify(response)}`);
        ctx.output('Account', response.Account);
        ctx.output('Arn', response.Arn);
        ctx.output('UserId', response.UserId);
      } catch (error) {
        ctx.logger.error(`Failed to retrieve credentials ${error}`);
        throw error;
      }
    },
  });
}
