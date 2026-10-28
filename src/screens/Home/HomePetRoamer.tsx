import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { PixelPetSprite } from '../PixelPet/PixelPetSprite';
import { pixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import {
  readOwnedPixelPet,
  subscribeOwnedPixelPet,
} from '../../services/pixelPet/pixelPetApi';
import { spacing } from '../../theme';

const SIZE = 56;
/** One pass across the bar; the loop flies there and back. */
const PASS_MS = 9000;

type Props = {
  uid: string | null;
  active: boolean;
  onPress: () => void;
};

/** The owned pet flies back and forth just above the tab bar. */
export function HomePetRoamer({ uid, active, onPress }: Props) {
  const read = useCallback(() => (uid ? readOwnedPixelPet(uid) : null), [uid]);
  const pet = useSyncExternalStore(subscribeOwnedPixelPet, read, read);
  const species = pixelPetSpecies(pet?.speciesId ?? '');
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const range = Math.max(0, width - SIZE - spacing.md * 2);

  useEffect(() => {
    cancelAnimation(progress);
    if (!active || reducedMotion || !range) return;
    progress.value = withRepeat(
      withTiming(2, { duration: PASS_MS * 2, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [active, reducedMotion, range, progress]);

  const flight = useAnimatedStyle(() => {
    const p = progress.value;
    const outbound = p < 1;
    // Ease the turn at each end so the pet slows before flipping.
    const leg = outbound ? p : 2 - p;
    const eased = leg * leg * (3 - 2 * leg);
    return {
      transform: [
        { translateX: eased * range },
        { translateY: Math.sin(p * Math.PI * 6) * 5 },
        { scaleX: outbound ? 1 : -1 },
      ],
    };
  });

  if (!species || !pet) return null;
  return (
    <View
      pointerEvents="box-none"
      style={styles.lane}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.pet, flight]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mở linh thú ${species.name}`}
          onPress={onPress}
          hitSlop={spacing.sm}
        >
          <PixelPetSprite
            species={species}
            stage={pet.stage}
            size={SIZE}
            active={active}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  lane: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.xs,
    height: SIZE,
  },
  pet: { position: 'absolute', left: spacing.md, width: SIZE, height: SIZE },
});
