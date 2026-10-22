import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Platform } from 'react-native';

let orientationChange = Promise.resolve();

function lock(orientation: ScreenOrientation.OrientationLock) {
  orientationChange = orientationChange
    .catch(() => undefined)
    .then(() => ScreenOrientation.lockAsync(orientation))
    .catch(() => undefined);
  return orientationChange;
}

export function useCardGameOrientation(
  rotationAllowed: boolean,
  active: boolean,
) {
  const canRotate = rotationAllowed && active;

  useEffect(() => {
    if (!active) {
      orientationChange = orientationChange
        .catch(() => undefined)
        .then(() => ScreenOrientation.unlockAsync())
        .catch(() => undefined);
      return;
    }
    // ALL includes upside-down portrait, unsupported on notched iPhones.
    void lock(
      canRotate
        ? Platform.OS === 'ios'
          ? ScreenOrientation.OrientationLock.DEFAULT
          : ScreenOrientation.OrientationLock.ALL
        : ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );
  }, [active, canRotate]);

  useEffect(
    () => () => {
      orientationChange = orientationChange
        .catch(() => undefined)
        .then(() => ScreenOrientation.unlockAsync())
        .catch(() => undefined);
    },
    [],
  );
}
