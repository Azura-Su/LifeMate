import Feather from '@expo/vector-icons/Feather';
import { useIsFocused } from '@react-navigation/native';
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
import { useProfile } from '../../hooks/useProfile';
import {
  cancelMemoryFriendInvite,
  changeMemoryFriend,
  getFriendMemories,
  getMemoryShareState,
  memoryPublishDefinitelyNotStarted,
  publishMemory,
  sendMemoryFriendInvite,
  unshareMemory,
  type FriendMemory,
  type MemoryShareState,
} from '../../services/memories/memorySharing';
import {
  createMemory,
  deleteMemory,
  memoryPhotoUri,
  readMemories,
  setMemoryVisibility,
  updateMemory,
} from '../../services/memories/memoryStorage';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme';
import type { MemoryDraft, MemoryEntry } from '../../types/memory';
import { parseDateKey } from '../../utils/vietnameseCalendar';
import { MemoryEditor } from './MemoryEditor';
import { MemoryFriendsModal } from './MemoryFriendsModal';
import { MemoryCapture, type CapturedMemoryPhoto } from './MemoryCapture';
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
  const { name } = useProfile();
  const isFocused = useIsFocused();
  const [viewMode, setViewMode] = useState<'capture' | 'timeline'>('capture');
  const [timelineTab, setTimelineTab] = useState<'mine' | 'friends'>('mine');
  const [friendsVisible, setFriendsVisible] = useState(false);
  const [shareState, setShareState] = useState<MemoryShareState | null>(null);
  const [friendItems, setFriendItems] = useState<FriendMemory[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [items, setItems] = useState<MemoryEntry[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<MemoryEntry | null>(null);
  const [initialPhoto, setInitialPhoto] = useState<CapturedMemoryPhoto | null>(
    null,
  );
  const operationInFlight = useRef(false);
  const loadGeneration = useRef(0);
  const cloudGeneration = useRef(0);

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

  const loadCloud = useCallback(
    async (accountId: string, displayName: string, includeFeed = true) => {
      const generation = ++cloudGeneration.current;
      setCloudLoading(true);
      setCloudError(null);
      setShareState(null);
      setFriendItems([]);
      try {
        const state = await getMemoryShareState(accountId, displayName);
        if (
          generation === cloudGeneration.current &&
          useAuthStore.getState().user?.uid === accountId
        ) {
          setShareState(state);
        }
        if (includeFeed) {
          const feed = await getFriendMemories(accountId, displayName);
          if (
            generation === cloudGeneration.current &&
            useAuthStore.getState().user?.uid === accountId
          )
            setFriendItems(feed);
        }
      } catch (cause) {
        if (
          generation === cloudGeneration.current &&
          useAuthStore.getState().user?.uid === accountId
        ) {
          setCloudError(
            (cause as Error).message || 'Chưa tải được phần chia sẻ.',
          );
        }
      } finally {
        if (generation === cloudGeneration.current) setCloudLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (isFocused) setViewMode('capture');
  }, [isFocused]);

  useEffect(() => {
    if (isFocused && uid && viewMode === 'timeline') void loadCloud(uid, name);
  }, [isFocused, uid, viewMode, loadCloud, name]);

  useEffect(() => {
    setItems([]);
    setShareState(null);
    setFriendItems([]);
    setCloudError(null);
    setTimelineTab('mine');
    setFriendsVisible(false);
    setLoadedUid(null);
    setEditorVisible(false);
    setEditing(null);
    setInitialPhoto(null);
    if (uid) void load(uid);
    else setLoading(false);
    return () => {
      loadGeneration.current += 1;
      cloudGeneration.current += 1;
    };
  }, [uid, load]);

  const accountItems = useMemo(
    () => (loadedUid === uid ? items : []),
    [items, loadedUid, uid],
  );
  const latestPhoto = accountItems.find((item) => item.photoFileName);
  const sharedIds = useMemo(
    () => new Set(shareState?.sharedIds ?? []),
    [shareState],
  );
  const isShared = (item: MemoryEntry) =>
    shareState ? sharedIds.has(item.id) : item.visibility === 'friends';
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

  function openEditor(photo: CapturedMemoryPhoto | null = null) {
    setEditing(null);
    setInitialPhoto(photo);
    setEditorVisible(true);
  }

  async function save(draft: MemoryDraft) {
    if (!uid) throw new Error('Hãy đăng nhập lại để lưu ký ức.');
    if (operationInFlight.current)
      throw new Error('Đang lưu ký ức. Hãy chờ một chút.');
    operationInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      let saved: MemoryEntry;
      let publishError: string | null = null;
      if (editing) {
        if (!shareState && editing.visibility === 'friends')
          throw new Error(
            'Hãy kết nối để kiểm tra quyền xem trước khi sửa ký ức này.',
          );
        if (isShared(editing)) {
          await unshareMemory(uid, name, editing.id);
          await setMemoryVisibility(uid, editing.id, 'private');
        }
        saved = await updateMemory(uid, editing.id, draft);
      } else saved = await createMemory(uid, draft);
      if (draft.visibility === 'friends') {
        try {
          await publishMemory(uid, name, saved);
          await setMemoryVisibility(uid, saved.id, 'friends');
        } catch (cause) {
          if (!memoryPublishDefinitelyNotStarted(cause)) {
            try {
              await unshareMemory(uid, name, saved.id);
            } catch {
              await setMemoryVisibility(uid, saved.id, 'friends').catch(() => undefined);
              setEditing({ ...saved, visibility: 'friends' });
              throw new Error(
                'Ký ức đã lưu trên máy nhưng chưa xác nhận được quyền xem. Hãy kết nối và tải lại trước khi rời màn này.',
              );
            }
          }
          publishError = `Đã lưu riêng trên máy. ${(cause as Error).message || 'Chưa chia sẻ được.'}`;
        }
      }
      if (useAuthStore.getState().user?.uid === uid) await load(uid);
      if (publishError) setError(publishError);
      if (viewMode === 'timeline') void loadCloud(uid, name);
    } finally {
      operationInFlight.current = false;
      setBusy(false);
    }
  }

  async function changeVisibility(item: MemoryEntry) {
    if (!uid || operationInFlight.current) return;
    if (!shareState && item.visibility === 'friends') {
      setError('Hãy kết nối để kiểm tra quyền xem trước khi đổi ký ức này.');
      return;
    }
    operationInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (isShared(item)) {
        await unshareMemory(uid, name, item.id);
        await setMemoryVisibility(uid, item.id, 'private');
      } else {
        try {
          await publishMemory(uid, name, item);
          await setMemoryVisibility(uid, item.id, 'friends');
        } catch (cause) {
          if (!memoryPublishDefinitelyNotStarted(cause)) {
            try {
              await unshareMemory(uid, name, item.id);
            } catch {
              await setMemoryVisibility(uid, item.id, 'friends').catch(() => undefined);
              throw new Error(
                'Chưa xác nhận được quyền xem. Hãy kết nối và tải lại ký ức.',
              );
            }
          }
          throw cause;
        }
      }
      await load(uid);
      void loadCloud(uid, name);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa đổi được quyền xem.');
      void loadCloud(uid, name);
    } finally {
      operationInFlight.current = false;
      setBusy(false);
    }
  }

  async function updateFriend(
    action: 'accept' | 'decline' | 'remove-friend',
    friendUid: string,
  ) {
    if (!uid || operationInFlight.current) return;
    operationInFlight.current = true;
    setCloudLoading(true);
    try {
      await changeMemoryFriend(uid, name, action, friendUid);
      await loadCloud(uid, name);
    } finally {
      operationInFlight.current = false;
      setCloudLoading(false);
    }
  }

  async function cancelInvite(email: string) {
    if (!uid || operationInFlight.current) return;
    operationInFlight.current = true;
    setCloudLoading(true);
    try {
      await cancelMemoryFriendInvite(uid, name, email);
      await loadCloud(uid, name);
    } finally {
      operationInFlight.current = false;
      setCloudLoading(false);
    }
  }

  async function inviteFriend(email: string) {
    if (!uid || operationInFlight.current) return;
    operationInFlight.current = true;
    setCloudLoading(true);
    try {
      await sendMemoryFriendInvite(uid, name, email);
      await loadCloud(uid, name);
    } finally {
      operationInFlight.current = false;
      setCloudLoading(false);
    }
  }

  function confirmDelete(item: MemoryEntry) {
    if (!uid || operationInFlight.current) return;
    Alert.alert(
      'Xóa ký ức?',
      'Ảnh và nội dung của khoảnh khắc này sẽ bị xóa. Bản chia sẻ với bạn bè cũng sẽ được gỡ.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            if (!uid || operationInFlight.current) return;
            operationInFlight.current = true;
            setBusy(true);
            void (async () => {
              if (isShared(item)) await unshareMemory(uid, name, item.id);
              await deleteMemory(uid, item.id);
            })()
              .then(() => {
                if (useAuthStore.getState().user?.uid === uid) {
                  void loadCloud(uid, name);
                  return load(uid);
                }
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
                {viewMode === 'capture'
                  ? 'Lưu khoảnh khắc của bạn'
                  : 'Những ngày đáng nhớ'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                viewMode === 'capture' ? 'Xem dòng ký ức' : 'Mở máy ảnh'
              }
              accessibilityState={{
                disabled: !uid || busy,
              }}
              disabled={!uid || busy}
              onPress={() =>
                setViewMode(viewMode === 'capture' ? 'timeline' : 'capture')
              }
              style={styles.headerAdd}
            >
              <Feather
                name={viewMode === 'capture' ? 'grid' : 'camera'}
                size={20}
                color={colors.earth}
              />
            </Pressable>
          </View>
        }
        contentStyle={
          viewMode === 'capture' ? styles.captureContent : styles.content
        }
        refreshControl={
          viewMode === 'timeline' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                if (uid) {
                  void load(uid, true);
                  void loadCloud(uid, name);
                }
              }}
              tintColor={colors.earth}
            />
          ) : undefined
        }
      >
        {!!error && (
          <View style={styles.errorBox}>
            <Text accessibilityRole="alert" style={styles.errorText}>
              {error}
            </Text>
            {uid && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tải lại ký ức"
                onPress={() => {
                  void load(uid);
                  if (viewMode === 'timeline') void loadCloud(uid, name);
                }}
              >
                <Text style={styles.retryText}>Tải lại</Text>
              </Pressable>
            )}
          </View>
        )}
        {viewMode === 'capture' ? (
          <MemoryCapture
            active={isFocused && !editorVisible}
            latestPhotoUri={
              latestPhoto
                ? memoryPhotoUri(latestPhoto.ownerId, latestPhoto.photoFileName)
                : null
            }
            onPhoto={(photo) => openEditor(photo)}
            onWriteOnly={() => openEditor()}
            onShowTimeline={() => setViewMode('timeline')}
            memoryCount={accountItems.length}
          />
        ) : (
          <>
            <View style={styles.timelineTabs}>
              {(
                [
                  ['mine', 'Của tôi'],
                  ['friends', 'Bạn bè'],
                ] as const
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`Xem ký ức ${label}`}
                  accessibilityState={{ selected: timelineTab === value }}
                  onPress={() => setTimelineTab(value)}
                  style={[
                    styles.timelineTab,
                    timelineTab === value && styles.timelineTabSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.timelineTabText,
                      timelineTab === value && styles.timelineTabTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quản lý bạn bè"
              onPress={() => setFriendsVisible(true)}
              style={styles.friendsButton}
            >
              <Feather name="users" size={14} color={colors.earth} />
              <Text style={styles.friendsButtonText}>
                Bạn bè · {shareState?.friends.length ?? 0}
              </Text>
              {!!shareState?.incoming.length && (
                <Text style={styles.friendsButtonText}>
                  · {shareState.incoming.length} lời mời
                </Text>
              )}
            </Pressable>
            {!!cloudError && (
              <View style={styles.errorBox}>
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {cloudError}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Thử kết nối chia sẻ"
                  onPress={() => uid && void loadCloud(uid, name)}
                >
                  <Text style={styles.retryText}>Thử lại</Text>
                </Pressable>
              </View>
            )}
            {timelineTab === 'friends' ? (
              cloudLoading && !shareState ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={colors.earth} />
                </View>
              ) : friendItems.length ? (
                friendItems.map((item) => (
                  <View
                    key={`${item.ownerId}:${item.id}`}
                    style={styles.entryCard}
                  >
                    {item.photoUrl && (
                      <Image
                        source={{ uri: item.photoUrl }}
                        style={styles.entryPhoto}
                        resizeMode="cover"
                        accessibilityLabel={`Ảnh ký ức của ${item.ownerName}`}
                      />
                    )}
                    <View style={styles.entryBody}>
                      <Text style={styles.friendName}>{item.ownerName}</Text>
                      <Text style={styles.dateChipText}>
                        {dayLabel(item.dateKey)}
                      </Text>
                      {!!item.text && (
                        <Text style={styles.entryText}>{item.text}</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Feather name="users" size={28} color={colors.sky} />
                  <Text style={styles.emptyTitle}>Chưa có ký ức từ bạn bè</Text>
                  <Text style={styles.emptyDescription}>
                    Kết bạn bằng email để xem những khoảnh khắc họ chọn chia sẻ.
                  </Text>
                </View>
              )
            ) : (
              <>
                <View style={styles.timelineIntro}>
                  <Text style={styles.timelineCount}>
                    {accountItems.length} khoảnh khắc
                  </Text>
                  <Text style={styles.timelineHint}>
                    Chỉ bạn chọn mục nào được chia sẻ
                  </Text>
                </View>
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
                      accessibilityLabel="Chụp khoảnh khắc đầu tiên"
                      disabled={busy}
                      onPress={() => setViewMode('capture')}
                      style={styles.emptyAction}
                    >
                      <Feather name="plus" size={16} color={colors.earth} />
                      <Text style={styles.emptyActionText}>
                        Chụp khoảnh khắc đầu tiên
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  groups.map((group) => (
                    <View key={group.month} style={styles.monthGroup}>
                      <View style={styles.monthHeader}>
                        <View style={styles.monthDot} />
                        <Text style={styles.monthTitle}>
                          {monthLabel(group.month)}
                        </Text>
                        <Text style={styles.monthCount}>
                          {group.entries.length}
                        </Text>
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
                                <Text style={styles.entryText}>
                                  {item.text}
                                </Text>
                              )}
                              <View style={styles.visibilityRow}>
                                <Feather
                                  name={
                                    shareState && isShared(item)
                                      ? 'users'
                                      : 'lock'
                                  }
                                  size={13}
                                  color={colors.muted}
                                />
                                <Text style={styles.visibilityLabel}>
                                  {shareState && isShared(item)
                                    ? 'Bạn bè'
                                    : !shareState &&
                                        item.visibility === 'friends'
                                      ? 'Đang kiểm tra quyền xem'
                                      : 'Chỉ mình tôi'}
                                </Text>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={
                                    isShared(item)
                                      ? 'Khóa ký ức chỉ mình tôi'
                                      : 'Chia sẻ ký ức với bạn bè'
                                  }
                                  disabled={
                                    busy ||
                                    (!shareState &&
                                      item.visibility === 'friends')
                                  }
                                  onPress={() => void changeVisibility(item)}
                                  style={styles.shareAction}
                                >
                                  <Feather
                                    name={isShared(item) ? 'lock' : 'share-2'}
                                    size={13}
                                    color={colors.earth}
                                  />
                                  <Text style={styles.shareActionText}>
                                    {isShared(item)
                                      ? 'Chỉ mình tôi'
                                      : 'Chia sẻ'}
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ))
                )}
              </>
            )}
          </>
        )}
      </Screen>
      {uid && (
        <MemoryEditor
          visible={editorVisible}
          uid={uid}
          entry={editing}
          initialVisibility={
            editing && isShared(editing) ? 'friends' : 'private'
          }
          initialPhoto={initialPhoto}
          busy={busy}
          onClose={() => {
            setEditorVisible(false);
            setInitialPhoto(null);
          }}
          onSave={save}
        />
      )}
      <MemoryFriendsModal
        visible={friendsVisible}
        state={shareState}
        loading={cloudLoading}
        error={cloudError}
        onClose={() => setFriendsVisible(false)}
        onRetry={() => uid && void loadCloud(uid, name)}
        onInvite={inviteFriend}
        onChange={updateFriend}
        onCancel={cancelInvite}
      />
    </>
  );
}
