import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { colors, typography } from '../../theme';

type Props = {
  title: string;
  count: number;
  itemLabel: string;
  value: string;
  onChangeText: (value: string) => void;
  searchLabel: string;
  placeholder: string;
  searchable?: boolean;
  scope?: string;
  busy?: boolean;
};

export function FinanceListSearch({
  title,
  count,
  itemLabel,
  value,
  onChangeText,
  searchLabel,
  placeholder,
  searchable = true,
  scope,
  busy = false,
}: Props) {
  const [open, setOpen] = useState(Boolean(value.trim()));
  const searching = value.trim().length > 0;

  function close() {
    onChangeText('');
    setOpen(false);
    Keyboard.dismiss();
  }

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text accessibilityRole="header" style={styles.title}>
            {searching ? 'Kết quả tìm kiếm' : title}
          </Text>
          {searching && !!scope && (
            <Text numberOfLines={1} style={styles.scope}>
              {scope}
            </Text>
          )}
        </View>
        <View style={styles.headingActions}>
          <Text style={styles.count}>
            {busy
              ? 'Đang tìm…'
              : searching
                ? `${count} kết quả`
                : count === 0
                  ? 'Chưa phát sinh'
                  : `${count} ${itemLabel}`}
          </Text>
          {!open && searchable && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mở tìm kiếm ${searchLabel}`}
              onPress={() => setOpen(true)}
              style={styles.openButton}
            >
              <Feather name="search" size={19} color={colors.earth} />
            </Pressable>
          )}
        </View>
      </View>
      {open && (
        <View style={styles.field}>
          <Feather name="search" size={17} color={colors.muted} />
          <AppTextInput
            accessibilityLabel={`Tìm ${searchLabel}`}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={() => Keyboard.dismiss()}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng tìm kiếm"
            onPress={close}
            style={styles.closeButton}
          >
            <Feather name="x" size={18} color={colors.muted} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  heading: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headingText: { flex: 1, minWidth: 0 },
  title: { ...typography.heading, fontSize: 16, lineHeight: 23 },
  scope: { ...typography.small, fontSize: 11 },
  headingActions: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  count: { ...typography.small, fontSize: 11 },
  openButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    color: colors.ink,
    fontSize: 14,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
