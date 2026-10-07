const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  { ignores: ['.build/**', 'dist/**', 'coverage/**', 'android/**', 'ios/**', 'server/node_modules/**'] },
]);
