import { getAuth, getIdToken } from '@react-native-firebase/auth';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore } from '../../../store/authStore';
import { memoryR2Origin, memoryR2Bucket } from '../../../config/memoryR2';
import {
  downloadPrivatePhoto,
  uploadPrivatePhoto,
} from '../memoryPrivatePhotos';
import type { MemoryEntry } from '../../../types/memory';
import {
  accountTask,
  drainAccountWrites,
} from '../../security/accountLifecycle';

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(),
  getIdToken: jest.fn(),
}));
jest.mock('../../../config/audioCloud', () => ({
  audioCloudUrl: () => 'https://example.supabase.co',
  audioCloudApiKey: () => 'public-key',
}));
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  createUploadTask: jest.fn(),
  createDownloadResumable: jest.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  FileSystemSessionType: { FOREGROUND: 0 },
}));
const entry: MemoryEntry = {
  id: 'one',
  ownerId: 'alice',
  dateKey: '2026-10-17',
  text: '',
  photoFileName: 'original.jpg',
  photoSizeBytes: 100,
  createdAt: 1,
  updatedAt: 1,
};
const fetchMock = jest.fn();
const originalFetch = global.fetch;
const signed = (upload = true, uid = 'alice') =>
  `${memoryR2Origin}/${memoryR2Bucket}/private/${uid}/one/original.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20261017T000000Z&X-Amz-Credential=test&X-Amz-SignedHeaders=${upload ? 'host;content-type;content-length;if-none-match' : 'host'}&X-Amz-Signature=test&X-Amz-Expires=120`;
const reply = (data: unknown, ok = true) => ({ ok, json: async () => data });
beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = fetchMock;
  useAuthStore.setState({
    user: { uid: 'alice', email: 'a@example.com', displayName: null },
  });
  jest
    .mocked(getAuth)
    .mockImplementation(
      () =>
        ({ currentUser: { uid: useAuthStore.getState().user?.uid } }) as never,
    );
  jest.mocked(getIdToken).mockResolvedValue('firebase-token');
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: true,
    size: 100,
    isDirectory: false,
  } as never);
});
afterAll(() => {
  global.fetch = originalFetch;
});
it('uploads originals via conditional R2 PUT and confirms their size', async () => {
  fetchMock
    .mockResolvedValueOnce(reply({ uploadUrl: signed() }))
    .mockResolvedValueOnce(reply({ photo: { sizeBytes: 100 } }));
  const uploadAsync = jest.fn(async () => ({ status: 200 }));
  jest
    .mocked(FileSystem.createUploadTask)
    .mockReturnValue({ uploadAsync, cancelAsync: jest.fn() } as never);
  await expect(
    uploadPrivatePhoto('alice', entry, 'file:///photo.jpg'),
  ).resolves.toBe(100);
  expect(FileSystem.createUploadTask).toHaveBeenCalledWith(
    signed(),
    'file:///photo.jpg',
    expect.objectContaining({
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': '100',
        'If-None-Match': '*',
      },
    }),
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    action: 'private-upload',
    id: 'one',
    fileName: 'original.jpg',
    sizeBytes: 100,
  });
});
it('rechecks concurrent conditional uploads instead of overwriting', async () => {
  fetchMock
    .mockResolvedValueOnce(reply({ uploadUrl: signed() }))
    .mockResolvedValueOnce(reply({ photo: { sizeBytes: 100 } }));
  jest.mocked(FileSystem.createUploadTask).mockReturnValue({
    uploadAsync: async () => ({ status: 412 }),
    cancelAsync: jest.fn(),
  } as never);
  await expect(
    uploadPrivatePhoto('alice', entry, 'file:///photo.jpg'),
  ).resolves.toBe(100);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('refuses URLs for another UID or missing immutable signed headers', async () => {
  for (const url of [
    signed(true, 'bob'),
    signed().replace(';if-none-match', ''),
  ]) {
    fetchMock.mockResolvedValueOnce(reply({ uploadUrl: url }));
    await expect(
      uploadPrivatePhoto('alice', entry, 'file:///photo.jpg'),
    ).rejects.toThrow('không hợp lệ');
  }
  expect(FileSystem.createUploadTask).not.toHaveBeenCalled();
});
it('returns absence only for an explicit missing photo', async () => {
  fetchMock.mockResolvedValueOnce(reply({ photo: null }));
  await expect(
    downloadPrivatePhoto('alice', entry, 'file:///partial'),
  ).resolves.toBe(false);
  fetchMock.mockResolvedValueOnce(reply({ code: 'unavailable' }, false));
  await expect(
    downloadPrivatePhoto('alice', entry, 'file:///partial'),
  ).rejects.toThrow('kho ảnh');
});
it('cancels R2 transfers on logout', async () => {
  fetchMock.mockResolvedValueOnce(
    reply({ photo: { sizeBytes: 100 }, downloadUrl: signed(false) }),
  );
  let began!: () => void;
  const started = new Promise<void>((resolve) => {
    began = resolve;
  });
  const cancelAsync = jest.fn(async () => {});
  jest.mocked(FileSystem.createDownloadResumable).mockReturnValue({
    downloadAsync: () => {
      began();
      return new Promise(() => {});
    },
    cancelAsync,
  } as never);
  const download = downloadPrivatePhoto('alice', entry, 'file:///partial');
  await started;
  useAuthStore.setState({ user: null });
  await expect(download).rejects.toThrow('Phiên');
  expect(cancelAsync).toHaveBeenCalled();
});
it('reports incomplete JSON safely and never uploads or treats it as an absent photo', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('JSON Parse error: Unexpected end of input');
    },
  });
  await expect(
    uploadPrivatePhoto('alice', entry, 'file:///photo.jpg'),
  ).rejects.toThrow('phản hồi chưa đầy đủ');
  expect(FileSystem.createUploadTask).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token');
    },
  });
  await expect(
    downloadPrivatePhoto('alice', entry, 'file:///partial'),
  ).rejects.toThrow('phản hồi chưa đầy đủ');
  expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
});
it('checks HTTP failures before decoding an empty error body', async () => {
  const json = jest.fn(async () => {
    throw new SyntaxError('Unexpected end');
  });
  fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json });
  await expect(
    downloadPrivatePhoto('alice', entry, 'file:///partial'),
  ).rejects.toThrow('HTTP 502');
  expect(json).not.toHaveBeenCalled();
});

it.each(['timeout', 'logout'] as const)(
  'settles stalled JSON on %s even when abort cannot stop decoding',
  async (reason) => {
    jest.useFakeTimers();
    try {
      const json = jest.fn(() => new Promise(() => {}));
      fetchMock.mockResolvedValue({ ok: true, json });
      let error: Error | undefined;
      const operation = uploadPrivatePhoto(
        'alice',
        entry,
        'file:///photo.jpg',
      ).catch((cause) => {
        error = cause;
      });
      await jest.advanceTimersByTimeAsync(0);
      expect(json).toHaveBeenCalled();
      if (reason === 'timeout') await jest.advanceTimersByTimeAsync(20001);
      else {
        useAuthStore.setState({ user: null });
        await jest.advanceTimersByTimeAsync(0);
      }
      expect(error).toBeInstanceOf(Error);
      await operation;
      expect(jest.getTimerCount()).toBe(0);
      expect(FileSystem.createUploadTask).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  },
);

it.each(['timeout', 'logout', 'relogin'] as const)(
  'settles a stalled token on %s and releases account cleanup before it resolves',
  async (reason) => {
    jest.useFakeTimers();
    let release!: (token: string) => void;
    jest.mocked(getIdToken).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    fetchMock.mockResolvedValue(reply({ photo: { sizeBytes: 100 } }));
    const operation = accountTask('alice', () =>
      uploadPrivatePhoto('alice', entry, 'file:///photo.jpg'),
    ).catch((error: Error) => error.message);
    try {
      await jest.advanceTimersByTimeAsync(0);
      if (reason === 'timeout') await jest.advanceTimersByTimeAsync(20001);
      else {
        useAuthStore.getState().setUser(null);
        if (reason === 'relogin')
          useAuthStore
            .getState()
            .setUser({ uid: 'alice', email: null, displayName: null });
        await jest.advanceTimersByTimeAsync(0);
      }
      expect(
        await Promise.race([operation, Promise.resolve('still pending')]),
      ).toMatch(reason === 'timeout' ? /quá lâu/i : /thay đổi/i);
      let drained = false;
      void drainAccountWrites('alice').then(() => {
        drained = true;
      });
      await jest.advanceTimersByTimeAsync(0);
      expect(drained).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      release('late-token');
      await jest.advanceTimersByTimeAsync(0);
      await operation;
      await drainAccountWrites('alice');
      jest.useRealTimers();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  },
);
