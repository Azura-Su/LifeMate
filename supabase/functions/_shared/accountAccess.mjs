export const ACCESS_TABLE = 'lifemate_account_access';

// Fail closed: an unavailable gate must never mint a signed upload/download URL.
export function withAccountAccess(
  verify,
  database,
  identity = false,
  returnUid = false,
) {
  return async (token) => {
    const result = await verify(token);
    const uid = identity ? result.uid : result;
    const rows = await database(ACCESS_TABLE, 'GET', {
      uid: `eq.${uid}`,
      select: 'status,valid_since',
      limit: 1,
    });
    if (
      rows.some(
        (row) =>
          row.status !== 'active' ||
          (Number(row.valid_since) > 0 &&
            (!identity ||
              typeof result.authTime !== 'number' ||
              result.authTime < Number(row.valid_since))),
      )
    )
      throw new Error('Account unavailable');
    return returnUid ? uid : result;
  };
}
