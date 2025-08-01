import { jest } from '@jest/globals';

// Mock environment variables
// Use Object.assign to properly set environment variables in tests
Object.assign(process.env, {
  NODE_ENV: 'test',
  OPENAI_API_KEY: 'test-api-key',
  LOG_LEVEL: 'error'
});

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock fetch globally for tests
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
