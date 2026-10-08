import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { colors, typography } from '../../theme';
import type { ListeningPlaylist } from './playlistNames';

type Props = {
  trackTitle: string;
  playlists: ListeningPlaylist[];
  isInPlaylist: (playlistId: string) => boolean;
  onToggle: (playlistId: string) => void;
  onClose: () => void;
};

export function PlaylistPicker({
  trackTitle,
  playlists,
  isInPlaylist,
  onToggle,
  onClose,
}: Props) {
  return (
    <DialogModal onRequestClose={onClose} style={styles.dialog}>
      <Text accessibilityRole="header" style={typography.heading}>
        Chọn danh sách
      </Text>
      <Text style={styles.description} numberOfLines={1} ellipsizeMode="tail">
        “{trackTitle}” có thể được thêm vào nhiều danh sách.
      </Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.options}
        keyboardShouldPersistTaps="handled"
      >
        {playlists.length === 0 ? (
          <Text style={styles.empty}>
            Chưa có danh sách nghe. Quay lại tab MP3 và tạo danh sách mới.
          </Text>
        ) : (
          playlists.map((playlist) => {
            const checked = isInPlaylist(playlist.id);
            return (
              <Pressable
                key={playlist.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`${checked ? 'Bỏ khỏi' : 'Thêm vào'} danh sách ${playlist.name}`}
                accessibilityState={{ checked }}
                onPress={() => onToggle(playlist.id)}
                style={styles.option}
              >
                <Text numberOfLines={1} style={styles.optionText}>
                  {playlist.name}
                </Text>
                <Feather
                  name={checked ? 'check-square' : 'square'}
                  size={22}
                  color={checked ? colors.earth : colors.muted}
                />
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <Button title="Xong" onPress={onClose} />
    </DialogModal>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '82%' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  empty: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  scroll: { flexGrow: 0 },
  options: { gap: 8 },
  option: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  optionText: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '600' },
});
