import { jest } from '@jest/globals';

export const mockOpenAIClient = {
  chatCompletion: jest.fn() as jest.MockedFunction<any>,
  visionRequest: jest.fn() as jest.MockedFunction<any>,
  createEmbedding: jest.fn() as jest.MockedFunction<any>,
  calculateCost: jest.fn() as jest.MockedFunction<any>,
  isValidBase64Image: jest.fn() as jest.MockedFunction<any>,
  updateConfig: jest.fn() as jest.MockedFunction<any>,
  getConfig: jest.fn() as jest.MockedFunction<any>,
  getInstance: jest.fn() as jest.MockedFunction<any>
};

export const mockHTMLGenerator = {
  generateHTML: jest.fn() as jest.MockedFunction<any>,
  generateBatch: jest.fn() as jest.MockedFunction<any>,
  generateWithImage: jest.fn() as jest.MockedFunction<any>,
  getGenerationStats: jest.fn() as jest.MockedFunction<any>,
  getInstance: jest.fn() as jest.MockedFunction<any>
};

export const mockIterativeRefinement = {
  refineCode: jest.fn() as jest.MockedFunction<any>,
  getRefinementStats: jest.fn() as jest.MockedFunction<any>,
  getInstance: jest.fn() as jest.MockedFunction<any>
};

export const mockPipelineExecutor = {
  executePipeline: jest.fn() as jest.MockedFunction<any>,
  getPipelineStatus: jest.fn() as jest.MockedFunction<any>,
  getInstance: jest.fn() as jest.MockedFunction<any>
};

export const mockHTMLValidator = {
  validateHTML: jest.fn() as jest.MockedFunction<any>,
  getInstance: jest.fn() as jest.MockedFunction<any>
};

export const mockPromptManager = {
  getPrompt: jest.fn() as jest.MockedFunction<any>,
  getSplittingPrompt: jest.fn() as jest.MockedFunction<any>,
  getGenerationPrompt: jest.fn() as jest.MockedFunction<any>,
  getRefinementPrompt: jest.fn() as jest.MockedFunction<any>,
  getAnalysisPrompt: jest.fn() as jest.MockedFunction<any>,
  getInstance: jest.fn() as jest.MockedFunction<any>
};

export const mockSplittingService = {
  generateSplittingSuggestions: jest.fn() as jest.MockedFunction<any>,
  getInstance: jest.fn() as jest.MockedFunction<any>
};

export function setupDomainServiceMocks() {
  mockOpenAIClient.chatCompletion.mockResolvedValue({
    choices: [{ message: { content: '{"html": "<div>Test HTML</div>", "css": "/* Test CSS */"}' } }],
    usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 }
  });
  
  mockOpenAIClient.visionRequest.mockResolvedValue({
    choices: [{ message: { content: '{"html": "<div>Vision HTML</div>", "css": "/* Vision CSS */"}' } }],
    usage: { total_tokens: 150, prompt_tokens: 75, completion_tokens: 75 }
  });
  
  mockOpenAIClient.calculateCost.mockReturnValue(0.01);
  mockOpenAIClient.isValidBase64Image.mockReturnValue(true);
  
  mockHTMLGenerator.generateHTML.mockResolvedValue({
    html: '<div class="container mx-auto p-6"><h1 class="text-3xl font-bold mb-4">Generated HTML</h1></div>',
    css: '/* Generated CSS */',
    metadata: { sectionType: 'hero', framework: 'tailwind' },
    qualityScore: 85,
    aiMetrics: { tokens: 100, cost: 0.01, duration: 1000, model: 'gpt-4o' },
    validation: { errors: [], warnings: [], suggestions: [] }
  });
  
  mockIterativeRefinement.refineCode.mockResolvedValue({
    html: '<div class="refined">Refined HTML</div>',
    css: '/* Refined CSS */',
    iterations: [],
    finalQualityScore: 90,
    improvementAchieved: true,
    metadata: { totalTime: 2000, totalCost: 0.02, totalTokens: 200, convergenceReached: true }
  });
  
  mockPipelineExecutor.executePipeline.mockResolvedValue({
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
    finalResult: { sections: [], qualityScore: 85 }
  });
  
  mockHTMLValidator.validateHTML.mockResolvedValue({
    isValid: true,
    score: 85,
    errors: [],
    warnings: [],
    suggestions: []
  });
  
  mockPromptManager.getPrompt.mockResolvedValue('Test prompt');
  mockPromptManager.getGenerationPrompt.mockResolvedValue('Generation prompt');
  
  mockSplittingService.generateSplittingSuggestions.mockResolvedValue([
    {
      name: 'Header',
      type: 'header',
      bounds: { x: 0, y: 0, width: 100, height: 15 },
      confidence: 0.9,
      description: 'Top navigation and branding area'
    },
    {
      name: 'Hero Section',
      type: 'hero',
      bounds: { x: 0, y: 15, width: 100, height: 35 },
      confidence: 0.8,
      description: 'Main promotional content area'
    }
  ]);
  
  mockOpenAIClient.getInstance.mockReturnValue(mockOpenAIClient);
  mockHTMLGenerator.getInstance.mockReturnValue(mockHTMLGenerator);
  mockIterativeRefinement.getInstance.mockReturnValue(mockIterativeRefinement);
  mockPipelineExecutor.getInstance.mockReturnValue(mockPipelineExecutor);
  mockHTMLValidator.getInstance.mockReturnValue(mockHTMLValidator);
  mockPromptManager.getInstance.mockReturnValue(mockPromptManager);
  mockSplittingService.getInstance.mockReturnValue(mockSplittingService);

  const { PipelineExecutor } = require('../../services/pipeline/PipelineExecutor');
  const { HTMLGenerator } = require('../../services/ai/generation/HTMLGenerator');
  const { IterativeRefinement } = require('../../services/ai/analysis/IterativeRefinement');
  const { OpenAIClient } = require('../../services/core/ai/OpenAIClient');
  const { HTMLValidator } = require('../../services/quality/validation/HTMLValidator');
  const { PromptManager } = require('../../services/ai/prompts/PromptManager');

  if (PipelineExecutor.getInstance) {
    PipelineExecutor.getInstance = jest.fn().mockReturnValue(mockPipelineExecutor);
  }
  if (HTMLGenerator.getInstance) {
    HTMLGenerator.getInstance = jest.fn().mockReturnValue(mockHTMLGenerator);
  }
  if (IterativeRefinement.getInstance) {
    IterativeRefinement.getInstance = jest.fn().mockReturnValue(mockIterativeRefinement);
  }
  if (OpenAIClient.getInstance) {
    OpenAIClient.getInstance = jest.fn().mockReturnValue(mockOpenAIClient);
  }
  if (HTMLValidator.getInstance) {
    HTMLValidator.getInstance = jest.fn().mockReturnValue(mockHTMLValidator);
  }
  if (PromptManager.getInstance) {
    PromptManager.getInstance = jest.fn().mockReturnValue(mockPromptManager);
  }
}
