import { act, renderHook } from '@testing-library/react-native';
import {
  createAccount,
  currentSessionUser,
  refreshAccountVerification,
  sendAccountVerificationEmail,
  updateAccountDisplayName,
} from '../../../services/firebase/authService';
import { useAuthStore } from '../../../store/authStore';
import { useConfigStore } from '../../../store/configStore';
import { useRegisterScreen } from '../useRegisterScreen';

jest.mock('../../../services/firebase/authService', () => ({
  createAccount: jest.fn(),
  currentSessionUser: jest.fn(),
  refreshAccountVerification: jest.fn(),
  sendAccountVerificationEmail: jest.fn(),
  updateAccountDisplayName: jest.fn(),
}));
jest.mock('../../../services/firebase/remoteConfigService', () => ({
  loadRemoteConfig: jest.fn(),
  readActivatedRemoteConfig: jest.fn(),
}));

const user = { uid: 'u1', email: 'a@b.co', displayName: 'Asher' };

describe('registration form', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      initializing: false,
      authView: 'register',
      registrationPhase: 'idle',
      registrationUid: null,
    });
    useConfigStore.setState({ registrationEnabled: true });
    jest.mocked(createAccount).mockReset().mockResolvedValue('u1');
    jest.mocked(updateAccountDisplayName).mockReset().mockResolvedValue();
    jest.mocked(sendAccountVerificationEmail).mockReset().mockResolvedValue();
    jest.mocked(currentSessionUser).mockReset().mockReturnValue(user);
    jest
      .mocked(refreshAccountVerification)
      .mockReset()
      .mockResolvedValue(false);
  });

  function fill(result: { current: ReturnType<typeof useRegisterScreen> }) {
    act(() => {
      result.current.setName(' Asher ');
      result.current.setEmail(' A@B.Co ');
      result.current.setPassword('secret pass');
      result.current.setConfirmation('secret pass');
    });
  }

  it('does not start signup when Remote Config turns it off', async () => {
    const { result } = renderHook(useRegisterScreen);
    fill(result);
    act(() => useConfigStore.setState({ registrationEnabled: false }));
    await act(async () => result.current.submit());
    expect(createAccount).not.toHaveBeenCalled();
  });

  it('survives observer sign-in before create resolves and clears credentials', async () => {
    let finish!: (uid: string) => void;
    jest
      .mocked(createAccount)
      .mockImplementationOnce(
        () => new Promise((resolve) => (finish = resolve)),
      );
    const { result } = renderHook(useRegisterScreen);
    fill(result);
    let submission!: Promise<void>;
    act(() => {
      submission = result.current.submit();
      void result.current.submit();
      useAuthStore.getState().setUser({ ...user, displayName: null });
    });
    expect(createAccount).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().registrationPhase).toBe('creating');
    await act(async () => {
      finish('u1');
      await submission;
    });
    expect(result.current.created).toMatchObject({
      uid: 'u1',
      profileSaved: true,
      verificationSent: true,
    });
    expect(result.current.password).toBe('');
    expect(result.current.confirmation).toBe('');
    expect(useAuthStore.getState().registrationPhase).toBe('created');
  });

  it('keeps the created account when profile setup fails and retries that step', async () => {
    jest
      .mocked(updateAccountDisplayName)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce();
    const { result } = renderHook(useRegisterScreen);
    fill(result);
    await act(async () => result.current.submit());
    expect(result.current.created).toMatchObject({
      profileSaved: false,
      verificationSent: true,
    });
    expect(sendAccountVerificationEmail).toHaveBeenCalledTimes(1);
    expect(createAccount).toHaveBeenCalledTimes(1);
    await act(async () => result.current.retryProfile());
    expect(result.current.created?.profileSaved).toBe(true);
    act(() => result.current.continueToApp());
    expect(useAuthStore.getState().registrationPhase).toBe('idle');
    expect(createAccount).toHaveBeenCalledTimes(1);
  });

  it('sends verification before waiting for profile setup', async () => {
    let finishProfile!: () => void;
    jest
      .mocked(updateAccountDisplayName)
      .mockImplementationOnce(
        () => new Promise((resolve) => (finishProfile = resolve)),
      );
    const { result } = renderHook(useRegisterScreen);
    fill(result);
    let submission!: Promise<void>;
    act(() => {
      submission = result.current.submit();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(updateAccountDisplayName).toHaveBeenCalledTimes(1);
    expect(sendAccountVerificationEmail).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishProfile();
      await submission;
    });
  });

  it('enters the app after the signed-in account is verified', async () => {
    jest.mocked(refreshAccountVerification).mockResolvedValueOnce(true);
    const { result } = renderHook(useRegisterScreen);
    fill(result);
    await act(async () => result.current.submit());
    await act(async () => result.current.checkVerification());
    expect(result.current.created?.emailVerified).toBe(true);
    expect(useAuthStore.getState().registrationPhase).toBe('idle');
    expect(useAuthStore.getState().user?.uid).toBe('u1');
  });

  it('keeps the completion screen for an unverified email or failed check', async () => {
    const { result } = renderHook(useRegisterScreen);
    fill(result);
    await act(async () => result.current.submit());
    await act(async () => result.current.checkVerification());
    expect(useAuthStore.getState().registrationPhase).toBe('created');
    expect(result.current.error).toContain('chưa được xác nhận');
    jest
      .mocked(refreshAccountVerification)
      .mockRejectedValueOnce(new Error('offline'));
    await act(async () => result.current.checkVerification());
    expect(useAuthStore.getState().registrationPhase).toBe('created');
    expect(result.current.error).toContain('Chưa kiểm tra được');
  });

  it('does not enter a different account if the session changes during verification', async () => {
    let finishCheck!: (verified: boolean) => void;
    jest
      .mocked(refreshAccountVerification)
      .mockImplementationOnce(
        () => new Promise((resolve) => (finishCheck = resolve)),
      );
    const { result } = renderHook(useRegisterScreen);
    fill(result);
    await act(async () => result.current.submit());
    let checking!: Promise<void>;
    act(() => {
      checking = result.current.checkVerification();
      useAuthStore.getState().setUser({ ...user, uid: 'other' });
    });
    await act(async () => {
      finishCheck(true);
      await checking;
    });
    expect(useAuthStore.getState().user?.uid).toBe('other');
    expect(result.current.created?.emailVerified).toBe(false);
  });

  it('offers resend when the automatic verification email fails', async () => {
    jest
      .mocked(sendAccountVerificationEmail)
      .mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(useRegisterScreen);
    fill(result);
    await act(async () => result.current.submit());
    expect(result.current.created).toMatchObject({ verificationSent: false });
    expect(useAuthStore.getState().registrationPhase).toBe('created');
    await act(async () => result.current.resendVerification());
    expect(result.current.created).toMatchObject({ verificationSent: true });
    expect(sendAccountVerificationEmail).toHaveBeenCalledTimes(2);
  });

  it('does not send setup actions for a user that signed out mid-flight', async () => {
    let finish!: () => void;
    jest
      .mocked(sendAccountVerificationEmail)
      .mockImplementationOnce(
        () => new Promise((resolve) => (finish = resolve)),
      );
    const { result } = renderHook(useRegisterScreen);
    fill(result);
    let submission!: Promise<void>;
    act(() => {
      submission = result.current.submit();
    });
    await act(async () => Promise.resolve());
    act(() => useAuthStore.getState().setUser(null));
    await act(async () => {
      finish();
      await submission;
    });
    expect(updateAccountDisplayName).not.toHaveBeenCalled();
    expect(result.current.created).toBeNull();
  });

  it('releases the gate if account creation fails after an unrelated auth event', async () => {
    jest.mocked(createAccount).mockImplementationOnce(async () => {
      useAuthStore.getState().setUser({
        uid: 'other',
        email: 'other@b.co',
        displayName: null,
      });
      throw { code: 'auth/network-request-failed' };
    });
    const { result } = renderHook(useRegisterScreen);
    fill(result);
    await act(async () => result.current.submit());
    expect(useAuthStore.getState().registrationPhase).toBe('idle');
    expect(useAuthStore.getState().user?.uid).toBe('other');
    expect(updateAccountDisplayName).not.toHaveBeenCalled();
  });

  it('releases the gate if a different UID appears before create resolves', async () => {
    let finish!: (uid: string) => void;
    jest
      .mocked(createAccount)
      .mockImplementationOnce(
        () => new Promise((resolve) => (finish = resolve)),
      );
    const { result } = renderHook(useRegisterScreen);
    fill(result);
    let submission!: Promise<void>;
    act(() => {
      submission = result.current.submit();
      useAuthStore.getState().setUser({
        uid: 'other',
        email: 'other@b.co',
        displayName: null,
      });
    });
    await act(async () => {
      finish('u1');
      await submission;
    });
    expect(useAuthStore.getState().registrationPhase).toBe('idle');
    expect(useAuthStore.getState().user?.uid).toBe('other');
    expect(updateAccountDisplayName).not.toHaveBeenCalled();
  });

  it('does not treat a definite signup rejection as success after a same-email auth event', async () => {
    jest.mocked(createAccount).mockImplementationOnce(async () => {
      useAuthStore.getState().setUser({ ...user, displayName: null });
      throw { code: 'auth/email-already-in-use' };
    });
    const { result } = renderHook(useRegisterScreen);
    fill(result);
    await act(async () => result.current.submit());
    expect(useAuthStore.getState().registrationPhase).toBe('idle');
    expect(updateAccountDisplayName).not.toHaveBeenCalled();
  });
});
