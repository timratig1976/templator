import { PipelineOrchestrator } from '../../../pipeline/orchestrator/PipelineOrchestrator';
import { PipelineRequest, PipelineResult, PipelinePhase } from '../../../pipeline/types/PipelineTypes';
import { InputProcessingPhase } from '../../../pipeline/phases/InputProcessingPhase';
import { AIGenerationPhase } from '../../../pipeline/phases/AIGenerationPhase';
import { QualityAssurancePhase } from '../../../pipeline/phases/QualityAssurancePhase';
import { EnhancementPhase } from '../../../pipeline/phases/EnhancementPhase';
import { ModulePackagingPhase } from '../../../pipeline/phases/ModulePackagingPhase';

// Mock all phase handlers
jest.mock('../../../pipeline/phases/InputProcessingPhase');
jest.mock('../../../pipeline/phases/AIGenerationPhase');
jest.mock('../../../pipeline/phases/QualityAssurancePhase');
jest.mock('../../../pipeline/phases/EnhancementPhase');
jest.mock('../../../pipeline/phases/ModulePackagingPhase');

describe('PipelineOrchestrator', () => {
  let orchestrator: PipelineOrchestrator;
  let mockRequest: PipelineRequest;

  beforeEach(() => {
    orchestrator = new PipelineOrchestrator();
    
    mockRequest = {
      id: 'test-pipeline-123',
      input: {
        type: 'image',
        data: Buffer.from('test-image-data'),
        metadata: {
          filename: 'test.png',
          size: 1024,
          mimeType: 'image/png'
        }
      },
      options: {
        aiModel: 'gpt-4',
        qualityThreshold: 0.8,
        maxRetries: 3,
        enableEnhancement: true
      },
      context: {
        userId: 'user-123',
        sessionId: 'session-456',
        timestamp: new Date().toISOString()
      }
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('executePipeline', () => {
    it('should execute all phases successfully', async () => {
      // Mock successful phase executions
      const mockInputResult = { success: true, data: { processedInput: 'processed' }, metadata: {} };
      const mockAIResult = { success: true, data: { generatedHTML: '<div>test</div>' }, metadata: {} };
      const mockQAResult = { success: true, data: { qualityScore: 0.9 }, metadata: {} };
      const mockEnhancementResult = { success: true, data: { enhancedHTML: '<div>enhanced</div>' }, metadata: {} };
      const mockPackagingResult = { success: true, data: { finalModule: 'module-data' }, metadata: {} };

      (InputProcessingPhase.prototype.execute as jest.Mock).mockResolvedValue(mockInputResult);
      (AIGenerationPhase.prototype.execute as jest.Mock).mockResolvedValue(mockAIResult);
      (QualityAssurancePhase.prototype.execute as jest.Mock).mockResolvedValue(mockQAResult);
      (EnhancementPhase.prototype.execute as jest.Mock).mockResolvedValue(mockEnhancementResult);
      (ModulePackagingPhase.prototype.execute as jest.Mock).mockResolvedValue(mockPackagingResult);

      const result = await orchestrator.executePipeline(mockRequest);

      expect(result.success).toBe(true);
      expect(result.pipelineId).toBe('test-pipeline-123');
      expect(result.phases).toHaveLength(5);
      expect(result.phases.every(phase => phase.success)).toBe(true);
    });

    it('should handle phase failures gracefully', async () => {
      // Mock input phase failure
      const mockInputResult = { 
        success: false, 
        error: new Error('Input processing failed'),
        data: null,
        metadata: {}
      };

      (InputProcessingPhase.prototype.execute as jest.Mock).mockResolvedValue(mockInputResult);

      const result = await orchestrator.executePipeline(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.phases).toHaveLength(1); // Only input phase executed
      expect(result.phases[0].success).toBe(false);
    });

    it('should skip enhancement phase when disabled', async () => {
      // Disable enhancement
      mockRequest.options.enableEnhancement = false;

      const mockInputResult = { success: true, data: { processedInput: 'processed' }, metadata: {} };
      const mockAIResult = { success: true, data: { generatedHTML: '<div>test</div>' }, metadata: {} };
      const mockQAResult = { success: true, data: { qualityScore: 0.9 }, metadata: {} };
      const mockPackagingResult = { success: true, data: { finalModule: 'module-data' }, metadata: {} };

      (InputProcessingPhase.prototype.execute as jest.Mock).mockResolvedValue(mockInputResult);
      (AIGenerationPhase.prototype.execute as jest.Mock).mockResolvedValue(mockAIResult);
      (QualityAssurancePhase.prototype.execute as jest.Mock).mockResolvedValue(mockQAResult);
      (ModulePackagingPhase.prototype.execute as jest.Mock).mockResolvedValue(mockPackagingResult);

      const result = await orchestrator.executePipeline(mockRequest);

      expect(result.success).toBe(true);
      expect(result.phases).toHaveLength(4); // No enhancement phase
      expect(EnhancementPhase.prototype.execute).not.toHaveBeenCalled();
    });

    it('should retry failed phases up to maxRetries', async () => {
      // Mock AI phase to fail twice then succeed
      const mockInputResult = { success: true, data: { processedInput: 'processed' }, metadata: {} };
      const mockAIFailure = { 
        success: false, 
        error: new Error('AI generation failed'),
        data: null,
        metadata: {}
      };
      const mockAISuccess = { success: true, data: { generatedHTML: '<div>test</div>' }, metadata: {} };

      (InputProcessingPhase.prototype.execute as jest.Mock).mockResolvedValue(mockInputResult);
      (AIGenerationPhase.prototype.execute as jest.Mock)
        .mockResolvedValueOnce(mockAIFailure)
        .mockResolvedValueOnce(mockAIFailure)
        .mockResolvedValueOnce(mockAISuccess);

      const result = await orchestrator.executePipeline(mockRequest);

      expect(AIGenerationPhase.prototype.execute).toHaveBeenCalledTimes(3);
      expect(result.phases[1].retryCount).toBe(2);
    });
  });

  describe('getProgress', () => {
    it('should return correct progress information', async () => {
      // Start pipeline execution
      const pipelinePromise = orchestrator.executePipeline(mockRequest);

      // Get progress immediately
      const progress = orchestrator.getProgress('test-pipeline-123');

      expect(progress).toBeDefined();
      expect(progress.pipelineId).toBe('test-pipeline-123');
      expect(progress.status).toBe('running');
      expect(progress.currentPhase).toBeDefined();

      // Wait for completion to avoid hanging test
      await pipelinePromise;
    });

    it('should return null for non-existent pipeline', () => {
      const progress = orchestrator.getProgress('non-existent-pipeline');
      expect(progress).toBeNull();
    });
  });

  describe('cancelPipeline', () => {
    it('should cancel running pipeline', async () => {
      // Mock a long-running phase
      (InputProcessingPhase.prototype.execute as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      // Start pipeline
      const pipelinePromise = orchestrator.executePipeline(mockRequest);

      // Cancel immediately
      const cancelled = orchestrator.cancelPipeline('test-pipeline-123');

      expect(cancelled).toBe(true);

      // Wait for pipeline to complete (should be cancelled)
      const result = await pipelinePromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('cancelled');
    });

    it('should return false for non-existent pipeline', () => {
      const cancelled = orchestrator.cancelPipeline('non-existent-pipeline');
      expect(cancelled).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock phase to throw unexpected error
      (InputProcessingPhase.prototype.execute as jest.Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await orchestrator.executePipeline(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Unexpected error');
    });

    it('should validate pipeline request', async () => {
      const invalidRequest = {
        ...mockRequest,
        id: '', // Invalid empty ID
      };

      const result = await orchestrator.executePipeline(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid pipeline request');
    });
  });

  describe('performance tracking', () => {
    it('should track execution time for each phase', async () => {
      const mockInputResult = { success: true, data: { processedInput: 'processed' }, metadata: {} };
      (InputProcessingPhase.prototype.execute as jest.Mock).mockResolvedValue(mockInputResult);

      const result = await orchestrator.executePipeline(mockRequest);

      expect(result.phases[0].executionTime).toBeGreaterThan(0);
      expect(result.totalExecutionTime).toBeGreaterThan(0);
    });
  });
});
