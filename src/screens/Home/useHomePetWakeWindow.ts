import { useCallback, useEffect, useRef, useState } from 'react';

export const HOME_PET_AWAKE_MS = 20_000;

/** Count visible Home time; focus changes never wake a sleeping pet. */
export function useHomePetWakeWindow(identity: string, active: boolean) {
  const [asleep, setAsleep] = useState(false);
  const [touch, setTouch] = useState(0);
  const remaining = useRef(HOME_PET_AWAKE_MS);
  const resetRequested = useRef(false);
  const runningSince = useRef<number | null>(null);

  useEffect(() => {
    remaining.current = HOME_PET_AWAKE_MS;
    setAsleep(false);
  }, [identity]);

  useEffect(() => {
    if (!identity || !active || asleep) return;
    if (resetRequested.current) {
      remaining.current = HOME_PET_AWAKE_MS;
      resetRequested.current = false;
    }
    const started = Date.now();
    runningSince.current = started;
    const timer = setTimeout(() => {
      remaining.current = 0;
      setAsleep(true);
    }, remaining.current);
    return () => {
      clearTimeout(timer);
      runningSince.current = null;
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - started),
      );
    };
  }, [identity, active, asleep, touch]);

  const wake = useCallback(() => {
    setAsleep(false);
    setTouch((value) => value + 1);
    resetRequested.current = true;
  }, []);

  /** Awake time still left in the current window, in ms. */
  const timeLeft = useCallback(
    () =>
      runningSince.current === null
        ? remaining.current
        : Math.max(0, remaining.current - (Date.now() - runningSince.current)),
    [],
  );

  return { asleep, wake, timeLeft };
}
