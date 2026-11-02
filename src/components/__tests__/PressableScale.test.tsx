import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { PressableScale } from '../PressableScale';

describe('PressableScale', () => {
  it('keeps flex and margins on the wrapper only, so the surface cannot collapse', () => {
    render(
      <PressableScale
        accessibilityRole="tab"
        accessibilityLabel="Tab"
        style={{ flex: 1, margin: 4, minHeight: 40 }}
      />,
    );
    const surface = StyleSheet.flatten(
      screen.getByRole('tab').props.style,
    ) as Record<string, unknown>;
    expect(surface.flex).toBeUndefined();
    expect(surface.margin).toBeUndefined();
    expect(surface.minHeight).toBe(40);
    expect(surface.flexGrow).toBe(1);
  });
});
