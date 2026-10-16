import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import {
  getMemoryShareState,
  getFriendMemories,
} from '../../../services/memories/memorySharing';
import { useAuthStore } from '../../../store/authStore';
import { MemoryScreen } from '../MemoryScreen';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
jest.mock('../../../components/Screen', () => ({
  Screen: ({
    children,
    fixedHeader,
  }: {
    children: React.ReactNode;
    fixedHeader: React.ReactNode;
  }) => {
    const { View } = jest.requireActual('react-native');
    return (
      <View>
        {fixedHeader}
        {children}
      </View>
    );
  },
}));
jest.mock('../../../hooks/useProfile', () => ({
  useProfile: () => ({ name: 'Asher' }),
}));
jest.mock('../MemoryCapture', () => ({ MemoryCapture: () => null }));
jest.mock('../MemoryEditor', () => ({ MemoryEditor: () => null }));
jest.mock('../MemoryFriendsModal', () => ({ MemoryFriendsModal: () => null }));
jest.mock('../../../services/memories/memoryStorage', () => ({
  readMemories: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../../services/memories/memorySharing', () => ({
  getMemoryShareState: jest.fn(),
  getFriendMemories: jest.fn(),
  memoryEmailVerificationNeeded: () => true,
}));

const warning = 'Email chưa được xác nhận';
const verifiedState = {
  email: 'a@example.com',
  friends: [],
  incoming: [],
  outgoing: [],
  sharedIds: [],
  legacyIds: [],
};
let appStateChanged: (state: AppStateStatus) => void;

beforeEach(() => {
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    appStateChanged = listener;
    return { remove: jest.fn() };
  });
  useAuthStore.setState({
    user: { uid: 'u1', email: verifiedState.email, displayName: 'Asher' },
  });
  jest
    .mocked(getMemoryShareState)
    .mockReset()
    .mockRejectedValue(new Error(warning));
  jest
    .mocked(getFriendMemories)
    .mockReset()
    .mockResolvedValue({ items: [], nextOffset: null });
});

afterEach(() => jest.restoreAllMocks());

async function openFriends() {
  render(<MemoryScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }));
  await screen.findByText(warning);
}

it('clears the warning when the user checks verification directly from the feed', async () => {
  await openFriends();
  jest.mocked(getMemoryShareState).mockResolvedValue(verifiedState);
  fireEvent.press(
    screen.getByRole('button', { name: 'Tôi đã xác nhận email' }),
  );
  await waitFor(() => expect(screen.queryByText(warning)).toBeNull());
  await screen.findByText('Chưa có ký ức từ bạn bè');
});

it('refreshes sharing after returning from the email app', async () => {
  await openFriends();
  jest.mocked(getMemoryShareState).mockResolvedValue(verifiedState);
  act(() => appStateChanged('background'));
  await act(async () => appStateChanged('active'));
  await waitFor(() => expect(screen.queryByText(warning)).toBeNull());
  await screen.findByText('Chưa có ký ức từ bạn bè');
});
