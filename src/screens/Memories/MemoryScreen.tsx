import Feather from '@expo/vector-icons/Feather';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { Screen } from '../../components/Screen';
import {
  createMemory,
  deleteMemory,
  memoryPhotoUri,
  readMemories,
  updateMemory,
} from '../../services/memories/memoryStorage';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme';
import type { MemoryDraft, MemoryEntry } from '../../types/memory';
import { parseDateKey } from '../../utils/vietnameseCalendar';
import { MemoryEditor } from './MemoryEditor';
import { styles } from './MemoryScreen.styles';

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-');
  return `Tháng ${Number(month)} · ${year}`;
}

function dayLabel(dateKey: string) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function MemoryScreen() {
  const uid = useAuthStore((state) => state.user?.uid);
  const [items, setItems] = useState<MemoryEntry[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<MemoryEntry | null>(null);
  const operationInFlight = useRef(false);
  const loadGeneration = useRef(0);

  const load = useCallback(async (accountId: string, refresh = false) => {
    const generation = ++loadGeneration.current;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const saved = await readMemories(accountId);
      if (
        generation === loadGeneration.current &&
        useAuthStore.getState().user?.uid === accountId
      ) {
        setItems(saved);
        setLoadedUid(accountId);
      }
    } catch (cause) {
      if (generation === loadGeneration.current)
        setError((cause as Error).message || 'Chưa đọc được dòng ký ức.');
    } finally {
      if (generation === loadGeneration.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    setItems([]);
    setLoadedUid(null);
    setEditorVisible(false);
    setEditing(null);
    if (uid) void load(uid);
    else setLoading(false);
    return () => {
      loadGeneration.current += 1;
    };
  }, [uid, load]);

  const accountItems = useMemo(
    () => (loadedUid === uid ? items : []),
    [items, loadedUid, uid],
  );
  const groups = useMemo(() => {
    const result: { month: string; entries: MemoryEntry[] }[] = [];
    for (const item of accountItems) {
      const month = item.dateKey.slice(0, 7);
      const last = result[result.length - 1];
      if (last?.month === month) last.entries.push(item);
      else result.push({ month, entries: [item] });
    }
    return result;
  }, [accountItems]);

  async function save(draft: MemoryDraft) {
    if (!uid || operationInFlight.current) return;
    operationInFlight.current = true;
    setBusy(true);
    try {
      if (editing) await updateMemory(uid, editing.id, draft);
      else await createMemory(uid, draft);
      if (useAuthStore.getState().user?.uid === uid) await load(uid);
    } finally {
      operationInFlight.current = false;
      setBusy(false);
    }
  }

  function confirmDelete(item: MemoryEntry) {
    if (!uid || operationInFlight.current) return;
    Alert.alert(
      'Xóa ký ức?',
      'Ảnh và nội dung của khoảnh khắc này sẽ bị xóa khỏi thiết bị.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            if (!uid || operationInFlight.current) return;
            operationInFlight.current = true;
            setBusy(true);
            void deleteMemory(uid, item.id)
              .then(() => {
                if (useAuthStore.getState().user?.uid === uid) return load(uid);
              })
              .catch((cause) => {
                if (useAuthStore.getState().user?.uid === uid)
                  setError((cause as Error).message || 'Chưa xóa được ký ức.');
              })
              .finally(() => {
                operationInFlight.current = false;
                setBusy(false);
              });
          },
        },
      ],
    );
  }

  return (
    <>
      <Screen
        fixedHeaderStyle={styles.fixedHeader}
        fixedHeader={
          <View style={styles.header}>
            <View style={styles.headerTitleBlock}>
              <Text accessibilityRole="header" style={styles.headerTitle}>
                Dòng ký ức
              </Text>
              <Text style={styles.headerSubtitle}>
                Giữ lại những ngày đáng nhớ
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm khoảnh khắc"
              accessibilityState={{
                disabled: !uid || loading || busy || loadedUid !== uid,
              }}
              disabled={!uid || loading || busy || loadedUid !== uid}
              onPress={() => {
                setEditing(null);
                setEditorVisible(true);
              }}
              style={styles.headerAdd}
            >
              <Feather name="plus" size={22} color={colors.earth} />
            </Pressable>
          </View>
        }
        contentStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => uid && void load(uid, true)}
            tintColor={colors.earth}
          />
        }
      >
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Feather name="camera" size={24} color={colors.earth} />
          </View>
          <View style={styles.introText}>
            <Text style={styles.introCount}>
              {accountItems.length} khoảnh khắc
            </Text>
            <Text style={styles.introDescription}>
              Một bức ảnh, vài dòng chữ, cả một ngày để nhớ.
            </Text>
          </View>
        </View>
        <View style={styles.localNotice}>
          <Feather name="smartphone" size={14} color={colors.success} />
          <Text style={styles.localNoticeText}>
            Lưu riêng trên thiết bị này
          </Text>
        </View>
        {!!error && (
          <View style={styles.errorBox}>
            <Text accessibilityRole="alert" style={styles.errorText}>
              {error}
            </Text>
            {uid && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thử tải lại ký ức"
                onPress={() => void load(uid)}
              >
                <Text style={styles.retryText}>Thử lại</Text>
              </Pressable>
            )}
          </View>
        )}
        {loading && !accountItems.length ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.earth} />
            <Text style={styles.mutedText}>Đang mở dòng ký ức…</Text>
          </View>
        ) : !accountItems.length && loadedUid === uid ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Feather name="image" size={28} color={colors.sky} />
            </View>
            <Text style={styles.emptyTitle}>Bắt đầu từ hôm nay</Text>
            <Text style={styles.emptyDescription}>
              Chụp một khoảnh khắc hoặc viết lại điều bạn muốn giữ.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ghi khoảnh khắc đầu tiên"
              disabled={busy}
              onPress={() => {
                setEditing(null);
                setEditorVisible(true);
              }}
              style={styles.emptyAction}
            >
              <Feather name="plus" size={16} color={colors.earth} />
              <Text style={styles.emptyActionText}>
                Ghi khoảnh khắc đầu tiên
              </Text>
            </Pressable>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.month} style={styles.monthGroup}>
              <View style={styles.monthHeader}>
                <View style={styles.monthDot} />
                <Text style={styles.monthTitle}>{monthLabel(group.month)}</Text>
                <Text style={styles.monthCount}>{group.entries.length}</Text>
              </View>
              {group.entries.map((item) => {
                const photoUri = memoryPhotoUri(
                  item.ownerId,
                  item.photoFileName,
                );
                return (
                  <View key={item.id} style={styles.entryCard}>
                    {photoUri && (
                      <Image
                        source={{ uri: photoUri }}
                        style={styles.entryPhoto}
                        resizeMode="cover"
                        accessibilityLabel={`Ảnh ký ức ngày ${dayLabel(item.dateKey)}`}
                      />
                    )}
                    <View style={styles.entryBody}>
                      <View style={styles.entryTopRow}>
                        <View style={styles.dateChip}>
                          <Feather
                            name="calendar"
                            size={13}
                            color={colors.earth}
                          />
                          <Text style={styles.dateChipText}>
                            {dayLabel(item.dateKey)}
                          </Text>
                        </View>
                        <View style={styles.entryActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Sửa ký ức ngày ${dayLabel(item.dateKey)}`}
                            disabled={busy}
                            onPress={() => {
                              setEditing(item);
                              setEditorVisible(true);
                            }}
                            style={styles.entryAction}
                          >
                            <Feather
                              name="edit-2"
                              size={16}
                              color={colors.earth}
                            />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Xóa ký ức ngày ${dayLabel(item.dateKey)}`}
                            disabled={busy}
                            onPress={() => confirmDelete(item)}
                            style={styles.entryAction}
                          >
                            <Feather
                              name="trash-2"
                              size={16}
                              color={colors.danger}
                            />
                          </Pressable>
                        </View>
                      </View>
                      {!!item.text && (
                        <Text style={styles.entryText}>{item.text}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </Screen>
      {uid && (
        <MemoryEditor
          visible={editorVisible}
          uid={uid}
          entry={editing}
          busy={busy}
          onClose={() => setEditorVisible(false)}
          onSave={save}
        />
      )}
    </>
  );
}
