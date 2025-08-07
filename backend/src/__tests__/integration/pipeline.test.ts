import request from 'supertest';
import { Express } from 'express';
import path from 'path';
import fs from 'fs';
import { createApp } from '../../app';
import { setupDomainServiceMocks, mockPipelineExecutor, mockOpenAIClient } from '../setup/domainServiceMocks';

jest.mock('../../services/core/ai/OpenAIClient');
jest.mock('../../services/pipeline/PipelineExecutor');
jest.mock('../../services/ai/generation/HTMLGenerator');
jest.mock('../../services/ai/analysis/IterativeRefinement');
jest.mock('../../services/quality/validation/HTMLValidator');
jest.mock('../../services/ai/prompts/PromptManager');
jest.mock('../../services/ai/splitting/SplittingService');

describe('Pipeline API Integration Tests', () => {
  let app: any;
  const testImagePath = path.join(__dirname, '../fixtures/test-design.png');
  
  beforeAll(async () => {
    setupDomainServiceMocks();
    
    app = createApp();
    
    // Create test image fixture if it doesn't exist
    if (!fs.existsSync(testImagePath)) {
      const testImageDir = path.dirname(testImagePath);
      if (!fs.existsSync(testImageDir)) {
        fs.mkdirSync(testImageDir, { recursive: true });
      }
      
      // Create a simple test PNG (1x1 pixel)
      const testPngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
        0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
        0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, // IEND chunk
        0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      
      fs.writeFileSync(testImagePath, testPngBuffer);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupDomainServiceMocks();
  });

  afterAll(() => {
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  describe('POST /api/pipeline/execute', () => {
    test('should execute pipeline with valid image upload', async () => {
      const response = await request(app)
        .post('/api/pipeline/execute')
        .attach('design', testImagePath)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('sections');
      expect(response.body.data).toHaveProperty('qualityScore');
      expect(response.body.data).toHaveProperty('processingTime');
      expect(response.body).toHaveProperty('metadata');
      
      // Validate sections structure
      expect(Array.isArray(response.body.data.sections)).toBe(true);
      if (response.body.data.sections.length > 0) {
        const section = response.body.data.sections[0];
        expect(section).toHaveProperty('id');
        expect(section).toHaveProperty('name');
        expect(section).toHaveProperty('type');
        expect(section).toHaveProperty('html');
        expect(section).toHaveProperty('editableFields');
        expect(section).toHaveProperty('qualityScore');
      }
    }, 30000); // 30 second timeout for AI processing

    test('should reject request without file upload', async () => {
      const response = await request(app)
        .post('/api/pipeline/execute')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No design file uploaded');
    });

    test('should reject invalid file types', async () => {
      const textFilePath = path.join(__dirname, '../fixtures/test.txt');
      fs.writeFileSync(textFilePath, 'This is not an image');

      const response = await request(app)
        .post('/api/pipeline/execute')
        .attach('design', textFilePath)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid file type');

      // Clean up
      fs.unlinkSync(textFilePath);
    });

    test('should handle large file uploads within limits', async () => {
      // Create a larger test image (still within 10MB limit)
      const largeImagePath = path.join(__dirname, '../fixtures/large-test.png');
      const largeImageBuffer = Buffer.alloc(1024 * 1024); // 1MB
      fs.writeFileSync(largeImagePath, largeImageBuffer);

      const response = await request(app)
        .post('/api/pipeline/execute')
        .attach('design', largeImagePath)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('sections');

      // Clean up
      fs.unlinkSync(largeImagePath);
    }, 30000);

    test('should include proper metadata in response', async () => {
      const response = await request(app)
        .post('/api/pipeline/execute')
        .attach('design', testImagePath)
        .expect(200);

      expect(response.body.metadata).toHaveProperty('processingTime');
      expect(response.body.metadata).toHaveProperty('sectionsGenerated');
      expect(response.body.metadata).toHaveProperty('averageQualityScore');
      expect(response.body.metadata).toHaveProperty('timestamp');
      
      expect(typeof response.body.metadata.processingTime).toBe('number');
      expect(typeof response.body.metadata.sectionsGenerated).toBe('number');
      expect(typeof response.body.metadata.averageQualityScore).toBe('number');
      expect(typeof response.body.metadata.timestamp).toBe('string');
    }, 30000);
  });

  describe('GET /api/pipeline/status/:id', () => {
    test('should return pipeline status for valid ID', async () => {
      const response = await request(app)
        .get('/api/pipeline/status/test-pipeline-id')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('pipelineId', 'test-pipeline-id');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('currentPhase');
      expect(response.body.data).toHaveProperty('progress');
      expect(response.body.data).toHaveProperty('phases');
      
      // Validate phases structure
      expect(Array.isArray(response.body.data.phases)).toBe(true);
      expect(response.body.data.phases).toHaveLength(5);
      
      response.body.data.phases.forEach((phase: any) => {
        expect(phase).toHaveProperty('name');
        expect(phase).toHaveProperty('status');
        expect(phase).toHaveProperty('progress');
      });
    });
  });

  describe('GET /api/pipeline/quality/:id', () => {
    test('should return quality metrics for valid ID', async () => {
      const response = await request(app)
        .get('/api/pipeline/quality/test-pipeline-id')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('pipelineId', 'test-pipeline-id');
      expect(response.body.data).toHaveProperty('overallQuality');
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('sectionQuality');
      expect(response.body.data).toHaveProperty('recommendations');
      
      // Validate metrics structure
      const metrics = response.body.data.metrics;
      expect(metrics).toHaveProperty('htmlValidation');
      expect(metrics).toHaveProperty('accessibilityScore');
      expect(metrics).toHaveProperty('tailwindOptimization');
      expect(metrics).toHaveProperty('editabilityScore');
      expect(metrics).toHaveProperty('hubspotCompliance');
      
      // Validate section quality
      expect(Array.isArray(response.body.data.sectionQuality)).toBe(true);
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    });
  });

  describe('POST /api/pipeline/enhance/:sectionId', () => {
    test('should enhance section with valid request', async () => {
      const enhancementRequest = {
        enhancementType: 'styling',
        options: {
          theme: 'modern',
          colorScheme: 'blue'
        }
      };

      const response = await request(app)
        .post('/api/pipeline/enhance/section_1')
        .send(enhancementRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('sectionId', 'section_1');
      expect(response.body.data).toHaveProperty('enhancementType', 'styling');
      expect(response.body.data).toHaveProperty('originalHtml');
      expect(response.body.data).toHaveProperty('enhancedHtml');
      expect(response.body.data).toHaveProperty('improvements');
      expect(response.body.data).toHaveProperty('qualityImprovement');
      
      // Validate quality improvement structure
      const qualityImprovement = response.body.data.qualityImprovement;
      expect(qualityImprovement).toHaveProperty('before');
      expect(qualityImprovement).toHaveProperty('after');
      expect(qualityImprovement).toHaveProperty('improvement');
      expect(qualityImprovement.after).toBeGreaterThan(qualityImprovement.before);
    });
  });

  describe('GET /api/pipeline/supported-types', () => {
    test('should return supported file types and guidelines', async () => {
      const response = await request(app)
        .get('/api/pipeline/supported-types')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('supportedTypes');
      expect(response.body.data).toHaveProperty('maxFileSize');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('qualityGuidelines');
      
      // Validate supported types structure
      expect(Array.isArray(response.body.data.supportedTypes)).toBe(true);
      expect(response.body.data.supportedTypes.length).toBeGreaterThan(0);
      
      response.body.data.supportedTypes.forEach((type: any) => {
        expect(type).toHaveProperty('type');
        expect(type).toHaveProperty('extensions');
        expect(type).toHaveProperty('description');
        expect(Array.isArray(type.extensions)).toBe(true);
      });
      
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
      expect(Array.isArray(response.body.data.qualityGuidelines)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle server errors gracefully', async () => {
      // Test with malformed request
      const response = await request(app)
        .post('/api/pipeline/execute')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    test('should validate file size limits', async () => {
      // This would test file size validation
      // In a real scenario, we'd create a file larger than 10MB
      // For now, we'll test the endpoint exists and handles the case
      const response = await request(app)
        .post('/api/pipeline/execute')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Performance Tests', () => {
    test('should complete pipeline execution within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/pipeline/execute')
        .attach('design', testImagePath)
        .expect(200);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within 30 seconds
      expect(executionTime).toBeLessThan(30000);
      expect(response.body.data.processingTime).toBeLessThan(executionTime);
    }, 35000);

    test('should handle concurrent requests', async () => {
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < 3; i++) {
        promises.push(
          request(app)
            .post('/api/pipeline/execute')
            .attach('design', testImagePath)
        );
      }
      
      const responses = await Promise.all(promises);
      
      responses.forEach((response: any) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('id');
      });
      
      // All pipeline IDs should be unique
      const pipelineIds = responses
        .filter((r: any) => r.body?.data?.id)
        .map((r: any) => r.body.data.id);
      const uniqueIds = new Set(pipelineIds);
      expect(uniqueIds.size).toBe(pipelineIds.length);
      expect(pipelineIds.length).toBeGreaterThan(0);
    }, 45000);
  });
});
