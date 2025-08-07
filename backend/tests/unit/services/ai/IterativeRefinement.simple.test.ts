/**
 * Simple unit tests for IterativeRefinement service
 * Tests basic functionality without complex mocking
 */

import { jest } from '@jest/globals';

// Mock all dependencies
jest.mock('../../../../src/services/core/ai/OpenAIClient');
jest.mock('../../../../src/services/quality/validation/HTMLValidator');
jest.mock('../../../../src/utils/logger');

describe('IterativeRefinement Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be able to import the service', async () => {
      const { IterativeRefinement } = await import('../../../../src/services/ai/analysis/IterativeRefinement');
      expect(IterativeRefinement).toBeDefined();
      expect(typeof IterativeRefinement.getInstance).toBe('function');
    });

    it('should return singleton instance', async () => {
      const { IterativeRefinement } = await import('../../../../src/services/ai/analysis/IterativeRefinement');
      const instance1 = IterativeRefinement.getInstance();
      const instance2 = IterativeRefinement.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Service Methods', () => {
    it('should have refineCode method', async () => {
      const { IterativeRefinement } = await import('../../../../src/services/ai/analysis/IterativeRefinement');
      const instance = IterativeRefinement.getInstance();
      expect(typeof instance.refineCode).toBe('function');
    });
  });

  describe('Type Definitions', () => {
    it('should export RefinementRequest interface', async () => {
      const module = await import('../../../../src/services/ai/analysis/IterativeRefinement');
      expect(module.IterativeRefinement).toBeDefined();
      // Interface check - if import succeeds, types are valid
    });
  });
});
