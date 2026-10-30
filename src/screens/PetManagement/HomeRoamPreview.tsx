import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, radius, spacing, typography } from '../../theme';
import { stageForLevel } from '../../services/pixelPet/pixelPetGuide';
import type { PixelPetSpeciesId } from '../../types/pixelPet';
import { useScreenActive } from '../../hooks/useScreenActive';
import { HomePetRoamer } from '../Home/HomePetRoamer';

const TABS = [
  { icon: 'home', label: 'Home' },
  { icon: 'credit-card', label: 'Tài chính' },
  { icon: 'image', label: 'Ký ức' },
  { icon: 'user', label: 'Cá nhân' },
] as const;

/** Full-screen mock of Home so admins can watch a pet roam the tab bar. */
export function HomeRoamPreview({
  speciesId,
  level,
  onLevelChange,
  name,
  onClose,
}: {
  speciesId: PixelPetSpeciesId;
  level: number;
  onLevelChange: (level: number) => void;
  name: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const active = useScreenActive();
  const [lane, setLane] = useState({ width: 0, height: 0 });
  const stage = stageForLevel(level);
  const preview = useMemo(
    () => ({ speciesId, stage, level }),
    [speciesId, stage, level],
  );
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>XEM THỬ TRÊN HOME</Text>
            <Text style={typography.heading}>{name}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Giảm cấp xem thử"
            disabled={level <= 1}
            onPress={() => onLevelChange(level - 1)}
            style={[styles.close, level <= 1 && styles.disabled]}
          >
            <Feather name="minus" size={18} color={colors.ink} />
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.level}>
            Lv {level}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tăng cấp xem thử"
            disabled={level >= 10}
            onPress={() => onLevelChange(level + 1)}
            style={[styles.close, level >= 10 && styles.disabled]}
          >
            <Feather name="plus" size={18} color={colors.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng xem thử trên Home"
            onPress={onClose}
            style={styles.close}
          >
            <Feather name="x" size={20} color={colors.ink} />
          </Pressable>
        </View>
        <View
          style={styles.lane}
          onLayout={({ nativeEvent: { layout } }) =>
            setLane({ width: layout.width, height: layout.height })
          }
        >
          <Text style={styles.hint}>
            Linh thú hoạt động tối đa 20 giây rồi ngủ. Chạm hoặc kéo để đánh
            thức và bắt đầu lượt hoạt động mới.
          </Text>
          {lane.height > 0 && (
            <HomePetRoamer
              uid={null}
              preview={preview}
              active={active}
              containerWidth={lane.width}
              containerHeight={lane.height}
              topInset={0}
            />
          )}
        </View>
        <View
          style={[
            styles.tabBar,
            { paddingBottom: insets.bottom || spacing.sm },
          ]}
        >
          {TABS.map((tab, index) => (
            <View key={tab.label} style={styles.tab}>
              <Feather
                name={tab.icon}
                size={22}
                color={index === 0 ? colors.earth : colors.muted}
              />
              <Text
                style={[styles.tabLabel, index === 0 && styles.tabLabelActive]}
              >
                {tab.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerText: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: fontSize.caption,
    fontWeight: '700',
    color: colors.muted,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  level: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: fontSize.small,
    fontWeight: '700',
    color: colors.ink,
  },
  disabled: { opacity: 0.4 },
  lane: { flex: 1, padding: spacing.md },
  hint: {
    ...typography.small,
    color: colors.muted,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  tabBar: {
    flexDirection: 'row',
    paddingTop: 6,
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.muted },
  tabLabelActive: { color: colors.earth },
});
