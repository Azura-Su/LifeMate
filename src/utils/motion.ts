import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, LayoutAnimation } from 'react-native';

let reduceMotion = false;
let receivedMotionEvent = false;
const listeners = new Set<() => void>();
function updateReducedMotion(enabled: boolean) {
  if (reduceMotion === enabled) return;
  reduceMotion = enabled;
  listeners.forEach((listener) => listener());
}

void AccessibilityInfo.isReduceMotionEnabled?.()
  .then((enabled) => {
    if (!receivedMotionEvent) updateReducedMotion(enabled);
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
  receivedMotionEvent = true;
  updateReducedMotion(enabled);
});

/** True when the user asked the OS to reduce motion. */
export function prefersReducedMotion() {
  return reduceMotion;
}

function subscribeReducedMotion(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Shares one native listener while updating mounted animations immediately. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    prefersReducedMotion,
  );
}

/**
 * Animate the next layout change (rows appearing, disappearing or moving,
 * progress bars resizing). No-op when the OS asks to reduce motion.
 */
export function animateNextLayout(duration = 220) {
  if (reduceMotion) return;
  LayoutAnimation.configureNext({
    duration,
    create: { type: 'easeInEaseOut', property: 'opacity' },
    update: { type: 'spring', springDamping: 0.85 },
    delete: { type: 'easeInEaseOut', property: 'opacity' },
  });
}

/** Entrance delay for item `index` of a list: capped so long lists don't lag. */
export function staggerDelay(index: number, step = 60, cap = 6) {
  return Math.min(index, cap) * step;
}
