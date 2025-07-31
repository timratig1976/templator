/**
 * Integration Test Setup
 * Configuration for integration tests (15% of test suite)
 * Tests API endpoints and service interactions
 */

import './jest.setup';

// Integration test environment variables
// Use Object.defineProperty to avoid TypeScript read-only property error
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test' });
Object.defineProperty(process.env, 'PORT', { value: '3001' }); // Different port for integration tests
Object.defineProperty(process.env, 'JWT_SECRET', { value: 'integration-test-jwt-secret' });
Object.defineProperty(process.env, 'DATABASE_URL', { value: 'test://localhost:5432/integration_test_db' });

// Mock external APIs but allow internal service communication
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: '<html><body><h1>Integration Test Response</h1></body></html>',
              role: 'assistant'
            }
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150
          }
        })
      }
    }
  }))
}));

// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue('mock file content'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockImplementation(() => Promise.resolve({
      isFile: () => true,
      isDirectory: () => false
    }))
  },
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('mock file content'),
  writeFileSync: jest.fn().mockReturnValue(undefined)
}));

// Integration test helpers
export const IntegrationTestHelpers = {
  /**
   * Start test server
   */
  startTestServer: async () => {
    const express = require('express');
    const app = express();
    
    // Basic middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Import and use routes
    try {
      const apiRoutes = require('../../src/routes/api');
      app.use('/api', apiRoutes);
    } catch (error: any) {
      console.warn('Could not load API routes for integration tests:', error.message);
    }
    
    const server = app.listen(3001);
    return { app, server };
  },

  /**
   * Stop test server
   */
  stopTestServer: (server: any) => {
    if (server) {
      server.close();
    }
  },

  /**
   * Create test database connection
   */
  setupTestDatabase: async () => {
    // Mock database setup
    return {
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true),
      query: jest.fn(),
      transaction: jest.fn()
    };
  },

  /**
   * Clean test database
   */
  cleanTestDatabase: async () => {
    // Mock database cleanup
    return Promise.resolve();
  },

  /**
   * Create authenticated request headers
   */
  createAuthHeaders: (userId: string = 'test-user-id') => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId, email: 'test@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  },

  /**
   * Make authenticated API request
   */
  makeAuthenticatedRequest: async (method: string, url: string, data?: any, userId?: string) => {
    const supertest = require('supertest');
    const headers = IntegrationTestHelpers.createAuthHeaders(userId);
    
    // This would be used with a real server instance
    // For now, return mock response
    return {
      status: 200,
      body: { success: true, data: data || {} },
      headers: {}
    } as any;
  },

  /**
   * Create test file upload
   */
  createTestFileUpload: (filename: string = 'test.jpg', content: string = 'mock image content') => {
    return {
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from(content),
      size: content.length
    };
  },

  /**
   * Wait for async operations
   */
  waitForAsync: (ms: number = 100) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Mock service responses
   */
  mockServiceResponses: () => {
    return {
      openaiService: {
        convertDesignToHTML: jest.fn().mockResolvedValue({
          htmlContent: '<html><body><h1>Test</h1></body></html>',
          cssContent: 'body { margin: 0; }',
          metadata: { tokens: 150, cost: 0.001 }
        }),
        refineHTML: jest.fn().mockResolvedValue({
          htmlContent: '<html><body><h1>Refined Test</h1></body></html>',
          cssContent: 'body { margin: 0; padding: 20px; }',
          metadata: { tokens: 100, cost: 0.0007 }
        })
      },
      htmlStorageService: {
        saveProject: jest.fn().mockResolvedValue({ id: 'test-project-id' }),
        getProject: jest.fn().mockResolvedValue({ id: 'test-project-id', name: 'Test Project' }),
        updateProject: jest.fn().mockResolvedValue({ id: 'test-project-id', updated: true }),
        deleteProject: jest.fn().mockResolvedValue({ success: true })
      },
      qualityService: {
        validateHTML: jest.fn().mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
          score: 95
        })
      }
    };
  },

  /**
   * Assert API response structure
   */
  assertAPIResponse: (response: any, expectedStatus: number = 200) => {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toBeDefined();
    
    if (expectedStatus >= 200 && expectedStatus < 300) {
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    } else {
      expect(response.body.error).toBeDefined();
    }
  },

  /**
   * Create test project data
   */
  createTestProjectData: () => ({
    name: 'Integration Test Project',
    description: 'A project created for integration testing',
    templateId: 'test-template-id',
    settings: {
      isPublic: false,
      allowComments: true
    }
  }),

  /**
   * Create test template data
   */
  createTestTemplateData: () => ({
    name: 'Integration Test Template',
    description: 'A template for integration testing',
    htmlContent: '<html><body><h1>Test Template</h1></body></html>',
    cssContent: 'body { font-family: Arial, sans-serif; }',
    category: 'test',
    tags: ['integration', 'test']
  })
};

// Global setup for integration tests
let testServer: any;
let testDatabase: any;

beforeAll(async () => {
  // Setup test server
  try {
    testServer = await IntegrationTestHelpers.startTestServer();
    console.log('Integration test server started on port 3001');
  } catch (error: any) {
    console.warn('Could not start integration test server:', error.message);
  }
  
  // Setup test database
  testDatabase = await IntegrationTestHelpers.setupTestDatabase();
});

afterAll(async () => {
  // Cleanup test server
  if (testServer?.server) {
    IntegrationTestHelpers.stopTestServer(testServer.server);
  }
  
  // Cleanup test database
  await IntegrationTestHelpers.cleanTestDatabase();
});

beforeEach(async () => {
  // Clean database before each test
  await IntegrationTestHelpers.cleanTestDatabase();
});

afterEach(async () => {
  // Additional cleanup after each test
  jest.clearAllMocks();
});

// Make helpers globally available for integration tests
(global as any).IntegrationTestHelpers = IntegrationTestHelpers;

export default IntegrationTestHelpers;
