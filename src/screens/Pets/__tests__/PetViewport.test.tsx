import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { digestStringAsync } from 'expo-crypto';
import { createHash } from 'node:crypto';
import { generatePetDNA } from '../../../services/pets/petGenetics';
import { PetViewport } from '../PetViewport';

jest.mock('react-native-reanimated', () => {
  const { Text, View } = jest.requireActual('react-native') as typeof import('react-native');
  const linear = (value: number, input: number[], output: number[]) => {
    const progress = (value - input[0]) / (input[1] - input[0]);
    return output[0] + (output[1] - output[0]) * progress;
  };
  return {
    __esModule: true,
    default: { View, Text },
    View,
    Text,
    cancelAnimation: jest.fn(),
    Easing: {
      sin: jest.fn(),
      quad: jest.fn(),
      inOut: (value: unknown) => value,
      out: (value: unknown) => value,
    },
    interpolate: linear,
    useAnimatedStyle: (create: () => unknown) => create(),
    useSharedValue: (value: unknown) => ({ value }),
    withRepeat: (value: unknown) => value,
    withSequence: () => 0,
    withTiming: (value: unknown) => value,
  };
});

beforeAll(() => {
  jest
    .mocked(digestStringAsync)
    .mockImplementation(async (_algorithm, value) =>
      createHash('sha256').update(value).digest('hex'),
    );
});

const createFirePet = async () => {
  const generated = await generatePetDNA(
    ['dog', 'bear'],
    '0123456789abcdef0123456789abcdef',
  );
  return {
    ...generated,
    skill: { ...generated.skill, effectId: 'fire' as const },
  };
};

const swipeToBack = () => {
  const viewport = screen.getByTestId('pet-viewport');
  act(() => {
    viewport.props.onTouchStart({
      nativeEvent: { pageX: 20, pageY: 20, touches: [{}] },
    });
    viewport.props.onTouchMove({
      nativeEvent: { changedTouches: [{ pageX: 420, pageY: 21 }] },
    });
    viewport.props.onTouchEnd({
      nativeEvent: { pageX: 420, pageY: 21, touches: [] },
    });
  });
};

it('changes its accessible illustration facing after horizontal swipes', async () => {
  const dna = await createFirePet();
  render(<PetViewport dna={dna} active action={null} />);
  expect(screen.getByLabelText(/nhìn từ phía trước/)).toBeTruthy();
  swipeToBack();
  expect(screen.getByLabelText(/nhìn từ phía sau/)).toBeTruthy();
});

it('returns to the front before showing a cast effect and cancels animations on unmount', async () => {
  const dna = await createFirePet();
  const cancel = jest.spyOn(Reanimated, 'cancelAnimation');
  const { rerender, unmount } = render(
    <PetViewport dna={dna} active action={null} />,
  );
  swipeToBack();
  expect(screen.getByLabelText(/nhìn từ phía sau/)).toBeTruthy();

  rerender(
    <PetViewport
      dna={dna}
      active
      action={{ type: 'cast', id: 1, started: 1 }}
    />,
  );
  expect(screen.getByLabelText(/nhìn từ phía trước/)).toBeTruthy();
  expect(screen.getByLabelText(/lửa/i)).toBeTruthy();
  unmount();
  expect(cancel).toHaveBeenCalled();
});
