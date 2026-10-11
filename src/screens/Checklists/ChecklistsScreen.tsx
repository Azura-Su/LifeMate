import Feather from '@expo/vector-icons/Feather';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { randomUUID } from 'expo-crypto';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput as NativeTextInput,
  View,
} from 'react-native';
import { DialogCloseButton } from '../../components/DialogCloseButton';
import { DialogModal } from '../../components/DialogModal';
import { AppTextInput as TextInput } from '../../components/AppTextInput';
import { Screen } from '../../components/Screen';
import type { MainTabParams } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import {
  createPrepChecklist,
  deletePrepChecklist,
  duplicatePrepChecklist,
  readPrepChecklists,
  setPrepChecklistDate,
  updatePrepChecklist,
} from '../../services/checklists/checklistStorage';
import type {
  PrepChecklist,
  PrepChecklistItem,
} from '../../types/prepChecklist';
import { colors } from '../../theme';
import { parseDateKey, toDateKey } from '../../utils/vietnameseCalendar';
import {
  MAX_CHECKLIST_ITEMS,
  validatePrepChecklistItem,
  validatePrepChecklistTitle,
} from '../../utils/prepChecklists';
import { styles } from './ChecklistsScreen.styles';
import { HomeCalendar } from '../Home/HomeCalendar';

type Props = BottomTabScreenProps<MainTabParams, 'Checklists'>;
type Template = {
  title: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  items: { name: string; quantity?: string }[];
};
type Editor =
  | { kind: 'create'; title: string; items: Template['items'] }
  | { kind: 'rename'; checklist: PrepChecklist }
  | { kind: 'item'; checklist: PrepChecklist; item: PrepChecklistItem };
type DeleteTarget =
  | { kind: 'checklist'; checklist: PrepChecklist }
  | { kind: 'item'; checklist: PrepChecklist; item: PrepChecklistItem };

function formatChecklistDate(dateKey: string) {
  const date = parseDateKey(dateKey);
  if (!date) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

const templates: Template[] = [
  { title: 'Mua sắm', icon: 'shopping-cart', items: [] },
  {
    title: 'Đi du lịch',
    icon: 'briefcase',
    items: [
      { name: 'Giấy tờ tùy thân' },
      { name: 'Vé và đặt chỗ' },
      { name: 'Quần áo' },
      { name: 'Sạc điện thoại' },
      { name: 'Thuốc cá nhân' },
    ],
  },
  {
    title: 'Về quê',
    icon: 'home',
    items: [
      { name: 'Giấy tờ tùy thân' },
      { name: 'Quà mang về' },
      { name: 'Quần áo' },
      { name: 'Thuốc cá nhân' },
      { name: 'Sạc điện thoại' },
    ],
  },
];

export function ChecklistsScreen({ navigation, route }: Props) {
  const uid = useAuthStore((state) => state.user?.uid);
  const [checklists, setChecklists] = useState<PrepChecklist[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const newItemNameInput = useRef<NativeTextInput>(null);
  const newItemQuantityInput = useRef<NativeTextInput>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [editorError, setEditorError] = useState<string | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerError, setDatePickerError] = useState<string | null>(null);
  const [draftScheduledDate, setDraftScheduledDate] = useState(
    () => new Date(),
  );
  const [datePickerMonth, setDatePickerMonth] = useState(() => new Date());

  useEffect(() => {
    if (!uid) {
      setChecklists([]);
      setLoadedUid(null);
      setLoading(false);
      setSelectedId(null);
      setEditor(null);
      setDeleteTarget(null);
      setNewItemName('');
      setNewItemQuantity('');
      return;
    }
    let current = true;
    setChecklists([]);
    setLoadedUid(null);
    setSelectedId(null);
    setEditor(null);
    setDeleteTarget(null);
    setNewItemName('');
    setNewItemQuantity('');
    setLoading(true);
    setError(null);
    void readPrepChecklists(uid)
      .then((saved) => {
        if (current) {
          setChecklists(saved);
          setLoadedUid(uid);
        }
      })
      .catch((cause) => {
        if (current)
          setError((cause as Error).message || 'Chưa đọc được danh sách.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [uid]);

  const accountChecklists = useMemo(
    () => (loadedUid === uid ? checklists : []),
    [checklists, loadedUid, uid],
  );
  const selected =
    accountChecklists.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    const requestedId = route.params?.checklistId;
    if (
      !requestedId ||
      !accountChecklists.some((item) => item.id === requestedId)
    )
      return;
    setSelectedId(requestedId);
    navigation.setParams({ checklistId: undefined });
  }, [accountChecklists, navigation, route.params?.checklistId]);

  function openChecklist(checklistId: string) {
    setError(null);
    setSelectedId(checklistId);
  }

  function returnToOverview() {
    setError(null);
    setSelectedId(null);
  }

  function openDatePicker() {
    const currentDate = selected?.scheduledDateKey
      ? parseDateKey(selected.scheduledDateKey)
      : null;
    const initialDate = currentDate ?? new Date();
    setDraftScheduledDate(initialDate);
    setDatePickerMonth(initialDate);
    setDatePickerError(null);
    setDatePickerVisible(true);
  }

  async function saveScheduledDate(dateKey: string | null) {
    if (!uid || !selected || busyRef.current) return;
    markBusy(true);
    setError(null);
    try {
      const saved = await setPrepChecklistDate(uid, selected.id, dateKey);
      if (uid !== useAuthStore.getState().user?.uid) return;
      setChecklists((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      setLoadedUid(uid);
      setDatePickerError(null);
      setDatePickerVisible(false);
    } catch (cause) {
      setDatePickerError(
        (cause as Error).message || 'Chưa cập nhật được ngày chuẩn bị.',
      );
    } finally {
      markBusy(false);
    }
  }

  function openCreate(template?: Template) {
    setEditorTitle(template?.title ?? '');
    setEditor({
      kind: 'create',
      title: template?.title ?? '',
      items: template?.items ?? [],
    });
    setEditorError(null);
  }

  function openRename(checklist: PrepChecklist) {
    setEditorTitle(checklist.title);
    setEditor({ kind: 'rename', checklist });
    setEditorError(null);
  }

  function openItemEditor(checklist: PrepChecklist, item: PrepChecklistItem) {
    setItemName(item.name);
    setItemQuantity(item.quantity);
    setEditor({ kind: 'item', checklist, item });
    setEditorError(null);
  }

  function closeEditor() {
    if (busyRef.current) return;
    setEditor(null);
    setEditorError(null);
  }

  function markBusy(value: boolean) {
    busyRef.current = value;
    setBusy(value);
  }

  async function saveEditor() {
    if (!uid || !editor || busyRef.current) return;
    if (editor.kind === 'create') {
      const validation = validatePrepChecklistTitle(editorTitle);
      if (validation) {
        setEditorError(validation);
        return;
      }
      markBusy(true);
      setEditorError(null);
      try {
        const created = await createPrepChecklist(uid, {
          title: editorTitle,
          items: editor.items,
        });
        if (uid !== useAuthStore.getState().user?.uid) return;
        setChecklists((current) => [created, ...current]);
        setLoadedUid(uid);
        setSelectedId(created.id);
        setEditor(null);
      } catch (cause) {
        setEditorError((cause as Error).message || 'Chưa tạo được danh sách.');
      } finally {
        markBusy(false);
      }
      return;
    }
    if (editor.kind === 'rename') {
      const validation = validatePrepChecklistTitle(editorTitle);
      if (validation) {
        setEditorError(validation);
        return;
      }
      const saved = await saveChecklist(
        { ...editor.checklist, title: editorTitle.trim() },
        'Chưa đổi được tên danh sách.',
        setEditorError,
      );
      if (saved) setEditor(null);
      return;
    }
    const validation = validatePrepChecklistItem(itemName, itemQuantity);
    if (validation) {
      setEditorError(validation);
      return;
    }
    const item: PrepChecklistItem = {
      ...editor.item,
      name: itemName.trim(),
      quantity: itemQuantity.trim(),
    };
    const saved = await saveChecklist(
      {
        ...editor.checklist,
        items: editor.checklist.items.map((current) =>
          current.id === item.id ? item : current,
        ),
      },
      'Chưa lưu được mục.',
      setEditorError,
    );
    if (saved) setEditor(null);
  }

  async function saveChecklist(
    next: PrepChecklist,
    fallback: string,
    // Editor dialogs cover the screen error, so they show failures inline.
    onError: (message: string) => void = setError,
  ) {
    if (!uid || busyRef.current) return false;
    markBusy(true);
    setError(null);
    try {
      const saved = await updatePrepChecklist(uid, next);
      if (uid !== useAuthStore.getState().user?.uid) return false;
      setChecklists((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      setLoadedUid(uid);
      return true;
    } catch (cause) {
      onError((cause as Error).message || fallback);
      return false;
    } finally {
      markBusy(false);
    }
  }

  async function toggleItem(checklist: PrepChecklist, item: PrepChecklistItem) {
    await saveChecklist(
      {
        ...checklist,
        items: checklist.items.map((current) =>
          current.id === item.id
            ? { ...current, checked: !current.checked }
            : current,
        ),
      },
      'Chưa cập nhật được trạng thái mục.',
    );
  }

  async function addInlineItem() {
    if (!selected || busyRef.current) return;
    if (selected.items.length >= MAX_CHECKLIST_ITEMS) {
      setError(`Danh sách đã đủ ${MAX_CHECKLIST_ITEMS} mục.`);
      return;
    }
    const validation = validatePrepChecklistItem(newItemName, newItemQuantity);
    if (validation) {
      setError(validation);
      return;
    }
    const item: PrepChecklistItem = {
      id: randomUUID(),
      name: newItemName.trim(),
      quantity: newItemQuantity.trim(),
      checked: false,
    };
    const saved = await saveChecklist(
      { ...selected, items: [...selected.items, item] },
      'Chưa thêm được mục.',
    );
    if (saved) {
      newItemNameInput.current?.blur();
      newItemQuantityInput.current?.blur();
      setNewItemName('');
      setNewItemQuantity('');
      setError(null);
    }
  }

  async function duplicate(checklist: PrepChecklist) {
    if (!uid || busyRef.current) return;
    markBusy(true);
    setError(null);
    try {
      const copy = await duplicatePrepChecklist(uid, checklist.id);
      if (uid !== useAuthStore.getState().user?.uid) return;
      setChecklists((current) => [copy, ...current]);
      setLoadedUid(uid);
      setSelectedId(copy.id);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa dùng lại được danh sách.');
    } finally {
      markBusy(false);
    }
  }

  function confirmDelete(checklist: PrepChecklist) {
    setDeleteTarget({ kind: 'checklist', checklist });
  }

  async function removeChecklist(checklist: PrepChecklist) {
    if (!uid || busyRef.current) return;
    markBusy(true);
    setError(null);
    try {
      const remaining = await deletePrepChecklist(uid, checklist.id);
      if (uid !== useAuthStore.getState().user?.uid) return;
      setChecklists(remaining);
      setLoadedUid(uid);
      if (selectedId === checklist.id) setSelectedId(null);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa xóa được danh sách.');
    } finally {
      markBusy(false);
    }
  }

  function confirmRemoveItem(
    checklist: PrepChecklist,
    item: PrepChecklistItem,
  ) {
    setDeleteTarget({ kind: 'item', checklist, item });
  }

  function deletePending() {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    if (target.kind === 'checklist') void removeChecklist(target.checklist);
    else void removeItem(target.checklist, target.item);
  }

  async function removeItem(checklist: PrepChecklist, item: PrepChecklistItem) {
    await saveChecklist(
      {
        ...checklist,
        items: checklist.items.filter((current) => current.id !== item.id),
      },
      'Chưa xóa được mục.',
    );
  }

  const checkedCount =
    selected?.items.filter((item) => item.checked).length ?? 0;
  const remainingCount = (selected?.items.length ?? 0) - checkedCount;
  const percent = selected?.items.length
    ? Math.round((checkedCount / selected.items.length) * 100)
    : 0;

  return (
    <Screen contentStyle={selected ? styles.detailContent : styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selected ? 'Quay lại danh sách' : 'Quay về Home'}
          onPress={() =>
            selected ? returnToOverview() : navigation.navigate('Home')
          }
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={19} color={colors.earth} />
        </Pressable>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={styles.title}>
            {selected ? selected.title : 'Danh sách chuẩn bị'}
          </Text>
          <Text style={styles.subtitle}>
            {selected
              ? 'Đánh dấu món đã chuẩn bị'
              : 'Mua sắm, đi chơi và việc cần mang theo'}
          </Text>
        </View>
        {!selected && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tạo danh sách mới"
            onPress={() => openCreate()}
            style={styles.iconButton}
          >
            <Feather name="plus" size={21} color={colors.earth} />
          </Pressable>
        )}
        {selected && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đổi tên danh sách"
            onPress={() => openRename(selected)}
            style={styles.iconButton}
          >
            <Feather name="edit-2" size={17} color={colors.earth} />
          </Pressable>
        )}
      </View>

      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {selected ? (
        <>
          <View style={styles.progressCard}>
            <View style={styles.progressSummary}>
              <View>
                <Text style={styles.progressTitle}>
                  {checkedCount}/{selected.items.length} mục đã chuẩn bị
                </Text>
                <Text style={styles.sectionHint}>
                  {selected.items.length === 0
                    ? 'Chưa có món nào'
                    : remainingCount === 0
                      ? 'Đã chuẩn bị xong hết'
                      : `${remainingCount} món còn lại`}
                </Text>
              </View>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Tiến độ chuẩn bị"
              accessibilityValue={{ min: 0, max: 100, now: percent }}
              style={styles.progressTrack}
            >
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
          </View>

          <View style={styles.scheduledDateCard}>
            <View style={styles.scheduledDateCopy}>
              <Text style={styles.scheduledDateTitle}>Ngày chuẩn bị</Text>
              <Text style={styles.sectionHint}>
                {selected.scheduledDateKey
                  ? formatChecklistDate(selected.scheduledDateKey)
                  : 'Chưa gắn ngày trên lịch'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                selected.scheduledDateKey
                  ? 'Đổi ngày chuẩn bị'
                  : 'Gắn danh sách vào ngày'
              }
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={openDatePicker}
              style={styles.scheduledDateButton}
            >
              <Feather name="calendar" size={15} color={colors.earth} />
              <Text style={styles.scheduledDateButtonText}>
                {selected.scheduledDateKey ? 'Đổi ngày' : 'Gắn ngày'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.listHeading}>
            <Text style={styles.listHeadingTitle}>Các món trong danh sách</Text>
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountText}>{selected.items.length}</Text>
            </View>
          </View>
          <View style={styles.itemList}>
            {selected.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={
                    item.checked
                      ? `Bỏ đánh dấu: ${item.name}`
                      : `Đánh dấu đã xong: ${item.name}`
                  }
                  accessibilityState={{
                    checked: item.checked,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() => void toggleItem(selected, item)}
                  style={[
                    styles.checkbox,
                    item.checked && styles.checkboxChecked,
                  ]}
                >
                  {item.checked && (
                    <Feather name="check" size={16} color={colors.surface} />
                  )}
                </Pressable>
                <View style={styles.itemInfo}>
                  <Text
                    style={[
                      styles.itemName,
                      item.checked && styles.itemChecked,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {!!item.quantity && (
                    <Text style={styles.itemQuantity}>{item.quantity}</Text>
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Sửa mục ${item.name}`}
                  disabled={busy}
                  onPress={() => openItemEditor(selected, item)}
                  style={styles.itemAction}
                >
                  <Feather name="edit-2" size={16} color={colors.muted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Xóa mục ${item.name}`}
                  disabled={busy}
                  onPress={() => confirmRemoveItem(selected, item)}
                  style={styles.itemAction}
                >
                  <Feather name="trash-2" size={16} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>

          <View style={styles.addCard}>
            <Text style={styles.addTitle}>Thêm món cần chuẩn bị</Text>
            <View style={styles.inputRow}>
              <TextInput
                ref={newItemNameInput}
                accessibilityLabel="Tên mục mới"
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder="Tên món / việc"
                placeholderTextColor={colors.muted}
                maxLength={120}
                returnKeyType="done"
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                ref={newItemQuantityInput}
                accessibilityLabel="Số lượng mục mới"
                value={newItemQuantity}
                onChangeText={setNewItemQuantity}
                placeholder="Số lượng"
                placeholderTextColor={colors.muted}
                maxLength={80}
                style={[styles.input, styles.quantityInput]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thêm mục"
                disabled={busy}
                onPress={() => void addInlineItem()}
                style={[styles.quickAddButton, busy && { opacity: 0.6 }]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.earth} />
                ) : (
                  <Feather name="plus" size={19} color={colors.earth} />
                )}
              </Pressable>
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={styles.section}>
            <View>
              <Text style={styles.sectionHeading}>Bắt đầu nhanh</Text>
              <Text style={styles.sectionHint}>
                Chọn mẫu rồi tùy chỉnh theo nhu cầu.
              </Text>
            </View>
            <View style={styles.templateGrid}>
              {templates.map((template) => (
                <Pressable
                  key={template.title}
                  accessibilityRole="button"
                  accessibilityLabel={`Tạo từ mẫu ${template.title}`}
                  onPress={() => openCreate(template)}
                  style={styles.templateButton}
                >
                  <View style={styles.templateIcon}>
                    <Feather
                      name={template.icon}
                      size={16}
                      color={colors.sky}
                    />
                  </View>
                  <Text style={styles.templateLabel}>{template.title}</Text>
                  <Text style={styles.templateHint}>
                    {template.items.length
                      ? `${template.items.length} mục gợi ý`
                      : 'Tự thêm món'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View>
              <Text style={styles.sectionHeading}>Danh sách của bạn</Text>
              <Text style={styles.sectionHint}>
                Lưu trên thiết bị, có thể dùng khi offline.
              </Text>
            </View>
            {loading && loadedUid !== uid ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator color={colors.earth} />
                <Text style={styles.sectionHint}>
                  Đang mở danh sách trên thiết bị…
                </Text>
              </View>
            ) : accountChecklists.length ? (
              accountChecklists.map((checklist) => {
                const done = checklist.items.filter(
                  (item) => item.checked,
                ).length;
                const listPercent = checklist.items.length
                  ? Math.round((done / checklist.items.length) * 100)
                  : 0;
                return (
                  <View key={checklist.id} style={styles.listCard}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Mở danh sách ${checklist.title}`}
                      onPress={() => openChecklist(checklist.id)}
                      style={styles.listOpen}
                    >
                      <View style={styles.listIcon}>
                        <Feather
                          name="clipboard"
                          size={19}
                          color={colors.earth}
                        />
                      </View>
                      <View style={styles.listDetails}>
                        <Text numberOfLines={1} style={styles.listTitle}>
                          {checklist.title}
                        </Text>
                        <Text style={styles.listProgressText}>
                          {checklist.items.length
                            ? `${done}/${checklist.items.length} mục đã chuẩn bị`
                            : 'Chưa có mục · chạm để thêm'}
                        </Text>
                      </View>
                      <Feather
                        name="chevron-right"
                        size={19}
                        color={colors.muted}
                      />
                    </Pressable>
                    {checklist.items.length > 0 && (
                      <View
                        accessibilityRole="progressbar"
                        accessibilityLabel={`Tiến độ ${checklist.title}`}
                        accessibilityValue={{
                          min: 0,
                          max: 100,
                          now: listPercent,
                        }}
                        style={styles.progressTrack}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${listPercent}%` },
                          ]}
                        />
                      </View>
                    )}
                    <View style={styles.listActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Dùng lại ${checklist.title}`}
                        onPress={() => void duplicate(checklist)}
                        disabled={busy}
                        style={styles.smallAction}
                      >
                        <Feather name="copy" size={14} color={colors.earth} />
                        <Text style={styles.smallActionText}>Dùng lại</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Xóa danh sách ${checklist.title}`}
                        onPress={() => confirmDelete(checklist)}
                        disabled={busy}
                        style={[styles.smallAction, styles.smallDangerAction]}
                      >
                        <Feather
                          name="trash-2"
                          size={14}
                          color={colors.danger}
                        />
                        <Text style={styles.smallDangerText}>Xóa</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.templateIcon}>
                  <Feather name="check-square" size={19} color={colors.sky} />
                </View>
                <Text style={styles.emptyTitle}>Chưa có danh sách nào</Text>
                <Text style={styles.emptyText}>
                  Chọn một mẫu ở trên hoặc tạo danh sách trống để ghi lại những
                  thứ cần mua, cần mang theo.
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      <DialogModal
        visible={!!editor}
        onRequestClose={closeEditor}
        style={styles.dialog}
      >
        <View style={styles.dialogHeader}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>
            {editor?.kind === 'create'
              ? 'Tạo danh sách'
              : editor?.kind === 'rename'
                ? 'Đổi tên danh sách'
                : 'Sửa mục'}
          </Text>
          <DialogCloseButton
            accessibilityLabel="Đóng"
            onPress={closeEditor}
            disabled={busy}
          />
        </View>
        {editor?.kind !== 'item' ? (
          <TextInput
            accessibilityLabel="Tên danh sách"
            value={editorTitle}
            onChangeText={setEditorTitle}
            placeholder="Ví dụ: Đi chợ cuối tuần"
            placeholderTextColor={colors.muted}
            maxLength={80}
            autoFocus
            style={styles.input}
          />
        ) : (
          <>
            <TextInput
              accessibilityLabel="Tên mục"
              value={itemName}
              onChangeText={setItemName}
              placeholder="Tên món cần chuẩn bị"
              placeholderTextColor={colors.muted}
              maxLength={120}
              autoFocus
              style={styles.input}
            />
            <TextInput
              accessibilityLabel="Số lượng"
              value={itemQuantity}
              onChangeText={setItemQuantity}
              placeholder="Số lượng, ví dụ: 2 chai"
              placeholderTextColor={colors.muted}
              maxLength={80}
              style={styles.input}
            />
          </>
        )}
        {editorError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {editorError}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            editor?.kind === 'create'
              ? 'Tạo danh sách'
              : editor?.kind === 'rename'
                ? 'Lưu tên danh sách'
                : editor?.item
                  ? 'Lưu mục'
                  : 'Thêm mục'
          }
          disabled={busy}
          onPress={() => void saveEditor()}
          style={[styles.addButton, busy && { opacity: 0.6 }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.addButtonText}>
              {editor?.kind === 'create'
                ? 'Tạo danh sách'
                : editor?.kind === 'rename'
                  ? 'Lưu tên'
                  : editor?.item
                    ? 'Lưu mục'
                    : 'Thêm mục'}
            </Text>
          )}
        </Pressable>
      </DialogModal>
      <DialogModal
        visible={!!deleteTarget}
        onRequestClose={() => !busy && setDeleteTarget(null)}
        style={styles.dialog}
      >
        <View style={styles.dialogHeader}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>
            {deleteTarget?.kind === 'checklist' ? 'Xóa danh sách?' : 'Xóa mục?'}
          </Text>
          <DialogCloseButton
            accessibilityLabel="Đóng"
            onPress={() => setDeleteTarget(null)}
            disabled={busy}
          />
        </View>
        <Text style={styles.sectionHint}>
          {deleteTarget?.kind === 'checklist'
            ? `“${deleteTarget.checklist.title}” sẽ bị xóa khỏi thiết bị này.`
            : `Xóa “${deleteTarget?.kind === 'item' ? deleteTarget.item.name : ''}” khỏi danh sách này?`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            deleteTarget?.kind === 'checklist' ? 'Xóa danh sách' : 'Xóa mục'
          }
          disabled={busy}
          onPress={deletePending}
          style={[styles.dangerButton, busy && { opacity: 0.6 }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.dangerButtonText}>Xóa</Text>
          )}
        </Pressable>
      </DialogModal>
      <DialogModal
        visible={datePickerVisible}
        onRequestClose={() => !busy && setDatePickerVisible(false)}
        style={styles.dateDialog}
      >
        <View style={styles.dialogHeader}>
          <View style={styles.dateDialogCopy}>
            <Text accessibilityRole="header" style={styles.dialogTitle}>
              Chọn ngày chuẩn bị
            </Text>
            <Text style={styles.sectionHint}>
              {formatChecklistDate(toDateKey(draftScheduledDate))}
            </Text>
          </View>
          <DialogCloseButton
            accessibilityLabel="Đóng chọn ngày"
            onPress={() => setDatePickerVisible(false)}
            disabled={busy}
          />
        </View>
        <ScrollView
          style={styles.dateCalendarScroll}
          contentContainerStyle={styles.dateCalendarContent}
          showsVerticalScrollIndicator={false}
        >
          <HomeCalendar
            selectedDate={draftScheduledDate}
            monthDate={datePickerMonth}
            checklistDateKeys={
              selected?.scheduledDateKey ? [selected.scheduledDateKey] : []
            }
            onSelect={setDraftScheduledDate}
            onMonthChange={setDatePickerMonth}
          />
        </ScrollView>
        {datePickerError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {datePickerError}
          </Text>
        )}
        <View style={styles.dateDialogActions}>
          {selected?.scheduledDateKey && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bỏ ngày chuẩn bị"
              disabled={busy}
              onPress={() => void saveScheduledDate(null)}
              style={styles.clearDateButton}
            >
              {busy ? (
                <ActivityIndicator color={colors.earth} />
              ) : (
                <Text style={styles.clearDateText}>Bỏ ngày</Text>
              )}
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gắn danh sách vào ngày đã chọn"
            disabled={busy}
            onPress={() =>
              void saveScheduledDate(toDateKey(draftScheduledDate))
            }
            style={[
              styles.addButton,
              styles.confirmDateButton,
              busy && { opacity: 0.6 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.addButtonText}>Gắn vào ngày này</Text>
            )}
          </Pressable>
        </View>
      </DialogModal>
    </Screen>
  );
}
