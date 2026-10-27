import { getAuth } from '@react-native-firebase/auth';
import {
  doc,
  getDocFromServer,
  getDocsFromServer,
  getFirestore,
  setDoc,
} from '@react-native-firebase/firestore';
import { writeToFile } from '@react-native-firebase/storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  downloadPrivatePhoto,
  uploadPrivatePhoto,
} from '../memoryPrivatePhotos';
import { useAuthStore } from '../../../store/authStore';
import {
  commitCloudMemory,
  downloadMemoryPhoto,
  MemoryCloudConflict,
  readCloudMemories,
  uploadMemoryPhoto,
} from '../memoryCloud';
import type { MemoryEntry } from '../../../types/memory';
import { resetFirestoreMock } from '../../../testing/firestoreMock';

jest.mock('../memoryPrivatePhotos', () => ({
  ...jest.requireActual('../memoryPrivatePhotos'),
  downloadPrivatePhoto: jest.fn(),
  uploadPrivatePhoto: jest.fn(),
}));
jest.mock('@react-native-firebase/auth', () => ({ getAuth: jest.fn() }));
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../../testing/firestoreMock'),
);
jest.mock('@react-native-firebase/storage', () => ({
  getStorage: () => 'storage',
  ref: (_storage: unknown, fullPath: string) => ({ fullPath }),
  getMetadata: jest.fn(),
  putFile: jest.fn(),
  writeToFile: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  moveAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));
const entry: MemoryEntry = {
  id: 'one',
  ownerId: 'alice',
  dateKey: '2026-10-15',
  text: 'Private',
  photoFileName: 'one-photo.jpg',
  photoSizeBytes: 100,
  createdAt: 100,
  updatedAt: 100,
  pendingRevision: 'intent-1',
};
const reference = () =>
  doc(getFirestore(), 'memoryAccounts', 'alice', 'items', entry.id);
beforeEach(() => {
  resetFirestoreMock();
  jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined);
  jest.clearAllMocks();
  jest.mocked(downloadPrivatePhoto).mockReset().mockResolvedValue(false);
  jest.mocked(uploadPrivatePhoto).mockReset().mockResolvedValue(100);
  useAuthStore.setState({
    user: { uid: 'alice', email: 'a@example.com', displayName: null },
  });
  jest.mocked(getAuth).mockImplementation(
    () =>
      ({
        currentUser: {
          uid: useAuthStore.getState().user?.uid,
          emailVerified: false,
        },
      }) as never,
  );
  jest
    .mocked(FileSystem.getInfoAsync)
    .mockResolvedValue({ exists: false } as never);
});
it('stops waiting on an unavailable cloud memory list after eight seconds', async () => {
  jest.useFakeTimers();
  try {
    jest
      .mocked(getDocsFromServer)
      .mockReturnValueOnce(new Promise(() => {}) as never);
    const reading = readCloudMemories('alice').then(
      () => 'resolved',
      (cause: Error) => cause.message,
    );

    await jest.advanceTimersByTimeAsync(8000);
    await expect(
      Promise.race([reading, Promise.resolve('still pending')]),
    ).resolves.toBe('Chưa kết nối được cloud. Hãy thử lại.');
  } finally {
    jest.useRealTimers();
  }
});

it('uses server CAS and retries the same intent idempotently for unverified owners', async () => {
  await commitCloudMemory('alice', entry);
  expect((await getDocFromServer(reference())).data()?.revision).toBe(
    'intent-1',
  );
  const writes = jest.mocked(setDoc).mock.calls.length;
  await commitCloudMemory('alice', entry);
  expect(jest.mocked(setDoc).mock.calls.length).toBe(writes);
  await expect(
    commitCloudMemory('alice', {
      ...entry,
      pendingRevision: 'intent-2',
      cloudRevision: 'wrong-base',
    }),
  ).rejects.toBeInstanceOf(MemoryCloudConflict);
  expect((await getDocFromServer(reference())).data()?.revision).toBe(
    'intent-1',
  );
});
it('cannot access another owner path even with a caller-supplied UID', async () => {
  await expect(
    commitCloudMemory('bob', { ...entry, ownerId: 'bob' }),
  ).rejects.toThrow('Phiên');
  await expect(
    uploadMemoryPhoto('bob', entry, 'file:///photo.jpg'),
  ).rejects.toThrow('Phiên');
  expect(uploadPrivatePhoto).not.toHaveBeenCalled();
});
it('writes a minimal tombstone instead of retaining deleted text or photo metadata', async () => {
  await commitCloudMemory('alice', entry);
  await commitCloudMemory('alice', {
    ...entry,
    cloudRevision: 'intent-1',
    pendingRevision: 'delete-1',
    deletedAt: 200,
  });
  expect((await getDocFromServer(reference())).data()).toEqual({
    id: 'one',
    ownerId: 'alice',
    revision: 'delete-1',
    deleted: true,
    updatedAt: 200,
  });
});
it('keeps the old file untouched on incomplete photo downloads', async () => {
  jest.mocked(FileSystem.getInfoAsync).mockImplementation(
    async (uri) =>
      ({
        exists: true,
        isDirectory: false,
        size: uri.endsWith('.partial') ? 10 : 50,
      }) as never,
  );
  jest.mocked(writeToFile).mockReturnValue(
    Object.assign(Promise.resolve(), {
      cancel: jest.fn().mockResolvedValue(true),
    }) as never,
  );
  await expect(
    downloadMemoryPhoto('alice', entry, 'file:///old.jpg'),
  ).rejects.toThrow('chưa đầy đủ');
  expect(FileSystem.moveAsync).not.toHaveBeenCalled();
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
    'file:///old.jpg.partial',
    { idempotent: true },
  );
  expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(
    'file:///old.jpg',
    expect.anything(),
  );
});
it('cancels download on logout and never publishes the partial file', async () => {
  let began!: () => void;
  const started = new Promise<void>((resolve) => {
    began = resolve;
  });
  let finish!: () => void;
  const cancel = jest.fn(async () => {
    finish();
    return true;
  });
  jest.mocked(writeToFile).mockImplementation(() => {
    const task = Object.assign(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
      { cancel },
    );
    began();
    return task as never;
  });
  const download = downloadMemoryPhoto('alice', entry, 'file:///download.jpg');
  await started;
  useAuthStore.setState({ user: null });
  await expect(download).rejects.toThrow('Phiên');
  expect(cancel).toHaveBeenCalled();
  expect(FileSystem.moveAsync).not.toHaveBeenCalled();
});
it('never falls back to Firebase when R2 is unavailable', async () => {
  jest
    .mocked(downloadPrivatePhoto)
    .mockRejectedValueOnce(new Error('R2 offline'));
  await expect(
    downloadMemoryPhoto('alice', entry, 'file:///photo.jpg'),
  ).rejects.toThrow('R2 offline');
  expect(writeToFile).not.toHaveBeenCalled();
});
it('uploads pending originals to R2 without consulting Firebase Storage', async () => {
  jest.mocked(uploadPrivatePhoto).mockResolvedValueOnce(100);
  await expect(
    uploadMemoryPhoto('alice', entry, 'file:///photo.jpg'),
  ).resolves.toBe(100);
  expect(uploadPrivatePhoto).toHaveBeenCalledWith(
    'alice',
    entry,
    'file:///photo.jpg',
  );
});
it('migrates already-cached originals to R2 before reporting sync complete', async () => {
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: true,
    isDirectory: false,
    size: 100,
  } as never);
  await downloadMemoryPhoto('alice', entry, 'file:///cached.jpg');
  expect(uploadPrivatePhoto).toHaveBeenCalledWith(
    'alice',
    entry,
    'file:///cached.jpg',
  );
  expect(writeToFile).not.toHaveBeenCalled();
});
it('restores missing R2 originals from Firebase then backs them up to R2', async () => {
  jest.mocked(downloadPrivatePhoto).mockResolvedValueOnce(false);
  jest.mocked(FileSystem.getInfoAsync).mockImplementation(
    async (uri) =>
      ({
        exists: uri.endsWith('.partial'),
        size: 100,
        isDirectory: false,
      }) as never,
  );
  jest
    .mocked(writeToFile)
    .mockReturnValue(
      Object.assign(Promise.resolve(), { cancel: jest.fn() }) as never,
    );
  await downloadMemoryPhoto('alice', entry, 'file:///restored.jpg');
  expect(writeToFile).toHaveBeenCalled();
  expect(uploadPrivatePhoto).toHaveBeenCalledWith(
    'alice',
    entry,
    'file:///restored.jpg.partial',
  );
  expect(FileSystem.moveAsync).toHaveBeenCalledWith({
    from: 'file:///restored.jpg.partial',
    to: 'file:///restored.jpg',
  });
});

it('opens five already-verified cached originals without repeating R2 requests', async () => {
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: true,
    isDirectory: false,
    size: 100,
  } as never);
  for (let index = 0; index < 5; index++) {
    const cached = {
      ...entry,
      id: `photo-${index}`,
      photoFileName: `photo-${index}.jpg`,
    };
    await downloadMemoryPhoto('alice', cached, `file:///photo-${index}.jpg`, {
      fileName: cached.photoFileName,
      sizeBytes: 100,
    });
  }
  expect(uploadPrivatePhoto).toHaveBeenCalledTimes(0);
  expect(downloadPrivatePhoto).not.toHaveBeenCalled();
});

it('reuses confirmed immutable original backup for a metadata-only change', async () => {
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: true,
    isDirectory: false,
    size: 100,
  } as never);
  const backedUp = {
    ...entry,
    r2Photo: { fileName: entry.photoFileName!, sizeBytes: 100 },
  };
  expect(await uploadMemoryPhoto('alice', backedUp, 'file:///cached.jpg')).toBe(
    100,
  );
  expect(uploadPrivatePhoto).not.toHaveBeenCalled();
});

it.each([
  { fileName: 'different.jpg', sizeBytes: 100 },
  { fileName: entry.photoFileName!, sizeBytes: 99 },
])(
  'verifies an intact original when the local proof does not match: %j',
  async (proof) => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 100,
    } as never);
    await downloadMemoryPhoto('alice', entry, 'file:///cached.jpg', proof);
    expect(uploadPrivatePhoto).toHaveBeenCalledTimes(1);
  },
);
it('restores an absent file despite a previously confirmed backup', async () => {
  jest.mocked(downloadPrivatePhoto).mockResolvedValueOnce(true);
  jest
    .mocked(FileSystem.getInfoAsync)
    .mockImplementation(async (uri) =>
      uri.endsWith('.partial')
        ? ({ exists: true, isDirectory: false, size: 100 } as never)
        : ({ exists: false } as never),
    );
  const proof = await downloadMemoryPhoto(
    'alice',
    entry,
    'file:///cached.jpg',
    { fileName: entry.photoFileName!, sizeBytes: 100 },
  );
  expect(downloadPrivatePhoto).toHaveBeenCalledTimes(1);
  expect(FileSystem.moveAsync).toHaveBeenCalled();
  expect(proof).toEqual({ fileName: entry.photoFileName, sizeBytes: 100 });
});
it('never writes local backup proofs into Firestore metadata', async () => {
  await commitCloudMemory('alice', {
    ...entry,
    r2Photo: { fileName: entry.photoFileName!, sizeBytes: 100 },
  });
  expect((await getDocFromServer(reference())).data()).not.toHaveProperty(
    'r2Photo',
  );
});
