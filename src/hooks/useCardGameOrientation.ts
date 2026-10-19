import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';

let orientationChange = Promise.resolve();

function lock(orientation: ScreenOrientation.OrientationLock) {
  orientationChange = orientationChange
    .catch(() => undefined)
    .then(() => ScreenOrientation.lockAsync(orientation))
    .catch(() => undefined);
  return orientationChange;
}

export function useCardGameOrientation(playing: boolean, active: boolean) {
  const landscape = playing && active;

  useEffect(() => {
    void lock(
      landscape
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );
    if (!landscape) return;
    return () => {
      void lock(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, [landscape]);
}
