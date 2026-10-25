import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { Button } from '../../components/Button';
import { colors, spacing } from '../../theme';
import { styles } from './CardGamesScreen.styles';
import type { VariantGameConfig } from '../../types/cardGame';
import { defaultVariantConfigForGame } from '../../services/cardGames/variantGameProtocol';
import {
  RoomEntryModeSelector,
  roomEntryActions,
} from './RoomEntryModeSelector';

const gameInfo = {
  north: {
    name: 'Tiến lên miền Bắc',
    meta: '2–4 người · 13 lá · So cùng chất',
    note: 'Đôi cùng màu, sảnh cùng chất. Không có đôi thông.',
    pointLabel: 'Điểm mỗi lá còn lại',
    pointTitle: 'Mỗi lá còn lại',
    pointHint: 'Người về nhất nhận',
    icon: 'layers' as const,
  },
  sam: {
    name: 'Sâm',
    meta: '2–4 người · 10 lá · Có báo Sâm',
    note: 'Báo Sâm trước lượt đầu; báo một chỉ để thông tin.',
    pointLabel: 'Điểm mỗi lá còn lại khi báo thất bại hoặc không báo',
    pointTitle: 'Mỗi lá còn lại',
    pointHint: 'Khi báo thất bại hoặc không báo',
    icon: 'zap' as const,
  },
  tan: {
    name: 'Tấn',
    meta: '2–4 người · 8 lá · Chất chủ, tấn và đỡ',
    note: 'Đỡ từng lá hoặc nhận bài; rút nọc theo thứ tự lượt.',
    pointLabel: 'Điểm mỗi lá người thua còn',
    pointTitle: 'Mỗi lá còn lại',
    pointHint: 'Người thua trả',
    icon: 'shield' as const,
  },
};

export function VariantGameEntry({
  game,
  expanded,
  disabled,
  busy,
  onToggle,
  onRules,
  onCreate,
  onJoin,
  onCodeFocus,
}: {
  game: keyof typeof gameInfo;
  expanded: boolean;
  disabled: boolean;
  busy: boolean;
  onToggle: () => void;
  onRules: () => void;
  onCreate: (config: VariantGameConfig) => void;
  onJoin: (code: string) => void;
  onCodeFocus?: () => void;
}) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [code, setCode] = useState('');
  const [pointsPerCard, setPointsPerCard] = useState('1');
  const [remainingTwoPoints, setRemainingTwoPoints] = useState('2');
  const [cutTwoPoints, setCutTwoPoints] = useState('3');
  const [samCallPoints, setSamCallPoints] = useState('20');
  const info = gameInfo[game];
  const parseAmount = (value: string) => (value === '' ? NaN : Number(value));
  const parsedPoints = parseAmount(pointsPerCard);
  const parsedRemainingTwoPoints = parseAmount(remainingTwoPoints);
  const parsedCutTwoPoints = parseAmount(cutTwoPoints);
  const parsedSamCallPoints = parseAmount(samCallPoints);
  const validRate = (value: number) =>
    Number.isSafeInteger(value) && value >= 1 && value <= 1_000_000_000;
  const validExtra = (value: number) =>
    Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;
  const validPoints =
    validRate(parsedPoints) &&
    (game !== 'north' ||
      (validExtra(parsedRemainingTwoPoints) &&
        validExtra(parsedCutTwoPoints))) &&
    (game !== 'sam' || validExtra(parsedSamCallPoints));
  const rows: {
    label: string;
    title: string;
    hint: string;
    value: string;
    onChange: (value: string) => void;
    minimum: number;
  }[] = [
    {
      label: info.pointLabel,
      title: info.pointTitle,
      hint: info.pointHint,
      value: pointsPerCard,
      onChange: setPointsPerCard,
      minimum: 1,
    },
    ...(game === 'north'
      ? [
          {
            label: 'Điểm cộng cho mỗi lá 2 còn lại',
            title: 'Lá 2 còn lại',
            hint: 'Cộng thêm cho mỗi lá',
            value: remainingTwoPoints,
            onChange: setRemainingTwoPoints,
            minimum: 0,
          },
          {
            label: 'Điểm chặt một lá 2 bằng tứ quý',
            title: 'Chặt 2 bằng tứ quý',
            hint: 'Mỗi lá 2 bị chặt',
            value: cutTwoPoints,
            onChange: setCutTwoPoints,
            minimum: 0,
          },
        ]
      : []),
    ...(game === 'sam'
      ? [
          {
            label: 'Điểm báo Sâm với mỗi người',
            title: 'Báo Sâm',
            hint: 'Thắng nhận, thua trả với từng người',
            value: samCallPoints,
            onChange: setSamCallPoints,
            minimum: 0,
          },
        ]
      : []),
  ];
  const invalidRows = rows.filter((row) => {
    const n = parseAmount(row.value);
    return !(Number.isSafeInteger(n) && n >= row.minimum && n <= 1_000_000_000);
  });
  return (
    <View style={[styles.gameCard, expanded && styles.gameCardSelected]}>
      <View style={styles.gameCardHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Chọn ${info.name}`}
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={styles.gameOption}
        >
          <View style={styles.gameOptionIcon}>
            <Feather name={info.icon} size={18} color={colors.earth} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.name}>{info.name}</Text>
            <Text style={styles.gameMeta}>{info.meta}</Text>
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
            accessibilityLabel={`Xem luật ${info.name}`}
            onPress={onRules}
            style={styles.gameExpansionRules}
          >
            <Feather name="book-open" size={16} color={colors.earth} />
          </Pressable>
        )}
      </View>
      {expanded && (
        <View style={styles.gameExpansion}>
          <RoomEntryModeSelector mode={mode} onChange={setMode} />
          {mode === 'create' ? (
            <View style={v.container}>
              <Text style={v.hint}>{info.note}</Text>
              <View style={v.section}>
                <Text style={v.label}>Mức điểm</Text>
                <View style={v.card}>
                  {rows.map((row, index) => (
                    <View
                      key={row.label}
                      style={[v.row, index > 0 && v.rowLine]}
                    >
                      <View style={v.rowCopy}>
                        <Text style={v.rowTitle}>{row.title}</Text>
                        <Text style={v.hint}>{row.hint}</Text>
                      </View>
                      <View
                        style={[
                          v.inputBox,
                          invalidRows.includes(row) && v.inputInvalid,
                        ]}
                      >
                        <AppTextInput
                          accessibilityLabel={`${row.label} ${info.name}`}
                          value={row.value}
                          onChangeText={(next) =>
                            row.onChange(
                              next.replace(/[^0-9]/g, '').slice(0, 10),
                            )
                          }
                          keyboardType="number-pad"
                          editable={!disabled && !busy}
                          selectTextOnFocus
                          placeholder={String(row.minimum)}
                          style={v.input}
                        />
                        <Text style={v.unit}>điểm</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              {invalidRows.map((row) => (
                <Text
                  key={row.label}
                  accessibilityRole="alert"
                  style={styles.error}
                >
                  {row.title}: nhập từ {row.minimum.toLocaleString('vi-VN')} đến
                  1.000.000.000.
                </Text>
              ))}
              <Text style={v.hint}>
                Điểm nội bộ, chỉ áp dụng cho phòng và ván mới.
              </Text>
            </View>
          ) : (
            <AppTextInput
              accessibilityLabel={`Mã phòng ${info.name}`}
              placeholder="Nhập mã phòng 8 ký tự"
              value={code}
              onChangeText={(value) =>
                setCode(value.toUpperCase().replace(/\s/g, '').slice(0, 8))
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
            title={roomEntryActions[mode].title}
            variant={roomEntryActions[mode].variant}
            loading={busy}
            disabled={
              disabled ||
              busy ||
              (mode === 'join' && code.length !== 8) ||
              (mode === 'create' && !validPoints)
            }
            onPress={() => {
              if (mode === 'create' && validPoints)
                onCreate({
                  ...defaultVariantConfigForGame(game),
                  pointsPerCard: parsedPoints,
                  ...(game === 'north' && {
                    remainingTwoPoints: parsedRemainingTwoPoints,
                    cutTwoPoints: parsedCutTwoPoints,
                  }),
                  ...(game === 'sam' && {
                    samCallPoints: parsedSamCallPoints,
                  }),
                } as VariantGameConfig);
              else onJoin(code);
            }}
          />
        </View>
      )}
    </View>
  );
}

const v = StyleSheet.create({
  container: { gap: spacing.md },
  section: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hint: { fontSize: 11, lineHeight: 15, color: colors.muted },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 8,
  },
  rowLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  rowCopy: { flex: 1, gap: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 104,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
    paddingRight: 8,
  },
  inputInvalid: { borderColor: colors.danger },
  input: {
    flex: 1,
    height: 32,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 11, color: colors.muted },
});
