import { jest } from '@jest/globals';

// Mock the OpenAI service
const mockConvertDesignToHTML = jest.fn() as jest.MockedFunction<any>;
const mockRefineHTML = jest.fn() as jest.MockedFunction<any>;

jest.mock('../../services/ai/openaiService', () => ({
  default: {
    convertDesignToHTML: mockConvertDesignToHTML,
    refineHTML: mockRefineHTML,
  },
}));

// Mock logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { PipelineController } from '../../controllers/PipelineController';

describe('Design Controller - Simplified Tests (Legacy)', () => {
  let pipelineController: PipelineController;

  beforeEach(() => {
    pipelineController = new PipelineController();
    jest.clearAllMocks();
  });

  const mockDesignAnalysis = {
    html: '<div class="bg-white p-8"><h1 class="text-4xl font-bold text-gray-900">Welcome</h1><p class="text-gray-600 mt-4">This is a test design conversion.</p></div>',
    sections: [
      {
        id: 'header-1',
        name: 'Header Section',
        type: 'header' as const,
        html: '<h1 class="text-4xl font-bold text-gray-900">Welcome</h1>',
        editableFields: [
          {
            id: 'header-text',
            name: 'Header Text',
            type: 'text' as const,
            selector: 'h1',
            defaultValue: 'Welcome',
            required: true,
          },
        ],
      },
    ],
    components: [
      {
        id: 'welcome-card',
        name: 'Welcome Card',
        type: 'card' as const,
        html: '<div class="bg-white p-8">...</div>',
        props: {
          title: 'Welcome',
          description: 'This is a test design conversion.',
        },
      },
    ],
    description: 'A clean welcome page design with header and description text.',
  };


  describe('executePipeline (replaces uploadDesign)', () => {
    it('should successfully process a design file', async () => {
      // Mock successful pipeline execution
      const mockFile = {
        originalname: 'test-design.png',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('fake-image-data'),
        fieldname: 'design',
        encoding: '7bit',
        stream: null as any,
        destination: '',
        filename: 'test-design.png',
        path: ''
      } as Express.Multer.File;

      const result = await pipelineController.executePipeline(mockFile);

      // Verify pipeline execution returns expected structure
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('qualityScore');
      expect(result).toHaveProperty('sections');
      expect(result.sections).toBeInstanceOf(Array);
    });

    it('should handle invalid file types gracefully', async () => {
      const mockFile = {
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('not-an-image'),
        fieldname: 'design',
        encoding: '7bit',
        stream: null as any,
        destination: '',
        filename: 'test.txt',
        path: ''
      } as Express.Multer.File;

      const result = await pipelineController.executePipeline(mockFile);

      // Should still process but may have lower quality scores
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('qualityScore');
    });
  });

  describe('refineHTML', () => {
    it('should successfully refine HTML code', async () => {
      const mockHTML = '<div><h1>Welcome</h1><p>Test content</p></div>';
      const mockRequirements = 'Make it more modern with gradients and better typography';
      
      const result = await pipelineController.refineHTML({
        html: mockHTML,
        requirements: mockRequirements
      });

      expect(result).toHaveProperty('refinedHTML');
      expect(result).toHaveProperty('originalHTML', mockHTML);
      expect(result).toHaveProperty('requirements', mockRequirements);
      expect(result.refinedHTML).toBeDefined();
    });

    it('should handle missing requirements', async () => {
      const mockHTML = '<div><h1>Welcome</h1><p>Test content</p></div>';
      
      const result = await pipelineController.refineHTML({
        html: mockHTML
      });

      expect(result).toHaveProperty('refinedHTML');
      expect(result).toHaveProperty('originalHTML', mockHTML);
      expect(result.refinedHTML).toBeDefined();
    });

    it('should handle empty HTML gracefully', async () => {
      const result = await pipelineController.refineHTML({
        html: ''
      });

      expect(result).toHaveProperty('refinedHTML');
      expect(result).toHaveProperty('originalHTML', '');
    });
  });
});
