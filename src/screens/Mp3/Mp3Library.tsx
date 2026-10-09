import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ModalScreen } from '../../components/ModalScreen';
import { ModalHeader } from '../../components/ModalHeader';
import { Button } from '../../components/Button';
import { colors, typography } from '../../theme';
import { audioCloudApiKey, audioCloudUrl } from '../../config/audioCloud';
import { AudioTrackCard } from './AudioTrackCard';
import { AudioNameDialog } from './AudioNameDialog';
import { AudioPlayer } from './AudioPlayer';
import { AudioEditor } from './AudioEditor';
import { AudioJobStatus } from './AudioJobStatus';
import { PlaylistPicker } from './PlaylistPicker';
import { styles } from './Mp3Screen.styles';
import type { useMp3Screen } from './useMp3Screen';
import type { usePlaylist } from './usePlaylist';

type Props = {
  model: ReturnType<typeof useMp3Screen>;
  playlist: ReturnType<typeof usePlaylist>;
  onClose: () => void;
};

const normalizeSearch = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');

// Library management: import, trim, merge, rename, back up, and pick which
// tracks go to the listening list on the main MP3 tab.
export function Mp3Library({ model, playlist, onClose }: Props) {
  const cloudAvailable = !!audioCloudUrl() && !!audioCloudApiKey();
  const [activeTitleId, setActiveTitleId] = useState<string | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playlistTrackId, setPlaylistTrackId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const query = normalizeSearch(search);
  const visibleTracks = model.tracks.filter((track) =>
    normalizeSearch(track.title).includes(query),
  );
  const handlePlaybackChange = useCallback(
    (trackId: string, playing: boolean) => {
      setPlayingTrackId((current) =>
        playing ? trackId : current === trackId ? null : current,
      );
    },
    [],
  );
  const close = () => {
    if (!model.job) onClose();
  };
  return (
    <ModalScreen
      onRequestClose={close}
      onTouchStart={() => setActiveTitleId(null)}
      fixedHeader={
        <ModalHeader
          eyebrow="QUẢN LÝ ÂM THANH"
          title="Thư viện MP3"
          accessibilityLabel="Quay lại màn hình MP3"
          disabled={!!model.job}
          onBack={close}
        />
      }
      refreshControl={
        <RefreshControl
          refreshing={model.cloudLoading}
          onRefresh={() => void model.refresh()}
          tintColor={colors.earth}
        />
      }
    >
      <View style={styles.importSection}>
        <Text style={styles.importDescription}>
          Tách tiếng từ video, cắt đoạn hay và ghép thành bản riêng.
        </Text>
        <View style={styles.importBox}>
          <View style={styles.row}>
            <View style={styles.importIcon}>
              <Feather name="upload-cloud" size={22} color={colors.earth} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.importTitle}>Thêm âm thanh</Text>
              <Text style={styles.importDetail}>
                Audio giữ nguyên; video chỉ lưu phần tiếng.
              </Text>
            </View>
          </View>
          <Button
            title="Chọn file audio hoặc video"
            onPress={() => void model.addFile()}
            disabled={!!model.job || model.loading}
            compact
          />
          <Button
            title="Chọn video từ album"
            onPress={() => void model.naming.chooseFromAlbum()}
            disabled={!!model.job || model.loading}
            variant="secondary"
            compact
          />
          <Text style={styles.importFootnote}>
            Tệp: audio/video · Album: video · tối đa 500 MB · 60 phút
          </Text>
        </View>
        <View style={styles.backupNotice}>
          <View style={styles.backupIcon}>
            <Feather
              name={cloudAvailable ? 'cloud' : 'hard-drive'}
              size={17}
              color={colors.sky}
            />
          </View>
          <View style={styles.backupText}>
            <Text style={styles.backupTitle}>
              {cloudAvailable ? 'Sao lưu miễn phí' : 'Đang lưu trên máy'}
            </Text>
            <Text style={styles.backupDetail}>
              {cloudAvailable
                ? 'Tối đa 50 MB/file. Bản trên máy vẫn dùng để nghe, cắt và ghép.'
                : 'Sao lưu miễn phí chưa kết nối; nghe, đổi tên, cắt và ghép vẫn dùng được.'}
            </Text>
          </View>
        </View>
      </View>
      {model.job && !model.editor && (
        <AudioJobStatus job={model.job} onCancel={model.cancel} />
      )}
      {model.error && !model.editor && !model.naming.draft && (
        <View style={styles.errorNotice}>
          <View style={styles.errorIcon}>
            <Feather name="alert-circle" size={18} color={colors.danger} />
          </View>
          <View style={styles.errorText}>
            <Text accessibilityRole="alert" style={styles.error}>
              {model.error}
            </Text>
            <Text style={styles.errorDetail}>
              Audio đã lưu trên máy vẫn an toàn trong thư viện.
            </Text>
          </View>
        </View>
      )}
      {model.message && (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {model.message}
        </Text>
      )}
      {model.playback && !model.editor && (
        <AudioPlayer
          key={model.playback.key}
          source={model.playback}
          onClose={model.stop}
          onPlaybackChange={handlePlaybackChange}
        />
      )}
      <View style={styles.row}>
        <Text style={[typography.heading, styles.flex]}>
          {query
            ? `Kết quả · ${visibleTracks.length}/${model.tracks.length}`
            : `Đã lưu · ${model.tracks.length}`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Làm mới thư viện"
          onPress={() => void model.refresh()}
          disabled={model.cloudLoading || !!model.job}
          style={styles.icon}
        >
          <Feather name="refresh-cw" size={20} color={colors.earth} />
        </Pressable>
      </View>
      {model.tracks.length > 0 && (
        <View style={styles.searchBox}>
          <Feather name="search" size={18} color={colors.muted} />
          <TextInput
            accessibilityLabel="Tìm âm thanh"
            placeholder="Tìm tên file…"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xóa tìm kiếm âm thanh"
              onPress={() => setSearch('')}
              style={styles.searchClear}
            >
              <Feather name="x" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      )}
      {model.selected.length > 0 && (
        <View style={styles.selection}>
          <View style={styles.row}>
            <Text style={[typography.small, styles.flex]}>
              Đã chọn {model.selected.length}/10 file · ghép theo thứ tự chọn
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bỏ chọn tất cả file ghép"
              onPress={model.clearSelection}
              disabled={!!model.job}
              style={styles.icon}
            >
              <Feather name="x" size={20} color={colors.earth} />
            </Pressable>
          </View>
          <Button
            title={`Ghép ${model.selected.length} file`}
            compact
            disabled={model.selected.length < 2 || !!model.job}
            onPress={model.mergeSelected}
          />
        </View>
      )}
      {model.loading ? (
        <ActivityIndicator
          accessibilityLabel="Đang mở thư viện"
          color={colors.earth}
        />
      ) : model.tracks.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="headphones" size={44} color={colors.earth} />
          <Text style={typography.heading}>Âm nhạc sẽ ở đây</Text>
          <Text style={styles.description}>
            Thêm file đầu tiên để nghe, cắt hoặc ghép.{'\n'}Thư viện chỉ dành
            cho tài khoản của bạn.
          </Text>
        </View>
      ) : visibleTracks.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="search" size={28} color={colors.earth} />
          <Text style={typography.heading}>Không tìm thấy âm thanh</Text>
          <Text style={styles.description}>
            Thử tên khác hoặc xóa tìm kiếm để xem tất cả file.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visibleTracks.map((track) => (
            <AudioTrackCard
              key={track.id}
              track={track}
              position={model.selected.indexOf(track.id)}
              busy={!!model.job}
              titleActive={activeTitleId === track.id}
              isPlaying={playingTrackId === track.id}
              playlistCount={playlist.membershipCount(track.id)}
              onActivateTitle={() => setActiveTitleId(track.id)}
              onManagePlaylists={() => setPlaylistTrackId(track.id)}
              onSelect={() => model.toggleSelect(track.id)}
              onPlay={() => void model.play(track)}
              onTrim={() => model.openEditor([track])}
              onRename={() => model.rename(track)}
              onDelete={() => {
                void model.deleteTrack(track).then((deleted) => {
                  if (deleted) playlist.removeFromAll(track.id);
                });
              }}
              onSync={() => void model.sync(track)}
            />
          ))}
        </View>
      )}
      <Text style={typography.small}>
        Chọn từ 2 file để ghép nối tiếp. Bản cắt/ghép được lưu thành file mới và
        giữ nguyên bản gốc. Bấm nút danh sách trên từng file để chọn danh sách
        nghe.
      </Text>
      {/* Nested inside this Modal so iOS can present them on top of it. */}
      {model.naming.draft && (
        <AudioNameDialog
          initialTitle={model.naming.draft.title}
          renaming={model.naming.draft.kind === 'rename'}
          busy={!!model.job}
          error={model.error}
          onSave={(title) => void model.naming.save(title)}
          onClose={model.naming.close}
        />
      )}
      {model.editor && (
        <AudioEditor
          initial={model.editor}
          job={model.job}
          error={model.error}
          playback={model.playback}
          onClose={model.closeEditor}
          onCancel={model.cancel}
          onStop={model.stop}
          onSave={(segments, title) => void model.saveEdit(segments, title)}
          onPreview={(segment) =>
            void model.play(segment.track, segment.startMs, segment.endMs)
          }
          onPreviewMerge={(segments) => void model.previewEdit(segments)}
        />
      )}
      {playlistTrackId && (
        <PlaylistPicker
          trackTitle={
            model.tracks.find((track) => track.id === playlistTrackId)?.title ??
            ''
          }
          playlists={playlist.playlists}
          isInPlaylist={(playlistId) =>
            playlist.hasInPlaylist(playlistTrackId, playlistId)
          }
          onToggle={(playlistId) =>
            playlist.toggleInPlaylist(playlistTrackId, playlistId)
          }
          onClose={() => setPlaylistTrackId(null)}
        />
      )}
    </ModalScreen>
  );
}
