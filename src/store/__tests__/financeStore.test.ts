import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteDoc } from '@react-native-firebase/firestore';
import * as SecureStore from 'expo-secure-store';
import { useFinanceStore } from '../financeStore';
import {
  addFinanceTransaction,
  financeStorageKey,
  resetFinanceCloudState,
} from '../../services/finance/financeStorage';
import { setEncryptedItem } from '../../services/security/encryptedLocalStorage';
import type { FinanceTransaction } from '../../types/finance';
import {
  getFirestoreMockRows,
  resetFirestoreMock,
  seedFirestoreMock,
} from '../../testing/firestoreMock';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@react-native-firebase/firestore', () =>
  jest.requireActual('../../testing/firestoreMock'),
);

const row: FinanceTransaction = {
  id: 'salary-1',
  ownerId: 'u1',
  type: 'income',
  amount: 25000000,
  category: 'Lương',
  note: '',
  createdAt: 1791432000000,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  resetFirestoreMock();
  resetFinanceCloudState();
  useFinanceStore.setState({
    uid: null,
    transactions: [],
    syncStatus: null,
    loading: false,
    error: null,
  });
});

it('shows recovered cloud transactions when the device cache key is unavailable', async () => {
  await setEncryptedItem('u1', financeStorageKey('u1'), JSON.stringify([row]));
  seedFirestoreMock('u1', row);
  const getItem = jest.mocked(SecureStore.getItemAsync);
  const originalGetItem = getItem.getMockImplementation();
  getItem.mockRejectedValue(new Error('Keychain access failed'));
  try {
    await act(async () => useFinanceStore.getState().load('u1'));

    expect(useFinanceStore.getState()).toMatchObject({
      transactions: [row],
      syncStatus: 'recovery',
      error: null,
    });

    const edited = { ...row, amount: 30000000 };
    await act(async () => useFinanceStore.getState().update('u1', edited));

    expect(useFinanceStore.getState()).toMatchObject({
      transactions: [edited],
      syncStatus: 'recovery',
      error: null,
    });
    expect(getFirestoreMockRows('u1')).toEqual([edited]);
  } finally {
    if (originalGetItem) getItem.mockImplementation(originalGetItem);
  }
});

it('loads only the bound account transactions', async () => {
  await addFinanceTransaction('u1', row);
  await addFinanceTransaction('u2', { ...row, id: 'other', ownerId: 'u2' });
  await act(async () => useFinanceStore.getState().load('u1'));
  expect(useFinanceStore.getState().transactions).toEqual([row]);
  await act(async () => useFinanceStore.getState().load('u2'));
  expect(useFinanceStore.getState().transactions).toMatchObject([
    { id: 'other', ownerId: 'u2' },
  ]);
});

it('updates the store after a saved income and deletion', async () => {
  await act(async () => useFinanceStore.getState().load('u1'));
  await act(async () => useFinanceStore.getState().add('u1', row));
  expect(useFinanceStore.getState().transactions).toEqual([row]);
  await act(async () => useFinanceStore.getState().remove('u1', row.id));
  expect(useFinanceStore.getState().transactions).toEqual([]);
});

it('does not apply a completed write after the store switched accounts', async () => {
  await act(async () => useFinanceStore.getState().load('u1'));
  await act(async () => {
    const pending = useFinanceStore.getState().add('u1', row);
    await useFinanceStore.getState().load('u2');
    await pending;
  });
  expect(useFinanceStore.getState().uid).toBe('u2');
  expect(useFinanceStore.getState().transactions).toEqual([]);
});

it('shows a readable account permission error and retains the transaction after failed deletion', async () => {
  await addFinanceTransaction('u1', row);
  await useFinanceStore.getState().load('u1');
  jest.mocked(deleteDoc).mockRejectedValueOnce(
    Object.assign(new Error('Native service details'), {
      code: 'firestore/permission-denied',
    }),
  );
  await expect(useFinanceStore.getState().remove('u1', row.id)).rejects.toThrow(
    'Tài khoản chưa có quyền truy cập sổ thu chi.',
  );
  expect(useFinanceStore.getState().transactions).toEqual([row]);
  expect(useFinanceStore.getState().error).toBe(
    'Tài khoản chưa có quyền truy cập sổ thu chi.',
  );
});
