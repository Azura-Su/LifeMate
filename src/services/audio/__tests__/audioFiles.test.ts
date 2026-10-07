import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readAudioIndex,
  updateAudioIndex,
  mergeAudioIndex,
  renameAudioTitle,
} from '../audioFiles';
import type { AudioTrack } from '../../../types/audio';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
}));
const item: AudioTrack = {
  id: 'a',
  ownerId: 'u1',
  title: 'A',
  fileName: 'a.mp3',
  mimeType: 'audio/mpeg',
  durationMs: 2000,
  sizeBytes: 1000,
  createdAt: 100,
  source: 'audio',
  synced: false,
  local: true,
};
beforeEach(async () => {
  await AsyncStorage.clear();
});
it('keeps imported audio across reloads and isolates accounts', async () => {
  await updateAudioIndex(item);
  expect(await readAudioIndex('u1')).toEqual([item]);
  expect(await readAudioIndex('u2')).toEqual([]);
});
it('serializes simultaneous metadata changes without losing a saved track', async () => {
  await Promise.all([
    updateAudioIndex(item),
    updateAudioIndex({ ...item, id: 'b', fileName: 'b.mp3' }),
  ]);
  expect((await readAudioIndex('u1')).map((t) => t.id).sort()).toEqual([
    'a',
    'b',
  ]);
});

it('merges a cloud listing without losing offline audio or the local availability of a synced file', async () => {
  await updateAudioIndex(item);
  await updateAudioIndex({ ...item, id: 'b', fileName: 'b.mp3' });
  const result = await mergeAudioIndex('u1', [
    { ...item, synced: true, local: false },
  ]);
  expect(result.find((t) => t.id === 'a')).toMatchObject({
    synced: true,
    local: true,
  });
  expect(result.find((t) => t.id === 'b')).toMatchObject({
    synced: false,
    local: true,
  });
});

it('persists a renamed title across reloads and keeps it over a stale cloud listing', async () => {
  const cloud = { ...item, synced: true, local: false };
  await updateAudioIndex(cloud);
  await renameAudioTitle('u1', item.id, '  Buổi sáng / bình yên  ');
  const [renamed] = await mergeAudioIndex('u1', [cloud]);
  expect(renamed).toMatchObject({
    title: 'Buổi sáng / bình yên',
    fileName: 'a.mp3',
    synced: true,
    local: false,
    pendingTitle: true,
  });
  expect(await readAudioIndex('u1')).toEqual([renamed]);
  expect(await readAudioIndex('u2')).toEqual([]);
});

it('rejects invalid titles and missing records without losing the original', async () => {
  await updateAudioIndex(item);
  await expect(renameAudioTitle('u1', 'a', '  ')).rejects.toThrow('1 đến 120');
  await expect(renameAudioTitle('u1', 'a', 'a'.repeat(121))).rejects.toThrow(
    '1 đến 120',
  );
  await expect(renameAudioTitle('u2', 'a', 'New')).rejects.toThrow();
  expect(await readAudioIndex('u1')).toEqual([item]);
});
