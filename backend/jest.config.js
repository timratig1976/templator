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
      roots: ['<rootDir>/src'],
      testMatch: ['<rootDir>/src/__tests__/unit/**/*.test.ts'],
      transform: {
        '^.+\.ts$': 'ts-jest',
      },
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.jest.json'
        }
      },
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/unit/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1'
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
      roots: ['<rootDir>/src'],
      testMatch: ['<rootDir>/src/__tests__/e2e/**/*.test.ts'],
      transform: {
        '^.+\.ts$': 'ts-jest',
      },
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.jest.json'
        }
      },
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/unit/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1'
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
      roots: ['<rootDir>/src'],
      testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.ts'],
      transform: {
        '^.+\.ts$': 'ts-jest',
      },
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.jest.json'
        }
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1'
      },

      maxWorkers: 1 // Integration tests may need sequential execution
    }
  ],
  // Global configuration
  coverageDirectory: 'coverage',
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
