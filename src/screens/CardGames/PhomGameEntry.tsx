import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { Button } from '../../components/Button';
import { colors } from '../../theme';
import type { PhomConfig } from '../../types/phom';
import {
  DEFAULT_PHOM_CONFIG,
  DEFAULT_PHOM_OPTIONS,
  phomRates,
  parsePhomRates,
} from '../../services/cardGames/phomConfig';
import { styles } from './CardGamesScreen.styles';
import { PhomGameSettings } from './PhomGameSettings';

export function PhomGameEntry({
  expanded,
  disabled,
  busy,
  onToggle,
  onRules,
  onCreate,
  onJoin,
  onCodeFocus,
}: {
  expanded: boolean;
  disabled: boolean;
  busy: boolean;
  onToggle: () => void;
  onRules: () => void;
  onCreate: (config: PhomConfig) => void;
  onJoin: (code: string) => void;
  onCodeFocus?: () => void;
}) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [code, setCode] = useState('');
  const [rates, setRates] = useState(() => phomRates(DEFAULT_PHOM_CONFIG));
  const [options, setOptions] = useState(() => ({ ...DEFAULT_PHOM_OPTIONS }));
  const config = parsePhomRates(rates, options);
  const valid = !!config;
  return (
    <View style={[styles.gameCard, expanded && styles.gameCardSelected]}>
      <View style={styles.gameCardHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn Phỏm"
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={styles.gameOption}
        >
          <View style={styles.gameOptionIcon}>
            <Feather name="grid" size={18} color={colors.earth} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.name}>Phỏm</Text>
            <Text style={styles.gameMeta}>
              2–4 người · Ăn, bốc, hạ và gửi bài
            </Text>
          </View>
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.muted}
          />
        </Pressable>
        {expanded && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xem luật Phỏm"
            onPress={onRules}
            style={styles.gameExpansionRules}
          >
            <Feather name="book-open" size={16} color={colors.earth} />
          </Pressable>
        )}
      </View>
      {expanded && (
        <View style={styles.gameExpansion}>
          <View style={styles.entryModes}>
            {(['create', 'join'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === value }}
                onPress={() => setMode(value)}
                style={[
                  styles.entryMode,
                  mode === value && styles.entryModeSelected,
                ]}
              >
                <Text
                  style={[
                    styles.entryModeTitle,
                    mode === value && styles.entryModeTitleSelected,
                  ]}
                >
                  {value === 'create' ? 'Tạo mới' : 'Tham gia'}
                </Text>
              </Pressable>
            ))}
          </View>
          {mode === 'create' ? (
            <>
              <PhomGameSettings
                options={options}
                onOptionsChange={setOptions}
                rates={rates}
                onChange={setRates}
                disabled={disabled || busy}
              />
            </>
          ) : (
            <AppTextInput
              accessibilityLabel="Mã phòng Phỏm"
              placeholder="Mã phòng 8 ký tự"
              value={code}
              onChangeText={(v) =>
                setCode(v.toUpperCase().replace(/\s/g, '').slice(0, 8))
              }
              onFocus={onCodeFocus}
              editable={!disabled && !busy}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              style={[styles.input, styles.codeInput]}
            />
          )}
          <Button
            title={mode === 'create' ? 'Tạo phòng Phỏm' : 'Vào phòng Phỏm'}
            loading={busy}
            disabled={
              disabled ||
              busy ||
              (mode === 'create' ? !valid : code.length !== 8)
            }
            onPress={() => {
              if (mode === 'create' && config) onCreate(config);
              else if (mode === 'join') onJoin(code);
            }}
          />
        </View>
      )}
    </View>
  );
}
