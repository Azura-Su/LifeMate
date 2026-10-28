import { useIsFocused } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { HeaderIconButton, ScreenHeader } from '../../components/ScreenHeader';
import { Screen } from '../../components/Screen';
import type { MainTabParams } from '../../navigation/types';
import {
  callPixelPet,
  newPixelPetAction,
  type PixelPetRequest,
} from '../../services/pixelPet/pixelPetApi';
import {
  PIXEL_PET_EXCLUSIVE,
  pixelPetSpecies,
} from '../../services/pixelPet/pixelPetCatalog';
import { PUPPET_EXTRA_CLIPS } from '../../services/pixelPet/celestialStagPuppet';
import { EFFECT_CLIP } from '../../services/pixelPet/pixelPetRig';
import { petMovementLabel } from '../../services/pixelPet/pixelPetFrames';
import { useScreenActive } from '../../hooks/useScreenActive';
import { usePixelPetRefresh } from '../../hooks/usePixelPetRefresh';
import { useAuthStore } from '../../store/authStore';
import type {
  PixelPetAnyClipId,
  PixelPetEffect,
  PixelPetState,
} from '../../types/pixelPet';
import { colors } from '../../theme';
import { PixelPetSprite } from './PixelPetSprite';
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

export function PixelPetScreen({ navigation }: Props) {
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  const focused = useIsFocused();
  const active = useScreenActive();
  const [state, setState] = useState<PixelPetState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<PixelPetAnyClipId>('idle');
  const [loopMovement, setLoopMovement] = useState(false);
  const latest = useRef(0);
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
    setLoopMovement(false);
    setClip('idle');
  }, []);
  const playClip = (next: PixelPetAnyClipId, loop = false) => {
    setLoopMovement(loop);
    setClip(next);
  };
  const pet = state?.pet ?? null;
  const species = pixelPetSpecies(
    pet?.speciesId ?? reservation?.speciesId ?? '',
  );
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
          right={
            <HeaderIconButton
              icon="refresh-cw"
              label="Tải lại linh thú"
              busy={busy === 'sync'}
              onPress={() => void run({ type: 'sync' })}
            />
          }
        />
      }
    >
      {!state && !error && <ActivityIndicator color={colors.muted} />}
      {!!error && <Text style={styles.notice}>{error}</Text>}

      {species && (
        <View style={styles.stage}>
          <PixelPetSprite
            species={species}
            stage={pet?.stage ?? 'hatchling'}
            size={224}
            clip={clip}
            active={focused && active}
            loopMovement={loopMovement}
            onClipEnd={onClipEnd}
          />
        </View>
      )}

      {species && (
        <View style={styles.row}>
          {(
            [
              ['move', petMovementLabel(species)],
              ['happy', 'Vui vẻ'],
              ['idle', 'Nghỉ ngơi'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: clip === value }}
              onPress={() => playClip(value, value === 'move')}
              style={[
                styles.chip,
                styles.motionChip,
                clip === value && styles.chipSelected,
              ]}
            >
              <Text style={styles.chipText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {species && PIXEL_PET_EXCLUSIVE.includes(species) && (
        <View style={styles.row}>
          {PUPPET_EXTRA_CLIPS.map(({ clip: value, label }) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: clip === value }}
              onPress={() => playClip(value, false)}
              style={[
                styles.chip,
                styles.motionChip,
                clip === value && styles.chipSelected,
              ]}
            >
              <Text style={styles.chipText}>{label}</Text>
            </Pressable>
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
          <View style={styles.card}>
            <Text style={styles.name}>{species.name}</Text>
            <Text style={styles.meta}>
              Lv {pet.level} · {STAGE_LABEL[pet.stage]} · {species.personality}
              {PIXEL_PET_EXCLUSIVE.includes(species) ? ' · Độc quyền' : ''}
            </Text>
            <View style={styles.barTrack}>
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
            <Text style={styles.meta}>
              {pet.totalExp} EXP
              {pet.nextLevelExp !== null
                ? ` / ${pet.nextLevelExp}`
                : ' · tối đa'}
            </Text>
            <Text style={styles.body}>
              Kỹ năng {species.skill}:{' '}
              {pet.skillTier === 0 ? 'mở ở Lv 5' : `bậc ${pet.skillTier}`}
            </Text>
          </View>

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

          <View style={styles.actions}>
            <Button
              title={
                pet.caredToday ? 'Đã chăm sóc hôm nay' : 'Vuốt ve, chăm sóc'
              }
              disabled={pet.caredToday}
              loading={busy === 'care'}
              onPress={() => void command('care')}
            />
            {pet.skillTier > 0 && (
              <Button
                variant="secondary"
                title={`Thi triển ${species.skill}`}
                onPress={() => playClip('skill')}
              />
            )}
          </View>
        </>
      )}
    </Screen>
  );
}
