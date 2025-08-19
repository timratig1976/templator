const path = require('path');

// Output coverage to app root reports directory for consolidated artifacts
const COVERAGE_DIR = path.join(__dirname, '..', 'reports', 'tests', 'backend', 'coverage');

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
      // Point to consolidated root tests directory
      roots: ['<rootDir>/../tests/backend'],
      testMatch: [
        '<rootDir>/../tests/backend/jest/unit/**/*.test.ts'
      ],
      transform: {
        '^.+\.ts$': 'ts-jest',
      },
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.jest.json'
        }
      },
      // Setup file for unit tests (new structure)
      setupFilesAfterEnv: [
        '<rootDir>/../tests/backend/jest/unit/setup.ts'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@backend/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/../tests/backend/runner/$1',
        '^@tests-config/(.*)$': '<rootDir>/../tests/backend/config/$1',
        // Legacy relative imports from tests → map to src
        '^(\\.\\./){3}services/(.*)$': '<rootDir>/src/services/$2',
        '^\\.\\./\\.\\./services/(.*)$': '<rootDir>/src/services/$1',
        '^\\.\\./\\.\\./utils/logger$': '<rootDir>/src/utils/logger',
        '^\\.\\./\\.\\./app$': '<rootDir>/src/app'
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
      roots: ['<rootDir>/../tests/backend'],
      testMatch: [
        '<rootDir>/../tests/backend/jest/e2e/**/*.test.ts'
      ],
      transform: {
        '^.+\.ts$': 'ts-jest',
      },
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.jest.json'
        }
      },
      setupFilesAfterEnv: [
        '<rootDir>/../tests/backend/jest/unit/setup.ts'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@backend/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/../tests/backend/runner/$1',
        '^@tests-config/(.*)$': '<rootDir>/../tests/backend/config/$1',
        '^(\\.\\./){3}services/(.*)$': '<rootDir>/src/services/$2',
        '^\\.\\./\\.\\./services/(.*)$': '<rootDir>/src/services/$1',
        '^\\.\\./\\.\\./utils/logger$': '<rootDir>/src/utils/logger',
        '^\\.\\./\\.\\./app$': '<rootDir>/src/app'
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
      roots: ['<rootDir>/../tests/backend'],
      testMatch: [
        '<rootDir>/../tests/backend/jest/integration/**/*.test.ts'
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
        '^@backend/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/../tests/backend/runner/$1',
        '^@tests-config/(.*)$': '<rootDir>/../tests/backend/config/$1',
        '^\.\./\.\./services/(.*)$': '<rootDir>/src/services/$1',
        '^\.\./\.\./utils/logger$': '<rootDir>/src/utils/logger',
        '^\.\./\.\./app$': '<rootDir>/src/app'
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
