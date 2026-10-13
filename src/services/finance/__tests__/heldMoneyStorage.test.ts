import { getDocsFromServer, runTransaction } from '@react-native-firebase/firestore';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../../security/encryptedLocalStorage';
import {
  parseHeldMoneyRecord,
  readHeldMoney,
  updateHeldMoneyDetails,
} from '../heldMoneyStorage';

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(),
  getFirestore: jest.fn(),
  getDocsFromServer: jest.fn(),
  doc: jest.fn(),
  runTransaction: jest.fn(),
}));
jest.mock('../../security/encryptedLocalStorage', () => ({
  getEncryptedItem: jest.fn(),
  setEncryptedItem: jest.fn(),
}));

const record = {
  id: 'fund-1',
  ownerId: 'u1',
  senderName: 'Bác Trà',
  purpose: 'Điện nước',
  createdAt: 100,
  updatedAt: 100,
  entries: [
    {
      id: 'received-1',
      kind: 'received',
      amount: 100,
      occurredAt: 100,
      note: '',
    },
  ],
};

beforeEach(() => {
  jest.mocked(getEncryptedItem).mockResolvedValue(null);
  jest.mocked(setEncryptedItem).mockResolvedValue(undefined);
});

it('rejects a stored balance or entry index that disagrees with the history', () => {
  expect(
    parseHeldMoneyRecord({ ...record, remainingAmount: 99 }, 'u1'),
  ).toBeNull();
  expect(
    parseHeldMoneyRecord({ ...record, entryIds: ['another'] }, 'u1'),
  ).toBeNull();
});

it('keeps the last valid cached copy when a cloud record is malformed', async () => {
  jest.mocked(getEncryptedItem).mockResolvedValue(JSON.stringify([record]));
  jest.mocked(getDocsFromServer).mockResolvedValue({
    docs: [
      {
        id: record.id,
        data: () => ({
          ...record,
          remainingAmount: 0,
          entryIds: ['received-1', 'paid-1'],
          entries: [
            ...record.entries,
            {
              id: 'paid-1',
              kind: 'paid',
              amount: 200,
              occurredAt: 101,
              note: '',
            },
          ],
        }),
      },
    ],
  } as never);
  const result = await readHeldMoney('u1');
  expect(result.records).toHaveLength(1);
  expect(result.records[0].id).toBe(record.id);
  expect(result.synced).toBe(false);
  expect(result.warning).toBeTruthy();
  expect(setEncryptedItem).not.toHaveBeenCalled();
});

it('upgrades a legacy fund before applying an edit in a separate transaction', async () => {
  let cloud: Record<string, unknown> = { ...record };
  const writes: Record<string, unknown>[] = [];
  jest.mocked(runTransaction).mockImplementation(async (_db, operation) => {
    const transaction = {
      get: async () => ({ exists: () => true, data: () => cloud }),
      set: (_ref: unknown, next: Record<string, unknown>) => {
        cloud = next;
        writes.push(next);
      },
    };
    return operation(transaction as never);
  });
  const expected = parseHeldMoneyRecord(record, 'u1')!;
  const updated = await updateHeldMoneyDetails('u1', expected, 'Tên mới', 'Điện nước');
  expect(writes).toHaveLength(2);
  expect(writes[0]).toMatchObject({
    remainingAmount: 100,
    entryIds: ['received-1'],
    updatedAt: 100,
  });
  expect(updated).toMatchObject({ senderName: 'Tên mới', remainingAmount: 100 });
});
