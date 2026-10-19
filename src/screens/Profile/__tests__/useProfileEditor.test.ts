import { act, renderHook } from '@testing-library/react-native';
import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useProfileEditor } from '../useProfileEditor';
import { useAuthStore as mockAuthStore } from '../../../store/authStore';
import { updateAccountDisplayName } from '../../../services/firebase/authService';
import {
  readAvatar,
  uploadAvatar,
} from '../../../services/profile/avatarService';
const mockCrop = jest.fn();
const mockRender = jest.fn(async () => ({
  release: jest.fn(),
  saveAsync: async () => ({ uri: 'file:///cache/generated.jpg' }),
}));
const mockDelete = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../hooks/useProfile', () => ({
  useProfile: () => ({
    user: mockAuthStore((state) => state.user),
    name: mockAuthStore((state) => state.user?.displayName ?? 'Bạn'),
  }),
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  createDownloadResumable: jest.fn(),
  FileSystemSessionType: { FOREGROUND: 0 },
  deleteAsync: (...args: unknown[]) => mockDelete(...args),
  getInfoAsync: async () => ({ exists: true, size: 200, isDirectory: false }),
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      crop: (...args: unknown[]) => mockCrop(...args),
      resize: jest.fn(),
      release: jest.fn(),
      renderAsync: () => mockRender(),
    }),
  },
}));
jest.mock('../../../services/firebase/authService', () => ({
  updateAccountDisplayName: jest.fn(),
  currentSessionUser: (uid: string) =>
    mockAuthStore.getState().user?.uid === uid
      ? { ...mockAuthStore.getState().user, displayName: 'New name' }
      : null,
}));
jest.mock('../../../services/profile/avatarService', () => ({
  uploadAvatar: jest.fn(),
  removeAvatar: jest.fn(),
  readAvatar: jest.fn(),
}));
beforeEach(() => {
  mockDelete.mockClear();
  mockCrop.mockClear();
  mockRender.mockClear();
  jest
    .mocked(readAvatar)
    .mockReset()
    .mockResolvedValue('https://example.supabase.co/signed-avatar');
  jest
    .spyOn(Image, 'getSize')
    .mockImplementation(async () => ({ width: 384, height: 384 }));
  jest
    .mocked(FileSystem.createDownloadResumable)
    .mockReset()
    .mockReturnValue({
      downloadAsync: jest.fn(async () => ({ status: 200 })),
      cancelAsync: jest.fn(async () => {}),
    } as never);
  mockAuthStore
    .getState()
    .setUser({ uid: 'u1', email: 'a@example.com', displayName: 'Old' });
  jest
    .mocked(updateAccountDisplayName)
    .mockReset()
    .mockResolvedValue(undefined);
  jest
    .mocked(uploadAvatar)
    .mockReset()
    .mockResolvedValue('https://example.com/avatar');
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockReset()
    .mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///original.jpg', width: 800, height: 600 }],
    } as never);
});
test('picker canceled leaves draft unchanged, stale completion after UID change ignored', async () => {
  const { result, unmount } = renderHook(useProfileEditor);
  let finish!: (result: any) => void;
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let picking!: Promise<void>;
  act(() => {
    picking = result.current.pick();
  });
  act(() =>
    mockAuthStore
      .getState()
      .setUser({ uid: 'u2', email: 'b@example.com', displayName: 'Other' }),
  );
  await act(async () => {
    finish({
      canceled: false,
      assets: [{ uri: 'file:///original.jpg', width: 100, height: 100 }],
    });
    await picking;
  });
  expect(result.current.photo).toBeUndefined();
  expect(uploadAvatar).not.toHaveBeenCalled();
  unmount();
});
test('partial name success keeps avatar draft retryable, then cleans generated file only', async () => {
  const { result, unmount } = renderHook(useProfileEditor);
  await act(async () => result.current.pick());
  await act(async () =>
    result.current.applyCrop({
      originX: 100,
      originY: 0,
      width: 600,
      height: 600,
    }),
  );
  act(() => result.current.setName('New name'));
  jest.mocked(uploadAvatar).mockRejectedValueOnce(new Error('Mất mạng'));
  await act(async () => result.current.save());
  expect(result.current.error).toContain('Tên đã được lưu');
  expect(result.current.photo).toBe('file:///cache/generated.jpg');
  await act(async () => result.current.save());
  expect(result.current.saved).toBe(true);
  expect(result.current.photo).toBeUndefined();
  expect(mockDelete).toHaveBeenCalledWith('file:///cache/generated.jpg', {
    idempotent: true,
  });
  expect(mockDelete).not.toHaveBeenCalledWith(
    'file:///original.jpg',
    expect.anything(),
  );
  unmount();
});
test('does not publish name-save success after logout', async () => {
  const { result, unmount } = renderHook(useProfileEditor);
  let finish!: () => void;
  jest.mocked(updateAccountDisplayName).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let saving!: Promise<void>;
  act(() => {
    saving = result.current.save();
  });
  act(() => mockAuthStore.getState().setUser(null));
  await act(async () => {
    finish();
    await saving;
  });
  expect(result.current.saved).toBe(false);
  expect(mockAuthStore.getState().user).toBeNull();
  unmount();
});

test('selecting a library image opens crop preview, cancel leaves the prior draft unchanged', async () => {
  const { result, unmount } = renderHook(useProfileEditor);
  await act(async () => result.current.pick());
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsEditing: false }),
  );
  expect(result.current.photo).toBeUndefined();
  expect(result.current.cropSource).toEqual({
    uri: 'file:///original.jpg',
    width: 800,
    height: 600,
  });
  act(() => result.current.cancelCrop());
  expect(result.current.cropSource).toBeNull();
  expect(result.current.photo).toBeUndefined();
  expect(uploadAvatar).not.toHaveBeenCalled();
  unmount();
});

test('downloads the current avatar to owned cache for recropping and deletes that cache on cancel', async () => {
  const { result, unmount } = renderHook(useProfileEditor);
  await act(async () => result.current.editPhoto());
  const source = result.current.cropSource!;
  expect(source).toEqual({
    uri: expect.stringMatching(/^file:\/\/\/cache\/avatar-edit-.*\.jpg$/),
    width: 384,
    height: 384,
  });
  expect(readAvatar).toHaveBeenCalledWith('u1');
  expect(FileSystem.createDownloadResumable).toHaveBeenCalledWith(
    'https://example.supabase.co/signed-avatar',
    source.uri,
    expect.anything(),
  );
  await act(async () => result.current.cancelCrop());
  expect(mockDelete).toHaveBeenCalledWith(source.uri, { idempotent: true });
  expect(result.current.photo).toBeUndefined();
  expect(uploadAvatar).not.toHaveBeenCalled();
  unmount();
});
test('edits the local draft and keeps it intact when a later crop fails', async () => {
  const { result, unmount } = renderHook(useProfileEditor);
  await act(async () => result.current.pick());
  await act(async () =>
    result.current.applyCrop({
      originX: 40,
      originY: 50,
      width: 300,
      height: 300,
    }),
  );
  expect(mockCrop).toHaveBeenCalledWith({
    originX: 40,
    originY: 50,
    width: 300,
    height: 300,
  });
  await act(async () => result.current.editPhoto());
  expect(result.current.cropSource?.uri).toBe('file:///cache/generated.jpg');
  expect(readAvatar).not.toHaveBeenCalled();
  mockRender.mockRejectedValueOnce(new Error('Không cắt được'));
  await act(async () =>
    result.current.applyCrop({
      originX: 0,
      originY: 0,
      width: 200,
      height: 200,
    }),
  );
  expect(result.current.photo).toBe('file:///cache/generated.jpg');
  expect(result.current.error).toContain('Không cắt được');
  expect(mockDelete).not.toHaveBeenCalledWith(
    'file:///cache/generated.jpg',
    expect.anything(),
  );
  act(() => result.current.cancelCrop());
  expect(result.current.photo).toBe('file:///cache/generated.jpg');
  unmount();
});
test('rejects an out-of-bounds crop before invoking native manipulation', async () => {
  const { result, unmount } = renderHook(useProfileEditor);
  await act(async () => result.current.pick());
  await act(async () =>
    result.current.applyCrop({
      originX: 700,
      originY: 0,
      width: 300,
      height: 300,
    }),
  );
  expect(result.current.error).toContain('không hợp lệ');
  expect(mockCrop).not.toHaveBeenCalled();
  expect(result.current.cropSource).not.toBeNull();
  unmount();
});
test('canceling an in-flight current-avatar download ignores its result and cleans the partial file', async () => {
  let finish!: (value: unknown) => void;
  let began!: () => void;
  const started = new Promise<void>((resolve) => {
    began = resolve;
  });
  const cancelAsync = jest.fn(async () => {
    finish(undefined);
  });
  jest.mocked(FileSystem.createDownloadResumable).mockReturnValue({
    downloadAsync: () =>
      new Promise((resolve) => {
        finish = resolve;
        began();
      }),
    cancelAsync,
  } as never);
  const { result, unmount } = renderHook(useProfileEditor);
  let editing!: Promise<void>;
  act(() => {
    editing = result.current.editPhoto();
  });
  await act(async () => {
    await started;
  });
  await act(async () => {
    result.current.cancelCrop();
    await editing;
  });
  expect(cancelAsync).toHaveBeenCalled();
  expect(result.current.cropSource).toBeNull();
  expect(mockDelete).toHaveBeenCalledWith(
    expect.stringContaining('avatar-edit-'),
    { idempotent: true },
  );
  unmount();
});
test('times out a stalled native download and leaves no crop source or upload', async () => {
  jest.useFakeTimers();
  jest.mocked(FileSystem.createDownloadResumable).mockReturnValue({
    downloadAsync: () => new Promise(() => {}),
    cancelAsync: jest.fn(async () => {}),
  } as never);
  const { result, unmount } = renderHook(useProfileEditor);
  let editing!: Promise<void>;
  await act(async () => {
    editing = result.current.editPhoto();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(20000);
    await editing;
  });
  expect(result.current.error).toContain('quá lâu');
  expect(result.current.busy).toBeNull();
  expect(result.current.cropSource).toBeNull();
  expect(mockDelete).toHaveBeenCalledWith(
    expect.stringContaining('avatar-edit-'),
    { idempotent: true },
  );
  unmount();
  jest.useRealTimers();
});

test('cancel during old-draft cleanup never leaves the preview pointing to a deleted file', async () => {
  const { result, unmount } = renderHook(useProfileEditor);
  await act(async () => result.current.pick());
  await act(async () =>
    result.current.applyCrop({
      originX: 0,
      originY: 0,
      width: 600,
      height: 600,
    }),
  );
  await act(async () => result.current.editPhoto());
  mockRender.mockResolvedValueOnce({
    release: jest.fn(),
    saveAsync: async () => ({ uri: 'file:///cache/replacement.jpg' }),
  });
  let beginDelete!: () => void;
  let finishDelete!: () => void;
  const deleting = new Promise<void>((resolve) => {
    beginDelete = resolve;
  });
  mockDelete.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishDelete = resolve;
        beginDelete();
      }),
  );
  let cropping!: Promise<void>;
  act(() => {
    cropping = result.current.applyCrop({
      originX: 0,
      originY: 0,
      width: 300,
      height: 300,
    });
  });
  await act(async () => {
    await deleting;
  });
  await act(async () => {
    result.current.cancelCrop();
    finishDelete();
    await cropping;
  });
  expect(result.current.photo).toBe('file:///cache/replacement.jpg');
  expect(mockDelete).not.toHaveBeenCalledWith(
    'file:///cache/replacement.jpg',
    expect.anything(),
  );
  unmount();
});
