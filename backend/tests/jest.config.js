/**
 * Enhanced Jest Configuration for Testing Pyramid
 * Supports unit, integration, e2e, and contract testing
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory
  rootDir: './',
  
  // Test directories
  testMatch: [
    '<rootDir>/**/*.test.ts',
    '<rootDir>/**/*.spec.ts'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  
  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    '^@fixtures/(.*)$': '<rootDir>/fixtures/$1',
    '^@tests/(.*)$': '<rootDir>/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/setup/jest.setup.ts'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/../coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  
  // Coverage thresholds (Testing Pyramid: 80% unit, 15% integration, 5% e2e)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Higher thresholds for critical services
    '../src/services/ai/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    '../src/services/quality/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    '../src/**/*.{ts,tsx}',
    '!../src/**/*.d.ts',
    '!../src/**/*.interface.ts',
    '!../src/**/*.type.ts',
    '!../src/index.ts',
    '!../src/server.ts'
  ],
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Projects for different test types
  projects: [
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/setup/integration.setup.ts'],
      // timeout is set in the setup file using jest.setTimeout()
    },
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/unit/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/setup/unit.setup.ts'],
      // timeout is set in the setup file using jest.setTimeout()
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/e2e/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/setup/e2e.setup.ts']
      // timeout is set in e2e.setup.ts using jest.setTimeout()
    },
    {
      displayName: 'contracts',
      testMatch: ['<rootDir>/contracts/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/setup/contracts.setup.ts']
    }
  ],
  
  // Global setup and teardown (commented out until files exist)
  // globalSetup: '<rootDir>/tests/setup/global.setup.ts',
  // globalTeardown: '<rootDir>/tests/setup/global.teardown.ts',
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Watch mode configuration
  watchman: true,
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/'
  ],
  
  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html-report',
        filename: 'report.html',
        expand: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage',
        outputName: 'junit.xml'
      }
    ]
  ],
  
  // Mock configuration
  modulePathIgnorePatterns: [
    '<rootDir>/dist/'
  ],
  
  // Preset
  preset: 'ts-jest'
};
