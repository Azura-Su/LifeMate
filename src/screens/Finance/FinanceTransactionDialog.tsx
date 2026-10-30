import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutRectangle,
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
import { actionIconStyles } from '../../theme/actionIcons';
import {
  formatFinanceDate,
  parseFinanceAmount,
  parseFinanceDate,
} from '../../utils/finance';
import { getSharedExpensePersonTotals } from '../../utils/sharedExpense';
import {
  createExpenseSplitDraft,
  previewExpenseSplit,
} from '../../utils/sharedExpenseSplit';
import { SharedExpenseSplitEditor } from './SharedExpenseSplitEditor';
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

function makePersonId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

type Props = {
  visible: boolean;
  instantOpen?: boolean;
  onShow?: () => void;
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
  instantOpen = false,
  onShow,
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
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [sourceMenuAnchor, setSourceMenuAnchor] =
    useState<LayoutRectangle | null>(null);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categoryMenuAnchor, setCategoryMenuAnchor] =
    useState<LayoutRectangle | null>(null);
  const [categoryMenuAbove, setCategoryMenuAbove] = useState(false);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const scrollOffsetRef = useRef(0);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(initialDate);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(
    !!initialTransaction?.sharedExpense,
  );
  const [splitDraft, setSplitDraft] = useState(() =>
    createExpenseSplitDraft(initialTransaction?.sharedExpense),
  );
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
  const categoryMenuHeight = Math.min(categories.length * 44 + 2, 220);
  const visibleTemplates = templates.filter(
    (template) =>
      template.type === type &&
      (type !== 'income' ||
        (template.incomeSource ?? 'company') === incomeSource),
  );
  const parsedAmount = parseFinanceAmount(amount);
  const splitPreview = previewExpenseSplit(parsedAmount, splitDraft);
  const sharedPeople = splitPreview.people;
  const canSave =
    parsedAmount !== null &&
    parseFinanceDate(date) !== null &&
    !!category.trim() &&
    !busy &&
    !preferenceBusy &&
    !(type === 'expense' && sharingEnabled && splitPreview.error);
  const parsedDate = parseFinanceDate(date);
  const totalOwed = sharedPeople.reduce(
    (sum, person) => sum + (parseFinanceAmount(person.amount) ?? 0),
    0,
  );
  const existingReceipts = initialTransaction?.sharedExpense?.receipts ?? [];
  const pickerValue = parsedDate === null ? new Date() : new Date(parsedDate);
  const initialTransactionRef = useRef(initialTransaction);
  initialTransactionRef.current = initialTransaction;
  const initialTransactionId = initialTransaction?.id;

  useEffect(() => {
    if (visible) {
      const transaction = initialTransactionRef.current;
      setType(transaction?.type ?? initialType);
      setAmount(transaction ? String(transaction.amount) : '');
      setCategory(
        transaction?.category ??
          (initialType === 'income'
            ? initialIncomeSource === 'other'
              ? INCOME_CATEGORIES[2]
              : INCOME_CATEGORIES[0]
            : EXPENSE_CATEGORIES[0]),
      );
      setIncomeSource(
        transaction?.incomeSource === 'other'
          ? 'other'
          : initialIncomeSource,
      );
      setSourceMenuOpen(false);
      setCategoryMenuOpen(false);
      setNote(capitalizeInitialLetter(transaction?.note ?? ''));
      setDate(
        transaction
          ? formatFinanceDate(new Date(transaction.createdAt))
          : initialDate,
      );
      setDatePickerVisible(false);
      setSharingEnabled(!!transaction?.sharedExpense);
      setSplitDraft(createExpenseSplitDraft(transaction?.sharedExpense));
      setError(null);
      setTemplateName('');
      setNewCategory('');
      setShowCategoryForm(false);
      setShowTemplateForm(false);
    }
  }, [
    initialDate,
    initialIncomeSource,
    initialTransactionId,
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
    setSourceMenuOpen(false);
    setCategoryMenuOpen(false);
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
      if (splitPreview.error) {
        setError(splitPreview.error);
        return;
      }
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
      if (!Number.isSafeInteger(totalOwed) || totalOwed > gross) {
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
      if (category === value)
        setCategory(
          sourceCategories.find((item) => item !== value) ?? builtIns[0],
        );
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
      animationType={instantOpen ? 'none' : 'fade'}
      onShow={onShow}
      onRequestClose={
        busy || preferenceBusy
          ? undefined
          : datePickerVisible
            ? () => setDatePickerVisible(false)
            : categoryMenuOpen
              ? () => setCategoryMenuOpen(false)
              : sourceMenuOpen
                ? () => setSourceMenuOpen(false)
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
        onLayout={({ nativeEvent: { layout } }) =>
          setScrollViewportHeight(layout.height)
        }
        onScroll={({ nativeEvent }) => {
          scrollOffsetRef.current = nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
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
                  style={[
                    styles.addAction,
                    showTemplateForm && actionIconStyles.editCompact,
                  ]}
                >
                  <Feather
                    name={showTemplateForm ? 'x' : 'plus'}
                    size={19}
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
                          <Feather name="x" size={13} color={colors.danger} />
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
                  setSourceMenuOpen(false);
                  setCategoryMenuOpen(false);
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
          <View
            testID="finance-income-source-section"
            style={styles.incomeSourceSection}
            onLayout={({ nativeEvent: { layout } }) =>
              setSourceMenuAnchor((current) =>
                current?.x === layout.x &&
                current.y === layout.y &&
                current.width === layout.width &&
                current.height === layout.height
                  ? current
                  : layout,
              )
            }
          >
            <Text style={styles.label}>Nguồn thu</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Nguồn thu: ${incomeSource === 'company' ? 'Công ty' : 'Ngoài công ty'}`}
              accessibilityState={{
                expanded: sourceMenuOpen,
                disabled: busy || preferenceBusy,
              }}
              disabled={busy || preferenceBusy}
              onPress={() => {
                setCategoryMenuOpen(false);
                setSourceMenuOpen((open) => !open);
              }}
              style={styles.sourceTrigger}
            >
              <Text style={styles.sourceTriggerText}>
                {incomeSource === 'company' ? 'Công ty' : 'Ngoài công ty'}
              </Text>
              <Feather
                name={sourceMenuOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.muted}
              />
            </Pressable>
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
        <View
          testID="finance-category-section"
          style={styles.categorySection}
          onLayout={({ nativeEvent: { layout } }) =>
            setCategoryMenuAnchor((current) =>
              current?.x === layout.x &&
              current.y === layout.y &&
              current.width === layout.width &&
              current.height === layout.height
                ? current
                : layout,
            )
          }
        >
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
                  setCategoryMenuOpen(false);
                  setShowCategoryForm((current) => !current);
                  setNewCategory('');
                }}
                style={[
                  styles.addAction,
                  showCategoryForm && actionIconStyles.editCompact,
                ]}
              >
                <Feather
                  name={showCategoryForm ? 'x' : 'plus'}
                  size={19}
                  color={colors.earth}
                />
              </Pressable>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Danh mục: ${category}`}
            accessibilityState={{
              expanded: categoryMenuOpen,
              disabled: busy || preferenceBusy,
            }}
            disabled={busy || preferenceBusy}
            onPress={() => {
              setSourceMenuOpen(false);
              if (!categoryMenuOpen && categoryMenuAnchor) {
                const availableBelow =
                  scrollOffsetRef.current +
                  scrollViewportHeight -
                  categoryMenuAnchor.y -
                  categoryMenuAnchor.height;
                const availableAbove =
                  categoryMenuAnchor.y - scrollOffsetRef.current;
                setCategoryMenuAbove(
                  availableBelow < categoryMenuHeight + 4 &&
                    availableAbove > availableBelow,
                );
              }
              setCategoryMenuOpen((open) => !open);
            }}
            style={styles.sourceTrigger}
          >
            <Text style={styles.sourceTriggerText} numberOfLines={1}>
              {category}
            </Text>
            <Feather
              name={categoryMenuOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.muted}
            />
          </Pressable>
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
              disabled={busy || preferenceBusy || existingReceipts.length > 0}
              onPress={() => {
                if (!sharingEnabled && sharedPeople.length === 0)
                  setSplitDraft((current) => ({
                    ...current,
                    people: [
                      {
                        id: makePersonId(),
                        name: '',
                        amount: '',
                        portions: '1',
                      },
                    ],
                  }));
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
              <SharedExpenseSplitEditor
                draft={splitDraft}
                onChange={setSplitDraft}
                gross={parsedAmount}
                existing={initialTransaction?.sharedExpense}
                disabled={busy || preferenceBusy}
                onAddPerson={() =>
                  setSplitDraft((current) =>
                    current.people.length >= 20
                      ? current
                      : {
                          ...current,
                          people: [
                            ...current.people,
                            {
                              id: makePersonId(),
                              name: '',
                              amount: '',
                              portions: '1',
                            },
                          ],
                        },
                  )
                }
              />
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
        {(sourceMenuOpen || categoryMenuOpen) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng danh sách lựa chọn"
            onPress={() => {
              setSourceMenuOpen(false);
              setCategoryMenuOpen(false);
            }}
            style={styles.sourceMenuDismissLayer}
          />
        )}
        {sourceMenuOpen && sourceMenuAnchor && (
          <View
            style={[
              styles.sourceMenu,
              {
                top: sourceMenuAnchor.y + sourceMenuAnchor.height + 4,
                left: sourceMenuAnchor.x,
                width: sourceMenuAnchor.width,
              },
            ]}
          >
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
                  accessibilityLabel={`Chọn nguồn thu: ${label}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    if (value !== incomeSource) {
                      setIncomeSource(value);
                      setCategory(
                        value === 'company'
                          ? INCOME_CATEGORIES[0]
                          : INCOME_CATEGORIES[2],
                      );
                    }
                    setSourceMenuOpen(false);
                  }}
                  style={[
                    styles.sourceOption,
                    selected && styles.sourceOptionSelected,
                  ]}
                >
                  <Text style={styles.sourceOptionText}>{label}</Text>
                  {selected && (
                    <Feather name="check" size={17} color={colors.earth} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
        {categoryMenuOpen && categoryMenuAnchor && (
          <View
            style={[
              styles.sourceMenu,
              {
                top: categoryMenuAbove
                  ? categoryMenuAnchor.y - categoryMenuHeight - 4
                  : categoryMenuAnchor.y + categoryMenuAnchor.height + 4,
                left: categoryMenuAnchor.x,
                width: categoryMenuAnchor.width,
                height: categoryMenuHeight,
              },
            ]}
          >
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={styles.categoryMenuScroll}
            >
              {categories.map((value) => {
                const selected = value === category;
                const builtIns =
                  type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
                const removable =
                  sourceCategories.includes(value) &&
                  !builtIns.some((builtIn) => builtIn === value) &&
                  !!onRemoveCategory;
                return (
                  <View
                    key={value}
                    testID={`finance-category-${value}`}
                    style={[
                      styles.categoryOptionRow,
                      selected && styles.sourceOptionSelected,
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Chọn danh mục: ${value}`}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setCategory(value);
                        setCategoryMenuOpen(false);
                      }}
                      style={styles.categoryOption}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.sourceOptionText,
                          selected && styles.categoryOptionSelectedText,
                        ]}
                      >
                        {value}
                      </Text>
                      {selected && (
                        <Feather name="check" size={17} color={colors.earth} />
                      )}
                    </Pressable>
                    {removable && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Xóa danh mục ${value}`}
                        accessibilityState={{
                          disabled: preferenceBusy,
                          busy: preferenceAction === `remove-category:${value}`,
                        }}
                        disabled={preferenceBusy}
                        onPress={() => void removeCategory(value)}
                        style={styles.categoryOptionDelete}
                      >
                        {preferenceAction === `remove-category:${value}` ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.earth}
                          />
                        ) : (
                          <Feather name="x" size={16} color={colors.danger} />
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
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
