import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { ModalHeader } from '../../components/ModalHeader';
import { colors, fontSize, radius, spacing } from '../../theme';
import type { PixelPetAppearance, PixelPetState } from '../../types/pixelPet';
import {
  appearanceOptions, petUnlockedLevel,
  sleepSceneOptions, validPetAppearance, type PetAppearanceOption,
} from '../../services/pixelPet/pixelPetAppearance';
import { PetAppearancePreview } from './PetAppearancePreview';

type Pet = NonNullable<PixelPetState['pet']>;
function ChoiceRow({ label, options, selected, busy, onSelect }: {
  label: string; options: PetAppearanceOption[]; selected: number | null;
  busy: boolean; onSelect: (level: number | null) => void;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>
        {[{ level: null, name: 'Tự động theo cấp' }, ...options].map((option) => (
          <Pressable key={option.level ?? 'auto'} accessibilityRole="radio"
            accessibilityLabel={`${label}: ${option.name}${option.level === null ? '' : `, mở ở Lv ${option.level}`}`}
            accessibilityState={{ selected: selected === option.level, disabled: busy }}
            disabled={busy} onPress={() => onSelect(option.level)}
            style={[styles.choice, selected === option.level && styles.selected]}>
            <View style={styles.choiceTitle}>
              <Text style={styles.choiceName}>{option.name}</Text>
              {selected === option.level && <Feather name="check" size={fontSize.body} color={colors.success} />}
            </View>
            <Text style={styles.meta}>{option.level === null ? 'Theo cấp hiện tại' : `Đã mở · Lv ${option.level}`}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** One live preview rather than one animation per selectable chip. */
export function PetAppearancePicker({ pet, busy, error, onSave, onClose }: {
  pet: Pet; busy: boolean; error: string | null;
  onSave: (selection: PixelPetAppearance) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<PixelPetAppearance>({
    appearanceLevel: pet.appearanceLevel ?? null,
    sleepSceneLevel: pet.sleepSceneLevel ?? null,
  });
  const unlocked = petUnlockedLevel(pet);
  const scenes = sleepSceneOptions(pet.speciesId);
  const changed = draft.appearanceLevel !== (pet.appearanceLevel ?? null) ||
    draft.sleepSceneLevel !== (pet.sleepSceneLevel ?? null);
  return (
    <DialogModal visible onRequestClose={busy ? undefined : onClose}
      onBackdropPress={busy ? undefined : onClose} style={styles.dialog}>
      <ModalHeader title="Diện mạo linh thú" accessibilityLabel="Đóng chọn diện mạo" disabled={busy} onClose={onClose} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <PetAppearancePreview pet={pet} selection={draft} />
        <Text style={styles.hint}>Đã mở khóa đến Lv {unlocked} · Vuốt để xem các mẫu</Text>
        <ChoiceRow label="Hình dạng" options={appearanceOptions(pet.speciesId).filter((option) => option.level <= unlocked)}
          selected={draft.appearanceLevel} busy={busy} onSelect={(appearanceLevel) => setDraft((value) => ({ ...value, appearanceLevel }))} />
        {scenes.length > 0 ? (
          <ChoiceRow label="Khung ngủ" options={scenes.filter((option) => option.level <= unlocked)}
            selected={draft.sleepSceneLevel} busy={busy} onSelect={(sleepSceneLevel) => setDraft((value) => ({ ...value, sleepSceneLevel }))} />
        ) : <Text style={styles.meta}>Linh thú này chưa có khung ngủ riêng.</Text>}
      </ScrollView>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Button title="Áp dụng diện mạo" loading={busy} disabled={!changed || !validPetAppearance(pet, draft)} onPress={() => onSave(draft)} />
    </DialogModal>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '90%' },
  scroll: { flexShrink: 1 },
  content: { gap: spacing.lg, paddingBottom: spacing.sm },
  hint: { fontSize: fontSize.caption, color: colors.muted, textAlign: 'center' },
  section: { gap: spacing.sm },
  label: { fontSize: fontSize.body, fontWeight: '700', color: colors.ink },
  choices: { gap: spacing.sm, paddingBottom: spacing.xs },
  choice: { minHeight: 56, minWidth: 132, padding: spacing.md, gap: spacing.xs,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  selected: { backgroundColor: colors.sunlightFaint, borderColor: colors.sunlightBorder },
  choiceTitle: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', justifyContent: 'space-between' },
  choiceName: { color: colors.ink, fontSize: fontSize.small, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: fontSize.caption },
  error: { color: colors.danger, fontSize: fontSize.small },
});
