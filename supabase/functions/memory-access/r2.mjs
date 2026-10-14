import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ACCOUNT_ID = /^[a-f0-9]{32}$/;
const BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const OBJECT_PATH =
  /^shared\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}\/photo\.jpg$/;

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
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  const object = (path) => {
    if (!OBJECT_PATH.test(path)) throw new Error('Invalid memory photo path');
    return { Bucket: bucket, Key: path };
  };
  return async function r2(action, path, sizeBytes) {
    const key = object(path);
    if (action === 'copy') {
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
      await client.send(
        new PutObjectCommand({
          ...key,
          Body: bytes,
          ContentType: 'image/jpeg',
        }),
      );
      return bytes.length;
    }
    if (action === 'upload') {
      if (
        !Number.isSafeInteger(sizeBytes) ||
        sizeBytes < 1 ||
        sizeBytes > 2097152
      )
        throw new Error('Invalid memory photo size');
      return getSignedUrl(
        client,
        new PutObjectCommand({
          ...key,
          ContentType: 'image/jpeg',
          ContentLength: sizeBytes,
        }),
        {
          expiresIn: 120,
          signableHeaders: new Set(['content-type', 'content-length']),
        },
      );
    }
    if (action === 'download')
      return getSignedUrl(client, new GetObjectCommand(key), {
        expiresIn: 600,
      });
    if (action === 'head') {
      try {
        const result = await client.send(new HeadObjectCommand(key));
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
      await client.send(new DeleteObjectCommand(key));
      return null;
    }
    throw new Error('Invalid R2 action');
  };
}
