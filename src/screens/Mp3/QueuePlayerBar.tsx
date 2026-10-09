import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';
import Slider from '@react-native-community/slider';
import { useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import Feather from '@expo/vector-icons/Feather';
import { colors, typography } from '../../theme';
import { formatAudioTime } from '../../utils/audio';
import { AudioTrackTitle } from './AudioTrackTitle';
import type { useQueuePlayer } from './useQueuePlayer';

type Props = {
  queue: ReturnType<typeof useQueuePlayer>;
  title: string;
  subtitle: string;
  repeatAll: boolean;
  repeatCurrent: boolean;
  onToggleRepeatCurrent: () => void;
  // False while the MP3 screen is hidden or the app is in background: the
  // position stops updating and the title stops scrolling to save battery.
  live?: boolean;
};

type ProgressProps = {
  duration: number;
  currentTime: number;
  isLoaded: boolean;
  onSeek: (seconds: number) => void;
};

function ProgressView({
  duration,
  currentTime,
  isLoaded,
  onSeek,
}: ProgressProps) {
  return (
    <>
      <Slider
        style={styles.slider}
        accessibilityLabel="Vị trí phát âm thanh"
        minimumValue={0}
        maximumValue={Math.max(duration, 0.1)}
        value={Math.min(duration, currentTime)}
        disabled={!isLoaded}
        onSlidingComplete={onSeek}
        minimumTrackTintColor={colors.sky}
        maximumTrackTintColor={colors.line}
        thumbTintColor={colors.sky}
      />
      <View style={styles.row}>
        <Text style={typography.small}>
          {formatAudioTime(currentTime * 1000)}
        </Text>
        <Text style={typography.small}>{formatAudioTime(duration * 1000)}</Text>
      </View>
    </>
  );
}

// The only part that re-renders on every position tick.
function LiveProgress({
  player,
  onSeek,
}: {
  player: AudioPlayer;
  onSeek: (seconds: number) => void;
}) {
  const status = useAudioPlayerStatus(player);
  return (
    <ProgressView
      duration={status.duration || 0}
      currentTime={status.currentTime}
      isLoaded={status.isLoaded}
      onSeek={onSeek}
    />
  );
}

export function QueuePlayerBar({
  queue,
  title,
  subtitle,
  repeatAll,
  repeatCurrent,
  onToggleRepeatCurrent,
  live = true,
}: Props) {
  const [utilitiesOpen, setUtilitiesOpen] = useState(false);
  const [bookmarkName, setBookmarkName] = useState('');
  const { status } = queue;
  const visuallyPlaying = status.playing || queue.isSwitchingTrack;
  const duration = status.duration || 0;
  const hasNext = queue.hasNext();
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={typography.small}>{subtitle}</Text>
          <AudioTrackTitle
            title={title}
            active={visuallyPlaying && live}
            style={styles.titleViewport}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dừng phát"
          onPress={queue.stop}
          style={styles.icon}
        >
          <Feather name="x" size={22} color={colors.ink} />
        </Pressable>
      </View>
      {queue.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {queue.error}
        </Text>
      ) : (
        <>
          {live && queue.player ? (
            <LiveProgress player={queue.player} onSeek={queue.seek} />
          ) : (
            <ProgressView
              duration={duration}
              currentTime={status.currentTime}
              isLoaded={status.isLoaded}
              onSeek={queue.seek}
            />
          )}
          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cài đặt phát"
              accessibilityHint="Mở tốc độ nghe, hẹn giờ tắt và dấu mốc đã lưu"
              onPress={() => setUtilitiesOpen(true)}
              style={styles.settingsButton}
            >
              <Feather name="settings" size={20} color={colors.earth} />
            </Pressable>
            <View
              testID="player-transport-controls"
              style={[
                styles.transportControls,
                repeatAll && styles.transportControlsFullWidth,
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bài trước"
                onPress={queue.previous}
                style={styles.icon}
              >
                <Feather name="skip-back" size={24} color={colors.earth} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={visuallyPlaying ? 'Tạm dừng' : 'Phát'}
                disabled={!status.isLoaded || queue.isSwitchingTrack}
                onPress={queue.toggle}
                style={styles.play}
              >
                <Feather
                  name={visuallyPlaying ? 'pause' : 'play'}
                  size={28}
                  color={colors.earth}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bài tiếp theo"
                disabled={!hasNext}
                onPress={queue.next}
                style={[styles.icon, !hasNext && styles.dim]}
              >
                <Feather name="skip-forward" size={24} color={colors.earth} />
              </Pressable>
            </View>
            {!repeatAll && (
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel={
                  repeatCurrent
                    ? 'Tắt lặp lại bài hiện tại'
                    : 'Lặp lại bài hiện tại'
                }
                accessibilityHint="Phát lại bài đang nghe khi bài kết thúc"
                accessibilityState={{ checked: repeatCurrent }}
                onPress={onToggleRepeatCurrent}
                style={[styles.repeatButton, repeatCurrent && styles.repeatOn]}
              >
                <Feather
                  name="repeat"
                  size={20}
                  color={repeatCurrent ? colors.sunlight : colors.earth}
                />
              </Pressable>
            )}
          </View>
          {utilitiesOpen && (
            <Modal
              visible
              transparent
              animationType="slide"
              statusBarTranslucent
              onRequestClose={() => setUtilitiesOpen(false)}
            >
              <View style={styles.sheetOverlay}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng tiện ích nghe bằng cách chạm bên ngoài"
                  onPress={() => setUtilitiesOpen(false)}
                  style={styles.sheetBackdrop}
                />
                <View
                  accessibilityViewIsModal
                  style={styles.sheet}
                  testID="player-utilities-sheet"
                >
                  <View style={styles.sheetHandle} />
                  <View style={styles.sheetHeader}>
                    <View>
                      <Text
                        accessibilityRole="header"
                        style={styles.sheetTitle}
                      >
                        Tiện ích nghe
                      </Text>
                      <Text style={styles.sheetSubtitle}>
                        Điều chỉnh cho bài đang phát
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Đóng tiện ích nghe"
                      onPress={() => setUtilitiesOpen(false)}
                      style={styles.sheetClose}
                    >
                      <Feather name="x" size={20} color={colors.ink} />
                    </Pressable>
                  </View>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.sheetContent}
                  >
                    <View style={styles.sheetSection}>
                      <Text style={styles.sectionTitle}>Tốc độ nghe</Text>
                      <View style={styles.utilityRow}>
                        {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <Pressable
                            key={rate}
                            accessibilityRole="button"
                            accessibilityLabel={`Tốc độ ${rate} lần`}
                            accessibilityState={{
                              selected: queue.playbackRate === rate,
                            }}
                            onPress={() => queue.setPlaybackRate(rate)}
                            style={[
                              styles.choice,
                              queue.playbackRate === rate &&
                                styles.choiceSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.choiceText,
                                queue.playbackRate === rate &&
                                  styles.choiceTextSelected,
                              ]}
                            >
                              {rate}×
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <View style={styles.sheetSection}>
                      <Text style={styles.sectionTitle}>Tắt sau</Text>
                      <View style={styles.utilityRow}>
                        {[15, 30, 45].map((minutes) => (
                          <Pressable
                            key={minutes}
                            accessibilityRole="button"
                            accessibilityLabel={`Tạm dừng sau ${minutes} phút`}
                            accessibilityState={{
                              selected: queue.sleepMinutes === minutes,
                            }}
                            onPress={() => queue.setSleepTimer(minutes)}
                            style={[
                              styles.choice,
                              queue.sleepMinutes === minutes &&
                                styles.choiceSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.choiceText,
                                queue.sleepMinutes === minutes &&
                                  styles.choiceTextSelected,
                              ]}
                            >
                              {minutes} phút
                            </Text>
                          </Pressable>
                        ))}
                        {queue.sleepMinutes !== null && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Hủy hẹn giờ tắt"
                            onPress={() => queue.setSleepTimer(null)}
                            style={styles.choice}
                          >
                            <Text style={styles.choiceText}>Hủy</Text>
                          </Pressable>
                        )}
                      </View>
                      {queue.sleepMinutes !== null && (
                        <Text style={styles.timerHint}>
                          Hẹn dừng sau {queue.sleepMinutes} phút
                        </Text>
                      )}
                    </View>
                    <View style={styles.sheetSection}>
                      <Text style={styles.sectionTitle}>Dấu mốc</Text>
                      <TextInput
                        accessibilityLabel="Tên dấu mốc"
                        placeholder="Tên dấu mốc (không bắt buộc)"
                        maxLength={60}
                        value={bookmarkName}
                        onChangeText={setBookmarkName}
                        style={styles.bookmarkNameInput}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Đánh dấu vị trí đang nghe"
                        onPress={() => {
                          queue.addBookmark(bookmarkName);
                          setBookmarkName('');
                        }}
                        style={styles.bookmarkButton}
                      >
                        <Feather
                          name="bookmark"
                          size={16}
                          color={colors.earth}
                        />
                        <Text style={styles.choiceText}>
                          Đánh dấu tại{' '}
                          {formatAudioTime(status.currentTime * 1000)}
                        </Text>
                      </Pressable>
                      {queue.bookmarks.length > 0 && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.bookmarks}
                        >
                          {queue.bookmarks.map((bookmark) => (
                            <Pressable
                              key={bookmark.id}
                              accessibilityRole="button"
                              accessibilityLabel={`Tua đến dấu mốc ${bookmark.label}; nhấn giữ để xóa`}
                              onPress={() => queue.seekBookmark(bookmark)}
                              onLongPress={() =>
                                queue.removeBookmark(bookmark.id)
                              }
                              style={styles.choice}
                            >
                              <Text style={styles.choiceText}>
                                {bookmark.label}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.skySoft,
    borderRadius: 20,
    padding: 16,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flex: { flex: 1 },
  titleViewport: {
    height: 36,
    flexShrink: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  transportControls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  transportControlsFullWidth: {
    paddingRight: 0,
  },
  repeatButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  repeatOn: {
    backgroundColor: colors.sunlightSoft,
    borderWidth: 1,
    borderColor: colors.sunlightBorder,
  },
  play: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 28,
  },
  slider: { minHeight: 44 },
  error: { color: colors.danger, lineHeight: 22 },
  dim: { opacity: 0.3 },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
  },
  sheet: {
    maxHeight: '78%',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.background,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  sheetTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  sheetSubtitle: { fontSize: 12, lineHeight: 18, color: colors.muted },
  sheetClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  sheetContent: {
    gap: 20,
    paddingBottom: 8,
  },
  sheetSection: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.skySoft,
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  choice: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  choiceSelected: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  choiceText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  choiceTextSelected: { color: colors.earth },
  bookmarkButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  bookmarkNameInput: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 13,
  },
  bookmarks: { alignItems: 'center', gap: 8 },
  timerHint: { fontSize: 12, color: colors.muted },
});
