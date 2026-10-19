import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';

export function createR2Cleanup(config) {
  if (
    !/^[a-f0-9]{32}$/.test(config.accountId ?? '') ||
    !config.bucket ||
    !config.accessKeyId ||
    !config.secretAccessKey
  )
    throw new Error('Missing R2 cleanup configuration');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return {
    list: (prefix) =>
      client.send(
        new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: prefix,
          MaxKeys: 50,
        }),
        { abortSignal: AbortSignal.timeout(8000) },
      ),
    async remove(objects) {
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: { Objects: objects },
        }),
        { abortSignal: AbortSignal.timeout(8000) },
      );
      if (result.Errors?.length) throw new Error('R2 deletion failed');
    },
  };
}
