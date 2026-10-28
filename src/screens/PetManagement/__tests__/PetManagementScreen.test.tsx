import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { PetManagementScreen } from '../PetManagementScreen';
import {
  listManagedPets,
  revokeManagedPet,
  type ManagedPet,
} from '../../../services/admin/petManagement';
import { ADMIN_EMAIL, ADMIN_UID } from '../../../config/userAdmin';
import { useAuthStore } from '../../../store/authStore';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParams } from '../../../navigation/types';

let mockActive = true;
jest.mock('../../../hooks/useScreenActive', () => ({
  useScreenActive: () => mockActive,
}));
jest.mock('../../../services/admin/petManagement', () => ({
  listManagedPets: jest.fn(),
  revokeManagedPet: jest.fn(),
}));
jest.mock('../../../services/pixelPet/pixelPetApi', () => ({
  newPixelPetAction: () => 'action',
  invalidateOwnedPixelPet: jest.fn(),
}));
jest.mock('../../../components/DialogModal', () => ({
  DialogModal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
const pet: ManagedPet = {
  speciesId: 'phoenix',
  status: 'owned',
  holder: { uid: 'a', name: 'Alice', email: 'alice@example.com' },
  reservedUntil: null,
  adoption: {
    id: 'adoption',
    adoptedAt: 1,
    totalExp: 150,
    level: 4,
    stage: 'juvenile',
  },
};
const inventory = {
  pets: [
    pet,
    {
      ...pet,
      speciesId: 'qilin',
      status: 'available',
      holder: null,
      adoption: null,
    },
  ],
  serverTime: 1,
};
const props = {
  navigation: { navigate: jest.fn() },
  route: {},
} as unknown as BottomTabScreenProps<MainTabParams, 'PetManagement'>;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listManagedPets).mockReset();
  jest.mocked(revokeManagedPet).mockReset();
  mockActive = true;
  useAuthStore
    .getState()
    .setUser({ uid: ADMIN_UID, email: ADMIN_EMAIL, displayName: 'Admin' });
  jest.mocked(listManagedPets).mockResolvedValue(inventory as never);
});
it('guards non-admin and shows owner, level, local search and available pets', async () => {
  const view = render(<PetManagementScreen {...props} />);
  expect(await screen.findByText('alice@example.com')).toBeTruthy();
  expect(screen.getByText('Cấp 4 · 150 EXP')).toBeTruthy();
  fireEvent.changeText(
    screen.getByLabelText('Tìm linh thú hoặc người sở hữu'),
    'alice',
  );
  expect(screen.queryByText('Kỳ Lân')).toBeNull();
  expect(listManagedPets).toHaveBeenCalledTimes(1);
  act(() =>
    useAuthStore
      .getState()
      .setUser({ uid: 'ordinary', email: null, displayName: null }),
  );
  view.rerender(<PetManagementScreen {...props} />);
  expect(
    screen.getByText('Bạn không có quyền truy cập màn hình này.'),
  ).toBeTruthy();
  expect(screen.queryByText('alice@example.com')).toBeNull();
});
it('requires confirmation, blocks double taps and reuses the action ID on retry', async () => {
  jest
    .mocked(revokeManagedPet)
    .mockRejectedValueOnce(new Error('Mất kết nối'))
    .mockResolvedValueOnce({ pets: [], serverTime: 2 });
  render(<PetManagementScreen {...props} />);
  fireEvent.press(await screen.findByLabelText('Thu hồi Phượng Hoàng'));
  expect(revokeManagedPet).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Hủy'));
  expect(revokeManagedPet).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Thu hồi Phượng Hoàng'));
  fireEvent.press(screen.getByText('Xác nhận thu hồi'));
  fireEvent.press(screen.getByRole('button', { name: 'Xác nhận thu hồi' }));
  expect(await screen.findByText('Mất kết nối')).toBeTruthy();
  expect(revokeManagedPet).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('Xác nhận thu hồi'));
  await waitFor(() =>
    expect(screen.queryByText('alice@example.com')).toBeNull(),
  );
  expect(
    jest.mocked(revokeManagedPet).mock.calls.map(([input]) => input),
  ).toEqual([
    {
      targetUid: 'a',
      speciesId: 'phoenix',
      adoptionId: 'adoption',
      actionId: 'action',
    },
    {
      targetUid: 'a',
      speciesId: 'phoenix',
      adoptionId: 'adoption',
      actionId: 'action',
    },
  ]);
});
it('aborts and discards responses/dialogs after leaving the page', async () => {
  let resolve!: (value: never) => void;
  jest.mocked(revokeManagedPet).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = render(<PetManagementScreen {...props} />);
  fireEvent.press(await screen.findByLabelText('Thu hồi Phượng Hoàng'));
  fireEvent.press(screen.getByText('Xác nhận thu hồi'));
  const signal = jest.mocked(revokeManagedPet).mock.calls[0][1];
  mockActive = false;
  view.rerender(<PetManagementScreen {...props} />);
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve({ pets: [], serverTime: 2 } as never));
  expect(screen.queryByText('Đã thu hồi linh thú.')).toBeNull();
  expect(screen.queryByText('Xác nhận thu hồi')).toBeNull();
});

it('filters the full list by status chip and shows per-status counts', async () => {
  render(<PetManagementScreen {...props} />);
  expect(await screen.findByText('alice@example.com')).toBeTruthy();
  expect(screen.getByText(/^Tất cả \d+$/)).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Lọc Còn trống'));
  expect(screen.queryByText('alice@example.com')).toBeNull();
  expect(screen.getByText('Kỳ Lân Hỏa')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Lọc Có chủ'));
  expect(screen.getByText('alice@example.com')).toBeTruthy();
  expect(screen.queryByText('Kỳ Lân Hỏa')).toBeNull();
});
