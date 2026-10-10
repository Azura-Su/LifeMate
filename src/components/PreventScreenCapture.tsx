import { usePreventScreenCapture } from 'expo-screen-capture';
import { Platform } from 'react-native';

export function PreventScreenCapture({ id }: { id: string }) {
  // Expo's iOS implementation reparents the app window under a secure text
  // field. Avoid the black window it causes when Finance unlocks on iOS.
  if (Platform.OS !== 'android') return null;

  return <AndroidScreenCapture id={id} />;
}

function AndroidScreenCapture({ id }: { id: string }) {
  usePreventScreenCapture(id);
  return null;
}
