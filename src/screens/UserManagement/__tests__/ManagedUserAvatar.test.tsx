import { fireEvent, render } from '@testing-library/react-native';
import { ManagedUserAvatar } from '../ManagedUserAvatar';
jest.mock('../../../config/audioCloud', () => ({
  audioCloudUrl: () => 'https://example.supabase.co',
}));
const url = (uid: string) =>
  `https://example.supabase.co/storage/v1/object/sign/lifemate-avatars/profiles/${uid}/avatar.jpg?token=signed`;
test('shows the target avatar and falls back for a missing, failed, or wrong-account image', () => {
  const view = render(
    <ManagedUserAvatar uid="alice" name="Alice" url={url('alice')} />,
  );
  expect(view.getByLabelText('Ảnh đại diện của Alice').props.source.uri).toBe(
    url('alice'),
  );
  fireEvent(view.getByLabelText('Ảnh đại diện của Alice'), 'error');
  expect(view.getByLabelText('Biểu tượng LifeMate')).toBeTruthy();
  view.rerender(<ManagedUserAvatar uid="bob" name="Bob" url={url('alice')} />);
  expect(view.queryByLabelText('Ảnh đại diện của Bob')).toBeNull();
  view.rerender(<ManagedUserAvatar uid="bob" name="Bob" url={url('bob')} />);
  expect(view.getByLabelText('Ảnh đại diện của Bob')).toBeTruthy();
  view.rerender(<ManagedUserAvatar uid="bob" name="Bob" />);
  expect(view.getByLabelText('Biểu tượng LifeMate')).toBeTruthy();
});
