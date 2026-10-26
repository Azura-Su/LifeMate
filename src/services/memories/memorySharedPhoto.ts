import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import type { MemoryPhotoDimensions } from '../../types/memory';

const MAX_SHARED_PHOTO_BYTES = 2 * 1024 * 1024;

function validDimensions(
  value?: MemoryPhotoDimensions,
): value is MemoryPhotoDimensions {
  return (
    !!value &&
    Number.isFinite(value.width) &&
    Number.isFinite(value.height) &&
    value.width > 0 &&
    value.height > 0
  );
}

export async function prepareSharedMemoryPhoto(
  uri: string,
  photoDimensions?: MemoryPhotoDimensions,
) {
  const context = ImageManipulator.manipulate(uri);
  let image: Awaited<ReturnType<typeof context.renderAsync>> | null = null;
  try {
    // Camera/picker dimensions describe the unchanged local copy. Older entries
    // retain their width-first path without an extra header/decode request.
    const knownDimensions = validDimensions(photoDimensions);
    let dimensions = knownDimensions ? photoDimensions : null;
    for (const [longEdge, quality] of [
      [1024, 0.72],
      [760, 0.52],
    ] as const) {
      if (
        !dimensions ||
        Math.max(dimensions.width, dimensions.height) > longEdge
      ) {
        context.resize(
          !dimensions || dimensions.width >= dimensions.height
            ? { width: longEdge }
            : { height: longEdge },
        );
        const resized = await context.renderAsync();
        image?.release();
        image = resized;
      } else if (!image) image = await context.renderAsync();
      // Orientation metadata may differ from a native decoder's interpretation.
      if (knownDimensions && Math.max(image.width, image.height) > longEdge) {
        context.resize(
          image.width >= image.height
            ? { width: longEdge }
            : { height: longEdge },
        );
        const resized = await context.renderAsync();
        image.release();
        image = resized;
      }
      if (!validDimensions(image))
        throw new Error('Chưa đọc được kích thước ảnh chia sẻ.');
      dimensions = image;
      let temporaryUri: string | null = null;
      try {
        const saved = await image.saveAsync({
          format: SaveFormat.JPEG,
          compress: quality,
        });
        temporaryUri = saved.uri;
        const info = await FileSystem.getInfoAsync(saved.uri);
        if (
          info.exists &&
          !info.isDirectory &&
          Number.isSafeInteger(info.size) &&
          info.size > 0 &&
          info.size <= MAX_SHARED_PHOTO_BYTES
        ) {
          temporaryUri = null;
          return { uri: saved.uri, sizeBytes: info.size };
        }
      } finally {
        if (temporaryUri)
          await FileSystem.deleteAsync(temporaryUri, {
            idempotent: true,
          }).catch(() => undefined);
      }
    }
    throw new Error('Ảnh quá lớn để chia sẻ. Hãy chọn ảnh khác.');
  } finally {
    image?.release();
    context.release();
  }
}
