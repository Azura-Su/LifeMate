import { memo, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import {
  PUPPET_ANCHORS,
  PUPPET_BODY_PIVOT,
  PUPPET_CLIPS,
  PUPPET_LAYOUT,
  puppetPlayback,
  puppetTrackKey,
  type PuppetPart,
  type PuppetTrackKey,
} from '../../services/pixelPet/celestialStagPuppet';
import type { PixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import { sampleTrack, STAGE_LOOK } from '../../services/pixelPet/pixelPetRig';
import type { PixelPetAnyClipId, PixelPetStage } from '../../types/pixelPet';
import { STAG_LAYERS } from './petArt';
import { usePetPlayback } from './usePetPlayback';

type Props = {
  species: PixelPetSpecies;
  stage: PixelPetStage;
  size: number;
  clip: PixelPetAnyClipId;
  active: boolean;
  loopMovement: boolean;
  onClipEnd?: () => void;
};
type Progress = { value: number };

const TAU = Math.PI * 2;
const FUR = '#D9772D';
const FLAME = '#58D6FF';
const MOTES = [
  { x: 0.3, y: 0.62, phase: 0, color: '#FFE27A' },
  { x: 0.42, y: 0.5, phase: 0.14, color: '#7CF0D8' },
  { x: 0.55, y: 0.66, phase: 0.28, color: '#C79BFF' },
  { x: 0.68, y: 0.52, phase: 0.42, color: '#FF9ABF' },
  { x: 0.78, y: 0.64, phase: 0.57, color: '#FFE27A' },
  { x: 0.2, y: 0.46, phase: 0.71, color: '#7CC8FF' },
  { x: 0.5, y: 0.42, phase: 0.85, color: '#FFB86B' },
  { x: 0.85, y: 0.46, phase: 0.93, color: '#7CF0D8' },
] as const;
const STAGE_LABEL = {
  hatchling: 'ấu thể',
  juvenile: 'trưởng thành',
  ascended: 'thăng hoa',
} as const;

const Glow = memo(function Glow({
  color,
  diameter,
}: {
  color: string;
  diameter: number;
}) {
  return (
    <Svg width={diameter} height={diameter} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient
          id="glow"
          cx="50"
          cy="50"
          r="50"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={color} stopOpacity="0.95" />
          <Stop offset="0.45" stopColor={color} stopOpacity="0.35" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill="url(#glow)" />
    </Svg>
  );
});

const Star = memo(function Star({ diameter }: { diameter: number }) {
  return (
    <Svg width={diameter} height={diameter} viewBox="0 0 100 100">
      <Path
        d="M50 0 L58 42 L100 50 L58 58 L50 100 L42 58 L0 50 L42 42 Z"
        fill="#FFFBE6"
      />
    </Svg>
  );
});

/** Samples one transform track of the active clip on the UI thread. */
function useTrackStyle(
  part: PuppetPart | 'root',
  progress: Progress,
  key: PuppetTrackKey,
  size: number,
) {
  return useAnimatedStyle(() => {
    const [dx, dy, rotate, scale] = sampleTrack(
      PUPPET_CLIPS[key][part],
      progress.value,
    );
    if (part === 'root')
      return {
        transform: [
          { translateX: (dx * size) / 100 },
          { translateY: (dy * size) / 100 },
          { scaleX: scale },
        ],
      };
    return {
      transform: [
        { translateX: (dx * size) / 100 },
        { translateY: (dy * size) / 100 },
        { rotate: `${rotate}deg` },
        { scale },
      ],
    };
  });
}

function PuppetLayer({
  part,
  size,
  progress,
  clipKey,
  children,
}: {
  part: PuppetPart;
  size: number;
  progress: Progress;
  clipKey: PuppetTrackKey;
  children?: ReactNode;
}) {
  const place = PUPPET_LAYOUT[part];
  const style = useTrackStyle(part, progress, clipKey, size);
  const origin = place.pivot
    ? `${((place.pivot[0] - place.left) / place.width) * 100}% ${
        ((place.pivot[1] - place.top) / place.height) * 100
      }%`
    : '50% 50%';
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: place.left * size,
          top: place.top * size,
          width: place.width * size,
          height: place.height * size,
          transformOrigin: origin,
        },
        style,
      ]}
    >
      <Image
        source={STAG_LAYERS[part]}
        style={StyleSheet.absoluteFill}
        resizeMode="stretch"
        fadeDuration={0}
      />
      {children}
    </Animated.View>
  );
}

/** Pulsing blue glow rising off one hoof. */
function HoofFlame({
  x,
  y,
  index,
  size,
  progress,
  clipKey,
}: {
  x: number;
  y: number;
  index: number;
  size: number;
  progress: Progress;
  clipKey: PuppetTrackKey;
}) {
  const d = size * 0.2;
  const cycles = 5 + (index % 3);
  const phase = index * 0.23;
  const style = useAnimatedStyle(() => {
    const flame = sampleTrack(PUPPET_CLIPS[clipKey].fx, progress.value)[0];
    const flicker =
      0.65 + 0.35 * Math.sin((progress.value * cycles + phase) * TAU);
    return {
      opacity: Math.min(1, 0.2 + 0.55 * flame * flicker),
      transform: [
        { translateY: -d * 0.12 * flame * flicker },
        { scale: 0.7 + 0.45 * flame * flicker },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: x * size - d / 2,
          top: (y - 0.05) * size - d / 2,
        },
        style,
      ]}
    >
      <Glow color={FLAME} diameter={d} />
    </Animated.View>
  );
}

/** Twinkle on one gem; gems share a clip-wide strength but not a rhythm. */
function GemGlint({
  x,
  y,
  index,
  size,
  progress,
  clipKey,
}: {
  x: number;
  y: number;
  index: number;
  size: number;
  progress: Progress;
  clipKey: PuppetTrackKey;
}) {
  const d = size * 0.075;
  const cycles = 3 + (index % 3);
  const phase = index * 0.17;
  const style = useAnimatedStyle(() => {
    const gem = sampleTrack(PUPPET_CLIPS[clipKey].fx, progress.value)[1];
    const wave = Math.max(0, Math.sin((progress.value * cycles + phase) * TAU));
    const k = Math.min(1, gem * wave * wave);
    return {
      opacity: k,
      transform: [{ scale: 0.35 + 0.9 * k }, { rotate: `${k * 45}deg` }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x - d / 2, top: y - d / 2 }, style]}
    >
      <Star diameter={d} />
    </Animated.View>
  );
}

/** Eyelid that closes with the clip's blink track. */
function Eyelid({
  x,
  y,
  size,
  progress,
  clipKey,
}: {
  x: number;
  y: number;
  size: number;
  progress: Progress;
  clipKey: PuppetTrackKey;
}) {
  const w = size * 0.04;
  const h = size * 0.046;
  const style = useAnimatedStyle(() => {
    const closed = sampleTrack(PUPPET_CLIPS[clipKey].blink, progress.value)[0];
    return {
      opacity: closed > 0.05 ? 1 : 0,
      transform: [{ scaleY: Math.max(0.05, Math.min(1, closed)) }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: x - w / 2,
          top: y - h / 2,
          width: w,
          height: h,
          borderRadius: w / 2,
          backgroundColor: FUR,
          borderBottomWidth: StyleSheet.hairlineWidth * 2,
          borderBottomColor: '#3A1E10',
        },
        style,
      ]}
    />
  );
}

/** A spark that drifts up from the body and fades. */
function Mote({
  mote,
  size,
  progress,
  clipKey,
}: {
  mote: (typeof MOTES)[number];
  size: number;
  progress: Progress;
  clipKey: PuppetTrackKey;
}) {
  const d = size * 0.026;
  const style = useAnimatedStyle(() => {
    const strength = sampleTrack(PUPPET_CLIPS[clipKey].fx, progress.value)[3];
    const f = (progress.value * 2 + mote.phase) % 1;
    return {
      opacity: Math.min(1, strength) * Math.sin(f * Math.PI) * 0.9,
      transform: [
        { translateX: Math.sin((f + mote.phase) * TAU) * size * 0.02 },
        { translateY: -f * size * 0.28 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: mote.x * size - d / 2,
          top: mote.y * size - d / 2,
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: mote.color,
        },
        style,
      ]}
    />
  );
}

function Aura({
  size,
  progress,
  clipKey,
  boost,
}: {
  size: number;
  progress: Progress;
  clipKey: PuppetTrackKey;
  boost: number;
}) {
  const d = size * 0.95;
  const style = useAnimatedStyle(() => {
    const aura =
      sampleTrack(PUPPET_CLIPS[clipKey].fx, progress.value)[2] + boost;
    return {
      opacity: Math.min(1, aura) * 0.75,
      transform: [{ scale: 0.95 + 0.1 * Math.min(1.2, aura) }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: size * 0.5 - d / 2,
          top: size * 0.52 - d / 2,
        },
        style,
      ]}
    >
      <Glow color="#FFD58A" diameter={d} />
    </Animated.View>
  );
}

/** Hand-rigged puppet: wings, head and tail pivot; glows ride on top. */
export function CelestialStagPuppet({
  species,
  stage,
  size,
  clip,
  active,
  loopMovement,
  onClipEnd,
}: Props) {
  const clipKey = puppetTrackKey(clip, loopMovement);
  const { progress } = usePetPlayback({
    clip,
    speciesId: species.id,
    active,
    loopMovement,
    onClipEnd,
    playback: puppetPlayback(clip, loopMovement),
  });
  const look = STAGE_LOOK[stage];
  const root = useTrackStyle('root', progress, clipKey, size);
  const body = useTrackStyle('body', progress, clipKey, size);
  const bodyOrigin = `${PUPPET_BODY_PIVOT[0] * 100}% ${PUPPET_BODY_PIVOT[1] * 100}%`;
  const lite = size < 96;
  const at = (anchor: readonly [number, number], layer?: PuppetPart) => {
    const place = layer ? PUPPET_LAYOUT[layer] : null;
    return {
      x: (anchor[0] - (place?.left ?? 0)) * size,
      y: (anchor[1] - (place?.top ?? 0)) * size,
    };
  };

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${species.name}, ${STAGE_LABEL[stage]}`}
      style={{ width: size, height: size }}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scale: look.scale }] },
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, root]}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transformOrigin: bodyOrigin },
              body,
            ]}
          >
            <Aura
              size={size}
              progress={progress}
              clipKey={clipKey}
              boost={look.aura ? 0.3 : 0}
            />
            <PuppetLayer
              part="tail"
              size={size}
              progress={progress}
              clipKey={clipKey}
            />
            <PuppetLayer
              part="body"
              size={size}
              progress={progress}
              clipKey={clipKey}
            >
              {PUPPET_ANCHORS.bodyGems.map((anchor, index) => (
                <GemGlint
                  key={`bg${index}`}
                  index={index}
                  {...at(anchor, 'body')}
                  size={size}
                  progress={progress}
                  clipKey={clipKey}
                />
              ))}
            </PuppetLayer>
            {PUPPET_ANCHORS.hooves.map((anchor, index) => (
              <HoofFlame
                key={`hf${index}`}
                index={index}
                x={anchor[0]}
                y={anchor[1]}
                size={size}
                progress={progress}
                clipKey={clipKey}
              />
            ))}
            <PuppetLayer
              part="wingR"
              size={size}
              progress={progress}
              clipKey={clipKey}
            />
            <PuppetLayer
              part="wingL"
              size={size}
              progress={progress}
              clipKey={clipKey}
            />
            <PuppetLayer
              part="head"
              size={size}
              progress={progress}
              clipKey={clipKey}
            >
              {PUPPET_ANCHORS.eyes.map((anchor, index) => (
                <Eyelid
                  key={`ey${index}`}
                  {...at(anchor, 'head')}
                  size={size}
                  progress={progress}
                  clipKey={clipKey}
                />
              ))}
              {PUPPET_ANCHORS.headGems.map((anchor, index) => (
                <GemGlint
                  key={`hg${index}`}
                  index={index + 5}
                  {...at(anchor, 'head')}
                  size={size}
                  progress={progress}
                  clipKey={clipKey}
                />
              ))}
            </PuppetLayer>
            {!lite &&
              MOTES.map((mote, index) => (
                <Mote
                  key={`mo${index}`}
                  mote={mote}
                  size={size}
                  progress={progress}
                  clipKey={clipKey}
                />
              ))}
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}
