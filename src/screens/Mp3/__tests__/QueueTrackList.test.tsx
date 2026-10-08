import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import {
  QueueTrackList,
  queueDragOffset,
  queueTargetIndex,
} from '../QueueTrackList';
import { useQueuePlaybackStore } from '../../../store/queuePlaybackStore';
import { colors } from '../../../theme';
import type { AudioTrack } from '../../../types/audio';

jest.mock('@expo/vector-icons/Feather', () => ({
  __esModule: true,
  default: () => null,
}));

const base: AudioTrack = {
  id: 'a',
  ownerId: 'u1',
  title: 'A',
  fileName: 'a.m4a',
  mimeType: 'audio/mp4',
  durationMs: 1000,
  sizeBytes: 10,
  createdAt: 1,
  source: 'audio',
  local: true,
  synced: false,
};
const items = ['a', 'b', 'c'].map((id) => ({ ...base, id, title: id }));
const noop = jest.fn();
const props = {
  items,
  busy: false,
  onPlayTrack: noop,
  onRemove: noop,
  onMove: noop,
};

beforeEach(() => {
  useQueuePlaybackStore.getState().setCurrentId(null);
  useQueuePlaybackStore.getState().setPlaying(false);
});

it('memoizes the queue list so playback progress does not render it again', () => {
  expect(QueueTrackList.$$typeof).toBe(Symbol.for('react.memo'));
});

it('updates the active row indicator without rebuilding the queue list', () => {
  const view = render(<QueueTrackList {...props} />);
  const rowStyle = (id: string) =>
    StyleSheet.flatten(view.getByTestId(`queue-track-${id}`).props.style);
  expect(rowStyle('a').borderColor).not.toBe(colors.primaryBorder);

  act(() => useQueuePlaybackStore.getState().setCurrentId('a'));
  act(() => useQueuePlaybackStore.getState().setPlaying(true));
  expect(view.getByLabelText('Đĩa đang phát')).toBeTruthy();
  expect(rowStyle('a').borderColor).toBe(colors.primaryBorder);

  act(() => useQueuePlaybackStore.getState().setCurrentId('b'));
  expect(view.getByLabelText('Đĩa đang phát')).toBeTruthy();
  expect(rowStyle('a').borderColor).not.toBe(colors.primaryBorder);
  expect(rowStyle('b').borderColor).toBe(colors.primaryBorder);
  expect(view.getAllByLabelText('Phát a')).toHaveLength(1);
  expect(view.getAllByLabelText('Phát c')).toHaveLength(1);
});

it('exposes an accessible drag handle and move actions', () => {
  const onMove = jest.fn();
  const view = render(<QueueTrackList {...props} onMove={onMove} />);
  const handle = view.getByTestId('queue-reorder-handle-b');

  expect(handle.props.accessible).toBe(true);
  expect(handle.props.accessibilityLabel).toBe('Kéo để sắp xếp b');
  expect(
    handle.props.accessibilityActions.map(
      (action: { label?: string }) => action.label,
    ),
  ).toEqual(['Chuyển lên một vị trí', 'Chuyển xuống một vị trí']);

  act(() =>
    fireEvent(handle, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    }),
  );
  expect(onMove).toHaveBeenCalledWith('b', 'down');
});

it('maps drag distance to a clamped queue position', () => {
  expect(queueTargetIndex(1, 44, 72, 4)).toBe(2);
  expect(queueTargetIndex(1, -44, 72, 4)).toBe(0);
  expect(queueTargetIndex(1, 500, 72, 4)).toBe(3);
  expect(queueTargetIndex(0, -100, 72, 4)).toBe(0);
});

it('keeps the lifted row aligned with the finger as its slot changes', () => {
  const step = 72 + 12;
  expect(1 * step + queueDragOffset(1, 2, 50, 72)).toBe(50);
  expect(-1 * step + queueDragOffset(1, 0, -50, 72)).toBe(-50);
});

it('starts dragging and requests an order update after crossing a row', () => {
  const onMove = jest.fn();
  const view = render(<QueueTrackList {...props} onMove={onMove} />);
  const handle = view.getByTestId('queue-reorder-handle-b');
  const responder = handle.props as {
    onResponderGrant: (event: object) => void;
    onResponderMove: (event: object) => void;
  };
  const touchEvent = (previousY: number, currentY: number, time: number) => ({
    touchHistory: {
      mostRecentTimeStamp: time,
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      touchBank: [
        {
          touchActive: true,
          currentTimeStamp: time,
          previousPageX: 0,
          previousPageY: previousY,
          currentPageX: 0,
          currentPageY: currentY,
        },
      ],
    },
  });
  act(() => responder.onResponderGrant(touchEvent(0, 0, 1)));
  expect(
    view.getByTestId('queue-reorder-handle-b').props.accessibilityState
      .selected,
  ).toBe(true);
  act(() => responder.onResponderMove(touchEvent(0, 50, 2)));
  expect(onMove).toHaveBeenCalledWith('b', 'down');
});
