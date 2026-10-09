import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { ModalHeader } from '../../components/ModalHeader';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type FinanceTransactionType,
  type FinanceTransaction,
} from '../../types/finance';
import type { FinanceTransactionTemplate } from '../../services/finance/financePreferences';
import { colors } from '../../theme';
import {
  formatFinanceDate,
  formatFinanceAmount,
  parseFinanceAmount,
  parseFinanceDate,
} from '../../utils/finance';
import { styles } from './FinanceTransactionDialog.styles';

type Draft = {
  type: FinanceTransactionType;
  amount: string;
  category: string;
  note: string;
  date: string;
};

type Props = {
  visible: boolean;
  initialType?: FinanceTransactionType;
  initialDate?: string;
  initialTransaction?: FinanceTransaction | null;
  incomeCategories?: string[];
  expenseCategories?: string[];
  templates?: FinanceTransactionTemplate[];
  busy?: boolean;
  onClose: () => void;
  onSave: (draft: Draft, transactionId?: string) => Promise<void>;
  onSaveTemplate?: (
    template: Omit<FinanceTransactionTemplate, 'id'>,
  ) => Promise<void>;
  onAddCategory?: (type: FinanceTransactionType, name: string) => Promise<void>;
  onRemoveCategory?: (
    type: FinanceTransactionType,
    name: string,
  ) => Promise<void>;
  onRemoveTemplate?: (id: string) => Promise<void>;
};

export function FinanceTransactionDialog({
  visible,
  initialType = 'expense',
  initialDate = formatFinanceDate(),
  initialTransaction = null,
  incomeCategories = [...INCOME_CATEGORIES],
  expenseCategories = [...EXPENSE_CATEGORIES],
  templates = [],
  busy = false,
  onClose,
  onSave,
  onSaveTemplate,
  onAddCategory,
  onRemoveCategory,
  onRemoveTemplate,
}: Props) {
  const [type, setType] = useState<FinanceTransactionType>(
    initialTransaction?.type ?? initialType,
  );
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(
    initialTransaction?.category ??
      (initialType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]),
  );
  const [note, setNote] = useState('');
  const [date, setDate] = useState(initialDate);
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const categories = type === 'income' ? incomeCategories : expenseCategories;
  const parsedAmount = parseFinanceAmount(amount);

  useEffect(() => {
    if (visible) {
      setType(initialType);
      setType(initialTransaction?.type ?? initialType);
      setAmount(initialTransaction ? String(initialTransaction.amount) : '');
      setCategory(
        initialTransaction?.category ??
          (initialType === 'income'
            ? INCOME_CATEGORIES[0]
            : EXPENSE_CATEGORIES[0]),
      );
      setNote(initialTransaction?.note ?? '');
      setDate(
        initialTransaction
          ? formatFinanceDate(new Date(initialTransaction.createdAt))
          : initialDate,
      );
      setError(null);
      setTemplateName('');
      setNewCategory('');
    }
  }, [initialDate, initialTransaction, initialType, visible]);

  async function applyTemplate(template: FinanceTransactionTemplate) {
    setType(template.type);
    setAmount(String(template.amount));
    setCategory(template.category);
    setNote(template.note);
    setError(null);
  }

  async function submit() {
    if (busy) return;
    if (parseFinanceAmount(amount) === null) {
      setError('Nhập số tiền lớn hơn 0.');
      return;
    }
    if (parseFinanceDate(date) === null) {
      setError('Ngày không hợp lệ. Nhập theo dạng DD/MM/YYYY.');
      return;
    }
    try {
      await onSave(
        { type, amount, category, note, date },
        initialTransaction?.id,
      );
      setError(null);
      onClose();
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được giao dịch.');
    }
  }

  async function saveTemplate() {
    if (!onSaveTemplate || preferenceBusy) return;
    const value = parseFinanceAmount(amount);
    if (!templateName.trim() || value === null) {
      setError('Nhập tên mẫu và số tiền hợp lệ trước.');
      return;
    }
    setPreferenceBusy(true);
    try {
      await onSaveTemplate({
        name: templateName,
        type,
        amount: value,
        category,
        note: note.trim(),
      });
      setTemplateName('');
      setError(null);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được mẫu.');
    } finally {
      setPreferenceBusy(false);
    }
  }

  async function saveCategory() {
    if (!onAddCategory || preferenceBusy) return;
    setPreferenceBusy(true);
    try {
      await onAddCategory(type, newCategory);
      setCategory(newCategory.trim());
      setNewCategory('');
      setError(null);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được danh mục.');
    } finally {
      setPreferenceBusy(false);
    }
  }

  async function removeCategory(value: string) {
    if (!onRemoveCategory || preferenceBusy) return;
    const builtIns = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (builtIns.some((builtIn) => builtIn === value)) return;
    setPreferenceBusy(true);
    try {
      await onRemoveCategory(type, value);
      if (category === value) setCategory(builtIns[0]);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa xóa được danh mục.');
    } finally {
      setPreferenceBusy(false);
    }
  }

  return (
    <DialogModal
      visible={visible}
      onRequestClose={busy ? undefined : onClose}
      style={styles.dialog}
    >
      <View style={styles.header}>
        <ModalHeader
          title={initialTransaction ? 'Sửa giao dịch' : 'Thêm giao dịch'}
          accessibilityLabel={
            initialTransaction ? 'Đóng sửa giao dịch' : 'Hủy thêm giao dịch'
          }
          disabled={busy}
          onBack={onClose}
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {templates.length > 0 && (
          <View style={styles.preferenceSection}>
            <Text style={styles.label}>Mẫu giao dịch</Text>
            <View style={styles.categoryList}>
              {templates.map((template) => (
                <View key={template.id} style={styles.templateChip}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void applyTemplate(template)}
                    style={styles.templateAction}
                  >
                    <Text style={styles.categoryText}>{template.name}</Text>
                  </Pressable>
                  {template.id !== 'coffee-default' && onRemoveTemplate && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xóa mẫu ${template.name}`}
                      onPress={() => void onRemoveTemplate(template.id)}
                      style={styles.smallAction}
                    >
                      <Feather name="x" size={13} color={colors.muted} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
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
        {parsedAmount !== null && (
          <Text
            accessibilityLabel={`Số tiền đã nhập: ${formatFinanceAmount(parsedAmount)}`}
            style={styles.amountPreview}
          >
            {formatFinanceAmount(parsedAmount)}
          </Text>
        )}
        <Text style={styles.label}>Ngày giao dịch</Text>
        <TextInput
          accessibilityLabel="Ngày giao dịch"
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.muted}
          keyboardType="numbers-and-punctuation"
          value={date}
          onChangeText={(value) => {
            setDate(value);
            setError(null);
          }}
          editable={!busy}
          maxLength={10}
          style={styles.input}
        />
        <Text style={styles.label}>Danh mục</Text>
        <View style={styles.categoryList}>
          {categories.map((value) => {
            const selected = value === category;
            const builtIns =
              type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
            return (
              <View
                key={value}
                style={[styles.category, selected && styles.categorySelected]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setCategory(value)}
                  style={styles.templateAction}
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
                {!builtIns.some((builtIn) => builtIn === value) &&
                  onRemoveCategory && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xóa danh mục ${value}`}
                      disabled={preferenceBusy}
                      onPress={() => void removeCategory(value)}
                      style={styles.smallAction}
                    >
                      <Feather name="x" size={13} color={colors.muted} />
                    </Pressable>
                  )}
              </View>
            );
          })}
        </View>
        {onAddCategory && (
          <View style={styles.inlineForm}>
            <TextInput
              accessibilityLabel="Tên danh mục mới"
              placeholder="Tên danh mục mới"
              placeholderTextColor={colors.muted}
              value={newCategory}
              onChangeText={setNewCategory}
              maxLength={50}
              style={[styles.input, styles.inlineInput]}
            />
            <Button
              compact
              title="Thêm mục"
              variant="secondary"
              disabled={preferenceBusy || !newCategory.trim()}
              onPress={() => void saveCategory()}
            />
          </View>
        )}
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
        {!initialTransaction && onSaveTemplate && (
          <View style={styles.inlineForm}>
            <TextInput
              accessibilityLabel="Tên mẫu mới"
              placeholder="Tên mẫu mới (vd. Cà phê 30.000đ)"
              placeholderTextColor={colors.muted}
              value={templateName}
              onChangeText={setTemplateName}
              maxLength={50}
              style={[styles.input, styles.inlineInput]}
            />
            <Button
              compact
              title="Lưu mẫu"
              variant="secondary"
              disabled={
                preferenceBusy || !templateName.trim() || parsedAmount === null
              }
              onPress={() => void saveTemplate()}
            />
          </View>
        )}
        <Button
          title={initialTransaction ? 'Lưu thay đổi' : 'Lưu giao dịch'}
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
