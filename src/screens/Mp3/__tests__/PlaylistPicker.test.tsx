import { fireEvent, render } from '@testing-library/react-native';
import { PlaylistPicker } from '../PlaylistPicker';

jest.mock('@expo/vector-icons/Feather', () => ({
  __esModule: true,
  default: () => null,
}));

it('lets one track be selected for more than one playlist', () => {
  const onToggle = jest.fn();
  const view = render(
    <PlaylistPicker
      trackTitle="Bài nghe"
      playlists={[
        { id: 'one', name: 'Đi đường', trackIds: [] },
        { id: 'two', name: 'Tập trung', trackIds: [] },
      ]}
      isInPlaylist={() => false}
      onToggle={onToggle}
      onClose={jest.fn()}
    />,
  );

  expect(
    view.getByText('“Bài nghe” có thể được thêm vào nhiều danh sách.').props
      .numberOfLines,
  ).toBe(1);
  fireEvent.press(view.getByLabelText('Thêm vào danh sách Đi đường'));
  fireEvent.press(view.getByLabelText('Thêm vào danh sách Tập trung'));
  expect(onToggle.mock.calls).toEqual([['one'], ['two']]);
});
