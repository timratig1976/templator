import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
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

import openaiService from '../services/openaiService';
import { createApp } from '../app';

// Use the same app setup as production
const app = createApp();

// Mock OpenAI service responses
const mockDesignAnalysis = {
  html: '<div class="bg-white p-8"><h1 class="text-4xl font-bold text-gray-900">Welcome</h1><p class="text-gray-600 mt-4">This is a test design conversion.</p></div>',
  sections: [
    {
      id: 'header-1',
      name: 'Main Header',
      type: 'header' as const,
      html: '<h1 class="text-4xl font-bold text-gray-900">Welcome</h1>',
      editableFields: [
        {
          id: 'title-1',
          name: 'Main Title',
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
      id: 'comp-1',
      name: 'Title Component',
      type: 'text' as const,
      selector: 'h1',
      defaultValue: 'Welcome',
    },
  ],
  description: 'A simple welcome page design with header and description text.',
};

describe('Design Controller API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/design/supported-types', () => {
    it('should return supported file types', async () => {
      const response = await request(app)
        .get('/api/design/supported-types')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          supportedTypes: [
            { extension: 'png', mimeType: 'image/png', description: 'PNG images' },
            { extension: 'jpg', mimeType: 'image/jpeg', description: 'JPEG images' },
            { extension: 'jpeg', mimeType: 'image/jpeg', description: 'JPEG images' },
            { extension: 'gif', mimeType: 'image/gif', description: 'GIF images' },
            { extension: 'webp', mimeType: 'image/webp', description: 'WebP images' },
          ],
          maxFileSize: '10MB',
          notes: [
            'PDF support coming soon',
            'For best results, use high-resolution images',
            'Ensure text and elements are clearly visible',
          ],
        },
        message: 'Supported file types retrieved successfully',
      });
    });
  });

  describe('POST /api/design/upload', () => {
    const mockImageBuffer = Buffer.from('fake-image-data');

    beforeEach(() => {
      mockConvertDesignToHTML.mockResolvedValue(mockDesignAnalysis);
    });

    it('should successfully upload and convert a PNG image', async () => {
      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', mockImageBuffer, 'test-design.png')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('fileName', 'test-design.png');
      expect(response.body.data).toHaveProperty('fileSize');
      expect(response.body.data.analysis).toEqual(mockDesignAnalysis);
      expect(response.body.message).toBe('Design successfully converted to HTML');
    });

    it('should successfully upload and convert a JPG image', async () => {
      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', mockImageBuffer, 'test-design.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fileName).toBe('test-design.jpg');
    });

    it('should reject unsupported file types', async () => {
      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', mockImageBuffer, 'test-document.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid file type');
    });

    it('should reject files that are too large', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      
      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', largeBuffer, 'large-image.png')
        .expect(413); // Payload too large

      expect(response.body.success).toBe(false);
    });

    it('should handle missing file upload', async () => {
      const response = await request(app)
        .post('/api/design/upload')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No file uploaded');
    });

    it('should handle OpenAI service errors', async () => {
      mockConvertDesignToHTML.mockRejectedValue(
        new Error('OpenAI API error')
      );

      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', mockImageBuffer, 'test-design.png')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to convert design to HTML');
    });

    it('should reject PDF files with appropriate message', async () => {
      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', mockImageBuffer, 'test-design.pdf')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('PDF conversion not yet supported');
    });
  });

  describe('POST /api/design/refine', () => {
    const mockRefinedHTML = '<div class="bg-gradient-to-r from-blue-500 to-purple-600 p-8"><h1 class="text-5xl font-bold text-white">Welcome</h1><p class="text-blue-100 mt-4">This is a refined design with better styling.</p></div>';

    beforeEach(() => {
      mockRefineHTML.mockResolvedValue(mockRefinedHTML);
    });

    it('should successfully refine HTML code', async () => {
      const htmlCode = '<div><h1>Welcome</h1><p>Test content</p></div>';
      const requirements = 'Make it more modern with gradients and better typography';

      const response = await request(app)
        .post('/api/design/refine')
        .send({ html: htmlCode, requirements })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('originalHTML', htmlCode);
      expect(response.body.data).toHaveProperty('refinedHTML', mockRefinedHTML);
      expect(response.body.data).toHaveProperty('requirements', requirements);
      expect(response.body.message).toBe('HTML successfully refined');
    });

    it('should refine HTML without specific requirements', async () => {
      const htmlCode = '<div><h1>Welcome</h1></div>';

      const response = await request(app)
        .post('/api/design/refine')
        .send({ html: htmlCode })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requirements).toBe(null);
    });

    it('should reject empty HTML input', async () => {
      const response = await request(app)
        .post('/api/design/refine')
        .send({ html: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('HTML code is required');
    });

    it('should reject missing HTML input', async () => {
      const response = await request(app)
        .post('/api/design/refine')
        .send({ requirements: 'Make it better' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle OpenAI service errors during refinement', async () => {
      mockRefineHTML.mockRejectedValue(
        new Error('OpenAI refinement error')
      );

      const response = await request(app)
        .post('/api/design/refine')
        .send({ html: '<div>Test</div>' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to refine HTML');
    });
  });
});

describe('Integration Tests', () => {
  it('should handle complete workflow: upload -> refine', async () => {
    const mockImageBuffer = Buffer.from('fake-image-data');
    
    // Mock the OpenAI responses
    mockConvertDesignToHTML.mockResolvedValue(mockDesignAnalysis);
    mockRefineHTML.mockResolvedValue(
      '<div class="bg-gradient-to-r from-blue-500 to-purple-600 p-8 rounded-lg shadow-xl"><h1 class="text-5xl font-bold text-white mb-4">Welcome</h1><p class="text-blue-100 text-lg">This is a refined design with better styling.</p></div>'
    );

    // Step 1: Upload and convert design
    const uploadResponse = await request(app)
      .post('/api/design/upload')
      .attach('design', mockImageBuffer, 'test-design.png')
      .expect(200);

    expect(uploadResponse.body.success).toBe(true);
    const generatedHTML = uploadResponse.body.data.analysis.html;

    // Step 2: Refine the generated HTML
    const refineResponse = await request(app)
      .post('/api/design/refine')
      .send({ 
        html: generatedHTML, 
        requirements: 'Add gradients, shadows, and improve typography' 
      })
      .expect(200);

    expect(refineResponse.body.success).toBe(true);
    expect(refineResponse.body.data.refinedHTML).toContain('gradient');
    expect(refineResponse.body.data.refinedHTML).toContain('shadow');
  });
});
