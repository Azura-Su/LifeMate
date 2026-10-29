import Feather from '@expo/vector-icons/Feather';
import { useIsFocused } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { AppTextInput } from '../../components/AppTextInput';
import { DialogModal } from '../../components/DialogModal';
import { ModalHeader } from '../../components/ModalHeader';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Screen } from '../../components/Screen';
import type { MainTabParams } from '../../navigation/types';
import {
  capitalizePixelPetNickname,
  callPixelPet,
  normalizePixelPetNickname,
  newPixelPetAction,
  PIXEL_PET_NICKNAME_MAX_LENGTH,
  type PixelPetRequest,
} from '../../services/pixelPet/pixelPetApi';
import {
  PIXEL_PET_EXCLUSIVE,
  pixelPetSpecies,
} from '../../services/pixelPet/pixelPetCatalog';
import { PUPPET_PREVIEW_CLIPS } from '../../services/pixelPet/celestialStagPuppet';
import { EFFECT_CLIP } from '../../services/pixelPet/pixelPetRig';
import { petMovementLabel } from '../../services/pixelPet/pixelPetFrames';
import type { PixelPetExpression } from '../../services/pixelPet/pixelPetExpressions';
import { useScreenActive } from '../../hooks/useScreenActive';
import { usePixelPetRefresh } from '../../hooks/usePixelPetRefresh';
import { useAuthStore } from '../../store/authStore';
import type {
  PixelPetAnyClipId,
  PixelPetEffect,
  PixelPetState,
} from '../../types/pixelPet';
import { colors, spacing } from '../../theme';
import { PixelPetSprite } from './PixelPetSprite';
import { PetStageBackdrop } from './PetStageBackdrop';
import { styles } from './PixelPetScreen.styles';

type Props = BottomTabScreenProps<MainTabParams, 'PixelPet'>;
const STAGE_LABEL = {
  hatchling: 'Ấu thể',
  juvenile: 'Trưởng thành',
  ascended: 'Thăng hoa',
} as const;
const EFFECT_LABEL: Record<PixelPetEffect, string> = {
  eat: 'Được cho ăn',
  wardrobe: 'Điểm trang phục',
  move: 'Vận động',
  heal: 'Hồi phục',
  mood: 'Vui vẻ',
  neutral: 'Ghi chép',
};

function useCountdown(expiresAt: number | null, serverNow: number | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt || !serverNow) return;
    // Server clock decides expiry; the client only displays the remainder.
    const offset = serverNow - Date.now();
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((expiresAt - Date.now() - offset) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, serverNow]);
  return left;
}

/** Icons for the motion chips; anything unlisted gets a sparkle. */
const CLIP_ICON: Partial<
  Record<PixelPetAnyClipId, keyof typeof Feather.glyphMap>
> = {
  move: 'wind',
  happy: 'smile',
  idle: 'moon',
  fly: 'navigation',
  blaze: 'zap',
  spin: 'refresh-cw',
};

function ActionChip({
  clip,
  label,
  selected,
  onPress,
}: {
  clip: PixelPetAnyClipId;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={spacing.xs}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
    >
      <Feather
        name={CLIP_ICON[clip] ?? 'star'}
        size={15}
        color={selected ? colors.sunlight : colors.earth}
      />
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PixelPetScreen({ navigation }: Props) {
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  const focused = useIsFocused();
  const active = useScreenActive();
  const [state, setState] = useState<PixelPetState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<PixelPetAnyClipId>('idle');
  const [loopMovement, setLoopMovement] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [expression, setExpression] = useState<PixelPetExpression | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const latest = useRef(0);
  const [stageSize, setStageSize] = useState(0);
  // The pet fills the stage; its canvas has its own margin around the art.
  const spriteSize = stageSize ? Math.round(stageSize * 0.98) : 260;
  usePixelPetRefresh(uid, focused && active && !busy, setState, false);

  const run = useCallback(
    async (request: PixelPetRequest, then?: (next: PixelPetState) => void) => {
      if (!uid) return;
      const ticket = ++latest.current;
      setBusy(request.type);
      setError(null);
      try {
        const next = await callPixelPet(uid, request);
        if (ticket !== latest.current) return;
        setState(next);
        then?.(next);
      } catch (cause) {
        if (ticket === latest.current)
          setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (ticket === latest.current) setBusy(null);
      }
    },
    [uid],
  );

  useEffect(() => {
    if (focused) void run({ type: 'sync' });
  }, [focused, run]);

  const reservation = state?.status === 'reserved' ? state.reservation : null;
  const secondsLeft = useCountdown(
    reservation?.expiresAt ?? null,
    state?.now ?? null,
  );
  const onClipEnd = useCallback(() => {
    setSleeping(false);
    setLoopMovement(false);
    setExpression(null);
    setClip('idle');
  }, []);
  const playClip = (next: PixelPetAnyClipId, loop = false) => {
    setSleeping(false);
    setExpression(null);
    setLoopMovement(loop);
    setClip(next);
  };
  const rest = () => {
    setExpression(null);
    setLoopMovement(false);
    setClip('idle');
    setSleeping(true);
  };
  const playExpression = (next: PixelPetExpression) => {
    setSleeping(false);
    setExpression(next);
    setLoopMovement(false);
    setClip('happy');
  };
  const pet = state?.pet ?? null;
  const species = pixelPetSpecies(
    pet?.speciesId ?? reservation?.speciesId ?? '',
  );
  const openRename = () => {
    if (!pet) return;
    setNicknameDraft(pet.nickname ?? '');
    setError(null);
    setRenameOpen(true);
  };
  const closeRename = () => {
    if (busy === 'rename') return;
    setRenameOpen(false);
    setError(null);
  };
  const saveNickname = () => {
    if (!pet) return;
    const nickname = normalizePixelPetNickname(nicknameDraft);
    if (!nickname) {
      setError('Tên linh thú cần từ 1 đến 24 ký tự.');
      return;
    }
    void run({ type: 'rename', adoptionId: pet.adoptionId, nickname }, () =>
      setRenameOpen(false),
    );
  };
  const command = (type: 'roll' | 'restore' | 'care') =>
    run({ type, actionId: newPixelPetAction() }, () => {
      if (type === 'care') playClip('happy');
    });

  return (
    <Screen
      fixedHeaderStyle={styles.fixedHeader}
      contentStyle={styles.content}
      fixedHeader={
        <ScreenHeader
          title="Linh thú"
          subtitle={
            state
              ? `${state.availability.owned}/${state.availability.total} linh thú đã có chủ`
              : undefined
          }
          onBack={() => navigation.navigate('Home')}
        />
      }
    >
      {!state && !error && <ActivityIndicator color={colors.muted} />}
      {!!error && <Text style={styles.notice}>{error}</Text>}

      {species && (
        <View style={styles.hero}>
          <View
            style={styles.stage}
            onLayout={({ nativeEvent }) =>
              setStageSize(
                Math.min(nativeEvent.layout.width, nativeEvent.layout.height),
              )
            }
          >
            <PetStageBackdrop
              tint={species.palette[2]}
              spriteSize={spriteSize}
            />
            <PixelPetSprite
              species={species}
              stage={pet?.stage ?? 'hatchling'}
              size={spriteSize}
              clip={clip}
              flightPhase={clip === 'fly' ? 'glide' : undefined}
              expression={expression}
              sleeping={sleeping}
              active={focused && active}
              loopMovement={loopMovement}
              onClipEnd={onClipEnd}
            />
          </View>
          {pet && (
            <View style={styles.heroInfo}>
              <View style={styles.profileTitleGroup}>
                {/* The name itself is the rename control: a quiet pencil, no button. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    pet.nickname ? 'Đổi tên linh thú' : 'Đặt tên linh thú'
                  }
                  onPress={openRename}
                  hitSlop={spacing.sm}
                  style={({ pressed }) => [
                    styles.nameButton,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={styles.profileName} numberOfLines={1}>
                    {pet.nickname ?? species.name}
                    {!!pet.nickname && (
                      <Text style={styles.profileSpecies}>
                        {` (${species.name})`}
                      </Text>
                    )}
                  </Text>
                  <Feather name="edit-2" size={15} color={colors.muted} />
                </Pressable>
                <Text style={styles.meta} numberOfLines={1}>
                  Lv {pet.level} · {STAGE_LABEL[pet.stage]} ·{' '}
                  {species.personality}
                  {PIXEL_PET_EXCLUSIVE.includes(species) ? ' · Độc quyền' : ''}
                </Text>
              </View>
              <View style={styles.experienceRow}>
                <View
                  style={styles.barTrack}
                  accessibilityLabel="Tiến độ lên cấp"
                >
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${
                          pet.nextLevelExp === null
                            ? 100
                            : Math.round(
                                ((pet.totalExp - pet.levelFloorExp) /
                                  (pet.nextLevelExp - pet.levelFloorExp)) *
                                  100,
                              )
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.experienceText}>
                  {pet.totalExp} EXP
                  {pet.nextLevelExp !== null
                    ? ` / ${pet.nextLevelExp}`
                    : ' · tối đa'}
                </Text>
              </View>
              <View style={styles.skillRow}>
                <Text style={styles.skillName} numberOfLines={1}>
                  {species.skill}
                </Text>
                <Text style={styles.skillMeta}>
                  {pet.skillTier === 0 ? 'Mở ở Lv 5' : `Bậc ${pet.skillTier}`}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {species && (
        // Every motion in one wrapping group; exclusive pets append theirs.
        <View style={styles.controlGrid}>
          {(
            [
              ['move', petMovementLabel(species)],
              ['happy', 'Vui vẻ'],
              ['idle', 'Nghỉ ngơi'],
            ] as const
          ).map(([value, label]) => (
            <ActionChip
              key={value}
              clip={value}
              label={label}
              selected={
                value === 'idle'
                  ? sleeping
                  : !sleeping &&
                    clip === value &&
                    (value === 'happy' || expression === null)
              }
              onPress={() =>
                value === 'idle'
                  ? rest()
                  : value === 'happy'
                    ? playExpression('excited')
                    : playClip(value, value === 'move')
              }
            />
          ))}
          {PIXEL_PET_EXCLUSIVE.includes(species) &&
            PUPPET_PREVIEW_CLIPS.map(({ clip: value, label }) => (
              <ActionChip
                key={value}
                clip={value}
                label={label}
                selected={!sleeping && expression === null && clip === value}
                onPress={() => playClip(value, value === 'fly')}
              />
            ))}
        </View>
      )}

      {state?.status === 'none' && (
        <View style={styles.card}>
          <Text style={styles.name}>Nhận nuôi linh thú</Text>
          <Text style={styles.body}>
            Có đúng 15 linh thú, mỗi loài chỉ có một cá thể. Bạn có 3 lượt chọn
            ngẫu nhiên; linh thú được giữ cho bạn 5 phút để quyết định.
          </Text>
          {state.availability.owned >= state.availability.total ? (
            <Text style={styles.notice}>
              Tất cả 15 linh thú đã được nhận nuôi.
            </Text>
          ) : state.rollsLeft > 0 ? (
            <Button
              title={`Chọn ngẫu nhiên (còn ${state.rollsLeft} lượt)`}
              loading={busy === 'roll'}
              onPress={() => void command('roll')}
            />
          ) : (
            <Button
              title="Giữ lại linh thú lần trước"
              loading={busy === 'restore'}
              disabled={state.restoresLeft === 0}
              onPress={() => void command('restore')}
            />
          )}
        </View>
      )}

      {reservation && species && (
        <View style={styles.card}>
          <Text style={styles.name}>{species.name}</Text>
          <Text style={styles.meta}>
            {species.personality} · Kỹ năng: {species.skill}
          </Text>
          <Text style={styles.body}>
            Đang giữ cho bạn: {Math.floor(secondsLeft / 60)}:
            {String(secondsLeft % 60).padStart(2, '0')}
          </Text>
          <View style={styles.actions}>
            <Button
              title="Nhận nuôi"
              loading={busy === 'confirm'}
              disabled={secondsLeft === 0}
              onPress={() =>
                void run({
                  type: 'confirm',
                  actionId: newPixelPetAction(),
                  reservationId: reservation.id,
                })
              }
            />
            {state!.rollsLeft > 0 && (
              <Button
                variant="secondary"
                title={`Chọn lại (còn ${state!.rollsLeft} lượt)`}
                loading={busy === 'roll'}
                onPress={() => void command('roll')}
              />
            )}
          </View>
        </View>
      )}

      {pet && species && (
        <>
          {!!state?.todayEffects &&
            Object.keys(state.todayEffects).length > 0 && (
              <View style={styles.card}>
                <Text style={styles.meta}>Hôm nay từ sổ thu chi</Text>
                <View style={styles.row}>
                  {(Object.keys(state.todayEffects) as PixelPetEffect[]).map(
                    (effect) => (
                      <Pressable
                        key={effect}
                        accessibilityRole="button"
                        onPress={() => playClip(EFFECT_CLIP[effect])}
                        style={styles.chip}
                      >
                        <Text style={styles.chipText}>
                          {EFFECT_LABEL[effect]} ×{state.todayEffects![effect]}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
              </View>
            )}

          <View style={styles.actionsRow}>
            <View style={styles.actionCell}>
              <Button
                compact
                title={
                  pet.caredToday ? 'Đã chăm sóc hôm nay' : 'Vuốt ve, chăm sóc'
                }
                disabled={pet.caredToday}
                loading={busy === 'care'}
                onPress={() => void command('care')}
              />
            </View>
            {pet.skillTier > 0 && (
              <View style={styles.actionCell}>
                <Button
                  compact
                  variant="secondary"
                  title="Thi triển kỹ năng"
                  onPress={() => playClip('skill')}
                />
              </View>
            )}
          </View>
        </>
      )}

      <DialogModal
        visible={renameOpen && !!pet}
        onRequestClose={closeRename}
        style={styles.renameDialog}
      >
        <ModalHeader
          title={pet?.nickname ? 'Đổi tên linh thú' : 'Đặt tên linh thú'}
          accessibilityLabel="Đóng hộp thoại đặt tên"
          disabled={busy === 'rename'}
          onClose={closeRename}
        />
        <Text style={styles.renameDescription}>
          Đặt một tên riêng cho linh thú của bạn.
        </Text>
        <AppTextInput
          accessibilityLabel="Tên linh thú"
          value={nicknameDraft}
          onChangeText={(value) =>
            setNicknameDraft(capitalizePixelPetNickname(value))
          }
          onSubmitEditing={saveNickname}
          placeholder="Nhập tên linh thú"
          placeholderTextColor={colors.muted}
          maxLength={48}
          returnKeyType="done"
          autoFocus
          editable={busy !== 'rename'}
          style={styles.renameInput}
        />
        <Text style={styles.renameHint}>
          Từ 1 đến {PIXEL_PET_NICKNAME_MAX_LENGTH} ký tự.
        </Text>
        {!!error && (
          <Text accessibilityRole="alert" style={styles.renameError}>
            {error}
          </Text>
        )}
        <View style={styles.renameActions}>
          <View style={styles.renameActionCell}>
            <Button
              compact
              variant="secondary"
              title="Để sau"
              disabled={busy === 'rename'}
              onPress={closeRename}
            />
          </View>
          <View style={styles.renameActionCell}>
            <Button
              compact
              title="Lưu tên"
              loading={busy === 'rename'}
              onPress={saveNickname}
            />
          </View>
        </View>
      </DialogModal>
    </Screen>
  );
}
