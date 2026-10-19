import {
  readMemoryFriendsPreference,
  writeMemoryFriendsPreference,
} from '../../services/memories/memoryFriendsPreference';
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
import { useScreenActive } from '../../hooks/useScreenActive';
import {
  cancelMemoryFriendInvite,
  changeMemoryFriend,
  getFriendMemories,
  getMemoryShareState,
  memoryEmailVerificationNeeded,
  migrateLegacyMemoryPhotos,
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
  synchronizeMemories,
  resolveMemorySyncConflict,
  type MemorySyncConflict,
  setMemoryVisibility,
  shareMemory,
  MemoryShareUnconfirmedError,
  updateMemory,
} from '../../services/memories/memoryStorage';
import { useAuthStore } from '../../store/authStore';
import { observeOwnMemories } from '../../services/memories/memoryCloud';
import { colors } from '../../theme';
import type { MemoryDraft, MemoryEntry } from '../../types/memory';
import { parseDateKey } from '../../utils/vietnameseCalendar';
import { MemoryEditor } from './MemoryEditor';
import { MemoryPhotoViewer, type MemoryViewerPhoto } from './MemoryPhotoViewer';
import { MemoryFriendsModal } from './MemoryFriendsModal';
import { MemoryCapture, type CapturedMemoryPhoto } from './MemoryCapture';
import { styles } from './MemoryScreen.styles';

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-');
  return `Tháng ${Number(month)} · ${year}`;
}

function dayLabel(dateKey: string, compact = false) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: compact ? 'short' : 'long',
    day: compact ? '2-digit' : 'numeric',
    month: compact ? '2-digit' : 'long',
  }).format(date);
}

function timeLabel(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function MemoryPhoto({
  uri,
  accessibilityLabel,
  onError,
  onOpen,
}: {
  uri: string;
  accessibilityLabel: string;
  onError?: () => void;
  onOpen: () => void;
}) {
  const [dimensions, setDimensions] = useState({ uri, aspectRatio: 3 / 4 });
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const aspectRatio = dimensions.uri === uri ? dimensions.aspectRatio : 3 / 4;
  return (
    <>
      <Pressable
        style={styles.photoFrame}
        accessibilityRole="button"
        accessibilityLabel={`Mở ${accessibilityLabel.toLocaleLowerCase('vi-VN')}`}
        onPress={onOpen}
      >
        <Image
          key={uri}
          source={{ uri }}
          style={[styles.entryPhoto, { aspectRatio }]}
          resizeMode="contain"
          accessibilityLabel={accessibilityLabel}
          onLoadStart={() => setLoadedUri(null)}
          onLoad={({ nativeEvent }) => {
            const { width, height } = nativeEvent.source;
            if (width > 0 && height > 0)
              setDimensions({ uri, aspectRatio: width / height });
            setLoadedUri(uri);
          }}
          onError={() => {
            setLoadedUri(uri);
            onError?.();
          }}
        />
        {loadedUri !== uri && (
          <View pointerEvents="none" style={styles.photoLoading}>
            <ActivityIndicator
              accessibilityLabel="Đang mở ảnh ký ức"
              color={colors.earth}
            />
          </View>
        )}
      </Pressable>
    </>
  );
}

function FriendMemoryCard({
  item,
  onPhotoError,
  onOpenPhoto,
}: {
  item: FriendMemory;
  onPhotoError: () => void;
  onOpenPhoto: () => void;
}) {
  const photoRetry = useRef(false);
  const sharedTime = item.sharedAt ? timeLabel(item.sharedAt) : null;
  return (
    <View style={styles.entryCard}>
      {item.photoUrl && (
        <MemoryPhoto
          uri={item.photoUrl}
          onOpen={onOpenPhoto}
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
  shareStateLoading,
  busy,
  onEdit,
  onDelete,
  onVisibility,
  onOpenPhoto,
}: {
  item: MemoryEntry;
  shared: boolean;
  shareStateKnown: boolean;
  shareStateLoading: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onVisibility: () => void;
  onOpenPhoto: () => void;
}) {
  const photoUri = memoryPhotoUri(item.ownerId, item.photoFileName);
  const unknown = !shareStateKnown;
  const verifying = unknown && shareStateLoading;
  const visibilityLabel = verifying
    ? 'Đang kiểm tra'
    : unknown
      ? 'Chưa xác định'
      : shared
        ? 'Bạn bè'
        : 'Chỉ mình tôi';
  const savedTime = timeLabel(item.createdAt);
  const deleteAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xóa ký ức ngày ${dayLabel(item.dateKey)}`}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onDelete}
      style={photoUri ? styles.photoDeleteAction : styles.entryAction}
    >
      <Feather name="trash-2" size={photoUri ? 18 : 16} color={colors.danger} />
    </Pressable>
  );
  return (
    <View style={styles.entryCard}>
      {photoUri && (
        <View style={styles.photoFrame}>
          <MemoryPhoto
            uri={photoUri}
            onOpen={onOpenPhoto}
            accessibilityLabel={`Ảnh ký ức ngày ${dayLabel(item.dateKey)}`}
          />
          {deleteAction}
        </View>
      )}
      <View style={styles.ownEntryBody}>
        <View style={styles.entryTopRow}>
          <View style={styles.dateChip}>
            <Feather name="calendar" size={12} color={colors.earth} />
            <Text
              accessibilityLabel={`${dayLabel(item.dateKey)}${savedTime ? ` · ${savedTime}` : ''}`}
              style={styles.ownDateText}
            >
              {dayLabel(item.dateKey, true)}
              {savedTime ? ` · ${savedTime}` : ''}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Quyền xem: ${visibilityLabel}`}
            accessibilityHint={
              unknown
                ? 'Kiểm tra lại trạng thái chia sẻ'
                : 'Mở chọn quyền xem ký ức'
            }
            accessibilityState={{
              disabled: busy || verifying,
              busy: verifying,
            }}
            disabled={busy || verifying}
            onPress={onVisibility}
            style={styles.entryVisibilityTarget}
          >
            <View style={styles.entryVisibilityButton}>
              {verifying ? (
                <ActivityIndicator size="small" color={colors.earth} />
              ) : (
                <Feather
                  name={unknown ? 'refresh-cw' : shared ? 'users' : 'lock'}
                  size={12}
                  color={colors.earth}
                />
              )}
              <Text style={styles.entryVisibilityText}>
                {verifying ? 'Đang kiểm tra…' : visibilityLabel}
              </Text>
              {!unknown && (
                <Feather name="chevron-down" size={12} color={colors.muted} />
              )}
            </View>
          </Pressable>
        </View>
        <View style={styles.entryBottomRow}>
          {!!item.text && (
            <Text style={[styles.entryText, styles.ownEntryText]}>
              {item.text}
            </Text>
          )}
          <View style={styles.entryActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sửa ký ức ngày ${dayLabel(item.dateKey)}`}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={onEdit}
              style={styles.entryAction}
            >
              <Feather name="edit-2" size={16} color={colors.earth} />
            </Pressable>
            {!photoUri && deleteAction}
          </View>
        </View>
      </View>
    </View>
  );
}

export function MemoryScreen() {
  const uid = useAuthStore((state) => state.user?.uid);
  const accountEmail = useAuthStore((state) => state.user?.email);
  const { name } = useProfile();
  const isFocused = useIsFocused();
  const screenActive = useScreenActive();
  const [viewMode, setViewMode] = useState<'capture' | 'timeline'>('capture');
  const [gallery, setGallery] = useState<{
    photos: MemoryViewerPhoto[];
    initialIndex: number;
  } | null>(null);
  const closeGallery = useCallback(() => setGallery(null), []);
  const [timelineTab, setTimelineTab] = useState<'mine' | 'friends'>('mine');
  const [capturePending, setCapturePending] = useState(false);
  const [friendsVisible, setFriendsVisible] = useState(false);
  const [shareState, setShareState] = useState<MemoryShareState | null>(null);
  const [friendItems, setFriendItems] = useState<FriendMemory[]>([]);
  const [friendFeedUid, setFriendFeedUid] = useState<string | null>(null);
  const friendFeedScope = useRef<{ uid: string; friendsKey: string } | null>(
    null,
  );
  const [friendNextOffset, setFriendNextOffset] = useState<number | null>(null);
  const [loadingMoreFriends, setLoadingMoreFriends] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [emailVerificationNeeded, setEmailVerificationNeeded] = useState(false);
  const [items, setItems] = useState<MemoryEntry[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownSynced, setOwnSynced] = useState(false);
  const [ownSyncWarning, setOwnSyncWarning] = useState<string | null>(null);
  const [ownConflict, setOwnConflict] = useState<MemorySyncConflict | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishWarning, setPublishWarning] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<MemoryEntry | null>(null);
  const [visibilityTarget, setVisibilityTarget] = useState<MemoryEntry | null>(
    null,
  );
  const [initialPhoto, setInitialPhoto] = useState<CapturedMemoryPhoto | null>(
    null,
  );
  const [visibilityPending, setVisibilityPending] = useState<
    'private' | 'friends' | null
  >(null);
  const ownLoad = useRef<{
    uid: string;
    again: boolean;
    promise: Promise<void>;
  } | null>(null);
  const operationInFlight = useRef(false);
  const moreFriendsInFlight = useRef(false);
  const loadGeneration = useRef(0);
  const cloudGeneration = useRef(0);
  const cloudRequest = useRef<{
    uid: string;
    includeFeed: boolean;
    generation: number;
  } | null>(null);
  const migrationInFlight = useRef(false);
  const chooseInitialTimelineTab = useRef(false);
  const friendsPreferenceVersion = useRef(0);
  const friendsPreference = useRef<{ uid: string; hasFriends: boolean } | null>(
    null,
  );

  const load = useCallback(
    (accountId: string, refresh = false): Promise<void> => {
      if (ownLoad.current?.uid === accountId) {
        ownLoad.current.again = true;
        if (refresh) setRefreshing(true);
        return ownLoad.current.promise;
      }
      const request = {
        uid: accountId,
        again: false,
        promise: Promise.resolve(),
      };
      ownLoad.current = request;
      request.promise = (async () => {
        let generation = loadGeneration.current;
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setOwnSynced(false);
        setError(null);
        try {
          do {
            request.again = false;
            generation = ++loadGeneration.current;
            const saved = await readMemories(accountId);
            if (
              generation === loadGeneration.current &&
              useAuthStore.getState().user?.uid === accountId
            ) {
              setItems(saved);
              setLoadedUid(accountId);
            }
            const result = await synchronizeMemories(accountId);
            if (
              generation === loadGeneration.current &&
              useAuthStore.getState().user?.uid === accountId
            ) {
              setItems(result.entries);
              setOwnSynced(result.synced);
              setOwnSyncWarning(result.warning ?? null);
              setOwnConflict(result.conflict ?? null);
            }
          } while (
            request.again &&
            ownLoad.current === request &&
            useAuthStore.getState().user?.uid === accountId
          );
        } catch (cause) {
          if (
            generation === loadGeneration.current &&
            useAuthStore.getState().user?.uid === accountId
          )
            setError((cause as Error).message || 'Chưa đọc được dòng ký ức.');
        } finally {
          if (ownLoad.current === request) ownLoad.current = null;
          if (generation === loadGeneration.current) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      })();
      return request.promise;
    },
    [],
  );

  const loadCloud = useCallback(
    async (
      accountId: string,
      displayName: string,
      includeFeed = false,
      keepVerifiedState = false,
    ) => {
      const generation = ++cloudGeneration.current;
      cloudRequest.current = { uid: accountId, includeFeed, generation };
      let stateReceived = false;
      setCloudLoading(true);
      setCloudError(null);
      setEmailVerificationNeeded(false);
      if (!keepVerifiedState) setShareState(null);
      if (includeFeed) {
        friendFeedScope.current = null;
        setFriendItems([]);
        setFriendFeedUid(null);
        setFriendNextOffset(null);
      }
      try {
        const state = await getMemoryShareState(accountId, displayName);
        const friendsKey = JSON.stringify(
          [...new Set(state.friends.map(({ uid }) => uid))].sort(),
        );
        stateReceived = true;
        if (
          generation === cloudGeneration.current &&
          useAuthStore.getState().user?.uid === accountId
        ) {
          const scope = friendFeedScope.current;
          if (scope?.uid === accountId && scope.friendsKey !== friendsKey) {
            friendFeedScope.current = null;
            setFriendItems([]);
            setFriendFeedUid(null);
            setFriendNextOffset(null);
          }
          setShareState(state);
          friendsPreferenceVersion.current += 1;
          friendsPreference.current = {
            uid: accountId,
            hasFriends: state.friends.length > 0,
          };
          void writeMemoryFriendsPreference(
            accountId,
            state.friends.length > 0,
          ).catch(() => undefined);
          if (chooseInitialTimelineTab.current) {
            chooseInitialTimelineTab.current = false;
            setTimelineTab(state.friends.length > 0 ? 'friends' : 'mine');
          }
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
        if (
          includeFeed &&
          generation === cloudGeneration.current &&
          useAuthStore.getState().user?.uid === accountId
        ) {
          const feed = await getFriendMemories(accountId, displayName);
          if (
            generation === cloudGeneration.current &&
            useAuthStore.getState().user?.uid === accountId
          ) {
            friendFeedScope.current = { uid: accountId, friendsKey };
            setFriendItems(feed.items);
            setFriendNextOffset(feed.nextOffset);
            setFriendFeedUid(accountId);
          }
        }
      } catch (cause) {
        if (
          generation === cloudGeneration.current &&
          useAuthStore.getState().user?.uid === accountId
        ) {
          chooseInitialTimelineTab.current = false;
          if (!stateReceived) setShareState(null);
          setCloudError(
            (cause as Error).message || 'Chưa tải được phần chia sẻ.',
          );
          setEmailVerificationNeeded(memoryEmailVerificationNeeded(cause));
        }
      } finally {
        if (cloudRequest.current?.generation === generation)
          cloudRequest.current = null;
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
    if (!uid || useAuthStore.getState().user?.uid !== uid) return null;
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
      return generation === cloudGeneration.current &&
        useAuthStore.getState().user?.uid === uid
        ? photoUrl
        : null;
    } catch {
      if (generation === cloudGeneration.current)
        setCloudError('Không tải lại được ảnh. Kéo xuống để thử lại.');
      return null;
    }
  }

  useEffect(() => {
    chooseInitialTimelineTab.current = false;
    if (isFocused) setViewMode('capture');
  }, [isFocused]);

  useEffect(() => {
    if (isFocused && screenActive && uid) {
      // A completed feed, including an empty one, survives tab navigation.
      if (
        viewMode === 'timeline' &&
        timelineTab === 'friends' &&
        (friendFeedUid === uid ||
          (cloudRequest.current?.uid === uid &&
            cloudRequest.current.includeFeed &&
            cloudRequest.current.generation === cloudGeneration.current))
      )
        return;
      void loadCloud(
        uid,
        name,
        viewMode === 'timeline' && timelineTab === 'friends',
        true,
      );
    }
  }, [
    isFocused,
    screenActive,
    uid,
    viewMode,
    timelineTab,
    friendFeedUid,
    loadCloud,
    name,
  ]);

  useEffect(() => {
    setGallery(null);
    setError(null);
    setPublishWarning(null);
    setItems([]);
    setOwnSynced(false);
    setOwnSyncWarning(null);
    setOwnConflict(null);
    setShareState(null);
    friendFeedScope.current = null;
    setFriendItems([]);
    setFriendFeedUid(null);
    setFriendNextOffset(null);
    setCloudError(null);
    setEmailVerificationNeeded(false);
    chooseInitialTimelineTab.current = false;
    setTimelineTab('mine');
    setFriendsVisible(false);
    setLoadedUid(null);
    setEditorVisible(false);
    setEditing(null);
    setVisibilityTarget(null);
    setVisibilityPending(null);
    setInitialPhoto(null);
    // Opening the camera only needs the local cache. A full cloud sync holds
    // the same storage queue as createMemory and used to stall the first save.
    const generation = ++loadGeneration.current;
    if (uid) {
      setLoading(true);
      void readMemories(uid)
        .then((saved) => {
          if (
            generation !== loadGeneration.current ||
            useAuthStore.getState().user?.uid !== uid
          )
            return;
          setItems(saved);
          setLoadedUid(uid);
        })
        .catch((cause) => {
          if (
            generation === loadGeneration.current &&
            useAuthStore.getState().user?.uid === uid
          )
            setError((cause as Error).message || 'Chưa đọc được dòng ký ức.');
        })
        .finally(() => {
          if (generation === loadGeneration.current) setLoading(false);
        });
    } else setLoading(false);
    return () => {
      loadGeneration.current += 1;
      ownLoad.current = null;
      cloudGeneration.current += 1;
    };
  }, [uid, load]);

  useEffect(() => {
    if (!uid) return;
    let current = true;
    const version = friendsPreferenceVersion.current;
    void readMemoryFriendsPreference(uid)
      .then((hasFriends) => {
        if (
          !current ||
          useAuthStore.getState().user?.uid !== uid ||
          version !== friendsPreferenceVersion.current ||
          hasFriends === null
        )
          return;
        friendsPreference.current = { uid, hasFriends };
        if (chooseInitialTimelineTab.current) {
          chooseInitialTimelineTab.current = false;
          setTimelineTab(hasFriends ? 'friends' : 'mine');
        }
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || !screenActive || !isFocused || viewMode !== 'timeline') return;
    void load(uid, true);
    return observeOwnMemories(uid, () => {
      void load(uid, true);
    });
  }, [uid, screenActive, isFocused, viewMode, load]);

  function chooseOwnVersion() {
    if (!uid || !ownConflict) return;
    const accountId = uid;
    const conflict = ownConflict;
    const describe = (item: MemoryEntry | null, deleted: boolean) =>
      deleted
        ? 'Đã xóa'
        : item
          ? `${item.dateKey} · ${item.text.slice(0, 120) || 'Ảnh ký ức'}`
          : 'Chưa có bản cloud';
    const apply = async (choice: 'local' | 'cloud') => {
      try {
        await resolveMemorySyncConflict(accountId, conflict, choice);
        await load(accountId, true);
      } catch (cause) {
        if (useAuthStore.getState().user?.uid === accountId) {
          setOwnSyncWarning((cause as Error).message);
          void load(accountId, true);
        }
      }
    };
    Alert.alert(
      'Chọn bản ký ức cần giữ',
      `Trên máy: ${describe(conflict.local, !!conflict.local.deletedAt)}\n\nTrên cloud: ${describe(conflict.remote, conflict.remoteDeleted)}`,
      [
        { text: 'Để sau', style: 'cancel' },
        ...(conflict.remote || conflict.remoteDeleted
          ? [{ text: 'Dùng bản cloud', onPress: () => void apply('cloud') }]
          : []),
        { text: 'Giữ bản trên máy', onPress: () => void apply('local') },
      ],
    );
  }

  const accountItems = useMemo(
    () => (loadedUid === uid ? items : []),
    [items, loadedUid, uid],
  );
  function openPhotoGallery(tab: 'mine' | 'friends', id: string) {
    const photos: MemoryViewerPhoto[] =
      tab === 'mine'
        ? accountItems.flatMap((item) => {
            const uri = memoryPhotoUri(item.ownerId, item.photoFileName);
            return uri
              ? [
                  {
                    id: item.id,
                    uri,
                    text: item.text,
                    label: `Ảnh ký ức ngày ${dayLabel(item.dateKey)}`,
                  },
                ]
              : [];
          })
        : friendItems.flatMap((item) =>
            item.photoUrl
              ? [
                  {
                    id: `${item.ownerId}:${item.id}`,
                    uri: item.photoUrl,
                    text: item.text,
                    label: `Ảnh ký ức của ${item.ownerName}`,
                    renew: () => renewFriendPhoto(item),
                  },
                ]
              : [],
          );
    const initialIndex = photos.findIndex((photo) => photo.id === id);
    if (initialIndex >= 0) setGallery({ photos, initialIndex });
  }
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

  function showTimeline() {
    const preference = friendsPreference.current;
    const cached =
      preference && preference.uid === uid ? preference.hasFriends : null;
    chooseInitialTimelineTab.current = !shareState && cached === null;
    setTimelineTab(
      (shareState ? shareState.friends.length > 0 : cached)
        ? 'friends'
        : 'mine',
    );
    setRefreshing(true);
    setViewMode('timeline');
  }

  function openEditor(photo: CapturedMemoryPhoto) {
    setPublishWarning(null);
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
    setPublishWarning(null);
    try {
      let saved: MemoryEntry;
      let publishError: string | null = null;
      if (editing) {
        // Revoke using the server owner/ID even when another device changed sharing.
        // Persist private edits only after successful access reduction.
        saved = await updateMemory(uid, editing.id, draft, editing);
      } else saved = await createMemory(uid, draft);
      if (draft.visibility === 'friends') {
        try {
          saved = await shareMemory(uid, name, saved);
        } catch (cause) {
          if (cause instanceof MemoryShareUnconfirmedError) {
            if (useAuthStore.getState().user?.uid === uid)
              setEditing(cause.entry);
            throw cause;
          }
          publishError = `Đã lưu riêng trên máy. ${(cause as Error).message || 'Chưa chia sẻ được.'}`;
        }
      }
      if (useAuthStore.getState().user?.uid !== uid) return;
      // Local commit is complete. Never hold the editor open for backup uploads
      // or a full timeline refresh; keep those in the existing coalesced loader.
      loadGeneration.current += 1;
      setItems((previous) =>
        [saved, ...previous.filter((entry) => entry.id !== saved.id)].sort(
          (a, b) =>
            b.dateKey.localeCompare(a.dateKey) ||
            b.createdAt - a.createdAt ||
            b.id.localeCompare(a.id),
        ),
      );
      setLoadedUid(uid);
      setOwnSynced(false);
      void load(uid, true);
      // A confirmed content edit already knows the final visibility. Preserve
      // that badge while refreshing; brand-new/unknown items still need state.
      cloudGeneration.current += 1;
      if (editing) {
        setShareState((known) =>
          known
            ? {
                ...known,
                sharedIds: [
                  ...known.sharedIds.filter((id) => id !== saved.id),
                  ...(saved.visibility === 'friends' ? [saved.id] : []),
                ],
              }
            : null,
        );
      } else setShareState(null);
      setCloudLoading(false);
      setPublishWarning(publishError);
      if (viewMode === 'timeline')
        void loadCloud(uid, name, timelineTab === 'friends', !!editing);
      setTimelineTab('mine');
      setViewMode('timeline');
    } catch (cause) {
      if (useAuthStore.getState().user?.uid === uid)
        void loadCloud(uid, name, timelineTab === 'friends');
      throw cause;
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
    if (nextVisibility === 'friends' && shareState && isShared(item)) {
      setVisibilityTarget(null);
      return;
    }
    if (!shareState && nextVisibility === 'friends') {
      setError('Hãy kết nối để kiểm tra quyền xem trước khi đổi ký ức này.');
      return;
    }
    operationInFlight.current = true;
    setBusy(true);
    setVisibilityPending(nextVisibility);
    setError(null);
    setPublishWarning(null);
    // Earlier state reads must not overwrite the confirmed action below.
    cloudGeneration.current += 1;
    setCloudLoading(false);
    try {
      if (nextVisibility === 'private') {
        await unshareMemory(uid, name, item.id);
        if (useAuthStore.getState().user?.uid !== uid) return;
        await setMemoryVisibility(uid, item.id, 'private');
      } else {
        await shareMemory(uid, name, item);
      }
      const saved = await readMemories(uid);
      if (useAuthStore.getState().user?.uid !== uid) return;
      cloudGeneration.current += 1;
      setCloudLoading(false);
      setItems(saved);
      setLoadedUid(uid);
      setOwnSynced(false);
      setShareState((current) => {
        const state = current ?? shareState;
        return state
          ? {
              ...state,
              sharedIds:
                nextVisibility === 'friends'
                  ? [...new Set([...state.sharedIds, item.id])]
                  : state.sharedIds.filter((id) => id !== item.id),
            }
          : null;
      });
      setVisibilityTarget(null);
      if (!shareState) void loadCloud(uid, name, false);
      void load(uid, true);
    } catch (cause) {
      if (useAuthStore.getState().user?.uid === uid) {
        setError((cause as Error).message || 'Chưa đổi được quyền xem.');
        void loadCloud(uid, name, false);
      }
    } finally {
      operationInFlight.current = false;
      setBusy(false);
      setVisibilityPending(null);
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
      await loadCloud(uid, name, timelineTab === 'friends');
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
      await loadCloud(uid, name, timelineTab === 'friends');
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
      await loadCloud(uid, name, timelineTab === 'friends');
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
    await loadCloud(uid, name, timelineTab === 'friends');
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
              await deleteMemory(uid, item.id, item);
            })()
              .then(() => {
                if (useAuthStore.getState().user?.uid === uid) {
                  void loadCloud(uid, name, timelineTab === 'friends');
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

  const localErrorNotice =
    error || publishWarning ? (
      <View style={styles.errorBox}>
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error ?? publishWarning}
        </Text>
        {uid && error && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tải lại ký ức"
            onPress={() => {
              void load(uid);
              if (viewMode === 'timeline')
                void loadCloud(uid, name, timelineTab === 'friends');
            }}
          >
            <Text style={styles.retryText}>Tải lại</Text>
          </Pressable>
        )}
      </View>
    ) : null;

  const timelineTabs = (
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
          onPress={() => {
            chooseInitialTimelineTab.current = false;
            setTimelineTab(value);
          }}
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
  );

  const friendFeedLoading =
    !!uid && friendFeedUid !== uid && (cloudLoading || !cloudError);

  const timelineHeader = (
    <View style={styles.timelineHeader}>
      {localErrorNotice}
      <View style={styles.timelineSummaryRow}>
        {timelineTab === 'friends' && (
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
        )}
        {timelineTab === 'mine' && (
          <View style={styles.syncStatus}>
            {(loading || refreshing) && (
              <ActivityIndicator
                accessibilityLabel="Đang đồng bộ ký ức"
                size="small"
                color={colors.earth}
              />
            )}
            <Text accessibilityLiveRegion="polite" style={styles.mutedText}>
              {loading || refreshing
                ? 'Đang đồng bộ ký ức…'
                : ownSynced
                  ? 'Đã đồng bộ theo tài khoản'
                  : 'Bản trên máy · chưa đồng bộ đầy đủ'}
            </Text>
          </View>
        )}
      </View>
      {timelineTab === 'friends' && friendFeedLoading && (
        <View style={styles.friendFeedLoading}>
          <ActivityIndicator
            accessibilityLabel="Đang tải ký ức bạn bè"
            size="large"
            color={colors.earth}
          />
        </View>
      )}
      {timelineTab === 'mine' &&
        ((emailVerificationNeeded && !shareState && !cloudLoading) ||
          !!ownSyncWarning ||
          !!ownConflict) && (
          <View style={styles.timelineIntro}>
            {emailVerificationNeeded && !shareState && !cloudLoading && (
              <Text style={styles.mutedText}>
                Chưa xác định quyền chia sẻ. Mở Bạn bè để kiểm tra tài khoản.
              </Text>
            )}
            {!!ownSyncWarning && (
              <Text style={styles.errorText}>{ownSyncWarning}</Text>
            )}
            {!!ownConflict && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chọn bản ký ức cần giữ"
                onPress={chooseOwnVersion}
              >
                <Text style={styles.retryText}>Chọn bản cần giữ</Text>
              </Pressable>
            )}
          </View>
        )}
      {!!cloudError &&
        (timelineTab === 'friends' || !emailVerificationNeeded) && (
          <View style={styles.errorBox}>
            <Text accessibilityRole="alert" style={styles.errorText}>
              {cloudError}
            </Text>
            {emailVerificationNeeded && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tôi đã xác nhận email"
                onPress={() => {
                  if (uid) void loadCloud(uid, name, timelineTab === 'friends');
                }}
              >
                <Text style={styles.retryText}>Tôi đã xác nhận</Text>
              </Pressable>
            )}
          </View>
        )}
    </View>
  );

  const timelineRefresh = (
    <RefreshControl
      refreshing={timelineTab === 'mine' && refreshing}
      onRefresh={() => {
        if (!uid) return;
        void load(uid, true);
        void loadCloud(uid, name, timelineTab === 'friends', true);
      }}
      tintColor={timelineTab === 'friends' ? 'transparent' : colors.earth}
      colors={timelineTab === 'friends' ? ['transparent'] : [colors.earth]}
      progressBackgroundColor={
        timelineTab === 'friends' ? 'transparent' : undefined
      }
    />
  );

  return (
    <>
      <Screen
        overlay={
          capturePending && (
            <View style={styles.captureProcessing} accessibilityViewIsModal>
              <ActivityIndicator size="large" color={colors.earth} />
              <Text accessibilityRole="header" style={styles.captureTitle}>
                Đang chuẩn bị ảnh…
              </Text>
              <Text
                accessibilityLiveRegion="polite"
                style={styles.cameraFallbackText}
              >
                Sẽ mở phần viết nội dung ngay khi ảnh sẵn sàng.
              </Text>
            </View>
          )
        }
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
              accessibilityState={{ disabled: !uid || busy || capturePending }}
              disabled={!uid || busy || capturePending}
              onPress={() => {
                if (viewMode === 'capture') showTimeline();
                else {
                  chooseInitialTimelineTab.current = false;
                  setViewMode('capture');
                }
              }}
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
        fixedContent={viewMode === 'timeline' ? timelineTabs : undefined}
        fixedContentStyle={styles.timelineTabsContainer}
        scrollable={false}
        contentStyle={
          viewMode === 'capture' ? styles.captureContent : undefined
        }
      >
        {viewMode === 'capture' ? (
          <>
            {localErrorNotice}
            <MemoryCapture
              active={screenActive && !editorVisible}
              onPhoto={(photo) => openEditor(photo)}
              onCapturingChange={setCapturePending}
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
                  onOpenPhoto={() =>
                    openPhotoGallery('friends', `${item.ownerId}:${item.id}`)
                  }
                />
              </View>
            )}
            ListHeaderComponent={timelineHeader}
            ListEmptyComponent={
              friendFeedUid === uid && !friendFeedLoading && !cloudError ? (
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
                  onOpenPhoto={() => openPhotoGallery('mine', item.id)}
                  shared={isShared(item)}
                  shareStateKnown={!!shareState}
                  shareStateLoading={cloudLoading}
                  busy={busy}
                  onEdit={() => {
                    setEditing(item);
                    setEditorVisible(true);
                  }}
                  onDelete={() => confirmDelete(item)}
                  onVisibility={() => {
                    if (!shareState) {
                      if (emailVerificationNeeded) setTimelineTab('friends');
                      else if (uid) void loadCloud(uid, name, false);
                      return;
                    }
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
      {gallery && (
        <MemoryPhotoViewer
          photos={gallery.photos}
          initialIndex={gallery.initialIndex}
          onClose={closeGallery}
        />
      )}
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
              [
                'private',
                'lock',
                'Chỉ mình tôi',
                'Chỉ bạn xem, đồng bộ theo tài khoản',
              ],
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
                busy: busy && visibilityPending === value,
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
              {busy && visibilityPending === value ? (
                <ActivityIndicator
                  accessibilityLabel={
                    value === 'friends'
                      ? 'Đang chia sẻ ký ức'
                      : 'Đang chuyển ký ức về riêng tư'
                  }
                  size="small"
                  color={colors.earth}
                />
              ) : (
                <Feather name={icon} size={17} color={colors.earth} />
              )}
              <View style={styles.visibilityOptionCopy}>
                <Text style={styles.visibilityOptionText}>{label}</Text>
                <Text style={styles.visibilityOptionDescription}>
                  {busy && visibilityPending === value
                    ? value === 'friends'
                      ? 'Đang chuẩn bị và chia sẻ ảnh…'
                      : 'Đang cập nhật quyền xem…'
                    : description}
                </Text>
              </View>
              {!busy &&
                visibilityTarget &&
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
            !editing || isShared(editing) ? 'friends' : 'private'
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
        onRetry={() =>
          uid && void loadCloud(uid, name, timelineTab === 'friends')
        }
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
