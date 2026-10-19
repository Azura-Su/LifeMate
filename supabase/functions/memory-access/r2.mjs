import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { FetchHttpHandler } from '@smithy/fetch-http-handler';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ACCOUNT_ID = /^[a-f0-9]{32}$/;
const BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const OBJECT_PATH =
  /^shared\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}\/photo\.jpg$/;

const PRIVATE_PATH =
  /^private\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}\.(jpg|jpeg|png|webp|heic|heif|gif)$/;
const PHOTO_TYPES = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  heic: 'heic',
  heif: 'heif',
  gif: 'gif',
};

export function createR2Storage(config) {
  const { accountId, bucket, accessKeyId, secretAccessKey } = config;
  if (
    !ACCOUNT_ID.test(accountId ?? '') ||
    !BUCKET.test(bucket ?? '') ||
    !accessKeyId ||
    !secretAccessKey
  )
    throw new Error('Missing R2 memory storage configuration');
  const client = new S3Client({
    region: 'auto',
    // Deno Edge's Node HTTP adapter can abort bodyless HEAD responses.
    requestHandler: new FetchHttpHandler({
      requestInit: () => ({ redirect: 'error' }),
    }),
    // The body is sent later by the native client, so do not sign an empty-body CRC32.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  const send = (command) =>
    client.send(command, { abortSignal: AbortSignal.timeout(15000) });
  const object = (path) => {
    if (!OBJECT_PATH.test(path) && !PRIVATE_PATH.test(path))
      throw new Error('Invalid memory photo path');
    return { Bucket: bucket, Key: path };
  };
  return async function r2(action, path, sizeBytes, reservationToken) {
    const key = object(path);
    const privatePhoto = PRIVATE_PATH.test(path);
    if (privatePhoto && !['head', 'upload', 'download'].includes(action))
      throw new Error('Invalid private photo action');
    if (action === 'copy') {
      if (!/^[a-f0-9-]{36}$/i.test(reservationToken ?? ''))
        throw new Error('Missing migration reservation proof');
      const source = new URL(sizeBytes);
      if (
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(source.origin) ||
        source.pathname !==
          `/storage/v1/object/sign/lifemate-memories/${path}` ||
        !source.searchParams.get('token')
      )
        throw new Error('Invalid legacy memory photo URL');
      const response = await fetch(source, {
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Legacy memory photo unavailable');
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > 2097152)
        throw new Error('Legacy memory photo too large');
      if (!response.body) throw new Error('Empty legacy memory photo');
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 2097152) {
            await reader.cancel();
            throw new Error('Legacy memory photo too large');
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      if (
        bytes.length < 4 ||
        bytes.length > 2097152 ||
        bytes[0] !== 0xff ||
        bytes[1] !== 0xd8 ||
        bytes[bytes.length - 2] !== 0xff ||
        bytes[bytes.length - 1] !== 0xd9
      )
        throw new Error('Invalid legacy memory photo');
      try {
        await send(
          new PutObjectCommand({
            ...key,
            Body: bytes,
            ContentType: 'image/jpeg',
            IfNoneMatch: '*',
            Metadata: { 'lifemate-reservation': reservationToken },
          }),
        );
      } catch (cause) {
        if (cause?.$metadata?.httpStatusCode !== 412) throw cause;
        const existing = await send(new HeadObjectCommand(key));
        if (
          existing.ContentLength !== size ||
          existing.ContentType !== 'image/jpeg'
        )
          throw new Error('Migration destination differs from source');
        const proof = existing.Metadata?.['lifemate-reservation'];
        if (proof && proof !== reservationToken)
          throw new Error(
            'Migration destination belongs to another reservation',
          );
        if (!proof) {
          // Pre-rollout copies lack proof. Adopt only identical bytes, never
          // overwrite/delete an existing object based on size and MIME alone.
          const previous = await send(
            new GetObjectCommand({ ...key, IfMatch: existing.ETag }),
          );
          const copied = await previous.Body.transformToByteArray();
          if (
            copied.length !== size ||
            !copied.every((value, index) => value === bytes[index])
          )
            throw new Error('Migration destination differs from source');
        }
      }
      return bytes.length;
    }
    if (action === 'upload') {
      if (
        !Number.isSafeInteger(sizeBytes) ||
        sizeBytes < 1 ||
        sizeBytes > (privatePhoto ? 15728640 : 2097152)
      )
        throw new Error('Invalid memory photo size');
      return getSignedUrl(
        client,
        new PutObjectCommand({
          ...key,
          ContentType: privatePhoto
            ? `image/${PHOTO_TYPES[path.split('.').at(-1)]}`
            : 'image/jpeg',
          ContentLength: sizeBytes,
          ...(privatePhoto ? { IfNoneMatch: '*' } : {}),
        }),
        {
          expiresIn: 120,
          signableHeaders: new Set([
            'content-type',
            'content-length',
            ...(privatePhoto ? ['if-none-match'] : []),
          ]),
          ...(privatePhoto
            ? { unhoistableHeaders: new Set(['if-none-match']) }
            : {}),
        },
      );
    }
    if (action === 'download')
      return getSignedUrl(client, new GetObjectCommand(key), {
        expiresIn: 600,
      });
    if (action === 'head') {
      try {
        const result = await send(new HeadObjectCommand(key));
        return {
          sizeBytes: result.ContentLength,
          contentType: result.ContentType,
        };
      } catch (cause) {
        if (
          cause?.name === 'NotFound' ||
          cause?.$metadata?.httpStatusCode === 404
        )
          return null;
        throw cause;
      }
    }
    if (action === 'delete') {
      await send(new DeleteObjectCommand(key));
      return null;
    }
    throw new Error('Invalid R2 action');
  };
}
