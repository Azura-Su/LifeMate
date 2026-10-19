import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';
import {
  refreshAccountVerification,
  sendAccountVerificationEmail,
} from '../../services/firebase/authService';
import { colors } from '../../theme';

function useAppActive() {
  const [isActive, setIsActive] = useState(
    () => AppState.currentState === 'active',
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) =>
      setIsActive(state === 'active'),
    );
    return () => sub.remove();
  }, []);
  return isActive;
}

export function ProfileEmailVerification({
  uid,
  disabled = false,
}: {
  uid: string;
  disabled?: boolean;
}) {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<'check' | 'send' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const pending = useRef(false),
    active = useRef(false),
    resendAt = useRef(0);
  const current = () =>
    active.current && useAuthStore.getState().user?.uid === uid;
  async function check(manual = false) {
    if (pending.current) return;
    pending.current = true;
    setBusy('check');
    setError(null);
    try {
      const result = await refreshAccountVerification(uid);
      if (current()) {
        setVerified(result);
        if (manual)
          setMessage(
            result
              ? 'Email đã được xác nhận. Bạn có thể kết bạn và chia sẻ Ký ức.'
              : 'Email chưa được xác nhận. Hãy bấm liên kết trong thư rồi thử lại.',
          );
      }
    } catch {
      if (current())
        setError('Chưa kiểm tra được trạng thái email. Hãy thử lại.');
    } finally {
      pending.current = false;
      if (current()) setBusy(null);
    }
  }
  async function send() {
    if (pending.current || Date.now() < resendAt.current) return;
    pending.current = true;
    setBusy('send');
    setError(null);
    setMessage(null);
    try {
      await sendAccountVerificationEmail(uid);
      if (current()) {
        resendAt.current = Date.now() + 60000;
        setSeconds(60);
        setMessage(
          'Đã yêu cầu gửi thư xác nhận. Hãy kiểm tra hộp thư và mục Thư rác.',
        );
      }
    } catch {
      if (current())
        setError('Chưa gửi được thư xác nhận. Hãy thử lại sau ít phút.');
    } finally {
      pending.current = false;
      if (current()) setBusy(null);
    }
  }
  useEffect(() => {
    active.current = true;
    void check();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      active.current = false;
      listener.remove();
    };
    // The parent keys this component by UID; every session gets fresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  // Tick only while a countdown is running and the app is in the foreground;
  // the remaining time is recomputed from resendAt when the app returns.
  const appActive = useAppActive();
  const counting = seconds > 0;
  useEffect(() => {
    if (!counting || !appActive) return;
    const tick = () => {
      if (!current()) return;
      const left = Math.max(
        0,
        Math.ceil((resendAt.current - Date.now()) / 1000),
      );
      setSeconds(left);
      if (left === 0) clearInterval(timer);
    };
    const timer = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting, appActive]);
  if (verified === null && !error)
    return (
      <View style={[styles.confirmed, styles.row]}>
        <ActivityIndicator size="small" color={colors.muted} />
        <Text style={styles.checkingText}>Đang kiểm tra email…</Text>
      </View>
    );
  return (
    <View style={[styles.card, verified === true && styles.confirmed]}>
      <View style={styles.row}>
        <Feather
          name={verified ? 'check-circle' : 'mail'}
          size={verified ? 16 : 18}
          color={verified ? colors.success : colors.earth}
        />
        <Text
          style={[styles.title, verified === true && styles.confirmedTitle]}
        >
          {verified === true
            ? 'Email đã xác nhận'
            : verified === false
              ? 'Email chưa xác nhận'
              : 'Kiểm tra xác nhận email'}
        </Text>
      </View>
      {verified !== true && (
        <>
          <Text style={styles.text}>
            Bạn vẫn có thể dùng LifeMate và chỉnh sửa hồ sơ. Xác nhận email để
            kết bạn và chia sẻ Ký ức.
          </Text>
          <Button
            title={
              seconds > 0 ? `Gửi lại sau ${seconds}s` : 'Gửi email xác nhận'
            }
            variant="secondary"
            compact
            loading={busy === 'send'}
            disabled={disabled || !!busy || seconds > 0}
            onPress={() => void send()}
          />
          <Button
            title="Tôi đã xác nhận"
            variant="secondary"
            compact
            loading={busy === 'check'}
            disabled={disabled || !!busy}
            onPress={() => void check(true)}
          />
        </>
      )}
      {message && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {message}
        </Text>
      )}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    backgroundColor: colors.sunlightSoft,
    borderWidth: 1,
    borderColor: colors.sunlightLine,
    borderRadius: 18,
  },
  confirmed: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignSelf: 'flex-start',
    marginLeft: 42,
    padding: 0,
    gap: 6,
  },
  checkingText: { flexShrink: 1, fontSize: 12, color: colors.muted },
  confirmedTitle: { fontSize: 12, color: colors.success },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  text: { fontSize: 13, lineHeight: 19, color: colors.muted },
  error: { fontSize: 13, color: colors.danger },
});
