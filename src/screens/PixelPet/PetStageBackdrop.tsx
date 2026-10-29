import { StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors } from '../../theme';

/**
 * Sky behind the pet: a soft vertical wash, a glow in the species' accent
 * colour and a blurred ground shadow under where the sprite's feet land.
 */
export function PetStageBackdrop({
  tint,
  spriteSize,
}: {
  tint: string;
  spriteSize: number;
}) {
  const shadowWidth = spriteSize * 0.46;
  const shadowHeight = spriteSize * 0.07;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.skySoft} />
            <Stop offset="1" stopColor={colors.surface} />
          </LinearGradient>
          <RadialGradient id="aura" cx="50%" cy="48%" r="45%">
            <Stop offset="0" stopColor={tint} stopOpacity="0.28" />
            <Stop offset="1" stopColor={tint} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#sky)" />
        <Rect width="100%" height="100%" fill="url(#aura)" />
      </Svg>
      <View style={styles.center}>
        <Svg
          width={shadowWidth}
          height={shadowHeight}
          // Feet sit about a third of the canvas below its centre.
          style={{ transform: [{ translateY: spriteSize * 0.3 }] }}
        >
          <Defs>
            <RadialGradient id="shadow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.ink} stopOpacity="0.22" />
              <Stop offset="1" stopColor={colors.ink} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={shadowWidth / 2}
            cy={shadowHeight / 2}
            rx={shadowWidth / 2}
            ry={shadowHeight / 2}
            fill="url(#shadow)"
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
