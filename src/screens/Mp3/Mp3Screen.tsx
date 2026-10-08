import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { colors, typography } from '../../theme';
import type { AudioTrack } from '../../types/audio';
import { useAuthStore } from '../../store/authStore';
import { useMp3Screen } from './useMp3Screen';
import { usePlaylist } from './usePlaylist';
import { useQueuePlayer } from './useQueuePlayer';
import { QueuePlayerBar } from './QueuePlayerBar';
import { AudioJobStatus } from './AudioJobStatus';
import { Mp3Library } from './Mp3Library';
import { QueueTrackControls, QueueTrackList } from './QueueTrackList';
import { PlaylistSelector } from './PlaylistSelector';
import { styles } from './Mp3Screen.styles';

// Main MP3 tab: the listening list. Tracks play one after another; the repeat
// icon on a row keeps replaying just that track. Library management (import,
// trim, merge, rename) lives in a separate full-screen view.
export function Mp3Screen() {
  const model = useMp3Screen();
  const uid = useAuthStore((s) => s.user?.uid);
  const playlist = usePlaylist(uid, model.tracks);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [repeatId, setRepeatId] = useState<string | null>(null);
  const [repeatAll, setRepeatAll] = useState(false);
  const queue = useQueuePlayer({
    items: playlist.items,
    repeatId,
    repeatAll,
    prepare: model.prepare,
  });
  const current = queue.currentId;
  const currentRef = useRef(current);
  const repeatIdRef = useRef(repeatId);
  const queueRef = useRef(queue);
  const playlistRef = useRef(playlist);
  currentRef.current = current;
  repeatIdRef.current = repeatId;
  queueRef.current = queue;
  playlistRef.current = playlist;
  const toggleRepeat = useCallback((track: AudioTrack) => {
    if (repeatIdRef.current === track.id) {
      setRepeatId(null);
      return;
    }
    setRepeatAll(false);
    setRepeatId(track.id);
    if (currentRef.current !== track.id) queueRef.current.start(track);
  }, []);
  const toggleRepeatAll = useCallback(() => {
    setRepeatAll((enabled) => !enabled);
    setRepeatId(null);
  }, []);
  const playAll = useCallback(() => {
    const first = playlistRef.current.items[0];
    if (first) queueRef.current.start(first);
  }, []);
  const selectPlaylist = useCallback((id: string) => {
    if (playlistRef.current.selectedPlaylistId === id) return;
    queueRef.current.stop();
    setRepeatId(null);
    setRepeatAll(false);
    playlistRef.current.selectPlaylist(id);
  }, []);
  const createPlaylist = useCallback((name: string) => {
    const id = playlistRef.current.createPlaylist(name);
    if (!id) return false;
    queueRef.current.stop();
    setRepeatId(null);
    setRepeatAll(false);
    return true;
  }, []);
  const deletePlaylist = useCallback((id: string) => {
    const wasSelected = playlistRef.current.selectedPlaylistId === id;
    if (!playlistRef.current.deletePlaylist(id)) return;
    if (wasSelected) {
      queueRef.current.stop();
      setRepeatId(null);
      setRepeatAll(false);
    }
  }, []);
  const renamePlaylist = useCallback(
    (id: string, name: string) => playlistRef.current.renamePlaylist(id, name),
    [],
  );
  const removeTrack = useCallback((id: string) => {
    if (currentRef.current === id) queueRef.current.stop();
    if (repeatIdRef.current === id) setRepeatId(null);
    playlistRef.current.remove(id);
  }, []);
  const openLibrary = () => {
    queue.pause();
    setLibraryOpen(true);
  };
  const closeLibrary = () => {
    model.clearSelection();
    model.stop();
    setLibraryOpen(false);
  };
  const position = current
    ? playlist.items.findIndex((t) => t.id === current)
    : -1;
  // A track deleted in the library disappears from the list; release the
  // player and lock screen instead of keeping a hidden paused track.
  const queueStop = queue.stop;
  useEffect(() => {
    if (current && playlist.ready && position < 0) queueStop();
  }, [current, playlist.ready, position, queueStop]);

  return (
    <>
      <Screen
        fixedHeaderStyle={styles.mp3FixedHeader}
        fixedHeader={
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[typography.title, styles.mp3HeaderTitle]}
              >
                Danh sách nghe
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mở thư viện để thêm, cắt, ghép âm thanh"
              onPress={openLibrary}
              style={styles.libraryIconButton}
            >
              <Feather name="folder" size={18} color={colors.earth} />
            </Pressable>
          </View>
        }
        fixedContent={
          <>
            {playlist.ready && (
              <PlaylistSelector
                playlists={playlist.playlists}
                selectedId={playlist.selectedPlaylistId}
                onSelect={selectPlaylist}
                onCreate={createPlaylist}
                onRename={renamePlaylist}
                onDelete={deletePlaylist}
              />
            )}
            {model.job && !libraryOpen && (
              <AudioJobStatus job={model.job} onCancel={model.cancel} />
            )}
            {model.error && !libraryOpen && (
              <Text accessibilityRole="alert" style={styles.error}>
                {model.error}
              </Text>
            )}
            {current && position >= 0 && (
              <QueuePlayerBar
                queue={queue}
                title={playlist.items[position].title}
                repeatAll={repeatAll}
                repeatCurrent={repeatId === current}
                onToggleRepeatCurrent={() =>
                  toggleRepeat(playlist.items[position])
                }
                subtitle={
                  repeatId === current
                    ? 'Đang lặp lại bài này'
                    : repeatAll
                      ? 'Đang lặp lại cả danh sách'
                      : `Bài ${position + 1}/${playlist.items.length} · phát cả khi tắt màn hình`
                }
              />
            )}
            {model.loading || !playlist.ready ? (
              <ActivityIndicator
                accessibilityLabel="Đang mở danh sách nghe"
                color={colors.earth}
              />
            ) : playlist.items.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="headphones" size={44} color={colors.earth} />
                <Text style={typography.heading}>
                  {playlist.selectedPlaylist
                    ? 'Chưa có bài để nghe'
                    : 'Chưa có danh sách nghe'}
                </Text>
                <Text style={styles.description}>
                  {playlist.selectedPlaylist
                    ? 'Mở Thư viện để chọn file và đưa vào danh sách này hoặc nhiều danh sách khác.'
                    : 'Danh sách đã được xóa. Nhấn “Tạo mới” ở trên để tạo lại; file âm thanh vẫn còn trong Thư viện.'}
                </Text>
                {playlist.selectedPlaylist && (
                  <Button title="Mở thư viện" onPress={openLibrary} />
                )}
              </View>
            ) : (
              <QueueTrackControls
                itemCount={playlist.items.length}
                repeatAll={repeatAll}
                busy={!!model.job}
                onToggleRepeatAll={toggleRepeatAll}
                onPlayAll={playAll}
              />
            )}
          </>
        }
        fixedContentStyle={styles.fixedMp3Content}
      >
        {!model.loading && playlist.ready && playlist.items.length > 0 && (
          <QueueTrackList
            items={playlist.items}
            busy={!!model.job}
            onPlayTrack={queue.start}
            onRemove={removeTrack}
            onMove={playlist.moveTrack}
          />
        )}
      </Screen>
      {libraryOpen && (
        <Mp3Library model={model} playlist={playlist} onClose={closeLibrary} />
      )}
    </>
  );
}
