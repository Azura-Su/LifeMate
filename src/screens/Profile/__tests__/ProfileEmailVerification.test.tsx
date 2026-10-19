import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { ProfileEmailVerification } from '../ProfileEmailVerification';
import { useAuthStore } from '../../../store/authStore';
import {
  refreshAccountVerification,
  sendAccountVerificationEmail,
} from '../../../services/firebase/authService';
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('../../../services/firebase/authService', () => ({
  refreshAccountVerification: jest.fn(),
  sendAccountVerificationEmail: jest.fn(),
}));
beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: 'a@example.com', displayName: 'A' });
  jest.mocked(refreshAccountVerification).mockReset().mockResolvedValue(false);
  jest
    .mocked(sendAccountVerificationEmail)
    .mockReset()
    .mockResolvedValue(undefined);
});
test('unverified user sees resend and confirmed action, verified refresh clears them', async () => {
  const view = render(<ProfileEmailVerification uid="u1" />);
  await waitFor(() =>
    expect(view.getByText('Email chưa xác nhận')).toBeTruthy(),
  );
  await act(async () => fireEvent.press(view.getByText('Gửi email xác nhận')));
  expect(sendAccountVerificationEmail).toHaveBeenCalledWith('u1');
  expect(view.getByText('Gửi lại sau 60s')).toBeTruthy();
  jest.mocked(refreshAccountVerification).mockResolvedValue(true);
  await act(async () => fireEvent.press(view.getByText('Tôi đã xác nhận')));
  expect(view.getByText('Email đã xác nhận')).toBeTruthy();
  expect(view.queryByText('Tôi đã xác nhận')).toBeNull();
});
test('failed initial check remains retryable, does not falsely mark verified', async () => {
  jest
    .mocked(refreshAccountVerification)
    .mockRejectedValueOnce(new Error('network'));
  const view = render(<ProfileEmailVerification uid="u1" />);
  await waitFor(() =>
    expect(
      view.getByText('Chưa kiểm tra được trạng thái email. Hãy thử lại.'),
    ).toBeTruthy(),
  );
  expect(view.queryByText('Email đã xác nhận')).toBeNull();
  await act(async () => fireEvent.press(view.getByText('Tôi đã xác nhận')));
  expect(view.getByText('Email chưa xác nhận')).toBeTruthy();
});
test('late verification response after logout is discarded', async () => {
  let finish!: (value: boolean) => void;
  jest.mocked(refreshAccountVerification).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<ProfileEmailVerification uid="u1" />);
  useAuthStore.getState().setUser(null);
  await act(async () => finish(true));
  expect(view.queryByText('Email đã xác nhận')).toBeNull();
});

test('initial check stays compact instead of flashing verification actions', async () => {
  let finish!: (value: boolean) => void;
  jest.mocked(refreshAccountVerification).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<ProfileEmailVerification uid="u1" />);
  expect(view.getByText('Đang kiểm tra email…')).toBeTruthy();
  expect(view.queryByText('Gửi email xác nhận')).toBeNull();
  await act(async () => finish(true));
  expect(view.getByText('Email đã xác nhận')).toBeTruthy();
});

test('returns from background after cooldown expiry without crashing or retaining a timer', async () => {
  jest.useFakeTimers();
  const previousState = AppState.currentState;
  AppState.currentState = 'active';
  const listeners: ((state: AppStateStatus) => void)[] = [];
  const interval = jest.spyOn(global, 'setInterval');
  const clear = jest.spyOn(global, 'clearInterval');
  const subscribe = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      listeners.push(callback);
      return { remove: jest.fn() };
    });
  try {
    const view = render(<ProfileEmailVerification uid="u1" />);
    await act(async () => {});
    await act(async () =>
      fireEvent.press(view.getByText('Gửi email xác nhận')),
    );
    expect(view.getByText('Gửi lại sau 60s')).toBeTruthy();
    act(() => listeners.forEach((listener) => listener('background')));
    await act(async () => jest.advanceTimersByTimeAsync(61000));
    await act(async () => listeners.forEach((listener) => listener('active')));
    expect(view.getByText('Gửi email xác nhận')).toBeTruthy();
    expect(clear).toHaveBeenCalledWith(interval.mock.results[0].value);
    view.unmount();
  } finally {
    subscribe.mockRestore();
    interval.mockRestore();
    clear.mockRestore();
    AppState.currentState = previousState;
    jest.useRealTimers();
  }
});
