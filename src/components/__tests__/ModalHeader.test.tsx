import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ModalHeader } from '../ModalHeader';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

it('centers the title and uses an accessible close action', () => {
  const onClose = jest.fn();
  const view = render(
    <ModalHeader
      eyebrow="QUẢN LÝ ÂM THANH"
      title="Thư viện MP3"
      accessibilityLabel="Đóng trang hiện tại"
      onClose={onClose}
    />,
  );
  const title = view.getByRole('header');
  const titleStyle = StyleSheet.flatten(title.props.style);

  expect(title.props.numberOfLines).toBe(1);
  expect(titleStyle).toMatchObject({ fontSize: 24, lineHeight: 30 });
  expect(titleStyle.textAlign).toBe('center');
  expect(
    StyleSheet.flatten(view.getByTestId('modal-header').props.style).minHeight,
  ).toBe(44);
  expect(view.UNSAFE_getByProps({ name: 'x' })).toBeTruthy();
  fireEvent.press(view.getByLabelText('Đóng trang hiện tại'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
