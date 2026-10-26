import { ImageManipulator } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { prepareSharedMemoryPhoto } from '../memorySharedPhoto';

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

function nativeImage(width: number, height: number) {
  const encoded: { uri: string; width: number; height: number }[] = [];
  const release = jest.fn();
  const context = {
    resize: jest.fn((size: { width?: number; height?: number }) => {
      const scale = size.width ? size.width / width : size.height! / height;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }),
    renderAsync: jest.fn(async () => ({
      width,
      height,
      release,
      saveAsync: jest.fn(async () => {
        const output = {
          uri: `file:///shared-${encoded.length}.jpg`,
          width,
          height,
        };
        encoded.push(output);
        return output;
      }),
    })),
    release: jest.fn(),
  };
  jest.mocked(ImageManipulator.manipulate).mockReturnValue(context as never);
  return { context, encoded, release };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(FileSystem.getInfoAsync).mockReset().mockResolvedValue({
    exists: true,
    isDirectory: false,
    size: 128_000,
    uri: 'file:///shared.jpg',
    modificationTime: 1,
  });
  jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

it.each([
  [4000, 6000],
  [6000, 4000],
  [3000, 3000],
])(
  'bounds the shared JPEG long edge while preserving the ratio of %s×%s',
  async (width, height) => {
    const native = nativeImage(width, height);
    const result = await prepareSharedMemoryPhoto('file:///original.jpg', {
      width,
      height,
    });
    const output = native.encoded[0];

    expect(Math.max(output.width, output.height)).toBe(1024);
    expect(output.width / output.height).toBeCloseTo(width / height, 2);
    expect(result).toEqual({ uri: output.uri, sizeBytes: 128_000 });
    expect(native.context.release).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(
      'file:///original.jpg',
      expect.anything(),
    );
  },
);

it('does not enlarge a small photo just to share it', async () => {
  const native = nativeImage(480, 640);
  await prepareSharedMemoryPhoto('file:///small.jpg', {
    width: 480,
    height: 640,
  });
  expect(native.encoded[0]).toMatchObject({ width: 480, height: 640 });
});

it('reuses the native decode and deletes the oversized attempt before fallback', async () => {
  const native = nativeImage(4000, 6000);
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({
    exists: true,
    isDirectory: false,
    size: 3 * 1024 * 1024,
    uri: 'file:///shared-0.jpg',
    modificationTime: 1,
  });
  await prepareSharedMemoryPhoto('file:///original.jpg', {
    width: 4000,
    height: 6000,
  });

  expect(ImageManipulator.manipulate).toHaveBeenCalledTimes(1);
  expect(Math.max(native.encoded[1].width, native.encoded[1].height)).toBe(760);
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///shared-0.jpg', {
    idempotent: true,
  });
  expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(
    'file:///shared-1.jpg',
    expect.anything(),
  );
});

it('cleans up the generated JPEG and native resources when size inspection fails', async () => {
  const native = nativeImage(4000, 6000);
  jest
    .mocked(FileSystem.getInfoAsync)
    .mockRejectedValueOnce(new Error('Read failed'));
  await expect(
    prepareSharedMemoryPhoto('file:///original.jpg'),
  ).rejects.toThrow('Read failed');
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///shared-0.jpg', {
    idempotent: true,
  });
  expect(native.context.release).toHaveBeenCalledTimes(1);
  expect(native.release).toHaveBeenCalled();
});

it('rejects a photo still over the limit after fallback and removes both attempts', async () => {
  const native = nativeImage(4000, 6000);
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: true,
    isDirectory: false,
    size: 3 * 1024 * 1024,
    uri: 'file:///shared.jpg',
    modificationTime: 1,
  });
  await expect(
    prepareSharedMemoryPhoto('file:///original.jpg'),
  ).rejects.toThrow('Ảnh quá lớn');
  expect(native.encoded).toHaveLength(2);
  expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
  expect(native.context.release).toHaveBeenCalledTimes(1);
});

it('releases the context when native decoding fails', async () => {
  const native = nativeImage(4000, 6000);
  native.context.renderAsync.mockRejectedValueOnce(new Error('Decode failed'));
  await expect(
    prepareSharedMemoryPhoto('file:///original.jpg'),
  ).rejects.toThrow('Decode failed');
  expect(native.context.release).toHaveBeenCalledTimes(1);
});

it.each([undefined, { width: NaN, height: 6000 }, { width: 0, height: 0 }])(
  'retains width-first processing for legacy or invalid dimensions (%j)',
  async (dimensions) => {
    const native = nativeImage(4000, 6000);
    await prepareSharedMemoryPhoto('file:///original.jpg', dimensions);
    expect(native.encoded[0]).toMatchObject({ width: 1024, height: 1536 });
    expect(native.context.renderAsync).toHaveBeenCalledTimes(1);
  },
);

it('corrects a native orientation interpretation that differs from supplied dimensions', async () => {
  const native = nativeImage(4000, 6000);
  await prepareSharedMemoryPhoto('file:///original.jpg', {
    width: 6000,
    height: 4000,
  });
  expect(Math.max(native.encoded[0].width, native.encoded[0].height)).toBe(
    1024,
  );
  expect(native.encoded[0].height).toBeGreaterThan(native.encoded[0].width);
});

it('releases decoded images when native JPEG encoding fails', async () => {
  const native = nativeImage(480, 640);
  native.context.renderAsync.mockResolvedValueOnce({
    width: 480,
    height: 640,
    release: native.release,
    saveAsync: jest.fn().mockRejectedValueOnce(new Error('Encode failed')),
  });
  await expect(
    prepareSharedMemoryPhoto('file:///original.jpg'),
  ).rejects.toThrow('Encode failed');
  expect(native.context.release).toHaveBeenCalledTimes(1);
  expect(native.release).toHaveBeenCalledTimes(1);
});
