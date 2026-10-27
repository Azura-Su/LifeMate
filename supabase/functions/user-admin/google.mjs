import { importPKCS8, SignJWT } from 'jose';

export function createGoogleAdmin(credentials, bucket, request = fetch) {
  const project = 'baseapp-dd227';
  const config = JSON.parse(credentials ?? '{}');
  if (
    config.project_id !== project ||
    !config.client_email?.endsWith(`@${project}.iam.gserviceaccount.com`) ||
    !config.private_key ||
    !/^[a-z0-9._-]+$/.test(bucket ?? '')
  )
    throw new Error('Missing Google admin configuration');
  let cached;
  let pending;
  async function token() {
    if (cached && cached.until > Date.now()) return cached.value;
    if (pending) return pending;
    pending = (async () => {
      const assertion = await new SignJWT({
        scope: 'https://www.googleapis.com/auth/cloud-platform',
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer(config.client_email)
        .setAudience('https://oauth2.googleapis.com/token')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(await importPKCS8(config.private_key, 'RS256'));
      const response = await request('https://oauth2.googleapis.com/token', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
      });
      if (!response.ok) throw new Error('Google credentials unavailable');
      const result = await response.json();
      if (!result.access_token) throw new Error('Missing Google token');
      cached = {
        value: result.access_token,
        until:
          Date.now() + Math.min(Number(result.expires_in) || 0, 3500) * 1000,
      };
      return cached.value;
    })();
    try {
      return await pending;
    } finally {
      pending = null;
    }
  }
  async function api(url, method = 'GET', body, missing = false) {
    const response = await request(url, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${await token()}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (missing && response.status === 404) return null;
    if (!response.ok) throw new Error('Google operation unavailable');
    return response.status === 204 ? null : response.json();
  }
  const auth = `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts`;
  const firestore = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  return {
    lookup: async (query) =>
      (await api(`${auth}:lookup`, 'POST', query)).users?.[0] ?? null,
    list: (pageToken) => {
      const url = new URL(`${auth}:batchGet`);
      url.searchParams.set('maxResults', '50');
      if (pageToken) url.searchParams.set('nextPageToken', pageToken);
      return api(url);
    },
    setDisabled: (uid, disabled, validSince) =>
      api(`${auth}:update`, 'POST', {
        localId: uid,
        disableUser: disabled,
        ...(disabled ? { validSince: String(validSince) } : {}),
      }),
    setCustomClaims: (uid, claims) =>
      api(`${auth}:update`, 'POST', {
        localId: uid,
        customAttributes: JSON.stringify(claims),
      }),
    deleteAuth: async (uid) => {
      // Lookup handles the crash after deletion but before durable completion.
      const user = (await api(`${auth}:lookup`, 'POST', { localId: [uid] }))
        .users?.[0];
      if (user) await api(`${auth}:delete`, 'POST', { localId: uid });
    },
    mirror: (uid, status, validSince) =>
      api(`${firestore}/accountAccess/${uid}`, 'PATCH', {
        fields: {
          status: { stringValue: status },
          validSince: { integerValue: String(validSince ?? 0) },
        },
      }),
    // Known collection paths work even when their parent document never existed.
    async clearFirestore(uid, budget) {
      const roots = {
        audioLibraries: ['tracks'],
        financeAccounts: [
          'transactions',
          'settings',
          'loans',
          'deletedLoans',
          'deletedLoanRepayments',
          'heldFunds',
        ],
        noteAccounts: ['notes', 'deletedNotes'],
        agendaAccounts: ['items', 'deletedItems'],
        memoryAccounts: ['items'],
      };
      for (const [root, collections] of Object.entries(roots)) {
        for (const collection of collections) {
          const result = await api(
            `${firestore}/${root}/${uid}/${collection}?pageSize=50`,
          );
          const docs = result.documents ?? [];
          for (const document of docs) {
            if (!budget()) return false;
            // All current owned collections are leaf documents (see SPEC).
            await api(
              `https://firestore.googleapis.com/v1/${document.name}`,
              'DELETE',
              undefined,
              true,
            );
          }
          if (result.nextPageToken) return false;
        }
        await api(`${firestore}/${root}/${uid}`, 'DELETE', undefined, true);
        if (!budget()) return false;
      }
      return true;
    },
    // Pet EXP reads finance rows server-side; clients never submit EXP.
    // A partial read would revoke EXP, so this pages to the end or throws.
    async listFinanceTransactions(uid, fromMs) {
      const fields = ['type', 'incomeSource', 'expenseSource', 'category', 'createdAt'];
      const value = (field) =>
        field?.stringValue ??
        (field?.integerValue !== undefined
          ? Number(field.integerValue)
          : field?.doubleValue);
      const rows = [];
      let cursor = null;
      for (let page = 0; page < 20; page += 1) {
        const result = await api(`${firestore}/financeAccounts/${uid}:runQuery`, 'POST', {
          structuredQuery: {
            from: [{ collectionId: 'transactions' }],
            select: { fields: fields.map((fieldPath) => ({ fieldPath })) },
            where: {
              fieldFilter: {
                field: { fieldPath: 'createdAt' },
                op: 'GREATER_THAN_OR_EQUAL',
                value: { integerValue: String(Math.max(0, Math.floor(fromMs))) },
              },
            },
            orderBy: [
              { field: { fieldPath: 'createdAt' }, direction: 'ASCENDING' },
              { field: { fieldPath: '__name__' }, direction: 'ASCENDING' },
            ],
            ...(cursor ? { startAt: { values: cursor, before: false } } : {}),
            limit: 500,
          },
        });
        if (!Array.isArray(result)) throw new Error('Google operation unavailable');
        const documents = result.filter((row) => row.document).map((row) => row.document);
        for (const document of documents)
          rows.push(
            Object.fromEntries(
              fields
                .map((name) => [name, value(document.fields?.[name])])
                .filter(([, field]) => field !== undefined),
            ),
          );
        if (documents.length < 500) return rows;
        const last = documents.at(-1);
        cursor = [last.fields.createdAt, { referenceValue: last.name }];
      }
      throw new Error('Finance history too large');
    },
    async clearStorage(uid, budget) {
      for (const prefix of [`audio/${uid}/`, `memories/${uid}/`]) {
        if (!budget()) return false;
        const result = await api(
          `https://storage.googleapis.com/storage/v1/b/${bucket}/o?maxResults=50&prefix=${encodeURIComponent(prefix)}`,
          'GET',
          undefined,
          true,
        );
        // A nonexistent legacy bucket contains no user objects.
        if (!result) continue;
        for (const object of result.items ?? []) {
          if (!object.name.startsWith(prefix))
            throw new Error('Unsafe object prefix');
          if (!budget()) return false;
          await api(
            `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(object.name)}`,
            'DELETE',
            undefined,
            true,
          );
        }
        if (result.nextPageToken) return false;
      }
      return true;
    },
  };
}
