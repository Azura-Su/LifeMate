const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  {
    ignores: [
      '.build/**',
      'dist/**',
      'coverage/**',
      'android/**',
      'ios/**',
      'modules/*/android/build/**',
      'modules/*/android/.gradle/**',
      'modules/*/android/.cxx/**',
      'server/node_modules/**',
      'supabase/functions/node_modules/**',
      'supabase/functions/audio-access/index.ts',
    ],
  },
  {
    // Deno resolves AWS imports through each Edge Function's deno.json.
    files: [
      'supabase/functions/memory-access/**',
      'supabase/functions/user-admin/**',
    ],
    rules: {
      'import/no-unresolved': [
        'error',
        { ignore: ['^@aws-sdk/', '^@smithy/fetch-http-handler$'] },
      ],
    },
  },
]);
