import { codeCommitAction } from './publish-codecommit';
import {createMockActionContext} from '@backstage/plugin-scaffolder-node-test-utils'

describe('createExampleAction', () => {
  it('should call action', async () => {
    const action = codeCommitAction();

    await expect(action.handler(createMockActionContext({
      input: {
        ownerEmail: 'test',
      },
    }))).resolves.toBeUndefined()
  });

  it('should fail when passing foo', async () => {
    const action = codeCommitAction();

    await expect(action.handler(createMockActionContext({
      input: {
        ownerEmail: 'foo',
      },
    }))).rejects.toThrow("ownerEmail cannot be 'foo'")
  });
});
