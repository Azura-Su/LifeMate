import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { DialogCloseButton } from '../../components/DialogCloseButton';
import { DialogModal } from '../../components/DialogModal';
import { changeAccountPassword } from '../../services/firebase/authService';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme';
import {
  getPasswordChangeErrorMessage,
  validatePasswordChange,
} from '../../utils/auth';

function PasswordField({
  label,
  value,
  onChange,
  current = false,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  current?: boolean;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setVisible(false);
    });
    return () => subscription.remove();
  }, []);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          editable={!disabled}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={current ? 'password' : 'newPassword'}
          autoComplete={current ? 'current-password' : 'new-password'}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`}
          disabled={disabled}
          onPress={() => setVisible(!visible)}
          style={styles.eye}
        >
          <Feather
            name={visible ? 'eye-off' : 'eye'}
            size={18}
            color={colors.muted}
          />
        </Pressable>
      </View>
    </View>
  );
}
export function ChangePasswordDialog({
  uid,
  onClose,
}: {
  uid: string;
  onClose: () => void;
}) {
  const activeUid = useAuthStore((state) => state.user?.uid);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const clear = () => {
    setCurrent('');
    setNext('');
    setConfirmation('');
  };
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setCurrent('');
        setNext('');
        setConfirmation('');
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, []);
  const close = () => {
    if (!pending.current) onClose();
  };
  const submit = async () => {
    if (pending.current || activeUid !== uid) return;
    const invalid = validatePasswordChange(current, next, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await changeAccountPassword(uid, current, next);
      if (mounted.current && useAuthStore.getState().user?.uid === uid) {
        clear();
        setSaved(true);
      }
    } catch (cause) {
      if (mounted.current && useAuthStore.getState().user?.uid === uid)
        setError(getPasswordChangeErrorMessage(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  if (activeUid !== uid) return null;
  return (
    <DialogModal onRequestClose={close} style={{ maxHeight: '90%' }}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {saved ? 'Đã đổi mật khẩu' : 'Đổi mật khẩu'}
        </Text>
        <DialogCloseButton
          accessibilityLabel="Đóng đổi mật khẩu"
          onPress={close}
          disabled={busy}
        />
      </View>
      {saved ? (
        <>
          <View style={styles.success}>
            <Feather name="check-circle" size={22} color={colors.success} />
            <Text accessibilityRole="alert" style={styles.successText}>
              Mật khẩu đã được cập nhật. Dùng mật khẩu mới cho lần đăng nhập
              tiếp theo.
            </Text>
          </View>
          <Button title="Hoàn tất" onPress={close} />
        </>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.form}
        >
          <Text style={styles.description}>
            Xác nhận mật khẩu hiện tại để bảo vệ tài khoản của bạn.
          </Text>
          <PasswordField
            label="Mật khẩu hiện tại"
            value={current}
            onChange={setCurrent}
            current
            disabled={busy}
          />
          <PasswordField
            label="Mật khẩu mới"
            value={next}
            onChange={setNext}
            disabled={busy}
          />
          <Text style={styles.hint}>
            Ít nhất 8 ký tự, khác mật khẩu hiện tại.
          </Text>
          <PasswordField
            label="Nhập lại mật khẩu mới"
            value={confirmation}
            onChange={setConfirmation}
            disabled={busy}
          />
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <Button
            title="Cập nhật mật khẩu"
            onPress={() => void submit()}
            loading={busy}
          />
        </ScrollView>
      )}
    </DialogModal>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.ink },
  form: { gap: 14, paddingBottom: 2 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  field: { gap: 7 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  eye: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, color: colors.muted, marginTop: -8 },
  error: { fontSize: 13, lineHeight: 19, color: colors.danger },
  success: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.successSoft,
    padding: 14,
    borderRadius: 14,
  },
  successText: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.success },
});
