/**
 * Contract Test Setup
 * Configuration for contract tests (5% of test suite)
 * Tests API contracts and external service interactions
 */

import './jest.setup';

// Contract test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3002'; // Different port for contract tests
process.env.JWT_SECRET = 'contract-test-jwt-secret';

// Mock external APIs for contract testing
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: '<html><body><h1>Contract Test Response</h1></body></html>',
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

// Contract test helpers
export const ContractTestHelpers = {
  /**
   * Create contract test request
   */
  createContractRequest: (endpoint: string, method: string = 'GET', body: any = {}) => {
    return {
      endpoint,
      method,
      body,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    };
  },

  /**
   * Create contract test response
   */
  createContractResponse: (statusCode: number = 200, body: any = {}) => {
    return {
      statusCode,
      body,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  },

  /**
   * Verify contract
   */
  verifyContract: (request: any, response: any, contract: any) => {
    // Verify request matches contract
    expect(request.endpoint).toBe(contract.request.endpoint);
    expect(request.method).toBe(contract.request.method);
    
    // Verify response matches contract
    expect(response.statusCode).toBe(contract.response.statusCode);
    
    // Verify response body structure matches contract
    Object.keys(contract.response.body).forEach(key => {
      expect(response.body).toHaveProperty(key);
    });
  }
};

// Global setup for contract tests
beforeAll(() => {
  console.log('Contract test setup complete');
});

afterAll(() => {
  console.log('Contract test teardown complete');
});

// Make helpers globally available for contract tests
(global as any).ContractTestHelpers = ContractTestHelpers;

export default ContractTestHelpers;
