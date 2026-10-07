import type { DirectoryUser, SessionUser } from '../types/models';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// null distinguishes an invalid payload from an intentionally empty directory.
export function parseUsers(raw: string): DirectoryUser[] | null {
  if (raw.length > 100_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > 1000) return null;
    const users = new Map<string, DirectoryUser>();
    for (const row of value) {
      if (
        !row ||
        typeof row !== 'object' ||
        typeof row.mail !== 'string' ||
        typeof row.name !== 'string' ||
        !isValidEmail(row.mail) ||
        !row.name.trim() ||
        row.name.length > 100
      )
        return null;
      const mail = normalizeEmail(row.mail);
      if (!users.has(mail)) users.set(mail, { mail, name: row.name.trim() });
    }
    return [...users.values()];
  } catch {
    return null;
  }
}

export function resolveUserName(
  user: Pick<SessionUser, 'email' | 'displayName'> | null,
  users: DirectoryUser[],
): string {
  if (!user) return 'Bạn';
  const email = normalizeEmail(user.email ?? '');
  return (
    users.find((row) => row.mail === email)?.name ||
    user.displayName?.trim() ||
    email.split('@')[0] ||
    'Bạn'
  );
}
