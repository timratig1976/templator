const path = require('path');

// Output coverage to tests/.artifacts to keep all test-related files together
const COVERAGE_DIR = path.join(process.cwd(), 'tests', '.artifacts', 'jest', 'coverage');

module.exports = {
  // Multi-project configuration for organized test structure
  projects: [
    {
      displayName: {
        name: 'UNIT',
        color: 'green'
      },
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests'],
      // Support transitional layout: tests/tests/* (after folder rename) and future tests/jest/*
      testMatch: [
        '<rootDir>/tests/tests/unit/**/*.test.ts',
        '<rootDir>/tests/jest/unit/**/*.test.ts'
      ],
      transform: {
        '^.+\.ts$': 'ts-jest',
      },
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.jest.json'
        }
      },
      // Transitional setup path; later move to tests/jest/unit/setup.ts
      setupFilesAfterEnv: ['<rootDir>/tests/tests/unit/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/tests/runner/$1'
      },

      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
        '!src/server.ts'
      ]
    },
    {
      displayName: {
        name: 'E2E',
        color: 'blue'
      },
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests'],
      testMatch: [
        '<rootDir>/tests/tests/e2e/**/*.test.ts',
        '<rootDir>/tests/jest/e2e/**/*.test.ts'
      ],
      transform: {
        '^.+\.ts$': 'ts-jest',
      },
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.jest.json'
        }
      },
      setupFilesAfterEnv: ['<rootDir>/tests/tests/unit/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/tests/runner/$1'
      },

      maxWorkers: 1 // E2E tests should run sequentially
    },
    {
      displayName: {
        name: 'INTEGRATION',
        color: 'yellow'
      },
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests'],
      testMatch: [
        '<rootDir>/tests/tests/integration/**/*.test.ts',
        '<rootDir>/tests/jest/integration/**/*.test.ts'
      ],
      transform: {
        '^.+\.ts$': 'ts-jest',
      },
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.jest.json'
        }
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/tests/runner/$1'
      },

      maxWorkers: 1 // Integration tests may need sequential execution
    }
  ],
  // Global configuration
  coverageDirectory: COVERAGE_DIR,
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 30000, // Default timeout for all tests
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/server.ts'
  ]
};
