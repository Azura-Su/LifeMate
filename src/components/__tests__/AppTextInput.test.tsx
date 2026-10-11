import { render, screen } from '@testing-library/react-native';
import { AppTextInput } from '../AppTextInput';

it('capitalizes the first character of sentences by default', () => {
  render(<AppTextInput accessibilityLabel="Nội dung" />);

  expect(screen.getByLabelText('Nội dung').props.autoCapitalize).toBe(
    'sentences',
  );
});

it('allows fields such as email and password to opt out', () => {
  render(<AppTextInput accessibilityLabel="Email" autoCapitalize="none" />);

  expect(screen.getByLabelText('Email').props.autoCapitalize).toBe('none');
});
