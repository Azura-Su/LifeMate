const fs = require('node:fs');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  ref,
  uploadBytes,
  deleteObject,
  getMetadata,
} = require('firebase/storage');

async function main() {
  // Cross-service Storage rules query the CLI emulator's project database.
  const environment = await initializeTestEnvironment({
    projectId: 'demo-lifemate',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: fs.readFileSync('firebase/firestore.rules', 'utf8'),
    },
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: fs.readFileSync('firebase/storage.rules', 'utf8'),
    },
  });
  try {
    const stale = environment.authenticatedContext('u1', { auth_time: 99 });
    const fresh = environment.authenticatedContext('u1', { auth_time: 100 });
    const file = ref(fresh.storage(), 'audio/u1/track/track.mp3');
    const staleFile = ref(stale.storage(), file.fullPath);
    const bytes = new Uint8Array([1, 2, 3]);
    const metadata = {
      contentType: 'audio/mpeg',
      customMetadata: { ownerId: 'u1' },
    };
    await assertSucceeds(uploadBytes(file, bytes, metadata));
    const privatePhoto = ref(fresh.storage(), 'memories/u1/memory-1/photo.jpg');
    const privateMetadata = {
      contentType: 'image/jpeg',
      customMetadata: { ownerId: 'u1', memoryId: 'memory-1' },
    };
    await assertSucceeds(uploadBytes(privatePhoto, bytes, privateMetadata));
    await assertSucceeds(getMetadata(privatePhoto));
    await assertFails(uploadBytes(privatePhoto, bytes, privateMetadata)); // Immutable filename.
    await assertFails(
      uploadBytes(ref(fresh.storage(), 'memories/u1/memory-1/bad.jpg'), bytes, {
        ...privateMetadata,
        contentType: 'video/mp4',
      }),
    );
    for (const outsider of [
      environment.authenticatedContext('u2'),
      environment.unauthenticatedContext(),
    ]) {
      const target = ref(outsider.storage(), privatePhoto.fullPath);
      await assertFails(getMetadata(target));
      await assertFails(deleteObject(target));
      await assertFails(
        uploadBytes(
          ref(outsider.storage(), 'memories/u1/memory-1/new.jpg'),
          bytes,
          privateMetadata,
        ),
      );
    }

    for (const outsider of [
      environment.authenticatedContext('u2', { auth_time: 100 }),
      environment.unauthenticatedContext(),
    ]) {
      const foreignFile = ref(outsider.storage(), file.fullPath);
      await assertFails(getMetadata(foreignFile));
      await assertFails(uploadBytes(foreignFile, bytes, metadata));
      await assertFails(deleteObject(foreignFile));
      await assertFails(
        uploadBytes(
          ref(outsider.storage(), 'audio/u1/foreign/foreign.mp3'),
          bytes,
          metadata,
        ),
      );
    }

    for (const status of ['disabled', 'deleting', 'deleted']) {
      await environment.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .doc('accountAccess/u1')
          .set({ status, validSince: 100 });
      });
      await assertFails(getMetadata(file));
      await assertFails(getMetadata(privatePhoto));
      await assertFails(uploadBytes(file, bytes, metadata));
      await assertFails(deleteObject(file));
    }
    await environment.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc('accountAccess/u1')
        .set({ status: 'active', validSince: 100 });
    });
    await assertFails(getMetadata(staleFile));
    await assertFails(getMetadata(ref(stale.storage(), privatePhoto.fullPath)));
    await assertSucceeds(getMetadata(privatePhoto));
    await assertSucceeds(deleteObject(privatePhoto));
    await assertSucceeds(getMetadata(file));
    await assertSucceeds(deleteObject(file));
    process.stdout.write(
      'Storage rules: foreign/unauthenticated users, locked/deleted users and revoked sessions denied.\n',
    );
  } finally {
    await environment.cleanup();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
