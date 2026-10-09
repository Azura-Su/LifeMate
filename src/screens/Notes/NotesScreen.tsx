import Feather from '@expo/vector-icons/Feather';
import { useDeferredValue, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { Screen } from '../../components/Screen';
import { useNotesAccount } from '../../hooks/useNotesAccount';
import { colors, typography } from '../../theme';
import type { LifeNote } from '../../types/note';

const foldText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi');
// Previews show 4 lines; laying out a 20 000-character body is wasted work.
const PREVIEW_CHARS = 400;

const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export function NotesScreen() {
  const model = useNotesAccount();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<LifeNote | null>(null);
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Fold each note once when notes change, not on every search keystroke.
  const searchable = useMemo(
    () =>
      model.notes.map((note) => ({
        note,
        text: foldText(`${note.title} ${note.body}`),
      })),
    [model.notes],
  );
  const deferredQuery = useDeferredValue(query);
  const visibleNotes = useMemo(() => {
    const value = foldText(deferredQuery).trim();
    if (!value) return model.notes;
    return searchable
      .filter((item) => item.text.includes(value))
      .map((item) => item.note);
  }, [deferredQuery, model.notes, searchable]);

  function open(note?: LifeNote) {
    setEditing(note ?? null);
    setTitle(note?.title ?? '');
    setBody(note?.body ?? '');
    setError(null);
    setVisible(true);
  }

  async function save() {
    if (!model.uid || saving) return;
    if (!title.trim()) {
      setError('Nhập tiêu đề ghi chú.');
      return;
    }
    setSaving(true);
    try {
      await model.save(model.uid, {
        id: editing?.id ?? makeId(),
        ownerId: model.uid,
        title: title.trim(),
        body: body.trim(),
        updatedAt: Date.now(),
      });
      setVisible(false);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được ghi chú.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(note: LifeNote) {
    Alert.alert('Xóa ghi chú?', `“${note.title}” sẽ bị xóa khỏi tài khoản.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () =>
          model.uid &&
          void model
            .remove(model.uid, note.id)
            .catch((cause) => setError((cause as Error).message)),
      },
    ]);
  }

  return (
    <>
      <Screen
        fixedHeader={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={typography.title}>
              Ghi chú
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tạo ghi chú"
              onPress={() => open()}
              style={styles.add}
            >
              <Feather name="plus" size={21} color={colors.earth} />
            </Pressable>
          </View>
        }
        fixedHeaderStyle={styles.fixedHeader}
        contentStyle={styles.content}
      >
        <TextInput
          accessibilityLabel="Tìm ghi chú"
          placeholder="Tìm trong ghi chú"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
        {!model.synced && !model.loading && (
          <Text style={styles.pending}>
            Ghi chú chưa đồng bộ · đang lưu trên thiết bị này.
          </Text>
        )}
        {model.error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {model.error}
          </Text>
        )}
        {model.loading ? (
          <ActivityIndicator color={colors.earth} />
        ) : visibleNotes.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="edit-3" size={28} color={colors.sky} />
            <Text style={styles.emptyTitle}>
              {query ? 'Không tìm thấy ghi chú' : 'Chưa có ghi chú'}
            </Text>
            <Text style={typography.small}>
              {query
                ? 'Thử từ khóa khác.'
                : 'Lưu ý tưởng, thông tin và điều cần nhớ ở đây.'}
            </Text>
          </View>
        ) : (
          visibleNotes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Mở ghi chú ${note.title}`}
                onPress={() => open(note)}
                style={styles.noteBody}
              >
                <Text numberOfLines={1} style={styles.noteTitle}>
                  {note.title}
                </Text>
                <Text numberOfLines={4} style={styles.preview}>
                  {note.body.slice(0, PREVIEW_CHARS) || 'Chưa có nội dung'}
                </Text>
                <Text style={styles.updated}>
                  Sửa {new Date(note.updatedAt).toLocaleDateString('vi-VN')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Xóa ghi chú ${note.title}`}
                onPress={() => confirmDelete(note)}
                style={styles.delete}
              >
                <Feather name="trash-2" size={17} color={colors.muted} />
              </Pressable>
            </View>
          ))
        )}
      </Screen>
      <DialogModal
        visible={visible}
        onRequestClose={() => !saving && setVisible(false)}
        style={styles.dialog}
      >
        <Text accessibilityRole="header" style={styles.dialogTitle}>
          {editing ? 'Sửa ghi chú' : 'Ghi chú mới'}
        </Text>
        <TextInput
          accessibilityLabel="Tiêu đề ghi chú"
          placeholder="Tiêu đề"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          style={styles.input}
        />
        <TextInput
          accessibilityLabel="Nội dung ghi chú"
          placeholder="Viết ghi chú…"
          placeholderTextColor={colors.muted}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={20000}
          textAlignVertical="top"
          style={[styles.input, styles.bodyInput]}
        />
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          title={editing ? 'Lưu thay đổi' : 'Lưu ghi chú'}
          onPress={() => void save()}
          loading={saving}
        />
        <Button
          title="Hủy"
          variant="secondary"
          disabled={saving}
          onPress={() => setVisible(false)}
        />
      </DialogModal>
    </>
  );
}

const styles = StyleSheet.create({
  fixedHeader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  add: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.sunlightSoft,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 12,
  },
  search: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  noteBody: { flex: 1, gap: 5 },
  noteTitle: { ...typography.body, fontWeight: '700', color: colors.ink },
  preview: { ...typography.small, color: colors.ink, lineHeight: 21 },
  updated: { fontSize: 11, color: colors.muted },
  delete: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  emptyTitle: { ...typography.heading, fontSize: 17 },
  error: { ...typography.small, color: colors.danger },
  pending: { ...typography.small, fontSize: 11, color: colors.sunlight },
  dialog: { gap: 14, padding: 22 },
  dialogTitle: { ...typography.heading, color: colors.ink },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  bodyInput: { minHeight: 190, paddingTop: 12 },
});
