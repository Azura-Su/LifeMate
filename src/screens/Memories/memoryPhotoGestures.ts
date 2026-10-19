export type PhotoTransform = { scale: number; x: number; y: number };
export const originalPhotoTransform: PhotoTransform = { scale: 1, x: 0, y: 0 };
const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

export function boundPhotoTransform(
  transform: PhotoTransform,
  viewport: { width: number; height: number },
  image: { width: number; height: number },
): PhotoTransform {
  const scale = Math.max(1, Math.min(4, transform.scale));
  const fit = Math.min(
    viewport.width / image.width,
    viewport.height / image.height,
  );
  if (!Number.isFinite(fit) || fit <= 0) return { scale, x: 0, y: 0 };
  return {
    scale,
    x: clamp(
      transform.x,
      Math.max(0, (image.width * fit * scale - viewport.width) / 2),
    ),
    y: clamp(
      transform.y,
      Math.max(0, (image.height * fit * scale - viewport.height) / 2),
    ),
  };
}

// Centers are relative to the viewport center; keep the same image point under the fingers.
export function pinchPhotoTransform(
  initial: PhotoTransform,
  ratio: number,
  initialCenter: { x: number; y: number },
  center: { x: number; y: number },
): PhotoTransform {
  const scale = Math.max(1, Math.min(4, initial.scale * ratio));
  return {
    scale,
    x: center.x - ((initialCenter.x - initial.x) / initial.scale) * scale,
    y: center.y - ((initialCenter.y - initial.y) / initial.scale) * scale,
  };
}

export function photoSwipeAction(
  dx: number,
  dy: number,
  scale: number,
  pinched: boolean,
) {
  if (pinched || scale > 1.02) return null;
  if (dy > 80 && dy > Math.abs(dx) * 1.3) return 'close';
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3)
    return dx < 0 ? 'next' : 'previous';
  return null;
}
