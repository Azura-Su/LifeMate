import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import { PetsScreen } from '../PetsScreen';
import { usePet } from '../usePet';
import { generatePetDNA } from '../../../services/pets/petGenetics';
import { useAuthStore } from '../../../store/authStore';
jest.mock('../usePet', () => ({ usePet: jest.fn() }));
jest.mock('../PetViewport', () => ({ PetViewport: () => null }));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 12, left: 0, right: 0 }),
}));
jest.mock('../../../services/pets/petGenetics', () => ({
  generatePetDNA: jest.fn(async (species, seed) => ({
    seed,
    species,
    parts: {},
    skill: { effectId: 'light', variant: 0 },
    animation: {
      idle: { clipId: 'breathe', variant: 0 },
      interaction: { clipId: 'happy', variant: 0 },
    },
  })),
  newPetSeed: jest.fn(async () => '1'.repeat(32)),
  petDNAHash: jest.fn(async () => 'a'.repeat(64)),
  petAppearanceHash: jest.fn(async () => 'b'.repeat(64)),
}));
const save = jest.fn(async (_pet: unknown) => {}),
  remove = jest.fn(async () => {}),
  rename = jest.fn(async () => {});
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore
    .getState()
    .setUser({ uid: 'a', email: 'a@example.invalid', displayName: 'An' });
  jest.mocked(usePet).mockReturnValue({
    uid: 'a',
    epoch: useAuthStore.getState().sessionEpoch,
    active: true,
    loading: false,
    syncing: false,
    error: null,
    cache: { schemaVersion: 1, slot: null, pending: null, draft: null },
    save,
    remove,
    rename,
    retry: jest.fn(),
  } as never);
});
it('lets the user choose up to three species, generate a draft and save exactly that pet', async () => {
  render(
    <PetsScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Tạo thú cưng' }));
  fireEvent.press(screen.getByRole('checkbox', { name: /Mèo/ }));
  fireEvent.press(screen.getByRole('checkbox', { name: /Thỏ/ }));
  fireEvent.press(screen.getByRole('checkbox', { name: /Cú/ }));
  expect(screen.getByRole('checkbox', { name: /Cáo/ })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Gặp thú cưng của bạn' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Lưu thú cưng' })).toBeTruthy(),
  );
  expect(generatePetDNA).toHaveBeenCalledWith(
    ['cat', 'rabbit', 'owl'],
    '1'.repeat(32),
  );
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Lưu thú cưng' }));
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0]).toMatchObject({
    ownerId: 'a',
    dna: { species: ['cat', 'rabbit', 'owl'] },
  });
});
it('keeps an existing pet, provides deletion and invalidates its old confirmation after account changes', async () => {
  const model = jest.mocked(usePet).mock.results.at(-1)?.value;
  const current = jest.mocked(usePet).getMockImplementation()!();
  const pet = {
    petId: 'pet-a',
    ownerId: 'a',
    name: 'Mây',
    dna: {
      species: ['cat'],
      seed: '1'.repeat(32),
      skill: { effectId: 'light', variant: 0 },
    },
    dnaHash: 'a'.repeat(64),
    appearanceHash: 'b'.repeat(64),
    createdAt: 1,
    updatedAt: 1,
  };
  jest.mocked(usePet).mockReturnValue({
    ...current,
    ...model,
    cache: {
      schemaVersion: 1,
      slot: { pet, revision: 1 },
      pending: null,
      draft: null,
    },
  } as never);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  render(
    <PetsScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Tạo thú cưng' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Xóa thú cưng' }));
  const confirm = alert.mock.calls
    .at(-1)![2]!
    .find((b) => b.text === 'Xóa thú cưng')!;
  useAuthStore.getState().setUser(null);
  await act(async () => {
    confirm.onPress?.();
  });
  expect(remove).not.toHaveBeenCalled();
  alert.mockRestore();
});
it('shows the queued pet when a durable save completes while the screen is inactive', async () => {
  let resolveSave!: () => void;
  save.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
  );
  const view = render(
    <PetsScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Tạo thú cưng' }));
  fireEvent.press(screen.getByRole('checkbox', { name: /Mèo/ }));
  fireEvent.press(screen.getByRole('button', { name: 'Gặp thú cưng của bạn' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Lưu thú cưng' })).toBeTruthy(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thú cưng' }));
  const model = jest.mocked(usePet).getMockImplementation()!();
  const pet = save.mock.calls[0][0];
  const renderScreen = () =>
    view.rerender(
      <PetsScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{} as never}
      />,
    );
  jest.mocked(usePet).mockReturnValue({ ...model, active: false } as never);
  renderScreen();
  await act(async () => {
    resolveSave();
  });
  jest.mocked(usePet).mockReturnValue({
    ...model,
    active: true,
    cache: {
      schemaVersion: 1,
      slot: null,
      draft: pet,
      pending: { type: 'create', pet },
    },
  } as never);
  renderScreen();
  expect(screen.getByText('Mây')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Lưu thú cưng' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Tạo thú cưng' })).toBeNull();
});
