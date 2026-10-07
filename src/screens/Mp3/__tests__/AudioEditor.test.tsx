import { fireEvent, render, screen } from '@testing-library/react-native';
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
