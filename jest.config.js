module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/src/testing/setupSecurity.ts'],
  collectCoverageFrom: ['src/utils/**/*.ts', 'src/services/**/*.ts'],
};
