import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';

test('migration versions are unique and R2 columns precede dependent migrations', () => {
  const files = readdirSync(new URL('../../migrations/', import.meta.url))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const versions = files.map((file) => file.split('_')[0]);
  assert.equal(
    new Set(versions).size,
    versions.length,
    'Duplicate schema_migrations version',
  );
  const r2 = files.findIndex((file) => file.endsWith('_memory_r2.sql'));
  for (const suffix of [
    '_memory_r2_cleanup.sql',
    '_private_memory_deletions.sql',
  ]) {
    assert.ok(r2 >= 0 && files.findIndex((file) => file.endsWith(suffix)) > r2);
  }
});
