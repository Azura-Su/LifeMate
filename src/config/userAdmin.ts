// Presentation only: the Edge Function independently authorizes the admin.
export const ADMIN_UID = 'CQmmT9iJvKPP79UZqYbvmZ3gXZQ2';
export const ADMIN_EMAIL = 'su.azura99@gmail.com';
export function isUserAdmin(
  user: { uid: string; email: string | null } | null | undefined,
) {
  return user?.uid === ADMIN_UID && user.email?.toLowerCase() === ADMIN_EMAIL;
}
