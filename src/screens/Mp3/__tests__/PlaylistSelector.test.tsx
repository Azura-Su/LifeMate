import { Alert } from 'react-native';
import {
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import { PlaylistSelector } from '../PlaylistSelector';

const playlists = [
  { id: 'default', name: 'Danh sách nghe', trackIds: [] },
  { id: 'focus', name: 'Tập trung', trackIds: [] },
];

jest.mock('@expo/vector-icons/Feather', () => ({
  __esModule: true,
  default: () => null,
}));

it('places the create-list action before the existing lists', () => {
  const view = render(
    <PlaylistSelector
      playlists={playlists}
      selectedId="default"
      onSelect={jest.fn()}
      onCreate={jest.fn(() => true)}
      onDelete={jest.fn()}
      onRename={jest.fn(() => true)}
    />,
  );

  expect(
    view
      .getAllByLabelText(/Tạo danh sách nghe mới|Chọn danh sách/)
      .map((element) => element.props.accessibilityLabel),
  ).toEqual([
    'Tạo danh sách nghe mới',
    'Chọn danh sách Danh sách nghe',
    'Chọn danh sách Tập trung',
  ]);
});

it('selects a list and creates another with a unique name', async () => {
  const onSelect = jest.fn();
  const onCreate = jest.fn(() => true);
  const view = render(
    <PlaylistSelector
      playlists={playlists}
      selectedId="default"
      onSelect={onSelect}
      onCreate={onCreate}
      onDelete={jest.fn()}
      onRename={jest.fn(() => true)}
    />,
  );

  fireEvent.press(view.getByLabelText('Chọn danh sách Tập trung'));
  expect(onSelect).toHaveBeenCalledWith('focus');

  fireEvent.press(view.getByLabelText('Tạo danh sách nghe mới'));
  fireEvent.changeText(view.getByLabelText('Tên danh sách nghe'), 'Đi đường');
  fireEvent.press(view.getByLabelText('Tạo danh sách'));
  expect(onCreate).toHaveBeenCalledWith('Đi đường');
  await waitFor(() =>
    expect(view.queryByLabelText('Tên danh sách nghe')).toBeNull(),
  );
});

it('rejects blank and duplicate list names', () => {
  const onCreate = jest.fn(() => true);
  const view = render(
    <PlaylistSelector
      playlists={playlists}
      selectedId="default"
      onSelect={jest.fn()}
      onCreate={onCreate}
      onDelete={jest.fn()}
      onRename={jest.fn(() => true)}
    />,
  );
  fireEvent.press(view.getByLabelText('Tạo danh sách nghe mới'));
  fireEvent.press(view.getByLabelText('Tạo danh sách'));
  expect(view.getByText('Nhập tên danh sách nghe.')).toBeTruthy();
  fireEvent.changeText(view.getByLabelText('Tên danh sách nghe'), 'tẬp TRUNG');
  fireEvent.press(view.getByLabelText('Tạo danh sách'));
  expect(view.getByText('Tên này đã có rồi. Hãy chọn tên khác.')).toBeTruthy();
  expect(onCreate).not.toHaveBeenCalled();
});

it('confirms before deleting the selected list and explains files are kept', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const onDelete = jest.fn();
  const view = render(
    <PlaylistSelector
      playlists={playlists}
      selectedId="focus"
      onSelect={jest.fn()}
      onCreate={jest.fn(() => true)}
      onDelete={onDelete}
      onRename={jest.fn(() => true)}
    />,
  );

  const selectedChip = view.getByTestId('selected-playlist-chip');
  fireEvent.press(
    within(selectedChip).getByLabelText('Xóa danh sách Tập trung'),
  );
  expect(onDelete).not.toHaveBeenCalled();
  expect(alert.mock.calls[0][0]).toContain('Tập trung');
  expect(alert.mock.calls[0][1]).toContain('File âm thanh gốc vẫn còn');
  expect(alert.mock.calls[0][1]).toContain('Tên và danh sách bài nghe');
  const buttons = alert.mock.calls[0][2]!;
  buttons[0].onPress?.();
  expect(onDelete).not.toHaveBeenCalled();
  buttons[1].onPress?.();
  expect(onDelete).toHaveBeenCalledWith('focus');
  alert.mockRestore();
});

it('shows only the create action when no playlists remain', () => {
  const view = render(
    <PlaylistSelector
      playlists={[]}
      selectedId=""
      onSelect={jest.fn()}
      onCreate={jest.fn(() => true)}
      onDelete={jest.fn()}
      onRename={jest.fn(() => true)}
    />,
  );

  expect(view.getByText('0')).toBeTruthy();
  expect(view.getByLabelText('Tạo danh sách nghe mới')).toBeTruthy();
  expect(view.queryByLabelText(/Xóa danh sách/)).toBeNull();
});

it('renames the selected list and reports an existing name before saving', () => {
  const onRename = jest.fn(() => true);
  const view = render(
    <PlaylistSelector
      playlists={playlists}
      selectedId="focus"
      onSelect={jest.fn()}
      onCreate={jest.fn(() => true)}
      onDelete={jest.fn()}
      onRename={onRename}
    />,
  );

  const selectedChip = view.getByTestId('selected-playlist-chip');
  fireEvent.press(
    within(selectedChip).getByLabelText('Đổi tên danh sách Tập trung'),
  );
  const input = view.getByLabelText('Tên danh sách nghe');
  expect(input.props.value).toBe('Tập trung');
  fireEvent.changeText(input, 'danh SÁCH nghe');
  fireEvent.press(view.getByLabelText('Lưu tên'));
  expect(view.getByText('Tên này đã có rồi. Hãy chọn tên khác.')).toBeTruthy();
  expect(onRename).not.toHaveBeenCalled();

  fireEvent.changeText(input, 'Đi đường');
  fireEvent.press(view.getByLabelText('Lưu tên'));
  expect(onRename).toHaveBeenCalledWith('focus', 'Đi đường');
  expect(view.queryByLabelText('Tên danh sách nghe')).toBeNull();
});
