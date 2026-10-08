import { render } from '@testing-library/react-native';
import { ScrollView, StyleSheet, Text } from 'react-native';
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
  expect(StyleSheet.flatten(header.props.style).paddingTop).toBe(16);
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
