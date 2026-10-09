import {
  doc,
  getDocFromServer,
  getFirestore,
  runTransaction,
} from '@react-native-firebase/firestore';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type FinanceTransactionType,
} from '../../types/finance';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';

export type FinanceTransactionTemplate = {
  id: string;
  name: string;
  type: FinanceTransactionType;
  amount: number;
  category: string;
  note: string;
};

export type FinancePreferences = {
  incomeCategories: string[];
  expenseCategories: string[];
  templates: FinanceTransactionTemplate[];
};

export type FinancePreferencesResult = {
  preferences: FinancePreferences;
  synced: boolean;
};

type CachedPreferences = {
  preferences: FinancePreferences;
  basePreferences: FinancePreferences | null;
  state: 'none' | 'legacy' | 'pending' | 'synced' | 'invalid';
};

const keyFor = (uid: string) =>
  `lifemate:finance-preferences:v1:${encodeURIComponent(uid)}`;
const queues = new Map<string, Promise<unknown>>();
const CLOUD_WRITE_TIMEOUT_MS = 15000;
const SETTINGS_DOC_ID = 'preferences';

const defaultPreferences = (): FinancePreferences => ({
  incomeCategories: [...INCOME_CATEGORIES],
  expenseCategories: [...EXPENSE_CATEGORIES],
  templates: [
    {
      id: 'coffee-default',
      name: 'Cà phê 30.000đ',
      type: 'expense',
      amount: 30000,
      category: 'Ăn uống',
      note: 'Cà phê',
    },
  ],
});

function enqueue<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  const previous = queues.get(uid) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  queues.set(uid, next);
  void next
    .finally(() => {
      if (queues.get(uid) === next) queues.delete(uid);
    })
    .catch(() => undefined);
  return next;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Chưa kết nối được kho đám mây. Hãy thử lại.')),
      CLOUD_WRITE_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function requireUid(uid: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid))
    throw new Error('Không tìm thấy tài khoản đang đăng nhập.');
}

function preferenceRef(uid: string) {
  return doc(
    getFirestore(),
    'financeAccounts',
    uid,
    'settings',
    SETTINGS_DOC_ID,
  );
}

function parsePreferences(value: unknown): FinancePreferences {
  const defaults = defaultPreferences();
  if (!value || typeof value !== 'object') return defaults;
  const data = value as Partial<FinancePreferences>;
  const categories = (input: unknown, base: readonly string[]) =>
    Array.isArray(input)
      ? [
          ...new Set([
            ...base,
            ...input
              .filter((item) => typeof item === 'string' && item.trim())
              .map((item) => item.trim())
              .filter((item) => item.length <= 50),
          ]),
        ].slice(0, 30)
      : [...base];
  const templates = Array.isArray(data.templates)
    ? data.templates
        .filter(
          (item): item is FinanceTransactionTemplate =>
            !!item &&
            typeof item.id === 'string' &&
            item.id.length > 0 &&
            item.id.length <= 128 &&
            typeof item.name === 'string' &&
            item.name.trim().length > 0 &&
            item.name.length <= 120 &&
            (item.type === 'income' || item.type === 'expense') &&
            Number.isSafeInteger(item.amount) &&
            item.amount > 0 &&
            typeof item.category === 'string' &&
            item.category.length <= 50 &&
            typeof item.note === 'string' &&
            item.note.length <= 120,
        )
        .slice(0, 100)
    : defaults.templates;
  return {
    incomeCategories: categories(data.incomeCategories, INCOME_CATEGORIES),
    expenseCategories: categories(data.expenseCategories, EXPENSE_CATEGORIES),
    templates: templates.some(({ id }) => id === 'coffee-default')
      ? templates
      : [defaults.templates[0], ...templates].slice(0, 100),
  };
}

function isLegacyPreferences(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    'incomeCategories' in value &&
    'expenseCategories' in value &&
    'templates' in value
  );
}

async function readCache(uid: string): Promise<CachedPreferences> {
  const raw = await getEncryptedItem(uid, keyFor(uid));
  if (!raw)
    return {
      preferences: defaultPreferences(),
      basePreferences: null,
      state: 'none',
    };
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === 'object' &&
      'version' in value &&
      value.version === 1 &&
      'preferences' in value
    ) {
      const cached = value as {
        preferences: unknown;
        basePreferences?: unknown;
        pending?: unknown;
      };
      return {
        preferences: parsePreferences(cached.preferences),
        basePreferences: cached.basePreferences
          ? parsePreferences(cached.basePreferences)
          : null,
        state: cached.pending === true ? 'pending' : 'synced',
      };
    }
    if (isLegacyPreferences(value))
      return {
        preferences: parsePreferences(value),
        basePreferences: null,
        state: 'legacy',
      };
    return {
      preferences: defaultPreferences(),
      basePreferences: null,
      state: 'invalid',
    };
  } catch {
    return {
      preferences: defaultPreferences(),
      basePreferences: null,
      state: 'invalid',
    };
  }
}

async function writeCache(
  uid: string,
  preferences: FinancePreferences,
  pending: boolean,
  basePreferences?: FinancePreferences,
) {
  await setEncryptedItem(
    uid,
    keyFor(uid),
    JSON.stringify({
      version: 1,
      pending,
      preferences,
      ...(pending && basePreferences ? { basePreferences } : {}),
    }),
  );
}

function applyLocalChanges(
  base: FinancePreferences,
  local: FinancePreferences,
  cloud: FinancePreferences,
): FinancePreferences {
  const mergeCategories = (
    baseCategories: string[],
    localCategories: string[],
    cloudCategories: string[],
  ) => {
    const normalize = (value: string) => value.toLocaleLowerCase('vi');
    const localKeys = new Set(localCategories.map(normalize));
    const baseKeys = new Set(baseCategories.map(normalize));
    const removed = new Set(
      baseCategories
        .filter((item) => !localKeys.has(normalize(item)))
        .map(normalize),
    );
    const added = localCategories.filter(
      (item) => !baseKeys.has(normalize(item)),
    );
    const seen = new Set<string>();
    return [...cloudCategories, ...added]
      .filter((item) => {
        const key = normalize(item);
        if (removed.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 30);
  };

  const baseTemplates = new Map(base.templates.map((item) => [item.id, item]));
  const localTemplates = new Map(
    local.templates.map((item) => [item.id, item]),
  );
  const removedIds = new Set(
    base.templates
      .filter(({ id }) => id !== 'coffee-default' && !localTemplates.has(id))
      .map(({ id }) => id),
  );
  const changedTemplates = local.templates.filter((item) => {
    const previous = baseTemplates.get(item.id);
    return !previous || JSON.stringify(previous) !== JSON.stringify(item);
  });
  const mergedTemplates = [
    ...cloud.templates.filter(
      ({ id }) =>
        !removedIds.has(id) && !changedTemplates.some((item) => item.id === id),
    ),
    ...changedTemplates,
  ];
  const names = new Set<string>();
  const ids = new Set<string>();
  const templates = mergedTemplates.filter((item) => {
    const name = item.name.toLocaleLowerCase('vi');
    if (ids.has(item.id) || names.has(name)) return false;
    ids.add(item.id);
    names.add(name);
    return true;
  });

  return parsePreferences({
    incomeCategories: mergeCategories(
      base.incomeCategories,
      local.incomeCategories,
      cloud.incomeCategories,
    ),
    expenseCategories: mergeCategories(
      base.expenseCategories,
      local.expenseCategories,
      cloud.expenseCategories,
    ),
    templates,
  });
}

function mergeLegacyPreferences(
  cloud: FinancePreferences,
  local: FinancePreferences,
): FinancePreferences {
  const mergeCategories = (first: string[], second: string[]) => {
    const seen = new Set(first.map((item) => item.toLocaleLowerCase('vi')));
    return [
      ...first,
      ...second.filter((item) => {
        const key = item.toLocaleLowerCase('vi');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    ].slice(0, 30);
  };
  const names = new Set(
    cloud.templates.map((item) => item.name.toLocaleLowerCase('vi')),
  );
  const ids = new Set(cloud.templates.map(({ id }) => id));
  const templates = [
    ...cloud.templates,
    ...local.templates.filter((item) => {
      const name = item.name.toLocaleLowerCase('vi');
      if (ids.has(item.id) || names.has(name)) return false;
      ids.add(item.id);
      names.add(name);
      return true;
    }),
  ].slice(0, 100);
  return {
    incomeCategories: mergeCategories(
      cloud.incomeCategories,
      local.incomeCategories,
    ),
    expenseCategories: mergeCategories(
      cloud.expenseCategories,
      local.expenseCategories,
    ),
    templates,
  };
}

async function mergeAndUploadPreferences(
  uid: string,
  merge: (cloud: FinancePreferences) => FinancePreferences,
): Promise<FinancePreferences> {
  const ref = preferenceRef(uid);
  return withTimeout(
    runTransaction(getFirestore(), async (transaction) => {
      const snapshot = await transaction.get(ref);
      const cloud = snapshot.exists()
        ? parsePreferences(snapshot.data())
        : defaultPreferences();
      const preferences = merge(cloud);
      transaction.set(ref, preferences);
      return preferences;
    }),
  );
}

export function readFinancePreferences(
  uid: string,
): Promise<FinancePreferencesResult> {
  requireUid(uid);
  return enqueue(uid, async () => {
    const cache = await readCache(uid);
    try {
      if (cache.state === 'pending') {
        const preferences = await mergeAndUploadPreferences(uid, (cloud) =>
          applyLocalChanges(
            cache.basePreferences ?? defaultPreferences(),
            cache.preferences,
            cloud,
          ),
        );
        await writeCache(uid, preferences, false);
        return { preferences, synced: true };
      }
      if (cache.state === 'legacy') {
        const preferences = await mergeAndUploadPreferences(uid, (cloud) =>
          mergeLegacyPreferences(cloud, cache.preferences),
        );
        await writeCache(uid, preferences, false);
        return { preferences, synced: true };
      }

      const snapshot = await getDocFromServer(preferenceRef(uid));
      if (snapshot.exists()) {
        const preferences = parsePreferences(snapshot.data());
        await writeCache(uid, preferences, false);
        return { preferences, synced: true };
      }

      if (cache.state === 'synced') {
        const preferences = await mergeAndUploadPreferences(uid, (cloud) =>
          applyLocalChanges(defaultPreferences(), cache.preferences, cloud),
        );
        await writeCache(uid, preferences, false);
        return { preferences, synced: true };
      }
      if (cache.state === 'invalid')
        await writeCache(uid, cache.preferences, false);
      return { preferences: cache.preferences, synced: true };
    } catch {
      return {
        preferences: cache.preferences,
        synced: cache.state === 'synced',
      };
    }
  });
}

export function writeFinancePreferences(
  uid: string,
  preferences: FinancePreferences,
): Promise<{ preferences: FinancePreferences; synced: boolean }> {
  requireUid(uid);
  const normalized = parsePreferences(preferences);
  return enqueue(uid, async () => {
    const cache = await readCache(uid);
    // Keep the original cloud snapshot across a chain of offline edits. If
    // each write uses the previous local value as its base, earlier additions
    // and deletions disappear from the final diff when connectivity returns.
    const basePreferences =
      cache.state === 'pending'
        ? (cache.basePreferences ?? defaultPreferences())
        : cache.preferences;
    await writeCache(uid, normalized, true, basePreferences);
    try {
      const merged = await mergeAndUploadPreferences(uid, (cloud) =>
        applyLocalChanges(basePreferences, normalized, cloud),
      );
      await writeCache(uid, merged, false);
      return { preferences: merged, synced: true };
    } catch {
      return { preferences: normalized, synced: false };
    }
  });
}
