import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MemoryCapture } from '../MemoryCapture';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { useScreenActive } from '../../../hooks/useScreenActive';
import { NavigationContext } from '@react-navigation/native';
const mockTakePicture = jest.fn();
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('expo-camera', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
    CameraView: React.forwardRef(function MockCamera(
      props: object,
      ref: unknown,
    ) {
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: mockTakePicture,
      }));
      return <View {...props} testID="camera" />;
    }),
  };
});
beforeEach(() => mockTakePicture.mockReset());

it('reports capture immediately and delivers the photo only when ready, blocking repeated taps', async () => {
  let finish!: (photo: object) => void;
  mockTakePicture.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const onPhoto = jest.fn();
  const onCapturingChange = jest.fn();
  render(
    <MemoryCapture
      active
      onPhoto={onPhoto}
      onCapturingChange={onCapturingChange}
    />,
  );
  fireEvent(screen.getByTestId('camera'), 'cameraReady');
  fireEvent.press(screen.getByRole('button', { name: 'Chụp khoảnh khắc' }));
  expect(onCapturingChange).toHaveBeenLastCalledWith(true);
  expect(onPhoto).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Đổi camera trước sau' }),
  ).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Chụp khoảnh khắc' }));
  expect(mockTakePicture).toHaveBeenCalledTimes(1);
  await act(async () =>
    finish({ uri: 'file:///capture.jpg', width: 600, height: 800 }),
  );
  expect(onPhoto).toHaveBeenCalledWith({
    uri: 'file:///capture.jpg',
    mimeType: 'image/jpeg',
    aspectRatio: 0.75,
  });
  expect(onCapturingChange).toHaveBeenLastCalledWith(false);
});

it('restores capture controls and shows errors if capture fails', async () => {
  mockTakePicture.mockRejectedValue(new Error('Chụp thất bại'));
  const onCapturingChange = jest.fn();
  render(
    <MemoryCapture
      active
      onPhoto={jest.fn()}
      onCapturingChange={onCapturingChange}
    />,
  );
  fireEvent(screen.getByTestId('camera'), 'cameraReady');
  fireEvent.press(screen.getByRole('button', { name: 'Chụp khoảnh khắc' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Chụp thất bại');
  expect(
    screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
  ).not.toBeDisabled();
  expect(onCapturingChange).toHaveBeenLastCalledWith(false);
});

it('does not open the editor when an old capture completes after leaving', async () => {
  let finish!: (photo: object) => void;
  mockTakePicture.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const onPhoto = jest.fn();
  const props = {
    onPhoto,
    onCapturingChange: jest.fn(),
  };
  const { rerender } = render(<MemoryCapture {...props} active />);
  fireEvent(screen.getByTestId('camera'), 'cameraReady');
  fireEvent.press(screen.getByRole('button', { name: 'Chụp khoảnh khắc' }));
  rerender(<MemoryCapture {...props} active={false} />);
  await act(async () =>
    finish({ uri: 'file:///old.jpg', width: 600, height: 800 }),
  );
  expect(onPhoto).not.toHaveBeenCalled();
});

function LifecycleCapture() {
  const active = useScreenActive();
  return (
    <MemoryCapture
      active={active}
      onPhoto={jest.fn()}
      onCapturingChange={jest.fn()}
    />
  );
}

it('keeps the camera unmounted until foreground and releases it on inactive/background', () => {
  const original = AppState.currentState;
  AppState.currentState = 'inactive';
  let changed!: (state: AppStateStatus) => void;
  const subscription = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      changed = callback;
      return { remove: jest.fn() };
    });
  try {
    const view = render(<LifecycleCapture />);
    expect(screen.queryByTestId('camera')).toBeNull();
    act(() => changed('active'));
    expect(screen.getByTestId('camera')).toBeTruthy();
    fireEvent(screen.getByTestId('camera'), 'cameraReady');
    expect(
      screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
    ).toBeEnabled();
    act(() => changed('inactive'));
    expect(screen.queryByTestId('camera')).toBeNull();
    act(() => changed('background'));
    expect(screen.queryByTestId('camera')).toBeNull();
    act(() => changed('active'));
    expect(screen.getByTestId('camera')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
    ).toBeDisabled();
    fireEvent(screen.getByTestId('camera'), 'cameraReady');
    expect(
      screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
    ).toBeEnabled();
    view.unmount();
  } finally {
    subscription.mockRestore();
    AppState.currentState = original;
  }
});

it('releases the camera when navigating away even while the app remains active', () => {
  const original = AppState.currentState;
  AppState.currentState = 'active';
  const subscription = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
  const listeners = new Map<string, () => void>();
  const navigation = {
    isFocused: () => true,
    addListener: (event: string, callback: () => void) => {
      listeners.set(event, callback);
      return () => listeners.delete(event);
    },
  };
  try {
    const view = render(
      <NavigationContext.Provider value={navigation as never}>
        <LifecycleCapture />
      </NavigationContext.Provider>,
    );
    expect(screen.getByTestId('camera')).toBeTruthy();
    act(() => listeners.get('blur')?.());
    expect(screen.queryByTestId('camera')).toBeNull();
    act(() => listeners.get('focus')?.());
    expect(screen.getByTestId('camera')).toBeTruthy();
    view.unmount();
    expect(listeners.size).toBe(0);
  } finally {
    subscription.mockRestore();
    AppState.currentState = original;
  }
});

it('starts a fresh iOS camera on flip and blocks flip/capture until its own ready event', () => {
  const view = render(
    <MemoryCapture active onPhoto={jest.fn()} onCapturingChange={jest.fn()} />,
  );
  const oldCamera = screen.getByTestId('camera');
  const staleReady = oldCamera.props.onCameraReady;
  fireEvent(oldCamera, 'cameraReady');
  fireEvent.press(screen.getByRole('button', { name: 'Đổi camera trước sau' }));
  const nextCamera = screen.getByTestId('camera');
  expect(nextCamera.props.facing).toBe('front');
  expect(nextCamera).not.toBe(oldCamera);
  expect(
    screen.getByRole('button', { name: 'Đổi camera trước sau' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
  ).toBeDisabled();
  act(() => staleReady());
  expect(
    screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
  ).toBeDisabled();
  fireEvent(nextCamera, 'cameraReady');
  expect(
    screen.getByRole('button', { name: 'Đổi camera trước sau' }),
  ).toBeEnabled();
  expect(
    screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
  ).toBeEnabled();
  view.unmount();
});

it('ignores readiness and errors from an old camera after retry', () => {
  const view = render(
    <MemoryCapture active onPhoto={jest.fn()} onCapturingChange={jest.fn()} />,
  );
  const old = screen.getByTestId('camera');
  const staleReady = old.props.onCameraReady;
  const staleError = old.props.onMountError;
  fireEvent(old, 'mountError', { message: 'Camera disconnected' });
  fireEvent.press(screen.getByRole('button', { name: 'Thử mở lại máy ảnh' }));
  act(() => {
    staleReady();
    staleError({ message: 'Old session failure' });
  });
  expect(screen.getByTestId('camera')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
  ).toBeDisabled();
  fireEvent(screen.getByTestId('camera'), 'cameraReady');
  expect(
    screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
  ).toBeEnabled();
  view.unmount();
});

it('keeps Android native camera mounted while changing facing and waits for readiness', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  try {
    const view = render(
      <MemoryCapture
        active
        onPhoto={jest.fn()}
        onCapturingChange={jest.fn()}
      />,
    );
    const camera = screen.getByTestId('camera');
    fireEvent(camera, 'cameraReady');
    const flip = screen.getByRole('button', { name: 'Đổi camera trước sau' });
    act(() => {
      fireEvent.press(flip);
      fireEvent.press(flip);
    }); // Two taps in the same JS turn must enqueue only one change.
    expect(screen.getByTestId('camera')).toBe(camera);
    expect(camera.props.facing).toBe('front');
    expect(
      screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
    ).toBeDisabled();
    fireEvent(camera, 'cameraReady');
    expect(
      screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
    ).toBeEnabled();
    view.unmount();
  } finally {
    platform.restore();
  }
});
it('can recover a timed-out flip and never accepts the old session ready callback', () => {
  jest.useFakeTimers();
  try {
    const view = render(
      <MemoryCapture
        active
        onPhoto={jest.fn()}
        onCapturingChange={jest.fn()}
      />,
    );
    fireEvent(screen.getByTestId('camera'), 'cameraReady');
    fireEvent.press(
      screen.getByRole('button', { name: 'Đổi camera trước sau' }),
    );
    const oldReady = screen.getByTestId('camera').props.onCameraReady;
    act(() => jest.advanceTimersByTime(10000));
    expect(screen.queryByTestId('camera')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Thử mở lại máy ảnh' }));
    act(() => oldReady());
    expect(
      screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
    ).toBeDisabled();
    fireEvent(screen.getByTestId('camera'), 'cameraReady');
    expect(
      screen.getByRole('button', { name: 'Chụp khoảnh khắc' }),
    ).toBeEnabled();
    view.unmount();
  } finally {
    jest.useRealTimers();
  }
});
