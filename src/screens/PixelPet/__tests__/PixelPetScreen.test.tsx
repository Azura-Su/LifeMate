import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { PixelPetScreen } from '../PixelPetScreen';
import { callPixelPet } from '../../../services/pixelPet/pixelPetApi';
import { useAuthStore } from '../../../store/authStore';
import { PixelPetSprite } from '../PixelPetSprite';
import { StyleSheet } from 'react-native';
import { PetAppearancePreview } from '../PetAppearancePreview';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/src/mock'),
);
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../../../hooks/useScreenActive', () => ({
  useScreenActive: () => true,
}));
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

function effectiveSpriteSize() {
  const sprite = screen.UNSAFE_getByType(PixelPetSprite);
  let scale = 1;
  for (let parent = sprite.parent; parent && parent.type !== PetAppearancePreview; parent = parent.parent) {
    if (typeof parent.type !== 'string') continue;
    const style = StyleSheet.flatten(parent.props.style);
    for (const transform of style?.transform ?? []) {
      if ('scale' in transform && typeof transform.scale === 'number') scale *= transform.scale;
    }
  }
  return sprite.props.size * scale;
}

it('plays a finance movement effect once even after the movement preview was looping', async () => {
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
    todayEffects: { move: 1 },
  });
  render(<PixelPetScreen navigation={navigation} route={{} as never} />);
  await screen.findByText('Hình dạng & khung ngủ');
  const restingSize = effectiveSpriteSize();
  fireEvent.press(await screen.findByRole('button', { name: 'Đi dạo' }));
  expect(effectiveSpriteSize()).toBeCloseTo(restingSize);
  expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({
    loopMovement: true,
    homeMotion: true,
  });
  fireEvent.press(screen.getByText('Vận động ×1'));
  expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({
    clip: 'move',
    loopMovement: false,
  });
  act(() => screen.UNSAFE_getByType(PixelPetSprite).props.onClipEnd());
  expect(effectiveSpriteSize()).toBeCloseTo(restingSize);
  expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({
    clip: 'idle',
    homeMotion: false,
    sleeping: true,
  });
  expect(call).toHaveBeenCalledTimes(1);
});

beforeEach(() => {
  call.mockReset();
  useAuthStore.setState({ user: { uid: 'u1' } as never });
});

it.each(['celestial_stag', 'nine_tail_fox', 'garuda', 'rune_wolf'])(
  'keeps %s at the same detail scale when its first sleep scene unlocks',
  async (speciesId) => {
    const sizes: number[] = [];
    for (const level of [1, 2]) {
      call.mockResolvedValueOnce({
        ...base,
        status: 'owned',
        pet: {
          speciesId, adoptionId: 'first-scene', adoptedAt: 1,
          totalExp: level === 1 ? 0 : 30, caredToday: true,
          level, stage: 'hatchling', skillTier: 0,
          levelFloorExp: level === 1 ? 0 : 30, nextLevelExp: level === 1 ? 30 : 80,
        },
      });
      const view = render(<PixelPetScreen navigation={navigation} route={{} as never} />);
      await screen.findByText('Hình dạng & khung ngủ');
      const restingSize = effectiveSpriteSize();
      sizes.push(restingSize);
      fireEvent.press(screen.getByRole('button', { name: 'Vui vẻ' }));
      expect(effectiveSpriteSize()).toBeCloseTo(restingSize);
      view.unmount();
    }
    // Lv1–2 share both the same stage and art, so unlocking only adds scenery.
    expect(sizes[1]).toBeCloseTo(sizes[0]);
  },
);

it('saves independent unlocked appearance/scene choices while keeping real level and EXP', async () => {
  const pet = { speciesId: 'celestial_stag', adoptionId: 'owned-appearance', adoptedAt: 1, totalExp: 630,
    caredToday: true, level: 8, stage: 'ascended', skillTier: 2, levelFloorExp: 630, nextLevelExp: 800,
    maxUnlockedLevel: 8, appearanceLevel: null, sleepSceneLevel: null };
  call.mockResolvedValueOnce({ ...base, status: 'owned', pet });
  render(<PixelPetScreen navigation={navigation} route={{} as never} />);
  fireEvent.press(await screen.findByText('Hình dạng & khung ngủ'));
  expect(screen.queryByRole('radio', { name: /Hình dạng: Hình dạng Lv 9/ })).toBeNull();
  fireEvent.press(screen.getByRole('radio', { name: 'Hình dạng: Ấu thể, mở ở Lv 1' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Khung ngủ: Vườn suối nhỏ, mở ở Lv 4' }));
  call.mockResolvedValueOnce({ ...base, status: 'owned', pet: { ...pet, appearanceLevel: 1, sleepSceneLevel: 4 } });
  fireEvent.press(screen.getByText('Áp dụng diện mạo'));
  await waitFor(() => expect(call).toHaveBeenLastCalledWith('u1', { type: 'appearance', adoptionId: 'owned-appearance', appearanceLevel: 1, sleepSceneLevel: 4 }));
  await waitFor(() => expect(screen.queryByText('Diện mạo linh thú')).toBeNull());
  expect(call).toHaveBeenLastCalledWith('u1', { type: 'appearance', adoptionId: 'owned-appearance', appearanceLevel: 1, sleepSceneLevel: 4 });
  expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({ level: 1, stage: 'hatchling' });
  expect(screen.getByText(/Lv 8/)).toBeTruthy();
});

it('keeps an unsaved appearance draft on failure and closes it when the account changes', async () => {
  const pet = { speciesId: 'celestial_stag', adoptionId: 'owned-retry', adoptedAt: 1, totalExp: 150,
    caredToday: true, level: 4, stage: 'juvenile', skillTier: 0, levelFloorExp: 150, nextLevelExp: 240 };
  call.mockResolvedValueOnce({ ...base, status: 'owned', pet });
  render(<PixelPetScreen navigation={navigation} route={{} as never} />);
  fireEvent.press(await screen.findByText('Hình dạng & khung ngủ'));
  fireEvent.press(screen.getByRole('radio', { name: 'Hình dạng: Trưởng thành, mở ở Lv 4' }));
  call.mockRejectedValueOnce(new Error('Không kết nối được'));
  fireEvent.press(screen.getByText('Áp dụng diện mạo'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Không kết nối được');
  expect(screen.getByRole('radio', { name: 'Hình dạng: Trưởng thành, mở ở Lv 4' }).props.accessibilityState.selected).toBe(true);
  call.mockResolvedValueOnce({ ...base, status: 'none' });
  act(() => useAuthStore.setState({ user: { uid: 'other' } as never }));
  await waitFor(() => expect(screen.queryByText('Diện mạo linh thú')).toBeNull());
});

it('rolls, shows the reservation and confirms with its id', async () => {
  call.mockResolvedValueOnce({ ...base, status: 'none' });
  render(<PixelPetScreen navigation={navigation} route={{} as never} />);
  const roll = await screen.findByText('Chọn ngẫu nhiên (còn 3 lượt)');
  call.mockResolvedValueOnce({
    ...base,
    status: 'reserved',
    rollsLeft: 2,
    reservation: {
      id: 'res-1',
      speciesId: 'phoenix',
      expiresAt: base.now + 300000,
    },
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
  expect(
    await screen.findByText('Tất cả 15 linh thú đã được nhận nuôi.'),
  ).toBeTruthy();
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

  fireEvent.press(
    screen.getByRole('button', { name: 'Hướng dẫn chăm linh thú' }),
  );
  expect(await screen.findByText('Ghi sổ thu chi trong ngày')).toBeTruthy();
  expect(screen.getAllByText('+10 EXP').length).toBeGreaterThan(0);
  expect(screen.getByText('Lộ trình của Cửu Vĩ Hồ')).toBeTruthy();
  expect(
    screen.getByLabelText('Lv 3, Trang phục Khăn lụa đỏ, đã mở'),
  ).toBeTruthy();
  expect(
    screen.getByLabelText('Lv 5, Kỹ năng Hồ Hỏa Mê Ảnh, chưa mở'),
  ).toBeTruthy();
  expect(screen.queryByText(/Phượng Hoàng/)).toBeNull();
  expect(screen.queryByLabelText(/Lông đuôi ngũ sắc/)).toBeNull();
});

it.each([
  ['phoenix', 'Vỗ cánh'],
  ['nine_tail_fox', 'Đi dạo'],
])(
  'previews %s movement locally without a roll or care request',
  async (speciesId, label) => {
    call.mockResolvedValueOnce({
      ...base,
      status: 'reserved',
      reservation: {
        id: 'res-preview',
        speciesId,
        expiresAt: base.now + 300000,
      },
    });
    render(<PixelPetScreen navigation={navigation} route={{} as never} />);
    fireEvent.press(await screen.findByRole('button', { name: label }));
    expect(screen.UNSAFE_getByType(PixelPetSprite).props).toMatchObject({
      clip: 'move',
      loopMovement: true,
    });
    fireEvent.press(screen.getByRole('button', { name: 'Nghỉ ngơi' }));
    expect(screen.UNSAFE_getByType(PixelPetSprite).props.clip).toBe('idle');
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith('u1', { type: 'sync' });
  },
);
