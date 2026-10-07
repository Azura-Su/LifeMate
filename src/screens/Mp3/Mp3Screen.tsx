import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { colors, typography } from '../../theme';
import { formatAudioTime } from '../../utils/audio';
import { useMp3Screen } from './useMp3Screen';
import { AudioPlayer } from './AudioPlayer';
import { AudioEditor } from './AudioEditor';
import { AudioJobStatus } from './AudioJobStatus';
import { styles } from './Mp3Screen.styles';

export function Mp3Screen() {
  const model = useMp3Screen();
  return (
    <>
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={model.cloudLoading}
            onRefresh={() => void model.refresh()}
            tintColor={colors.green}
          />
        }
      >
        <View style={styles.header}>
          <Text style={typography.eyebrow}>ÂM THANH CỦA BẠN</Text>
          <Text accessibilityRole="header" style={typography.title}>
            Thư viện MP3
          </Text>
          <Text style={typography.body}>
            Lưu tiếng từ video. Cắt một đoạn hay. Nối thành bản của riêng mình.
          </Text>
        </View>
        <View style={styles.importBox}>
          <View style={styles.row}>
            <View style={styles.importIcon}>
              <Feather name="upload" size={24} color={colors.green} />
            </View>
            <View style={styles.flex}>
              <Text style={typography.heading}>Thêm âm thanh</Text>
              <Text style={typography.small}>
                Audio được giữ nguyên. Video chỉ lưu phần tiếng.
              </Text>
            </View>
          </View>
          <Button
            title="Chọn file audio hoặc video"
            onPress={() => void model.addFile()}
            disabled={!!model.job || model.loading}
          />
          <Text style={typography.small}>
            Chọn từ Tệp · tối đa 500 MB / 60 phút
          </Text>
        </View>
        {model.job && !model.editor && (
          <AudioJobStatus job={model.job} onCancel={model.cancel} />
        )}
        {model.error && !model.editor && (
          <View style={styles.notice}>
            <Text accessibilityRole="alert" style={styles.error}>
              {model.error}
            </Text>
            <Text style={typography.small}>
              Các audio đã lưu trên máy vẫn ở trong thư viện.
            </Text>
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
          />
        )}
        <View style={styles.row}>
          <Text style={[typography.heading, styles.flex]}>
            Đã lưu · {model.tracks.length}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Làm mới thư viện"
            onPress={() => void model.refresh()}
            disabled={model.cloudLoading}
            style={styles.icon}
          >
            <Feather name="refresh-cw" size={20} color={colors.green} />
          </Pressable>
        </View>
        {model.selected.length > 0 && (
          <View style={styles.selection}>
            <Text style={typography.body}>
              Đã chọn {model.selected.length}/10 file theo thứ tự bạn bấm.
            </Text>
            <Button
              title={`Ghép ${model.selected.length} file`}
              disabled={model.selected.length < 2 || !!model.job}
              onPress={model.mergeSelected}
            />
          </View>
        )}
        {model.loading ? (
          <ActivityIndicator
            accessibilityLabel="Đang mở thư viện"
            color={colors.green}
          />
        ) : model.tracks.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="headphones" size={44} color={colors.green} />
            <Text style={typography.heading}>Âm nhạc sẽ ở đây</Text>
            <Text style={styles.description}>
              Thêm file đầu tiên để nghe, cắt hoặc ghép.{'\n'}Thư viện chỉ dành
              cho tài khoản của bạn.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {model.tracks.map((track) => {
              const position = model.selected.indexOf(track.id);
              return (
                <View
                  key={track.id}
                  style={[styles.track, position >= 0 && styles.trackSelected]}
                >
                  <View style={styles.row}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Chọn ${track.title} để ghép`}
                      accessibilityState={{
                        checked: position >= 0,
                        disabled: !!model.job,
                      }}
                      onPress={() => model.toggleSelect(track.id)}
                      disabled={!!model.job}
                      style={styles.icon}
                    >
                      {position >= 0 ? (
                        <Text style={styles.order}>{position + 1}</Text>
                      ) : (
                        <Feather name="square" size={23} color={colors.muted} />
                      )}
                    </Pressable>
                    <View style={styles.flex}>
                      <Text style={styles.trackTitle} numberOfLines={2}>
                        {track.title}
                      </Text>
                      <Text style={typography.small}>
                        {formatAudioTime(track.durationMs)} ·{' '}
                        {track.fileName.split('.').pop()?.toUpperCase()} ·{' '}
                        {(track.sizeBytes / 1048576).toFixed(1)} MB
                      </Text>
                    </View>
                  </View>
                  <View style={styles.row}>
                    <Text style={[styles.sync, styles.flex]}>
                      {track.synced ? '✓ Đã đồng bộ' : '○ Chỉ trên máy'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Nghe ${track.title}`}
                      disabled={!!model.job}
                      onPress={() => void model.play(track)}
                      style={styles.action}
                    >
                      <Feather name="play" size={18} color={colors.green} />
                      <Text style={styles.actionText}>Nghe</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Cắt ${track.title}`}
                      disabled={!!model.job}
                      onPress={() => model.openEditor([track])}
                      style={styles.action}
                    >
                      <Feather name="scissors" size={18} color={colors.green} />
                      <Text style={styles.actionText}>Cắt</Text>
                    </Pressable>
                  </View>
                  {!track.synced && (
                    <Button
                      title="Đồng bộ lại"
                      variant="secondary"
                      disabled={!!model.job}
                      onPress={() => void model.sync(track)}
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}
        <Text style={typography.small}>
          Chọn từ 2 file để ghép nối tiếp. Bản cắt/ghép được lưu thành file mới
          và giữ nguyên bản gốc.
        </Text>
      </Screen>
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
        />
      )}
    </>
  );
}
