import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { Button } from '../../components/Button';
import { DialogCloseButton } from '../../components/DialogCloseButton';
import { DialogModal } from '../../components/DialogModal';
import type {
  MemoryFriend,
  MemoryShareState,
} from '../../services/memories/memorySharing';
import { colors, typography } from '../../theme';

type Props = {
  visible: boolean;
  state: MemoryShareState | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onInvite: (email: string) => Promise<void>;
  onChange: (
    action: 'accept' | 'decline' | 'remove-friend',
    uid: string,
  ) => Promise<void>;
  onCancel: (email: string) => Promise<void>;
};

function FriendRow({
  person,
  actions,
  disabled,
}: {
  person: MemoryFriend;
  actions: { label: string; action: () => void; danger?: boolean }[];
  disabled: boolean;
}) {
  return (
    <View style={styles.personRow}>
      <View style={styles.personDetails}>
        <Text style={styles.personName}>{person.name}</Text>
        <Text style={styles.personEmail}>{person.email}</Text>
      </View>
      <View style={styles.actions}>
        {actions.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} ${person.name}`}
            disabled={disabled}
            onPress={item.action}
            style={styles.actionButton}
          >
            <Text style={[styles.actionText, item.danger && styles.dangerText]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function MemoryFriendsModal({
  visible,
  state,
  loading,
  error,
  onClose,
  onRetry,
  onInvite,
  onChange,
  onCancel,
}: Props) {
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) return;
    setEmail('');
    setNotice(null);
    setLocalError(null);
  }, [visible]);

  async function invite() {
    setNotice(null);
    setLocalError(null);
    try {
      await onInvite(email);
      setEmail('');
      setNotice('Đã gửi lời mời nếu email này có tài khoản LifeMate.');
    } catch (cause) {
      setLocalError((cause as Error).message || 'Chưa gửi được lời mời.');
    }
  }

  async function change(
    action: 'accept' | 'decline' | 'remove-friend',
    uid: string,
  ) {
    setLocalError(null);
    setNotice(null);
    try {
      await onChange(action, uid);
    } catch (cause) {
      setLocalError((cause as Error).message || 'Chưa cập nhật được bạn bè.');
    }
  }

  async function cancel(email: string) {
    setLocalError(null);
    setNotice(null);
    try {
      await onCancel(email);
    } catch (cause) {
      setLocalError((cause as Error).message || 'Chưa hủy được lời mời.');
    }
  }

  return (
    <DialogModal
      visible={visible}
      onRequestClose={loading ? undefined : onClose}
      style={styles.dialog}
    >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              Bạn bè
            </Text>
            <Text style={styles.subtitle}>
              Bạn bè hiện tại và kết bạn sau này đều xem được ký ức bạn chọn
              chia sẻ.
            </Text>
          </View>
          <DialogCloseButton
            accessibilityLabel="Đóng bạn bè"
            onPress={onClose}
            disabled={loading}
          />
        </View>
        {state ? (
          <>
            <View style={styles.emailBox}>
              <Feather name="mail" size={16} color={colors.sky} />
              <Text style={styles.emailText}>{state.email}</Text>
            </View>
            <Text style={styles.sectionTitle}>Thêm bạn bằng email</Text>
            <AppTextInput
              accessibilityLabel="Email bạn bè"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Email tài khoản LifeMate"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              style={styles.input}
            />
            <Button
              title="Gửi lời mời"
              compact
              disabled={loading || !email.trim()}
              onPress={() => void invite()}
            />
            {!!state.incoming.length && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Lời mời nhận được · {state.incoming.length}
                </Text>
                {state.incoming.map((person) => (
                  <FriendRow
                    key={person.uid}
                    person={person}
                    disabled={loading}
                    actions={[
                      {
                        label: 'Chấp nhận',
                        action: () => void change('accept', person.uid),
                      },
                      {
                        label: 'Từ chối',
                        action: () => void change('decline', person.uid),
                        danger: true,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Đã kết bạn · {state.friends.length}
              </Text>
              {state.friends.length ? (
                state.friends.map((person) => (
                  <FriendRow
                    key={person.uid}
                    person={person}
                    disabled={loading}
                    actions={[
                      {
                        label: 'Xóa bạn',
                        action: () => void change('remove-friend', person.uid),
                        danger: true,
                      },
                    ]}
                  />
                ))
              ) : (
                <Text style={styles.empty}>
                  Chưa có bạn bè. Gửi lời mời để cùng xem khoảnh khắc.
                </Text>
              )}
            </View>
            {!!state.outgoing.length && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Đang chờ · {state.outgoing.length}
                </Text>
                {state.outgoing.map((person) => (
                  <View key={person.email} style={styles.personRow}>
                    <Text style={styles.personEmail}>{person.email}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Hủy lời mời ${person.email}`}
                      disabled={loading}
                      onPress={() => void cancel(person.email)}
                      style={styles.actionButton}
                    >
                      <Text style={styles.dangerText}>Hủy lời mời</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <Button
            title={loading ? 'Đang tải…' : 'Tải lại'}
            compact
            disabled={loading}
            onPress={onRetry}
          />
        )}
        {!!notice && (
          <Text accessibilityRole="alert" style={styles.notice}>
            {notice}
          </Text>
        )}
        {!!(localError || error) && (
          <Text accessibilityRole="alert" style={styles.error}>
            {localError || error}
          </Text>
        )}
      </ScrollView>
    </DialogModal>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '88%', padding: 0, gap: 0, overflow: 'hidden' },
  body: { padding: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heading: { flex: 1, gap: 4 },
  title: { ...typography.heading, fontWeight: '700' },
  subtitle: { ...typography.small, fontSize: 12 },
  emailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 11,
    backgroundColor: colors.skySoft,
  },
  emailText: { flex: 1, fontSize: 12, color: colors.sky },
  section: {
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  personDetails: { flex: 1, gap: 3 },
  personName: { fontSize: 13, fontWeight: '700', color: colors.ink },
  personEmail: { fontSize: 11, color: colors.muted },
  actions: { gap: 2, alignItems: 'flex-end' },
  actionButton: {
    minHeight: 35,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.earth },
  dangerText: { color: colors.danger },
  empty: { ...typography.small, fontSize: 12 },
  notice: { ...typography.small, color: colors.success },
  error: { ...typography.small, color: colors.danger },
});
