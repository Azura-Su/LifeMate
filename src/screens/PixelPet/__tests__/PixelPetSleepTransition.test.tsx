import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, type ImageProps, type ViewProps } from 'react-native';
import { PIXEL_PET_BY_ID } from '../../../services/pixelPet/pixelPetCatalog';
import type { PixelPetSpeciesId } from '../../../types/pixelPet';
import { PixelPetSprite } from '../PixelPetSprite';
import { PixelPetAtlas } from '../PixelPetAtlas';
import { HomeSleepGarden } from '../../Home/HomeSleepGarden';
import {
  PET_REST_ATLASES,
  CELESTIAL_STAG_SLEEP_GARDEN_DECAY_ATLAS,
} from '../petArt';

// Native React 19 enables props profiling. Keep that path active in this test:
// its recursive diff reads Reanimated's guard when a style handle is replaced.
jest.mock('react-test-renderer', () => {
  console.timeStamp = jest.fn();
  Object.defineProperty(performance, 'measure', {
    configurable: true,
    value: jest.fn(),
  });
  return jest.requireActual('react-test-renderer');
});
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/src/mock'),
);
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { View, Image } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  const mock = jest.requireActual('react-native-reanimated/mock');
  const resolveStyle = (style: unknown): unknown => {
    if (Array.isArray(style)) return style.map(resolveStyle);
    if (style && typeof style === 'object' && 'getStyle' in style) {
      return (style as { getStyle: () => unknown }).getStyle();
    }
    return style;
  };
  return {
    ...mock,
    useReducedMotion: () => false,
    useSharedValue: (value: number) => React.useRef({ value }).current,
    // Keep animation completion under the focused usePetPlayback unit tests;
    // this screen test exercises rapid state changes, not the mock clock.
    withTiming: (to: number, config: unknown) => mock.withTiming(to, config),
    useAnimatedStyle: (updater: () => unknown) => {
      const handle = React.useRef<{ getStyle: () => unknown } | null>(null);
      if (!handle.current) {
        handle.current = Object.defineProperty(
          { getStyle: updater },
          '_requiresAnimatedComponent',
          {
            enumerable: true,
            get() {
              throw new Error(
                'Reanimated style guard read by React props profiling',
              );
            },
          },
        );
      }
      handle.current!.getStyle = updater;
      return handle.current;
    },
    default: {
      ...mock.default,
      View: function AnimatedView({ style, ...props }: ViewProps) {
        return (
          <View {...props} style={resolveStyle(style) as ViewProps['style']} />
        );
      },
      Image: function AnimatedImage({ style, ...props }: ImageProps) {
        return (
          <Image
            {...props}
            style={resolveStyle(style) as ImageProps['style']}
          />
        );
      },
    },
  };
});

function SleepPreview({ speciesId }: { speciesId: PixelPetSpeciesId }) {
  const [sleeping, setSleeping] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sleeping ? 'Đánh thức' : 'Cho ngủ'}
      onPress={() => setSleeping((value) => !value)}
    >
      {speciesId === 'celestial_stag' && <HomeSleepGarden visible={sleeping} />}
      <PixelPetSprite
        species={PIXEL_PET_BY_ID[speciesId]}
        stage="juvenile"
        size={120}
        clip="move"
        loopMovement
        active
        sleeping={sleeping}
      />
    </Pressable>
  );
}

const RESTING_SPECIES = [
  'nine_tail_fox',
  'qilin',
  'alicorn',
  'rune_wolf',
  'black_tortoise',
  'sphinx',
  'centaur',
  'white_tiger',
  'azure_dragon',
  'koi_dragon',
  'scylla',
  'lac_bird',
  'phoenix',
  'anubis',
  'garuda',
  'celestial_stag',
] as const satisfies readonly PixelPetSpeciesId[];

it.each([15, 4])(
  'renders the withering scene from growth frame %s without introducing a mature tree',
  (growthFrame) => {
    render(
      <HomeSleepGarden visible mode="withering" growthFrame={growthFrame} />,
    );
    for (const atlas of screen.getAllByTestId('pixel-pet-atlas', {
      includeHiddenElements: true,
    }))
      fireEvent(atlas, 'load');
    const atlases = screen.UNSAFE_getAllByType(PixelPetAtlas);
    expect(atlases.at(-1)!.props.source).toEqual(
      CELESTIAL_STAG_SLEEP_GARDEN_DECAY_ATLAS,
    );
    expect(atlases.at(-1)!.props.frameTrack).toHaveLength(
      growthFrame < 15 ? 4 : 16,
    );
    if (growthFrame < 15)
      expect(atlases[0].props.staticFrame).toBe(growthFrame);
  },
);

it.each(
  RESTING_SPECIES.flatMap((speciesId) => [
    { speciesId, loaded: false },
    { speciesId, loaded: true },
  ]),
)(
  '$speciesId sleeps and wakes with React props profiling enabled (atlas loaded: $loaded)',
  ({ speciesId, loaded }) => {
    render(<SleepPreview speciesId={speciesId} />);
    const loadAtlas = () => {
      if (loaded) {
        // The image is intentionally hidden until onLoad. Skip the query's
        // style-flattening walk through raw animated wrapper props.
        for (const atlas of screen.getAllByTestId('pixel-pet-atlas', {
          includeHiddenElements: true,
        })) {
          fireEvent(atlas, 'load');
        }
      }
    };
    loadAtlas();
    for (let cycle = 0; cycle < 2; cycle++) {
      fireEvent.press(screen.getByRole('button', { name: 'Cho ngủ' }));
      if (speciesId !== 'celestial_stag') {
        const atlas = screen.getAllByTestId('pixel-pet-atlas', {
          includeHiddenElements: true,
        })[0];
        expect(atlas.props.source).toEqual(PET_REST_ATLASES[speciesId]);
      }
      loadAtlas();
      fireEvent.press(screen.getByRole('button', { name: 'Đánh thức' }));
      loadAtlas();
    }
    expect(screen.getByRole('button', { name: 'Cho ngủ' })).toBeTruthy();
  },
);
