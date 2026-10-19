import { fireEvent, render } from '@testing-library/react-native';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import { DialogModal } from '../DialogModal';

it('forwards completed backdrop and content touches without closing the dialog', () => {
  const onTouchEnd = jest.fn();
  const onRequestClose = jest.fn();
  const view = render(
    <DialogModal onTouchEnd={onTouchEnd} onRequestClose={onRequestClose}>
      <Text>Dialog</Text>
    </DialogModal>,
  );
  expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.onTouchEnd).toBe(
    onTouchEnd,
  );
  fireEvent(view.getByText('Dialog'), 'touchEnd');
  fireEvent(view.UNSAFE_getByType(KeyboardAvoidingView), 'touchEnd');
  expect(onTouchEnd).toHaveBeenCalledTimes(2);
  expect(onRequestClose).not.toHaveBeenCalled();
});

it('preserves the default keyboard behavior for existing dialogs', () => {
  const view = render(
    <DialogModal>
      <Text>Dialog</Text>
    </DialogModal>,
  );
  const keyboard = view.UNSAFE_getByType(KeyboardAvoidingView);
  expect(keyboard.props.behavior).toBe(
    Platform.OS === 'ios' ? 'padding' : undefined,
  );
  expect(keyboard.props.contentContainerStyle).toBeUndefined();
});

it('allows a dialog to dock within the keyboard-safe area without shifting its header offscreen', () => {
  const view = render(
    <DialogModal overlayStyle={{ justifyContent: 'flex-end', paddingTop: 67 }}>
      <Text>Dialog</Text>
    </DialogModal>,
  );
  const keyboard = view.UNSAFE_getByType(KeyboardAvoidingView);
  expect(keyboard.props.behavior).toBe('padding');
  expect(StyleSheet.flatten(keyboard.props.style)).toMatchObject({
    justifyContent: 'flex-end',
    paddingTop: 67,
  });
});
