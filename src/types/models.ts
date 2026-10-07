export type SessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};
export type DirectoryUser = { mail: string; name: string };
export type PushPermission = 'unknown' | 'granted' | 'denied';
export type AppNotification = { title: string; body: string };
