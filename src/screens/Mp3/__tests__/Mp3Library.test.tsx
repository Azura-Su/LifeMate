import { act, fireEvent, render } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
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

afterEach(() => jest.useRealTimers());

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

it('keeps the file limits visible below the add-audio action', () => {
  const view = render(library());
  expect(
    view.getByText('Tệp: audio/video · Album: video · tối đa 500 MB · 60 phút'),
  ).toBeTruthy();
});

it('uses compact spacing for the library screen content', () => {
  const view = render(library());
  const scrollView = view.UNSAFE_getByType(ScrollView);
  const content = StyleSheet.flatten(scrollView.props.contentContainerStyle);

  expect(content.gap).toBe(12);
});

it('opens the source chooser from the add-audio row', () => {
  const view = render(library());
  expect(
    view.queryByRole('button', { name: 'Chọn file audio hoặc video' }),
  ).toBeNull();
  expect(
    view.queryByRole('button', { name: 'Chọn video từ album' }),
  ).toBeNull();

  fireEvent.press(view.getByRole('button', { name: 'Thêm âm thanh' }));

  expect(
    view.getByRole('button', { name: 'Chọn file audio hoặc video' }),
  ).toBeTruthy();
  expect(
    view.getByRole('button', { name: 'Chọn video từ album' }),
  ).toBeTruthy();
});

it('starts the selected picker after the source sheet closes', async () => {
  jest.useFakeTimers();
  const view = render(library());

  fireEvent.press(view.getByRole('button', { name: 'Thêm âm thanh' }));
  fireEvent.press(
    view.getByRole('button', { name: 'Chọn file audio hoặc video' }),
  );
  expect(model.addFile).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
  });
  expect(model.addFile).toHaveBeenCalledTimes(1);
});

it('shows a compact loading state until the file picker finishes opening', async () => {
  jest.useFakeTimers();
  let finishPicker = () => {};
  model.addFile.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishPicker = resolve;
      }),
  );
  const view = render(library());

  fireEvent.press(view.getByRole('button', { name: 'Thêm âm thanh' }));
  fireEvent.press(
    view.getByRole('button', { name: 'Chọn file audio hoặc video' }),
  );

  expect(view.getByText('Đang mở ứng dụng Tệp…')).toBeTruthy();
  act(() => jest.advanceTimersByTime(300));
  expect(model.addFile).toHaveBeenCalledTimes(1);
  expect(view.getByText('Đang mở ứng dụng Tệp…')).toBeTruthy();

  await act(async () => {
    finishPicker();
    await Promise.resolve();
  });
  expect(view.queryByText('Đang mở ứng dụng Tệp…')).toBeNull();
});

it('starts the album picker after the source sheet closes', async () => {
  jest.useFakeTimers();
  const view = render(library());

  fireEvent.press(view.getByRole('button', { name: 'Thêm âm thanh' }));
  fireEvent.press(view.getByRole('button', { name: 'Chọn video từ album' }));
  expect(model.naming.chooseFromAlbum).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
  });
  expect(model.naming.chooseFromAlbum).toHaveBeenCalledTimes(1);
});

it('shows a compact loading state until the album picker finishes opening', async () => {
  jest.useFakeTimers();
  let finishPicker = () => {};
  model.naming.chooseFromAlbum.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishPicker = resolve;
      }),
  );
  const view = render(library());

  fireEvent.press(view.getByRole('button', { name: 'Thêm âm thanh' }));
  fireEvent.press(view.getByRole('button', { name: 'Chọn video từ album' }));

  expect(view.getByText('Đang mở album ảnh…')).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
  });
  expect(model.naming.chooseFromAlbum).toHaveBeenCalledTimes(1);
  expect(view.getByText('Đang mở album ảnh…')).toBeTruthy();

  await act(async () => {
    finishPicker();
    await Promise.resolve();
  });
  expect(view.queryByText('Đang mở album ảnh…')).toBeNull();
});
