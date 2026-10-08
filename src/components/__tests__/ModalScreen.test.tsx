import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
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
