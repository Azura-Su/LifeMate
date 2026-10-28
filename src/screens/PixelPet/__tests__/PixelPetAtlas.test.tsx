import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { PixelPetAtlas } from '../PixelPetAtlas';

jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/src/mock'),
);

const props = {
  source: 1,
  size: 64,
  clip: 'move' as const,
  progress: { value: 0.5 },
  loopMovement: true,
  animating: true,
  fallback: <Text>Ảnh gốc</Text>,
};

it('shows original art until the atlas loads and restores it if loading fails', () => {
  render(<PixelPetAtlas {...props} />);
  expect(screen.getByText('Ảnh gốc')).toBeTruthy();
  fireEvent(screen.getByTestId('pixel-pet-atlas'), 'load');
  expect(screen.queryByText('Ảnh gốc')).toBeNull();
  fireEvent(screen.getByTestId('pixel-pet-atlas'), 'error');
  expect(screen.getByText('Ảnh gốc')).toBeTruthy();
  expect(screen.queryByTestId('pixel-pet-atlas')).toBeNull();
});

it('clips an active frame but always shows the neutral frame while paused', () => {
  const view = render(<PixelPetAtlas {...props} />);
  expect(screen.getByTestId('pixel-pet-atlas')).toHaveStyle({
    width: 256,
    height: 256,
    transform: [{ translateX: -128 }, { translateY: -64 }],
  });
  view.rerender(<PixelPetAtlas {...props} animating={false} />);
  const transforms = StyleSheet.flatten(
    screen.getByTestId('pixel-pet-atlas').props.style,
  ).transform;
  expect(
    transforms.map((entry: Record<string, number>) =>
      Math.abs(Object.values(entry)[0]),
    ),
  ).toEqual([0, 0]);
});

it('ignores the previous species load callback when a new pet mounts', () => {
  const view = render(
    <View>
      <PixelPetAtlas key="first" {...props} />
    </View>,
  );
  const oldLoad = screen.getByTestId('pixel-pet-atlas').props.onLoad;
  view.rerender(
    <View>
      <PixelPetAtlas key="second" {...props} source={2} />
    </View>,
  );
  oldLoad();
  expect(screen.getByText('Ảnh gốc')).toBeTruthy();
  fireEvent(screen.getByTestId('pixel-pet-atlas'), 'load');
  expect(screen.queryByText('Ảnh gốc')).toBeNull();
});
