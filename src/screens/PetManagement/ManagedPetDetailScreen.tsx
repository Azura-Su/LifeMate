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
import { PUPPET_PREVIEW_CLIPS } from '../../services/pixelPet/celestialStagPuppet';
import type { PixelPetExpression } from '../../services/pixelPet/pixelPetExpressions';
import type { PixelPetAnyClipId } from '../../types/pixelPet';
import { colors, fontSize, radius, spacing, typography } from '../../theme';
import { PixelPetSprite } from '../PixelPet/PixelPetSprite';

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

const statusLabel: Record<ManagedPet['status'], string> = {
  owned: 'Đã có chủ',
  reserved: 'Đang giữ chỗ',
  available: 'Có thể nhận nuôi',
};

export function ManagedPetDetailScreen({ pet, active, onBack }: Props) {
  const appActive = useScreenActive();
  const [clip, setClip] = useState<PixelPetAnyClipId>('idle');
  const [loopMovement, setLoopMovement] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [expression, setExpression] = useState<PixelPetExpression | null>(null);
  const species = pixelPetSpecies(pet.speciesId)!;
  const stage = pet.adoption?.stage ?? 'hatchling';

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
    setSleeping(false);
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
      <View
        style={[
          styles.preview,
          { borderColor: species.palette[0], backgroundColor: colors.surface },
        ]}
      >
        <PixelPetSprite
          species={species}
          stage={stage}
          size={224}
          clip={clip}
          flightPhase={clip === 'fly' ? 'glide' : undefined}
          expression={expression}
          sleeping={sleeping}
          active={active && appActive}
          loopMovement={loopMovement}
          walking={petMovementKind(species) === 'walk'}
          onClipEnd={resetPreview}
        />
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Hoạt động
        </Text>
        <View style={styles.options}>
          {activities.map(
            ({ clip: value, label, loop = false, rest = false }) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`Xem thử ${label}`}
                accessibilityState={{
                  selected: rest
                    ? sleeping
                    : !sleeping &&
                      clip === value &&
                      (value === 'happy' || expression === null),
                }}
                onPress={() => {
                  if (rest) {
                    setExpression(null);
                    setLoopMovement(false);
                    setClip('idle');
                    setSleeping(true);
                  } else if (value === 'happy') previewExpression('excited');
                  else previewClip(value, loop);
                }}
                style={[
                  styles.option,
                  (rest
                    ? sleeping
                    : !sleeping &&
                      clip === value &&
                      (value === 'happy' || expression === null)) &&
                    styles.optionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    (rest
                      ? sleeping
                      : !sleeping &&
                        clip === value &&
                        (value === 'happy' || expression === null)) &&
                      styles.optionTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ),
          )}
        </View>
        <Text style={styles.helper}>
          Chỉ xem thử tại máy; không thay đổi dữ liệu linh thú.
        </Text>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Thông tin linh thú
        </Text>
        <View style={styles.facts}>
          <Fact label="Trạng thái" value={statusLabel[pet.status]} />
          {pet.adoption ? (
            <>
              <Fact
                label="Cấp độ"
                value={`Lv ${pet.adoption.level} · ${stageLabel[stage]}`}
              />
              <Fact
                label="Kinh nghiệm"
                value={`${pet.adoption.totalExp} EXP`}
              />
              <Fact
                label="Nhận nuôi"
                value={new Date(pet.adoption.adoptedAt).toLocaleDateString(
                  'vi-VN',
                )}
              />
            </>
          ) : pet.reservedUntil ? (
            <Fact
              label="Giữ chỗ đến"
              value={new Date(pet.reservedUntil).toLocaleString('vi-VN')}
            />
          ) : (
            <Fact label="Kỹ năng" value={species.skill} />
          )}
        </View>
        {holder && (
          <View style={styles.owner}>
            <Feather name="user" size={16} color={colors.earth} />
            <View style={styles.ownerText}>
              <Text style={styles.ownerName}>
                {holder.name || 'Chưa đặt tên'}
              </Text>
              {!!holder.email && (
                <Text selectable style={typography.small}>
                  {holder.email}
                </Text>
              )}
              <Text selectable style={styles.uid}>
                UID: {holder.uid}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  preview: {
    minHeight: 248,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  section: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.ink,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
  },
  optionSelected: { borderColor: colors.earth, backgroundColor: colors.earth },
  optionText: {
    fontSize: fontSize.small,
    fontWeight: '600',
    color: colors.ink,
  },
  optionTextSelected: { color: colors.surface },
  helper: {
    ...typography.small,
    fontSize: fontSize.caption,
    color: colors.muted,
  },
  facts: { gap: spacing.sm },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  factLabel: { ...typography.small, color: colors.muted },
  factValue: {
    ...typography.small,
    color: colors.ink,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  owner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  ownerText: { flex: 1, gap: spacing.xs },
  ownerName: { ...typography.body, color: colors.ink, fontWeight: '600' },
  uid: { ...typography.small, fontSize: fontSize.caption, color: colors.muted },
});
