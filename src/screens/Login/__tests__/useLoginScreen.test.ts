import { act, renderHook } from '@testing-library/react-native';
import { login } from '../../../services/firebase/authService';
import { useLoginScreen } from '../useLoginScreen';

jest.mock('../../../services/firebase/authService', () => ({
  login: jest.fn(),
}));
const mockedLogin = jest.mocked(login);

describe('login form', () => {
  it('rejects invalid input without sending credentials', async () => {
    const { result } = renderHook(useLoginScreen);
    await act(async () => result.current.submit());
    expect(result.current.error).toBeTruthy();
    expect(mockedLogin).not.toHaveBeenCalled();
  });
  it('keeps password intact for Auth, prevents double submission, and clears it on success', async () => {
    let finish!: () => void;
    mockedLogin.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(useLoginScreen);
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword(' secret ');
    });
    let first!: Promise<void>;
    act(() => {
      first = result.current.submit();
      void result.current.submit();
    });
    expect(mockedLogin).toHaveBeenCalledTimes(1);
    expect(mockedLogin).toHaveBeenCalledWith('a@b.co', ' secret ');
    expect(result.current.loading).toBe(true);
    await act(async () => {
      finish();
      await first;
    });
    expect(result.current.password).toBe('');
    expect(result.current.loading).toBe(false);
  });
  it('shows a useful network failure and allows retry', async () => {
    mockedLogin.mockRejectedValue({ code: 'auth/network-request-failed' });
    const { result } = renderHook(useLoginScreen);
    act(() => {
      result.current.setEmail('a@b.co');
      result.current.setPassword('pass');
    });
    await act(async () => result.current.submit());
    expect(result.current.error).toContain('kết nối');
    expect(result.current.loading).toBe(false);
  });
});
