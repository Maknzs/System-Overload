/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/test/setup-env.js'],
  verbose: false,
  roots: ['<rootDir>'],
  moduleFileExtensions: ['js', 'json'],
  resetModules: true,
  clearMocks: true,
};
