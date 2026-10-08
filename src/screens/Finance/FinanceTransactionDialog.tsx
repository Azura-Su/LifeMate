import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type FinanceTransactionType,
} from '../../types/finance';
import { colors, typography } from '../../theme';
import { parseFinanceAmount } from '../../utils/finance';
import { styles } from './FinanceTransactionDialog.styles';

type Draft = {
  type: FinanceTransactionType;
  amount: string;
  category: string;
  note: string;
};

type Props = {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onSave: (draft: Draft) => Promise<void>;
};

export function FinanceTransactionDialog({
  visible,
  busy = false,
  onClose,
  onSave,
}: Props) {
  const [type, setType] = useState<FinanceTransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  useEffect(() => {
    if (visible) {
      setType('expense');
      setAmount('');
      setCategory(EXPENSE_CATEGORIES[0]);
      setNote('');
      setError(null);
    }
  }, [visible]);

  async function submit() {
    if (busy) return;
    if (parseFinanceAmount(amount) === null) {
      setError('Nhập số tiền lớn hơn 0.');
      return;
    }
    try {
      await onSave({ type, amount, category, note });
      setError(null);
      onClose();
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được giao dịch.');
    }
  }

  return (
    <DialogModal
      visible={visible}
      onRequestClose={busy ? undefined : onClose}
      style={styles.dialog}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text accessibilityRole="header" style={typography.heading}>
          Thêm giao dịch
        </Text>
        <View style={styles.typeRow}>
          {(['expense', 'income'] as const).map((value) => {
            const selected = value === type;
            const label = value === 'income' ? 'Thu nhập' : 'Chi tiêu';
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                onPress={() => {
                  setType(value);
                  setCategory(
                    value === 'income'
                      ? INCOME_CATEGORIES[0]
                      : EXPENSE_CATEGORIES[0],
                  );
                  setError(null);
                }}
                style={[styles.typeButton, selected && styles.typeSelected]}
              >
                <Text
                  style={[styles.typeText, selected && styles.typeTextSelected]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.label}>Số tiền</Text>
        <TextInput
          accessibilityLabel="Số tiền"
          placeholder="Ví dụ: 500000"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          value={amount}
          onChangeText={(value) => {
            setAmount(value.replace(/\D/g, ''));
            setError(null);
          }}
          editable={!busy}
          style={styles.input}
        />
        <Text style={styles.label}>Danh mục</Text>
        <View style={styles.categoryList}>
          {categories.map((value) => {
            const selected = value === category;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setCategory(value)}
                style={[styles.category, selected && styles.categorySelected]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selected && styles.categoryTextSelected,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.label}>Ghi chú · không bắt buộc</Text>
        <TextInput
          accessibilityLabel="Ghi chú"
          placeholder={
            type === 'income' ? 'Ví dụ: Lương tháng 10' : 'Ví dụ: Ăn trưa'
          }
          placeholderTextColor={colors.muted}
          value={note}
          onChangeText={setNote}
          editable={!busy}
          maxLength={120}
          style={styles.input}
        />
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          title="Lưu giao dịch"
          onPress={() => void submit()}
          loading={busy}
        />
        <Button
          title="Hủy"
          variant="secondary"
          disabled={busy}
          onPress={onClose}
        />
      </ScrollView>
    </DialogModal>
  );
}
