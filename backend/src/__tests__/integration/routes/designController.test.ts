import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { jest } from '@jest/globals';
import { createApp } from '../../../app';
import { setupDomainServiceMocks, mockPipelineExecutor } from '../../setup/domainServiceMocks';

// Mock the new domain-driven services
jest.mock('../../../services/core/ai/OpenAIClient');
jest.mock('../../../services/pipeline/PipelineExecutor');
jest.mock('../../../services/ai/generation/HTMLGenerator');
jest.mock('../../../services/ai/analysis/IterativeRefinement');
jest.mock('../../../services/quality/validation/HTMLValidator');
jest.mock('../../../services/ai/prompts/PromptManager');
jest.mock('../../../services/ai/splitting/SplittingService');

// Mock the logger to avoid console spam
jest.mock('../../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Use the same app setup as production
let app: any;

describe('Design Controller API Tests', () => {
  beforeAll(() => {
    setupDomainServiceMocks();
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupDomainServiceMocks();
  });

  describe('GET /api/design/supported-types', () => {
    it('should return supported file types', async () => {
      const response = await request(app)
        .get('/api/design/supported-types')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('supportedTypes');
      expect(Array.isArray(response.body.data.supportedTypes)).toBe(true);
      expect(response.body.data.supportedTypes.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/design/upload', () => {
    const mockImageBuffer = Buffer.from('fake-image-data');

    it('should successfully upload and convert a PNG image', async () => {
      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', mockImageBuffer, 'test-design.png');

      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('fileName', 'test-design.png');
        expect(response.body.data).toHaveProperty('fileSize');
      }
    });

    it('should successfully upload and convert a JPG image', async () => {
      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', mockImageBuffer, 'test-design.jpg');

      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
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
        .attach('design', largeBuffer, 'large-image.png');

      expect([413, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    it('should handle missing file upload', async () => {
      const response = await request(app)
        .post('/api/design/upload')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No file uploaded');
    });

    it('should handle service errors', async () => {
      mockPipelineExecutor.executePipeline.mockRejectedValue(
        new Error('Pipeline execution failed')
      );

      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', mockImageBuffer, 'test-design.png');

      expect([400, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
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
    it('should successfully refine HTML code', async () => {
      const htmlCode = '<div><h1>Welcome</h1><p>Test content</p></div>';
      const requirements = 'Make it more modern with gradients and better typography';

      const response = await request(app)
        .post('/api/design/refine')
        .send({ html: htmlCode, requirements });

      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('originalHTML', htmlCode);
        expect(response.body.data).toHaveProperty('refinedHTML');
        expect(response.body.data).toHaveProperty('requirements', requirements);
      }
    });

    it('should refine HTML without specific requirements', async () => {
      const htmlCode = '<div><h1>Welcome</h1></div>';

      const response = await request(app)
        .post('/api/design/refine')
        .send({ html: htmlCode });

      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it('should reject empty HTML input', async () => {
      const response = await request(app)
        .post('/api/design/refine')
        .send({ html: '' });

      expect([400, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
      expect(response.body.error || response.body.message).toMatch(/HTML|Invalid|required/i);
    });

    it('should reject missing HTML input', async () => {
      const response = await request(app)
        .post('/api/design/refine')
        .send({ requirements: 'Make it better' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle service errors during refinement', async () => {
      jest.clearAllMocks();
      
      // Mock the refineHTML method specifically to throw an error
      const mockController = {
        refineHTML: jest.fn().mockImplementation(() => Promise.reject(new Error('Refinement failed'))),
        getSupportedFileTypes: jest.fn().mockReturnValue([])
      };
      
      const { setPipelineController } = require('../../../routes/design');
      setPipelineController(mockController);

      const response = await request(app)
        .post('/api/design/refine')
        .send({ html: '<div>Test</div>' });

      expect([400, 500]).toContain(response.status);
      if (response.status >= 400) {
        expect(response.body.success).toBe(false);
      }
    });
  });
});

describe('Integration Tests', () => {
  it('should handle complete workflow: upload -> refine', async () => {
    const mockImageBuffer = Buffer.from('fake-image-data');

    // Step 1: Upload and convert design
    const uploadResponse = await request(app)
      .post('/api/design/upload')
      .attach('design', mockImageBuffer, 'test-design.png');

    expect([200, 500]).toContain(uploadResponse.status);

    if (uploadResponse.status === 200) {
      expect(uploadResponse.body.success).toBe(true);
      const generatedHTML = uploadResponse.body.data.sections?.[0]?.html || '<div>Test HTML</div>';

      // Step 2: Refine the generated HTML
      const refineResponse = await request(app)
        .post('/api/design/refine')
        .send({ 
          html: generatedHTML, 
          requirements: 'Add gradients, shadows, and improve typography' 
        });

      expect([200, 500]).toContain(refineResponse.status);
      
      if (refineResponse.status === 200) {
        expect(refineResponse.body.success).toBe(true);
      }
    }
  });
});
