import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFinanceStore } from '../financeStore';
import { addFinanceTransaction } from '../../services/finance/financeStorage';
import type { FinanceTransaction } from '../../types/finance';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
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
  useFinanceStore.setState({
    uid: null,
    transactions: [],
    loading: false,
    error: null,
  });
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
