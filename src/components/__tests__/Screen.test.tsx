import { render } from '@testing-library/react-native';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import { Screen } from '../Screen';

it('keeps a fixed header outside the scrollable content', () => {
  const view = render(
    <Screen fixedHeader={<Text>Tiêu đề cố định</Text>}>
      <Text>Nội dung cuộn</Text>
    </Screen>,
  );

  const tree = view.toJSON();
  if (!tree || Array.isArray(tree)) throw new Error('Expected a single root');
  expect(tree.children?.[0].props.testID).toBe('screen-fixed-header');
  expect(tree.children?.[1].type).toBe('RCTScrollView');
  const header = view.getByTestId('screen-fixed-header');
  const scrollView = view.UNSAFE_getByType(ScrollView);
  const root = view.UNSAFE_getByType(SafeAreaView);
  expect(StyleSheet.flatten(header.props.style).paddingTop).toBe(16);
  expect(StyleSheet.flatten(header.props.style).backgroundColor).toBe(
    colors.sunlightFaint,
  );
  expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe(
    colors.sunlightFaint,
  );
  expect(StyleSheet.flatten(scrollView.props.style).backgroundColor).toBe(
    colors.background,
  );
  expect(
    StyleSheet.flatten(scrollView.props.contentContainerStyle).paddingTop,
  ).toBe(12);
  expect(view.getByText('Nội dung cuộn')).toBeTruthy();
});

it('keeps fixed screen controls outside the scrollable content', () => {
  const view = render(
    <Screen
      fixedHeader={<Text>Tiêu đề cố định</Text>}
      fixedContent={<Text>Điều khiển cố định</Text>}
    >
      <Text>Danh sách bài có thể cuộn</Text>
    </Screen>,
  );

  const tree = view.toJSON();
  if (!tree || Array.isArray(tree)) throw new Error('Expected a single root');
  expect(tree.children).toHaveLength(3);
  expect(tree.children?.[0].type).toBe('View');
  expect(tree.children?.[1].type).toBe('View');
  expect(tree.children?.[2].type).toBe('RCTScrollView');
  expect(tree.children?.[1].props.testID).toBe('screen-fixed-content');
  expect(tree.children?.[2].props.testID).toBe('screen-scroll-area');
  expect(view.getByText('Điều khiển cố định')).toBeTruthy();
  expect(view.getByText('Danh sách bài có thể cuộn')).toBeTruthy();
});

it('aligns the header, fixed controls and page content to one screen gutter', () => {
  const view = render(
    <Screen fixedHeader={<Text>Header</Text>} fixedContent={<Text>Tabs</Text>}>
      <Text>Page content</Text>
    </Screen>,
  );
  const header = StyleSheet.flatten(
    view.getByTestId('screen-fixed-header').props.style,
  );
  const fixed = StyleSheet.flatten(
    view.getByTestId('screen-fixed-content').props.style,
  );
  const scroll = StyleSheet.flatten(
    view.UNSAFE_getByType(ScrollView).props.contentContainerStyle,
  );

  expect(header.paddingHorizontal).toBe(20);
  expect(fixed.paddingHorizontal).toBe(20);
  expect(scroll.paddingHorizontal).toBe(20);
});

it('keeps the shared header color while applying a custom screen background', () => {
  const view = render(
    <Screen
      backgroundColor="#EDF7FC"
      safeAreaBackgroundColor="#FBF4DD"
      fixedHeader={<Text>Home</Text>}
    >
      <Text>Nội dung</Text>
    </Screen>,
  );

  const root = view.UNSAFE_getByType(SafeAreaView);
  const header = view.getByTestId('screen-fixed-header');
  const scrollView = view.UNSAFE_getByType(ScrollView);

  expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe('#FBF4DD');
  expect(StyleSheet.flatten(header.props.style).backgroundColor).toBe(
    colors.sunlightFaint,
  );
  expect(StyleSheet.flatten(scrollView.props.style).backgroundColor).toBe(
    '#EDF7FC',
  );
  expect(
    StyleSheet.flatten(scrollView.props.contentContainerStyle).backgroundColor,
  ).toBe('#EDF7FC');
});
