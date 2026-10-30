import Feather from '@expo/vector-icons/Feather';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useScreenActive } from '../../hooks/useScreenActive';
import type { ManagedPet } from '../../services/admin/petManagement';
import { pixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import {
  petMovementKind,
  petMovementLabel,
} from '../../services/pixelPet/pixelPetFrames';
import {
  LEVEL_THRESHOLDS,
  petUnlocks,
  stageForLevel,
} from '../../services/pixelPet/pixelPetGuide';
import { PUPPET_PREVIEW_CLIPS } from '../../services/pixelPet/celestialStagPuppet';
import type { PixelPetExpression } from '../../services/pixelPet/pixelPetExpressions';
import type { PixelPetAnyClipId } from '../../types/pixelPet';
import { colors, fontSize, radius, spacing, typography } from '../../theme';
import { PetStageBackdrop } from '../PixelPet/PetStageBackdrop';
import { PixelPetSprite } from '../PixelPet/PixelPetSprite';
import { HomeRoamPreview } from './HomeRoamPreview';

type Props = {
  pet: ManagedPet;
  active: boolean;
  onBack: () => void;
};

const stageLabel = {
  hatchling: 'Ấu thể',
  juvenile: 'Trưởng thành',
  ascended: 'Thăng hoa',
} as const;

const unlockIcon = {
  stage: 'trending-up',
  skill: 'zap',
  skin: 'gift',
  scene: 'moon',
} as const;
const LEVELS = LEVEL_THRESHOLDS.map((_, index) => index + 1);

const statusLabel: Record<ManagedPet['status'], string> = {
  owned: 'Đã có chủ',
  reserved: 'Đang giữ chỗ',
  available: 'Có thể nhận nuôi',
};

export function ManagedPetDetailScreen({ pet, active, onBack }: Props) {
  const appActive = useScreenActive();
  const [clip, setClip] = useState<PixelPetAnyClipId>('idle');
  const [loopMovement, setLoopMovement] = useState(false);
  const [sleeping, setSleeping] = useState(true);
  const [expression, setExpression] = useState<PixelPetExpression | null>(null);
  const [homePreview, setHomePreview] = useState(false);
  const species = pixelPetSpecies(pet.speciesId)!;
  const [level, setLevel] = useState(pet.adoption?.level ?? 1);
  const stage = stageForLevel(level);
  const unlocks = petUnlocks(species.id, species.skill);
  const levelUnlocks = unlocks.filter((unlock) => unlock.level === level);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onBack]);

  const resetPreview = useCallback(() => {
    setSleeping(true);
    setExpression(null);
    setLoopMovement(false);
    setClip('idle');
  }, []);
  const previewClip = (next: PixelPetAnyClipId, loop = false) => {
    setSleeping(false);
    setExpression(null);
    setLoopMovement(loop);
    setClip(next);
  };
  const previewExpression = (next: PixelPetExpression) => {
    setSleeping(false);
    setExpression(next);
    setLoopMovement(false);
    setClip(next === 'excited' ? 'happy' : 'idle');
  };

  const holder = pet.holder;
  const activities: {
    clip: PixelPetAnyClipId;
    label: string;
    loop?: boolean;
    rest?: boolean;
  }[] = [
    { clip: 'move', label: petMovementLabel(species), loop: true },
    { clip: 'happy', label: 'Vui vẻ' },
    { clip: 'idle', label: 'Nghỉ ngơi', rest: true },
    { clip: 'skill', label: species.skill },
  ];
  if (species.id === 'celestial_stag')
    activities.push(
      ...PUPPET_PREVIEW_CLIPS.map((activity) => ({
        ...activity,
        loop: activity.clip === 'fly',
      })),
    );

  const isSelected = (value: PixelPetAnyClipId, rest: boolean) =>
    rest
      ? sleeping
      : !sleeping &&
        clip === value &&
        (value === 'happy' || expression === null);
  const tint = species.palette[0];
  const stats = pet.adoption
    ? [
        { label: 'Cấp', value: `Lv ${pet.adoption.level}` },
        { label: 'Kinh nghiệm', value: `${pet.adoption.totalExp} EXP` },
        { label: 'Giai đoạn', value: stageLabel[stage] },
      ]
    : [
        { label: 'Trạng thái', value: statusLabel[pet.status] },
        { label: 'Kỹ năng', value: species.skill },
      ];

  return (
    <Screen
      contentStyle={styles.content}
      fixedHeader={
        <ScreenHeader
          title={species.name}
          subtitle={`${statusLabel[pet.status]} · ${species.personality}`}
          onBack={onBack}
          backLabel="Quay về danh sách linh thú"
        />
      }
    >
      <View style={[styles.hero, { borderColor: tint }]}>
        <PetStageBackdrop tint={tint} spriteSize={208} stageScale={1} />
        <PixelPetSprite
          species={species}
          stage={stage}
          size={208}
          clip={clip}
          flightPhase={clip === 'fly' ? 'glide' : undefined}
          expression={expression}
          sleeping={sleeping}
          active={active && appActive}
          loopMovement={loopMovement}
          walking={petMovementKind(species) === 'walk'}
          onClipEnd={resetPreview}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xem ${species.name} chạy trên Home`}
          onPress={() => setHomePreview(true)}
          style={({ pressed }) => [
            styles.homeButton,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="play" size={14} color={colors.surface} />
          <Text style={styles.homeButtonText}>Xem trên Home</Text>
        </Pressable>
      </View>
      {homePreview && active && appActive && (
        <HomeRoamPreview
          speciesId={species.id}
          level={level}
          onLevelChange={setLevel}
          name={species.name}
          onClose={() => setHomePreview(false)}
        />
      )}

      <View style={styles.options}>
        {activities.map(
          ({ clip: value, label, loop = false, rest = false }) => {
            const selected = isSelected(value, rest);
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`Xem thử ${label}`}
                accessibilityState={{ selected }}
                onPress={() => {
                  if (rest) {
                    setExpression(null);
                    setLoopMovement(false);
                    setClip('idle');
                    setSleeping(true);
                  } else if (value === 'happy') previewExpression('excited');
                  else previewClip(value, loop);
                }}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.optionText,
                    selected && styles.optionTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          },
        )}
      </View>
      <Text style={styles.helper}>
        Chỉ xem thử tại máy; không thay đổi dữ liệu linh thú.
      </Text>

      <View style={styles.levels}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Các cấp độ
        </Text>
        <View style={styles.options}>
          {LEVELS.map((value) => {
            const selected = value === level;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`Xem cấp ${value}`}
                accessibilityState={{ selected }}
                onPress={() => setLevel(value)}
                style={[styles.levelChip, selected && styles.optionSelected]}
              >
                <Text
                  style={[
                    styles.optionText,
                    selected && styles.optionTextSelected,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.levelSummary}>
          Lv {level} · {stageLabel[stage]} · từ {LEVEL_THRESHOLDS[level - 1]}{' '}
          EXP
          {pet.adoption?.level === level ? ' · cấp hiện tại' : ''}
        </Text>
        {levelUnlocks.length ? (
          levelUnlocks.map((unlock) => (
            <View key={unlock.kind} style={styles.unlock}>
              <Feather
                name={unlockIcon[unlock.kind]}
                size={16}
                color={colors.earth}
              />
              <Text style={styles.unlockText}>{unlock.name}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.helper}>Không mở khóa mới ở cấp này.</Text>
        )}
      </View>

      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text numberOfLines={1} style={styles.statValue}>
              {stat.value}
            </Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {holder && (
        <View style={styles.owner}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {[
                ...(holder.name || holder.email || '?').trim(),
              ][0]?.toUpperCase()}
            </Text>
          </View>
          <View style={styles.ownerText}>
            <Text numberOfLines={1} style={styles.ownerName}>
              {holder.name || 'Chưa đặt tên'}
            </Text>
            {!!holder.email && (
              <Text selectable numberOfLines={1} style={styles.ownerMeta}>
                {holder.email}
              </Text>
            )}
            <Text selectable style={styles.uid}>
              UID: {holder.uid}
            </Text>
            <Text style={styles.ownerMeta}>
              {pet.adoption
                ? `Nhận nuôi ${new Date(pet.adoption.adoptedAt).toLocaleDateString('vi-VN')}`
                : pet.reservedUntil
                  ? `Giữ chỗ đến ${new Date(pet.reservedUntil).toLocaleString('vi-VN')}`
                  : ''}
            </Text>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  hero: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  homeButton: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.earth,
  },
  homeButtonText: {
    fontSize: fontSize.label,
    fontWeight: '700',
    color: colors.surface,
  },
  pressed: { opacity: 0.8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.earth, backgroundColor: colors.earth },
  optionText: {
    fontSize: fontSize.small,
    fontWeight: '600',
    color: colors.ink,
  },
  optionTextSelected: { color: colors.surface },
  helper: {
    fontSize: fontSize.caption,
    color: colors.muted,
    marginTop: -spacing.xs,
  },
  levels: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  sectionTitle: { ...typography.body, color: colors.ink, fontWeight: '700' },
  levelChip: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  levelSummary: { fontSize: fontSize.small, color: colors.muted },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unlockText: { fontSize: fontSize.small, color: colors.ink },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  statValue: { fontSize: fontSize.body, fontWeight: '700', color: colors.ink },
  statLabel: { fontSize: fontSize.caption, color: colors.muted },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.earth,
  },
  avatarText: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.surface,
  },
  ownerText: { flex: 1, minWidth: 0, gap: 2 },
  ownerName: { ...typography.body, color: colors.ink, fontWeight: '700' },
  ownerMeta: { fontSize: fontSize.label, color: colors.muted },
  uid: { fontSize: fontSize.caption, color: colors.muted },
});
