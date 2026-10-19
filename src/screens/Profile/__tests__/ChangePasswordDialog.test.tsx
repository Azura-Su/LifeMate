import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { ChangePasswordDialog } from '../ChangePasswordDialog';
import { changeAccountPassword } from '../../../services/firebase/authService';
import { useAuthStore } from '../../../store/authStore';
import { validatePasswordChange } from '../../../utils/auth';
jest.mock('../../../services/firebase/authService', () => ({
  changeAccountPassword: jest.fn(),
}));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
const uid = 'password-ui';
const fill = (view: ReturnType<typeof render>) => {
  fireEvent.changeText(
    view.getByLabelText('Mật khẩu hiện tại'),
    'old-password',
  );
  fireEvent.changeText(view.getByLabelText('Mật khẩu mới'), 'new-password');
  fireEvent.changeText(
    view.getByLabelText('Nhập lại mật khẩu mới'),
    'new-password',
  );
};
beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ uid, email: 'p@example.com', displayName: null });
  jest.mocked(changeAccountPassword).mockReset().mockResolvedValue(undefined);
});
test.each([
  ['', 'new-password', 'new-password', 'hiện tại'],
  ['old-password', 'short', 'short', '8 ký tự'],
  ['old-password', 'old-password', 'old-password', 'khác'],
  ['old-password', 'new-password', 'not-matching', 'chưa khớp'],
])(
  'validates password form without a network call',
  (old, next, confirmation, message) => {
    expect(validatePasswordChange(old, next, confirmation)).toContain(message);
  },
);
test('mismatch stays in the form and current-password errors never show success', async () => {
  const view = render(<ChangePasswordDialog uid={uid} onClose={jest.fn()} />);
  fill(view);
  fireEvent.changeText(
    view.getByLabelText('Nhập lại mật khẩu mới'),
    'mismatch',
  );
  fireEvent.press(view.getByLabelText('Cập nhật mật khẩu'));
  expect(view.getByText('Mật khẩu xác nhận chưa khớp.')).toBeTruthy();
  expect(changeAccountPassword).not.toHaveBeenCalled();
  fireEvent.changeText(
    view.getByLabelText('Nhập lại mật khẩu mới'),
    'new-password',
  );
  jest
    .mocked(changeAccountPassword)
    .mockRejectedValueOnce({ code: 'auth/wrong-password' });
  await act(async () =>
    fireEvent.press(view.getByLabelText('Cập nhật mật khẩu')),
  );
  expect(
    view.getByText('Mật khẩu hiện tại chưa đúng. Hãy kiểm tra lại.'),
  ).toBeTruthy();
  expect(view.queryByText('Đã đổi mật khẩu')).toBeNull();
});
test('single submit, blocks closing while busy, then clears inputs and reports success', async () => {
  const close = jest.fn();
  let finish!: () => void;
  jest.mocked(changeAccountPassword).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<ChangePasswordDialog uid={uid} onClose={close} />);
  fill(view);
  fireEvent.press(view.getByLabelText('Hiện mật khẩu hiện tại'));
  expect(view.getByLabelText('Mật khẩu hiện tại').props.secureTextEntry).toBe(
    false,
  );
  fireEvent.press(view.getByLabelText('Cập nhật mật khẩu'));
  fireEvent.press(view.getByLabelText('Cập nhật mật khẩu'));
  fireEvent.press(view.getByLabelText('Đóng đổi mật khẩu'));
  expect(close).not.toHaveBeenCalled();
  expect(changeAccountPassword).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(view.getByText('Đã đổi mật khẩu')).toBeTruthy();
  expect(view.queryByLabelText('Mật khẩu hiện tại')).toBeNull();
  fireEvent.press(view.getByLabelText('Hoàn tất'));
  expect(close).toHaveBeenCalledTimes(1);
});
test('hides the form after UID changes and ignores a late result', async () => {
  let finish!: () => void;
  jest.mocked(changeAccountPassword).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<ChangePasswordDialog uid={uid} onClose={jest.fn()} />);
  fill(view);
  fireEvent.press(view.getByLabelText('Cập nhật mật khẩu'));
  act(() =>
    useAuthStore
      .getState()
      .setUser({ uid: 'other', email: null, displayName: null }),
  );
  await act(async () => finish());
  expect(view.queryByText('Đã đổi mật khẩu')).toBeNull();
  expect(view.queryByLabelText('Mật khẩu hiện tại')).toBeNull();
});
test('clears secrets and hides values when app leaves foreground', async () => {
  let background!: (state: AppStateStatus) => void;
  const spy = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, handler) => {
      // Every password field also hides its eye state. Capture the parent's last subscription.
      background = handler;
      return { remove: jest.fn() };
    });
  const view = render(<ChangePasswordDialog uid={uid} onClose={jest.fn()} />);
  fill(view);
  act(() => background('background'));
  await waitFor(() =>
    expect(view.getByLabelText('Mật khẩu hiện tại').props.value).toBe(''),
  );
  expect(view.getByLabelText('Mật khẩu mới').props.value).toBe('');
  view.unmount();
  spy.mockRestore();
});
