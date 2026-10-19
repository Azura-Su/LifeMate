import { useProfileStore } from '../profileStore';
import { useAuthStore } from '../authStore';
import { readAvatar } from '../../services/profile/avatarService';
jest.mock('../../services/profile/avatarService', () => ({
  readAvatar: jest.fn(),
}));
beforeEach(() => {
  useProfileStore.getState().reset();
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: null, displayName: null });
});
test('late refresh cannot overwrite a newly saved avatar', async () => {
  let finish!: (value: string | null) => void;
  jest.mocked(readAvatar).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const loading = useProfileStore.getState().load('u1');
  useProfileStore.getState().accept('u1', 'new-avatar');
  finish('old-avatar');
  await loading;
  expect(useProfileStore.getState().avatarUrl).toBe('new-avatar');
});
test('late result from previous user is discarded', async () => {
  let finish!: (value: string | null) => void;
  jest.mocked(readAvatar).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const loading = useProfileStore.getState().load('u1');
  useAuthStore
    .getState()
    .setUser({ uid: 'u2', email: null, displayName: null });
  useProfileStore.getState().reset();
  finish('private-user1');
  await loading;
  expect(useProfileStore.getState().avatarUrl).toBeNull();
});
