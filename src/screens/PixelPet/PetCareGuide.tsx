import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import { ModalHeader } from '../../components/ModalHeader';
import { ModalScreen } from '../../components/ModalScreen';
import type { PixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import {
  CARE_TASKS,
  LEVEL_THRESHOLDS,
  petUnlocks,
  type PetUnlock,
} from '../../services/pixelPet/pixelPetGuide';
import { colors, fontSize, radius, spacing } from '../../theme';

const KIND: Record<
  PetUnlock['kind'],
  { label: string; icon: keyof typeof Feather.glyphMap }
> = {
  stage: { label: 'Giai đoạn', icon: 'trending-up' },
  skill: { label: 'Kỹ năng', icon: 'zap' },
  skin: { label: 'Trang phục', icon: 'gift' },
  scene: { label: 'Cảnh ngủ', icon: 'moon' },
};

/** How to earn EXP, and what this species unlocks at each level. */
export function PetCareGuide({
  species,
  level,
  onClose,
}: {
  species: PixelPetSpecies;
  /** Current level, or null before adoption. */
  level: number | null;
  onClose: () => void;
}) {
  return (
    <ModalScreen
      onRequestClose={onClose}
      contentGap={spacing.lg}
      fixedHeader={
        <ModalHeader
          eyebrow="HƯỚNG DẪN"
          title="Chăm linh thú"
          accessibilityLabel="Đóng hướng dẫn chăm linh thú"
          onClose={onClose}
        />
      }
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nhiệm vụ nhận EXP</Text>
        <View style={styles.card}>
          {CARE_TASKS.map((task, index) => (
            <View
              key={task.id}
              style={[styles.row, index > 0 && styles.divider]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{task.title}</Text>
                <Text style={styles.rowDetail}>{task.detail}</Text>
              </View>
              <Text style={styles.expBadge}>+{task.exp} EXP</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          Số tiền không ảnh hưởng EXP. Xoá giao dịch có thể làm giảm EXP đã
          nhận.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lộ trình của {species.name}</Text>
        <View style={styles.card}>
          {petUnlocks(species.id, species.skill).map((unlock, index) => {
            const reached = level !== null && level >= unlock.level;
            const kind = KIND[unlock.kind];
            return (
              <View
                key={`${unlock.level}-${unlock.kind}`}
                accessibilityLabel={`Lv ${unlock.level}, ${kind.label} ${
                  unlock.name
                }, ${reached ? 'đã mở' : 'chưa mở'}`}
                style={[styles.row, index > 0 && styles.divider]}
              >
                <View style={[styles.levelPill, reached && styles.reached]}>
                  <Text
                    style={[styles.levelText, reached && styles.reachedText]}
                  >
                    Lv {unlock.level}
                  </Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{unlock.name}</Text>
                  <Text style={styles.rowDetail}>
                    {kind.label} · cần {LEVEL_THRESHOLDS[unlock.level - 1]} EXP
                  </Text>
                </View>
                <Feather
                  name={reached ? 'check-circle' : kind.icon}
                  size={18}
                  color={reached ? colors.success : colors.muted}
                />
              </View>
            );
          })}
        </View>
        <Text style={styles.note}>
          Trang phục sẽ hiển thị trên linh thú khi tính năng thay đồ ra mắt.
        </Text>
      </View>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: fontSize.label,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: fontSize.body, fontWeight: '600', color: colors.ink },
  rowDetail: { fontSize: fontSize.small, color: colors.muted },
  expBadge: {
    fontSize: fontSize.label,
    fontWeight: '700',
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },
  levelPill: {
    minWidth: 48,
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.skySoft,
    paddingVertical: spacing.xs,
  },
  levelText: {
    fontSize: fontSize.label,
    fontWeight: '700',
    color: colors.muted,
  },
  reached: { backgroundColor: colors.sunlightAction },
  reachedText: { color: colors.sunlight },
  note: { fontSize: fontSize.small, color: colors.muted },
});
