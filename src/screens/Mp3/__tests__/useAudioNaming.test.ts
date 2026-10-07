import { act, renderHook } from '@testing-library/react-native';
import { getDocumentAsync } from 'expo-document-picker';
import { useAudioNaming } from '../useAudioNaming';
import { importAudio } from '../../../services/audio/audioOperations';
import { removeTemporaryAudio } from '../../../services/audio/audioFiles';
import { useAuthStore } from '../../../store/authStore';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
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
