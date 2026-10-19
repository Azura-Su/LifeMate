import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';
import { UserManagementScreen } from '../UserManagementScreen';
import {
  ADMIN_EMAIL,
  ADMIN_UID,
  manageUsers,
  type ManagedUser,
} from '../../../services/admin/userManagement';
import { useAuthStore } from '../../../store/authStore';

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(),
  getIdToken: jest.fn(),
}));
jest.mock('../../../services/admin/userManagement', () => ({
  ...jest.requireActual('../../../services/admin/userManagement'),
  manageUsers: jest.fn(),
}));
jest.mock('../../../components/Screen', () => {
  const { ScrollView, View } = jest.requireActual('react-native');
  return {
    Screen: ({ children, fixedHeader, fixedContent, refreshControl }: any) => (
      <>
        {fixedHeader}
        <View testID="fixed-search">{fixedContent}</View>
        <ScrollView testID="user-list" refreshControl={refreshControl}>
          {children}
        </ScrollView>
      </>
    ),
  };
});
jest.mock('../../../components/DialogModal', () => ({
  DialogModal: ({ children }: any) => <>{children}</>,
}));
const user: ManagedUser = {
  uid: 'target',
  email: 'target@example.com',
  name: 'Người dùng',
  verified: true,
  disabled: false,
  createdAt: 1,
  lastSignInAt: null,
  providers: ['password'],
  status: 'active',
  phase: 'ready',
  finalAfter: null,
  protected: false,
};
const navigation = { navigate: jest.fn() };
beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ uid: ADMIN_UID, email: ADMIN_EMAIL, displayName: 'Admin' });
  jest
    .mocked(manageUsers)
    .mockImplementation(async (input) =>
      input.action === 'jobs'
        ? { jobs: [] }
        : input.action === 'detail'
          ? { user }
          : ({ users: [user] } as never),
    );
});
test('ordinary users cannot load the admin endpoint', () => {
  useAuthStore.getState().setUser({
    uid: 'ordinary',
    email: 'ordinary@example.com',
    displayName: null,
  });
  const view = render(
    <UserManagementScreen
      navigation={navigation as never}
      route={{} as never}
    />,
  );
  expect(
    view.getByText('Bạn không có quyền truy cập màn hình này.'),
  ).toBeTruthy();
  expect(manageUsers).not.toHaveBeenCalled();
});
test.each([false, true])(
  'closes delete detail and reloads after success (refresh failure: %s)',
  async (refreshFails) => {
    const view = render(
      <UserManagementScreen
        navigation={navigation as never}
        route={{} as never}
      />,
    );
    await waitFor(() =>
      expect(view.getByLabelText('Chi tiết target@example.com')).toBeTruthy(),
    );
    fireEvent.press(view.getByLabelText('Chi tiết target@example.com'));
    await waitFor(() =>
      expect(view.getByText('Chi tiết tài khoản')).toBeTruthy(),
    );
    fireEvent.press(view.getByText('Xóa tài khoản'));
    fireEvent.changeText(
      view.getByLabelText('Email xác nhận xóa'),
      'wrong@example.com',
    );
    fireEvent.press(view.getByText('Xóa tài khoản và dữ liệu'));
    expect(
      jest
        .mocked(manageUsers)
        .mock.calls.some(([input]) => input.action === 'delete'),
    ).toBe(false);
    jest.mocked(manageUsers).mockImplementation(async (input) => {
      if (input.action === 'list' && refreshFails) throw new Error('Offline');
      return input.action === 'jobs'
        ? { jobs: [] }
        : input.action === 'list'
          ? { users: [{ ...user, status: 'deleting', authDeleted: true }] }
          : ({
              user: { ...user, status: 'deleting', authDeleted: true },
            } as never);
    });
    fireEvent.changeText(view.getByLabelText('Email xác nhận xóa'), user.email);
    await act(async () =>
      fireEvent.press(view.getByText('Xóa tài khoản và dữ liệu')),
    );
    expect(manageUsers).toHaveBeenCalledWith(
      { action: 'delete', uid: 'target', email: user.email },
      expect.any(AbortSignal),
    );
    expect(view.queryByText('Chi tiết tài khoản')).toBeNull();
    expect(view.getByText(/Đã xóa tài khoản đăng nhập/)).toBeTruthy();
    expect(
      jest
        .mocked(manageUsers)
        .mock.calls.filter(([input]) => input.action === 'list'),
    ).toHaveLength(2);
    expect(view.getByText('Đang xóa dữ liệu')).toBeTruthy();
    if (refreshFails)
      expect(
        view.getByText('Chưa tải lại được danh sách. Kéo xuống để thử lại.'),
      ).toBeTruthy();
  },
);
test('opening a user replaces only its arrow with loading until failure', async () => {
  const other = { ...user, uid: 'other', email: 'other@example.com' };
  jest
    .mocked(manageUsers)
    .mockImplementation(async (input) =>
      input.action === 'jobs' ? { jobs: [] } : { users: [user, other] },
    );
  const view = render(
    <UserManagementScreen
      navigation={navigation as never}
      route={{} as never}
    />,
  );
  await waitFor(() =>
    expect(
      view.getByLabelText('Chi tiết target@example.com').props
        .accessibilityState.disabled,
    ).toBe(false),
  );
  let reject!: (error: Error) => void;
  jest.mocked(manageUsers).mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  fireEvent.press(view.getByLabelText('Chi tiết target@example.com'));
  expect(view.getByTestId('opening-user-target')).toBeTruthy();
  expect(view.queryByTestId('opening-user-other')).toBeNull();
  expect(view.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);
  fireEvent.press(view.getByLabelText('Chi tiết other@example.com'));
  expect(
    jest
      .mocked(manageUsers)
      .mock.calls.filter(([input]) => input.action === 'detail'),
  ).toHaveLength(1);
  await act(async () => reject(new Error('Mất kết nối')));
  expect(view.queryByTestId('opening-user-target')).toBeNull();
  expect(view.getByText('Mất kết nối')).toBeTruthy();
});

test('keeps search outside the list and shows refresh loading until reload finishes', async () => {
  const view = render(
    <UserManagementScreen
      navigation={navigation as never}
      route={{} as never}
    />,
  );
  await waitFor(() =>
    expect(view.getByLabelText('Chi tiết target@example.com')).toBeTruthy(),
  );
  expect(
    view
      .getByTestId('fixed-search')
      .findByProps({ accessibilityLabel: 'Tìm email hoặc UID' }),
  ).toBeTruthy();
  expect(view.queryByLabelText('Tải lại danh sách')).toBeNull();
  expect(view.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  let finish!: (value: any) => void;
  jest.mocked(manageUsers).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() =>
    view.getByTestId('user-list').props.refreshControl.props.onRefresh(),
  );
  expect(
    view.getByTestId('user-list').props.refreshControl.props.refreshing,
  ).toBe(true);
  await act(async () => finish({ users: [user] }));
  await waitFor(() =>
    expect(
      view.getByTestId('user-list').props.refreshControl.props.refreshing,
    ).toBe(false),
  );
});
