import { doc, getFirestore, setDoc } from '@react-native-firebase/firestore';
import { resetFirestoreMock } from '../../../testing/firestoreMock';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
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

it('keeps the draft open when a refresh changes the note being edited', async () => {
  resetFirestoreMock();
  const original = {
    id: 'editing-note',
    ownerId: 'u1',
    title: 'Bản gốc',
    body: 'Nội dung gốc',
    updatedAt: 10,
  };
  const ref = doc(getFirestore(), 'noteAccounts', 'u1', 'notes', original.id);
  await setDoc(ref, original);
  await act(async () => useNoteStore.getState().load('u1'));
  render(<NotesScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Mở ghi chú Bản gốc' }));
  fireEvent.changeText(
    screen.getByLabelText('Tiêu đề ghi chú'),
    'Bản đang soạn',
  );
  await setDoc(ref, {
    ...original,
    body: 'Nội dung mới từ thiết bị khác',
    updatedAt: 20,
  });
  await act(async () => useNoteStore.getState().load('u1'));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  expect(await screen.findByText(/Ghi chú đã thay đổi/)).toBeTruthy();
  expect(screen.getByLabelText('Tiêu đề ghi chú').props.value).toBe(
    'Bản đang soạn',
  );
  expect(useNoteStore.getState().notes[0].body).toBe(
    'Nội dung mới từ thiết bị khác',
  );
});
