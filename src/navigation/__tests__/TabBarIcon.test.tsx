import { render, screen } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';
import { TabBarIcon } from '../TabBarIcon';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

function pillOpacity() {
  const pill = screen.getByTestId('tab-icon-home').children[0] as unknown as {
    props: { style: unknown };
  };
  const flat = StyleSheet.flatten(pill.props.style as ViewStyle) as {
    opacity?: number | { __getValue?: () => number };
  };
  const opacity = flat.opacity;
  return typeof opacity === 'number' ? opacity : opacity?.__getValue?.();
}

it('shows the active pill only on the focused tab', () => {
  const view = render(<TabBarIcon name="home" focused color="#000" />);
  expect(pillOpacity()).toBe(1);
  view.unmount();
  render(<TabBarIcon name="home" focused={false} color="#000" />);
  expect(pillOpacity()).toBe(0);
});
