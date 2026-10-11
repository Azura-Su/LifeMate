import Feather from '@expo/vector-icons/Feather';
import { useIsFocused } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { PreventScreenCapture } from '../../components/PreventScreenCapture';
import { Screen } from '../../components/Screen';
import { useFinancePrivacy } from '../../hooks/useFinancePrivacy';
import type { MainTabParams } from '../../navigation/types';
import { colors, typography } from '../../theme';
import { FinanceScreen } from './FinanceScreen';
import { styles as financeStyles } from './FinanceScreen.styles';

export function ProtectedFinanceScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Finance'>) {
  const privacy = useFinancePrivacy();
  const {
    appActive,
    authenticating,
    enabled,
    lockVersion,
    ready,
    uid,
    unlock,
    unlocked,
  } = privacy;
  const isFocused = useIsFocused();
  const autoUnlockVersion = useRef<number | null>(null);
  const canViewFinance =
    privacy.ready &&
    (privacy.enabled === false || (privacy.appActive && privacy.unlocked));
  const [retainedFinanceUid, setRetainedFinanceUid] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (canViewFinance && uid) setRetainedFinanceUid(uid);
  }, [canViewFinance, uid]);
  const shouldRetainFinance = !!uid && retainedFinanceUid === uid;

  useEffect(() => {
    if (
      !isFocused ||
      !ready ||
      !enabled ||
      !uid ||
      !appActive ||
      unlocked ||
      authenticating ||
      autoUnlockVersion.current === lockVersion
    )
      return;

    autoUnlockVersion.current = lockVersion;
    void unlock(uid);
  }, [
    appActive,
    authenticating,
    enabled,
    isFocused,
    lockVersion,
    ready,
    uid,
    unlock,
    unlocked,
  ]);

  const lockScreen = (
    <Screen
      fixedHeader={
        <Text
          accessibilityRole="header"
          style={[typography.title, financeStyles.headerTitle]}
        >
          Tài chính
        </Text>
      }
      fixedHeaderStyle={financeStyles.header}
      contentStyle={styles.content}
    >
      <View style={styles.lockIcon}>
        <Feather name="lock" size={32} color={colors.earth} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        Sổ thu chi đã khóa
      </Text>
      <Text style={styles.hint}>
        Xác thực bằng {privacy.biometricLabel} hoặc mật mã thiết bị để xem.
      </Text>
      {privacy.loading ? (
        <ActivityIndicator
          accessibilityLabel="Đang đọc thiết lập bảo mật"
          color={colors.earth}
        />
      ) : (
        <Button
          title={privacy.enabled === null ? 'Thử lại' : 'Mở khóa'}
          loading={privacy.authenticating}
          onPress={() => {
            if (privacy.uid)
              void (privacy.enabled === null
                ? privacy.load(privacy.uid)
                : privacy.unlock(privacy.uid));
          }}
        />
      )}
      {privacy.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {privacy.error}
        </Text>
      )}
      <Button
        title="Về Home"
        variant="secondary"
        onPress={() => navigation.navigate('Home')}
      />
    </Screen>
  );

  if (!canViewFinance && !shouldRetainFinance) return lockScreen;

  return (
    <View style={styles.protected}>
      {(canViewFinance || shouldRetainFinance) && privacy.enabled && (
        <PreventScreenCapture id="finance-tab" />
      )}
      <View
        style={styles.financeLayer}
        pointerEvents={canViewFinance ? 'auto' : 'none'}
        accessibilityElementsHidden={!canViewFinance}
        importantForAccessibility={
          canViewFinance ? 'auto' : 'no-hide-descendants'
        }
      >
        <FinanceScreen suspended={!canViewFinance} />
      </View>
      {!canViewFinance && <View style={styles.lockLayer}>{lockScreen}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  protected: { flex: 1 },
  financeLayer: { flex: 1 },
  lockLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  lockIcon: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.heading, textAlign: 'center' },
  hint: { ...typography.body, textAlign: 'center' },
  error: { ...typography.small, color: colors.danger, textAlign: 'center' },
});
