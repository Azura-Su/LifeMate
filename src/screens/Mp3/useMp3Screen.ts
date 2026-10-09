import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useAuthStore } from '../../store/authStore';
import { useAudioStore } from '../../store/audioStore';
import type { AudioJob, AudioTrack, EditSegment } from '../../types/audio';
import { audioError, MAX_SEGMENTS } from '../../utils/audio';
import {
  audioLocalUri,
  deleteLocalAudioTrack,
  readAudioIndex,
  mergeAudioIndex,
  removeTemporaryAudio,
} from '../../services/audio/audioFiles';
import { assertAudioSession } from '../../services/audio/audioSession';
import { editAudio, previewAudio } from '../../services/audio/audioOperations';
import { useAudioNaming } from './useAudioNaming';
import { audioCloudUrl } from '../../config/audioCloud';
import {
  downloadAudioTrack,
  deleteAudioTrackRemote,
  fetchCloudTracks,
  uploadAudioTrack,
} from '../../services/firebase/audioLibraryService';

export type Playback = {
  uri: string;
  title: string;
  startMs: number;
  endMs: number;
  key: number;
  trackId: string;
};

const MESSAGE_DURATION_MS = 3000;

export function useMp3Screen() {
  const uid = useAuthStore((s) => s.user?.uid);
  const allTracks = useAudioStore((s) => s.tracks);
  const storeUid = useAudioStore((s) => s.uid);
  const tracks = storeUid === uid ? allTracks : [];
  const [loading, setLoading] = useState(true);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [localTracksUid, setLocalTracksUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [job, setJob] = useState<AudioJob | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editor, setEditor] = useState<EditSegment[] | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const activeJob = useRef<AbortController | null>(null);
  const refreshController = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const playbackKey = useRef(0);
  const temporaryPreviewUri = useRef<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(null), MESSAGE_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [message]);

  const clearPlayback = useCallback(() => {
    const uri = temporaryPreviewUri.current;
    temporaryPreviewUri.current = null;
    setPlayback(null);
    if (uri) void removeTemporaryAudio(uri);
  }, []);

  const refresh = useCallback(async () => {
    if (!uid || activeJob.current) return;
    if (
      !audioCloudUrl() &&
      !useAudioStore.getState().tracks.some((track) => track.synced)
    ) {
      setError(null);
      return;
    }
    refreshController.current?.abort();
    const controller = new AbortController();
    refreshController.current = controller;
    setCloudLoading(true);
    try {
      const remote = await fetchCloudTracks(uid, controller.signal);
      assertAudioSession(uid, controller.signal);
      const merged = await mergeAudioIndex(uid, remote);
      assertAudioSession(uid, controller.signal);
      useAudioStore.getState().replace(uid, merged);
      if (alive.current) setError(null);
    } catch (e) {
      if (!controller.signal.aborted && alive.current) setError(audioError(e));
    } finally {
      if (!controller.signal.aborted && alive.current) setCloudLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    alive.current = true;
    setLocalTracksUid(null);
    setLoading(true);
    useAudioStore.getState().bind(uid ?? null);
    const controller = new AbortController();
    const load = async () => {
      if (!uid) return;
      try {
        const saved = await readAudioIndex(uid);
        assertAudioSession(uid, controller.signal);
        useAudioStore.getState().replace(uid, saved);
        setLocalTracksUid(uid);
        setLoading(false);
        void refresh();
      } catch (e) {
        if (!controller.signal.aborted) {
          setLoading(false);
          setError(audioError(e));
        }
      }
    };
    void load();
    return () => {
      alive.current = false;
      controller.abort();
      activeJob.current?.abort();
      refreshController.current?.abort();
      if (useAudioStore.getState().uid === uid)
        useAudioStore.getState().bind(null);
    };
  }, [uid, refresh]);

  useFocusEffect(useCallback(() => () => clearPlayback(), [clearPlayback]));
  const report = (value: AudioJob) => {
    if (alive.current) setJob(value);
  };
  const onSaved = (track: AudioTrack) => {
    if (alive.current && useAuthStore.getState().user?.uid === track.ownerId)
      useAudioStore.getState().upsert(track);
  };

  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (!uid || activeJob.current) return false;
    const controller = new AbortController();
    activeJob.current = controller;
    // A response started before a rename must not overwrite its new title.
    refreshController.current?.abort();
    setCloudLoading(false);
    clearPlayback();
    setError(null);
    setMessage(null);
    setJob({ label: 'Đang chuẩn bị…', progress: null });
    const tag = `lifemate-audio-${uid}`;
    try {
      await activateKeepAwakeAsync(tag).catch(() => undefined);
      assertAudioSession(uid, controller.signal);
      await action(controller.signal);
      return true;
    } catch (e) {
      if (alive.current) setError(audioError(e));
      return false;
    } finally {
      await deactivateKeepAwake(tag).catch(() => undefined);
      if (activeJob.current === controller) activeJob.current = null;
      if (alive.current) setJob(null);
    }
  }

  const naming = useAudioNaming({
    uid,
    run: async (action) => {
      await run(action);
    },
    report,
    onSaved,
    onMessage: setMessage,
  });

  const sync = (track: AudioTrack) =>
    run(async (signal) => {
      report({
        label: track.synced
          ? 'Đang đồng bộ tên…'
          : 'Đang sao lưu audio lên kho miễn phí…',
        progress: null,
      });
      const saved = await uploadAudioTrack(track, signal, (progress) =>
        report({ label: 'Đang sao lưu audio lên kho miễn phí…', progress }),
      );
      onSaved(saved);
      if (alive.current)
        setMessage('Đã sao lưu âm thanh vào thư viện riêng trên đám mây.');
    });

  const deleteTrack = (track: AudioTrack) =>
    run(async (signal) => {
      if (track.synced) {
        report({ label: 'Đang xóa bản sao lưu…', progress: null });
        await deleteAudioTrackRemote(track, signal);
      }
      assertAudioSession(track.ownerId, signal);
      await deleteLocalAudioTrack(track);
      assertAudioSession(track.ownerId, signal);
      useAudioStore.getState().remove(track.ownerId, track.id);
      setSelected((current) => current.filter((id) => id !== track.id));
      if (alive.current) setMessage('Đã xóa file thành công.');
    });

  // Returns the on-device copy, downloading a cloud-only backup first.
  const openLocal = async (track: AudioTrack, signal: AbortSignal) => {
    report({ label: 'Đang mở âm thanh…', progress: null });
    const local = await downloadAudioTrack(track, signal, (progress) =>
      report({ label: 'Đang tải audio…', progress }),
    );
    assertAudioSession(track.ownerId, signal);
    onSaved(local);
    return local;
  };

  const play = (track: AudioTrack, startMs = 0, endMs = track.durationMs) =>
    run(async (signal) => {
      const local = await openLocal(track, signal);
      if (alive.current)
        setPlayback({
          uri: audioLocalUri(local),
          title: local.title,
          startMs,
          endMs,
          key: ++playbackKey.current,
          trackId: local.id,
        });
    });

  // Used by the listening queue, which owns its own long-lived player.
  const prepare = async (track: AudioTrack) => {
    if (activeJob.current)
      throw new Error('Đang xử lý file khác. Hãy đợi xong rồi thử lại.');
    let uri: string | null = null;
    const completed = await run(async (signal) => {
      uri = audioLocalUri(await openLocal(track, signal));
    });
    if (!completed || !uri)
      throw new Error('Chưa chuẩn bị được bài nghe. Hãy thử lại.');
    return uri;
  };

  const previewEdit = (segments: EditSegment[]) =>
    run(async (signal) => {
      if (!uid) return;
      const preview = await previewAudio(segments, signal, report, onSaved);
      try {
        assertAudioSession(uid, signal);
        if (!alive.current) {
          await removeTemporaryAudio(preview.uri);
          return;
        }
        temporaryPreviewUri.current = preview.uri;
        setPlayback({
          uri: preview.uri,
          title: 'Nghe thử bản ghép',
          startMs: 0,
          endMs: preview.durationMs,
          key: ++playbackKey.current,
          trackId: 'merge-preview',
        });
      } catch (error) {
        await removeTemporaryAudio(preview.uri);
        throw error;
      }
    });

  function toggleSelect(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length < MAX_SEGMENTS
          ? [...current, id]
          : current,
    );
  }
  function clearSelection() {
    setSelected([]);
  }
  function openEditor(items: AudioTrack[]) {
    clearPlayback();
    setError(null);
    setMessage(null);
    setEditor(
      items.map((track) => ({ track, startMs: 0, endMs: track.durationMs })),
    );
  }
  const mergeSelected = () =>
    openEditor(
      selected.flatMap((id) => {
        const track = tracks.find((t) => t.id === id);
        return track ? [track] : [];
      }),
    );
  const saveEdit = (segments: EditSegment[], title: string) =>
    run(async (signal) => {
      if (!uid) return;
      const result = await editAudio(
        uid,
        segments,
        title,
        signal,
        report,
        onSaved,
      );
      if (alive.current) {
        setEditor(null);
        setSelected([]);
        setMessage(
          result.warning ??
            'Đã lưu bản audio mới. Các file gốc được giữ nguyên.',
        );
      }
    });
  const closeEditor = () => {
    if (!activeJob.current) {
      setEditor(null);
      clearSelection();
      clearPlayback();
    }
  };

  return {
    tracks,
    libraryTrackIds:
      localTracksUid === uid && storeUid === uid
        ? tracks.map((track) => track.id)
        : null,
    loading,
    cloudLoading,
    error,
    message,
    job,
    selected,
    editor,
    playback,
    naming,
    addFile: naming.chooseFile,
    rename: (track: AudioTrack) => {
      if (activeJob.current) return;
      setError(null);
      clearPlayback();
      naming.rename(track);
    },
    sync,
    deleteTrack,
    play,
    prepare,
    toggleSelect,
    clearSelection,
    mergeSelected,
    openEditor,
    saveEdit,
    previewEdit,
    closeEditor,
    refresh,
    cancel: () => activeJob.current?.abort(),
    stop: clearPlayback,
  };
}
