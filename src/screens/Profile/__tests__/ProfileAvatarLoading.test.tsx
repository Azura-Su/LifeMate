import { fireEvent, render } from '@testing-library/react-native';
import { ProfileScreen } from '../ProfileScreen';
import { useAuthStore } from '../../../store/authStore';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('../../../components/Screen', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Screen: function MockScreen({ children }: { children: React.ReactNode }) {
      return <View>{children}</View>;
    },
  };
});
jest.mock('../../../components/UserAvatar', () => ({ UserAvatar: () => null }));
jest.mock('../ProfileEmailVerification', () => ({
  ProfileEmailVerification: () => null,
}));
jest.mock('../ChangePasswordDialog', () => ({
  ChangePasswordDialog: () => null,
}));
const mockModel = {
  user: { uid: 'alice', email: 'a@example.com', displayName: 'Alice' },
  name: 'Alice',
  setName: jest.fn(),
  photo: undefined,
  cropSource: null,
  busy: null as 'pick' | 'crop' | 'save' | null,
  error: null,
  saved: false,
  canEditPhoto: true,
  pick: jest.fn(),
  editPhoto: jest.fn(),
  cancelCrop: jest.fn(),
  applyCrop: jest.fn(),
  save: jest.fn(),
};
jest.mock('../useProfileEditor', () => ({ useProfileEditor: () => mockModel }));
const props = {
  navigation: { navigate: jest.fn() } as never,
  route: { key: 'profile', name: 'Profile' } as never,
};
beforeEach(() => {
  jest.clearAllMocks();
  mockModel.busy = null;
  useAuthStore.getState().setUser(mockModel.user);
});
test('camera becomes loading immediately on avatar press and clears when sheet is shown', () => {
  const view = render(<ProfileScreen {...props} />);
  expect(view.queryByTestId('avatar-camera-loading')).toBeNull();
  fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'));
  expect(view.getByTestId('avatar-camera-loading')).toBeTruthy();
  expect(
    view.getByLabelText('Đổi ảnh đại diện', { includeHiddenElements: true })
      .props.accessibilityState.busy,
  ).toBe(true);
  fireEvent(view.getByTestId('avatar-sheet-modal'), 'show');
  expect(view.queryByTestId('avatar-camera-loading')).toBeNull();
});
test('closing during presentation clears loading, and photo processing keeps it visible', () => {
  const view = render(<ProfileScreen {...props} />);
  fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'));
  fireEvent.press(view.getByLabelText('Đóng chỉnh sửa ảnh đại diện'));
  expect(view.queryByTestId('avatar-camera-loading')).toBeNull();
  mockModel.busy = 'pick';
  view.rerender(<ProfileScreen {...props} />);
  expect(view.getByTestId('avatar-camera-loading')).toBeTruthy();
  mockModel.busy = 'crop';
  view.rerender(<ProfileScreen {...props} />);
  expect(view.getByTestId('avatar-camera-loading')).toBeTruthy();
  mockModel.busy = null;
  view.rerender(<ProfileScreen {...props} />);
  expect(view.queryByTestId('avatar-camera-loading')).toBeNull();
});
