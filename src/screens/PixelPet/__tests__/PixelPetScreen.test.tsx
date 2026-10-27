import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PixelPetScreen } from '../PixelPetScreen';
import { callPixelPet } from '../../../services/pixelPet/pixelPetApi';
import { useAuthStore } from '../../../store/authStore';

jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../../../services/pixelPet/pixelPetApi', () => ({
  callPixelPet: jest.fn(),
  newPixelPetAction: () => '11111111-1111-4111-8111-111111111111',
}));

const call = callPixelPet as jest.Mock;
const navigation = { navigate: jest.fn() } as never;
const base = {
  rollsLeft: 3,
  restoresLeft: 3,
  reservation: null,
  pet: null,
  availability: { total: 15, owned: 4, reserved: 0 },
  now: Date.now(),
};

beforeEach(() => {
  call.mockReset();
  useAuthStore.setState({ user: { uid: 'u1' } as never });
});

it('rolls, shows the reservation and confirms with its id', async () => {
  call.mockResolvedValueOnce({ ...base, status: 'none' });
  render(<PixelPetScreen navigation={navigation} route={{} as never} />);
  const roll = await screen.findByText('Chọn ngẫu nhiên (còn 3 lượt)');
  call.mockResolvedValueOnce({
    ...base,
    status: 'reserved',
    rollsLeft: 2,
    reservation: { id: 'res-1', speciesId: 'phoenix', expiresAt: base.now + 300000 },
  });
  fireEvent.press(roll);
  expect(await screen.findByText('Phượng Hoàng')).toBeTruthy();
  fireEvent.press(screen.getByText('Nhận nuôi'));
  await waitFor(() =>
    expect(call).toHaveBeenLastCalledWith('u1', {
      type: 'confirm',
      actionId: '11111111-1111-4111-8111-111111111111',
      reservationId: 'res-1',
    }),
  );
});

it('says when all 15 pets are adopted and offers no roll', async () => {
  call.mockResolvedValueOnce({
    ...base,
    status: 'none',
    availability: { total: 15, owned: 15, reserved: 0 },
  });
  render(<PixelPetScreen navigation={navigation} route={{} as never} />);
  expect(await screen.findByText('Tất cả 15 linh thú đã được nhận nuôi.')).toBeTruthy();
  expect(screen.queryByText(/Chọn ngẫu nhiên/)).toBeNull();
});

it('shows server progression and allows one care per day', async () => {
  call.mockResolvedValueOnce({
    ...base,
    status: 'owned',
    pet: {
      speciesId: 'nine_tail_fox',
      adoptionId: 'a',
      adoptedAt: 1,
      totalExp: 95,
      caredToday: true,
      level: 3,
      stage: 'hatchling',
      skillTier: 0,
      levelFloorExp: 80,
      nextLevelExp: 150,
    },
    todayEffects: { eat: 2 },
  });
  render(<PixelPetScreen navigation={navigation} route={{} as never} />);
  expect(await screen.findByText('Lv 3 · Ấu thể · Tinh nghịch')).toBeTruthy();
  expect(screen.getByText('95 EXP / 150')).toBeTruthy();
  expect(screen.getByText('Được cho ăn ×2')).toBeTruthy();
  expect(screen.getByText('Đã chăm sóc hôm nay')).toBeTruthy();
});
