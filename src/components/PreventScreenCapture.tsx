import { usePreventScreenCapture } from 'expo-screen-capture';

// While mounted, blocks screenshots/recording and blanks the Android
// recent-apps preview (FLAG_SECURE). Android has no 'inactive' state, so the
// JS masking used on iOS cannot hide content before the system snapshot.
export function PreventScreenCapture({ id }: { id: string }) {
  usePreventScreenCapture(id);
  return null;
}
