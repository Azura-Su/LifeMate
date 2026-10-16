import {
  createAccount,
  currentSessionUser,
  refreshAccountVerification,
  sendAccountVerificationEmail,
  updateAccountDisplayName,
} from '../authService';

const mockAuth = { currentUser: null as null | Record<string, unknown> };
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockSend = jest.fn();
const mockReload = jest.fn();
const mockTokenResult = jest.fn();
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => mockAuth,
  createUserWithEmailAndPassword: (...args: unknown[]) => mockCreate(...args),
  updateProfile: (...args: unknown[]) => mockUpdate(...args),
  sendEmailVerification: (...args: unknown[]) => mockSend(...args),
  reload: (...args: unknown[]) => mockReload(...args),
  getIdTokenResult: (...args: unknown[]) => mockTokenResult(...args),
}));

describe('Firebase registration service', () => {
  beforeEach(() => {
    mockAuth.currentUser = null;
    mockCreate.mockReset();
    mockUpdate.mockReset().mockResolvedValue(undefined);
    mockSend.mockReset().mockResolvedValue(undefined);
    mockReload.mockReset().mockResolvedValue(undefined);
    mockTokenResult.mockReset().mockResolvedValue({
      claims: { sub: 'u1', email_verified: true },
    });
  });

  it('normalizes email but keeps password bytes unchanged', async () => {
    const user = { uid: 'u1', email: 'a@b.co', displayName: null };
    mockCreate.mockResolvedValue({ user });
    expect(await createAccount(' A@B.Co ', ' secret pass ')).toBe('u1');
    expect(mockCreate).toHaveBeenCalledWith(
      mockAuth,
      'a@b.co',
      ' secret pass ',
    );
  });

  it('updates the active user and reads a fresh profile snapshot', async () => {
    const user = { uid: 'u1', email: 'a@b.co', displayName: null };
    mockAuth.currentUser = user;
    mockUpdate.mockImplementation(async () => {
      user.displayName = 'Asher' as never;
    });
    await updateAccountDisplayName('u1', ' Asher ');
    expect(mockUpdate).toHaveBeenCalledWith(user, { displayName: 'Asher' });
    expect(currentSessionUser('u1')).toEqual({
      uid: 'u1',
      email: 'a@b.co',
      displayName: 'Asher',
    });
  });

  it('refuses account setup after the signed-in UID changes', async () => {
    mockAuth.currentUser = {
      uid: 'other',
      email: 'other@b.co',
      displayName: null,
    };
    await expect(updateAccountDisplayName('u1', 'Asher')).rejects.toThrow();
    await expect(sendAccountVerificationEmail('u1')).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('accepts the fresh verified token even if the user snapshot is still stale', async () => {
    const user = {
      uid: 'u1',
      email: 'a@b.co',
      displayName: 'Asher',
      emailVerified: false,
    };
    mockAuth.currentUser = user;
    expect(await refreshAccountVerification('u1')).toBe(true);
    expect(mockReload).toHaveBeenCalledWith(user);
    expect(mockTokenResult).toHaveBeenCalledWith(user, true);
  });

  it('does not accept a stale verified profile without a verified token', async () => {
    mockAuth.currentUser = { uid: 'u1', emailVerified: true };
    mockTokenResult.mockResolvedValueOnce({
      claims: { sub: 'u1', email_verified: false },
    });
    expect(await refreshAccountVerification('u1')).toBe(false);
  });

  it('rejects a refreshed token for another account', async () => {
    mockAuth.currentUser = { uid: 'u1', emailVerified: true };
    mockTokenResult.mockResolvedValueOnce({
      claims: { sub: 'other', email_verified: true },
    });
    await expect(refreshAccountVerification('u1')).rejects.toThrow(
      'Phiên tài khoản',
    );
  });

  it('rejects verification if the active account changes during token refresh', async () => {
    mockAuth.currentUser = { uid: 'u1' };
    let finish!: (value: unknown) => void;
    mockTokenResult.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve)),
    );
    const checking = refreshAccountVerification('u1');
    await Promise.resolve();
    mockAuth.currentUser = { uid: 'other' };
    finish({ claims: { sub: 'u1', email_verified: true } });
    await expect(checking).rejects.toThrow('Phiên tài khoản');
  });
});
