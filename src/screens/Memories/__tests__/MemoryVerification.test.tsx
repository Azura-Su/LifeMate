import {
  readMemoryFriendsPreference,
  writeMemoryFriendsPreference,
} from '../../../services/memories/memoryFriendsPreference';
import { MemoryEditor } from '../MemoryEditor';
import { MemoryCapture } from '../MemoryCapture';
import { MemoryFriendsModal } from '../MemoryFriendsModal';
import {
  readMemories,
  synchronizeMemories,
  setMemoryVisibility,
  shareMemory,
  createMemory,
} from '../../../services/memories/memoryStorage';
import { observeOwnMemories } from '../../../services/memories/memoryCloud';
import type { MemoryEntry } from '../../../types/memory';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  type AppStateStatus,
} from 'react-native';
import {
  getMemoryShareState,
  getFriendMemories,
  unshareMemory,
  changeMemoryFriend,
} from '../../../services/memories/memorySharing';
import { useAuthStore } from '../../../store/authStore';
import { MemoryScreen } from '../MemoryScreen';

jest.mock('../../../services/memories/memoryFriendsPreference', () => ({
  readMemoryFriendsPreference: jest.fn(),
  writeMemoryFriendsPreference: jest.fn(),
}));
let mockFocused = true;
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockFocused,
}));
jest.mock('../../../components/Screen', () => ({
  Screen: ({
    children,
    fixedHeader,
    fixedContent,
    overlay,
  }: {
    children: React.ReactNode;
    fixedHeader: React.ReactNode;
    fixedContent: React.ReactNode;
    overlay: React.ReactNode;
  }) => {
    const { View } = jest.requireActual('react-native');
    return (
      <View>
        {fixedHeader}
        <View testID="screen-fixed-content">{fixedContent}</View>
        {children}
        {overlay}
      </View>
    );
  },
}));
jest.mock('../../../hooks/useProfile', () => ({
  useProfile: () => ({ name: 'Asher' }),
}));
jest.mock('../MemoryCapture', () => ({ MemoryCapture: jest.fn(() => null) }));
jest.mock('../MemoryEditor', () => ({ MemoryEditor: jest.fn(() => null) }));
jest.mock('../MemoryFriendsModal', () => ({
  MemoryFriendsModal: jest.fn(() => null),
}));
jest.mock('../../../services/memories/memoryStorage', () => ({
  readMemories: jest.fn().mockResolvedValue([]),
  memoryPhotoUri: (_uid: string, file: string | null) =>
    file ? `file:///${file}` : null,
  setMemoryVisibility: jest.fn(),
  shareMemory: jest.fn(),
  createMemory: jest.fn(),
  MemoryShareUnconfirmedError: class extends Error {},
  synchronizeMemories: jest
    .fn()
    .mockResolvedValue({ entries: [], synced: true }),
}));
jest.mock('../../../services/memories/memoryCloud', () => ({
  observeOwnMemories: jest.fn(() => () => {}),
}));
jest.mock('../../../services/memories/memorySharing', () => ({
  getMemoryShareState: jest.fn(),
  getFriendMemories: jest.fn(),
  memoryEmailVerificationNeeded: (cause: Error) =>
    cause.message.includes('Email'),
  memoryPublishDefinitelyNotStarted: () => true,
  publishMemory: jest.fn(),
  unshareMemory: jest.fn(),
  changeMemoryFriend: jest.fn(),
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
  mockFocused = true;
  jest.mocked(readMemoryFriendsPreference).mockReset().mockResolvedValue(null);
  jest
    .mocked(writeMemoryFriendsPreference)
    .mockReset()
    .mockResolvedValue(undefined);
  jest.mocked(readMemories).mockReset().mockResolvedValue([]);
  jest
    .mocked(synchronizeMemories)
    .mockReset()
    .mockResolvedValue({ entries: [], synced: true });
  jest.mocked(setMemoryVisibility).mockReset().mockResolvedValue(undefined);
  jest.mocked(shareMemory).mockReset().mockResolvedValue(undefined);
  jest.mocked(unshareMemory).mockReset().mockResolvedValue(undefined);
  jest.mocked(changeMemoryFriend).mockReset().mockResolvedValue(undefined);
  jest
    .mocked(observeOwnMemories)
    .mockReset()
    .mockReturnValue(() => {});
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

const local: MemoryEntry = {
  id: 'one',
  ownerId: 'u1',
  text: 'Local memory',
  dateKey: '2026-10-15',
  photoFileName: 'photo.jpg',
  createdAt: 100,
  updatedAt: 100,
  visibility: 'private',
};
async function openMine() {
  jest.mocked(readMemories).mockResolvedValue([local]);
  jest
    .mocked(synchronizeMemories)
    .mockResolvedValue({ entries: [local], synced: true });
  jest.mocked(getMemoryShareState).mockResolvedValue(verifiedState);
  render(<MemoryScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  await screen.findByRole('button', { name: 'Quyền xem: Chỉ mình tôi' });
  await screen.findByText('Đã đồng bộ theo tài khoản');
}
it('does not request the friend photo feed while viewing own memories', async () => {
  await openMine();
  expect(getFriendMemories).not.toHaveBeenCalled();
});

it.each(['private', 'friends'] as const)(
  'keeps confirmed %s visibility when returning to My tab while refreshing in the background',
  async (visibility) => {
    await openMine();
    const previous = {
      ...verifiedState,
      sharedIds: visibility === 'friends' ? [local.id] : [],
    };
    jest.mocked(getMemoryShareState).mockResolvedValue(previous);
    fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }));
    await screen.findByText('Chưa có ký ức từ bạn bè');
    let finish!: () => void;
    jest.mocked(getMemoryShareState).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve({
              ...previous,
              sharedIds: visibility === 'private' ? [local.id] : [],
            });
        }),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Của tôi' }));
    const label = visibility === 'friends' ? 'Bạn bè' : 'Chỉ mình tôi';
    expect(
      screen.getByRole('button', { name: `Quyền xem: ${label}` }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Quyền xem: Đang kiểm tra' }),
    ).toBeNull();
    await act(async () => finish());
    const nextLabel = visibility === 'private' ? 'Bạn bè' : 'Chỉ mình tôi';
    expect(
      screen.getByRole('button', { name: `Quyền xem: ${nextLabel}` }),
    ).toBeEnabled();
  },
);

it('invalidates a previously confirmed label if the background sharing-state request fails', async () => {
  await openMine();
  let fail!: () => void;
  jest.mocked(getMemoryShareState).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = () => reject(new Error('Chưa kiểm tra được quyền xem mới nhất'));
      }),
  );
  act(() => fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh'));
  expect(
    screen.getByRole('button', { name: 'Quyền xem: Chỉ mình tôi' }),
  ).toBeEnabled();
  await act(async () => fail());
  expect(
    screen.getByRole('button', { name: 'Quyền xem: Chưa xác định' }),
  ).toBeEnabled();
  expect(
    screen.getByText('Chưa kiểm tra được quyền xem mới nhất'),
  ).toBeTruthy();
});

it('retains freshly verified sharing state if only the friend photo feed fails', async () => {
  await openMine();
  jest
    .mocked(getMemoryShareState)
    .mockResolvedValue({ ...verifiedState, sharedIds: [local.id] });
  jest
    .mocked(getFriendMemories)
    .mockRejectedValueOnce(new Error('Ảnh bạn bè chưa tải được'));
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }));
  await screen.findByText('Ảnh bạn bè chưa tải được');
  let finish!: () => void;
  jest.mocked(getMemoryShareState).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ ...verifiedState, sharedIds: [local.id] });
      }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Của tôi' }));
  expect(
    screen.getByRole('button', { name: 'Quyền xem: Bạn bè' }),
  ).toBeEnabled();
  await act(async () => finish());
});

it('does not reuse a pre-save sharing snapshot for a newly published photo', async () => {
  await openMine();
  let stale!: () => void;
  jest.mocked(getMemoryShareState).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        stale = () => resolve(verifiedState);
      }),
  );
  act(() => appStateChanged('background'));
  await act(async () => appStateChanged('active'));
  fireEvent.press(screen.getByRole('button', { name: 'Mở máy ảnh' }));
  act(() =>
    jest.mocked(MemoryCapture).mock.lastCall![0].onPhoto({
      uri: 'file:///new.jpg',
      mimeType: 'image/jpeg',
      aspectRatio: 1,
    }),
  );
  const created: MemoryEntry = {
    ...local,
    id: 'new',
    photoFileName: 'new.jpg',
    text: 'New shared photo',
    visibility: 'friends',
  };
  jest.mocked(createMemory).mockResolvedValueOnce(created);
  let publish!: () => void;
  jest.mocked(shareMemory).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        publish = resolve;
      }),
  );
  let saving!: Promise<void>;
  act(() => {
    saving = jest.mocked(MemoryEditor).mock.lastCall![0].onSave({
      dateKey: created.dateKey,
      text: created.text,
      photoUri: 'file:///new.jpg',
      photoChange: 'replace',
      visibility: 'friends',
    });
  });
  await waitFor(() => expect(shareMemory).toHaveBeenCalled());
  await act(async () => stale());
  jest.mocked(readMemories).mockResolvedValue([local, created]);
  jest
    .mocked(synchronizeMemories)
    .mockResolvedValue({ entries: [local, created], synced: true });
  let latest!: () => void;
  jest.mocked(getMemoryShareState).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        latest = () => resolve({ ...verifiedState, sharedIds: [created.id] });
      }),
  );
  await act(async () => {
    publish();
    await saving;
  });
  expect(screen.getByText('New shared photo')).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Quyền xem: Chỉ mình tôi' }),
  ).toBeNull();
  expect(
    screen.getAllByRole('button', { name: 'Quyền xem: Đang kiểm tra' }),
  ).toHaveLength(2);
  await act(async () => latest());
  expect(
    screen.getByRole('button', { name: 'Quyền xem: Bạn bè' }),
  ).toBeTruthy();
});

it('defaults newly captured photos to Friends and preserves private visibility when editing', async () => {
  await openMine();
  fireEvent.press(screen.getByRole('button', { name: 'Mở máy ảnh' }));
  act(() =>
    jest.mocked(MemoryCapture).mock.lastCall![0].onPhoto({
      uri: 'file:///new.jpg',
      mimeType: 'image/jpeg',
      aspectRatio: 1,
    }),
  );
  expect(jest.mocked(MemoryEditor).mock.lastCall![0]).toMatchObject({
    visible: true,
    entry: null,
    initialVisibility: 'friends',
  });
  act(() => jest.mocked(MemoryEditor).mock.lastCall![0].onClose());
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  fireEvent.press(
    await screen.findByRole('button', { name: /^Sửa ký ức ngày/ }),
  );
  expect(jest.mocked(MemoryEditor).mock.lastCall![0]).toMatchObject({
    visible: true,
    entry: local,
    initialVisibility: 'private',
  });
});

const friendPhoto = {
  id: 'friend-photo',
  ownerId: 'u2',
  ownerName: 'An',
  dateKey: '2026-10-19',
  sharedAt: Date.parse('2026-10-19T01:00:00Z'),
  text: 'Ảnh của An',
  photoUrl: 'https://example.com/friend.jpg',
};

it('keeps only Friends-tab management and waits for the feed with one inline loading indicator', async () => {
  await openMine();
  expect(screen.queryByRole('button', { name: 'Quản lý bạn bè' })).toBeNull();
  let finishFeed!: () => void;
  jest.mocked(getFriendMemories).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFeed = () => resolve({ items: [friendPhoto], nextOffset: null });
      }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }));
  await waitFor(() => expect(getFriendMemories).toHaveBeenCalled());
  expect(screen.getByRole('button', { name: 'Quản lý bạn bè' })).toBeTruthy();
  expect(screen.queryByText('Chưa có ký ức từ bạn bè')).toBeNull();
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  expect(screen.getByLabelText('Đang tải ký ức bạn bè')).toBeTruthy();
  expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1);
  await act(async () => finishFeed());
  expect(screen.getByText('Ảnh của An')).toBeTruthy();
  expect(screen.queryByLabelText('Đang tải ký ức bạn bè')).toBeNull();
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
});

it('does not reuse an earlier empty feed when returning from My tab', async () => {
  await openMine();
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }));
  await screen.findByText('Chưa có ký ức từ bạn bè');
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Của tôi' }));
  await screen.findByText('Đã đồng bộ theo tài khoản');
  let finishState!: () => void;
  jest.mocked(getMemoryShareState).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishState = () => resolve(verifiedState);
      }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }));
  expect(screen.queryByText('Chưa có ký ức từ bạn bè')).toBeNull();
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  expect(screen.getByLabelText('Đang tải ký ức bạn bè')).toBeTruthy();
  expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1);
  await act(async () => finishState());
  await screen.findByText('Chưa có ký ức từ bạn bè');
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
});

it('keeps the inline indicator until the friend feed finishes after acceptance and pull-to-refresh', async () => {
  await openMine();
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }));
  await screen.findByText('Chưa có ký ức từ bạn bè');
  fireEvent.press(screen.getByRole('button', { name: 'Quản lý bạn bè' }));
  let finishFeed!: () => void;
  jest.mocked(getFriendMemories).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFeed = () => resolve({ items: [friendPhoto], nextOffset: null });
      }),
  );
  let accepting!: Promise<void>;
  act(() => {
    accepting = jest
      .mocked(MemoryFriendsModal)
      .mock.lastCall![0].onChange('accept', 'u2');
  });
  await waitFor(() => expect(getFriendMemories).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Chưa có ký ức từ bạn bè')).toBeNull();
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  expect(screen.getByLabelText('Đang tải ký ức bạn bè')).toBeTruthy();
  await act(async () => {
    finishFeed();
    await accepting;
  });
  expect(screen.getByText('Ảnh của An')).toBeTruthy();
  act(() => jest.mocked(MemoryFriendsModal).mock.lastCall![0].onClose());
  jest.mocked(getFriendMemories).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFeed = () => resolve({ items: [friendPhoto], nextOffset: null });
      }),
  );
  act(() => fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh'));
  await waitFor(() => expect(getFriendMemories).toHaveBeenCalledTimes(3));
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  expect(screen.getByLabelText('Đang tải ký ức bạn bè')).toBeTruthy();
  expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1);
  expect(screen.getByLabelText('Đang tải ký ức bạn bè').props.size).toBe(
    'large',
  );
  const refresh = screen.UNSAFE_getByType(RefreshControl);
  expect(refresh.props.tintColor).toBe('transparent');
  expect(refresh.props.colors).toEqual(['transparent']);
  expect(refresh.props.progressBackgroundColor).toBe('transparent');
  await act(async () => finishFeed());
  expect(screen.queryByLabelText('Đang tải ký ức bạn bè')).toBeNull();
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
});

it('shows a feed error rather than an empty feed and stops loading', async () => {
  await openMine();
  jest
    .mocked(getFriendMemories)
    .mockRejectedValueOnce(new Error('Không tải được ảnh bạn bè'));
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }));
  await screen.findByText('Không tải được ảnh bạn bè');
  expect(screen.queryByText('Chưa có ký ức từ bạn bè')).toBeNull();
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
});
it('shows image decoding feedback until the image loads or fails', async () => {
  await openMine();
  expect(screen.getByLabelText('Đang mở ảnh ký ức')).toBeTruthy();
  fireEvent(screen.getByLabelText(/Ảnh ký ức ngày/), 'load', {
    nativeEvent: { source: { width: 400, height: 600 } },
  });
  expect(screen.queryByLabelText('Đang mở ảnh ký ức')).toBeNull();
  fireEvent(screen.getByLabelText(/Ảnh ký ức ngày/), 'loadStart');
  expect(screen.getByLabelText('Đang mở ảnh ký ức')).toBeTruthy();
  fireEvent(screen.getByLabelText(/Ảnh ký ức ngày/), 'error');
  expect(screen.queryByLabelText('Đang mở ảnh ký ức')).toBeNull();
});
it('shows sharing feedback until server confirmation, then closes without waiting for library sync', async () => {
  await openMine();
  let confirm!: () => void;
  jest.mocked(shareMemory).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        confirm = resolve;
      }),
  );
  let finishSync!: () => void;
  jest.mocked(synchronizeMemories).mockImplementation(
    () =>
      new Promise((resolve) => {
        finishSync = () =>
          resolve({
            entries: [{ ...local, visibility: 'friends' }],
            synced: true,
          });
      }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Quyền xem: Chỉ mình tôi' }),
  );
  fireEvent.press(screen.getByRole('button', { name: /Chọn Bạn bè/ }));
  expect(screen.getByLabelText('Đang chia sẻ ký ức')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Ai có thể xem?' })).toBeTruthy();
  expect(setMemoryVisibility).not.toHaveBeenCalled();
  jest
    .mocked(readMemories)
    .mockResolvedValue([{ ...local, visibility: 'friends' }]);
  await act(async () => confirm());
  await waitFor(() =>
    expect(screen.queryByRole('header', { name: 'Ai có thể xem?' })).toBeNull(),
  );
  expect(shareMemory).toHaveBeenCalledWith('u1', 'Asher', local);
  expect(
    screen.getByRole('button', { name: 'Quyền xem: Bạn bè' }),
  ).toBeTruthy();
  expect(screen.getByLabelText('Đang đồng bộ ký ức')).toBeTruthy();
  await act(async () => finishSync());
});
it('keeps sharing failures visible and restores the option for retry', async () => {
  await openMine();
  jest.mocked(shareMemory).mockRejectedValueOnce(new Error('Upload failed'));
  fireEvent.press(
    screen.getByRole('button', { name: 'Quyền xem: Chỉ mình tôi' }),
  );
  fireEvent.press(screen.getByRole('button', { name: /Chọn Bạn bè/ }));
  expect(await screen.findAllByText('Upload failed')).not.toHaveLength(0);
  expect(screen.getByRole('button', { name: /Chọn Bạn bè/ })).toBeEnabled();
  expect(screen.queryByLabelText('Đang chia sẻ ký ức')).toBeNull();
  expect(setMemoryVisibility).not.toHaveBeenCalled();
});

it('keeps a new-memory sharing failure visible when the timeline automatically loads', async () => {
  jest.mocked(getMemoryShareState).mockResolvedValue(verifiedState);
  jest.mocked(createMemory).mockResolvedValue(local);
  jest.mocked(shareMemory).mockRejectedValueOnce(new Error('Upload failed'));
  render(<MemoryScreen />);
  await waitFor(() => expect(synchronizeMemories).toHaveBeenCalled());
  act(() =>
    jest.mocked(MemoryCapture).mock.lastCall![0].onPhoto({
      uri: 'file:///new.jpg',
      mimeType: 'image/jpeg',
      aspectRatio: 1,
    }),
  );
  jest.mocked(readMemories).mockResolvedValue([local]);
  jest
    .mocked(synchronizeMemories)
    .mockResolvedValue({ entries: [local], synced: true });
  await act(async () =>
    jest.mocked(MemoryEditor).mock.lastCall![0].onSave({
      dateKey: local.dateKey,
      text: local.text,
      photoUri: 'file:///new.jpg',
      photoChange: 'replace',
      visibility: 'friends',
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Xem ký ức Của tôi' }),
    ).toBeTruthy(),
  );
  expect(screen.getByText('Đã lưu riêng trên máy. Upload failed')).toBeTruthy();
  act(() =>
    useAuthStore
      .getState()
      .setUser({ uid: 'u2', email: null, displayName: null }),
  );
  await waitFor(() =>
    expect(
      screen.queryByText('Đã lưu riêng trên máy. Upload failed'),
    ).toBeNull(),
  );
});
it('coalesces overlapping loads and retains one trailing server refresh', async () => {
  let changed!: () => void;
  jest.mocked(observeOwnMemories).mockImplementation((_uid, callback) => {
    changed = callback;
    return () => {};
  });
  let finish!: () => void;
  jest.mocked(synchronizeMemories).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ entries: [], synced: true });
      }),
  );
  render(<MemoryScreen />);
  await waitFor(() => expect(synchronizeMemories).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  await act(async () => {
    changed();
    changed();
  });
  expect(synchronizeMemories).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  await waitFor(() => expect(synchronizeMemories).toHaveBeenCalledTimes(2));
});

it('does not apply a sharing completion to a different signed-in account', async () => {
  await openMine();
  let finish!: () => void;
  jest.mocked(shareMemory).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Quyền xem: Chỉ mình tôi' }),
  );
  fireEvent.press(screen.getByRole('button', { name: /Chọn Bạn bè/ }));
  act(() =>
    useAuthStore.setState({
      user: { uid: 'other', email: 'b@example.com', displayName: null },
    }),
  );
  await act(async () => finish());
  expect(setMemoryVisibility).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Đang chia sẻ ký ức')).toBeNull();
});
it('shows feedback and waits for confirmed revocation before becoming private', async () => {
  await openMine();
  jest
    .mocked(getMemoryShareState)
    .mockResolvedValue({ ...verifiedState, sharedIds: ['one'] });
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }));
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Của tôi' }));
  fireEvent.press(
    await screen.findByRole('button', { name: 'Quyền xem: Bạn bè' }),
  );
  let finish!: () => void;
  jest.mocked(unshareMemory).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.press(screen.getByRole('button', { name: /Chọn Chỉ mình tôi/ }));
  expect(screen.getByLabelText('Đang chuyển ký ức về riêng tư')).toBeTruthy();
  expect(setMemoryVisibility).not.toHaveBeenCalled();
  await act(async () => finish());
  await waitFor(() =>
    expect(screen.queryByRole('header', { name: 'Ai có thể xem?' })).toBeNull(),
  );
  expect(setMemoryVisibility).toHaveBeenCalledWith('u1', 'one', 'private');
});

it('keeps the confirmed sharing result when a pre-confirmation state refresh arrives late', async () => {
  await openMine();
  let confirm!: () => void;
  jest.mocked(shareMemory).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        confirm = resolve;
      }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Quyền xem: Chỉ mình tôi' }),
  );
  fireEvent.press(screen.getByRole('button', { name: /Chọn Bạn bè/ }));
  let stale!: () => void;
  jest.mocked(getMemoryShareState).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        stale = () => resolve(verifiedState);
      }),
  );
  act(() => appStateChanged('background'));
  await act(async () => appStateChanged('active'));
  jest
    .mocked(readMemories)
    .mockResolvedValue([{ ...local, visibility: 'friends' }]);
  jest.mocked(synchronizeMemories).mockResolvedValue({
    entries: [{ ...local, visibility: 'friends' }],
    synced: true,
  });
  await act(async () => confirm());
  await screen.findByRole('button', { name: 'Quyền xem: Bạn bè' });
  await act(async () => stale());
  expect(
    screen.getByRole('button', { name: 'Quyền xem: Bạn bè' }),
  ).toBeTruthy();
});

it('does not fetch the friends feed when pulling to refresh own memories', async () => {
  await openMine();
  await act(async () =>
    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh'),
  );
  expect(getFriendMemories).not.toHaveBeenCalled();
});
it('rechecks sharing state if it was unknown when confirmed revocation began', async () => {
  await openMine();
  jest
    .mocked(getMemoryShareState)
    .mockResolvedValue({ ...verifiedState, sharedIds: ['one'] });
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }));
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Của tôi' }));
  fireEvent.press(
    await screen.findByRole('button', { name: 'Quyền xem: Bạn bè' }),
  );
  let stale!: () => void;
  jest
    .mocked(getMemoryShareState)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          stale = () => resolve({ ...verifiedState, sharedIds: ['one'] });
        }),
    )
    .mockResolvedValue(verifiedState);
  act(() => appStateChanged('background'));
  await act(async () => appStateChanged('active'));
  fireEvent.press(screen.getByRole('button', { name: /Chọn Chỉ mình tôi/ }));
  await screen.findByRole('button', { name: 'Quyền xem: Chỉ mình tôi' });
  await act(async () => stale());
  expect(
    screen.getByRole('button', { name: 'Quyền xem: Chỉ mình tôi' }),
  ).toBeEnabled();
});

it('allows owners to edit private text even when sharing state is unavailable', async () => {
  jest.mocked(readMemories).mockResolvedValue([local]);
  jest
    .mocked(synchronizeMemories)
    .mockResolvedValue({ entries: [local], synced: true });
  // Default sharing mock rejects verification, as for an unverified owner.
  render(<MemoryScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  const edit = await screen.findByRole('button', { name: /^Sửa ký ức ngày/ });
  expect(edit).toBeEnabled();
  fireEvent.press(edit);
  await waitFor(() =>
    expect(jest.mocked(MemoryEditor).mock.lastCall?.[0]).toMatchObject({
      visible: true,
      entry: local,
    }),
  );
});

it('stops showing checking after a failed state request and lets the owner retry', async () => {
  jest.mocked(readMemories).mockResolvedValue([local]);
  jest
    .mocked(synchronizeMemories)
    .mockResolvedValue({ entries: [local], synced: true });
  jest
    .mocked(getMemoryShareState)
    .mockRejectedValue(new Error('Chưa đọc được danh sách chia sẻ.'));
  // A network/protocol failure is not an email-verification failure.
  render(<MemoryScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  expect(
    await screen.findByRole('button', { name: 'Quyền xem: Chưa xác định' }),
  ).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: 'Thử kết nối chia sẻ' }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Quyền xem: Đang kiểm tra' }),
  ).toBeNull();
  jest.mocked(getMemoryShareState).mockResolvedValue(verifiedState);
  fireEvent.press(
    screen.getByRole('button', { name: 'Quyền xem: Chưa xác định' }),
  );
  expect(
    await screen.findByRole('button', { name: 'Quyền xem: Chỉ mình tôi' }),
  ).toBeEnabled();
});
it('shows checking only while the state request is actually pending', async () => {
  jest.mocked(readMemories).mockResolvedValue([local]);
  jest
    .mocked(synchronizeMemories)
    .mockResolvedValue({ entries: [local], synced: true });
  let finish!: () => void;
  jest.mocked(getMemoryShareState).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(verifiedState);
      }),
  );
  render(<MemoryScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  expect(
    await screen.findByRole('button', { name: 'Quyền xem: Đang kiểm tra' }),
  ).toBeDisabled();
  await act(async () => finish());
  await screen.findByRole('button', { name: 'Quyền xem: Chỉ mình tôi' });
});

it('opens the tapped photo at full size and closes back to the timeline', async () => {
  await openMine();
  fireEvent.press(screen.getByRole('button', { name: /Mở ảnh ký ức ngày/ }));
  const enlarged = screen.getByLabelText(/^Ảnh phóng lớn:/);
  expect(enlarged.props.source.uri).toBe(`file:///${local.photoFileName}`);
  fireEvent(enlarged, 'load', {
    nativeEvent: { source: { width: 400, height: 600 } },
  });
  expect(screen.queryByLabelText('Đang mở ảnh lớn')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Đóng ảnh' }));
  expect(screen.queryByLabelText(/^Ảnh phóng lớn:/)).toBeNull();
});

it('covers the live camera immediately while preparing the captured photo', async () => {
  render(<MemoryScreen />);
  await act(async () => {});
  const calls = jest.mocked(MemoryCapture).mock.calls;
  const onCapturingChange = calls[calls.length - 1][0].onCapturingChange;
  const timelineButton = screen.getByRole('button', { name: 'Xem dòng ký ức' });
  act(() => onCapturingChange(true));
  expect(
    screen.getByRole('header', { name: 'Đang chuẩn bị ảnh…' }),
  ).toBeTruthy();
  expect(timelineButton).toBeDisabled();
  act(() => onCapturingChange(false));
  expect(screen.queryByText('Đang chuẩn bị ảnh…')).toBeNull();
});

it('deactivates capture as soon as the app becomes inactive or backgrounded', () => {
  const view = render(<MemoryScreen />);
  const captureActive = () => {
    const calls = jest.mocked(MemoryCapture).mock.calls;
    return calls[calls.length - 1][0].active;
  };
  expect(captureActive()).toBe(true);
  act(() => appStateChanged('inactive'));
  expect(captureActive()).toBe(false);
  act(() => appStateChanged('background'));
  expect(captureActive()).toBe(false);
  act(() => appStateChanged('active'));
  expect(captureActive()).toBe(true);
  view.unmount();
});

it('opens the selected timeline photo and pages through only entries with photos', async () => {
  const entries = [
    local,
    { ...local, id: 'no-photo', photoFileName: null },
    { ...local, id: 'last', photoFileName: 'last.jpg', text: 'Ảnh cuối' },
  ];
  jest.mocked(readMemories).mockResolvedValue(entries);
  jest.mocked(synchronizeMemories).mockResolvedValue({ entries, synced: true });
  jest.mocked(getMemoryShareState).mockResolvedValue(verifiedState);
  render(<MemoryScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  await screen.findByText('Đã đồng bộ theo tài khoản');
  fireEvent.press(
    screen.getAllByRole('button', { name: /Mở ảnh ký ức ngày/ })[1],
  );
  expect(screen.getByLabelText(/^Ảnh phóng lớn:/).props.source.uri).toBe(
    'file:///last.jpg',
  );
  expect(screen.getByTestId('memory-photo-caption')).toHaveTextContent(
    'Ảnh cuối',
  );
  expect(screen.getByText('2 / 2')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Ảnh trước' }));
  expect(screen.getByLabelText(/^Ảnh phóng lớn:/).props.source.uri).toBe(
    `file:///${local.photoFileName}`,
  );
});

it('opens Friends automatically when the account already has accepted friends', async () => {
  jest.mocked(getMemoryShareState).mockResolvedValue({
    ...verifiedState,
    friends: [{ uid: 'friend', email: 'friend@example.com', name: 'Friend' }],
  });
  render(<MemoryScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }).props
        .accessibilityState.selected,
    ).toBe(true),
  );
  await waitFor(() =>
    expect(getFriendMemories).toHaveBeenCalledWith('u1', 'Asher'),
  );
});
it('opens Mine when there are no accepted friends, even if invitations exist', async () => {
  jest.mocked(getMemoryShareState).mockResolvedValue({
    ...verifiedState,
    incoming: [{ uid: 'friend', email: 'friend@example.com', name: 'Friend' }],
  });
  render(<MemoryScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  await waitFor(() => expect(getMemoryShareState).toHaveBeenCalled());
  expect(
    screen.getByRole('button', { name: 'Xem ký ức Của tôi' }).props
      .accessibilityState.selected,
  ).toBe(true);
  expect(getFriendMemories).not.toHaveBeenCalled();
});
it('does not override a tab chosen manually while checking friends', async () => {
  let finish!: (state: typeof verifiedState) => void;
  jest.mocked(getMemoryShareState).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<MemoryScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  fireEvent.press(screen.getByRole('button', { name: 'Xem ký ức Của tôi' }));
  await act(async () =>
    finish({
      ...verifiedState,
      friends: [{ uid: 'friend', email: 'f@example.com', name: 'Friend' }],
    } as never),
  );
  expect(
    screen.getByRole('button', { name: 'Xem ký ức Của tôi' }).props
      .accessibilityState.selected,
  ).toBe(true);
});

it('checks friends as soon as Memories opens in capture mode and caches the result', async () => {
  jest.mocked(getMemoryShareState).mockResolvedValue({
    ...verifiedState,
    friends: [{ uid: 'friend', email: 'f@example.com', name: 'Friend' }],
  });
  render(<MemoryScreen />);
  await waitFor(() =>
    expect(getMemoryShareState).toHaveBeenCalledWith('u1', 'Asher'),
  );
  expect(screen.getByRole('button', { name: 'Xem dòng ký ức' })).toBeTruthy();
  expect(getFriendMemories).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(writeMemoryFriendsPreference).toHaveBeenCalledWith('u1', true),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  expect(
    screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }).props
      .accessibilityState.selected,
  ).toBe(true);
});
it('opens Friends from per-account cache while offline on the next visit', async () => {
  jest.mocked(readMemoryFriendsPreference).mockResolvedValue(true);
  render(<MemoryScreen />);
  await waitFor(() =>
    expect(readMemoryFriendsPreference).toHaveBeenCalledWith('u1'),
  );
  await act(async () => {});
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  expect(
    screen.getByRole('button', { name: 'Xem ký ức Bạn bè' }).props
      .accessibilityState.selected,
  ).toBe(true);
});
it('does not let a slow old cache override a fresh server answer with no friends', async () => {
  let finish!: (value: boolean) => void;
  jest.mocked(readMemoryFriendsPreference).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  jest.mocked(getMemoryShareState).mockResolvedValue(verifiedState);
  render(<MemoryScreen />);
  await waitFor(() =>
    expect(writeMemoryFriendsPreference).toHaveBeenCalledWith('u1', false),
  );
  await act(async () => finish(true));
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  expect(
    screen.getByRole('button', { name: 'Xem ký ức Của tôi' }).props
      .accessibilityState.selected,
  ).toBe(true);
});

it('does not fetch the feed from a superseded Friends request when refocusing into capture', async () => {
  jest.mocked(getMemoryShareState).mockResolvedValue({
    ...verifiedState,
    friends: [{ uid: 'friend', email: 'f@example.com', name: 'Friend' }],
  });
  const view = render(<MemoryScreen />);
  await waitFor(() =>
    expect(writeMemoryFriendsPreference).toHaveBeenCalledWith('u1', true),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Xem dòng ký ức' }));
  await waitFor(() => expect(getFriendMemories).toHaveBeenCalled());
  mockFocused = false;
  view.rerender(<MemoryScreen />);
  jest.mocked(getFriendMemories).mockClear();
  mockFocused = true;
  view.rerender(<MemoryScreen />);
  await act(async () => {});
  expect(screen.getByRole('button', { name: 'Xem dòng ký ức' })).toBeTruthy();
  expect(getFriendMemories).not.toHaveBeenCalled();
});
