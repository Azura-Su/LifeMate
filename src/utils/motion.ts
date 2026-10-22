import { AccessibilityInfo, LayoutAnimation } from 'react-native';

let reduceMotion = false;
void AccessibilityInfo.isReduceMotionEnabled?.()
  .then((enabled) => {
    reduceMotion = enabled;
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
  reduceMotion = enabled;
});

/** True when the user asked the OS to reduce motion. */
export function prefersReducedMotion() {
  return reduceMotion;
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
