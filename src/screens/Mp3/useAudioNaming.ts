import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { AudioJob, AudioTrack } from '../../types/audio';
import { defaultAudioTitle, normalizeAudioTitle } from '../../utils/audio';
import { removeTemporaryAudio } from '../../services/audio/audioFiles';
import { assertAudioSession } from '../../services/audio/audioSession';
import {
  importAudio,
  type AudioImportAsset,
} from '../../services/audio/audioOperations';
import { renameAudio } from '../../services/audio/audioTitles';

type Draft = { uid: string; title: string } & (
  | { kind: 'import'; asset: AudioImportAsset }
  | { kind: 'rename'; track: AudioTrack }
);
type Options = {
  uid: string | undefined;
  run: (action: (signal: AbortSignal) => Promise<void>) => Promise<void>;
  report: (job: AudioJob) => void;
  onSaved: (track: AudioTrack) => void;
  onMessage: (message: string) => void;
};

export function useAudioNaming({
  uid,
  run,
  report,
  onSaved,
  onMessage,
}: Options) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = useRef<Draft | null>(null);
  useEffect(
    () => () => {
      const pending = current.current;
      current.current = null;
      if (pending?.kind === 'import')
        void removeTemporaryAudio(pending.asset.uri);
    },
    [uid],
  );

  function close() {
    const pending = current.current;
    current.current = null;
    setDraft(null);
    if (pending?.kind === 'import')
      void removeTemporaryAudio(pending.asset.uri);
  }
  function open(value: Draft) {
    close();
    current.current = value;
    setDraft(value);
  }
  const chooseFile = () =>
    run(async (signal) => {
      if (!uid) return;
      report({ label: 'Chọn file audio hoặc video…', progress: null });
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      try {
        assertAudioSession(uid, signal);
        open({
          kind: 'import',
          uid,
          asset,
          title: defaultAudioTitle(asset.name),
        });
      } catch (error) {
        await removeTemporaryAudio(asset.uri);
        throw error;
      }
    });
  const chooseFromAlbum = () =>
    run(async (signal) => {
      if (!uid) return;
      report({ label: 'Chọn video trong album…', progress: null });
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Chưa có quyền truy cập album',
            'Hãy cho phép LifeMate truy cập album để chọn video và tách âm thanh.',
          );
          return;
        }
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        shouldDownloadFromNetwork: true,
        ...(Platform.OS === 'android' ? { defaultTab: 'albums' } : {}),
      });
      if (picked.canceled || !picked.assets[0]) return;
      const selected = picked.assets[0];
      const asset: AudioImportAsset = {
        uri: selected.uri,
        name: selected.fileName || `video-${Date.now()}.mp4`,
      };
      try {
        assertAudioSession(uid, signal);
        open({
          kind: 'import',
          uid,
          asset,
          title: defaultAudioTitle(asset.name),
        });
      } catch (error) {
        await removeTemporaryAudio(asset.uri);
        throw error;
      }
    });
  const rename = (track: AudioTrack) => {
    if (!uid || track.ownerId !== uid) return;
    open({ kind: 'rename', uid, track, title: track.title });
  };
  const save = (value: string) =>
    run(async (signal) => {
      const pending = current.current;
      if (!uid || !pending || pending.uid !== uid) return;
      assertAudioSession(uid, signal);
      const title = normalizeAudioTitle(value);
      if (pending.kind === 'import') {
        // Transfer ownership of the cached picker copy to importAudio's finally block.
        current.current = null;
        setDraft(null);
        const result = await importAudio(
          uid,
          pending.asset,
          signal,
          report,
          onSaved,
          title,
        );
        assertAudioSession(uid, signal);
        onMessage(result.warning ?? 'Đã lưu và sao lưu âm thanh vào thư viện riêng.');
      } else {
        const result = await renameAudio(
          pending.track,
          title,
          signal,
          report,
          (track) => {
            onSaved(track);
            close();
          },
        );
        assertAudioSession(uid, signal);
        onMessage(result.warning ?? 'Đã đổi tên âm thanh.');
      }
    });
  return {
    draft: draft?.uid === uid ? draft : null,
    chooseFile,
    chooseFromAlbum,
    rename,
    save,
    close,
  };
}
