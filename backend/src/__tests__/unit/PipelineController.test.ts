import { PipelineController } from '../../controllers/PipelineController';
import { OpenAIService } from '../../services/ai/openaiService';
import { createError } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('../../services/ai/openaiService');
jest.mock('../../middleware/errorHandler');
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
  let mockOpenAIService: jest.Mocked<OpenAIService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock OpenAI service
    mockOpenAIService = {
      convertDesignToHTML: jest.fn(),
      getInstance: jest.fn()
    } as any;

    // Mock the getInstance method
    (OpenAIService.getInstance as jest.Mock).mockReturnValue(mockOpenAIService);
    
    pipelineController = new PipelineController();
  });

  describe('executePipeline', () => {
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
      mockOpenAIService.convertDesignToHTML.mockResolvedValue(mockDesignAnalysis);
    });

    test('should execute pipeline successfully with valid design file', async () => {
      const result = await pipelineController.executePipeline(mockDesignFile);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('sections');
      expect(result).toHaveProperty('qualityScore');
      expect(result).toHaveProperty('processingTime');
      expect(result.sections).toHaveLength(2);
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    test('should handle section detection correctly', async () => {
      const result = await pipelineController.executePipeline(mockDesignFile);

      expect(result.sections[0]).toHaveProperty('id', 'section_1');
      expect(result.sections[0]).toHaveProperty('name', 'Header');
      expect(result.sections[0]).toHaveProperty('type', 'header');
      expect(result.sections[0]).toHaveProperty('html');
      expect(result.sections[0]).toHaveProperty('editableFields');
      expect(result.sections[0]).toHaveProperty('qualityScore');
    });

    test('should calculate quality scores for each section', async () => {
      const result = await pipelineController.executePipeline(mockDesignFile);

      result.sections.forEach(section => {
        expect(section.qualityScore).toBeGreaterThan(0);
        expect(section.qualityScore).toBeLessThanOrEqual(100);
      });
    });

    test('should generate editable fields for sections', async () => {
      const result = await pipelineController.executePipeline(mockDesignFile);

      result.sections.forEach((section: any) => {
        expect(section).toHaveProperty('editableFields');
        expect(Array.isArray(section.editableFields)).toBe(true);
        if (section.editableFields && section.editableFields.length > 0) {
          expect(section.editableFields[0]).toHaveProperty('id');
          expect(section.editableFields[0]).toHaveProperty('name');
          expect(section.editableFields[0]).toHaveProperty('type');
          expect(section.editableFields[0]).toHaveProperty('selector');
          expect(section.editableFields[0]).toHaveProperty('defaultValue');
          expect(section.editableFields[0]).toHaveProperty('required');
        }
      });
    });

    test('should handle OpenAI service errors gracefully', async () => {
      mockOpenAIService.convertDesignToHTML.mockRejectedValue(new Error('OpenAI API Error'));

      await expect(pipelineController.executePipeline(mockDesignFile))
        .rejects
        .toThrow('Pipeline execution failed');
    });

    test('should handle empty sections from AI analysis', async () => {
      mockOpenAIService.convertDesignToHTML.mockResolvedValue({
        ...mockDesignAnalysis,
        sections: []
      });

      const result = await pipelineController.executePipeline(mockDesignFile);

      expect(result.sections).toHaveLength(1); // Should fall back to default sections
      expect(result.sections[0].name).toBe('Main Section');
    });

    test('should measure processing time accurately', async () => {
      const startTime = Date.now();
      const result = await pipelineController.executePipeline(mockDesignFile);
      const endTime = Date.now();

      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThanOrEqual(endTime - startTime + 100); // Allow 100ms tolerance
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
      const smallFile = { size: 100 * 1024 }; // 100KB
      const largeFile = { size: 5 * 1024 * 1024 }; // 5MB

      // Use reflection to access private method for testing
      const analyzeComplexity = (pipelineController as any).analyzeDesignComplexity.bind(pipelineController);

      const smallComplexity = await analyzeComplexity(smallFile);
      const largeComplexity = await analyzeComplexity(largeFile);

      expect(smallComplexity.estimatedComplexity).toBeLessThan(largeComplexity.estimatedComplexity);
      expect(smallComplexity.recommendedSections).toBeLessThanOrEqual(largeComplexity.recommendedSections);
    });
  });

  describe('calculateQualityScore', () => {
    test('should calculate quality score based on HTML content', () => {
      const calculateQuality = (pipelineController as any).calculateQualityScore.bind(pipelineController);

      const simpleHtml = '<div>Simple content</div>';
      const complexHtml = `
        <div class="container mx-auto p-4">
          <h1 class="text-2xl font-bold mb-4">Title</h1>
          <p class="text-gray-600 mb-2">Description</p>
          <button class="bg-blue-500 text-white px-4 py-2 rounded">Action</button>
        </div>
      `;

      const simpleScore = calculateQuality(simpleHtml);
      const complexScore = calculateQuality(complexHtml);

      expect(simpleScore).toBeGreaterThan(0);
      expect(complexScore).toBeGreaterThan(simpleScore);
      expect(complexScore).toBeLessThanOrEqual(100);
    });

    test('should handle empty or invalid HTML', () => {
      const calculateQuality = (pipelineController as any).calculateQualityScore.bind(pipelineController);

      expect(calculateQuality('')).toBe(50); // Default score
      expect(calculateQuality(null)).toBe(50);
      expect(calculateQuality(undefined)).toBe(50);
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
      expect(result).toHaveProperty('sections');
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
      expect(result.sections.length).toBeGreaterThan(0);
    });
  });
});
