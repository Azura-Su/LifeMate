import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { PreventScreenCapture } from '../../components/PreventScreenCapture';
import { colors, typography } from '../../theme';
import { formatFinanceAmount } from '../../utils/finance';
import type { useHomeScreen } from './useHomeScreen';
import { styles } from './HomeScreen.styles';

type Props = { model: ReturnType<typeof useHomeScreen>; onOpen: () => void };

export function HomeFinanceCard({ model, onOpen }: Props) {
  const [revealedForLockSetting, setRevealedForLockSetting] = useState<
    boolean | null
  >(null);
  const visible =
    revealedForLockSetting === model.privacy.enabled &&
    model.privacy.appActive &&
    model.privacy.ready &&
    (!model.privacy.enabled || model.privacy.unlocked);
  useEffect(() => {
    setRevealedForLockSetting(null);
  }, [model.privacy.lockVersion, model.privacy.enabled]);
  async function toggleAmounts() {
    if (visible) {
      setRevealedForLockSetting(null);
      return;
    }
    if (!model.privacy.uid || !model.privacy.ready) return;
    if (!model.privacy.enabled) {
      setRevealedForLockSetting(false);
      return;
    }
    if (await model.privacy.revealHome(model.privacy.uid))
      setRevealedForLockSetting(true);
  }
  const displayAmount = (amount: number) =>
    visible ? formatFinanceAmount(amount) : '***';
  const spokenAmount = (amount: number) =>
    visible ? formatFinanceAmount(amount) : 'đã ẩn';

  return (
    <View style={styles.financeCard}>
      {visible && model.privacy.enabled && (
        <PreventScreenCapture id="home-finance" />
      )}
      <View style={styles.financeHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở Tài chính"
          onPress={onOpen}
          style={styles.financeLink}
        >
          <Text style={styles.featureTitle}>Tài chính của bạn</Text>
          <Text style={typography.small}>{model.monthLabel}</Text>
        </Pressable>
        <View style={styles.financeActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ẩn số tiền' : 'Hiện số tiền'}
            disabled={
              !model.privacy.ready ||
              model.privacy.authenticating ||
              model.privacy.changing
            }
            onPress={() => void toggleAmounts()}
            style={styles.financeIconButton}
          >
            <Feather
              name={visible ? 'eye-off' : 'eye'}
              size={20}
              color={colors.earth}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở chi tiết thu chi"
            onPress={onOpen}
            style={styles.financeIconButton}
          >
            <Feather name="arrow-up-right" size={22} color={colors.earth} />
          </Pressable>
        </View>
      </View>
      {model.finance.error ? (
        <>
          <Text accessibilityRole="alert" style={styles.error}>
            {model.finance.error}
          </Text>
          <Button
            compact
            title="Thử tải lại"
            variant="secondary"
            onPress={model.finance.refresh}
          />
        </>
      ) : model.finance.loading && model.finance.transactions.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.earth} />
          <Text style={typography.small}>Đang tải sổ thu chi…</Text>
        </View>
      ) : (
        <>
          <View style={styles.balance}>
            <Text style={styles.balanceLabel}>Còn lại tháng này</Text>
            <Text
              accessibilityLabel={`Còn lại tháng này: ${spokenAmount(model.summary.balance)}`}
              style={styles.balanceAmount}
            >
              {displayAmount(model.summary.balance)}
            </Text>
          </View>
          <View style={styles.totals}>
            {(
              [
                { key: 'income', label: 'Tổng thu', color: colors.success },
                { key: 'expense', label: 'Tổng chi', color: colors.earth },
              ] as const
            ).map((item) => (
              <View key={item.key} style={styles.total}>
                <Text style={typography.small}>{item.label}</Text>
                <Text
                  accessibilityLabel={`${item.label} tháng này: ${spokenAmount(model.summary[item.key])}`}
                  style={[styles.totalAmount, { color: item.color }]}
                >
                  {displayAmount(model.summary[item.key])}
                </Text>
              </View>
            ))}
          </View>
          {model.finance.syncStatus === 'local' && (
            <Text style={styles.localNotice}>
              Chưa sao lưu · dữ liệu đang có trên thiết bị
            </Text>
          )}
          {model.finance.syncStatus === 'recovery' && (
            <Text style={styles.recoveryNotice}>
              Đang hiển thị dữ liệu cloud · cache trên máy chưa đọc được
            </Text>
          )}
          {model.privacy.error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {model.privacy.error}
            </Text>
          )}
        </>
      )}
    </View>
  );
}
