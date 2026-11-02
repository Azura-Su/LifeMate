import { fireEvent, render, screen } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import { CardRoomScanner } from '../CardRoomScanner';

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(),
}));

beforeEach(() => {
  jest
    .mocked(useCameraPermissions)
    .mockReturnValue([
      { granted: true, canAskAgain: true },
      jest.fn(),
      jest.fn(),
    ] as never);
});

it('accepts one valid invite and ignores repeated native scan events', () => {
  const onCode = jest.fn();
  render(<CardRoomScanner onCode={onCode} onClose={jest.fn()} />);
  const camera = screen.getByTestId('room-qr-camera');
  fireEvent(camera, 'barcodeScanned', { data: 'https://unrelated.example/' });
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(onCode).not.toHaveBeenCalled();
  fireEvent(camera, 'barcodeScanned', { data: 'LIFEMATE:ROOM:1:ABCDEFGH' });
  fireEvent(camera, 'barcodeScanned', { data: 'LIFEMATE:ROOM:1:23456789' });
  expect(onCode).toHaveBeenCalledTimes(1);
  expect(onCode).toHaveBeenCalledWith('ABCDEFGH');
});

it('does not start the camera before permission and preserves manual entry', () => {
  const request = jest.fn(async () => ({ granted: false }));
  jest
    .mocked(useCameraPermissions)
    .mockReturnValue([
      { granted: false, canAskAgain: true },
      request,
      jest.fn(),
    ] as never);
  const onClose = jest.fn();
  render(<CardRoomScanner onCode={jest.fn()} onClose={onClose} />);
  expect(screen.queryByTestId('room-qr-camera')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Cho phép camera' }));
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Nhập mã thủ công' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('unmounts a failed camera and ignores events after close/unmount', () => {
  const onCode = jest.fn();
  const view = render(<CardRoomScanner onCode={onCode} onClose={jest.fn()} />);
  const camera = screen.getByTestId('room-qr-camera');
  const scan = camera.props.onBarcodeScanned;
  fireEvent(camera, 'mountError', { message: 'unavailable' });
  expect(screen.queryByTestId('room-qr-camera')).toBeNull();
  expect(screen.getByRole('button', { name: 'Nhập mã thủ công' })).toBeTruthy();
  scan({ data: 'LIFEMATE:ROOM:1:ABCDEFGH' });
  expect(onCode).not.toHaveBeenCalled();
  view.unmount();
  scan({ data: 'LIFEMATE:ROOM:1:ABCDEFGH' });
  expect(onCode).not.toHaveBeenCalled();
});
