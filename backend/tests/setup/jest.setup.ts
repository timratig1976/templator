/**
 * Jest Setup Configuration
 * Global test setup and utilities
 */

import { faker } from '@faker-js/faker';

// Set consistent seed for reproducible tests
faker.seed(12345);

// Global test timeout
jest.setTimeout(30000);

// Mock console methods in test environment
const originalConsole = global.console;

beforeAll(() => {
  // Suppress console output in tests unless explicitly needed
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
});

afterAll(() => {
  // Restore console
  global.console = originalConsole;
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidEmail(): R;
      toBeValidDate(): R;
      toHaveValidStructure(expectedKeys: string[]): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },

  toBeValidDate(received: any) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid date`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid date`,
        pass: false,
      };
    }
  },

  toHaveValidStructure(received: any, expectedKeys: string[]) {
    const receivedKeys = Object.keys(received || {});
    const missingKeys = expectedKeys.filter(key => !receivedKeys.includes(key));
    const pass = missingKeys.length === 0;
    
    if (pass) {
      return {
        message: () => `expected object not to have all required keys: ${expectedKeys.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected object to have all required keys. Missing: ${missingKeys.join(', ')}`,
        pass: false,
      };
    }
  }
});

// Global test helpers
export const TestHelpers = {
  /**
   * Wait for a specified amount of time
   */
  wait: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generate a random test string
   */
  randomString: (length: number = 10): string => {
    return faker.string.alphanumeric(length);
  },

  /**
   * Generate a random test number
   */
  randomNumber: (min: number = 1, max: number = 100): number => {
    return faker.number.int({ min, max });
  },

  /**
   * Create a mock function with specified return value
   */
  createMockWithReturn: <T>(returnValue: T): jest.MockedFunction<() => T> => {
    return jest.fn().mockReturnValue(returnValue);
  },

  /**
   * Create a mock function that resolves to specified value
   */
  createAsyncMockWithReturn: <T>(returnValue: T): jest.MockedFunction<() => Promise<T>> => {
    return jest.fn().mockResolvedValue(returnValue);
  },

  /**
   * Create a mock function that rejects with specified error
   */
  createAsyncMockWithError: (error: Error): jest.MockedFunction<() => Promise<never>> => {
    return jest.fn().mockRejectedValue(error);
  },

  /**
   * Assert that an object matches a partial structure
   */
  expectPartialMatch: <T>(received: T, expected: Partial<T>): void => {
    expect(received).toMatchObject(expected);
  },

  /**
   * Assert that an array contains objects with specific properties
   */
  expectArrayContainsObjects: <T>(array: T[], expectedObjects: Partial<T>[]): void => {
    expectedObjects.forEach(expectedObj => {
      expect(array).toContainEqual(expect.objectContaining(expectedObj));
    });
  },

  /**
   * Clean up test data
   */
  cleanup: async (): Promise<void> => {
    // Add cleanup logic here (database cleanup, file cleanup, etc.)
    // This will be called after each test
  }
};

// Make TestHelpers globally available
(global as any).TestHelpers = TestHelpers;

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

export default TestHelpers;
