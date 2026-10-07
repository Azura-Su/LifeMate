import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useAuthStore } from '../../store/authStore';
import { useAudioStore } from '../../store/audioStore';
import type { AudioJob, AudioTrack, EditSegment } from '../../types/audio';
import { audioError, MAX_SEGMENTS } from '../../utils/audio';
import {
  audioLocalUri,
  readAudioIndex,
  mergeAudioIndex,
} from '../../services/audio/audioFiles';
import { assertAudioSession } from '../../services/audio/audioSession';
import { editAudio, importAudio } from '../../services/audio/audioOperations';
import {
  downloadAudioTrack,
  fetchCloudTracks,
  uploadAudioTrack,
} from '../../services/firebase/audioLibraryService';

export type Playback = {
  uri: string;
  title: string;
  startMs: number;
  endMs: number;
  key: number;
};
export function useMp3Screen() {
  const uid = useAuthStore((s) => s.user?.uid);
  const allTracks = useAudioStore((s) => s.tracks);
  const storeUid = useAudioStore((s) => s.uid);
  const tracks = storeUid === uid ? allTracks : [];
  const [loading, setLoading] = useState(true);
  const [cloudLoading, setCloudLoading] = useState(false);
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

  const refresh = useCallback(async () => {
    if (!uid) return;
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
    useAudioStore.getState().bind(uid ?? null);
    const controller = new AbortController();
    const load = async () => {
      if (!uid) return;
      try {
        const saved = await readAudioIndex(uid);
        assertAudioSession(uid, controller.signal);
        useAudioStore.getState().replace(uid, saved);
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

  useFocusEffect(useCallback(() => () => setPlayback(null), []));
  const report = (value: AudioJob) => {
    if (alive.current) setJob(value);
  };
  const onSaved = (track: AudioTrack) => {
    if (alive.current && useAuthStore.getState().user?.uid === track.ownerId)
      useAudioStore.getState().upsert(track);
  };

  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (!uid || activeJob.current) return;
    const controller = new AbortController();
    activeJob.current = controller;
    setPlayback(null);
    setError(null);
    setMessage(null);
    setJob({ label: 'Đang chuẩn bị…', progress: null });
    const tag = `lifemate-audio-${uid}`;
    try {
      await activateKeepAwakeAsync(tag).catch(() => undefined);
      assertAudioSession(uid, controller.signal);
      await action(controller.signal);
    } catch (e) {
      if (alive.current) setError(audioError(e));
    } finally {
      await deactivateKeepAwake(tag).catch(() => undefined);
      if (activeJob.current === controller) activeJob.current = null;
      if (alive.current) setJob(null);
    }
  }

  const addFile = () =>
    run(async (signal) => {
      if (!uid) return;
      report({ label: 'Chọn file audio hoặc video…', progress: null });
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const result = await importAudio(
        uid,
        picked.assets[0],
        signal,
        report,
        onSaved,
      );
      if (alive.current)
        setMessage(result.warning ?? 'Đã lưu và đồng bộ âm thanh.');
    });

  const sync = (track: AudioTrack) =>
    run(async (signal) => {
      const saved = await uploadAudioTrack(track, signal, (progress) =>
        report({ label: 'Đang đồng bộ audio…', progress }),
      );
      onSaved(saved);
      if (alive.current) setMessage('Đã đồng bộ audio lên Firebase.');
    });

  const play = (track: AudioTrack, startMs = 0, endMs = track.durationMs) =>
    run(async (signal) => {
      report({ label: 'Đang mở âm thanh…', progress: null });
      const local = await downloadAudioTrack(track, signal, (progress) =>
        report({ label: 'Đang tải audio…', progress }),
      );
      assertAudioSession(track.ownerId, signal);
      onSaved(local);
      if (alive.current)
        setPlayback({
          uri: audioLocalUri(local),
          title: local.title,
          startMs,
          endMs,
          key: ++playbackKey.current,
        });
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
  function openEditor(items: AudioTrack[]) {
    setPlayback(null);
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
      setPlayback(null);
    }
  };

  return {
    tracks,
    loading,
    cloudLoading,
    error,
    message,
    job,
    selected,
    editor,
    playback,
    addFile,
    sync,
    play,
    toggleSelect,
    mergeSelected,
    openEditor,
    saveEdit,
    closeEditor,
    refresh,
    cancel: () => activeJob.current?.abort(),
    stop: () => setPlayback(null),
  };
}
