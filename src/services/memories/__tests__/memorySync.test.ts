import {
  publishMemory,
  revokeDeletedMemory,
  unshareMemory,
} from '../memorySharing';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as encryptedStorage from '../../security/encryptedLocalStorage';
import { useAuthStore } from '../../../store/authStore';
import type { MemoryEntry } from '../../../types/memory';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../../security/encryptedLocalStorage';
import {
  commitCloudMemory,
  downloadMemoryPhoto,
  readCloudMemories,
  readCloudMemory,
  uploadMemoryPhoto,
} from '../memoryCloud';
import {
  deleteMemory,
  readMemories,
  resolveMemorySyncConflict,
  synchronizeMemories,
  updateMemory,
  shareMemory,
  MemoryShareUnconfirmedError,
} from '../memoryStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn(async () => ({
    exists: true,
    size: 100,
    isDirectory: false,
  })),
  readDirectoryAsync: jest.fn(async () => []),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));
jest.mock('../memoryCloud', () => ({
  assertMemorySession: (uid: string) => {
    if (
      jest.requireActual('../../../store/authStore').useAuthStore.getState()
        .user?.uid !== uid
    )
      throw new Error('Session changed');
  },
  readCloudMemories: jest.fn(),
  readCloudMemory: jest.fn(),
  commitCloudMemory: jest.fn(),
  uploadMemoryPhoto: jest.fn(),
  downloadMemoryPhoto: jest.fn(),
  MemoryCloudConflict: class extends Error {},
}));
jest.mock('../memorySharing', () => ({
  revokeDeletedMemory: jest.fn(async () => undefined),
  unshareMemory: jest.fn(async () => undefined),
  publishMemory: jest.fn(async () => undefined),
  memoryPublishDefinitelyNotStarted: () => false,
}));
const key = 'lifemate:memories:v1:alice';
const base: MemoryEntry = {
  id: 'one',
  ownerId: 'alice',
  dateKey: '2026-10-15',
  text: 'Old memory',
  photoFileName: 'one-old.jpg',
  visibility: 'private',
  createdAt: 100,
  updatedAt: 100,
};
let remote = new Map<string, Record<string, unknown>>();
const cloud = (entry: MemoryEntry, revision = 'server-1') => ({
  id: entry.id,
  ownerId: entry.ownerId,
  dateKey: entry.dateKey,
  text: entry.text,
  photoFileName: entry.photoFileName,
  visibility: entry.visibility,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  photoSizeBytes: 100,
  revision,
  deleted: false,
});
const seed = async (entries: MemoryEntry[]) =>
  setEncryptedItem('alice', key, JSON.stringify(entries));
beforeEach(async () => {
  await AsyncStorage.clear();
  useAuthStore.setState({
    user: { uid: 'alice', email: 'a@example.com', displayName: null },
  });
  jest.mocked(revokeDeletedMemory).mockReset().mockResolvedValue(undefined);
  jest.mocked(FileSystem.readDirectoryAsync).mockReset().mockResolvedValue([]);
  jest.mocked(FileSystem.deleteAsync).mockReset().mockResolvedValue(undefined);
  remote = new Map();
  jest.mocked(publishMemory).mockReset().mockResolvedValue(undefined);
  jest.mocked(unshareMemory).mockReset().mockResolvedValue(undefined);
  jest
    .mocked(readCloudMemories)
    .mockImplementation(async () =>
      [...remote].map(([id, value]) => ({ id, value })),
    );
  jest
    .mocked(readCloudMemory)
    .mockImplementation(async (_uid, id) => remote.get(id) ?? null);
  jest.mocked(uploadMemoryPhoto).mockReset().mockResolvedValue(100);
  jest.mocked(downloadMemoryPhoto).mockReset().mockResolvedValue(undefined);
  jest
    .mocked(commitCloudMemory)
    .mockReset()
    .mockImplementation(async (_uid, entry) => {
      remote.set(
        entry.id,
        entry.deletedAt
          ? {
              id: entry.id,
              ownerId: entry.ownerId,
              revision: entry.pendingRevision!,
              updatedAt: entry.deletedAt,
              deleted: true,
            }
          : cloud(entry, entry.pendingRevision!),
      );
    });
});
it('backs up old cache and restores the same account on a second device', async () => {
  await seed([base]);
  const first = await synchronizeMemories('alice');
  expect(first.synced).toBe(true);
  expect(first.entries[0].cloudRevision).toBeTruthy();
  expect(first.entries[0].pendingRevision).toBeUndefined();
  expect(uploadMemoryPhoto).toHaveBeenCalledTimes(1);
  await AsyncStorage.clear(); // The second device has no local entries.
  const second = await synchronizeMemories('alice');
  expect(second.entries).toMatchObject([{ id: 'one', text: 'Old memory' }]);
  expect(downloadMemoryPhoto).toHaveBeenCalledWith(
    'alice',
    expect.objectContaining({ ownerId: 'alice' }),
    'file:///documents/memories/alice/one-old.jpg',
    undefined,
  );
  expect(await readMemories('alice')).toEqual(second.entries);
});
it('acknowledges the same persisted intent after commit succeeds but response is lost', async () => {
  await seed([base]);
  const commit = jest.mocked(commitCloudMemory).getMockImplementation()!;
  jest.mocked(commitCloudMemory).mockImplementationOnce(async (...args) => {
    await commit(...args);
    throw new Error('Lost response');
  });
  expect((await synchronizeMemories('alice')).synced).toBe(false);
  const pending = JSON.parse((await getEncryptedItem('alice', key))!)[0];
  expect(pending.pendingRevision).toBeTruthy();
  const retried = await synchronizeMemories('alice');
  expect(retried.synced).toBe(true);
  expect(retried.entries[0].cloudRevision).toBe(pending.pendingRevision);
  expect(downloadMemoryPhoto).toHaveBeenCalledWith(
    'alice',
    expect.objectContaining({ id: base.id }),
    expect.any(String),
    expect.objectContaining({ fileName: base.photoFileName, sizeBytes: 100 }),
  );
  expect(commitCloudMemory).toHaveBeenCalledTimes(1);
});
it('propagates delete and stops an old device reimporting a tombstoned memory', async () => {
  await seed([base]);
  await synchronizeMemories('alice');
  await deleteMemory('alice', base.id);
  expect(await readMemories('alice')).toEqual([]);
  expect((await synchronizeMemories('alice')).synced).toBe(true);
  expect(remote.get(base.id)?.deleted).toBe(true);
  await seed([base]); // Old app/device still holds its pre-sync cache.
  expect((await synchronizeMemories('alice')).entries).toEqual([]);
  expect(remote.get(base.id)?.deleted).toBe(true);
});
it('keeps an offline edit against a remote delete until explicit conflict choice', async () => {
  await seed([{ ...base, cloudRevision: 'server-1' }]);
  await updateMemory('alice', base.id, {
    dateKey: base.dateKey,
    text: 'Offline edit',
    photoUri: null,
    photoChange: 'keep',
    visibility: 'private',
  });
  remote.set(base.id, {
    id: base.id,
    ownerId: 'alice',
    revision: 'deleted-2',
    updatedAt: 200,
    deleted: true,
  });
  const result = await synchronizeMemories('alice');
  expect(result.conflict?.remoteDeleted).toBe(true);
  expect(result.entries[0].text).toBe('Offline edit');
  expect(commitCloudMemory).not.toHaveBeenCalled();
  await resolveMemorySyncConflict('alice', result.conflict!, 'local');
  expect((await synchronizeMemories('alice')).synced).toBe(true);
  expect(remote.get(base.id)?.text).toBe('Offline edit');
});
it('rechecks the shown revision when the cloud changes while conflict choice is open', async () => {
  await seed([{ ...base, cloudRevision: 'old', pendingRevision: 'draft-1' }]);
  remote.set(base.id, cloud({ ...base, text: 'Device B' }, 'server-2'));
  const result = await synchronizeMemories('alice');
  remote.set(base.id, cloud({ ...base, text: 'Device C' }, 'server-3'));
  await expect(
    resolveMemorySyncConflict('alice', result.conflict!, 'local'),
  ).rejects.toThrow('vừa thay đổi');
  await expect(
    resolveMemorySyncConflict('alice', result.conflict!, 'cloud'),
  ).rejects.toThrow('vừa thay đổi');
  expect((await readMemories('alice'))[0].pendingRevision).toBe('draft-1');
});
it('retains the last good local entry if the replacement photo cannot download', async () => {
  await seed([{ ...base, cloudRevision: 'server-1' }]);
  remote.set(
    base.id,
    cloud({ ...base, text: 'New cloud', photoFileName: 'new.jpg' }, 'server-2'),
  );
  jest
    .mocked(downloadMemoryPhoto)
    .mockRejectedValueOnce(new Error('Partial download'));
  const result = await synchronizeMemories('alice');
  expect(result.synced).toBe(false);
  expect(result.entries[0].text).toBe('Old memory');
  expect((await readMemories('alice'))[0].photoFileName).toBe('one-old.jpg');
});
it('keeps cache and refuses malformed or foreign-owner cloud rows', async () => {
  await seed([base]);
  remote.set(base.id, cloud({ ...base, ownerId: 'bob' }));
  expect((await synchronizeMemories('alice')).synced).toBe(false);
  expect(await readMemories('alice')).toEqual([base]);
  expect(commitCloudMemory).not.toHaveBeenCalled();
});
it('never publishes a late cloud result into another account cache', async () => {
  jest.mocked(readCloudMemories).mockImplementationOnce(async () => {
    useAuthStore.setState({
      user: { uid: 'bob', email: 'b@example.com', displayName: null },
    });
    return [{ id: base.id, value: cloud(base) }];
  });
  await expect(synchronizeMemories('alice')).rejects.toThrow('Session changed');
  expect(await AsyncStorage.getItem('lifemate:memories:v1:bob')).toBeNull();
  expect(await AsyncStorage.getItem(key)).toBeNull();
});

it('retries revoking a newer share before committing a stale-private deletion conflict', async () => {
  await seed([{ ...base, cloudRevision: 'server-1' }]);
  await deleteMemory('alice', base.id); // Offline device B had an old private hint.
  remote.set(base.id, cloud({ ...base, visibility: 'friends' }, 'server-2'));
  const conflict = (await synchronizeMemories('alice')).conflict!;
  await resolveMemorySyncConflict('alice', conflict, 'local');
  jest
    .mocked(revokeDeletedMemory)
    .mockRejectedValueOnce(new Error('Share service offline'));
  const failed = await synchronizeMemories('alice');
  expect(failed.synced).toBe(false);
  expect(remote.get(base.id)?.deleted).toBe(false);
  expect(commitCloudMemory).not.toHaveBeenCalled();
  expect(
    JSON.parse((await getEncryptedItem('alice', key))!)[0].deletedAt,
  ).toBeTruthy();
  expect((await synchronizeMemories('alice')).synced).toBe(true);
  expect(revokeDeletedMemory).toHaveBeenCalledTimes(2);
  expect(remote.get(base.id)?.deleted).toBe(true);
});

it('rejects a stale open editor and delete confirmation after another device syncs', async () => {
  const opened = { ...base, cloudRevision: 'server-1', photoSizeBytes: 100 };
  await seed([opened]);
  remote.set(
    base.id,
    cloud({ ...base, text: 'Newer from device B' }, 'server-2'),
  );
  await synchronizeMemories('alice');
  jest.mocked(unshareMemory).mockClear();
  await expect(
    updateMemory(
      'alice',
      base.id,
      {
        dateKey: base.dateKey,
        text: 'Stale form',
        photoUri: null,
        photoChange: 'keep',
        visibility: 'private',
      },
      opened,
    ),
  ).rejects.toThrow('vừa thay đổi');
  await expect(deleteMemory('alice', base.id, opened)).rejects.toThrow(
    'vừa thay đổi',
  );
  expect(unshareMemory).not.toHaveBeenCalled();
  expect((await readMemories('alice'))[0].text).toBe('Newer from device B');
  expect(commitCloudMemory).not.toHaveBeenCalled();
});

it('continues uploading offline memories after a replacement photo fails', async () => {
  const offline = {
    ...base,
    id: 'offline',
    createdAt: 0,
    photoFileName: 'offline.jpg',
  };
  await seed([{ ...base, cloudRevision: 'server-1' }, offline]);
  remote.set(base.id, cloud({ ...base, photoFileName: 'new.jpg' }, 'server-2'));
  jest
    .mocked(downloadMemoryPhoto)
    .mockRejectedValueOnce(new Error('Photo unavailable'));
  const result = await synchronizeMemories('alice');
  expect(result.synced).toBe(false);
  expect(result.warning).toContain('Photo unavailable');
  expect(remote.get('offline')?.deleted).toBe(false);
  expect(result.entries.find(({ id }) => id === 'one')?.photoFileName).toBe(
    'one-old.jpg',
  );
  expect((await synchronizeMemories('alice')).synced).toBe(true);
});

it('keeps a failed upload intent and still uploads the following entry', async () => {
  await seed([base, { ...base, id: 'two', createdAt: 0 }]);
  jest.mocked(uploadMemoryPhoto).mockRejectedValueOnce(new Error('Bad photo'));
  expect((await synchronizeMemories('alice')).synced).toBe(false);
  expect(remote.has('one')).toBe(false);
  expect(remote.has('two')).toBe(true);
  const failed = (await readMemories('alice')).find(({ id }) => id === 'one')!;
  expect(failed.pendingRevision).toBeTruthy();
  expect((await synchronizeMemories('alice')).synced).toBe(true);
  expect(remote.get('one')?.revision).toBe(failed.pendingRevision);
});

it('retains a lost-ack pending entry when its photo download fails', async () => {
  const pending = { ...base, cloudRevision: 'old', pendingRevision: 'ack' };
  await seed([pending]);
  remote.set(base.id, cloud({ ...base, photoFileName: 'new.jpg' }, 'ack'));
  jest
    .mocked(downloadMemoryPhoto)
    .mockRejectedValueOnce(new Error('Download failed'));
  expect((await synchronizeMemories('alice')).entries).toEqual([pending]);
  expect(await readMemories('alice')).toEqual([pending]);
});

it.each(['replace', 'delete'] as const)(
  'prunes old originals after durable remote %s',
  async (action) => {
    await seed([{ ...base, cloudRevision: 'server-1' }]);
    remote.set(
      base.id,
      action === 'delete'
        ? {
            id: base.id,
            ownerId: 'alice',
            deleted: true,
            revision: 'server-2',
            updatedAt: 200,
          }
        : cloud({ ...base, photoFileName: 'new.jpg' }, 'server-2'),
    );
    jest
      .mocked(FileSystem.readDirectoryAsync)
      .mockResolvedValue(['one-old.jpg', 'new.jpg', 'notes.txt']);
    jest.mocked(FileSystem.deleteAsync).mockImplementation(async (uri) => {
      const stored = JSON.parse(
        (await getEncryptedItem('alice', key))!,
      ) as MemoryEntry[];
      expect(
        stored.some((entry) => uri.endsWith('/' + entry.photoFileName)),
      ).toBe(false);
    });
    await synchronizeMemories('alice');
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///documents/memories/alice/one-old.jpg',
      { idempotent: true },
    );
    expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('notes.txt'),
      expect.anything(),
    );
    if (action === 'replace')
      expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(
        expect.stringContaining('new.jpg'),
        expect.anything(),
      );
  },
);

it('retains conflict originals until cloud choice and retries unsuccessful cleanup', async () => {
  await seed([{ ...base, cloudRevision: 'old', pendingRevision: 'draft' }]);
  remote.set(base.id, cloud({ ...base, photoFileName: 'new.jpg' }, 'server-2'));
  jest
    .mocked(FileSystem.readDirectoryAsync)
    .mockResolvedValue(['one-old.jpg', 'new.jpg']);
  const result = await synchronizeMemories('alice');
  expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(
    expect.stringContaining('one-old.jpg'),
    expect.anything(),
  );
  await resolveMemorySyncConflict('alice', result.conflict!, 'cloud');
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
    expect.stringContaining('one-old.jpg'),
    { idempotent: true },
  );
  jest
    .mocked(FileSystem.deleteAsync)
    .mockReset()
    .mockRejectedValueOnce(new Error('Disk busy'));
  expect((await synchronizeMemories('alice')).synced).toBe(false);
  expect((await synchronizeMemories('alice')).synced).toBe(true);
});

it('stops orphan cleanup if the signed-in account changes during directory listing', async () => {
  jest
    .mocked(FileSystem.readDirectoryAsync)
    .mockImplementationOnce(async () => {
      useAuthStore.setState({
        user: { uid: 'bob', email: null, displayName: null },
      });
      return ['orphan.jpg'];
    });
  await expect(synchronizeMemories('alice')).rejects.toThrow('Session changed');
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
});

it('restores other cloud entries after one new photo cannot download', async () => {
  remote.set('one', cloud(base));
  remote.set('two', cloud({ ...base, id: 'two', photoFileName: 'two.jpg' }));
  jest
    .mocked(downloadMemoryPhoto)
    .mockRejectedValueOnce(new Error('Missing original'));
  const result = await synchronizeMemories('alice');
  expect(result.synced).toBe(false);
  expect(result.entries.map(({ id }) => id)).toEqual(['two']);
  expect(await readMemories('alice')).toEqual(result.entries);
  expect((await synchronizeMemories('alice')).entries).toHaveLength(2);
});

it('preserves originals referenced by another pending entry during pruning', async () => {
  await seed([
    { ...base, cloudRevision: 'server-1' },
    { ...base, id: 'pending', createdAt: 0, pendingRevision: 'intent' },
  ]);
  remote.set(base.id, {
    id: base.id,
    ownerId: 'alice',
    deleted: true,
    revision: 'deleted',
    updatedAt: 200,
  });
  jest.mocked(uploadMemoryPhoto).mockRejectedValueOnce(new Error('Offline'));
  jest
    .mocked(FileSystem.readDirectoryAsync)
    .mockResolvedValue(['one-old.jpg', 'orphan.png', '../outside.jpg']);
  await synchronizeMemories('alice');
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
    'file:///documents/memories/alice/orphan.png',
    { idempotent: true },
  );
  expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
  expect((await readMemories('alice'))[0].pendingRevision).toBe('intent');
});

it('persists verified original proof after upload for subsequent refreshes', async () => {
  await seed([base]);
  const result = await synchronizeMemories('alice');
  expect(result.entries[0].r2Photo).toEqual({
    fileName: base.photoFileName,
    sizeBytes: 100,
  });
  expect((await readMemories('alice'))[0].r2Photo).toEqual(
    result.entries[0].r2Photo,
  );
});
it('does not trust a backup proof supplied by cloud metadata', async () => {
  remote.set(base.id, {
    ...cloud(base),
    r2Photo: { fileName: base.photoFileName, sizeBytes: 100 },
  });
  await synchronizeMemories('alice');
  expect(jest.mocked(downloadMemoryPhoto).mock.calls[0][3]).toBeUndefined();
  expect((await readMemories('alice'))[0].r2Photo).toBeUndefined();
});
it('keeps open editors valid when only local backup bookkeeping changes', async () => {
  const opened = { ...base, cloudRevision: 'server-1', photoSizeBytes: 100 };
  await seed([opened]);
  remote.set(base.id, cloud(base));
  jest
    .mocked(downloadMemoryPhoto)
    .mockResolvedValueOnce({ fileName: base.photoFileName!, sizeBytes: 100 });
  await synchronizeMemories('alice');
  await expect(
    updateMemory(
      'alice',
      base.id,
      {
        dateKey: base.dateKey,
        text: 'Edited',
        photoUri: null,
        photoChange: 'keep',
        visibility: 'private',
      },
      opened,
    ),
  ).resolves.toMatchObject({ text: 'Edited' });
});
it('allows the same conflict choice after proof-only cache bookkeeping', async () => {
  const pending = {
    ...base,
    cloudRevision: 'old',
    pendingRevision: 'draft',
    photoSizeBytes: 100,
  };
  await seed([pending]);
  remote.set(base.id, cloud({ ...base, text: 'Cloud change' }, 'server-2'));
  const conflict = (await synchronizeMemories('alice')).conflict!;
  await seed([
    { ...pending, r2Photo: { fileName: base.photoFileName!, sizeBytes: 100 } },
  ]);
  await expect(
    resolveMemorySyncConflict('alice', conflict, 'local'),
  ).resolves.toBeUndefined();
});
it('clears original backup proof when the user replaces the photo', async () => {
  await seed([
    {
      ...base,
      photoSizeBytes: 100,
      r2Photo: { fileName: base.photoFileName!, sizeBytes: 100 },
    },
  ]);
  const edited = await updateMemory('alice', base.id, {
    dateKey: base.dateKey,
    text: 'New photo',
    photoUri: 'file:///new.jpg',
    photoChange: 'replace',
    photoMimeType: 'image/jpeg',
    visibility: 'private',
  });
  expect(edited.photoFileName).not.toBe(base.photoFileName);
  expect(edited.r2Photo).toBeUndefined();
  expect((await readMemories('alice'))[0].r2Photo).toBeUndefined();
});

it('edits valid legacy photoless entries while keeping their photo absent', async () => {
  const old = { ...base, photoFileName: null, photoSizeBytes: 0 };
  await seed([old]);
  await expect(
    updateMemory(
      'alice',
      old.id,
      {
        dateKey: old.dateKey,
        text: 'New caption',
        photoUri: null,
        photoChange: 'keep',
        visibility: 'private',
      },
      old,
    ),
  ).resolves.toMatchObject({ text: 'New caption', photoFileName: null });
  expect((await readMemories('alice'))[0]).toMatchObject({
    text: 'New caption',
    photoFileName: null,
  });
});
it('rejects an empty text-only legacy memory without changing the cached entry', async () => {
  const old = { ...base, photoFileName: null, photoSizeBytes: 0 };
  await seed([old]);
  jest.mocked(unshareMemory).mockClear();
  await expect(
    updateMemory(
      'alice',
      old.id,
      {
        dateKey: old.dateKey,
        text: '   ',
        photoUri: null,
        photoChange: 'keep',
        visibility: 'private',
      },
      old,
    ),
  ).rejects.toThrow();
  expect(unshareMemory).not.toHaveBeenCalled();
  expect(await readMemories('alice')).toEqual([old]);
});

it('allows an open editor to save after sync only acknowledges its pending content', async () => {
  const opened = { ...base, cloudRevision: 'old', pendingRevision: 'ack' };
  await seed([opened]);
  remote.set(base.id, cloud(base, 'ack'));
  await synchronizeMemories('alice');
  await expect(
    updateMemory(
      'alice',
      base.id,
      {
        dateKey: base.dateKey,
        text: 'Edited caption',
        photoUri: null,
        photoChange: 'keep',
        visibility: 'private',
      },
      opened,
    ),
  ).resolves.toMatchObject({ text: 'Edited caption' });
});

it('rejects sharing a stale card after an in-flight sync replaces its content', async () => {
  const opened = { ...base, cloudRevision: 'rev1' };
  await seed([opened]);
  remote.set(
    base.id,
    cloud({ ...base, text: 'New safe text', updatedAt: 200 }, 'rev2'),
  );
  let release!: () => void;
  let started!: () => void;
  const downloading = new Promise<void>((resolve) => {
    started = resolve;
  });
  jest.mocked(downloadMemoryPhoto).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = () => resolve(undefined);
        started();
      }),
  );
  const syncing = synchronizeMemories('alice');
  await downloading;
  const sharing = shareMemory('alice', 'Asher', opened);
  const rejected = expect(sharing).rejects.toThrow('vừa thay đổi');
  release();
  await syncing;
  await rejected;
  expect(publishMemory).not.toHaveBeenCalled();
  expect((await readMemories('alice'))[0]).toMatchObject({
    text: 'New safe text',
    visibility: 'private',
  });
});

it('holds the queue until publication and visibility persistence finish', async () => {
  await seed([base]);
  let release!: () => void;
  let started!: () => void;
  const publishing = new Promise<void>((resolve) => {
    started = resolve;
  });
  jest.mocked(publishMemory).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
        started();
      }),
  );
  const sharing = shareMemory('alice', 'Asher', base);
  await publishing;
  const syncing = synchronizeMemories('alice');
  expect(readCloudMemories).not.toHaveBeenCalled();
  release();
  await sharing;
  await syncing;
  expect(publishMemory).toHaveBeenCalledWith(
    'alice',
    'Asher',
    expect.objectContaining({ text: base.text }),
  );
  expect((await readMemories('alice'))[0].visibility).toBe('friends');
});

it('revokes an ambiguous publication before releasing the queue', async () => {
  await seed([base]);
  jest
    .mocked(publishMemory)
    .mockRejectedValueOnce(new Error('Upload interrupted'));
  await expect(shareMemory('alice', 'Asher', base)).rejects.toThrow(
    'Upload interrupted',
  );
  expect(unshareMemory).toHaveBeenCalledWith('alice', 'Asher', base.id);
  expect((await readMemories('alice'))[0].visibility).toBe('private');
});

it('carries the persisted conservative entry when publication and rollback are unconfirmed', async () => {
  await seed([base]);
  jest
    .mocked(publishMemory)
    .mockRejectedValueOnce(new Error('Upload interrupted'));
  jest.mocked(unshareMemory).mockRejectedValueOnce(new Error('Offline'));
  const error = await shareMemory('alice', 'Asher', base).catch(
    (cause) => cause,
  );
  expect(error).toBeInstanceOf(MemoryShareUnconfirmedError);
  expect(error.entry).toEqual((await readMemories('alice'))[0]);
  expect(error.entry.visibility).toBe('friends');
});

it('rolls back a confirmed publication if local visibility cannot be persisted', async () => {
  await seed([base]);
  const write = jest
    .spyOn(encryptedStorage, 'setEncryptedItem')
    .mockRejectedValueOnce(new Error('Disk full'));
  try {
    await expect(shareMemory('alice', 'Asher', base)).rejects.toThrow(
      'Disk full',
    );
    expect(publishMemory).toHaveBeenCalledTimes(1);
    expect(unshareMemory).toHaveBeenCalledWith('alice', 'Asher', base.id);
    expect((await readMemories('alice'))[0].visibility).toBe('private');
  } finally {
    write.mockRestore();
  }
});

it('retains explicit uncertainty when both cache writes and server rollback fail', async () => {
  await seed([base]);
  const write = jest
    .spyOn(encryptedStorage, 'setEncryptedItem')
    .mockRejectedValueOnce(new Error('Disk full'))
    .mockRejectedValueOnce(new Error('Disk still full'));
  jest.mocked(unshareMemory).mockRejectedValueOnce(new Error('Offline'));
  try {
    const error = await shareMemory('alice', 'Asher', base).catch(
      (cause) => cause,
    );
    expect(error).toBeInstanceOf(MemoryShareUnconfirmedError);
    expect(error.message).toContain('Chưa xác nhận');
    expect(error.entry).toEqual(base);
    expect(await readMemories('alice')).toEqual([base]);
  } finally {
    write.mockRestore();
  }
});

it('allows acknowledged content to be shared without resurrecting stale sync bookkeeping', async () => {
  const opened = { ...base, cloudRevision: 'old', pendingRevision: 'ack' };
  await seed([opened]);
  remote.set(base.id, cloud(base, 'ack'));
  await synchronizeMemories('alice');
  await shareMemory('alice', 'Asher', opened);
  expect(publishMemory).toHaveBeenCalledWith(
    'alice',
    'Asher',
    expect.objectContaining({ cloudRevision: 'ack' }),
  );
  expect((await readMemories('alice'))[0]).toMatchObject({
    visibility: 'friends',
    cloudRevision: 'ack',
  });
});
it('does not rewrite the encrypted cache when ten synced memories are unchanged', async () => {
  await seed(
    Array.from({ length: 10 }, (_, i) => ({
      ...base,
      id: `m${i}`,
      photoFileName: `m${i}-old.jpg`,
      createdAt: 100 + i,
    })),
  );
  // Like the real client: an intact local original returns its backup proof.
  jest
    .mocked(downloadMemoryPhoto)
    .mockImplementation(async (_uid, entry) => ({
      fileName: entry.photoFileName!,
      sizeBytes: entry.photoSizeBytes!,
    }));
  expect((await synchronizeMemories('alice')).synced).toBe(true);
  const write = jest.spyOn(encryptedStorage, 'setEncryptedItem');
  try {
    const again = await synchronizeMemories('alice');
    expect(again.synced).toBe(true);
    expect(again.entries).toHaveLength(10);
    expect(write).not.toHaveBeenCalled();
  } finally {
    write.mockRestore();
  }
});
