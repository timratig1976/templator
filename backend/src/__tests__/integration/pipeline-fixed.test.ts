import request from 'supertest';
import { Express } from 'express';
import path from 'path';
import fs from 'fs';

const mockPipelineExecutorInstance = {
  executePipeline: jest.fn().mockResolvedValue({
    id: 'pipeline_test_123',
    status: 'completed',
    phases: [
      { name: 'Input Processing', status: 'completed', duration: 100 },
      { name: 'AI Analysis', status: 'completed', duration: 200 },
      { name: 'HTML Generation', status: 'completed', duration: 300 }
    ],
    startTime: Date.now() - 1000,
    endTime: Date.now(),
    totalDuration: 1000,
    sections: [
      {
        id: 'section_1',
        name: 'Header',
        type: 'header',
        html: '<h1>Test Header</h1>',
        editableFields: []
      }
    ],
    qualityScore: 85,
    processingTime: 1000,
    validationPassed: true,
    enhancementsApplied: [],
    packagedModule: { moduleId: 'test_module' },
    metadata: {
      phaseTimes: { phase1: 100, phase2: 200, phase3: 300 },
      totalSections: 1,
      averageQuality: 85,
      timestamp: new Date().toISOString()
    }
  }),
  getPipelineStatus: jest.fn().mockResolvedValue({ status: 'completed' })
};

const mockHTMLGeneratorInstance = {
  generateHTML: jest.fn().mockResolvedValue({
    html: '<div>Generated HTML</div>',
    css: '/* Generated CSS */',
    metadata: { sectionType: 'hero', framework: 'tailwind' },
    qualityScore: 85,
    aiMetrics: { tokens: 100, cost: 0.01, duration: 1000, model: 'gpt-4o' },
    validation: { errors: [], warnings: [], suggestions: [] }
  }),
  generateBatch: jest.fn(),
  generateWithImage: jest.fn(),
  getGenerationStats: jest.fn()
};

const mockIterativeRefinementInstance = {
  refineCode: jest.fn().mockResolvedValue({
    html: '<div class="refined">Refined HTML</div>',
    css: '/* Refined CSS */',
    iterations: [],
    finalQualityScore: 90,
    improvementAchieved: true,
    metadata: { totalTime: 2000, totalCost: 0.02, totalTokens: 200, convergenceReached: true }
  }),
  getRefinementStats: jest.fn()
};

const mockOpenAIClientInstance = {
  chatCompletion: jest.fn().mockResolvedValue({
    choices: [{ message: { content: '{"html": "<div>Test HTML</div>", "css": "/* Test CSS */"}' } }],
    usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 }
  }),
  visionRequest: jest.fn(),
  createEmbedding: jest.fn(),
  calculateCost: jest.fn().mockReturnValue(0.01),
  isValidBase64Image: jest.fn().mockReturnValue(true),
  updateConfig: jest.fn(),
  getConfig: jest.fn()
};

const mockHTMLValidatorInstance = {
  validateHTML: jest.fn().mockResolvedValue({
    isValid: true,
    score: 85,
    errors: [],
    warnings: [],
    suggestions: []
  })
};

const mockPromptManagerInstance = {
  getPrompt: jest.fn().mockResolvedValue('Test prompt'),
  getSplittingPrompt: jest.fn(),
  getGenerationPrompt: jest.fn().mockResolvedValue('Generation prompt'),
  getRefinementPrompt: jest.fn(),
  getAnalysisPrompt: jest.fn()
};

jest.mock('../../services/pipeline/PipelineExecutor', () => ({
  PipelineExecutor: {
    getInstance: jest.fn(() => mockPipelineExecutorInstance)
  }
}));

jest.mock('../../services/ai/generation/HTMLGenerator', () => ({
  HTMLGenerator: {
    getInstance: jest.fn(() => mockHTMLGeneratorInstance)
  }
}));

jest.mock('../../services/ai/analysis/IterativeRefinement', () => ({
  IterativeRefinement: {
    getInstance: jest.fn(() => mockIterativeRefinementInstance)
  }
}));

jest.mock('../../services/core/ai/OpenAIClient', () => ({
  OpenAIClient: {
    getInstance: jest.fn(() => mockOpenAIClientInstance)
  }
}));

jest.mock('../../services/quality/validation/HTMLValidator', () => ({
  HTMLValidator: {
    getInstance: jest.fn(() => mockHTMLValidatorInstance)
  }
}));

jest.mock('../../services/ai/prompts/PromptManager', () => ({
  PromptManager: {
    getInstance: jest.fn(() => mockPromptManagerInstance)
  }
}));

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

import { createApp } from '../../app';

describe('Pipeline API Integration Tests (Fixed)', () => {
  let app: any;
  const testImagePath = path.join(__dirname, '../fixtures/test-design-fixed.png');
  
  beforeAll(async () => {
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
      }

      expect(mockPipelineExecutorInstance.executePipeline).toHaveBeenCalled();
    }, 30000);

    test('should reject request without file upload', async () => {
      const response = await request(app)
        .post('/api/pipeline/execute')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No design file uploaded');
    });

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
    });
  });
});
