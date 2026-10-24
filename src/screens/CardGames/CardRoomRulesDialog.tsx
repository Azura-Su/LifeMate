import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { ModalHeader } from '../../components/ModalHeader';
import { colors, layout, spacing, typography } from '../../theme';
import { isSouthRules } from '../../services/cardGames/tienLenConfig';
import type { PhomConfig } from '../../types/phom';
import type { GameIntent } from '../../types/cardGame';
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
    intent: Extract<GameIntent, { type: 'set-south-rules' | 'set-phom-rules' }>,
    version: number,
  ) => void;
} & (
  | { gameKind: 'south'; rules: SouthRules }
  | { gameKind: 'phom'; rules: PhomConfig }
);
function draftFrom(props: Props) {
  return {
    version: props.version,
    amount: props.gameKind === 'south' ? String(props.rules.amountPerCard) : '',
    fine:
      props.gameKind === 'south'
        ? String(props.rules.southConfig.cutTwoAmount)
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
    },
  };
  const stale = draft.version !== version;
  const valid =
    props.gameKind === 'phom' ? !!phomConfig : isSouthRules(nextRules);
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
        ) : (
          <>
            <TienLenGameSettings
              finishMode={draft.finishMode}
              onFinishMode={(finishMode) => setDraft({ ...draft, finishMode })}
              amountPerCard={draft.amount}
              onAmountPerCard={(amount) => setDraft({ ...draft, amount })}
              cutTwoAmount={draft.fine}
              onCutTwoAmount={(fine) => setDraft({ ...draft, fine })}
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
});
