export type HeldMoneyEntryKind = 'received' | 'paid' | 'returned';

export type HeldMoneyEntry = {
  id: string;
  kind: HeldMoneyEntryKind;
  amount: number;
  occurredAt: number;
  note: string;
};

export type HeldMoneyRecord = {
  id: string;
  ownerId: string;
  senderName: string;
  purpose: string;
  createdAt: number;
  updatedAt: number;
  entries: HeldMoneyEntry[];
  // Optional only for records created before balance validation was added.
  remainingAmount?: number;
  entryIds?: string[];
};

export function getHeldMoneyTotals(record: HeldMoneyRecord) {
  const totals = { received: 0, paid: 0, returned: 0, remaining: 0 };
  for (const entry of record.entries) totals[entry.kind] += entry.amount;
  totals.remaining = totals.received - totals.paid - totals.returned;
  return totals;
}
