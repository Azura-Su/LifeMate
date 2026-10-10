import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeCalendarSheet } from '../HomeCalendarSheet';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../../testing/firestoreMock'),
);

it('closes the note popup and shows a success toast after saving', async () => {
  const onSaveNote = jest.fn().mockResolvedValue(undefined);
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <HomeCalendarSheet
        visible
        onClose={jest.fn()}
        initialTab="calendar"
        selectedDate={new Date(2026, 9, 9)}
        onSelectDate={jest.fn()}
        noteDateKeys={[]}
        noteUid="u1"
        notes={[]}
        notesSynced
        onSaveNote={onSaveNote}
        onDeleteNote={jest.fn().mockResolvedValue(undefined)}
        onOpenAgenda={jest.fn()}
      />
    </SafeAreaProvider>,
  );

  fireEvent.press(
    screen.getByRole('button', { name: 'Thêm ghi chú cho ngày này' }),
  );
  fireEvent.changeText(
    screen.getByLabelText('Tiêu đề ghi chú ngày'),
    'Sinh nhật',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu lại' }));

  await waitFor(() => expect(onSaveNote).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('button', { name: 'Đóng ghi chú' })).toBeNull();
  expect(screen.getByText('Đã lưu ghi chú thành công')).toBeTruthy();
});
