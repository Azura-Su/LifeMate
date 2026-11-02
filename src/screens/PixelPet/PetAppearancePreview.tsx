import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { PixelPetAppearance, PixelPetState } from '../../types/pixelPet';
import { pixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import { resolvePetAppearance } from '../../services/pixelPet/pixelPetAppearance';
import { PixelPetSprite } from './PixelPetSprite';
import { HomeSleepGarden } from '../Home/HomeSleepGarden';
import { HomeSleepScene } from '../Home/HomeSleepScene';
import { CELESTIAL_STAG_HOME_GARDEN_SIZE, CELESTIAL_STAG_HOME_PET_SIZE } from '../Home/celestialStagHomeLayout';
import { GARUDA_SCENE_BASELINE_Y, GARUDA_SCENE_DESIGN_SIZE, garudaSleepLandingLift } from '../Home/garudaSleepSceneTimeline';
import { colors, radius, spacing } from '../../theme';

export function petAppearanceComposition(speciesId: string, size: number) {
  const stag = speciesId === 'celestial_stag';
  const designSize = speciesId === 'garuda' ? GARUDA_SCENE_DESIGN_SIZE : CELESTIAL_STAG_HOME_GARDEN_SIZE;
  const petSize = stag ? CELESTIAL_STAG_HOME_PET_SIZE : 120;
  return { designSize, petSize, scale: size / designSize,
    baseline: stag ? petSize * 0.81 : GARUDA_SCENE_BASELINE_Y,
    lift: speciesId === 'garuda' ? garudaSleepLandingLift(designSize) : 0 };
}

/** Same pet/scene proportion and ground anchor as Home, including old skins. */
export function PetAppearancePreview({ pet, selection, active = true, size: requestedSize }: {
  pet: NonNullable<PixelPetState['pet']>; selection?: PixelPetAppearance; active?: boolean; size?: number;
}) {
  const { width } = useWindowDimensions();
  const size = requestedSize ?? Math.min(CELESTIAL_STAG_HOME_GARDEN_SIZE, Math.max(80, width - spacing.xl * 4));
  const display = resolvePetAppearance(pet, selection);
  const species = pixelPetSpecies(pet.speciesId)!;
  const stag = pet.speciesId === 'celestial_stag';
  const { designSize, petSize, scale, baseline, lift } = petAppearanceComposition(pet.speciesId, size);
  return (
    <View style={[styles.preview, { height: size }]} pointerEvents="none" accessibilityLabel="Xem trước hình dạng và khung ngủ">
      <View style={{ width: size, height: size }}>
        <View style={{ position: 'absolute', width: designSize, height: designSize,
          top: (size - designSize) / 2, left: (size - designSize) / 2, transform: [{ scale }] }}>
          <View style={{ position: 'absolute', width: petSize, height: petSize,
            left: (designSize - petSize) / 2, top: designSize * (296 / 320) - baseline }}>
            {display.sceneLevel !== null && stag && <HomeSleepGarden visible active={false}
              staticFrame={15} level={display.sceneLevel} size={designSize} petSize={petSize} />}
            {display.sceneLevel !== null && !stag &&
              (pet.speciesId === 'nine_tail_fox' || pet.speciesId === 'garuda' || pet.speciesId === 'rune_wolf') && (
                <HomeSleepScene key={pet.speciesId} scene={pet.speciesId} visible active={active} size={designSize} viewportWidth={designSize} />
              )}
            <View style={{ transform: [{ translateY: -lift }] }}>
              <PixelPetSprite species={species} stage={display.stage} level={display.level}
                homeStagPhase={stag ? 'sleep' : undefined} size={petSize} sleeping active={active}
                clip="idle" homeMotion={false} loopMovement={false} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  preview: { alignSelf: 'stretch', alignItems: 'center', overflow: 'hidden',
    borderRadius: radius.lg, backgroundColor: colors.background },
});
