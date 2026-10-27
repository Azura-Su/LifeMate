import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../components/Button';
import type { GameIntent } from '../../types/cardGame';
import type { SouthConfig } from '../../types/tienLen';
import type { PhomOptions } from '../../types/phom';
import {
  configuredSouth,
  isSouthConfig,
} from '../../services/cardGames/tienLenConfig';
import {
  DEFAULT_PHOM_CONFIG,
  DEFAULT_PHOM_OPTIONS,
  parsePhomRates,
  phomRates,
} from '../../services/cardGames/phomConfig';
import {
  defaultVariantConfigForGame,
  isVariantGameConfig,
} from '../../services/cardGames/variantGameProtocol';
import { TienLenGameSettings } from './TienLenGameSettings';
import { PhomGameSettings } from './PhomGameSettings';
import { styles } from './CardGamesScreen.styles';
import { VariantCreateSettings } from './VariantCreateSettings';

export type CreateGame = 'south' | 'phom' | 'north' | 'sam' | 'tan';

const variants = ['north', 'sam', 'tan'] as const;
const maxPoints = 1_000_000_000;

export function CardGameCreatePanel({
  game,
  name,
  disabled,
  busy,
  onCreate,
}: {
  game: CreateGame | null;
  name: string;
  disabled: boolean;
  busy: boolean;
  onCreate: (intent: GameIntent) => void;
}) {
  const [amountPerCard, setAmountPerCard] = useState('1');
  const [finishMode, setFinishMode] =
    useState<SouthConfig['finishMode']>('continue');
  const [cutTwoAmount, setCutTwoAmount] = useState('4');
  const [instantWinAmount, setInstantWinAmount] = useState('15');
  const southConfig: SouthConfig = {
    finishMode,
    cutTwoAmount: cutTwoAmount === '' ? NaN : Number(cutTwoAmount),
    instantWinAmount: instantWinAmount === '' ? NaN : Number(instantWinAmount),
  };
  const validSouth =
    Number.isSafeInteger(Number(amountPerCard)) &&
    Number(amountPerCard) >= 1 &&
    Number(amountPerCard) <= maxPoints &&
    isSouthConfig(southConfig);

  const [rates, setRates] = useState(() => phomRates(DEFAULT_PHOM_CONFIG));
  const [phomOptions, setPhomOptions] = useState<PhomOptions>(() => ({
    ...DEFAULT_PHOM_OPTIONS,
  }));
  const phomConfig = useMemo(
    () => parsePhomRates(rates, phomOptions),
    [rates, phomOptions],
  );

  const [variantPoints, setVariantPoints] = useState({
    north: '1',
    sam: '1',
    tan: '1',
  });
  const [remainingTwoPoints, setRemainingTwoPoints] = useState('2');
  const [cutTwoPoints, setCutTwoPoints] = useState('3');
  const [samCallPoints, setSamCallPoints] = useState('20');
  const parsedVariantPoints =
    game && game in variantPoints
      ? Number(variantPoints[game as keyof typeof variantPoints])
      : NaN;
  const parsedRemainingTwoPoints = Number(remainingTwoPoints);
  const parsedCutTwoPoints = Number(cutTwoPoints);
  const parsedSamCallPoints = Number(samCallPoints);
  const variantConfig = useMemo(() => {
    if (!game || !variants.includes(game as (typeof variants)[number]))
      return null;
    const base = defaultVariantConfigForGame(game as (typeof variants)[number]);
    const candidate = {
      ...base,
      pointsPerCard: parsedVariantPoints,
      ...(game === 'north' && {
        remainingTwoPoints: parsedRemainingTwoPoints,
        cutTwoPoints: parsedCutTwoPoints,
      }),
      ...(game === 'sam' && { samCallPoints: parsedSamCallPoints }),
    };
    return isVariantGameConfig(candidate, game as (typeof variants)[number])
      ? candidate
      : null;
  }, [
    game,
    parsedVariantPoints,
    parsedRemainingTwoPoints,
    parsedCutTwoPoints,
    parsedSamCallPoints,
  ]);

  const valid =
    game === 'south'
      ? validSouth
      : game === 'phom'
        ? !!phomConfig
        : variants.includes(game as (typeof variants)[number])
          ? !!variantConfig
          : false;

  const submit = () => {
    if (!game || !valid) return;
    if (game === 'south') {
      onCreate({
        type: 'create',
        name,
        game,
        amountPerCard: Number(amountPerCard),
        ...(configuredSouth(southConfig) && { southConfig }),
      });
    } else if (game === 'phom' && phomConfig) {
      onCreate({ type: 'create', name, game, phomConfig });
    } else if (
      variants.includes(game as (typeof variants)[number]) &&
      variantConfig
    ) {
      onCreate({
        type: 'create',
        name,
        game: game as (typeof variants)[number],
        variantConfig,
      });
    }
  };

  return (
    <View style={styles.gameExpansion}>
      {!game ? (
        <Text style={styles.body}>Chọn trò chơi để thiết lập phòng.</Text>
      ) : game === 'south' ? (
        <TienLenGameSettings
          finishMode={finishMode}
          onFinishMode={setFinishMode}
          amountPerCard={amountPerCard}
          onAmountPerCard={setAmountPerCard}
          cutTwoAmount={cutTwoAmount}
          onCutTwoAmount={setCutTwoAmount}
          instantWinAmount={instantWinAmount}
          onInstantWinAmount={setInstantWinAmount}
          disabled={disabled || busy}
        />
      ) : game === 'phom' ? (
        <PhomGameSettings
          options={phomOptions}
          onOptionsChange={setPhomOptions}
          rates={rates}
          onChange={setRates}
          disabled={disabled || busy}
        />
      ) : (
        <VariantCreateSettings
          game={game}
          disabled={disabled || busy}
          points={variantPoints[game]}
          onPointsChange={(value) =>
            setVariantPoints((current) => ({ ...current, [game]: value }))
          }
          remainingTwoPoints={remainingTwoPoints}
          onRemainingTwoPointsChange={setRemainingTwoPoints}
          cutTwoPoints={cutTwoPoints}
          onCutTwoPointsChange={setCutTwoPoints}
          samCallPoints={samCallPoints}
          onSamCallPointsChange={setSamCallPoints}
        />
      )}
      <Button
        title="Tạo phòng"
        loading={busy}
        disabled={disabled || busy || !game || !valid}
        onPress={submit}
      />
    </View>
  );
}
