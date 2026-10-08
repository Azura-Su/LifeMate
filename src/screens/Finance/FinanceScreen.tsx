import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { colors, typography } from '../../theme';
import { formatFinanceAmount } from '../../utils/finance';
import { FinanceTransactionDialog } from './FinanceTransactionDialog';
import { styles } from './FinanceScreen.styles';
import { useFinanceScreen } from './useFinanceScreen';
import type { FinanceTransaction } from '../../types/finance';
import { FinanceTransactionRow } from './FinanceTransactionRow';

export function FinanceScreen() {
  const model = useFinanceScreen();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const monthLabel = new Date().toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
  });

  function confirmDelete(transaction: FinanceTransaction) {
    Alert.alert(
      'Xóa giao dịch?',
      'Giao dịch này sẽ được xóa khỏi sổ thu chi trên thiết bị.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            void model.removeTransaction(transaction.id).catch(() => undefined);
          },
        },
      ],
    );
  }

  async function save(draft: Parameters<typeof model.addTransaction>[0]) {
    setSaving(true);
    try {
      await model.addTransaction(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      fixedHeader={
        <Text accessibilityRole="header" style={typography.title}>
          Tài chính
        </Text>
      }
      fixedHeaderStyle={styles.header}
      contentStyle={styles.content}
    >
      <Text style={styles.month}>{monthLabel}</Text>

      <View style={styles.summary}>
        <View style={styles.balance}>
          <Text style={styles.balanceLabel}>Còn lại trong tháng</Text>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={styles.balanceAmount}
          >
            {formatFinanceAmount(model.summary.balance)}
          </Text>
        </View>
        <View style={styles.totals}>
          <View style={styles.total}>
            <Text style={styles.totalLabel}>Thu vào</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.totalAmount, styles.income]}
            >
              {formatFinanceAmount(model.summary.income)}
            </Text>
          </View>
          <View style={styles.total}>
            <Text style={styles.totalLabel}>Chi ra</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.totalAmount, styles.expense]}
            >
              {formatFinanceAmount(model.summary.expense)}
            </Text>
          </View>
        </View>
      </View>

      <Button title="Thêm giao dịch" onPress={() => setDialogVisible(true)} />

      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Giao dịch gần đây
        </Text>
        {model.loading && <ActivityIndicator color={colors.earth} />}
      </View>

      {!!model.error && (
        <View>
          <Text accessibilityRole="alert" style={styles.feedback}>
            {model.error}
          </Text>
          <Button
            compact
            title="Thử tải lại"
            variant="secondary"
            onPress={model.refresh}
          />
        </View>
      )}

      {!model.loading && model.transactions.length === 0 && !model.error && (
        <View style={styles.empty}>
          <Feather name="pie-chart" size={24} color={colors.sky} />
          <Text style={styles.emptyTitle}>Chưa có giao dịch nào</Text>
          <Text style={typography.small}>
            Thêm khoản lương hoặc chi tiêu đầu tiên của bạn.
          </Text>
        </View>
      )}

      <View style={styles.transactionList}>
        {model.transactions.map((transaction) => (
          <FinanceTransactionRow
            key={transaction.id}
            transaction={transaction}
            onDelete={() => confirmDelete(transaction)}
          />
        ))}
      </View>

      <FinanceTransactionDialog
        visible={dialogVisible}
        busy={saving}
        onClose={() => setDialogVisible(false)}
        onSave={save}
      />
    </Screen>
  );
}
