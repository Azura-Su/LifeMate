import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { AudioEditor } from '../AudioEditor';
import type { AudioTrack } from '../../../types/audio';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('../AudioPlayer', () => ({ AudioPlayer: () => null }));
const track: AudioTrack = {
  id: 'a',
  ownerId: 'u1',
  title: 'Bản A',
  fileName: 'a.mp3',
  mimeType: 'audio/mpeg',
  durationMs: 5000,
  sizeBytes: 1000,
  createdAt: 10,
  source: 'audio',
  local: true,
  synced: true,
};
it('edits time fields, changes order and saves a newly named sequential composition', () => {
  const save = jest.fn();
  render(
    <AudioEditor
      initial={[
        { track, startMs: 0, endMs: 5000 },
        {
          track: { ...track, id: 'b', title: 'Bản B' },
          startMs: 0,
          endMs: 5000,
        },
      ]}
      job={null}
      error={null}
      playback={null}
      onClose={jest.fn()}
      onCancel={jest.fn()}
      onStop={jest.fn()}
      onSave={save}
      onPreview={jest.fn()}
      onPreviewMerge={jest.fn()}
    />,
  );
  fireEvent.changeText(screen.getByLabelText('Bắt đầu đoạn 1'), '1');
  fireEvent.changeText(screen.getByLabelText('Kết thúc đoạn 1'), '3');
  fireEvent.press(screen.getByLabelText('Đưa Bản B lên'));
  fireEvent.changeText(
    screen.getByLabelText('Tên bản âm thanh mới'),
    'Buổi sáng',
  );
  fireEvent.press(screen.getByText('Ghép và lưu bản mới'));
  expect(save).toHaveBeenCalledWith(
    [
      expect.objectContaining({
        track: expect.objectContaining({ id: 'b' }),
        startMs: 0,
        endMs: 5000,
      }),
      expect.objectContaining({
        track: expect.objectContaining({ id: 'a' }),
        startMs: 1000,
        endMs: 3000,
      }),
    ],
    'Buổi sáng',
  );
});

it('keeps each source file name on one line in the editor', () => {
  const longTitle = 'Bài nghe có tên rất dài để kiểm tra phần hiển thị';
  render(
    <AudioEditor
      initial={[
        { track: { ...track, title: longTitle }, startMs: 0, endMs: 5000 },
      ]}
      job={null}
      error={null}
      playback={null}
      onClose={jest.fn()}
      onCancel={jest.fn()}
      onStop={jest.fn()}
      onSave={jest.fn()}
      onPreview={jest.fn()}
      onPreviewMerge={jest.fn()}
    />,
  );

  expect(screen.getByText(longTitle).props.numberOfLines).toBe(1);
});

it('uses a back action and centers the editor header title', () => {
  const onClose = jest.fn();
  render(
    <AudioEditor
      initial={[{ track, startMs: 0, endMs: 5000 }]}
      job={null}
      error={null}
      playback={null}
      onClose={onClose}
      onCancel={jest.fn()}
      onStop={jest.fn()}
      onSave={jest.fn()}
      onPreview={jest.fn()}
      onPreviewMerge={jest.fn()}
    />,
  );

  const title = screen.getByRole('header');
  expect(StyleSheet.flatten(title.props.style).textAlign).toBe('center');
  fireEvent.press(screen.getByLabelText('Quay lại thư viện MP3'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('keeps the draggable trim handles synchronized with the time fields', () => {
  render(
    <AudioEditor
      initial={[{ track, startMs: 0, endMs: 5000 }]}
      job={null}
      error={null}
      playback={null}
      onClose={jest.fn()}
      onCancel={jest.fn()}
      onStop={jest.fn()}
      onSave={jest.fn()}
      onPreview={jest.fn()}
      onPreviewMerge={jest.fn()}
    />,
  );

  const startHandle = screen.getByLabelText('Điểm bắt đầu đoạn 1');
  const endHandle = screen.getByLabelText('Điểm kết thúc đoạn 1');
  expect(startHandle.props.accessibilityValue.now).toBe(0);
  expect(endHandle.props.accessibilityValue.now).toBe(5000);

  fireEvent.changeText(screen.getByLabelText('Bắt đầu đoạn 1'), '1.2');
  expect(
    screen.getByLabelText('Điểm bắt đầu đoạn 1').props.accessibilityValue.now,
  ).toBe(1200);

  act(() =>
    screen.getByLabelText('Điểm bắt đầu đoạn 1').props.onAccessibilityAction({
      nativeEvent: { actionName: 'increment' },
    }),
  );
  expect(screen.getByLabelText('Bắt đầu đoạn 1').props.value).toBe('1.3');
  act(() =>
    screen.getByLabelText('Điểm kết thúc đoạn 1').props.onAccessibilityAction({
      nativeEvent: { actionName: 'decrement' },
    }),
  );
  expect(screen.getByLabelText('Kết thúc đoạn 1').props.value).toBe('4.9');
});

it('lets each merge source set its range and previews the clips in merge order', () => {
  const previewMerge = jest.fn();
  const second = { ...track, id: 'b', title: 'Bản B' };
  render(
    <AudioEditor
      initial={[
        { track, startMs: 0, endMs: 5000 },
        { track: second, startMs: 0, endMs: 5000 },
      ]}
      job={null}
      error={null}
      playback={null}
      onClose={jest.fn()}
      onCancel={jest.fn()}
      onStop={jest.fn()}
      onSave={jest.fn()}
      onPreview={jest.fn()}
      onPreviewMerge={previewMerge}
    />,
  );

  expect(screen.getByLabelText('Điểm bắt đầu đoạn 1')).toBeTruthy();
  expect(screen.getByLabelText('Điểm kết thúc đoạn 2')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Kết thúc đoạn 1'), '2');
  fireEvent.changeText(screen.getByLabelText('Bắt đầu đoạn 2'), '1');
  fireEvent.press(screen.getByText('Nghe thử bản ghép'));

  expect(previewMerge).toHaveBeenCalledWith([
    { track, startMs: 0, endMs: 2000 },
    { track: second, startMs: 1000, endMs: 5000 },
  ]);
});

it('starts a valid audio preview when the preview button is pressed', () => {
  const stop = jest.fn();
  const onPreview = jest.fn();
  render(
    <AudioEditor
      initial={[{ track, startMs: 0, endMs: 5000 }]}
      job={null}
      error={null}
      playback={null}
      onClose={jest.fn()}
      onCancel={jest.fn()}
      onStop={stop}
      onSave={jest.fn()}
      onPreview={onPreview}
      onPreviewMerge={jest.fn()}
    />,
  );

  fireEvent.press(screen.getByText('Nghe thử đoạn 1'));

  expect(stop).toHaveBeenCalledTimes(1);
  expect(onPreview).toHaveBeenCalledWith({
    track,
    startMs: 0,
    endMs: 5000,
  });
});
