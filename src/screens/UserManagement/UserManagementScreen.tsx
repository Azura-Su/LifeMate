import { ManagedUserAvatar } from './ManagedUserAvatar';
import Feather from '@expo/vector-icons/Feather';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { Screen } from '../../components/Screen';
import type { MainTabParams } from '../../navigation/types';
import {
  isUserAdmin,
  manageUsers,
  type CleanupJob,
  type ManagedUser,
} from '../../services/admin/userManagement';
import { useAuthStore } from '../../store/authStore';
import { colors, typography } from '../../theme';

const date = (value: number | null) =>
  value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
const status = (user: ManagedUser) =>
  user.phase === 'blocking'
    ? 'Đang áp dụng'
    : {
        active: 'Đang hoạt động',
        disabled: 'Đã khóa',
        deleting: 'Đang xóa dữ liệu',
        deleted: 'Đã xóa',
      }[user.status];

export function UserManagementScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'UserManagement'>) {
  const session = useAuthStore((state) => state.user);
  const allowed = isUserAdmin(session);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [jobs, setJobs] = useState<CleanupJob[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<string | null>(null);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openingUid, setOpeningUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  const run = useCallback(
    async (
      operation: (signal: AbortSignal) => Promise<void>,
      opening: string | null = null,
    ) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setOpeningUid(opening);
      setError(null);
      const controller = new AbortController();
      request.current = controller;
      try {
        await operation(controller.signal);
      } catch (cause) {
        if (mounted.current && !controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Chưa kết nối được máy chủ.',
          );
      } finally {
        busyRef.current = false;
        if (mounted.current) {
          setBusy(false);
          setOpeningUid(null);
        }
      }
    },
    [],
  );
  const load = useCallback(
    (search = '', next?: string) =>
      run(async (signal) => {
        const result = await manageUsers(
          search.trim()
            ? { action: 'search', query: search.trim() }
            : { action: 'list', ...(next ? { pageToken: next } : {}) },
          signal,
        );
        const pending = await manageUsers({ action: 'jobs' }, signal);
        if (signal.aborted || !mounted.current) return;
        setUsers((old) =>
          next
            ? [...old, ...(result.users ?? [])].filter(
                (u, i, all) => all.findIndex((v) => v.uid === u.uid) === i,
              )
            : (result.users ?? []),
        );
        setPage(result.nextPageToken ?? null);
        setJobs(pending.jobs ?? []);
      }),
    [run],
  );
  useEffect(() => {
    if (!allowed) {
      request.current?.abort();
      setUsers([]);
      setSuccess(null);
      setSelected(null);
      setJobs([]);
      return;
    }
    void load();
  }, [allowed, load]);
  const choose = (user: ManagedUser) =>
    void run(async (signal) => {
      setSuccess(null);
      const result = await manageUsers(
        { action: 'detail', uid: user.uid },
        signal,
      );
      if (!signal.aborted && mounted.current) {
        setSelected(result.user ?? null);
        setDeleting(false);
        setEmail('');
      }
    }, user.uid);
  const mutate = (action: 'disable' | 'enable' | 'delete') => {
    if (!selected) return;
    const target = selected;
    void run(async (signal) => {
      const result = await manageUsers(
        { action, uid: target.uid, ...(action === 'delete' ? { email } : {}) },
        signal,
      );
      if (signal.aborted || !mounted.current) return;
      if (action === 'delete') {
        setSelected(null);
        setDeleting(false);
        setEmail('');
        setSuccess(
          result.user?.status === 'deleted'
            ? 'Đã xóa tài khoản thành công.'
            : result.user?.authDeleted
              ? 'Đã xóa tài khoản đăng nhập. Hệ thống đang dọn dữ liệu còn lại.'
              : 'Đã tiếp nhận yêu cầu xóa. Hệ thống đang xử lý.',
        );
        if (result.user)
          setUsers((old) =>
            old.map((u) => (u.uid === target.uid ? result.user! : u)),
          );
        try {
          const refreshed = await manageUsers(
            query.trim()
              ? { action: 'search', query: query.trim() }
              : { action: 'list' },
            signal,
          );
          if (signal.aborted || !mounted.current) return;
          setUsers(refreshed.users ?? []);
          setPage(refreshed.nextPageToken ?? null);
          const pending = await manageUsers({ action: 'jobs' }, signal);
          if (!signal.aborted && mounted.current) setJobs(pending.jobs ?? []);
        } catch {
          if (!signal.aborted && mounted.current)
            setError('Chưa tải lại được danh sách. Kéo xuống để thử lại.');
        }
        return;
      }
      if (result.user) {
        setSelected(result.user);
        setUsers((old) =>
          old.map((u) => (u.uid === target.uid ? result.user! : u)),
        );
      }
      setDeleting(false);
      setEmail('');
      const pending = await manageUsers({ action: 'jobs' }, signal);
      if (!signal.aborted && mounted.current) setJobs(pending.jobs ?? []);
    });
  };
  const close = () => {
    if (!busyRef.current) {
      setSelected(null);
      setDeleting(false);
      setEmail('');
      setError(null);
    }
  };
  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại Home"
        onPress={() => navigation.navigate('Home')}
        style={styles.icon}
      >
        <Feather name="arrow-left" size={22} color={colors.earth} />
      </Pressable>
      <View style={styles.flex}>
        <Text style={typography.heading}>Quản lý người dùng</Text>
        <Text style={typography.small}>Tài khoản & quyền truy cập</Text>
      </View>
    </View>
  );
  if (!allowed)
    return (
      <Screen fixedHeader={header}>
        <Text>Bạn không có quyền truy cập màn hình này.</Text>
      </Screen>
    );
  return (
    <Screen
      fixedHeader={header}
      fixedContent={
        <View style={styles.search}>
          <Feather name="search" size={18} color={colors.muted} />
          <TextInput
            accessibilityLabel="Tìm email hoặc UID"
            placeholder="Email đầy đủ hoặc UID"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => void load(query)}
            style={styles.flex}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tìm người dùng"
            disabled={busy}
            onPress={() => void load(query)}
            style={styles.icon}
          >
            <Feather name="arrow-right" size={20} color={colors.earth} />
          </Pressable>
        </View>
      }
      contentStyle={{ gap: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            if (busyRef.current) return;
            setRefreshing(true);
            void load(query).finally(() => {
              if (mounted.current) setRefreshing(false);
            });
          }}
          tintColor={colors.earth}
          colors={[colors.earth]}
        />
      }
    >
      <View style={styles.row}>
        <Text style={styles.section}>NGƯỜI DÙNG · {users.length}</Text>
      </View>
      {success && !selected && (
        <View style={styles.successNotice}>
          <Feather name="check-circle" size={16} color={colors.success} />
          <Text accessibilityRole="alert" style={styles.successText}>
            {success}
          </Text>
        </View>
      )}
      {error && !selected && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!busy && !users.length && !error && (
        <Text style={typography.small}>Không tìm thấy tài khoản.</Text>
      )}
      {users.map((user) => (
        <Pressable
          key={user.uid}
          accessibilityRole="button"
          accessibilityLabel={`Chi tiết ${user.email}`}
          accessibilityState={{ disabled: busy, busy: openingUid === user.uid }}
          disabled={busy}
          onPress={() => choose(user)}
          style={({ pressed }) => [
            styles.userCard,
            pressed && styles.userCardPressed,
          ]}
        >
          <ManagedUserAvatar
            uid={user.uid}
            url={user.avatarUrl}
            name={user.name}
          />
          <View style={styles.userCopy}>
            <Text numberOfLines={1} style={styles.name}>
              {user.name || 'Chưa đặt tên'}
            </Text>
            <Text numberOfLines={1} style={styles.userEmail}>
              {user.email}
            </Text>
            <View style={styles.userStatusRow}>
              <View
                style={[
                  styles.statusDot,
                  user.status !== 'active' && styles.statusDotBlocked,
                ]}
              />
              <Text
                style={[
                  styles.userStatus,
                  user.status !== 'active' && styles.userStatusBlocked,
                ]}
              >
                {status(user)}
              </Text>
              {!user.verified && (
                <Text style={styles.verificationNote}>
                  · Chưa xác nhận email
                </Text>
              )}
            </View>
          </View>
          <View style={styles.userArrow}>
            {openingUid === user.uid ? (
              <ActivityIndicator
                testID={`opening-user-${user.uid}`}
                size="small"
                color={colors.earth}
              />
            ) : (
              <Feather name="chevron-right" size={17} color={colors.muted} />
            )}
          </View>
        </Pressable>
      ))}
      {page && (
        <Button
          title="Xem thêm"
          variant="secondary"
          disabled={busy}
          onPress={() => void load('', page)}
        />
      )}
      {jobs.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.name}>Đang xử lý · {jobs.length}</Text>
          <Text style={typography.small}>
            Tài khoản đang xóa được chặn truy cập. Hệ thống tự dọn lại để loại
            bỏ file từ các lượt tải lên cũ.
          </Text>
          {jobs.map((job) => (
            <View key={job.uid} style={styles.job}>
              <Text selectable style={typography.small}>
                {job.uid}
              </Text>
              <Text style={styles.name}>
                {job.phase === 'blocking'
                  ? 'Đang áp dụng khóa'
                  : 'Đang dọn dữ liệu'}
              </Text>
            </View>
          ))}
        </View>
      )}
      {selected && (
        <DialogModal onRequestClose={close} style={{ maxHeight: '90%' }}>
          <ScrollView
            contentContainerStyle={styles.detail}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.row}>
              <Text style={[typography.heading, styles.flex]}>
                Chi tiết tài khoản
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng chi tiết"
                onPress={close}
                disabled={busy}
                style={styles.icon}
              >
                <Feather name="x" size={22} color={colors.ink} />
              </Pressable>
            </View>
            <Text style={styles.name}>{selected.name || 'Chưa đặt tên'}</Text>
            <Text selectable>{selected.email}</Text>
            <Text style={styles.badge}>{status(selected)}</Text>
            <View style={styles.info}>
              <Text style={typography.small}>UID</Text>
              <Text selectable>{selected.uid}</Text>
              <Text style={typography.small}>
                Tạo: {date(selected.createdAt)}
              </Text>
              <Text style={typography.small}>
                Đăng nhập gần nhất: {date(selected.lastSignInAt)}
              </Text>
              <Text style={typography.small}>
                Email: {selected.verified ? 'Đã xác nhận' : 'Chưa xác nhận'}
              </Text>
              <Text style={typography.small}>
                Đăng nhập: {selected.providers.join(', ') || 'Email'}
              </Text>
            </View>
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            {['deleting', 'deleted'].includes(selected.status) ? (
              <Text style={typography.small}>
                {selected.phase === 'blocking'
                  ? 'Đang áp dụng khóa tài khoản. Hệ thống sẽ tự thử lại nếu kết nối bị gián đoạn. '
                  : 'Tài khoản đã khóa và đang được dọn dữ liệu. '}
                Không thể mở lại khi đã bắt đầu xóa. Thiết bị offline sẽ dọn bản
                lưu khi kết nối lại.
              </Text>
            ) : selected.protected ? (
              <Text style={typography.small}>
                Tài khoản admin được bảo vệ khỏi thao tác khóa và xóa.
              </Text>
            ) : deleting ? (
              <>
                <Text style={styles.error}>
                  Xóa tài khoản và toàn bộ dữ liệu. Nhập lại email để xác nhận.
                </Text>
                <TextInput
                  accessibilityLabel="Email xác nhận xóa"
                  placeholder={selected.email}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <Button
                  title="Xóa tài khoản và dữ liệu"
                  variant="danger"
                  loading={busy}
                  disabled={
                    email.trim().toLowerCase() !== selected.email.toLowerCase()
                  }
                  onPress={() => mutate('delete')}
                />
                <Button
                  title="Hủy"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => setDeleting(false)}
                />
              </>
            ) : (
              <>
                <Button
                  title={
                    selected.disabled ? 'Mở khóa tài khoản' : 'Khóa tài khoản'
                  }
                  variant="secondary"
                  loading={busy}
                  onPress={() =>
                    Alert.alert(
                      selected.disabled
                        ? 'Mở khóa tài khoản?'
                        : 'Khóa tài khoản?',
                      selected.email,
                      [
                        { text: 'Hủy', style: 'cancel' },
                        {
                          text: 'Xác nhận',
                          onPress: () =>
                            mutate(selected.disabled ? 'enable' : 'disable'),
                        },
                      ],
                    )
                  }
                />
                <Button
                  title="Xóa tài khoản"
                  variant="danger"
                  disabled={busy}
                  onPress={() => setDeleting(true)}
                />
              </>
            )}
          </ScrollView>
        </DialogModal>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  icon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingLeft: 14,
  },
  section: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    marginBottom: 10,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  userCardPressed: { backgroundColor: colors.sunlightFaint },
  userCopy: { flex: 1, minWidth: 0, gap: 3 },
  userEmail: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  userStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  statusDotBlocked: { backgroundColor: colors.danger },
  userStatus: { fontSize: 11, lineHeight: 16, color: colors.success },
  userStatusBlocked: { color: colors.danger },
  verificationNote: { fontSize: 11, lineHeight: 16, color: colors.muted },
  userArrow: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.earth,
    backgroundColor: colors.sunlightSoft,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  blocked: { backgroundColor: colors.dangerSoft, color: colors.danger },
  successNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.successSoft,
  },
  successText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.success },
  error: { color: colors.danger, fontSize: 13 },
  detail: { gap: 14 },
  info: {
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
  },
  job: { gap: 6, borderTopWidth: 1, borderColor: colors.line, paddingTop: 10 },
});
