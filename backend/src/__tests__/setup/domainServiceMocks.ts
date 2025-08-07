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

export const mockPipelineProgressTracker = {
  trackProgress: jest.fn() as jest.MockedFunction<any>,
  getProgress: jest.fn() as jest.MockedFunction<any>,
  updatePhase: jest.fn() as jest.MockedFunction<any>,
  completePhase: jest.fn() as jest.MockedFunction<any>,
  getInstance: jest.fn() as jest.MockedFunction<any>
};

export const mockQualityMetricsDashboard = {
  recordMetric: jest.fn() as jest.MockedFunction<any>,
  getMetrics: jest.fn() as jest.MockedFunction<any>,
  generateReport: jest.fn() as jest.MockedFunction<any>,
  getInstance: jest.fn() as jest.MockedFunction<any>
};

export const mockErrorRecoverySystem = {
  handleError: jest.fn() as jest.MockedFunction<any>,
  registerStrategy: jest.fn() as jest.MockedFunction<any>,
  getRecoveryStrategies: jest.fn() as jest.MockedFunction<any>,
  getInstance: jest.fn() as jest.MockedFunction<any>
};

export const mockHubSpotAPIService = {
  uploadModule: jest.fn() as jest.MockedFunction<any>,
  validateModule: jest.fn() as jest.MockedFunction<any>,
  getPortalInfo: jest.fn() as jest.MockedFunction<any>,
  getInstance: jest.fn() as jest.MockedFunction<any>
};

export const mockPipelineController = {
  executePipeline: jest.fn() as jest.MockedFunction<any>,
  convertDesignToHTML: jest.fn() as jest.MockedFunction<any>,
  refineHTML: jest.fn() as jest.MockedFunction<any>,
  getSupportedFileTypes: jest.fn() as jest.MockedFunction<any>,
  regenerateSectionHTML: jest.fn() as jest.MockedFunction<any>
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
  
  mockPipelineExecutor.executePipeline.mockImplementation(() => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    return Promise.resolve({
      id: `pipeline_${timestamp}_${randomId}`,
      status: 'completed',
      phases: [
        { name: 'Input Processing', status: 'completed', duration: 100 },
        { name: 'AI Analysis', status: 'completed', duration: 200 },
        { name: 'HTML Generation', status: 'completed', duration: 300 }
      ],
      startTime: Date.now() - 1000,
      endTime: Date.now(),
      totalDuration: 1000,
      processingTime: 1000,
      qualityScore: 85,
      sections: [
        { 
          id: 'section_1', 
          name: 'Header', 
          type: 'header', 
          html: '<header>Test</header>',
          editableFields: ['title', 'subtitle'],
          qualityScore: 85
        },
        { 
          id: 'section_2', 
          name: 'Content', 
          type: 'content', 
          html: '<main>Test</main>',
          editableFields: ['content', 'cta'],
          qualityScore: 90
        }
      ],
      finalResult: { sections: [], qualityScore: 85 },
      metadata: {
        processingTime: 1250,
        sectionsGenerated: 4,
        totalTokens: 500,
        totalCost: 0.05,
        phaseTimes: {
          'Input Processing': 100,
          'AI Analysis': 200,
          'HTML Generation': 300
        },
        totalPhases: 3,
        successfulPhases: 3,
        failedPhases: 0
      }
    });
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
  
  mockPipelineProgressTracker.trackProgress.mockResolvedValue(undefined);
  mockPipelineProgressTracker.getProgress.mockReturnValue({
    pipelineId: 'test_pipeline',
    currentPhase: 'HTML Generation',
    progress: 75,
    status: 'in_progress'
  });
  
  mockQualityMetricsDashboard.recordMetric.mockResolvedValue(undefined);
  mockQualityMetricsDashboard.getMetrics.mockReturnValue({
    overall: 85,
    trends: { improving: true },
    lastUpdated: Date.now()
  });
  
  mockErrorRecoverySystem.handleError.mockResolvedValue({
    recovered: true,
    strategy: 'fallback',
    result: { success: true }
  });
  
  mockHubSpotAPIService.uploadModule.mockResolvedValue({
    success: true,
    moduleId: 'test_module_123'
  });
  mockHubSpotAPIService.validateModule.mockResolvedValue({
    isValid: true,
    errors: []
  });
  
  mockPipelineController.convertDesignToHTML.mockResolvedValue({
    fileName: 'test-design.png',
    fileSize: 1024,
    analysis: {
      html: '<div class="container mx-auto p-6"><h1 class="text-3xl font-bold mb-4">Generated HTML</h1></div>',
      sections: [
        { id: 'header', type: 'header', html: '<header>Header</header>' },
        { id: 'hero', type: 'hero', html: '<section>Hero</section>' }
      ],
      components: [],
      description: 'Design converted to HTML'
    }
  });
  
  mockPipelineController.refineHTML.mockResolvedValue({
    html: '<div class="refined">Refined HTML</div>',
    css: '/* Refined CSS */',
    metadata: { improvements: ['Better structure', 'Improved accessibility'] }
  });
  
  mockPipelineController.getSupportedFileTypes.mockReturnValue({
    supportedTypes: [
      { type: 'image/png', extensions: ['.png'] },
      { type: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
      { type: 'image/gif', extensions: ['.gif'] },
      { type: 'image/webp', extensions: ['.webp'] }
    ]
  });
  
  mockPipelineController.executePipeline.mockResolvedValue({
    id: 'pipeline_test_123',
    status: 'completed',
    phases: [
      { name: 'Input Processing', status: 'completed', duration: 100 },
      { name: 'AI Analysis', status: 'completed', duration: 200 },
      { name: 'HTML Generation', status: 'completed', duration: 300 }
    ],
    startTime: Date.now() - 1250,
    endTime: Date.now(),
    totalDuration: 1250,
    processingTime: 1250,
    finalResult: { sections: [], qualityScore: 85 },
    metadata: {
      processingTime: 1250,
      sectionsGenerated: 4,
      qualityScore: 85,
      totalTokens: 500,
      totalCost: 0.05
    }
  });
  
  mockOpenAIClient.getInstance.mockReturnValue(mockOpenAIClient);
  mockHTMLGenerator.getInstance.mockReturnValue(mockHTMLGenerator);
  mockIterativeRefinement.getInstance.mockReturnValue(mockIterativeRefinement);
  mockPipelineExecutor.getInstance.mockReturnValue(mockPipelineExecutor);
  mockHTMLValidator.getInstance.mockReturnValue(mockHTMLValidator);
  mockPromptManager.getInstance.mockReturnValue(mockPromptManager);
  mockSplittingService.getInstance.mockReturnValue(mockSplittingService);
  mockPipelineProgressTracker.getInstance.mockReturnValue(mockPipelineProgressTracker);
  mockQualityMetricsDashboard.getInstance.mockReturnValue(mockQualityMetricsDashboard);
  mockErrorRecoverySystem.getInstance.mockReturnValue(mockErrorRecoverySystem);
  mockHubSpotAPIService.getInstance.mockReturnValue(mockHubSpotAPIService);

  try {
    const PipelineControllerModule = jest.requireActual('../../controllers/PipelineController') as any;
    const mockPipelineController = new PipelineControllerModule.PipelineController(
      mockPipelineExecutor,
      mockHTMLGenerator,
      mockIterativeRefinement
    );
    
    const pipelineRoutes = require('../../routes/pipeline');
    if (pipelineRoutes.setPipelineController) {
      pipelineRoutes.setPipelineController(mockPipelineController);
    }
    
    const designRoutes = require('../../routes/design');
    if (designRoutes.setPipelineController) {
      designRoutes.setPipelineController(mockPipelineController);
    }
  } catch (error) {
  }

  jest.doMock('../../services/pipeline/PipelineExecutor', () => ({
    PipelineExecutor: jest.fn().mockImplementation(() => mockPipelineExecutor),
    default: mockPipelineExecutor
  }));

  jest.doMock('../../services/ai/generation/HTMLGenerator', () => ({
    HTMLGenerator: jest.fn().mockImplementation(() => mockHTMLGenerator),
    default: mockHTMLGenerator
  }));

  jest.doMock('../../services/ai/analysis/IterativeRefinement', () => ({
    IterativeRefinement: jest.fn().mockImplementation(() => mockIterativeRefinement),
    default: mockIterativeRefinement
  }));

  jest.doMock('../../services/core/ai/OpenAIClient', () => ({
    OpenAIClient: jest.fn().mockImplementation(() => mockOpenAIClient),
    default: mockOpenAIClient
  }));

  jest.doMock('../../services/quality/validation/HTMLValidator', () => ({
    HTMLValidator: jest.fn().mockImplementation(() => mockHTMLValidator),
    default: mockHTMLValidator
  }));

  jest.doMock('../../services/ai/prompts/PromptManager', () => ({
    PromptManager: jest.fn().mockImplementation(() => mockPromptManager),
    default: mockPromptManager
  }));

  jest.doMock('../../services/pipeline/PipelineProgressTracker', () => ({
    PipelineProgressTracker: jest.fn().mockImplementation(() => mockPipelineProgressTracker),
    default: mockPipelineProgressTracker
  }));

  jest.doMock('../../services/quality/QualityMetricsDashboard', () => ({
    QualityMetricsDashboard: jest.fn().mockImplementation(() => mockQualityMetricsDashboard),
    default: mockQualityMetricsDashboard
  }));

  jest.doMock('../../services/recovery/ErrorRecoverySystem', () => ({
    ErrorRecoverySystem: jest.fn().mockImplementation(() => mockErrorRecoverySystem),
    default: mockErrorRecoverySystem
  }));

  jest.doMock('../../services/deployment/HubSpotAPIService', () => ({
    HubSpotAPIService: jest.fn().mockImplementation(() => mockHubSpotAPIService),
    default: mockHubSpotAPIService
  }));

  jest.doMock('../../services/ai/splitting/SplittingService', () => ({
    SplittingService: mockSplittingService,
    default: mockSplittingService
  }));
}
