import { jest } from '@jest/globals';

// Track intervals for cleanup
const activeIntervals: NodeJS.Timeout[] = [];
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

// Mock environment variables
Object.assign(process.env, {
  NODE_ENV: 'test',
  OPENAI_API_KEY: 'test-api-key',
  LOG_LEVEL: 'error'
});

// Mock setInterval to track and prevent actual timers in tests
global.setInterval = jest.fn((callback: Function, delay: number) => {
  // In test environment, don't actually create intervals
  // Just return a mock timer ID
  const mockTimerId = Math.random() * 1000;
  return mockTimerId as any;
}) as any;

// Mock clearInterval
global.clearInterval = jest.fn();

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test cleanup
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // Clear any remaining intervals
  activeIntervals.forEach(interval => {
    originalClearInterval(interval);
  });
  activeIntervals.length = 0;
});

// Export cleanup utilities for tests that need them
export const testUtils = {
  clearAllIntervals: () => {
    activeIntervals.forEach(interval => {
      originalClearInterval(interval);
    });
    activeIntervals.length = 0;
  },
  restoreTimers: () => {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }
};

// Mock fetch globally for tests
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
