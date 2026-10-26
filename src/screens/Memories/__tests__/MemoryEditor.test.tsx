import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from '@testing-library/react-native';
import { MemoryEditor } from '../MemoryEditor';
import * as ImagePicker from 'expo-image-picker';
import type { MemoryDraft, MemoryEntry } from '../../../types/memory';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { DialogModal } from '../../../components/DialogModal';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('../../../services/memories/memoryStorage', () => ({
  memoryPhotoUri: (_uid: string, file: string | null) =>
    file ? `file:///${file}` : null,
}));
beforeEach(() =>
  jest
    .spyOn(Image, 'getSize')
    .mockImplementation(() => Promise.resolve({ width: 400, height: 400 })),
);
afterEach(() => jest.restoreAllMocks());
const entry: MemoryEntry = {
  id: 'one',
  ownerId: 'alice',
  dateKey: '2026-10-15',
  text: 'Old text',
  photoFileName: 'original.jpg',
  createdAt: 100,
  updatedAt: 100,
};
it.each(['private', 'friends'] as const)(
  'edits only text and retains %s visibility and the original photo',
  async (visibility) => {
    const onSave = jest.fn(async () => {});
    const onClose = jest.fn();
    const view = render(
      <MemoryEditor
        visible
        uid="alice"
        entry={entry}
        initialVisibility={visibility}
        busy={false}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    expect(Image.getSize).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Chụp lại ảnh' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Ai có thể xem/ })).toBeNull();
    expect(screen.queryByLabelText('Ảnh khoảnh khắc đã chọn')).toBeNull();
    fireEvent.changeText(
      screen.getByLabelText('Nội dung ký ức'),
      'Updated text',
    );
    view.rerender(
      <MemoryEditor
        visible
        uid="alice"
        entry={entry}
        initialVisibility={visibility === 'friends' ? 'private' : 'friends'}
        busy={false}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        dateKey: entry.dateKey,
        text: 'Updated text',
        photoUri: 'file:///original.jpg',
        photoMimeType: null,
        photoChange: 'keep',
        visibility,
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  },
);
it('allows editing legacy text-only memories without asking for a photo', async () => {
  const onSave = jest.fn(async () => {});
  render(
    <MemoryEditor
      visible
      uid="alice"
      entry={{ ...entry, photoFileName: null }}
      initialVisibility="private"
      busy={false}
      onSave={onSave}
      onClose={jest.fn()}
    />,
  );
  fireEvent.changeText(
    screen.getByLabelText('Nội dung ký ức'),
    'Legacy updated',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Legacy updated',
        photoUri: null,
        photoChange: 'keep',
      }),
    ),
  );
});
it('retains photo and visibility choices without rereading known camera dimensions', () => {
  render(
    <MemoryEditor
      visible
      uid="alice"
      entry={null}
      initialVisibility="private"
      initialPhoto={{
        uri: 'file:///capture.jpg',
        mimeType: 'image/jpeg',
        aspectRatio: 1,
        width: 800,
        height: 800,
      }}
      busy={false}
      onSave={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: 'Chụp lại ảnh' })).toBeTruthy();
  expect(Image.getSize).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /^Ai có thể xem/ })).toBeTruthy();
  expect(screen.getByLabelText('Ảnh khoảnh khắc đã chọn')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: /^Ai có thể xem/ }));
  expect(
    screen.getByRole('button', {
      name: 'Chọn Chỉ mình tôi. Chỉ bạn xem, đồng bộ theo tài khoản',
    }),
  ).toBeTruthy();
  expect(screen.queryByText('Chỉ lưu trên thiết bị này')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Lưu khoảnh khắc' })).toBeNull();
});

it.each([
  { aspectRatio: 3 / 4 },
  { aspectRatio: NaN, width: 0, height: 800 },
  { aspectRatio: Infinity, width: 600, height: Infinity },
])(
  'reads photo dimensions when camera metadata is unknown (%j)',
  (metadata) => {
    render(
      <MemoryEditor
        visible
        uid="alice"
        entry={null}
        initialVisibility="private"
        initialPhoto={{
          uri: 'file:///unknown.jpg',
          mimeType: 'image/jpeg',
          ...metadata,
        }}
        busy={false}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(Image.getSize).toHaveBeenCalledWith(
      'file:///unknown.jpg',
      expect.any(Function),
      expect.any(Function),
    );
  },
);

it.each([true, false])(
  'uses fresh picker metadata after retaking a photo (known=%s)',
  async (known) => {
    const onSave = jest.fn<Promise<void>, [MemoryDraft]>(async () => {});
    jest
      .mocked(ImagePicker.requestCameraPermissionsAsync)
      .mockResolvedValue({ granted: true } as never);
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///retaken.jpg',
          width: known ? 1200 : 0,
          height: known ? 800 : 0,
          mimeType: 'image/jpeg',
        },
      ],
    } as never);
    render(
      <MemoryEditor
        visible
        uid="alice"
        entry={null}
        initialVisibility="private"
        initialPhoto={{
          uri: 'file:///original.jpg',
          mimeType: 'image/jpeg',
          aspectRatio: 1,
          width: 800,
          height: 800,
        }}
        busy={false}
        onSave={onSave}
        onClose={jest.fn()}
      />,
    );
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Chụp lại ảnh' })),
    );
    if (known) expect(Image.getSize).not.toHaveBeenCalled();
    else
      expect(Image.getSize).toHaveBeenCalledWith(
        'file:///retaken.jpg',
        expect.any(Function),
        expect.any(Function),
      );
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Lưu khoảnh khắc' })),
    );
    const draft = onSave.mock.calls[0][0];
    expect(draft.photoUri).toBe('file:///retaken.jpg');
    if (known)
      expect(draft.photoDimensions).toEqual({ width: 1200, height: 800 });
    else expect(draft).not.toHaveProperty('photoDimensions');
  },
);
it('keeps the text editor open on save failure for retry', async () => {
  render(
    <MemoryEditor
      visible
      uid="alice"
      entry={entry}
      initialVisibility="private"
      busy={false}
      onSave={jest.fn().mockRejectedValue(new Error('Save failed'))}
      onClose={jest.fn()}
    />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Save failed');
  expect(screen.getByLabelText('Nội dung ký ức')).toHaveDisplayValue(
    'Old text',
  );
});

it('dismisses the keyboard outside the input without interrupting text touches or closing the draft', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const onClose = jest.fn();
  const onSave = jest.fn(async () => {});
  render(
    <MemoryEditor
      visible
      uid="alice"
      entry={entry}
      initialVisibility="private"
      busy={false}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  const stopPropagation = jest.fn();
  fireEvent(screen.getByLabelText('Nội dung ký ức'), 'touchEnd', {
    stopPropagation,
  });
  expect(stopPropagation).toHaveBeenCalledTimes(1);
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent(screen.getByRole('header', { name: 'Sửa nội dung' }), 'touchEnd');
  fireEvent(screen.getByText('Nội dung'), 'touchEnd');
  fireEvent(screen.UNSAFE_getByType(KeyboardAvoidingView), 'touchEnd');
  expect(dismiss).toHaveBeenCalledTimes(3);
  expect(onClose).not.toHaveBeenCalled();
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.changeText(
    screen.getByLabelText('Nội dung ký ức'),
    'Updated draft',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Updated draft' }),
    ),
  );
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it.each([3 / 4, 16 / 9])(
  'fits the photo form above the keyboard without scrolling the photo (ratio %s)',
  async (aspectRatio) => {
    const onSave = jest.fn(async () => {});
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    render(
      <MemoryEditor
        visible
        uid="alice"
        entry={null}
        initialVisibility="friends"
        initialPhoto={{
          uri: 'file:///capture.jpg',
          mimeType: 'image/jpeg',
          aspectRatio,
        }}
        busy={false}
        onSave={onSave}
        onClose={jest.fn()}
      />,
    );
    expect(screen.UNSAFE_queryByType(ScrollView)).toBeNull();
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe(
      'padding',
    );
    expect(screen.getByLabelText('Ảnh khoảnh khắc đã chọn')).toBeTruthy();
    fireEvent(screen.getByLabelText('Ảnh khoảnh khắc đã chọn'), 'touchEnd');
    expect(dismiss).toHaveBeenCalledTimes(1);
    fireEvent.changeText(
      screen.getByLabelText('Nội dung ký ức'),
      'Một ngày đáng nhớ',
    );
    fireEvent.press(screen.getByRole('button', { name: 'Lưu khoảnh khắc' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Một ngày đáng nhớ',
          visibility: 'friends',
        }),
      ),
    );
  },
);

it('docks 12 points above the keyboard and keeps the header and close action available', () => {
  const listeners = jest.spyOn(Keyboard, 'addListener');
  const onClose = jest.fn();
  render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 59, bottom: 34, left: 0, right: 0 }}
    >
      <MemoryEditor
        visible
        uid="alice"
        entry={null}
        initialVisibility="friends"
        initialPhoto={{
          uri: 'file:///capture.jpg',
          mimeType: 'image/jpeg',
          aspectRatio: 3 / 4,
        }}
        busy={false}
        onSave={jest.fn()}
        onClose={onClose}
      />
    </SafeAreaInsetsContext.Provider>,
  );
  const keyboard = screen.UNSAFE_getByType(KeyboardAvoidingView);
  expect(keyboard.props.behavior).toBe('padding');
  expect(
    StyleSheet.flatten(screen.getByTestId('dialog-overlay').props.style)
      .justifyContent,
  ).toBe('center');
  const show = listeners.mock.calls
    .filter(([name]) => name === 'keyboardWillShow')
    .at(-1)![1];
  const hide = listeners.mock.calls
    .filter(([name]) => name === 'keyboardWillHide')
    .at(-1)![1];
  act(() =>
    show({
      endCoordinates: { screenY: 550, screenX: 0, width: 390, height: 294 },
      duration: 250,
      easing: 'keyboard',
      isEventFromThisApp: true,
    }),
  );
  expect(
    StyleSheet.flatten(screen.getByTestId('dialog-overlay').props.style),
  ).toMatchObject({
    justifyContent: 'flex-end',
    paddingTop: 67,
  });
  expect(screen.getByRole('header', { name: 'Khoảnh khắc mới' })).toBeTruthy();
  expect(
    StyleSheet.flatten(screen.UNSAFE_getByType(DialogModal).props.style),
  ).toMatchObject({ maxHeight: '100%', marginBottom: 12 });
  fireEvent.press(screen.getByRole('button', { name: 'Đóng khoảnh khắc' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  act(() =>
    hide({
      endCoordinates: { screenY: 844, screenX: 0, width: 390, height: 0 },
      duration: 250,
      easing: 'keyboard',
      isEventFromThisApp: true,
    }),
  );
  expect(
    StyleSheet.flatten(screen.getByTestId('dialog-overlay').props.style)
      .justifyContent,
  ).toBe('center');
});

it('preserves Android window resizing without adding a second keyboard shift', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  render(
    <MemoryEditor
      visible
      uid="alice"
      entry={entry}
      initialVisibility="private"
      busy={false}
      onSave={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  expect(
    screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior,
  ).toBeUndefined();
});

it.each(['friends', 'private'] as const)(
  'starts new photos with Friends selected and saves the chosen %s visibility',
  async (visibility) => {
    const onSave = jest.fn(async () => {});
    render(
      <MemoryEditor
        visible
        uid="alice"
        entry={null}
        initialVisibility="friends"
        initialPhoto={{
          uri: 'file:///capture.jpg',
          mimeType: 'image/jpeg',
          aspectRatio: 1,
        }}
        busy={false}
        onSave={onSave}
        onClose={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Ai có thể xem? Bạn bè' }),
    ).toBeTruthy();
    if (visibility === 'private') {
      fireEvent.press(
        screen.getByRole('button', { name: 'Ai có thể xem? Bạn bè' }),
      );
      fireEvent.press(
        screen.getByRole('button', { name: /^Chọn Chỉ mình tôi/ }),
      );
    }
    fireEvent.press(screen.getByRole('button', { name: 'Lưu khoảnh khắc' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility,
          photoUri: 'file:///capture.jpg',
        }),
      ),
    );
  },
);
