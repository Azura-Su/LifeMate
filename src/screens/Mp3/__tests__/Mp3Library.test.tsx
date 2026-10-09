import { fireEvent, render } from '@testing-library/react-native';
import { Mp3Library } from '../Mp3Library';
import type { AudioTrack } from '../../../types/audio';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('../AudioPlayer', () => ({ AudioPlayer: () => null }));
jest.mock('../AudioEditor', () => ({ AudioEditor: () => null }));

const first: AudioTrack = {
  id: 'a',
  ownerId: 'u1',
  title: 'Buổi sáng',
  fileName: 'a.m4a',
  mimeType: 'audio/mp4',
  durationMs: 2000,
  sizeBytes: 1000,
  createdAt: 100,
  source: 'audio',
  synced: true,
  local: true,
};
const second = { ...first, id: 'b', title: 'Bản ghép đêm', fileName: 'b.m4a' };
const model = {
  tracks: [first, second],
  selected: [] as string[],
  job: null,
  error: null,
  message: null,
  editor: null,
  playback: null,
  loading: false,
  cloudLoading: false,
  naming: { draft: null, chooseFromAlbum: jest.fn() },
  clearSelection: jest.fn(),
  toggleSelect: jest.fn(),
  refresh: jest.fn(),
  mergeSelected: jest.fn(),
  addFile: jest.fn(),
};
const playlist = { membershipCount: () => 0 };

beforeEach(() => {
  model.selected = [];
  jest.clearAllMocks();
});

function library() {
  return (
    <Mp3Library
      model={model as never}
      playlist={playlist as never}
      onClose={jest.fn()}
    />
  );
}

it('finds names without accents and clears the search without changing merge selection', () => {
  model.selected = [second.id];
  const view = render(library());
  fireEvent.changeText(view.getByLabelText('Tìm âm thanh'), 'bAn gHEp dem');
  expect(view.queryByLabelText('Chọn Buổi sáng để ghép')).toBeNull();
  expect(
    view.getByLabelText('Chọn Bản ghép đêm để ghép').props.accessibilityState
      .checked,
  ).toBe(true);
  expect(model.clearSelection).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('button', { name: 'Xóa tìm kiếm âm thanh' }));
  expect(view.getByLabelText('Chọn Buổi sáng để ghép')).toBeTruthy();
  expect(
    view.getByLabelText('Chọn Bản ghép đêm để ghép').props.accessibilityState
      .checked,
  ).toBe(true);
});

it('shows a search empty state and offers a bulk clear for selected merge files', () => {
  model.selected = [first.id, second.id];
  const view = render(library());
  fireEvent.changeText(view.getByLabelText('Tìm âm thanh'), 'không tồn tại');
  expect(view.getByText('Không tìm thấy âm thanh')).toBeTruthy();
  fireEvent.press(
    view.getByRole('button', { name: 'Bỏ chọn tất cả file ghép' }),
  );
  expect(model.clearSelection).toHaveBeenCalledTimes(1);
  model.selected = [];
  view.rerender(library());
  expect(
    view.queryByRole('button', { name: 'Bỏ chọn tất cả file ghép' }),
  ).toBeNull();
});

it('offers a separate album option for choosing videos', () => {
  const view = render(library());
  fireEvent.press(view.getByRole('button', { name: 'Chọn video từ album' }));
  expect(model.naming.chooseFromAlbum).toHaveBeenCalledTimes(1);
  expect(view.getByText('Tệp: audio/video · Album: video · tối đa 500 MB · 60 phút')).toBeTruthy();
});
