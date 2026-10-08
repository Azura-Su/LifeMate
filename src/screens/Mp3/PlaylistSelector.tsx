import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { colors, typography } from '../../theme';
import {
  isPlaylistNameTaken,
  MAX_PLAYLIST_NAME_LENGTH,
  type ListeningPlaylist,
} from './playlistNames';

type Props = {
  playlists: ListeningPlaylist[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => boolean;
  onRename: (id: string, name: string) => boolean;
  onDelete: (id: string) => void;
};

export function PlaylistSelector({
  playlists,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const [dialogMode, setDialogMode] = useState<'create' | 'rename' | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setError(null);
    setDialogMode('create');
  };
  const openRename = (id: string, currentName: string) => {
    setEditingId(id);
    setName(currentName);
    setError(null);
    setDialogMode('rename');
  };
  const closeDialog = () => {
    setDialogMode(null);
    setEditingId(null);
    setError(null);
  };
  const submit = () => {
    const normalized = name.trim();
    if (!normalized) {
      setError('Nhập tên danh sách nghe.');
      return;
    }
    if (isPlaylistNameTaken(playlists, normalized, editingId ?? undefined)) {
      setError('Tên này đã có rồi. Hãy chọn tên khác.');
      return;
    }
    const saved =
      dialogMode === 'rename'
        ? editingId !== null && onRename(editingId, normalized)
        : dialogMode === 'create' && onCreate(normalized);
    if (!saved) {
      setError('Không thể lưu tên danh sách.');
      return;
    }
    closeDialog();
  };
  const confirmDelete = (playlist: ListeningPlaylist) => {
    Alert.alert(
      `Xóa danh sách “${playlist.name}”?`,
      `Tên và danh sách bài nghe “${playlist.name}” sẽ bị xóa. File âm thanh gốc vẫn còn trong Thư viện.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa danh sách',
          style: 'destructive',
          onPress: () => onDelete(playlist.id),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.captionRow}>
          <Text style={styles.caption}>Danh sách của bạn</Text>
          <Text style={styles.count}>{playlists.length}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tạo danh sách nghe mới"
            onPress={openCreate}
            style={styles.addChip}
          >
            <Feather name="plus" size={16} color={colors.earth} />
            <Text style={styles.addText}>Tạo mới</Text>
          </Pressable>
          {playlists.map((playlist) => {
            const selected = playlist.id === selectedId;
            return (
              <View
                key={playlist.id}
                testID={selected ? 'selected-playlist-chip' : undefined}
                style={[styles.chip, selected && styles.selectedChip]}
              >
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={`Chọn danh sách ${playlist.name}`}
                  accessibilityState={{ checked: selected }}
                  onPress={() => onSelect(playlist.id)}
                  style={styles.chipSelect}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.chipText,
                      selected && styles.selectedChipText,
                    ]}
                  >
                    {playlist.name}
                  </Text>
                </Pressable>
                {selected && (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Đổi tên danh sách ${playlist.name}`}
                      onPress={() => openRename(playlist.id, playlist.name)}
                      style={styles.chipEdit}
                      hitSlop={4}
                    >
                      <Feather
                        name="edit-2"
                        size={15}
                        color={colors.onPrimary}
                      />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xóa danh sách ${playlist.name}`}
                      accessibilityHint="Xóa tên và danh sách này; file gốc vẫn ở trong thư viện"
                      onPress={() => confirmDelete(playlist)}
                      style={styles.chipDelete}
                      hitSlop={4}
                    >
                      <Feather name="trash-2" size={15} color={colors.danger} />
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
      <DialogModal visible={dialogMode !== null} onRequestClose={closeDialog}>
        <Text accessibilityRole="header" style={typography.heading}>
          {dialogMode === 'rename'
            ? 'Đổi tên danh sách nghe'
            : 'Tạo danh sách nghe'}
        </Text>
        <Text style={typography.body}>
          {dialogMode === 'rename'
            ? 'Tên mới sẽ hiển thị trong danh sách phát và thư viện.'
            : 'Mỗi danh sách có thứ tự phát riêng. Một file có thể nằm trong nhiều danh sách.'}
        </Text>
        <TextInput
          accessibilityLabel="Tên danh sách nghe"
          placeholder="Ví dụ: Thư giãn"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError(null);
          }}
          maxLength={MAX_PLAYLIST_NAME_LENGTH}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          style={styles.input}
        />
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          title={dialogMode === 'rename' ? 'Lưu tên' : 'Tạo danh sách'}
          onPress={submit}
        />
        <Button title="Hủy" variant="secondary" onPress={closeDialog} />
      </DialogModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  caption: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  count: {
    minWidth: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    textAlign: 'center',
    backgroundColor: colors.sunlightSoft,
    color: colors.earth,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  list: { gap: 8, paddingRight: 4 },
  chip: {
    maxWidth: 264,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  selectedChip: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primary,
  },
  chipSelect: {
    minHeight: 38,
    minWidth: 60,
    maxWidth: 190,
    justifyContent: 'center',
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 20,
  },
  chipEdit: {
    width: 32,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.onAccentDivider,
  },
  chipDelete: {
    width: 34,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.onAccentDivider,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  selectedChipText: { color: colors.onPrimary },
  addChip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.skySoft,
  },
  addText: { color: colors.sky, fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 52,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  error: { color: colors.danger, lineHeight: 22 },
});
