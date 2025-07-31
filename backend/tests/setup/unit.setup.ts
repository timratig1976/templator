/**
 * Unit Test Setup
 * Configuration specific to unit tests (80% of test suite)
 */

import './jest.setup';

// Set timeout for unit tests
jest.setTimeout(60000);

// Mock external dependencies for unit tests
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn()
  },
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => '/' + args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  })
}));

// Mock HTTP requests
jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn()
    }))
  }
}));

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}));

// Mock database connections
jest.mock('../../src/config/database', () => ({
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
  getDatabase: jest.fn()
}));

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock environment variables
(process.env as any).NODE_ENV = 'test';
(process.env as any).JWT_SECRET = 'test-jwt-secret';
(process.env as any).OPENAI_API_KEY = 'test-openai-key';
(process.env as any).DATABASE_URL = 'test://localhost:5432/test_db';

// Unit test specific helpers
export const UnitTestHelpers = {
  /**
   * Create a mock service with common methods
   */
  createMockService: () => ({
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }),

  /**
   * Create a mock repository
   */
  createMockRepository: () => ({
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  }),

  /**
   * Create a mock Express request
   */
  createMockRequest: (overrides: any = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides
  }),

  /**
   * Create a mock Express response
   */
  createMockResponse: () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  },

  /**
   * Create a mock Express next function
   */
  createMockNext: () => jest.fn(),

  /**
   * Mock a successful OpenAI response
   */
  mockOpenAISuccess: (content: string = 'Mock AI response') => ({
    choices: [{
      message: {
        content,
        role: 'assistant'
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    },
    model: 'gpt-4',
    id: 'test-completion-id',
    object: 'chat.completion',
    created: Date.now()
  }),

  /**
   * Mock an OpenAI error
   */
  mockOpenAIError: (message: string = 'OpenAI API Error') => {
    const error = new Error(message);
    (error as any).response = {
      status: 500,
      data: { error: { message } }
    };
    return error;
  },

  /**
   * Reset all mocks
   */
  resetAllMocks: () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  }
};

// Make helpers globally available for unit tests
(global as any).UnitTestHelpers = UnitTestHelpers;

// Setup and teardown for each unit test
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Additional cleanup if needed
  UnitTestHelpers.resetAllMocks();
});

export default UnitTestHelpers;
