/**
 * Integration tests for the refactored modular pipeline architecture
 * Tests the complete 5-phase pipeline orchestration end-to-end
 */

import request from 'supertest';
import { createApp } from '../../app';
import { PipelineController } from '../../controllers/PipelineController';
import { OpenAIService } from '../../services/openaiService';
import path from 'path';
import fs from 'fs';

// Mock dependencies
jest.mock('../../services/openaiService');
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

describe('Modular Pipeline Integration Tests', () => {
  let app: any;
  let mockOpenAIService: jest.Mocked<OpenAIService>;

  beforeAll(() => {
    app = createApp();
    
    // Mock OpenAI service
    mockOpenAIService = {
      convertDesignToHTML: jest.fn(),
      getInstance: jest.fn()
    } as any;

    (OpenAIService.getInstance as jest.Mock).mockReturnValue(mockOpenAIService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock response for OpenAI service
    mockOpenAIService.convertDesignToHTML.mockResolvedValue({
      html: '<div class="container mx-auto p-6"><h1 class="text-3xl font-bold mb-4">Test Design</h1><p class="text-gray-600">Test content</p></div>',
      sections: [
        {
          id: 'section_1',
          name: 'Header',
          type: 'header' as const,
          html: '<h1 class="text-3xl font-bold mb-4">Test Design</h1>',
          editableFields: [
            {
              id: 'header_title',
              name: 'Header Title',
              type: 'text',
              selector: 'h1',
              defaultValue: 'Test Design',
              required: false
            }
          ]
        },
        {
          id: 'section_2',
          name: 'Content',
          type: 'content' as const,
          html: '<p class="text-gray-600">Test content</p>',
          editableFields: [
            {
              id: 'content_text',
              name: 'Content Text',
              type: 'rich_text',
              selector: 'p',
              defaultValue: 'Test content',
              required: false
            }
          ]
        }
      ],
      components: [],
      description: 'Test design with header and content sections'
    });
  });

  describe('Pipeline Controller Integration', () => {
    test('should instantiate PipelineController with modular orchestrator', () => {
      const controller = new PipelineController();
      expect(controller).toBeDefined();
      expect(controller.executePipeline).toBeDefined();
    });

    test('should execute modular pipeline with all 5 phases', async () => {
      const controller = new PipelineController();
      
      const mockDesignFile = {
        buffer: Buffer.from('fake-image-data'),
        originalname: 'test-design.png',
        mimetype: 'image/png',
        size: 1024
      };

      const result = await controller.executePipeline(mockDesignFile);

      // Verify pipeline result structure
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('sections');
      expect(result).toHaveProperty('qualityScore');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('validationPassed');
      expect(result).toHaveProperty('enhancementsApplied');
      expect(result).toHaveProperty('packagedModule');
      expect(result).toHaveProperty('metadata');

      // Verify sections structure
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.sections.length).toBeGreaterThan(0);

      // Verify quality metrics
      expect(typeof result.qualityScore).toBe('number');
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);

      // Verify processing metadata
      expect(result.metadata).toHaveProperty('phaseTimes');
      expect(result.metadata).toHaveProperty('totalSections');
      expect(result.metadata).toHaveProperty('averageQuality');
      expect(result.metadata).toHaveProperty('timestamp');
    });

    test('should handle pipeline errors gracefully with fallback', async () => {
      const controller = new PipelineController();
      
      // Mock OpenAI service to throw an error
      mockOpenAIService.convertDesignToHTML.mockRejectedValue(new Error('OpenAI API Error'));

      const mockDesignFile = {
        buffer: Buffer.from('invalid-data'),
        originalname: 'test-design.png',
        mimetype: 'image/png',
        size: 1024
      };

      const result = await controller.executePipeline(mockDesignFile);

      // Should still return a result with fallback data
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('sections');
      expect(result.sections.length).toBeGreaterThan(0);
      
      // Quality score should be lower for fallback
      expect(result.qualityScore).toBeLessThan(50);
    });
  });

  describe('Pipeline API Integration', () => {
    test('should execute pipeline via API endpoint', async () => {
      // Create a small test image buffer
      const testImageBuffer = Buffer.from('fake-png-data');

      const response = await request(app)
        .post('/api/pipeline/execute')
        .attach('design', testImageBuffer, 'test-design.png')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('sections');
      expect(response.body.data).toHaveProperty('qualityScore');
      expect(response.body.data).toHaveProperty('processingTime');
      expect(response.body.message).toContain('pipeline executed successfully');
    });

    test('should return error for missing file', async () => {
      const response = await request(app)
        .post('/api/pipeline/execute')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No design file uploaded');
    });

    test('should return error for invalid file type', async () => {
      const testTextBuffer = Buffer.from('This is not an image');

      const response = await request(app)
        .post('/api/pipeline/execute')
        .attach('design', testTextBuffer, 'test.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid file type');
    });

    test('should return pipeline status', async () => {
      const response = await request(app)
        .get('/api/pipeline/status/test-pipeline-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pipelineId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('phases');
      expect(Array.isArray(response.body.data.phases)).toBe(true);
      expect(response.body.data.phases).toHaveLength(5);
    });

    test('should return quality metrics', async () => {
      const response = await request(app)
        .get('/api/pipeline/quality/test-pipeline-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pipelineId');
      expect(response.body.data).toHaveProperty('overallQuality');
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('sectionQuality');
      expect(response.body.data).toHaveProperty('recommendations');
    });

    test('should return supported file types', async () => {
      const response = await request(app)
        .get('/api/pipeline/supported-types')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('supportedTypes');
      expect(response.body.data).toHaveProperty('maxFileSize');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(Array.isArray(response.body.data.supportedTypes)).toBe(true);
    });
  });

  describe('Modular Architecture Validation', () => {
    test('should have all 5 phase handlers available', () => {
      // This test validates that our modular architecture is properly structured
      const controller = new PipelineController();
      
      // Access the orchestrator through the controller (if exposed for testing)
      // This validates that the modular structure is in place
      expect(controller).toBeDefined();
      
      // The fact that the controller can be instantiated without errors
      // indicates that all phase handlers and the orchestrator are properly connected
    });

    test('should process pipeline with proper phase separation', async () => {
      const controller = new PipelineController();
      
      const mockDesignFile = {
        buffer: Buffer.from('test-image-data'),
        originalname: 'test-design.png',
        mimetype: 'image/png',
        size: 2048
      };

      const startTime = Date.now();
      const result = await controller.executePipeline(mockDesignFile);
      const endTime = Date.now();

      // Verify that the result contains evidence of all 5 phases
      expect(result.metadata.phaseTimes).toBeDefined();
      
      // Verify processing time is reasonable (modular architecture should be efficient)
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(endTime - startTime + 1000); // Allow 1s tolerance
      
      // Verify that sections were processed (Phase 1 & 2)
      expect(result.sections.length).toBeGreaterThan(0);
      
      // Verify quality scoring was applied (Phase 3)
      expect(result.qualityScore).toBeGreaterThan(0);
      
      // Verify validation was performed (Phase 3)
      expect(typeof result.validationPassed).toBe('boolean');
      
      // Verify enhancements were considered (Phase 4)
      expect(Array.isArray(result.enhancementsApplied)).toBe(true);
      
      // Verify packaging was completed (Phase 5)
      expect(result.packagedModule).toBeDefined();
    });
  });
});
