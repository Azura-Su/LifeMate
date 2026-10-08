import { act, fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useQueuePlaybackStore } from '../../../store/queuePlaybackStore';
import { Mp3Screen } from '../Mp3Screen';
import { SpinningRecord } from '../SpinningRecord';

const title = 'Tên bài hát rất dài cần chạy ngang để nhìn thấy toàn bộ tiêu đề';
const track = {
  id: 'track-1',
  title,
  durationMs: 58000,
};
const nextTrack = {
  id: 'track-2',
  title: 'Bài kế tiếp',
  durationMs: 28500,
};
const mockModel = {
  tracks: [track],
  loading: false,
  job: null,
  error: null,
  prepare: jest.fn(),
  stop: jest.fn(),
  cancel: jest.fn(),
  clearSelection: jest.fn(),
};
const mockPlaylist = {
  ready: true,
  playlists: [{ id: 'default', name: 'Danh sách nghe', trackIds: [track.id] }],
  selectedPlaylist: {
    id: 'default',
    name: 'Danh sách nghe',
    trackIds: [track.id],
  },
  selectedPlaylistId: 'default',
  items: [track],
  remove: jest.fn(),
  removeFromAll: jest.fn(),
  toggle: jest.fn(),
  has: jest.fn(() => true),
  selectPlaylist: jest.fn(),
  createPlaylist: jest.fn(() => 'new-list'),
  renamePlaylist: jest.fn(() => true),
  next: jest.fn(() => null),
};
const mockQueue = {
  currentId: track.id,
  isSwitchingTrack: false,
  status: {
    currentTime: 13,
    duration: 58,
    playing: true,
    isLoaded: true,
  },
  error: null,
  start: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
  seek: jest.fn(),
  toggle: jest.fn(),
  previous: jest.fn(),
  next: jest.fn(),
  hasNext: jest.fn(() => false),
};

jest.mock('../useMp3Screen', () => ({ useMp3Screen: () => mockModel }));
jest.mock('../usePlaylist', () => ({ usePlaylist: () => mockPlaylist }));
jest.mock('../useQueuePlayer', () => ({ useQueuePlayer: () => mockQueue }));
jest.mock('../Mp3Library', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Mp3Library: ({ onClose }: { onClose: () => void }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: 'Quay lại thư viện',
          onPress: onClose,
        },
        React.createElement(Text, null, 'Quay lại thư viện'),
      ),
  };
});
jest.mock('@expo/vector-icons/Feather', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@react-native-community/slider', () => ({
  __esModule: true,
  default: () => null,
}));

it('animates only the player title while the playing list item stays on one line', () => {
  useQueuePlaybackStore.getState().setCurrentId(track.id);
  useQueuePlaybackStore.getState().setPlaying(true);
  const view = render(<Mp3Screen />);
  const viewports = view.getAllByTestId('audio-title-viewport');
  const measurements = view.getAllByTestId('audio-title-measure');

  expect(viewports).toHaveLength(2);
  for (const viewport of viewports) {
    fireEvent(viewport, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 36 } },
    });
  }
  for (const measurement of measurements) {
    fireEvent(measurement, 'contentSizeChange', 300, 36);
  }

  const oneLineTitles = view
    .getAllByText(title)
    .filter((text) => text.props.ellipsizeMode === 'tail');
  expect(oneLineTitles).toHaveLength(2);
  expect(oneLineTitles[0].props.numberOfLines).toBe(1);
  expect(oneLineTitles[0].props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ opacity: 0 })]),
  );
  expect(oneLineTitles[1].props.style).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ opacity: 0 })]),
  );
  expect(view.getByTestId('spinning-record')).toBeTruthy();

  mockQueue.status.playing = false;
  mockQueue.isSwitchingTrack = true;
  view.rerender(<Mp3Screen />);
  expect(view.getByTestId('spinning-record').props.accessibilityLabel).toBe(
    'Đĩa đang phát',
  );
});

it('keeps each queue row indicator mounted while playback moves to another track', () => {
  const originalItems = mockPlaylist.items;
  const originalCurrentId = mockQueue.currentId;
  const originalPlaying = mockQueue.status.playing;
  const originalSwitching = mockQueue.isSwitchingTrack;
  mockPlaylist.items = [track, nextTrack];
  mockQueue.currentId = track.id;
  mockQueue.status.playing = true;
  mockQueue.isSwitchingTrack = false;
  useQueuePlaybackStore.getState().setCurrentId(track.id);
  useQueuePlaybackStore.getState().setPlaying(true);

  const view = render(<Mp3Screen />);
  const records = view.UNSAFE_getAllByType(SpinningRecord);
  expect(records).toHaveLength(2);

  mockQueue.currentId = nextTrack.id;
  mockQueue.status.playing = false;
  mockQueue.isSwitchingTrack = true;
  act(() => {
    useQueuePlaybackStore.getState().setCurrentId(nextTrack.id);
    useQueuePlaybackStore.getState().setPlaying(true);
  });
  view.rerender(<Mp3Screen />);

  const updatedRecords = view.UNSAFE_getAllByType(SpinningRecord);
  expect(updatedRecords).toHaveLength(2);
  expect(
    updatedRecords.find((record) => record.props.visible === true),
  ).toBeTruthy();

  mockPlaylist.items = originalItems;
  mockQueue.currentId = originalCurrentId;
  mockQueue.status.playing = originalPlaying;
  mockQueue.isSwitchingTrack = originalSwitching;
  act(() => {
    useQueuePlaybackStore.getState().setCurrentId(originalCurrentId);
    useQueuePlaybackStore
      .getState()
      .setPlaying(originalPlaying || originalSwitching);
  });
});

it('shows a create-list empty state after every playlist has been deleted', () => {
  const originalPlaylists = mockPlaylist.playlists;
  const originalSelectedPlaylist = mockPlaylist.selectedPlaylist;
  const originalSelectedPlaylistId = mockPlaylist.selectedPlaylistId;
  const originalItems = mockPlaylist.items;
  mockPlaylist.playlists = [];
  mockPlaylist.selectedPlaylist =
    null as unknown as typeof mockPlaylist.selectedPlaylist;
  mockPlaylist.selectedPlaylistId = '';
  mockPlaylist.items = [];

  const view = render(<Mp3Screen />);
  expect(view.getByText('Chưa có danh sách nghe')).toBeTruthy();
  expect(view.getByLabelText('Tạo danh sách nghe mới')).toBeTruthy();

  mockPlaylist.playlists = originalPlaylists;
  mockPlaylist.selectedPlaylist = originalSelectedPlaylist;
  mockPlaylist.selectedPlaylistId = originalSelectedPlaylistId;
  mockPlaylist.items = originalItems;
});

it('renames the selected playlist from its chip action', () => {
  const view = render(<Mp3Screen />);
  fireEvent.press(view.getByLabelText('Đổi tên danh sách Danh sách nghe'));
  fireEvent.changeText(view.getByLabelText('Tên danh sách nghe'), 'Buổi tối');
  fireEvent.press(view.getByLabelText('Lưu tên'));

  expect(mockPlaylist.renamePlaylist).toHaveBeenCalledWith(
    'default',
    'Buổi tối',
  );
});

it('keeps playlist and playback controls fixed while only queue rows scroll', () => {
  const originalItems = mockPlaylist.items;
  mockPlaylist.items = [track, nextTrack];

  const view = render(<Mp3Screen />);
  const fixed = within(view.getByTestId('screen-fixed-content'));
  const scrollArea = within(view.getByTestId('screen-scroll-area'));

  expect(fixed.getByText('Danh sách của bạn')).toBeTruthy();
  expect(fixed.getByText('2 bài · phát lần lượt')).toBeTruthy();
  expect(fixed.getByLabelText('Phát lại từ đầu')).toBeTruthy();
  expect(scrollArea.getByTestId('queue-track-track-1')).toBeTruthy();
  expect(scrollArea.getByTestId('queue-track-track-2')).toBeTruthy();
  expect(fixed.queryByTestId('queue-track-track-1')).toBeNull();

  mockPlaylist.items = originalItems;
});

it('uses a compact static MP3 header and an icon-only library button', () => {
  const originalSelectedPlaylist = mockPlaylist.selectedPlaylist;
  mockPlaylist.selectedPlaylist = {
    ...originalSelectedPlaylist,
    name: 'Asher',
  };
  const view = render(<Mp3Screen />);
  const header = StyleSheet.flatten(
    view.getByTestId('screen-fixed-header').props.style,
  );
  const title = view.getByRole('header');
  const titleStyle = StyleSheet.flatten(title.props.style);
  const libraryButton = view.getByLabelText(
    'Mở thư viện để thêm, cắt, ghép âm thanh',
  );
  const libraryButtonStyle = StyleSheet.flatten(libraryButton.props.style);

  expect(header.paddingTop).toBe(8);
  expect(header.paddingBottom).toBe(8);
  expect(title.props.numberOfLines).toBe(1);
  expect(title.props.children).toBe('Danh sách nghe');
  expect(titleStyle).toMatchObject({ fontSize: 26, lineHeight: 32 });
  expect(libraryButtonStyle).toMatchObject({ width: 44, height: 44 });
  expect(view.queryByText('Thư viện')).toBeNull();

  mockPlaylist.selectedPlaylist = originalSelectedPlaylist;
});

it('clears merge selection when returning from the library', () => {
  const view = render(<Mp3Screen />);

  fireEvent.press(
    view.getByLabelText('Mở thư viện để thêm, cắt, ghép âm thanh'),
  );
  fireEvent.press(view.getByLabelText('Quay lại thư viện'));

  expect(mockModel.clearSelection).toHaveBeenCalled();
  expect(mockModel.stop).toHaveBeenCalled();
});

it('toggles repeat for the current track from the player controls', () => {
  const view = render(<Mp3Screen />);

  expect(view.queryByLabelText(`Nghe đi nghe lại ${title}`)).toBeNull();
  fireEvent.press(view.getByLabelText('Lặp lại bài hiện tại'));

  expect(view.getByLabelText('Tắt lặp lại bài hiện tại')).toBeTruthy();
  expect(view.getByText('Đang lặp lại bài này')).toBeTruthy();
});

it('hides current-track repeat when whole-list repeat is enabled', () => {
  const view = render(<Mp3Screen />);

  expect(view.getByLabelText('Lặp lại bài hiện tại')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Lặp lại toàn bộ danh sách nghe'));

  expect(
    view.getByLabelText('Lặp lại toàn bộ danh sách nghe').props
      .accessibilityState.checked,
  ).toBe(true);
  expect(view.queryByLabelText('Lặp lại bài hiện tại')).toBeNull();
  expect(view.getByText('Đang lặp lại cả danh sách')).toBeTruthy();
});
