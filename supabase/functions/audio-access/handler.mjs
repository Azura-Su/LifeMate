const formats = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  caf: 'audio/x-caf',
};
const allowedKeys = ['action', 'id', 'fileName', 'mimeType', 'sizeBytes'];
const json = (status, value) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

async function readInput(request) {
  if (!request.body) throw new Error('Missing body');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2048) {
        await reader.cancel();
        throw new Error('Body too large');
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
  const input = JSON.parse(new TextDecoder().decode(bytes));
  const extension =
    typeof input?.fileName === 'string' ? input.fileName.split('.').pop() : '';
  const validFileIdentity =
    typeof input?.id === 'string' &&
    /^[a-zA-Z0-9_-]{1,128}$/.test(input.id) &&
    typeof input?.fileName === 'string' &&
    /^[\w-]+\.[a-z0-9]+$/.test(input.fileName) &&
    input.fileName.startsWith(`${input.id}.`) &&
    Object.hasOwn(formats, extension);
  const validMediaMetadata =
    input?.action === 'delete' ||
    (formats[extension] === input?.mimeType &&
      Number.isSafeInteger(input?.sizeBytes) &&
      input.sizeBytes >= 1 &&
      input.sizeBytes <= 50 * 1024 * 1024);
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowedKeys.includes(key)) ||
    !['upload', 'download', 'delete', 'confirm'].includes(input.action) ||
    !validFileIdentity ||
    !validMediaMetadata
  )
    throw new Error('Invalid input');
  return input;
}

export function createHandler({
  verifyToken,
  signObject,
  reserveUpload,
  confirmUpload,
  releaseUpload,
}) {
  if (
    typeof reserveUpload !== 'function' ||
    typeof confirmUpload !== 'function' ||
    typeof releaseUpload !== 'function'
  )
    throw new Error('Audio quota configuration is required');
  return async (request) => {
    if (request.method !== 'POST')
      return json(405, { code: 'method-not-allowed' });
    // Native iOS/Android clients only; no browser CORS access.
    if (request.headers.has('origin'))
      return json(403, { code: 'origin-not-allowed' });
    const authorization = request.headers.get('authorization') ?? '';
    if (!authorization.startsWith('Bearer ') || authorization.length > 8192)
      return json(401, { code: 'unauthenticated' });
    let uid;
    try {
      uid = await verifyToken(authorization.slice(7));
    } catch {
      return json(401, { code: 'unauthenticated' });
    }
    let input;
    try {
      input = await readInput(request);
    } catch {
      return json(400, { code: 'invalid-audio' });
    }
    try {
      const path = `audio/${uid}/${input.id}/${input.fileName}`;
      if (input.action === 'confirm')
        return (await confirmUpload(uid, path))
          ? json(200, { confirmed: true })
          : json(409, { code: 'audio-upload-not-found' });
      if (
        input.action === 'upload' &&
        !(await reserveUpload(uid, path, input.sizeBytes))
      )
        return json(429, { code: 'audio-quota-exceeded' });
      const result = await signObject(input.action, path);
      if (input.action === 'delete') await releaseUpload(uid, path);
      return input.action === 'delete'
        ? json(200, { deleted: true })
        : json(200, { url: result });
    } catch {
      if (input.action === 'upload') {
        const path = `audio/${uid}/${input.id}/${input.fileName}`;
        await releaseUpload(uid, path).catch(() => undefined);
      }
      return json(503, { code: 'storage-unavailable' });
    }
  };
}
