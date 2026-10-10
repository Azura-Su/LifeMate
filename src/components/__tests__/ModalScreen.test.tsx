import { fireEvent, render } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { ModalScreen } from '../ModalScreen';

it('reports touches outside the fixed title area so active marquee text can reset', () => {
  const onTouchStart = jest.fn();
  const view = render(
    <ModalScreen onRequestClose={jest.fn()} onTouchStart={onTouchStart}>
      <></>
    </ModalScreen>,
  );

  fireEvent(view.getByTestId('modal-screen-root'), 'touchStart');

  expect(onTouchStart).toHaveBeenCalledTimes(1);
});

it('keeps the modal header compact while preserving its fixed layout', () => {
  const view = render(
    <ModalScreen onRequestClose={jest.fn()} fixedHeader={<></>}>
      <></>
    </ModalScreen>,
  );
  const header = StyleSheet.flatten(
    view.getByTestId('modal-screen-fixed-header').props.style,
  );

  expect(header.paddingTop).toBe(4);
  expect(header.paddingBottom).toBe(8);
});

it('allows dense modal screens to reduce content spacing without changing the default', () => {
  const view = render(
    <ModalScreen onRequestClose={jest.fn()} contentGap={12}>
      <></>
    </ModalScreen>,
  );
  const scrollView = view.UNSAFE_getByType(ScrollView);
  const content = StyleSheet.flatten(scrollView.props.contentContainerStyle);

  expect(content.gap).toBe(12);
});

it('aligns the modal header, content and footer to one screen gutter', () => {
  const view = render(
    <ModalScreen
      onRequestClose={jest.fn()}
      fixedHeader={<></>}
      fixedFooter={<></>}
    >
      <></>
    </ModalScreen>,
  );
  const header = StyleSheet.flatten(
    view.getByTestId('modal-screen-fixed-header').props.style,
  );
  const content = StyleSheet.flatten(
    view.UNSAFE_getByType(ScrollView).props.contentContainerStyle,
  );
  const footer = StyleSheet.flatten(
    view.getByTestId('modal-screen-fixed-footer').props.style,
  );

  expect(header.paddingHorizontal).toBe(20);
  expect(content.paddingHorizontal).toBe(20);
  expect(footer.paddingHorizontal).toBe(20);
});
