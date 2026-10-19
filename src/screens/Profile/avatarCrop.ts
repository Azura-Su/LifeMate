export type AvatarCropSource = { uri: string; width: number; height: number };
export type AvatarCropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function avatarCropGeometry(
  width: number,
  height: number,
  viewport: number,
  zoom: number,
  x: number,
  y: number,
) {
  if (
    ![width, height, viewport, zoom, x, y].every(Number.isFinite) ||
    width < 1 ||
    height < 1 ||
    viewport <= 0
  )
    throw new Error('Kích thước ảnh không hợp lệ.');
  const scale = (viewport / Math.min(width, height)) * clamp(zoom, 1, 3);
  const displayWidth = width * scale;
  const displayHeight = height * scale;
  const offsetX = clamp(
    x,
    -(displayWidth - viewport) / 2,
    (displayWidth - viewport) / 2,
  );
  const offsetY = clamp(
    y,
    -(displayHeight - viewport) / 2,
    (displayHeight - viewport) / 2,
  );
  const side = Math.max(
    1,
    Math.min(width, height, Math.floor(viewport / scale)),
  );
  return {
    width: displayWidth,
    height: displayHeight,
    left: (viewport - displayWidth) / 2 + offsetX,
    top: (viewport - displayHeight) / 2 + offsetY,
    offsetX,
    offsetY,
    crop: {
      originX: clamp(
        Math.round((width - viewport / scale) / 2 - offsetX / scale),
        0,
        width - side,
      ),
      originY: clamp(
        Math.round((height - viewport / scale) / 2 - offsetY / scale),
        0,
        height - side,
      ),
      width: side,
      height: side,
    },
  };
}
export function validAvatarCrop(
  source: AvatarCropSource,
  crop: AvatarCropRect,
) {
  return (
    [crop.originX, crop.originY, crop.width, crop.height].every(
      Number.isSafeInteger,
    ) &&
    crop.originX >= 0 &&
    crop.originY >= 0 &&
    crop.width > 0 &&
    crop.width === crop.height &&
    crop.originX + crop.width <= source.width &&
    crop.originY + crop.height <= source.height
  );
}
