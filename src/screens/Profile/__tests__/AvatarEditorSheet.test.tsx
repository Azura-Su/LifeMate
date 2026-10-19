import { act, fireEvent, render } from '@testing-library/react-native';
import { AvatarEditorSheet } from '../AvatarEditorSheet';
import { PanResponder, Platform } from 'react-native';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-native-community/slider', () => {
  const { View } = jest.requireActual('react-native');
  return function MockSlider(props: object) {
    return <View {...props} />;
  };
});
const base = {
  visible: true,
  source: null,
  busy: false,
  error: null,
  canEdit: true,
  onClose: jest.fn(),
  onEdit: jest.fn(),
  onPick: jest.fn(),
  onApply: jest.fn(),
};
beforeEach(() => {
  jest.clearAllMocks();
});
test('offers exactly the current-avatar edit and library actions, with edit disabled if no avatar', () => {
  const view = render(<AvatarEditorSheet {...base} canEdit={false} />);
  expect(
    view.getByLabelText('Chỉnh sửa ảnh hiện tại').props.accessibilityState
      .disabled,
  ).toBe(true);
  expect(view.getByLabelText('Chọn ảnh từ thư viện')).toBeTruthy();
  view.rerender(<AvatarEditorSheet {...base} />);
  fireEvent.press(view.getByLabelText('Chỉnh sửa ảnh hiện tại'));
  expect(base.onEdit).toHaveBeenCalledTimes(1);
  expect(base.onPick).not.toHaveBeenCalled();
});
test('waits for iOS sheet dismissal before opening the native photo library, once only', () => {
  const previous = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  const view = render(<AvatarEditorSheet {...base} />);
  fireEvent.press(view.getByLabelText('Chọn ảnh từ thư viện'));
  expect(base.onClose).toHaveBeenCalledTimes(1);
  expect(base.onPick).not.toHaveBeenCalled();
  fireEvent(view.getByTestId('avatar-sheet-modal'), 'dismiss');
  fireEvent(view.getByTestId('avatar-sheet-modal'), 'dismiss');
  expect(base.onPick).toHaveBeenCalledTimes(1);
  Object.defineProperty(Platform, 'OS', {
    value: previous,
    configurable: true,
  });
});
test('previews the existing image, changes crop with zoom and movement, and exports that square', () => {
  const view = render(
    <AvatarEditorSheet
      {...base}
      source={{ uri: 'file:///avatar.jpg', width: 800, height: 600 }}
    />,
  );
  expect(view.getByLabelText('Ảnh đang chỉnh sửa').props.source.uri).toBe(
    'file:///avatar.jpg',
  );
  fireEvent(view.getByLabelText('Phóng to ảnh'), 'valueChange', 2);
  fireEvent(view.getByLabelText('Vùng cắt ảnh'), 'accessibilityAction', {
    nativeEvent: { actionName: 'right' },
  });
  fireEvent.press(view.getByLabelText('Dùng ảnh'));
  expect(base.onApply).toHaveBeenCalledWith(
    expect.objectContaining({ width: 300, height: 300, originY: 150 }),
  );
  expect(base.onApply.mock.calls[0][0].originX).toBeLessThan(250);
  fireEvent.press(view.getByLabelText('Đặt lại vùng cắt'));
  fireEvent.press(view.getByLabelText('Dùng ảnh'));
  expect(base.onApply).toHaveBeenLastCalledWith({
    originX: 100,
    originY: 0,
    width: 600,
    height: 600,
  });
});
test('cancel closes without exporting a crop and busy prevents double apply', () => {
  const view = render(
    <AvatarEditorSheet
      {...base}
      busy
      source={{ uri: 'file:///avatar.jpg', width: 384, height: 384 }}
    />,
  );
  fireEvent.press(view.getByLabelText('Dùng ảnh'));
  expect(base.onApply).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText('Đóng chỉnh sửa ảnh đại diện'));
  expect(base.onClose).toHaveBeenCalled();
});

test('dragging the preview clamps at image edges and exports the moved region', () => {
  const pan = jest.spyOn(PanResponder, 'create');
  const view = render(
    <AvatarEditorSheet
      {...base}
      source={{ uri: 'file:///avatar.jpg', width: 800, height: 600 }}
    />,
  );
  fireEvent(view.getByLabelText('Phóng to ảnh'), 'valueChange', 2);
  const handlers = pan.mock.calls[0][0];
  act(() => {
    handlers.onPanResponderGrant!({} as never, {} as never);
    handlers.onPanResponderMove!(
      {} as never,
      { dx: 10000, dy: -10000 } as never,
    );
  });
  fireEvent.press(view.getByLabelText('Dùng ảnh'));
  expect(base.onApply).toHaveBeenCalledWith({
    originX: 0,
    originY: 300,
    width: 300,
    height: 300,
  });
  pan.mockRestore();
});
