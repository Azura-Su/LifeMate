import {
  createAccount,
  changeAccountPassword,
  currentSessionUser,
  refreshAccountVerification,
  sendAccountVerificationEmail,
  updateAccountDisplayName,
} from '../authService';

import { blockAccountWrites } from '../../security/accountLifecycle';
import { useAuthStore } from '../../../store/authStore';
const mockReauth = jest.fn();
const mockPassword = jest.fn();
const mockCredential = jest.fn((email, password) => ({ email, password }));
const mockAuth = { currentUser: null as null | Record<string, unknown> };
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockSend = jest.fn();
const mockReload = jest.fn();
const mockTokenResult = jest.fn();
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => mockAuth,
  EmailAuthProvider: {
    credential: (...args: unknown[]) => mockCredential(args[0], args[1]),
  },
  reauthenticateWithCredential: (...args: unknown[]) => mockReauth(...args),
  updatePassword: (...args: unknown[]) => mockPassword(...args),
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

describe('change password', () => {
  const user = {
    uid: 'password-user',
    email: 'p@example.com',
    providerData: [{ providerId: 'password' }],
  };
  beforeEach(() => {
    mockAuth.currentUser = user;
    useAuthStore
      .getState()
      .setUser({ uid: user.uid, email: user.email, displayName: null });
    mockReauth.mockReset().mockResolvedValue({ user });
    mockPassword.mockReset().mockResolvedValue(undefined);
    mockCredential.mockClear();
  });
  it('reauthenticates first and preserves all password bytes', async () => {
    await changeAccountPassword(user.uid, ' old password ', ' new password ');
    expect(mockCredential).toHaveBeenCalledWith(user.email, ' old password ');
    expect(mockReauth).toHaveBeenCalledWith(user, {
      email: user.email,
      password: ' old password ',
    });
    expect(mockPassword).toHaveBeenCalledWith(user, ' new password ');
    expect(mockReauth.mock.invocationCallOrder[0]).toBeLessThan(
      mockPassword.mock.invocationCallOrder[0],
    );
  });
  it('never changes a password when the old credential is rejected', async () => {
    mockReauth.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
    await expect(
      changeAccountPassword(user.uid, 'wrong', 'new-password'),
    ).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    expect(mockPassword).not.toHaveBeenCalled();
  });
  it('stops if UID changes while reauthentication is running', async () => {
    mockReauth.mockImplementationOnce(async () => {
      mockAuth.currentUser = { uid: 'other' };
      useAuthStore
        .getState()
        .setUser({ uid: 'other', email: null, displayName: null });
    });
    await expect(
      changeAccountPassword(user.uid, 'old-password', 'new-password'),
    ).rejects.toThrow();
    expect(mockPassword).not.toHaveBeenCalled();
  });
  it('rejects other providers and invalid new passwords without reauth', async () => {
    await expect(
      changeAccountPassword(user.uid, 'old', 'short'),
    ).rejects.toThrow();
    mockAuth.currentUser = {
      ...user,
      providerData: [{ providerId: 'google.com' }],
    };
    await expect(
      changeAccountPassword(user.uid, 'old-password', 'new-password'),
    ).rejects.toThrow();
    expect(mockReauth).not.toHaveBeenCalled();
  });
});

it('does not update a password if account deletion starts during reauthentication', async () => {
  const user = {
    uid: 'deletion-password-user',
    email: 'p@example.com',
    providerData: [{ providerId: 'password' }],
  };
  mockAuth.currentUser = user;
  useAuthStore
    .getState()
    .setUser({ uid: user.uid, email: user.email, displayName: null });
  mockPassword.mockClear();
  mockReauth.mockImplementationOnce(async () => {
    blockAccountWrites(user.uid);
  });
  await expect(
    changeAccountPassword(user.uid, 'old-password', 'new-password'),
  ).rejects.toThrow('đang được xóa');
  expect(mockPassword).not.toHaveBeenCalled();
});
