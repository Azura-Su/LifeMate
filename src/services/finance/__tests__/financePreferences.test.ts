import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocFromServer, setDoc } from '@react-native-firebase/firestore';
import {
  readFinancePreferences,
  writeFinancePreferences,
  type FinancePreferences,
} from '../financePreferences';
import {
  resetFirestoreMock,
  seedFinancePreferencesMock,
} from '../../../testing/firestoreMock';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../../types/finance';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../../testing/firestoreMock'),
);

const preferences: FinancePreferences = {
  incomeCategories: [...INCOME_CATEGORIES, 'Làm thêm'],
  expenseCategories: [...EXPENSE_CATEGORIES, 'Thú cưng'],
  templates: [
    {
      id: 'coffee-default',
      name: 'Cà phê 30.000đ',
      type: 'expense',
      amount: 30000,
      category: 'Ăn uống',
      note: 'Cà phê',
    },
    {
      id: 'pet-food',
      name: 'Thức ăn cho mèo',
      type: 'expense',
      amount: 80000,
      category: 'Thú cưng',
      note: 'Hạt cho mèo',
    },
  ],
};

const cacheKey = 'lifemate:finance-preferences:v1:u1';

beforeEach(async () => {
  await AsyncStorage.clear();
  resetFirestoreMock();
  jest.clearAllMocks();
});

it('restores custom categories and templates on another device for the same account', async () => {
  await expect(
    writeFinancePreferences('u1', preferences),
  ).resolves.toMatchObject({
    synced: true,
  });
  await AsyncStorage.clear();

  await expect(readFinancePreferences('u1')).resolves.toEqual({
    preferences,
    synced: true,
  });
  await expect(readFinancePreferences('u2')).resolves.toMatchObject({
    preferences: {
      expenseCategories: expect.not.arrayContaining(['Thú cưng']),
      templates: expect.not.arrayContaining([
        expect.objectContaining({ id: 'pet-food' }),
      ]),
    },
  });
});

it('keeps offline changes locally and uploads them on the next refresh', async () => {
  jest.mocked(setDoc).mockRejectedValueOnce(new Error('Offline'));
  await expect(
    writeFinancePreferences('u1', preferences),
  ).resolves.toMatchObject({
    synced: false,
  });
  expect(await AsyncStorage.getItem(cacheKey)).toMatch(/^lifemate:aes-gcm:v1:/);

  await expect(readFinancePreferences('u1')).resolves.toEqual({
    preferences,
    synced: true,
  });
  expect(jest.mocked(setDoc)).toHaveBeenCalledTimes(2);
});

it('replays offline additions over settings changed on another device', async () => {
  seedFinancePreferencesMock('u1', {
    incomeCategories: [...INCOME_CATEGORIES, 'Đầu tư'],
    expenseCategories: [...EXPENSE_CATEGORIES],
    templates: [
      preferences.templates[0],
      {
        id: 'rent',
        name: 'Tiền nhà',
        type: 'expense',
        amount: 5000000,
        category: 'Nhà cửa',
        note: 'Tiền thuê nhà',
      },
    ],
  });
  jest.mocked(getDocFromServer).mockRejectedValueOnce(new Error('Offline'));
  await expect(
    writeFinancePreferences('u1', preferences),
  ).resolves.toMatchObject({
    synced: false,
  });

  const result = await readFinancePreferences('u1');

  expect(result.synced).toBe(true);
  expect(result.preferences.incomeCategories).toContain('Đầu tư');
  expect(result.preferences.expenseCategories).toContain('Thú cưng');
  expect(result.preferences.templates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'pet-food' }),
      expect.objectContaining({ id: 'rent' }),
    ]),
  );
});

it('migrates existing device preferences to Firestore', async () => {
  await AsyncStorage.setItem(cacheKey, JSON.stringify(preferences));

  await expect(readFinancePreferences('u1')).resolves.toEqual({
    preferences,
    synced: true,
  });
  expect(jest.mocked(setDoc)).toHaveBeenCalledTimes(1);
});

it('merges old device settings with settings already stored in the cloud', async () => {
  const cloudPreferences = {
    incomeCategories: [...INCOME_CATEGORIES, 'Đầu tư'],
    expenseCategories: [...EXPENSE_CATEGORIES],
    templates: [preferences.templates[0]],
  };
  await AsyncStorage.setItem(cacheKey, JSON.stringify(preferences));
  seedFinancePreferencesMock('u1', cloudPreferences);

  const result = await readFinancePreferences('u1');

  expect(result.synced).toBe(true);
  expect(result.preferences.incomeCategories).toContain('Đầu tư');
  expect(result.preferences.incomeCategories).toContain('Làm thêm');
  expect(result.preferences.expenseCategories).toContain('Thú cưng');
  expect(result.preferences.templates).toContainEqual(
    expect.objectContaining({ id: 'pet-food' }),
  );
});

it('uses cached settings and marks them unsynced when Firestore cannot be read', async () => {
  await AsyncStorage.setItem(cacheKey, JSON.stringify(preferences));
  jest.mocked(getDocFromServer).mockRejectedValueOnce(new Error('Offline'));

  await expect(readFinancePreferences('u1')).resolves.toEqual({
    preferences,
    synced: false,
  });
});

it('does not report default settings as synced if access to Firestore failed', async () => {
  jest
    .mocked(getDocFromServer)
    .mockRejectedValueOnce(new Error('Permission denied'));

  await expect(readFinancePreferences('u1')).resolves.toMatchObject({
    synced: false,
  });
});
