import Feather from '@expo/vector-icons/Feather';
import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { DialogCloseButton } from '../../components/DialogCloseButton';
import { DialogModal } from '../../components/DialogModal';
import { useProfile } from '../../hooks/useProfile';
import {
  cancelMemoryFriendInvite,
  changeMemoryFriend,
  getFriendMemories,
  getMemoryShareState,
  memoryEmailVerificationNeeded,
  memoryPublishDefinitelyNotStarted,
  migrateLegacyMemoryPhotos,
  publishMemory,
  refreshMemoryVerification,
  renewFriendMemoryPhoto,
  sendMemoryVerificationEmail,
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

function timeLabel(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function FriendMemoryCard({
  item,
  onPhotoError,
}: {
  item: FriendMemory;
  onPhotoError: () => void;
}) {
  const photoRetry = useRef(false);
  const sharedTime = item.sharedAt ? timeLabel(item.sharedAt) : null;
  return (
    <View style={styles.entryCard}>
      {item.photoUrl && (
        <Image
          source={{ uri: item.photoUrl }}
          style={styles.entryPhoto}
          resizeMode="cover"
          accessibilityLabel={`Ảnh ký ức của ${item.ownerName}`}
          onError={() => {
            if (photoRetry.current) return;
            photoRetry.current = true;
            onPhotoError();
          }}
        />
      )}
      <View style={styles.entryBody}>
        <Text style={styles.friendName}>{item.ownerName}</Text>
        <Text style={styles.dateChipText}>
          {dayLabel(item.dateKey)}
          {sharedTime ? ` · Đã chia sẻ lúc ${sharedTime}` : ''}
        </Text>
        {!!item.text && <Text style={styles.entryText}>{item.text}</Text>}
      </View>
    </View>
  );
}

function OwnMemoryCard({
  item,
  shared,
  shareStateKnown,
  busy,
  onEdit,
  onDelete,
  onVisibility,
}: {
  item: MemoryEntry;
  shared: boolean;
  shareStateKnown: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onVisibility: () => void;
}) {
  const photoUri = memoryPhotoUri(item.ownerId, item.photoFileName);
  const verifying = !shareStateKnown && item.visibility === 'friends';
  const savedTime = timeLabel(item.createdAt);
  return (
    <View style={styles.entryCard}>
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
            <Feather name="calendar" size={13} color={colors.earth} />
            <Text style={styles.dateChipText}>
              {dayLabel(item.dateKey)}
              {savedTime ? ` · ${savedTime}` : ''}
            </Text>
          </View>
          <View style={styles.entryActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sửa ký ức ngày ${dayLabel(item.dateKey)}`}
              disabled={busy}
              onPress={onEdit}
              style={styles.entryAction}
            >
              <Feather name="edit-2" size={16} color={colors.earth} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Xóa ký ức ngày ${dayLabel(item.dateKey)}`}
              disabled={busy}
              onPress={onDelete}
              style={styles.entryAction}
            >
              <Feather name="trash-2" size={16} color={colors.danger} />
            </Pressable>
          </View>
        </View>
        {!!item.text && <Text style={styles.entryText}>{item.text}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Quyền xem: ${verifying ? 'Đang kiểm tra' : shared ? 'Bạn bè' : 'Chỉ mình tôi'}`}
          accessibilityHint="Mở chọn quyền xem ký ức"
          accessibilityState={{ disabled: busy || verifying }}
          disabled={busy || verifying}
          onPress={onVisibility}
          style={styles.entryVisibilityButton}
        >
          <Feather
            name={shareStateKnown && shared ? 'users' : 'lock'}
            size={14}
            color={colors.earth}
          />
          <Text style={styles.entryVisibilityText}>
            {verifying
              ? 'Đang kiểm tra quyền xem'
              : shared
                ? 'Bạn bè'
                : 'Chỉ mình tôi'}
          </Text>
          <Feather name="chevron-down" size={14} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

export function MemoryScreen() {
  const uid = useAuthStore((state) => state.user?.uid);
  const accountEmail = useAuthStore((state) => state.user?.email);
  const { name } = useProfile();
  const isFocused = useIsFocused();
  const [viewMode, setViewMode] = useState<'capture' | 'timeline'>('capture');
  const [timelineTab, setTimelineTab] = useState<'mine' | 'friends'>('mine');
  const [friendsVisible, setFriendsVisible] = useState(false);
  const [shareState, setShareState] = useState<MemoryShareState | null>(null);
  const [friendItems, setFriendItems] = useState<FriendMemory[]>([]);
  const [friendNextOffset, setFriendNextOffset] = useState<number | null>(null);
  const [loadingMoreFriends, setLoadingMoreFriends] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [emailVerificationNeeded, setEmailVerificationNeeded] = useState(false);
  const [items, setItems] = useState<MemoryEntry[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<MemoryEntry | null>(null);
  const [visibilityTarget, setVisibilityTarget] = useState<MemoryEntry | null>(
    null,
  );
  const [initialPhoto, setInitialPhoto] = useState<CapturedMemoryPhoto | null>(
    null,
  );
  const operationInFlight = useRef(false);
  const moreFriendsInFlight = useRef(false);
  const loadGeneration = useRef(0);
  const cloudGeneration = useRef(0);
  const migrationInFlight = useRef(false);

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
      setEmailVerificationNeeded(false);
      setShareState(null);
      setFriendItems([]);
      setFriendNextOffset(null);
      try {
        const state = await getMemoryShareState(accountId, displayName);
        if (
          generation === cloudGeneration.current &&
          useAuthStore.getState().user?.uid === accountId
        ) {
          setShareState(state);
          if (state.legacyIds.length && !migrationInFlight.current) {
            migrationInFlight.current = true;
            void migrateLegacyMemoryPhotos(
              accountId,
              displayName,
              state.legacyIds,
            )
              .then((failed) => {
                if (
                  failed > 0 &&
                  generation === cloudGeneration.current &&
                  useAuthStore.getState().user?.uid === accountId
                )
                  setCloudError(
                    'Một số ảnh chia sẻ cũ chưa chuyển được sang R2. Kéo xuống để thử lại.',
                  );
              })
              .catch(() => {
                if (
                  generation === cloudGeneration.current &&
                  useAuthStore.getState().user?.uid === accountId
                )
                  setCloudError(
                    'Chưa chuyển được ảnh cũ. Kéo xuống để thử lại.',
                  );
              })
              .finally(() => {
                migrationInFlight.current = false;
              });
          }
        }
        if (includeFeed) {
          const feed = await getFriendMemories(accountId, displayName);
          if (
            generation === cloudGeneration.current &&
            useAuthStore.getState().user?.uid === accountId
          ) {
            setFriendItems(feed.items);
            setFriendNextOffset(feed.nextOffset);
          }
        }
      } catch (cause) {
        if (
          generation === cloudGeneration.current &&
          useAuthStore.getState().user?.uid === accountId
        ) {
          setCloudError(
            (cause as Error).message || 'Chưa tải được phần chia sẻ.',
          );
          setEmailVerificationNeeded(memoryEmailVerificationNeeded(cause));
        }
      } finally {
        if (generation === cloudGeneration.current) setCloudLoading(false);
      }
    },
    [],
  );

  async function loadMoreFriends() {
    if (
      !uid ||
      friendNextOffset === null ||
      cloudLoading ||
      moreFriendsInFlight.current
    )
      return;
    const generation = cloudGeneration.current;
    moreFriendsInFlight.current = true;
    setLoadingMoreFriends(true);
    setCloudError(null);
    try {
      const page = await getFriendMemories(uid, name, friendNextOffset);
      if (
        generation === cloudGeneration.current &&
        useAuthStore.getState().user?.uid === uid
      ) {
        setFriendItems((previous) => {
          const seen = new Set(
            previous.map((item) => `${item.ownerId}:${item.id}`),
          );
          return [
            ...previous,
            ...page.items.filter(
              (item) => !seen.has(`${item.ownerId}:${item.id}`),
            ),
          ];
        });
        setFriendNextOffset(page.nextOffset);
      }
    } catch (cause) {
      if (generation === cloudGeneration.current)
        setCloudError((cause as Error).message || 'Chưa tải thêm ký ức.');
    } finally {
      moreFriendsInFlight.current = false;
      setLoadingMoreFriends(false);
    }
  }

  async function renewFriendPhoto(item: FriendMemory) {
    if (!uid) return;
    const generation = cloudGeneration.current;
    try {
      const photoUrl = await renewFriendMemoryPhoto(
        uid,
        name,
        item.ownerId,
        item.id,
      );
      if (
        generation === cloudGeneration.current &&
        useAuthStore.getState().user?.uid === uid
      )
        setFriendItems((previous) =>
          previous.map((entry) =>
            entry.ownerId === item.ownerId && entry.id === item.id
              ? { ...entry, photoUrl }
              : entry,
          ),
        );
    } catch {
      if (generation === cloudGeneration.current)
        setCloudError('Không tải lại được ảnh. Kéo xuống để thử lại.');
    }
  }

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
    setFriendNextOffset(null);
    setCloudError(null);
    setEmailVerificationNeeded(false);
    setTimelineTab('mine');
    setFriendsVisible(false);
    setLoadedUid(null);
    setEditorVisible(false);
    setEditing(null);
    setVisibilityTarget(null);
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
  const sections = useMemo(
    () => groups.map((group) => ({ title: group.month, data: group.entries })),
    [groups],
  );

  function openEditor(photo: CapturedMemoryPhoto) {
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
              await setMemoryVisibility(uid, saved.id, 'friends').catch(
                () => undefined,
              );
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
      setTimelineTab('mine');
      setViewMode('timeline');
    } finally {
      operationInFlight.current = false;
      setBusy(false);
    }
  }

  async function changeVisibility(
    item: MemoryEntry,
    nextVisibility: 'private' | 'friends',
  ) {
    if (!uid || operationInFlight.current) return;
    if ((isShared(item) ? 'friends' : 'private') === nextVisibility) {
      setVisibilityTarget(null);
      return;
    }
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
              await setMemoryVisibility(uid, item.id, 'friends').catch(
                () => undefined,
              );
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
      setVisibilityTarget(null);
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

  async function checkVerifiedEmail() {
    if (!uid) return;
    const verified = await refreshMemoryVerification(uid);
    if (!verified)
      throw new Error(
        'Email vẫn chưa được xác nhận. Nếu bạn vừa bấm liên kết trong thư, hãy đợi một chút rồi kiểm tra lại.',
      );
    await loadCloud(uid, name);
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

  const localErrorNotice = error ? (
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
  ) : null;

  const timelineHeader = (
    <View style={styles.timelineHeader}>
      {localErrorNotice}
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
            accessibilityLabel={'Xem ký ức ' + label}
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
      {timelineTab === 'friends' && !!cloudError && (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.errorText}>
            {cloudError}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              emailVerificationNeeded
                ? 'Mở Bạn bè để xác nhận email'
                : 'Thử kết nối chia sẻ'
            }
            onPress={() => {
              if (emailVerificationNeeded) setFriendsVisible(true);
              else if (uid) void loadCloud(uid, name);
            }}
          >
            <Text style={styles.retryText}>
              {emailVerificationNeeded ? 'Mở Bạn bè' : 'Thử lại'}
            </Text>
          </Pressable>
        </View>
      )}
      {timelineTab === 'mine' && (
        <View style={styles.timelineIntro}>
          <Text style={styles.timelineCount}>
            {accountItems.length} khoảnh khắc
          </Text>
          <Text style={styles.timelineHint}>
            Chỉ bạn chọn mục nào được chia sẻ
          </Text>
        </View>
      )}
    </View>
  );

  const timelineRefresh = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        if (!uid) return;
        void load(uid, true);
        void loadCloud(uid, name);
      }}
      tintColor={colors.earth}
    />
  );

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
              accessibilityState={{ disabled: !uid || busy }}
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
        scrollable={viewMode === 'capture'}
        contentStyle={
          viewMode === 'capture' ? styles.captureContent : undefined
        }
      >
        {viewMode === 'capture' ? (
          <>
            {localErrorNotice}
            <MemoryCapture
              active={isFocused && !editorVisible}
              onPhoto={(photo) => openEditor(photo)}
              onShowTimeline={() => setViewMode('timeline')}
              memoryCount={accountItems.length}
            />
          </>
        ) : timelineTab === 'friends' ? (
          <FlatList
            key="friends"
            style={styles.timelineList}
            contentContainerStyle={styles.timelineListContent}
            data={friendItems}
            keyExtractor={(item) => item.ownerId + ':' + item.id}
            renderItem={({ item }) => (
              <View style={styles.timelineItem}>
                <FriendMemoryCard
                  item={item}
                  onPhotoError={() => void renewFriendPhoto(item)}
                />
              </View>
            )}
            ListHeaderComponent={timelineHeader}
            ListEmptyComponent={
              cloudLoading && !shareState ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={colors.earth} />
                </View>
              ) : !cloudError ? (
                <View style={styles.emptyCard}>
                  <Feather name="users" size={28} color={colors.sky} />
                  <Text style={styles.emptyTitle}>Chưa có ký ức từ bạn bè</Text>
                  <Text style={styles.emptyDescription}>
                    Kết bạn bằng email để xem những khoảnh khắc họ chọn chia sẻ.
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              friendNextOffset !== null ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xem thêm ký ức của bạn bè"
                  disabled={loadingMoreFriends}
                  onPress={() => void loadMoreFriends()}
                  style={styles.viewTimelineButton}
                >
                  {loadingMoreFriends ? (
                    <ActivityIndicator color={colors.earth} />
                  ) : (
                    <Text style={styles.viewTimelineText}>Xem thêm</Text>
                  )}
                </Pressable>
              ) : null
            }
            refreshControl={timelineRefresh}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
          />
        ) : (
          <SectionList
            key="mine"
            style={styles.timelineList}
            contentContainerStyle={styles.timelineListContent}
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section }) => (
              <View style={[styles.monthHeader, styles.timelineSectionHeader]}>
                <View style={styles.monthDot} />
                <Text style={styles.monthTitle}>
                  {monthLabel(section.title)}
                </Text>
                <Text style={styles.monthCount}>{section.data.length}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View style={styles.timelineItem}>
                <OwnMemoryCard
                  item={item}
                  shared={isShared(item)}
                  shareStateKnown={!!shareState}
                  busy={busy}
                  onEdit={() => {
                    setEditing(item);
                    setEditorVisible(true);
                  }}
                  onDelete={() => confirmDelete(item)}
                  onVisibility={() => {
                    setError(null);
                    setVisibilityTarget(item);
                  }}
                />
              </View>
            )}
            ListHeaderComponent={timelineHeader}
            ListEmptyComponent={
              loading && !accountItems.length ? (
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
              ) : null
            }
            refreshControl={timelineRefresh}
            stickySectionHeadersEnabled={false}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
          />
        )}
      </Screen>
      <DialogModal
        visible={!!visibilityTarget}
        onRequestClose={busy ? undefined : () => setVisibilityTarget(null)}
        style={styles.visibilityDialog}
      >
        <View style={styles.visibilityPopupHeader}>
          <View style={styles.visibilityPopupHeading}>
            <Text
              accessibilityRole="header"
              style={styles.visibilityPopupTitle}
            >
              Ai có thể xem?
            </Text>
            <Text style={styles.visibilityPopupSubtitle}>
              Chọn người được xem khoảnh khắc này.
            </Text>
          </View>
          <DialogCloseButton
            accessibilityLabel="Đóng chọn quyền xem"
            onPress={() => setVisibilityTarget(null)}
            disabled={busy}
          />
        </View>
        <View style={styles.visibilityPopupOptions}>
          {(
            [
              ['private', 'lock', 'Chỉ mình tôi', 'Chỉ lưu trên thiết bị này'],
              [
                'friends',
                'users',
                'Bạn bè',
                'Bạn bè hiện tại và sau này có thể xem',
              ],
            ] as const
          ).map(([value, icon, label, description], index) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Chọn ${label}. ${description}`}
              accessibilityState={{
                selected: visibilityTarget
                  ? (isShared(visibilityTarget) ? 'friends' : 'private') ===
                    value
                  : false,
                disabled: busy,
              }}
              disabled={busy}
              onPress={() =>
                visibilityTarget &&
                void changeVisibility(visibilityTarget, value)
              }
              style={[
                styles.visibilityOption,
                index > 0 && styles.visibilityOptionDivider,
              ]}
            >
              <Feather name={icon} size={17} color={colors.earth} />
              <View style={styles.visibilityOptionCopy}>
                <Text style={styles.visibilityOptionText}>{label}</Text>
                <Text style={styles.visibilityOptionDescription}>
                  {description}
                </Text>
              </View>
              {visibilityTarget &&
                (isShared(visibilityTarget) ? 'friends' : 'private') ===
                  value && (
                  <Feather name="check" size={17} color={colors.success} />
                )}
            </Pressable>
          ))}
        </View>
        {!!error && (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {error}
          </Text>
        )}
      </DialogModal>
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
        accountEmail={accountEmail}
        loading={cloudLoading}
        error={cloudError}
        emailVerificationNeeded={emailVerificationNeeded}
        onClose={() => setFriendsVisible(false)}
        onRetry={() => uid && void loadCloud(uid, name)}
        onSendVerification={() => {
          if (!uid) throw new Error('Hãy đăng nhập lại.');
          return sendMemoryVerificationEmail(uid);
        }}
        onCheckVerification={checkVerifiedEmail}
        onInvite={inviteFriend}
        onChange={updateFriend}
        onCancel={cancelInvite}
      />
    </>
  );
}
