import { Alert, StyleSheet } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';
import type { AudioTrack } from '../../../types/audio';
import { AudioTrackCard } from '../AudioTrackCard';

jest.mock('@expo/vector-icons/Feather', () => ({
  __esModule: true,
  default: () => null,
}));

const track: AudioTrack = {
  id: 'a',
  ownerId: 'u1',
  title: 'Bài muốn xóa',
  fileName: 'a.mp3',
  mimeType: 'audio/mpeg',
  durationMs: 2000,
  sizeBytes: 1000,
  createdAt: 100,
  source: 'audio',
  synced: true,
  local: true,
};
const empty = () => undefined;

it('asks before removing a backup and only calls delete after confirmation', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const onDelete = jest.fn();
  const view = render(
    <AudioTrackCard
      track={track}
      position={-1}
      busy={false}
      playlistCount={0}
      onManagePlaylists={empty}
      onSelect={empty}
      onPlay={empty}
      onTrim={empty}
      onRename={empty}
      onDelete={onDelete}
      onSync={empty}
      titleActive={false}
      onActivateTitle={empty}
      isPlaying={false}
    />,
  );
  fireEvent.press(view.getByLabelText('Xóa Bài muốn xóa'));
  expect(onDelete).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2]!;
  expect(alert.mock.calls[0][1]).toContain('bản sao lưu');
  buttons[0].onPress?.();
  expect(onDelete).not.toHaveBeenCalled();
  buttons[1].onPress?.();
  expect(onDelete).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});

it('disables the delete action while an audio operation is running', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const view = render(
    <AudioTrackCard
      track={track}
      position={-1}
      busy
      playlistCount={0}
      onManagePlaylists={empty}
      onSelect={empty}
      onPlay={empty}
      onTrim={empty}
      onRename={empty}
      onDelete={empty}
      onSync={empty}
      titleActive={false}
      onActivateTitle={empty}
      isPlaying={false}
    />,
  );
  fireEvent.press(view.getByLabelText('Xóa Bài muốn xóa'));
  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});

it('keeps rename available beside the track title', () => {
  const onRename = jest.fn();
  const view = render(
    <AudioTrackCard
      track={track}
      position={-1}
      busy={false}
      playlistCount={0}
      onManagePlaylists={empty}
      onSelect={empty}
      onPlay={empty}
      onTrim={empty}
      onRename={onRename}
      onDelete={empty}
      onSync={empty}
      titleActive={false}
      onActivateTitle={empty}
      isPlaying={false}
    />,
  );
  const titleRow = view.getByTestId('track-title-row');
  const rename = within(titleRow).getByLabelText('Đổi tên Bài muốn xóa');
  fireEvent.press(rename);
  expect(onRename).toHaveBeenCalledTimes(1);
});

it('centers the delete action vertically in the file card', () => {
  const view = render(
    <AudioTrackCard
      track={track}
      position={-1}
      busy={false}
      playlistCount={0}
      onManagePlaylists={empty}
      onSelect={empty}
      onPlay={empty}
      onTrim={empty}
      onRename={empty}
      onDelete={empty}
      onSync={empty}
      titleActive={false}
      onActivateTitle={empty}
      isPlaying={false}
    />,
  );
  const card = view.getByTestId('track-card');
  const deleteAction = view.getByLabelText('Xóa Bài muốn xóa');

  expect(StyleSheet.flatten(card.props.style)).toMatchObject({
    position: 'relative',
  });
  expect(StyleSheet.flatten(deleteAction.props.style)).toMatchObject({
    position: 'absolute',
    top: '50%',
    width: 44,
    height: 44,
    transform: [{ translateY: -22 }],
  });
});

it('shows a spinning record in place of the play icon for the playing track', () => {
  const view = render(
    <AudioTrackCard
      track={track}
      position={-1}
      busy={false}
      playlistCount={0}
      onManagePlaylists={empty}
      onSelect={empty}
      onPlay={empty}
      onTrim={empty}
      onRename={empty}
      onDelete={empty}
      onSync={empty}
      titleActive={false}
      onActivateTitle={empty}
      isPlaying
    />,
  );

  // Decorative here: the button label already announces "Đang phát".
  expect(
    view.getByTestId('spinning-record', { includeHiddenElements: true }),
  ).toBeTruthy();
  expect(view.getByLabelText('Đang phát Bài muốn xóa')).toBeTruthy();
});

it('opens playlist membership management for the track', () => {
  const onManagePlaylists = jest.fn();
  const view = render(
    <AudioTrackCard
      track={track}
      position={-1}
      busy={false}
      playlistCount={2}
      onManagePlaylists={onManagePlaylists}
      onSelect={empty}
      onPlay={empty}
      onTrim={empty}
      onRename={empty}
      onDelete={empty}
      onSync={empty}
      titleActive={false}
      onActivateTitle={empty}
      isPlaying={false}
    />,
  );

  fireEvent.press(view.getByLabelText('Trong 2 DS Bài muốn xóa'));
  expect(onManagePlaylists).toHaveBeenCalledTimes(1);
});
