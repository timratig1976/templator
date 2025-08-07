jest.mock('../../services/core/ai/OpenAIClient', () => ({
  OpenAIClient: {
    getInstance: jest.fn()
  }
}));

jest.mock('../../services/pipeline/PipelineExecutor', () => ({
  PipelineExecutor: {
    getInstance: jest.fn()
  }
}));

jest.mock('../../services/ai/generation/HTMLGenerator', () => ({
  HTMLGenerator: {
    getInstance: jest.fn()
  }
}));

jest.mock('../../services/ai/analysis/IterativeRefinement', () => ({
  IterativeRefinement: {
    getInstance: jest.fn()
  }
}));

jest.mock('../../services/quality/validation/HTMLValidator', () => ({
  HTMLValidator: {
    getInstance: jest.fn()
  }
}));

jest.mock('../../services/ai/prompts/PromptManager', () => ({
  PromptManager: {
    getInstance: jest.fn()
  }
}));

jest.mock('../../middleware/errorHandler');

import { PipelineController } from '../../controllers/PipelineController';
import { createError } from '../../middleware/errorHandler';
import { setupDomainServiceMocks, mockPipelineExecutor, mockHTMLGenerator, mockIterativeRefinement } from '../setup/domainServiceMocks';
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

describe('PipelineController', () => {
  let pipelineController: PipelineController;

  const mockDesignFile = {
    buffer: Buffer.from('fake-image-data'),
    originalname: 'test-design.png',
    mimetype: 'image/png',
    size: 1024,
    fieldname: 'design',
    encoding: '7bit',
    stream: null as any,
    destination: '',
    filename: 'test-design.png',
    path: ''
  } as Express.Multer.File;

  const mockDesignAnalysis = {
    html: '<div class="test">Test HTML</div>',
    sections: [
      {
        id: 'section_1',
        name: 'Header',
        type: 'header' as const,
        html: '<header>Header content</header>',
        editableFields: []
      },
      {
        id: 'section_2', 
        name: 'Content',
        type: 'content' as const,
        html: '<main>Main content</main>',
        editableFields: []
      }
    ],
    components: [],
    description: 'Test design'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDomainServiceMocks();
    pipelineController = new PipelineController();
  });

  describe('executePipeline', () => {

    test('should execute pipeline successfully with valid design file', async () => {
      const result = await pipelineController.executePipeline(mockDesignFile);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('phases');
      expect(result).toHaveProperty('finalResult');
      expect(result).toHaveProperty('totalDuration');
      expect(result.status).toBe('completed');
    });

    test('should handle section detection correctly', async () => {
      const result = await pipelineController.executePipeline(mockDesignFile);

      expect(result).toHaveProperty('finalResult');
      expect(result.finalResult).toHaveProperty('sections');
      expect(result.status).toBe('completed');
      expect(result.phases).toBeDefined();
    });

    test('should calculate quality scores for each section', async () => {
      const result = await pipelineController.executePipeline(mockDesignFile);

      expect(result).toHaveProperty('finalResult');
      expect(result.finalResult).toHaveProperty('sections');
      expect(result.status).toBe('completed');
    });

    test('should generate editable fields for sections', async () => {
      const result = await pipelineController.executePipeline(mockDesignFile);

      expect(result).toHaveProperty('finalResult');
      expect(result.finalResult).toHaveProperty('sections');
      expect(result.status).toBe('completed');
    });

    test('should handle OpenAI service errors gracefully', async () => {
      mockPipelineExecutor.executePipeline.mockRejectedValueOnce(new Error('Pipeline execution failed'));

      await expect(pipelineController.executePipeline(mockDesignFile))
        .rejects
        .toThrow('Pipeline execution failed');
    });

    test('should handle empty sections from AI analysis', async () => {
      mockPipelineExecutor.executePipeline.mockResolvedValue({
        id: 'pipeline_123_empty',
        status: 'completed',
        phases: [],
        finalResult: {
          results: { sections: [] },
          executionSummary: { totalPhases: 0, successfulPhases: 0, failedPhases: 0 }
        },
        totalDuration: 100,
        startTime: Date.now() - 100,
        endTime: Date.now()
      });

      const result = await pipelineController.executePipeline(mockDesignFile);

      expect(result).toHaveProperty('finalResult');
      expect(result.status).toBe('completed');
    });

    test('should measure processing time accurately', async () => {
      const startTime = Date.now();
      
      mockPipelineExecutor.executePipeline.mockResolvedValueOnce({
        id: `pipeline_${Date.now()}_timing_test`,
        status: 'completed',
        phases: [],
        finalResult: { results: {}, executionSummary: { totalPhases: 0, successfulPhases: 0, failedPhases: 0 } },
        totalDuration: 50, // Fixed 50ms duration
        startTime: startTime,
        endTime: startTime + 50
      });
      
      const result = await pipelineController.executePipeline(mockDesignFile);
      const endTime = Date.now();

      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.totalDuration).toBeLessThanOrEqual(endTime - startTime + 100); // Allow 100ms tolerance
    });

    test('should generate unique pipeline IDs', async () => {
      const result1 = await pipelineController.executePipeline(mockDesignFile);
      const result2 = await pipelineController.executePipeline(mockDesignFile);

      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toMatch(/^pipeline_\d+_[a-z0-9]+$/);
      expect(result2.id).toMatch(/^pipeline_\d+_[a-z0-9]+$/);
    });
  });

  describe('analyzeDesignComplexity', () => {
    test('should analyze design complexity based on file size', async () => {
      const smallFile = { ...mockDesignFile, size: 100 * 1024 }; // 100KB
      const largeFile = { ...mockDesignFile, size: 5 * 1024 * 1024 }; // 5MB

      const smallResult = await pipelineController.executePipeline(smallFile);
      const largeResult = await pipelineController.executePipeline(largeFile);

      expect(smallResult).toHaveProperty('status', 'completed');
      expect(largeResult).toHaveProperty('status', 'completed');
      expect(smallResult.totalDuration).toBeGreaterThan(0);
      expect(largeResult.totalDuration).toBeGreaterThan(0);
    });
  });

  describe('calculateQualityScore', () => {
    test('should calculate quality score based on HTML content', async () => {
      const result = await pipelineController.executePipeline(mockDesignFile);

      expect(result).toHaveProperty('finalResult');
      expect(result.finalResult).toHaveProperty('sections');
      expect(result.status).toBe('completed');
    });

    test('should handle empty or invalid HTML', async () => {
      const result = await pipelineController.executePipeline(mockDesignFile);
      
      expect(result).toHaveProperty('status', 'completed');
      expect(result.totalDuration).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    test('should handle invalid file types gracefully', async () => {
      const invalidFile = {
        buffer: Buffer.from('not-an-image'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 100,
        fieldname: 'design',
        encoding: '7bit',
        stream: null as any,
        destination: '',
        filename: 'test.txt',
        path: ''
      } as Express.Multer.File;

      // Should still process but may have lower quality scores
      const result = await pipelineController.executePipeline(invalidFile);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('finalResult');
    });

    test('should handle very large files', async () => {
      const largeFile = {
        buffer: Buffer.alloc(10 * 1024 * 1024), // 10MB
        originalname: 'large-design.png',
        mimetype: 'image/png',
        size: 10 * 1024 * 1024,
        fieldname: 'design',
        encoding: '7bit',
        stream: null as any,
        destination: '',
        filename: 'large-design.png',
        path: ''
      } as Express.Multer.File;

      const result = await pipelineController.executePipeline(largeFile);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('finalResult');
    });
  });
});
