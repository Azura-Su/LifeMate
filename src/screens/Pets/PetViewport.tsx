import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import type { PetDNA, PetEffect, PetSpecies } from '../../types/pet';
import { colors, radius, typography } from '../../theme';
import { effectInfo, speciesInfo } from '../../services/pets/petCatalog';
import { canonicalPetJSON } from '../../services/pets/petGenetics';
import { createPetRotationResponder } from './petRotation';
import {
  consumePetAction,
  createPetArtRecipe,
  resolvePetPresentation,
  resolvePetFacing,
  type PetFacing,
  type PetAction,
} from './petPresentation';

const AnimatedView = Animated.View;
const OUTLINE = '#715541';
const EYE = ['#533A55', '#40546A', '#513D2F'];

function PetArt({ dna, facing }: { dna: PetDNA; facing: PetFacing }) {
  const art = createPetArtRecipe(dna);
  const [fur, cream, dark] = art.palette;
  const head = art.species.head;
  const ear = art.species.ears;
  const muzzle = art.species.muzzle;
  const variant = art.variants;
  const headScale = art.shape.head / 1000;
  const earScale = (art.shape.ears / 1000) * [0.94, 1, 1.06][art.variants.ears];
  const bodyScale =
    (art.shape.body / 1000) * [0.96, 1, 1.04][art.variants.body];
  const tailScale = (art.shape.tail / 1000) * [0.9, 1, 1.1][art.variants.tail];
  const eyeScale = art.shape.eyes / 1000;
  const id = art.seed.replace(/[^a-zA-Z0-9]/g, '') || 'pet';
  const eyeColor = EYE[art.iris] ?? EYE[0];
  const markCount = art.pattern === 0 ? 0 : art.pattern === 1 ? 4 : 8;
  const marks = Array.from({ length: markCount }, (_, index) => {
    const seed = art.patternVariant * 31 + index * 47 + head.length * 13;
    return {
      x: 91 + ((seed * 17) % 59),
      y: 54 + ((seed * 11) % 27),
      r: 1.7 + (index % 2),
    };
  });

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 240 260"
      preserveAspectRatio="xMidYMid meet"
      testID="pet-illustration"
      accessibilityLabel={`Thú cưng chibi nhìn từ ${facing === 'front' ? 'phía trước' : facing === 'back' ? 'phía sau' : facing === 'sideLeft' ? 'nghiêng trái' : 'nghiêng phải'}: ${dna.species.map((id) => speciesInfo(id).name).join(', ')}`}
    >
      <Defs>
        <LinearGradient id={`fur-${id}`} x1="0" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.42" />
          <Stop offset="0.42" stopColor={fur} />
          <Stop offset="1" stopColor={dark} stopOpacity="0.36" />
        </LinearGradient>
        <LinearGradient id={`belly-${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor={cream} />
        </LinearGradient>
      </Defs>
      <Ellipse
        cx="120"
        cy="235"
        rx="62"
        ry="11"
        fill="#8C7560"
        opacity="0.11"
      />

      <Tail
        species={art.species.tail}
        fur={fur}
        cream={cream}
        scale={tailScale}
      />
      {art.species.wings && (
        <Wings
          fur={fur}
          species={art.species.wings}
          variant={art.variants.wings ?? 0}
        />
      )}

      <Ellipse
        cx="120"
        cy="179"
        rx={54 * bodyScale}
        ry={48 * bodyScale}
        fill={`url(#fur-${id})`}
        stroke={OUTLINE}
        strokeWidth="2.4"
      />
      <Path
        d="M83 174 Q85 148 120 150 Q155 148 157 174 Q153 213 120 216 Q87 213 83 174Z"
        fill={`url(#belly-${id})`}
        stroke={OUTLINE}
        strokeWidth="1.6"
      />
      <BodyFeatures species={art.species.body} dark={dark} cream={cream} />
      <Path
        d="M91 157 Q101 149 111 154 M120 153 Q132 148 141 155 M101 211 Q108 219 116 216 M126 216 Q135 220 142 212"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.72"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <Feet
        species={art.species.feet}
        fur={fur}
        cream={cream}
        dark={dark}
        variant={art.variants.feet}
      />

      <Ears species={ear} fur={fur} cream={cream} scale={earScale} />
      <Path
        d="M62 110 Q62 55 95 43 Q120 28 145 43 Q178 55 178 110 Q178 151 153 161 Q139 171 120 166 Q101 171 87 161 Q62 151 62 110Z"
        fill={`url(#fur-${id})`}
        stroke={OUTLINE}
        strokeWidth="2.5"
        transform={`translate(120 100) scale(${headScale}) translate(-120 -100)`}
      />
      {facing !== 'back' && (
        <>
          <HeadFeatures species={head} fur={fur} cream={cream} dark={dark} />
          {head === 'owl' && <OwlFace cream={cream} />}
          {head === 'panda' && <PandaPatches dark={dark} />}
          {head === 'deer' && <DeerMarks cream={cream} />}
          {head === 'tiger' && <TigerMarks dark={dark} />}
          {head === 'fox' && <FoxCheeks cream={cream} />}
        </>
      )}
      {marks.map((mark, index) => (
        <Circle
          key={`mark-${index}`}
          cx={mark.x}
          cy={mark.y}
          r={mark.r}
          fill={index % 2 ? cream : dark}
          opacity="0.54"
        />
      ))}

      {facing === 'back' ? (
        <BackMarking cream={cream} dark={dark} />
      ) : facing === 'front' ? (
        <>
          <Eyes color={eyeColor} dark={dark} scale={eyeScale} />
          <Cheeks />
          <Muzzle
            species={muzzle}
            cream={cream}
            dark={dark}
            variant={art.variants.muzzle}
          />
          {head === 'cat' && <Whiskers dark={dark} />}
        </>
      ) : (
        <ProfileFace
          color={eyeColor}
          dark={dark}
          species={muzzle}
          cream={cream}
          mirrored={facing === 'sideRight'}
        />
      )}
      {head === 'deer' && <DeerAntlers dark={dark} />}
      {facing === 'front' && (
        <Path
          d="M111 151 Q120 157 129 151"
          fill="none"
          stroke={OUTLINE}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
      <Circle cx="120" cy="229" r="2.2" fill="#E5B29D" opacity="0.8" />
      <Circle
        cx={variant.head === 0 ? 120 : variant.head === 1 ? 111 : 129}
        cy={variant.head === 1 ? 47 : 45}
        r={variant.head === 2 ? 3 : 2.2}
        fill={variant.head === 0 ? cream : '#FFF8E9'}
        opacity="0.82"
      />
    </Svg>
  );
}

function Ears({
  species,
  fur,
  cream,
  scale,
}: {
  species: PetSpecies;
  fur: string;
  cream: string;
  scale: number;
}) {
  const isLong = species === 'rabbit';
  const isFloppy = species === 'dog';
  const isPointed =
    species === 'fox' ||
    species === 'cat' ||
    species === 'tiger' ||
    species === 'deer';
  if (species === 'owl')
    return (
      <Path
        d="M69 69 L78 36 Q84 44 92 48 M171 69 L162 36 Q156 44 148 48"
        fill={fur}
        stroke={OUTLINE}
        strokeWidth="2.3"
        strokeLinejoin="round"
        transform={`translate(120 70) scale(${scale}) translate(-120 -70)`}
      />
    );
  if (isLong)
    return (
      <G transform={`translate(120 72) scale(${scale}) translate(-120 -72)`}>
        <Ellipse
          cx="91"
          cy="55"
          rx="17"
          ry="37"
          fill={fur}
          stroke={OUTLINE}
          strokeWidth="2.4"
          transform="rotate(-12 91 55)"
        />
        <Ellipse
          cx="149"
          cy="55"
          rx="17"
          ry="37"
          fill={fur}
          stroke={OUTLINE}
          strokeWidth="2.4"
          transform="rotate(12 149 55)"
        />
        <Ellipse
          cx="92"
          cy="54"
          rx="8"
          ry="25"
          fill="#E8A9A8"
          opacity="0.8"
          transform="rotate(-12 92 54)"
        />
        <Ellipse
          cx="148"
          cy="54"
          rx="8"
          ry="25"
          fill="#E8A9A8"
          opacity="0.8"
          transform="rotate(12 148 54)"
        />
      </G>
    );
  if (isFloppy)
    return (
      <G transform={`translate(120 70) scale(${scale}) translate(-120 -70)`}>
        <Path
          d="M78 57 Q59 48 57 72 Q54 101 78 105 Q88 101 86 82Z M162 57 Q181 48 183 72 Q186 101 162 105 Q152 101 154 82Z"
          fill={fur}
          stroke={OUTLINE}
          strokeWidth="2.3"
        />
        <Path
          d="M70 71 Q66 88 79 91 M170 71 Q174 88 161 91"
          fill="none"
          stroke={cream}
          strokeWidth="5"
          strokeLinecap="round"
        />
      </G>
    );
  if (isPointed)
    return (
      <G transform={`translate(120 70) scale(${scale}) translate(-120 -70)`}>
        <Path
          d="M69 83 Q67 54 76 31 Q81 21 87 35 L103 60 M171 83 Q173 54 164 31 Q159 21 153 35 L137 60Z"
          fill={fur}
          stroke={OUTLINE}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <Path
          d="M76 63 Q77 46 81 38 L94 61Z M164 63 Q163 46 159 38 L146 61Z"
          fill="#E8B2A8"
          opacity="0.9"
        />
      </G>
    );
  return (
    <G transform={`translate(120 70) scale(${scale}) translate(-120 -70)`}>
      <Circle
        cx="82"
        cy="57"
        r="20"
        fill={fur}
        stroke={OUTLINE}
        strokeWidth="2.3"
      />
      <Circle
        cx="158"
        cy="57"
        r="20"
        fill={fur}
        stroke={OUTLINE}
        strokeWidth="2.3"
      />
      <Circle cx="82" cy="57" r="9" fill="#E9B7A9" opacity="0.8" />
      <Circle cx="158" cy="57" r="9" fill="#E9B7A9" opacity="0.8" />
    </G>
  );
}

function Tail({
  species,
  fur,
  cream,
  scale,
}: {
  species: PetSpecies;
  fur: string;
  cream: string;
  scale: number;
}) {
  if (species === 'rabbit' || species === 'hamster')
    return (
      <G>
        <Circle
          cx="169"
          cy="192"
          r={15 * scale}
          fill={cream}
          stroke={OUTLINE}
          strokeWidth="2"
        />
        <Circle cx="169" cy="192" r="7" fill="#FFFFFF" opacity="0.8" />
      </G>
    );
  if (species === 'pig')
    return (
      <Path
        d="M166 185 q17 -11 18 2 q1 9 -9 7 q-8 -1 -4 -7 q4 -3 7 0"
        fill="none"
        stroke={fur}
        strokeWidth={7 * scale}
        strokeLinecap="round"
      />
    );
  const path =
    species === 'fox'
      ? 'M161 192 Q196 184 194 219 Q180 227 161 208'
      : species === 'cat' || species === 'tiger'
        ? 'M163 193 Q192 189 185 165 Q180 151 194 149'
        : 'M164 194 Q185 190 187 207';
  return (
    <G>
      <Path
        d={path}
        fill="none"
        stroke={OUTLINE}
        strokeWidth={21 * scale}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={path}
        fill="none"
        stroke={fur}
        strokeWidth={16 * scale}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {species === 'fox' && (
        <Path
          d="M181 215 Q188 218 193 215"
          fill="none"
          stroke={cream}
          strokeWidth="8"
          strokeLinecap="round"
        />
      )}
    </G>
  );
}

function BodyFeatures({
  species,
  dark,
  cream,
}: {
  species: PetSpecies;
  dark: string;
  cream: string;
}) {
  if (species === 'deer')
    return (
      <G fill="#FFF4DF" opacity="0.9">
        <Circle cx="91" cy="157" r="3" />
        <Circle cx="103" cy="152" r="2.5" />
        <Circle cx="137" cy="152" r="2.5" />
        <Circle cx="149" cy="157" r="3" />
      </G>
    );
  if (species === 'tiger')
    return (
      <Path
        d="M82 171 Q94 174 97 184 M158 171 Q146 174 143 184 M88 194 Q99 192 104 202 M152 194 Q141 192 136 202"
        fill="none"
        stroke={dark}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.82"
      />
    );
  if (species === 'owl')
    return (
      <Path
        d="M93 166 Q102 158 111 167 Q120 157 129 167 Q138 158 147 166"
        fill="none"
        stroke={cream}
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.9"
      />
    );
  if (species === 'penguin')
    return (
      <Path
        d="M78 170 Q82 147 120 148 Q158 147 162 170 L153 207 Q120 222 87 207Z"
        fill="#FFF8EA"
        opacity="0.95"
      />
    );
  if (species === 'bear')
    return (
      <G fill={dark} opacity="0.24">
        <Ellipse cx="92" cy="174" rx="8" ry="11" />
        <Ellipse cx="148" cy="174" rx="8" ry="11" />
        <Path
          d="M111 190 Q120 196 129 190"
          fill="none"
          stroke={dark}
          strokeWidth="3"
        />
      </G>
    );
  return null;
}

function Feet({
  species,
  fur,
  cream,
  dark,
  variant,
}: {
  species: PetSpecies;
  fur: string;
  cream: string;
  dark: string;
  variant: number;
}) {
  const isBird = species === 'penguin' || species === 'owl';
  const fill = isBird ? '#E9A75A' : species === 'rabbit' ? cream : fur;
  return (
    <G>
      <Ellipse
        cx="91"
        cy="209"
        rx={18 + variant}
        ry={14 + (variant === 2 ? 1 : 0)}
        fill={fill}
        stroke={OUTLINE}
        strokeWidth="2"
      />
      <Ellipse
        cx="149"
        cy="209"
        rx={18 + variant}
        ry={14 + (variant === 2 ? 1 : 0)}
        fill={fill}
        stroke={OUTLINE}
        strokeWidth="2"
      />
      <Path
        d="M81 211 q6 5 11 0 M92 212 q5 5 9 0 M139 211 q6 5 11 0 M150 212 q5 5 9 0"
        fill="none"
        stroke={isBird ? '#A8753D' : dark}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {species === 'dog' && (
        <G fill="#F4DCC5">
          <Circle cx="91" cy="214" r="2.2" />
          <Circle cx="149" cy="214" r="2.2" />
        </G>
      )}
    </G>
  );
}

function Wings({
  fur,
  species,
  variant,
}: {
  fur: string;
  species: PetSpecies;
  variant: number;
}) {
  const bird = species === 'owl' || species === 'penguin';
  return (
    <G
      transform={`translate(120 170) scale(${[0.92, 1, 1.08][variant]}) translate(-120 -170)`}
    >
      <Path
        d="M77 156 Q48 150 52 181 Q55 196 77 190 L91 176Z"
        fill={fur}
        stroke={OUTLINE}
        strokeWidth="2.2"
      />
      <Path
        d="M163 156 Q192 150 188 181 Q185 196 163 190 L149 176Z"
        fill={fur}
        stroke={OUTLINE}
        strokeWidth="2.2"
      />
      {bird && (
        <Path
          d="M61 173 q8 8 14 5 M179 173 q-8 8 -14 5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
    </G>
  );
}

function OwlFace({ cream }: { cream: string }) {
  return (
    <G>
      <Ellipse cx="120" cy="108" rx="48" ry="43" fill={cream} opacity="0.87" />
      <Path
        d="M120 72 Q105 93 120 122 Q135 93 120 72Z"
        fill="#FFFFFF"
        opacity="0.3"
      />
    </G>
  );
}
function HeadFeatures({
  species,
  fur,
  cream,
  dark,
}: {
  species: PetSpecies;
  fur: string;
  cream: string;
  dark: string;
}) {
  if (species === 'dog')
    return (
      <Path
        d="M109 51 Q120 46 131 51 L126 74 Q120 68 114 74Z"
        fill={cream}
        opacity="0.88"
      />
    );
  if (species === 'rabbit')
    return (
      <Path
        d="M105 43 Q120 30 135 43 Q132 53 120 56 Q108 53 105 43Z"
        fill="#FFFFFF"
        stroke={OUTLINE}
        strokeWidth="1.4"
      />
    );
  if (species === 'bear')
    return (
      <G fill={dark} opacity="0.2">
        <Ellipse cx="77" cy="119" rx="11" ry="7" />
        <Ellipse cx="163" cy="119" rx="11" ry="7" />
      </G>
    );
  if (species === 'hamster')
    return (
      <G>
        <Ellipse
          cx="74"
          cy="119"
          rx="16"
          ry="13"
          fill={fur}
          stroke={OUTLINE}
          strokeWidth="1.2"
        />
        <Ellipse
          cx="166"
          cy="119"
          rx="16"
          ry="13"
          fill={fur}
          stroke={OUTLINE}
          strokeWidth="1.2"
        />
        <Ellipse cx="76" cy="116" rx="8" ry="5" fill="#EAA4A1" opacity="0.42" />
        <Ellipse
          cx="164"
          cy="116"
          rx="8"
          ry="5"
          fill="#EAA4A1"
          opacity="0.42"
        />
      </G>
    );
  if (species === 'penguin')
    return (
      <Path
        d="M68 91 Q70 48 120 43 Q170 48 172 91 Q156 76 120 79 Q84 76 68 91Z"
        fill={dark}
        opacity="0.76"
      />
    );
  if (species === 'pig')
    return (
      <Path
        d="M111 54 Q119 44 127 54 Q122 64 111 59"
        fill="none"
        stroke="#E7A09D"
        strokeWidth="3"
        strokeLinecap="round"
      />
    );
  return null;
}
function PandaPatches({ dark }: { dark: string }) {
  return (
    <G>
      <Ellipse
        cx="95"
        cy="99"
        rx="18"
        ry="24"
        fill={dark}
        opacity="0.83"
        transform="rotate(24 95 99)"
      />
      <Ellipse
        cx="145"
        cy="99"
        rx="18"
        ry="24"
        fill={dark}
        opacity="0.83"
        transform="rotate(-24 145 99)"
      />
    </G>
  );
}
function DeerMarks({ cream }: { cream: string }) {
  return (
    <G fill={cream} opacity="0.9">
      <Circle cx="93" cy="61" r="3" />
      <Circle cx="105" cy="55" r="2.5" />
      <Circle cx="135" cy="55" r="2.5" />
      <Circle cx="147" cy="61" r="3" />
    </G>
  );
}
function TigerMarks({ dark }: { dark: string }) {
  return (
    <Path
      d="M104 44 Q108 58 101 68 M120 39 Q124 54 120 65 M136 44 Q132 58 139 68 M66 92 Q78 94 80 106 M174 92 Q162 94 160 106"
      fill="none"
      stroke={dark}
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.9"
    />
  );
}
function FoxCheeks({ cream }: { cream: string }) {
  return (
    <Path
      d="M68 121 Q79 111 93 123 Q100 139 120 141 Q140 139 147 123 Q161 111 172 121 Q165 152 142 157 Q120 163 98 157 Q75 152 68 121Z"
      fill={cream}
      opacity="0.92"
    />
  );
}
function BackMarking({ cream, dark }: { cream: string; dark: string }) {
  return (
    <G>
      <Path
        d="M83 82 Q120 55 157 82 Q170 105 157 131 Q120 153 83 131 Q70 105 83 82Z"
        fill={cream}
        opacity="0.72"
      />
      <Path
        d="M94 69 Q120 59 146 69 M91 141 Q120 154 149 141"
        fill="none"
        stroke={dark}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.45"
      />
    </G>
  );
}
function ProfileFace({
  color,
  dark,
  species,
  cream,
  mirrored,
}: {
  color: string;
  dark: string;
  species: PetSpecies;
  cream: string;
  mirrored: boolean;
}) {
  return (
    <G transform={mirrored ? 'translate(240 0) scale(-1 1)' : undefined}>
      <Ellipse
        cx="96"
        cy="99"
        rx="12"
        ry="16"
        fill={color}
        stroke={dark}
        strokeWidth="1.2"
      />
      <Ellipse cx="99" cy="93" rx="4" ry="5" fill="#FFFFFF" />
      {species === 'pig' ? (
        <G>
          <Ellipse
            cx="133"
            cy="130"
            rx="17"
            ry="12"
            fill="#E99F9D"
            stroke={OUTLINE}
            strokeWidth="1.4"
          />
          <Ellipse cx="137" cy="130" rx="2.4" ry="4" fill={dark} />
        </G>
      ) : species === 'penguin' || species === 'owl' ? (
        <Path
          d="M120 120 L145 126 L121 136Z"
          fill="#E9A75A"
          stroke={OUTLINE}
          strokeWidth="1.2"
        />
      ) : (
        <G>
          <Ellipse
            cx="130"
            cy="129"
            rx={species === 'dog' ? 16 : 13}
            ry="10"
            fill={species === 'dog' ? dark : cream}
            stroke={OUTLINE}
            strokeWidth="1.3"
          />
          <Circle cx="138" cy="126" r="3" fill={dark} />
        </G>
      )}
      <Path
        d="M101 151 Q113 156 121 151"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Ellipse cx="82" cy="126" rx="8" ry="4" fill="#E99E9D" opacity="0.38" />
    </G>
  );
}

function Eyes({
  color,
  dark,
  scale,
}: {
  color: string;
  dark: string;
  scale: number;
}) {
  return (
    <G transform={`translate(120 100) scale(${scale}) translate(-120 -100)`}>
      <Ellipse
        cx="94"
        cy="99"
        rx="12"
        ry="16"
        fill={color}
        stroke={dark}
        strokeWidth="1.2"
      />
      <Ellipse
        cx="146"
        cy="99"
        rx="12"
        ry="16"
        fill={color}
        stroke={dark}
        strokeWidth="1.2"
      />
      <Ellipse cx="97" cy="93" rx="4" ry="5" fill="#FFFFFF" />
      <Ellipse cx="149" cy="93" rx="4" ry="5" fill="#FFFFFF" />
      <Circle cx="91" cy="104" r="2" fill="#FFFFFF" opacity="0.8" />
      <Circle cx="143" cy="104" r="2" fill="#FFFFFF" opacity="0.8" />
    </G>
  );
}
function Cheeks() {
  return (
    <G>
      <Ellipse cx="75" cy="125" rx="10" ry="5" fill="#E99E9D" opacity="0.42" />
      <Ellipse cx="165" cy="125" rx="10" ry="5" fill="#E99E9D" opacity="0.42" />
    </G>
  );
}
function Muzzle({
  species,
  cream,
  dark,
  variant,
}: {
  species: PetSpecies;
  cream: string;
  dark: string;
  variant: number;
}) {
  if (species === 'pig')
    return (
      <G
        transform={`translate(120 130) scale(${[0.94, 1, 1.06][variant]}) translate(-120 -130)`}
      >
        <Ellipse
          cx="120"
          cy="130"
          rx="20"
          ry="13"
          fill="#E99F9D"
          stroke={OUTLINE}
          strokeWidth="1.5"
        />
        <Ellipse cx="113" cy="130" rx="2.5" ry="4" fill={dark} />
        <Ellipse cx="127" cy="130" rx="2.5" ry="4" fill={dark} />
      </G>
    );
  if (species === 'penguin' || species === 'owl')
    return (
      <Path
        d="M108 119 Q120 115 132 119 Q128 134 120 137 Q112 134 108 119Z"
        fill="#E9A75A"
        stroke={OUTLINE}
        strokeWidth="1.4"
        transform={`translate(120 126) scale(${[0.92, 1, 1.08][variant]}) translate(-120 -126)`}
      />
    );
  if (species === 'dog')
    return (
      <G>
        <Ellipse
          cx="120"
          cy={130 + (variant - 1)}
          rx={variant === 2 ? 19 : 17}
          ry="12"
          fill={dark}
          stroke={OUTLINE}
          strokeWidth="1.4"
        />
        <Ellipse cx="120" cy="125" rx="8" ry="5" fill={cream} opacity="0.9" />
        <Circle cx="120" cy="127" r="3" fill="#352D2B" />
      </G>
    );
  return (
    <G>
      <Ellipse cx="109" cy="128" rx="15" ry="11" fill={cream} />
      <Ellipse
        cx="131"
        cy="128"
        rx={variant === 2 ? 17 : 15}
        ry={variant === 0 ? 10 : 11}
        fill={cream}
      />
      <Path
        d="M115 122 Q120 117 125 122 Q123 129 120 129 Q117 129 115 122Z"
        fill="#805D56"
      />
    </G>
  );
}
function Whiskers({ dark }: { dark: string }) {
  return (
    <Path
      d="M87 128 L63 125 M87 134 L65 140 M153 128 L177 125 M153 134 L175 140"
      fill="none"
      stroke={dark}
      strokeWidth="1.4"
      strokeLinecap="round"
      opacity="0.68"
    />
  );
}
function DeerAntlers({ dark }: { dark: string }) {
  return (
    <Path
      d="M83 56 Q72 43 78 29 M78 39 L68 34 M157 56 Q168 43 162 29 M162 39 L172 34"
      fill="none"
      stroke={dark}
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function SkillArt({ effect }: { effect: PetEffect }) {
  const info = effectInfo(effect);
  return (
    <Svg
      width={78}
      height={70}
      viewBox="0 0 78 70"
      accessibilityLabel={info.name}
    >
      {effect === 'fire' ? (
        <G>
          <Path
            d="M8 40 Q19 24 25 34 Q30 18 37 5 Q51 20 45 32 Q56 27 67 38 Q63 58 39 61 Q16 62 8 40Z"
            fill="#F18B4B"
            stroke="#C76C3F"
            strokeWidth="1.5"
          />
          <Path
            d="M27 46 Q35 35 39 25 Q48 38 45 46 Q52 43 57 46 Q54 55 42 56 Q31 55 27 46Z"
            fill="#FFE38A"
          />
          <Circle cx="17" cy="20" r="3" fill="#FFD48B" />
          <Circle cx="62" cy="17" r="2.5" fill="#FFD48B" />
        </G>
      ) : effect === 'wind' ? (
        <G fill="none" stroke={info.color} strokeLinecap="round">
          <Path
            d="M7 23 Q26 9 49 18 Q61 23 50 31 Q44 35 39 30 M9 37 Q31 27 61 36 Q72 40 59 47 Q51 51 43 46 M19 52 Q36 45 48 52"
            strokeWidth="5"
          />
          <Path
            d="M42 12 Q61 8 63 17 Q65 23 58 24"
            stroke="#D6EEE6"
            strokeWidth="3"
          />
        </G>
      ) : effect === 'water' || effect === 'bubbles' ? (
        <G fill={info.color} opacity="0.86">
          <Circle cx="28" cy="38" r="11" />
          <Circle cx="50" cy="24" r="7" />
          <Circle cx="54" cy="48" r="5" />
          <Circle cx="25" cy="34" r="3" fill="#FFFFFF" />
        </G>
      ) : effect === 'leaves' ? (
        <G fill={info.color} stroke="#71885D" strokeWidth="1.2">
          <Path d="M10 42 Q15 11 40 18 Q39 41 10 42Z" />
          <Path d="M38 54 Q39 29 68 28 Q67 51 38 54Z" />
          <Path d="M13 41 L34 23 M41 52 L62 33" fill="none" stroke="#71885D" />
        </G>
      ) : effect === 'ice' ? (
        <G stroke={info.color} strokeWidth="3" strokeLinecap="round">
          <Path d="M39 8 L39 59 M16 21 L62 47 M16 47 L62 21 M39 8 L33 16 M39 8 L45 16 M39 59 L33 51 M39 59 L45 51" />
        </G>
      ) : effect === 'lightning' ? (
        <Path
          d="M43 4 L18 39 L36 39 L29 66 L61 28 L42 29Z"
          fill={info.color}
          stroke="#C3953A"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      ) : (
        <G fill={info.color}>
          <Path d="M39 5 L44 27 L66 17 L55 38 L75 46 L52 49 L59 70 L39 55 L19 70 L26 49 L3 46 L24 38 L12 17 L34 27Z" />
          <Circle cx="39" cy="39" r="9" fill="#FFF9E9" />
        </G>
      )}
    </Svg>
  );
}

function CloudArt() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 180 70"
      preserveAspectRatio="xMidYMid meet"
    >
      <Path
        d="M31 54 Q12 54 14 40 Q15 28 29 28 Q32 9 51 12 Q61 1 73 14 Q91 -1 102 16 Q123 9 127 28 Q150 22 157 40 Q163 55 142 57Z"
        fill="#FFFDF8"
        stroke="#8B765F"
        strokeWidth="2.4"
      />
      <Path
        d="M34 51 Q70 59 131 51"
        fill="none"
        stroke="#E8DCCD"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PetViewport({
  dna: inputDNA,
  active,
  reduced = false,
  action,
}: {
  dna: PetDNA;
  active: boolean;
  reduced?: boolean;
  action: PetAction | null;
}) {
  const dnaKey = canonicalPetJSON(inputDNA);
  const dna = useMemo(() => JSON.parse(dnaKey) as PetDNA, [dnaKey]);
  const presentation = resolvePetPresentation(dna, action, active, reduced);
  const idleMotion = presentation.idleMotion;
  const actionType = action?.type;
  const consumedAction = useRef<number | null>(null);
  const rotation = useRef(0);
  const [facingView, setFacingView] = useState<PetFacing>('front');
  const facingProgress = useSharedValue(0);
  const idle = useSharedValue(0);
  const motion = useSharedValue(0);
  const effect = useSharedValue(0);
  const pan = useMemo(
    () =>
      createPetRotationResponder(
        rotation,
        (value) => (facingProgress.value = value),
        (value) => setFacingView(resolvePetFacing(value)),
      ),
    [facingProgress],
  );

  useEffect(() => {
    cancelAnimation(idle);
    if (!active || reduced || !idleMotion) {
      idle.value = 0;
      return;
    }
    idle.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 900 + dna.animation.idle.variant * 55,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: 900 + dna.animation.idle.variant * 55,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(idle);
  }, [active, reduced, idle, dna.animation.idle.variant, idleMotion]);

  useEffect(() => {
    cancelAnimation(motion);
    cancelAnimation(effect);
    const playback = consumePetAction(
      consumedAction.current,
      action?.id ?? null,
      active,
      reduced,
    );
    consumedAction.current = playback.consumedId;
    if (!actionType || !playback.shouldPlay) {
      motion.value = 0;
      effect.value = 0;
      return;
    }
    if (actionType === 'cast') {
      rotation.current = 0;
      facingProgress.value = 0;
      setFacingView('front');
    }
    const duration =
      actionType === 'cast'
        ? 1100 + dna.skill.variant * 90
        : 1100 + dna.animation.interaction.variant * 70;
    const sequence = withSequence(
      withTiming(1, {
        duration: Math.round(duration * 0.45),
        easing: Easing.out(Easing.quad),
      }),
      withTiming(0, {
        duration: Math.round(duration * 0.55),
        easing: Easing.inOut(Easing.sin),
      }),
    );
    if (actionType === 'cast') effect.value = sequence;
    else motion.value = sequence;
    return () => {
      cancelAnimation(motion);
      cancelAnimation(effect);
    };
  }, [
    action?.id,
    actionType,
    active,
    reduced,
    dna.skill.variant,
    dna.animation.interaction.variant,
    motion,
    effect,
    facingProgress,
  ]);

  const petMotionStyle = useAnimatedStyle(() => {
    const bounce = Math.sin(motion.value * Math.PI);
    const idleWave = Math.sin(idle.value * Math.PI);
    const idleSway = Math.sin(idle.value * Math.PI * 2);
    const isFlight = dna.animation.interaction.clipId === 'greet';
    const isCloudRide = dna.animation.interaction.clipId === 'bounce';
    const lift = isFlight ? 72 : isCloudRide ? 42 : 38;
    return {
      transform: [
        {
          translateY:
            -(idleMotion === 'breathe' ? idleWave * 2 : 0) - bounce * lift,
        },
        {
          translateX: idleMotion === 'sway' ? idleSway * 3 : 0,
        },
        {
          rotateZ: `${(idleMotion === 'curious' ? idleSway * 3 : idleMotion === 'sway' ? idleSway * 1.5 : 0) + Math.sin(motion.value * Math.PI * 2) * (isFlight ? 4 : 2)}deg`,
        },
        {
          scale:
            1 +
            (idleMotion === 'breathe' ? idleWave * 0.018 : 0) +
            bounce * (isCloudRide ? 0.025 : 0.045),
        },
        { scaleX: 0.94 + Math.abs(Math.cos(facingProgress.value)) * 0.06 },
      ],
    };
  });
  const cloudStyle = useAnimatedStyle(() => ({
    opacity:
      dna.animation.interaction.clipId === 'bounce'
        ? Math.sin(motion.value * Math.PI)
        : 0,
    transform: [
      { translateY: -motion.value * 12 },
      { scale: 0.92 + motion.value * 0.08 },
    ],
  }));
  const effectStyle = useAnimatedStyle(() => ({
    opacity: effect.value,
    transform: [
      { translateY: -effect.value * 15 },
      { scale: 0.78 + effect.value * 0.3 },
      { rotateZ: `${interpolate(effect.value, [0, 1], [-8, 8])}deg` },
    ],
  }));
  const speciesNames = dna.species.map((id) => speciesInfo(id).name).join(', ');
  const effectId = presentation.effect;

  return (
    <View
      style={styles.viewport}
      testID="pet-viewport"
      accessibilityLabel={`Thú cưng 2D: ${speciesNames}`}
      accessibilityHint="Vuốt ngang để đổi góc nhìn. Chọn Chơi cùng hoặc kỹ năng để xem hoạt ảnh."
      {...pan.panHandlers}
    >
      {active ? (
        <>
          <AnimatedView
            pointerEvents="none"
            style={[styles.pet, petMotionStyle]}
          >
            <PetArt dna={dna} facing={facingView} />
          </AnimatedView>
          <AnimatedView pointerEvents="none" style={[styles.cloud, cloudStyle]}>
            <CloudArt />
          </AnimatedView>
          {effectId && (
            <AnimatedView
              pointerEvents="none"
              style={[styles.skill, effectStyle]}
            >
              <SkillArt effect={effectId} />
            </AnimatedView>
          )}
        </>
      ) : (
        <View style={styles.resting}>
          <View style={styles.restingDot} />
          <Animated.Text style={typography.small}>
            Thú cưng đang nghỉ…
          </Animated.Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    height: 350,
    borderRadius: radius.xxl,
    backgroundColor: '#F8F1E9',
    overflow: 'hidden',
  },
  pet: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 1,
  },
  cloud: {
    position: 'absolute',
    left: '22%',
    right: '22%',
    height: 66,
    bottom: 33,
    zIndex: 2,
  },
  skill: {
    position: 'absolute',
    width: 78,
    height: 70,
    left: '50%',
    marginLeft: -39,
    top: '43%',
    zIndex: 3,
  },
  resting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  restingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.sunlightAction,
  },
});
