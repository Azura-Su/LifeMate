import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native';
import { Button } from '../../components/Button';
import { AppTextInput } from '../../components/AppTextInput';
import { DialogModal } from '../../components/DialogModal';
import { ModalHeader } from '../../components/ModalHeader';
import { colors, layout, spacing, typography } from '../../theme';
import { isSouthRules } from '../../services/cardGames/tienLenConfig';
import type { PhomConfig } from '../../types/phom';
import type { GameIntent, VariantGameConfig } from '../../types/cardGame';
import {
  DEFAULT_PHOM_CONFIG,
  phomRates,
  parsePhomRates,
  phomOptions,
} from '../../services/cardGames/phomConfig';
import { PhomGameSettings } from './PhomGameSettings';
import type { SouthRules } from '../../types/tienLen';
import { TienLenGameSettings } from './TienLenGameSettings';

type Props = {
  version: number;
  blocked: boolean;
  onClose: () => void;
  onSave: (
    intent: Extract<
      GameIntent,
      {
        type: 'set-south-rules' | 'set-phom-rules' | 'set-variant-rules';
      }
    >,
    version: number,
  ) => void;
} & (
  | { gameKind: 'south'; rules: SouthRules }
  | { gameKind: 'phom'; rules: PhomConfig }
  | {
      gameKind: 'north' | 'sam' | 'tan';
      rules: VariantGameConfig;
    }
);
function draftFrom(props: Props) {
  return {
    version: props.version,
    amount: props.gameKind === 'south' ? String(props.rules.amountPerCard) : '',
    fine:
      props.gameKind === 'south'
        ? String(props.rules.southConfig.cutTwoAmount)
        : '',
    instantWinFine:
      props.gameKind === 'south'
        ? String(props.rules.southConfig.instantWinAmount ?? 0)
        : '',
    finishMode:
      props.gameKind === 'south'
        ? props.rules.southConfig.finishMode
        : ('continue' as const),
    rates: phomRates(
      props.gameKind === 'phom' ? props.rules : DEFAULT_PHOM_CONFIG,
    ),
    options: {
      ...phomOptions(props.gameKind === 'phom' ? props.rules : undefined),
    },
    variantPoints:
      props.gameKind === 'north' ||
      props.gameKind === 'sam' ||
      props.gameKind === 'tan'
        ? String(props.rules.pointsPerCard)
        : '',
    remainingTwoPoints:
      props.gameKind === 'north' && 'remainingTwoPoints' in props.rules
        ? String(props.rules.remainingTwoPoints)
        : '2',
    cutTwoPoints:
      props.gameKind === 'north' && 'cutTwoPoints' in props.rules
        ? String(props.rules.cutTwoPoints)
        : '3',
    samCallPoints:
      props.gameKind === 'sam' && 'samCallPoints' in props.rules
        ? String(props.rules.samCallPoints)
        : '20',
  };
}
export function CardRoomRulesDialog(props: Props) {
  const { version, blocked, onClose, onSave } = props;
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState(() => draftFrom(props));
  const phomConfig = parsePhomRates(draft.rates, draft.options);
  const nextRules: SouthRules = {
    amountPerCard: draft.amount === '' ? NaN : Number(draft.amount),
    southConfig: {
      finishMode: draft.finishMode,
      cutTwoAmount: draft.fine === '' ? NaN : Number(draft.fine),
      instantWinAmount:
        draft.instantWinFine === '' ? NaN : Number(draft.instantWinFine),
    },
  };
  const pointsPerCard =
    draft.variantPoints === '' ? NaN : Number(draft.variantPoints);
  const remainingTwoPoints =
    draft.remainingTwoPoints === '' ? NaN : Number(draft.remainingTwoPoints);
  const cutTwoPoints =
    draft.cutTwoPoints === '' ? NaN : Number(draft.cutTwoPoints);
  const samCallPoints =
    draft.samCallPoints === '' ? NaN : Number(draft.samCallPoints);
  const validRate = (value: number) =>
    Number.isSafeInteger(value) && value >= 1 && value <= 1_000_000_000;
  const validExtra = (value: number) =>
    Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;
  const variantConfig: VariantGameConfig =
    props.gameKind === 'north'
      ? { rulesVersion: 'north-v2', pointsPerCard, remainingTwoPoints, cutTwoPoints }
      : props.gameKind === 'sam'
        ? { rulesVersion: 'sam-v2', pointsPerCard, samCallPoints }
        : { pointsPerCard };
  const validVariantConfig =
    validRate(pointsPerCard) &&
    (props.gameKind !== 'north' ||
      (validExtra(remainingTwoPoints) && validExtra(cutTwoPoints))) &&
    (props.gameKind !== 'sam' || validExtra(samCallPoints));
  const stale = draft.version !== version;
  const valid =
    props.gameKind === 'phom'
      ? !!phomConfig
      : props.gameKind === 'south'
        ? isSouthRules(nextRules)
        : validVariantConfig;
  return (
    <DialogModal
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
      onBackdropPress={onClose}
      style={[s.card, { maxHeight: height - spacing.xl * 4 }]}
    >
      <ModalHeader
        title="Luật ván tới"
        accessibilityLabel="Đóng sửa luật"
        onClose={onClose}
      />
      <ScrollView
        testID="room-rules-scroll"
        style={s.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Text style={typography.small}>
          Chỉ áp dụng khi chia ván mới. Ván đang đánh giữ nguyên luật và cách
          tính điểm. Khi lưu ở sảnh, mọi người cần sẵn sàng lại.
        </Text>
        {props.gameKind === 'phom' ? (
          <PhomGameSettings
            options={draft.options}
            onOptionsChange={(options) =>
              setDraft((current) => ({ ...current, options }))
            }
            rates={draft.rates}
            onChange={(rates) => setDraft((current) => ({ ...current, rates }))}
            disabled={blocked || stale}
          />
        ) : props.gameKind === 'south' ? (
          <>
            <TienLenGameSettings
              finishMode={draft.finishMode}
              onFinishMode={(finishMode) => setDraft({ ...draft, finishMode })}
              amountPerCard={draft.amount}
              onAmountPerCard={(amount) => setDraft({ ...draft, amount })}
              cutTwoAmount={draft.fine}
              onCutTwoAmount={(fine) => setDraft({ ...draft, fine })}
              instantWinAmount={draft.instantWinFine}
              onInstantWinAmount={(instantWinFine) =>
                setDraft({ ...draft, instantWinFine })
              }
              disabled={blocked || stale}
            />
            {(!Number.isSafeInteger(nextRules.amountPerCard) ||
              nextRules.amountPerCard < 1 ||
              nextRules.amountPerCard > 1_000_000_000) && (
              <Text accessibilityRole="alert" style={s.error}>
                Tiền mỗi lá từ 1 đến 1.000.000.000 đ.
              </Text>
            )}
          </>
        ) : (
          <>
            <Text style={typography.small}>
              {props.gameKind === 'tan'
                ? 'Người cuối còn bài trả cho mỗi người về trước số lá mình còn × điểm/lá. Người bỏ cuộc không vào phép tính.'
                : props.gameKind === 'north'
                  ? 'Ván mới dùng Bắc v2: lá 2 còn lại cộng thêm điểm; tứ quý chặt một lá 2 chuyển điểm giữa hai người.'
                  : 'Ván mới dùng Sâm v2: báo thành công nhận điểm báo từ từng đối thủ; báo thất bại trả điểm báo cho từng đối thủ và vẫn tính điểm bài còn.'}
            </Text>
            <Text style={typography.small}>Điểm mỗi lá</Text>
            <AppTextInput
              accessibilityLabel="Điểm mỗi lá ván tới"
              value={draft.variantPoints}
              onChangeText={(value) =>
                setDraft((current) => ({
                  ...current,
                  variantPoints: value.replace(/[^0-9]/g, '').slice(0, 10),
                }))
              }
              editable={!blocked && !stale}
              keyboardType="number-pad"
              placeholder="1"
              style={s.input}
            />
            {props.gameKind === 'north' && (
              <>
                <Text style={typography.small}>Điểm cộng cho mỗi lá 2 còn lại</Text>
                <AppTextInput
                  accessibilityLabel="Điểm cộng cho lá 2 còn lại ván tới"
                  value={draft.remainingTwoPoints}
                  onChangeText={(value) => setDraft((current) => ({ ...current, remainingTwoPoints: value.replace(/[^0-9]/g, '').slice(0, 10) }))}
                  editable={!blocked && !stale}
                  keyboardType="number-pad"
                  placeholder="2"
                  style={s.input}
                />
                <Text style={typography.small}>Điểm chặt một lá 2 bằng tứ quý</Text>
                <AppTextInput
                  accessibilityLabel="Điểm chặt một lá 2 ván tới"
                  value={draft.cutTwoPoints}
                  onChangeText={(value) => setDraft((current) => ({ ...current, cutTwoPoints: value.replace(/[^0-9]/g, '').slice(0, 10) }))}
                  editable={!blocked && !stale}
                  keyboardType="number-pad"
                  placeholder="3"
                  style={s.input}
                />
              </>
            )}
            {props.gameKind === 'sam' && (
              <>
                <Text style={typography.small}>Điểm báo Sâm với mỗi người</Text>
                <AppTextInput
                  accessibilityLabel="Điểm báo Sâm với mỗi người ván tới"
                  value={draft.samCallPoints}
                  onChangeText={(value) => setDraft((current) => ({ ...current, samCallPoints: value.replace(/[^0-9]/g, '').slice(0, 10) }))}
                  editable={!blocked && !stale}
                  keyboardType="number-pad"
                  placeholder="20"
                  style={s.input}
                />
              </>
            )}
            {props.gameKind !== 'tan' && (
              <Text style={typography.small}>
                Khi lưu, ván mới dùng profile v2; ván đang chơi và lịch sử cũ giữ nguyên.
              </Text>
            )}
            {!validVariantConfig && (
              <Text accessibilityRole="alert" style={s.error}>
                Điểm mỗi lá phải nhập từ 1 đến 1.000.000.000; điểm cộng/phạt phải nhập từ 0 đến 1.000.000.000.
              </Text>
            )}
          </>
        )}
        {stale && (
          <>
            <Text accessibilityRole="alert" style={s.error}>
              Bàn vừa thay đổi. Tải lại luật trước khi lưu.
            </Text>
            <Button
              variant="secondary"
              title="Tải lại luật"
              disabled={blocked}
              onPress={() => setDraft(draftFrom(props))}
            />
          </>
        )}
      </ScrollView>
      <Button
        title="Lưu luật ván tới"
        disabled={blocked || stale || !valid}
        onPress={() => {
          if (blocked || stale) return;
          if (props.gameKind === 'phom' && phomConfig)
            onSave({ type: 'set-phom-rules', phomConfig }, draft.version);
          else if (props.gameKind === 'south' && isSouthRules(nextRules))
            onSave({ type: 'set-south-rules', ...nextRules }, draft.version);
          else if (validVariantConfig)
            onSave(
              { type: 'set-variant-rules', variantConfig },
              draft.version,
            );
        }}
      />
    </DialogModal>
  );
}
const s = StyleSheet.create({
  card: {
    flexShrink: 1,
    maxWidth: layout.contentMaxWidth,
    gap: spacing.md,
    padding: spacing.lg,
  },
  scroll: { flexShrink: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.xs },
  error: { ...typography.small, color: colors.danger },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
});
