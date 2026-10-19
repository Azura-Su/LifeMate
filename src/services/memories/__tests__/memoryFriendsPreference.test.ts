import {
  readMemoryFriendsPreference,
  writeMemoryFriendsPreference,
} from '../memoryFriendsPreference';
import { useAuthStore } from '../../../store/authStore';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../../security/encryptedLocalStorage';
import { blockAccountWrites } from '../../security/accountLifecycle';
jest.mock('../../security/encryptedLocalStorage', () => ({
  getEncryptedItem: jest.fn(),
  setEncryptedItem: jest.fn(),
}));

const login = (uid: string) =>
  useAuthStore.getState().setUser({ uid, email: null, displayName: null });
beforeEach(() => {
  jest.mocked(getEncryptedItem).mockReset().mockResolvedValue(null);
  jest.mocked(setEncryptedItem).mockReset().mockResolvedValue(undefined);
});
test('persists only the navigation boolean in the owning UID namespace', async () => {
  login('alice');
  await writeMemoryFriendsPreference('alice', true);
  expect(setEncryptedItem).toHaveBeenCalledWith(
    'alice',
    'lifemate:memory-friends-tab:v1:alice',
    'true',
  );
  await writeMemoryFriendsPreference('alice', false);
  expect(setEncryptedItem).toHaveBeenLastCalledWith(
    'alice',
    'lifemate:memory-friends-tab:v1:alice',
    'false',
  );
  jest.mocked(getEncryptedItem).mockResolvedValue('true');
  expect(await readMemoryFriendsPreference('alice')).toBe(true);
  login('bob');
  expect(await readMemoryFriendsPreference('bob')).toBe(true);
  expect(getEncryptedItem).toHaveBeenLastCalledWith(
    'bob',
    'lifemate:memory-friends-tab:v1:bob',
  );
  await expect(readMemoryFriendsPreference('alice')).rejects.toThrow();
  await expect(writeMemoryFriendsPreference('alice', true)).rejects.toThrow();
});
test('missing or malformed preference stays unknown', async () => {
  login('alice');
  expect(await readMemoryFriendsPreference('alice')).toBeNull();
  jest.mocked(getEncryptedItem).mockResolvedValue('{"friends":["bob"]}');
  expect(await readMemoryFriendsPreference('alice')).toBeNull();
});
test('rejects a late read after UID change and all writes after account deletion starts', async () => {
  login('cache-owner');
  jest.mocked(getEncryptedItem).mockImplementationOnce(async () => {
    login('other');
    return 'true';
  });
  await expect(readMemoryFriendsPreference('cache-owner')).rejects.toThrow();
  login('deleting-cache-owner');
  blockAccountWrites('deleting-cache-owner');
  await expect(
    writeMemoryFriendsPreference('deleting-cache-owner', true),
  ).rejects.toThrow();
  expect(setEncryptedItem).not.toHaveBeenCalled();
});
