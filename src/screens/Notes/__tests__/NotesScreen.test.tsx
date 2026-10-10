import { render, screen } from '@testing-library/react-native';
import { NotesScreen } from '../NotesScreen';
import { useAuthStore } from '../../../store/authStore';
import { useNoteStore } from '../../../store/noteStore';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../../testing/firestoreMock'),
);

beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: 'u1@example.com', displayName: 'User' });
  useNoteStore.setState({
    uid: 'u1',
    notes: [
      {
        id: 'calendar-day-2026-10-09',
        ownerId: 'u1',
        title: 'Ghi chú ngày 2026-10-09',
        body: 'Việc riêng trong ngày',
        updatedAt: 1,
      },
      {
        id: 'free-note',
        ownerId: 'u1',
        title: 'Ý tưởng',
        body: 'Ghi chú tự do',
        updatedAt: 2,
      },
    ],
    synced: true,
    loading: false,
    error: null,
  });
});

it('keeps date notes out of the freeform Notes list', () => {
  render(<NotesScreen />);
  expect(screen.getByText('Ý tưởng')).toBeTruthy();
  expect(screen.queryByText('Ghi chú ngày 2026-10-09')).toBeNull();
  expect(screen.queryByText('Việc riêng trong ngày')).toBeNull();
});
