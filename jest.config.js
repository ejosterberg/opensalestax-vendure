// SPDX-License-Identifier: Apache-2.0

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    'src/strategies/**/*.ts': { branches: 70, lines: 80 },
    'src/lib/ostax-client.ts': { branches: 70, lines: 80 },
    global: { lines: 80 },
  },
  clearMocks: true,
  testTimeout: 30000,
};
