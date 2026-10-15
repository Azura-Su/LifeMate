import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button } from '../../components/Button';
import { DialogCloseButton } from '../../components/DialogCloseButton';
import { DialogModal } from '../../components/DialogModal';
import { FinanceAmountInput } from '../../components/FinanceAmountInput';
import { FinanceAmountWords } from '../../components/FinanceAmountWords';
import { ModalHeader } from '../../components/ModalHeader';
import { AppTextInput as TextInput } from '../../components/AppTextInput';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type RegularFinanceIncomeSource,
  type FinanceTransactionType,
  type FinanceTransaction,
  type SharedExpense,
} from '../../types/finance';
import type { FinanceTransactionTemplate } from '../../services/finance/financePreferences';
import { colors } from '../../theme';
import {
  formatFinanceDate,
  parseFinanceAmount,
  parseFinanceDate,
  formatFinanceAmount,
} from '../../utils/finance';
import { getSharedExpensePersonTotals } from '../../utils/sharedExpense';
import { FinanceDatePicker } from './FinanceDatePicker';
import { styles } from './FinanceTransactionDialog.styles';

type Draft = {
  type: FinanceTransactionType;
  incomeSource: RegularFinanceIncomeSource;
  amount: string;
  category: string;
  note: string;
  date: string;
  sharedExpense?: SharedExpense;
};

type PersonDraft = { id: string; name: string; amount: string };

function makePersonId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

type Props = {
  visible: boolean;
  suspended?: boolean;
  initialType?: FinanceTransactionType;
  initialIncomeSource?: RegularFinanceIncomeSource;
  initialDate?: string;
  initialTransaction?: FinanceTransaction | null;
  incomeCategories?: string[];
  otherIncomeCategories?: string[];
  expenseCategories?: string[];
  templates?: FinanceTransactionTemplate[];
  busy?: boolean;
  onClose: () => void;
  onSave: (draft: Draft, transactionId?: string) => Promise<void>;
  onSaveTemplate?: (
    template: Omit<FinanceTransactionTemplate, 'id'>,
  ) => Promise<void>;
  onAddCategory?: (
    type: FinanceTransactionType,
    name: string,
    incomeSource: RegularFinanceIncomeSource,
  ) => Promise<void>;
  onRemoveCategory?: (
    type: FinanceTransactionType,
    name: string,
    incomeSource: RegularFinanceIncomeSource,
  ) => Promise<void>;
  onRemoveTemplate?: (id: string) => Promise<void>;
};

function capitalizeInitialLetter(value: string) {
  const characters = Array.from(value);
  const index = characters.findIndex(
    (character) => character.toUpperCase() !== character.toLowerCase(),
  );
  if (index < 0) return value;
  characters[index] = characters[index].toUpperCase();
  return characters.join('');
}

export function FinanceTransactionDialog({
  visible,
  suspended = false,
  initialType = 'expense',
  initialIncomeSource = 'company',
  initialDate = formatFinanceDate(),
  initialTransaction = null,
  incomeCategories = [...INCOME_CATEGORIES],
  otherIncomeCategories = [INCOME_CATEGORIES[2]],
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
      (initialType === 'income'
        ? initialIncomeSource === 'other'
          ? INCOME_CATEGORIES[2]
          : INCOME_CATEGORIES[0]
        : EXPENSE_CATEGORIES[0]),
  );
  const [incomeSource, setIncomeSource] = useState<RegularFinanceIncomeSource>(
    initialTransaction?.incomeSource === 'other'
      ? 'other'
      : initialIncomeSource,
  );
  const [note, setNote] = useState('');
  const [date, setDate] = useState(initialDate);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(
    !!initialTransaction?.sharedExpense,
  );
  const [sharedPeople, setSharedPeople] = useState<PersonDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceAction, setPreferenceAction] = useState<string | null>(null);
  const sourceCategories =
    type === 'expense'
      ? expenseCategories
      : incomeSource === 'other'
        ? otherIncomeCategories
        : incomeCategories;
  const editingOriginalSource =
    initialTransaction?.type === type &&
    (type === 'expense' ||
      (initialTransaction.incomeSource === 'other' ? 'other' : 'company') ===
        incomeSource);
  const categories =
    editingOriginalSource &&
    initialTransaction &&
    !sourceCategories.includes(initialTransaction.category)
      ? [...sourceCategories, initialTransaction.category]
      : sourceCategories;
  const categoriesPerRow = type === 'expense' ? 4 : 3;
  const categoryRows = Array.from(
    { length: Math.ceil(categories.length / categoriesPerRow) },
    (_, index) =>
      categories.slice(
        index * categoriesPerRow,
        (index + 1) * categoriesPerRow,
      ),
  );
  const visibleTemplates = templates.filter(
    (template) =>
      template.type === type &&
      (type !== 'income' ||
        (template.incomeSource ?? 'company') === incomeSource),
  );
  const parsedAmount = parseFinanceAmount(amount);
  const canSave =
    parsedAmount !== null &&
    parseFinanceDate(date) !== null &&
    !!category.trim() &&
    !busy &&
    !preferenceBusy;
  const parsedDate = parseFinanceDate(date);
  const totalOwed = sharedPeople.reduce(
    (sum, person) => sum + (parseFinanceAmount(person.amount) ?? 0),
    0,
  );
  const existingReceipts = initialTransaction?.sharedExpense?.receipts ?? [];
  const pickerValue = parsedDate === null ? new Date() : new Date(parsedDate);

  useEffect(() => {
    if (visible) {
      setType(initialTransaction?.type ?? initialType);
      setAmount(initialTransaction ? String(initialTransaction.amount) : '');
      setCategory(
        initialTransaction?.category ??
          (initialType === 'income'
            ? initialIncomeSource === 'other'
              ? INCOME_CATEGORIES[2]
              : INCOME_CATEGORIES[0]
            : EXPENSE_CATEGORIES[0]),
      );
      setIncomeSource(
        initialTransaction?.incomeSource === 'other'
          ? 'other'
          : initialIncomeSource,
      );
      setNote(capitalizeInitialLetter(initialTransaction?.note ?? ''));
      setDate(
        initialTransaction
          ? formatFinanceDate(new Date(initialTransaction.createdAt))
          : initialDate,
      );
      setDatePickerVisible(false);
      setSharingEnabled(!!initialTransaction?.sharedExpense);
      setSharedPeople(
        initialTransaction?.sharedExpense?.participants.map((person) => ({
          id: person.id,
          name: person.name,
          amount: String(person.owedAmount),
        })) ?? [],
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

  function openDatePicker() {
    if (busy || preferenceBusy) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerValue,
        mode: 'date',
        display: 'calendar',
        onChange: (event, selectedDate) => {
          if (event.type === 'set' && selectedDate) {
            setDate(formatFinanceDate(selectedDate));
            setError(null);
          }
        },
      });
      return;
    }
    setDatePickerVisible(true);
  }

  async function applyTemplate(template: FinanceTransactionTemplate) {
    setType(template.type);
    setIncomeSource(template.incomeSource ?? 'company');
    setAmount(String(template.amount));
    setCategory(template.category);
    setNote(capitalizeInitialLetter(template.note));
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
    let sharedExpense: SharedExpense | undefined;
    if (type === 'expense' && sharingEnabled) {
      const gross = parseFinanceAmount(amount)!;
      if (sharedPeople.length === 0) {
        setError('Thêm ít nhất một người cần trả lại.');
        return;
      }
      const participants = sharedPeople.map((person) => ({
        id: person.id,
        name: person.name.trim(),
        owedAmount: parseFinanceAmount(person.amount) ?? 0,
      }));
      if (participants.some((person) => !person.name || !person.owedAmount)) {
        setError('Nhập tên và số tiền cần trả của từng người.');
        return;
      }
      if (totalOwed > gross) {
        setError('Tổng tiền cần trả lại không thể vượt số tiền đã chi.');
        return;
      }
      if (
        participants.some(
          (person) =>
            person.owedAmount <
            getSharedExpensePersonTotals(
              initialTransaction?.sharedExpense ?? {
                participants: [],
                receipts: [],
              },
              person.id,
            ).received,
        ) ||
        existingReceipts.some(
          (receipt) =>
            !participants.some((person) => person.id === receipt.participantId),
        )
      ) {
        setError('Không thể giảm phần cần trả thấp hơn số đã nhận.');
        return;
      }
      sharedExpense = { participants, receipts: existingReceipts };
    } else if (existingReceipts.length > 0) {
      setError('Hãy xóa các lần nhận lại trước khi bỏ phần chia khoản chi.');
      return;
    }
    try {
      await onSave(
        {
          type,
          incomeSource,
          amount,
          category,
          note: capitalizeInitialLetter(note.trim()),
          date,
          sharedExpense,
        },
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
        name: capitalizeInitialLetter(templateName.trim()),
        type,
        amount: value,
        category,
        note: capitalizeInitialLetter(note.trim()),
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
      const categoryName = capitalizeInitialLetter(newCategory.trim());
      await onAddCategory(type, categoryName, incomeSource);
      setCategory(categoryName);
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
      await onRemoveCategory(type, value, incomeSource);
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
      onRequestClose={
        busy || preferenceBusy
          ? undefined
          : datePickerVisible
            ? () => setDatePickerVisible(false)
            : onClose
      }
      style={
        Platform.OS === 'ios' && datePickerVisible
          ? styles.pickerDialog
          : styles.dialog
      }
    >
      <View
        style={[styles.header, datePickerVisible && styles.hidden]}
        pointerEvents={datePickerVisible ? 'none' : 'auto'}
      >
        <ModalHeader
          title={initialTransaction ? 'Sửa giao dịch' : 'Thêm giao dịch'}
          accessibilityLabel={
            initialTransaction ? 'Đóng sửa giao dịch' : 'Đóng thêm giao dịch'
          }
          disabled={busy || preferenceBusy}
          onClose={onClose}
        />
      </View>
      <ScrollView
        style={datePickerVisible ? styles.hidden : undefined}
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
                    {onRemoveTemplate && (
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
                  onChangeText={(value) =>
                    setTemplateName(capitalizeInitialLetter(value))
                  }
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
                accessibilityState={{
                  selected,
                  disabled: value === 'income' && existingReceipts.length > 0,
                }}
                disabled={value === 'income' && existingReceipts.length > 0}
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
        <View style={styles.amountDateGroup}>
          <View style={styles.amountDateRow}>
            <View style={styles.amountDateColumn}>
              <Text style={styles.label}>Số tiền</Text>
              <FinanceAmountInput
                accessibilityLabel="Số tiền"
                value={amount}
                onChangeText={(value) => {
                  setAmount(value);
                  setError(null);
                }}
                editable={!busy}
                compact
              />
            </View>
            <View style={styles.amountDateColumn}>
              <Text style={styles.label}>Ngày giao dịch</Text>
              <View style={styles.dateField}>
                <TextInput
                  accessibilityLabel="Ngày giao dịch"
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={colors.muted}
                  value={date}
                  onPressIn={openDatePicker}
                  onChangeText={(value) => {
                    setDate(value);
                    setError(null);
                  }}
                  editable={!busy && !preferenceBusy}
                  showSoftInputOnFocus={false}
                  maxLength={10}
                  style={styles.dateFieldInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mở lịch chọn ngày giao dịch"
                  accessibilityHint="Mở lịch để chọn ngày"
                  accessibilityState={{ disabled: busy || preferenceBusy }}
                  disabled={busy || preferenceBusy}
                  onPress={openDatePicker}
                  style={styles.datePickerAction}
                >
                  <Feather name="calendar" size={14} color={colors.earth} />
                </Pressable>
              </View>
            </View>
          </View>
          <FinanceAmountWords value={amount} />
        </View>
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
        <View style={styles.categoryGrid}>
          {categoryRows.map((row) => (
            <View key={row[0]} style={styles.categoryRow}>
              {row.map((value) => {
                const selected = value === category;
                const builtIns =
                  type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
                return (
                  <View
                    key={value}
                    testID={`finance-category-${value}`}
                    style={[
                      styles.category,
                      selected && styles.categorySelected,
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setCategory(value)}
                      style={[
                        styles.categoryAction,
                        type === 'expense' && styles.expenseCategoryAction,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          styles.categoryLabel,
                          type === 'expense' && styles.expenseCategoryText,
                          selected && styles.categoryTextSelected,
                        ]}
                      >
                        {value}
                      </Text>
                    </Pressable>
                    {sourceCategories.includes(value) &&
                      !builtIns.some((builtIn) => builtIn === value) &&
                      onRemoveCategory && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Xóa danh mục ${value}`}
                          accessibilityState={{
                            disabled: preferenceBusy,
                            busy:
                              preferenceAction === `remove-category:${value}`,
                          }}
                          disabled={preferenceBusy}
                          hitSlop={6}
                          onPress={() => void removeCategory(value)}
                          style={styles.smallAction}
                        >
                          {preferenceAction === `remove-category:${value}` ? (
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
                );
              })}
              {row.length === 1 && <View style={styles.categorySpacer} />}
            </View>
          ))}
        </View>
        {showCategoryForm && onAddCategory && (
          <View style={styles.inlineForm}>
            <TextInput
              accessibilityLabel="Tên danh mục mới"
              placeholder="Tên danh mục mới"
              placeholderTextColor={colors.muted}
              value={newCategory}
              onChangeText={(value) =>
                setNewCategory(capitalizeInitialLetter(value))
              }
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
          onChangeText={(value) => setNote(capitalizeInitialLetter(value))}
          editable={!busy}
          maxLength={120}
          style={styles.input}
        />
        {type === 'expense' && (
          <View style={styles.sharingSection}>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Có người cần trả lại"
              accessibilityState={{
                checked: sharingEnabled,
                disabled: existingReceipts.length > 0,
              }}
              disabled={busy || existingReceipts.length > 0}
              onPress={() => {
                if (!sharingEnabled && sharedPeople.length === 0)
                  setSharedPeople([
                    { id: makePersonId(), name: '', amount: '' },
                  ]);
                setSharingEnabled(!sharingEnabled);
              }}
              style={styles.sharingToggle}
            >
              <Text style={styles.label}>Có người cần trả lại</Text>
              <Feather
                name={sharingEnabled ? 'check-circle' : 'circle'}
                size={20}
                color={sharingEnabled ? colors.success : colors.muted}
              />
            </Pressable>
            {sharingEnabled && (
              <View style={styles.sharingContent}>
                {sharedPeople.map((person, index) => {
                  const alreadyReceived = getSharedExpensePersonTotals(
                    initialTransaction?.sharedExpense ?? {
                      participants: [],
                      receipts: [],
                    },
                    person.id,
                  ).received;
                  return (
                    <View key={person.id} style={styles.personBlock}>
                      <View style={styles.sectionHeading}>
                        <Text style={styles.label}>Người {index + 1}</Text>
                        {alreadyReceived === 0 && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Bỏ người ${index + 1}`}
                            onPress={() =>
                              setSharedPeople((current) =>
                                current.filter(({ id }) => id !== person.id),
                              )
                            }
                            style={styles.addAction}
                          >
                            <Feather name="x" size={16} color={colors.earth} />
                          </Pressable>
                        )}
                      </View>
                      <View style={styles.personRow}>
                        <TextInput
                          accessibilityLabel={`Tên người ${index + 1}`}
                          placeholder="Tên người"
                          placeholderTextColor={colors.muted}
                          value={person.name}
                          onChangeText={(name) =>
                            setSharedPeople((current) =>
                              current.map((item) =>
                                item.id === person.id
                                  ? { ...item, name }
                                  : item,
                              ),
                            )
                          }
                          maxLength={100}
                          editable={!busy}
                          style={[styles.input, styles.personName]}
                        />
                        <View style={styles.personAmount}>
                          <FinanceAmountInput
                            accessibilityLabel={`Số tiền người ${index + 1} cần trả`}
                            value={person.amount}
                            onChangeText={(value) =>
                              setSharedPeople((current) =>
                                current.map((item) =>
                                  item.id === person.id
                                    ? { ...item, amount: value }
                                    : item,
                                ),
                              )
                            }
                            editable={!busy}
                            compact
                          />
                        </View>
                      </View>
                      <FinanceAmountWords value={person.amount} />
                      {alreadyReceived > 0 && (
                        <Text style={styles.sharingHint}>
                          Đã nhận {formatFinanceAmount(alreadyReceived)}
                        </Text>
                      )}
                    </View>
                  );
                })}
                {sharedPeople.length < 20 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Thêm người cần trả lại"
                    onPress={() =>
                      setSharedPeople((current) => [
                        ...current,
                        { id: makePersonId(), name: '', amount: '' },
                      ])
                    }
                    style={styles.addPerson}
                  >
                    <Feather name="plus" size={16} color={colors.earth} />
                    <Text style={styles.addPersonText}>Thêm người</Text>
                  </Pressable>
                )}
                {parsedAmount !== null && (
                  <Text
                    style={
                      totalOwed > parsedAmount
                        ? styles.error
                        : styles.sharingHint
                    }
                  >
                    {totalOwed > parsedAmount
                      ? 'Tổng tiền cần trả lại vượt số đã chi.'
                      : `Phần của tôi dự kiến: ${formatFinanceAmount(parsedAmount - totalOwed)}`}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
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
      {Platform.OS === 'ios' && datePickerVisible && (
        <>
          <View style={styles.pickerHeader}>
            <Text accessibilityRole="header" style={styles.pickerTitle}>
              Chọn ngày giao dịch
            </Text>
            <DialogCloseButton
              accessibilityLabel="Đóng chọn ngày giao dịch"
              onPress={() => setDatePickerVisible(false)}
            />
          </View>
          <FinanceDatePicker
            value={pickerValue}
            onChange={(selectedDate) => {
              setDate(formatFinanceDate(selectedDate));
              setError(null);
              setDatePickerVisible(false);
            }}
          />
        </>
      )}
    </DialogModal>
  );
}
