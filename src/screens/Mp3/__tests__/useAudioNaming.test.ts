import { act, renderHook } from '@testing-library/react-native';
import { getDocumentAsync } from 'expo-document-picker';
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
} from 'expo-image-picker';
import { useAudioNaming } from '../useAudioNaming';
import { importAudio } from '../../../services/audio/audioOperations';
import { removeTemporaryAudio } from '../../../services/audio/audioFiles';
import { useAuthStore } from '../../../store/authStore';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));
jest.mock('../../../services/audio/audioOperations', () => ({
  importAudio: jest.fn(),
}));
jest.mock('../../../services/audio/audioTitles', () => ({
  renameAudio: jest.fn(),
}));
jest.mock('../../../services/audio/audioFiles', () => ({
  removeTemporaryAudio: jest.fn(),
}));
const asset = {
  name: 'recording.mp4',
  uri: 'file:///cache/copy.mp4',
  lastModified: 1,
};
let controller: AbortController;
const report = jest.fn();
const onSaved = jest.fn();
const onMessage = jest.fn();
function setup() {
  return renderHook(() =>
    useAudioNaming({
      uid: 'u1',
      report,
      onSaved,
      onMessage,
      run: async (action) => action(controller.signal),
    }),
  );
}
beforeEach(() => {
  controller = new AbortController();
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: null, displayName: null });
  jest
    .mocked(getDocumentAsync)
    .mockResolvedValue({ canceled: false, assets: [asset] });
  jest
    .mocked(requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  jest.mocked(launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: 'file:///cache/VID_1234.MOV',
        fileName: 'VID_1234.MOV',
        mimeType: 'video/quicktime',
        type: 'video',
      },
    ],
  } as never);
  jest
    .mocked(importAudio)
    .mockResolvedValue({ track: {} as never, warning: null });
});
it('waits for a name before importing and passes that title to the audio operation', async () => {
  const { result } = setup();
  await act(() => result.current.chooseFile());
  expect(result.current.draft).toMatchObject({
    kind: 'import',
    title: 'recording',
  });
  expect(importAudio).not.toHaveBeenCalled();
  await act(() => result.current.save('  Buổi chiều  '));
  expect(importAudio).toHaveBeenCalledWith(
    'u1',
    asset,
    controller.signal,
    report,
    onSaved,
    'Buổi chiều',
  );
  expect(result.current.draft).toBeNull();
  expect(removeTemporaryAudio).not.toHaveBeenCalled(); // importer now owns cleanup
});
it('lets the user select a video from the device album and imports its local copy', async () => {
  const { result } = setup();
  await act(() => result.current.chooseFromAlbum());
  expect(requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(launchImageLibraryAsync).toHaveBeenCalledWith({
    mediaTypes: ['videos'],
    allowsEditing: false,
    shouldDownloadFromNetwork: true,
  });
  expect(result.current.draft).toMatchObject({
    kind: 'import',
    title: 'VID_1234',
    asset: {
      name: 'VID_1234.MOV',
      uri: 'file:///cache/VID_1234.MOV',
    },
  });
  await act(() => result.current.save('Bài giảng'));
  expect(importAudio).toHaveBeenCalledWith(
    'u1',
    { name: 'VID_1234.MOV', uri: 'file:///cache/VID_1234.MOV' },
    controller.signal,
    report,
    onSaved,
    'Bài giảng',
  );
});
it('does not open the album picker when photo access is denied', async () => {
  jest
    .mocked(requestMediaLibraryPermissionsAsync)
    .mockResolvedValueOnce({ granted: false } as never);
  const { result } = setup();
  await act(() => result.current.chooseFromAlbum());
  expect(launchImageLibraryAsync).not.toHaveBeenCalled();
  expect(result.current.draft).toBeNull();
});
it('cleans only the picker copy when naming is cancelled or the screen closes', async () => {
  const { result, unmount } = setup();
  await act(() => result.current.chooseFile());
  act(() => result.current.close());
  expect(removeTemporaryAudio).toHaveBeenCalledWith(asset.uri);
  expect(result.current.draft).toBeNull();
  await act(() => result.current.chooseFile());
  unmount();
  expect(removeTemporaryAudio).toHaveBeenCalledTimes(2);
  expect(importAudio).not.toHaveBeenCalled();
});
it('does not open naming or save a picker result after the session is cancelled', async () => {
  const { result } = setup();
  controller.abort();
  await act(async () => {
    await expect(result.current.chooseFile()).rejects.toThrow('hủy');
  });
  expect(result.current.draft).toBeNull();
  expect(removeTemporaryAudio).toHaveBeenCalledWith(asset.uri);
  expect(importAudio).not.toHaveBeenCalled();
});
