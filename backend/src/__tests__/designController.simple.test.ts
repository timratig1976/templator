import { jest } from '@jest/globals';

// Mock the OpenAI service
const mockConvertDesignToHTML = jest.fn() as jest.MockedFunction<any>;
const mockRefineHTML = jest.fn() as jest.MockedFunction<any>;

jest.mock('../services/openaiService', () => ({
  default: {
    convertDesignToHTML: mockConvertDesignToHTML,
    refineHTML: mockRefineHTML,
  },
}));

// Mock logger to avoid console output during tests
jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { uploadDesign, refineHTML } from '../controllers/designController';

describe('Design Controller - Simplified Tests', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadDesign', () => {
    it('should successfully process a design upload', async () => {
      // Mock successful OpenAI response
      mockConvertDesignToHTML.mockResolvedValue(mockDesignAnalysis);

      // Mock request and response objects
      const mockReq = {
        file: {
          originalname: 'test-design.png',
          mimetype: 'image/png',
          size: 1024,
          buffer: Buffer.from('fake-image-data'),
        },
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const mockNext = jest.fn();

      // Call the controller function
      await uploadDesign(mockReq, mockRes, mockNext);

      // Verify OpenAI service was called
      expect(mockConvertDesignToHTML).toHaveBeenCalledWith(
        expect.any(String), // base64 image
        'test-design.png'
      );

      // Verify successful response
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          fileName: 'test-design.png',
          fileSize: 1024,
          analysis: mockDesignAnalysis,
        },
      });
    });

    it('should handle missing file upload', async () => {
      const mockReq = {} as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      const mockNext = jest.fn();

      await uploadDesign(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'No file uploaded',
      });
    });

    it('should handle OpenAI service errors', async () => {
      mockConvertDesignToHTML.mockRejectedValue(new Error('OpenAI API error'));

      const mockReq = {
        file: {
          originalname: 'test-design.png',
          mimetype: 'image/png',
          size: 1024,
          buffer: Buffer.from('fake-image-data'),
        },
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const mockNext = jest.fn();

      await uploadDesign(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to convert design to HTML',
      });
    });
  });

  describe('refineHTML', () => {
    it('should successfully refine HTML code', async () => {
      const mockRefinedHTML = '<div class="bg-gradient-to-r from-blue-500 to-purple-600 p-8"><h1 class="text-5xl font-bold text-white">Welcome</h1><p class="text-blue-100 mt-4">This is a refined design with better styling.</p></div>';
      
      mockRefineHTML.mockResolvedValue(mockRefinedHTML);

      const mockReq = {
        body: {
          html: '<div><h1>Welcome</h1><p>Test content</p></div>',
          requirements: 'Make it more modern with gradients and better typography',
        },
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const mockNext = jest.fn();

      await refineHTML(mockReq, mockRes, mockNext);

      expect(mockRefineHTML).toHaveBeenCalledWith(
        '<div><h1>Welcome</h1><p>Test content</p></div>',
        'Make it more modern with gradients and better typography'
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          originalHTML: '<div><h1>Welcome</h1><p>Test content</p></div>',
          refinedHTML: mockRefinedHTML,
          requirements: 'Make it more modern with gradients and better typography',
        },
      });
    });

    it('should handle missing HTML input', async () => {
      const mockReq = {
        body: {},
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const mockNext = jest.fn();

      await refineHTML(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'HTML code is required',
      });
    });

    it('should handle OpenAI service errors during refinement', async () => {
      mockRefineHTML.mockRejectedValue(new Error('OpenAI refinement error'));

      const mockReq = {
        body: {
          html: '<div><h1>Welcome</h1><p>Test content</p></div>',
          requirements: 'Make it better',
        },
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const mockNext = jest.fn();

      await refineHTML(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to refine HTML',
      });
    });
  });
});
