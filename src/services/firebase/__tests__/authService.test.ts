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
const mockToken = jest.fn();
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => mockAuth,
  createUserWithEmailAndPassword: (...args: unknown[]) => mockCreate(...args),
  updateProfile: (...args: unknown[]) => mockUpdate(...args),
  sendEmailVerification: (...args: unknown[]) => mockSend(...args),
  reload: (...args: unknown[]) => mockReload(...args),
  getIdToken: (...args: unknown[]) => mockToken(...args),
}));

describe('Firebase registration service', () => {
  beforeEach(() => {
    mockAuth.currentUser = null;
    mockCreate.mockReset();
    mockUpdate.mockReset().mockResolvedValue(undefined);
    mockSend.mockReset().mockResolvedValue(undefined);
    mockReload.mockReset().mockResolvedValue(undefined);
    mockToken.mockReset().mockResolvedValue('token');
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

  it('reloads and refreshes the token before accepting email verification', async () => {
    const user = {
      uid: 'u1',
      email: 'a@b.co',
      displayName: 'Asher',
      emailVerified: false,
    };
    mockAuth.currentUser = user;
    mockReload.mockImplementation(async () => {
      user.emailVerified = true;
    });
    expect(await refreshAccountVerification('u1')).toBe(true);
    expect(mockToken).toHaveBeenCalledWith(user, true);
  });
});
