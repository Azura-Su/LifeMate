import Feather from '@expo/vector-icons/Feather';
import { Pressable, Switch, Text, View } from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { colors } from '../../theme';
import {
  DEFAULT_PHOM_CONFIG,
  DEFAULT_PHOM_OPTIONS,
  PHOM_THREE_FEED_RULE,
  PHOM_RATES,
  parsePhomRates,
  phomRates,
  visiblePhomOptions,
} from '../../services/cardGames/phomConfig';
import { styles } from './CardGamesScreen.styles';
import { phomStyles as ps } from './PhomTable.styles';
import type { PhomOptions } from '../../types/phom';
const RATE_GROUPS = [
  { title: 'Thứ hạng', icon: 'award' },
  { title: 'Ăn bài', icon: 'layers' },
  { title: 'Ù và đền', icon: 'zap' },
] as const;

export function PhomGameSettings({
  rates,
  onChange,
  disabled,
  options,
  onOptionsChange,
}: {
  rates: Record<string, string>;
  onChange: (rates: Record<string, string>) => void;
  disabled: boolean;
  options: PhomOptions;
  onOptionsChange: (options: PhomOptions) => void;
}) {
  const valid = !!parsePhomRates(rates);
  return (
    <>
      <View style={ps.rateIntro}>
        <Text style={[styles.rateHint, ps.rateIntroText]}>
          Mức 0 sẽ tắt khoản đó. Áp dụng từ ván mới.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Khôi phục mức mặc định"
          disabled={disabled}
          hitSlop={8}
          onPress={() => {
            onChange(phomRates(DEFAULT_PHOM_CONFIG));
            onOptionsChange({ ...DEFAULT_PHOM_OPTIONS });
          }}
          style={ps.rateReset}
        >
          <Feather name="rotate-ccw" size={12} color={colors.earth} />
          <Text style={ps.rateResetText}>Mặc định</Text>
        </Pressable>
      </View>
      <Text style={ps.rateGroupLabel}>Luật chơi</Text>
      <View style={ps.rateGroup}>
        <Text style={[ps.optionHint, ps.ruleNote]}>{PHOM_THREE_FEED_RULE}</Text>
        {visiblePhomOptions(options).map(({ key, label, hint }) => (
          <View key={key} style={[ps.rateRow, ps.rateRowLine]}>
            <View style={ps.optionCopy}>
              <Text style={ps.optionLabel}>{label}</Text>
              <Text style={ps.optionHint}>{hint}</Text>
            </View>
            <Switch
              accessibilityLabel={label}
              accessibilityHint={hint}
              accessibilityState={{ checked: options[key], disabled }}
              disabled={disabled}
              value={options[key]}
              onValueChange={(value) => {
                if (!disabled) onOptionsChange({ ...options, [key]: value });
              }}
              trackColor={{ true: colors.earth }}
              style={ps.optionSwitch}
            />
          </View>
        ))}
      </View>
      <Text style={ps.rateGroupLabel}>Mức tiền</Text>
      <View style={ps.rateGroup}>
        {RATE_GROUPS.map(({ title }, groupIndex) => (
          <View
            key={title}
            style={[ps.rateSection, groupIndex > 0 && ps.rateRowLine]}
          >
            <Text style={ps.rateSectionTitle}>{title}</Text>
            {PHOM_RATES.filter((r) => r.group === title).map((rate, index) => {
              const off = rates[rate.key] === '0';
              return (
                <View
                  key={rate.key}
                  style={[ps.rateRow, index > 0 && ps.rateRowLine]}
                >
                  <Text style={[ps.rateLabel, off && ps.rateLabelOff]}>
                    {rate.label}
                  </Text>
                  <AppTextInput
                    accessibilityLabel={`Mức ${rate.label}`}
                    value={rates[rate.key]}
                    onChangeText={(value) =>
                      onChange({
                        ...rates,
                        [rate.key]: value.replace(/\D/g, '').slice(0, 10),
                      })
                    }
                    editable={!disabled}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    style={[
                      ps.rateInput,
                      off && ps.rateInputOff,
                      rates[rate.key] === '' && ps.rateInputInvalid,
                    ]}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {!valid && (
        <Text accessibilityRole="alert" style={styles.error}>
          Nhập số nguyên từ 0 đến 1.000.000.000 cho từng loại.
        </Text>
      )}
    </>
  );
}
