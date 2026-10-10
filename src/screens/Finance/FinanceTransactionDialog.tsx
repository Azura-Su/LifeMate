import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { ModalHeader } from '../../components/ModalHeader';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type FinanceIncomeSource,
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
  incomeSource: FinanceIncomeSource;
  amount: string;
  category: string;
  note: string;
  date: string;
};

type Props = {
  visible: boolean;
  suspended?: boolean;
  initialType?: FinanceTransactionType;
  initialIncomeSource?: FinanceIncomeSource;
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
  suspended = false,
  initialType = 'expense',
  initialIncomeSource = 'company',
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
  const [incomeSource, setIncomeSource] = useState<FinanceIncomeSource>(
    initialTransaction?.incomeSource ?? initialIncomeSource,
  );
  const [note, setNote] = useState('');
  const [date, setDate] = useState(initialDate);
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceAction, setPreferenceAction] = useState<string | null>(null);
  const categories =
    type === 'income'
      ? incomeCategories.filter(
          (value) =>
            incomeSource !== 'other' ||
            (value !== INCOME_CATEGORIES[0] && value !== INCOME_CATEGORIES[1]),
        )
      : expenseCategories;
  const visibleTemplates = templates.filter(
    (template) => template.type === type,
  );
  const parsedAmount = parseFinanceAmount(amount);
  const canSave =
    parsedAmount !== null &&
    parseFinanceDate(date) !== null &&
    !!category.trim() &&
    !busy &&
    !preferenceBusy;

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
      setIncomeSource(initialTransaction?.incomeSource ?? initialIncomeSource);
      setNote(initialTransaction?.note ?? '');
      setDate(
        initialTransaction
          ? formatFinanceDate(new Date(initialTransaction.createdAt))
          : initialDate,
      );
      setError(null);
      setTemplateName('');
      setNewCategory('');
      setShowCategoryForm(false);
      setShowTemplateForm(false);
    }
  }, [
    initialDate,
    initialIncomeSource,
    initialTransaction,
    initialType,
    visible,
  ]);

  async function applyTemplate(template: FinanceTransactionTemplate) {
    setType(template.type);
    setIncomeSource(template.incomeSource ?? 'company');
    setAmount(String(template.amount));
    setCategory(template.category);
    setNote(template.note);
    setError(null);
  }

  async function submit() {
    if (busy || preferenceBusy) return;
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
        { type, incomeSource, amount, category, note, date },
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
    setPreferenceAction('save-template');
    try {
      await onSaveTemplate({
        name: templateName,
        type,
        amount: value,
        category,
        note: note.trim(),
        ...(type === 'income' ? { incomeSource } : {}),
      });
      setTemplateName('');
      setError(null);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được mẫu.');
    } finally {
      setPreferenceAction(null);
      setPreferenceBusy(false);
    }
  }

  async function removeTemplate(id: string) {
    if (!onRemoveTemplate || preferenceBusy) return;
    setPreferenceBusy(true);
    setPreferenceAction(`remove-template:${id}`);
    try {
      await onRemoveTemplate(id);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa xóa được mẫu giao dịch.');
    } finally {
      setPreferenceAction(null);
      setPreferenceBusy(false);
    }
  }

  async function saveCategory() {
    if (!onAddCategory || preferenceBusy) return;
    setPreferenceBusy(true);
    setPreferenceAction('save-category');
    try {
      await onAddCategory(type, newCategory);
      setCategory(newCategory.trim());
      setNewCategory('');
      setShowCategoryForm(false);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được danh mục.');
    } finally {
      setPreferenceAction(null);
      setPreferenceBusy(false);
    }
  }

  async function removeCategory(value: string) {
    if (!onRemoveCategory || preferenceBusy) return;
    const builtIns = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (builtIns.some((builtIn) => builtIn === value)) return;
    setPreferenceBusy(true);
    setPreferenceAction(`remove-category:${value}`);
    try {
      await onRemoveCategory(type, value);
      if (category === value) setCategory(builtIns[0]);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message || 'Chưa xóa được danh mục.');
    } finally {
      setPreferenceAction(null);
      setPreferenceBusy(false);
    }
  }

  return (
    <DialogModal
      visible={visible && !suspended}
      onRequestClose={busy || preferenceBusy ? undefined : onClose}
      style={styles.dialog}
    >
      <View style={styles.header}>
        <ModalHeader
          title={initialTransaction ? 'Sửa giao dịch' : 'Thêm giao dịch'}
          accessibilityLabel={
            initialTransaction ? 'Đóng sửa giao dịch' : 'Đóng thêm giao dịch'
          }
          disabled={busy || preferenceBusy}
          onBack={onClose}
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {(visibleTemplates.length > 0 ||
          (!initialTransaction && onSaveTemplate)) && (
          <View style={styles.preferenceSection}>
            <View style={styles.sectionHeading}>
              <Text style={styles.label}>Mẫu giao dịch</Text>
              {!initialTransaction && onSaveTemplate && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showTemplateForm ? 'Đóng thêm mẫu' : 'Thêm mẫu giao dịch'
                  }
                  accessibilityState={{ expanded: showTemplateForm }}
                  hitSlop={6}
                  onPress={() => setShowTemplateForm((current) => !current)}
                  style={styles.addAction}
                >
                  <Feather
                    name={showTemplateForm ? 'x' : 'plus'}
                    size={16}
                    color={colors.earth}
                  />
                </Pressable>
              )}
            </View>
            {visibleTemplates.length > 0 && (
              <View style={styles.categoryList}>
                {visibleTemplates.map((template) => (
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
                        accessibilityState={{
                          disabled: preferenceBusy,
                          busy:
                            preferenceAction ===
                            `remove-template:${template.id}`,
                        }}
                        disabled={preferenceBusy}
                        hitSlop={6}
                        onPress={() => void removeTemplate(template.id)}
                        style={styles.smallAction}
                      >
                        {preferenceAction ===
                        `remove-template:${template.id}` ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.earth}
                          />
                        ) : (
                          <Feather name="x" size={13} color={colors.muted} />
                        )}
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
            {showTemplateForm && onSaveTemplate && (
              <View style={styles.inlineForm}>
                <TextInput
                  accessibilityLabel="Tên mẫu mới"
                  placeholder="Tên mẫu giao dịch"
                  placeholderTextColor={colors.muted}
                  value={templateName}
                  onChangeText={setTemplateName}
                  maxLength={50}
                  editable={!preferenceBusy}
                  style={[styles.input, styles.inlineInput]}
                />
                <Button
                  compact
                  title="Lưu mẫu"
                  variant="secondary"
                  disabled={
                    preferenceBusy ||
                    !templateName.trim() ||
                    parsedAmount === null
                  }
                  loading={preferenceAction === 'save-template'}
                  onPress={() => void saveTemplate()}
                />
              </View>
            )}
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
                  if (value === 'income') setIncomeSource('company');
                  setCategory(
                    value === 'income'
                      ? INCOME_CATEGORIES[0]
                      : EXPENSE_CATEGORIES[0],
                  );
                  setTemplateName('');
                  setShowTemplateForm(false);
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
        {type === 'income' && (
          <View style={styles.incomeSourceSection}>
            <Text style={styles.label}>Nguồn thu</Text>
            <View style={styles.sourceRow}>
              {(
                [
                  ['company', 'Công ty'],
                  ['other', 'Ngoài công ty'],
                ] as const
              ).map(([value, label]) => {
                const selected = incomeSource === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`Nguồn thu: ${label}`}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setIncomeSource(value);
                      setCategory(
                        value === 'company'
                          ? INCOME_CATEGORIES[0]
                          : INCOME_CATEGORIES[2],
                      );
                    }}
                    style={[
                      styles.sourceButton,
                      selected && styles.sourceSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sourceText,
                        selected && styles.sourceTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
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
        <View style={styles.sectionHeading}>
          <Text style={styles.label}>Danh mục</Text>
          {onAddCategory && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showCategoryForm ? 'Đóng thêm danh mục' : 'Thêm danh mục'
              }
              accessibilityState={{ expanded: showCategoryForm }}
              hitSlop={6}
              onPress={() => {
                setShowCategoryForm((current) => !current);
                setNewCategory('');
              }}
              style={styles.addAction}
            >
              <Feather
                name={showCategoryForm ? 'x' : 'plus'}
                size={16}
                color={colors.earth}
              />
            </Pressable>
          )}
        </View>
        <View style={styles.categoryList}>
          {categories.map((value) => {
            const selected = value === category;
            const builtIns =
              type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
            return (
              <View
                key={value}
                testID={`finance-category-${value}`}
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
                      accessibilityState={{
                        disabled: preferenceBusy,
                        busy: preferenceAction === `remove-category:${value}`,
                      }}
                      disabled={preferenceBusy}
                      hitSlop={6}
                      onPress={() => void removeCategory(value)}
                      style={styles.smallAction}
                    >
                      {preferenceAction === `remove-category:${value}` ? (
                        <ActivityIndicator size="small" color={colors.earth} />
                      ) : (
                        <Feather name="x" size={13} color={colors.muted} />
                      )}
                    </Pressable>
                  )}
              </View>
            );
          })}
        </View>
        {showCategoryForm && onAddCategory && (
          <View style={styles.inlineForm}>
            <TextInput
              accessibilityLabel="Tên danh mục mới"
              placeholder="Tên danh mục mới"
              placeholderTextColor={colors.muted}
              value={newCategory}
              onChangeText={setNewCategory}
              maxLength={50}
              editable={!preferenceBusy}
              style={[styles.input, styles.inlineInput]}
            />
            <Button
              compact
              title="Thêm mục"
              variant="secondary"
              disabled={preferenceBusy || !newCategory.trim()}
              loading={preferenceAction === 'save-category'}
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
        <Button
          title={initialTransaction ? 'Lưu thay đổi' : 'Lưu giao dịch'}
          onPress={() => void submit()}
          loading={busy}
          disabled={!canSave}
        />
      </ScrollView>
    </DialogModal>
  );
}
