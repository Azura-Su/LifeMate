import Feather from '@expo/vector-icons/Feather';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { Screen } from '../../components/Screen';
import { AppTextInput as TextInput } from '../../components/AppTextInput';
import { useNotesAccount } from '../../hooks/useNotesAccount';
import { colors, layout, typography } from '../../theme';
import { actionIconStyles } from '../../theme/actionIcons';
import type { LifeNote } from '../../types/note';
import { isCalendarNote } from '../../utils/calendarNotes';
import type { MainTabParams } from '../../navigation/types';
import {
  NOTE_BULLET_MIN_HEIGHT,
  NoteBulletListEditor,
  type NoteBulletItem,
} from './NoteBulletListEditor';

type NotesScreenProps = {
  navigation?: BottomTabScreenProps<MainTabParams, 'Notes'>['navigation'];
  suspended?: boolean;
};

const foldText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi');
const MAX_PREVIEW_ITEMS = 4;
const MAX_NOTE_BODY_CHARS = 20000;

const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const makeBullet = (text = ''): NoteBulletItem => ({
  id: makeId(),
  text,
  height: NOTE_BULLET_MIN_HEIGHT,
});

const stripBulletPrefix = (value: string) =>
  value.replace(/^\s*(?:•\s*|[-*]\s+)/, '').trim();

const getBulletTexts = (body: string) =>
  body.split(/\r?\n/).map(stripBulletPrefix).filter(Boolean);

const formatBulletPreview = (body: string) =>
  getBulletTexts(body).map((text) => ({ text, summary: false }));

const getPreviewItems = (body: string) => {
  const bullets = getBulletTexts(body);
  if (bullets.length <= MAX_PREVIEW_ITEMS) return formatBulletPreview(body);
  return [
    ...bullets.slice(0, MAX_PREVIEW_ITEMS - 1).map((text) => ({
      text,
      summary: false,
    })),
    {
      text: `+ ${bullets.length - MAX_PREVIEW_ITEMS + 1} ý nữa`,
      summary: true,
    },
  ];
};

export function NotesScreen({
  navigation,
  suspended = false,
}: NotesScreenProps = {}) {
  const model = useNotesAccount();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<LifeNote | null>(null);
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [bulletItems, setBulletItems] = useState<NoteBulletItem[]>(() => [
    makeBullet(),
  ]);
  const [saving, setSaving] = useState(false);
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const deleting = useRef(new Set<string>());
  const [error, setError] = useState<string | null>(null);
  const regularNotes = useMemo(
    () => model.notes.filter((note) => !isCalendarNote(note.id)),
    [model.notes],
  );
  // Fold each note once when notes change, not on every search keystroke.
  const searchable = useMemo(
    () =>
      regularNotes.map((note) => ({
        note,
        text: foldText(`${note.title} ${note.body}`),
      })),
    [regularNotes],
  );
  const deferredQuery = useDeferredValue(query);
  const visibleNotes = useMemo(() => {
    const value = foldText(deferredQuery).trim();
    if (!value) return regularNotes;
    return searchable
      .filter((item) => item.text.includes(value))
      .map((item) => item.note);
  }, [deferredQuery, regularNotes, searchable]);

  function open(note?: LifeNote) {
    setEditing(note ?? null);
    setTitle(note?.title ?? '');
    const texts = getBulletTexts(note?.body ?? '');
    setBulletItems((texts.length ? texts : ['']).map(makeBullet));
    setError(null);
    setVisible(true);
  }

  function addBullet() {
    setBulletItems((current) => [...current, makeBullet()]);
    setError(null);
  }

  function changeBullet(id: string, text: string) {
    setBulletItems((current) =>
      current.map((item) => (item.id === id ? { ...item, text } : item)),
    );
    setError(null);
  }

  function resizeBullet(id: string, height: number) {
    setBulletItems((current) =>
      current.map((item) => (item.id === id ? { ...item, height } : item)),
    );
  }

  function removeBullet(id: string) {
    setBulletItems((current) =>
      current.length > 1 ? current.filter((item) => item.id !== id) : current,
    );
    setError(null);
  }

  async function save() {
    if (!model.uid || saving) return;
    if (!title.trim()) {
      setError('Nhập tiêu đề ghi chú.');
      return;
    }
    const noteBody = bulletItems
      .map((item) => item.text.replace(/[\r\n]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
    if (noteBody.length > MAX_NOTE_BODY_CHARS) {
      setError('Nội dung không được vượt quá 20.000 ký tự.');
      return;
    }
    setSaving(true);
    try {
      await model.save(model.uid, {
        id: editing?.id ?? makeId(),
        ownerId: model.uid,
        title: title.trim(),
        body: noteBody,
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
    if (deleting.current.has(note.id)) return;
    Alert.alert('Xóa ghi chú?', `“${note.title}” sẽ bị xóa khỏi tài khoản.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          if (!model.uid || deleting.current.has(note.id)) return;
          deleting.current.add(note.id);
          setDeletingIds((current) => new Set(current).add(note.id));
          void model
            .remove(model.uid, note.id)
            .catch((cause) => {
              Alert.alert(
                'Chưa xóa được ghi chú',
                (cause as Error).message || 'Vui lòng thử lại.',
              );
            })
            .finally(() => {
              deleting.current.delete(note.id);
              setDeletingIds((current) => {
                const next = new Set(current);
                next.delete(note.id);
                return next;
              });
            });
        },
      },
    ]);
  }

  return (
    <>
      <Screen
        fixedHeader={
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay về Home"
              onPress={() => navigation?.navigate('Home')}
              style={styles.headerButton}
            >
              <Feather name="arrow-left" size={21} color={colors.earth} />
            </Pressable>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={styles.headerTitle}
            >
              Ghi chú
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tạo ghi chú"
              onPress={() => open()}
              style={styles.add}
            >
              <Feather name="plus" size={22} color={colors.earth} />
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
        {model.loading && model.notes.length > 0 && (
          <View style={styles.refreshing}>
            <ActivityIndicator size="small" color={colors.earth} />
            <Text style={typography.small}>Đang cập nhật ghi chú…</Text>
          </View>
        )}
        {model.loading && model.notes.length === 0 ? (
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
          visibleNotes.map((note) => {
            const previewItems = getPreviewItems(note.body);
            return (
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
                  {previewItems.length > 0 ? (
                    <View style={styles.previewList}>
                      {previewItems.map((item, index) =>
                        item.summary ? (
                          <Text
                            key={`summary-${index}`}
                            style={styles.previewMore}
                          >
                            {item.text}
                          </Text>
                        ) : (
                          <View
                            key={`bullet-${index}`}
                            style={styles.previewBulletRow}
                          >
                            <Text style={styles.previewMark}>•</Text>
                            <Text numberOfLines={1} style={styles.preview}>
                              {item.text}
                            </Text>
                          </View>
                        ),
                      )}
                    </View>
                  ) : (
                    <Text style={styles.preview}>Chưa có nội dung</Text>
                  )}
                  <Text style={styles.updated}>
                    Sửa {new Date(note.updatedAt).toLocaleDateString('vi-VN')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Xóa ghi chú ${note.title}`}
                  accessibilityState={{
                    disabled: deletingIds.has(note.id),
                    busy: deletingIds.has(note.id),
                  }}
                  disabled={deletingIds.has(note.id)}
                  onPress={() => confirmDelete(note)}
                  style={styles.delete}
                >
                  {deletingIds.has(note.id) ? (
                    <ActivityIndicator size="small" color={colors.earth} />
                  ) : (
                    <Feather name="trash-2" size={17} color={colors.danger} />
                  )}
                </Pressable>
              </View>
            );
          })
        )}
      </Screen>
      <DialogModal
        visible={visible && !suspended}
        onRequestClose={() => !saving && setVisible(false)}
        style={styles.dialog}
      >
        <ScrollView
          style={styles.dialogScroll}
          contentContainerStyle={styles.dialogContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <View style={styles.dialogHeader}>
            <Text accessibilityRole="header" style={styles.dialogTitle}>
              {editing ? 'Sửa ghi chú' : 'Ghi chú mới'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng ghi chú"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={() => setVisible(false)}
              style={[styles.dialogClose, saving && styles.disabledAction]}
            >
              <Feather name="x" size={20} color={colors.earth} />
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Tiêu đề ghi chú"
            placeholder="Tiêu đề"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
            editable={!saving}
            maxLength={120}
            style={styles.input}
          />
          <NoteBulletListEditor
            items={bulletItems}
            disabled={saving}
            onAdd={addBullet}
            onChange={changeBullet}
            onResize={resizeBullet}
            onRemove={removeBullet}
          />
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <Button
            title={editing ? 'Lưu thay đổi' : 'Tạo ghi chú'}
            onPress={() => void save()}
            loading={saving}
          />
        </ScrollView>
      </DialogModal>
    </>
  );
}

const styles = StyleSheet.create({
  fixedHeader: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: 8,
    paddingBottom: 8,
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  headerTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    textAlign: 'center',
  },
  add: {
    ...actionIconStyles.add,
  },
  content: {
    paddingHorizontal: layout.screenGutter,
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
  previewList: { gap: 3 },
  previewBulletRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewMark: {
    width: 10,
    color: colors.earth,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  preview: { ...typography.small, flex: 1, color: colors.ink, lineHeight: 20 },
  previewMore: {
    ...typography.small,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 18,
  },
  updated: { fontSize: 11, color: colors.muted },
  delete: {
    ...actionIconStyles.delete,
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
  refreshing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dialog: { padding: 22, maxHeight: '90%' },
  dialogScroll: { flexShrink: 1 },
  dialogContent: { gap: 14, paddingBottom: 2 },
  dialogHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dialogTitle: { ...typography.heading, color: colors.ink },
  dialogClose: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  disabledAction: { opacity: 0.45 },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
});
