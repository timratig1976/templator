const nextJest = require('next/jest')
const path = require('path')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  roots: ['<rootDir>', '<rootDir>/../tests/frontend'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/../tests/frontend/**/*.test.ts',
    '<rootDir>/../tests/frontend/**/*.test.tsx',
    '<rootDir>/../tests/frontend/**/*.test.js',
    '<rootDir>/../tests/frontend/**/*.test.jsx'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/app/layout.tsx'
  ],
  // Consolidated coverage output at app root
  coverageDirectory: path.join(__dirname, '..', 'reports', 'tests', 'frontend', 'coverage'),
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testTimeout: 10000,
  verbose: true
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
