import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { IterativeRefinementService, ConfidenceMetrics, RefinementConfig } from '../../src/services/IterativeRefinementService';
import { HubSpotValidationService, ValidationSeverity } from '../../src/services/HubSpotValidationService';
import { HubSpotPromptService, ModuleGenerationRequest, GeneratedModule } from '../../src/services/HubSpotPromptService';

// Mock OpenAI service
jest.mock('../../src/services/openaiService', () => ({
  generateHubSpotModule: jest.fn()
}));

describe('IterativeRefinementService', () => {
  let refinementService: IterativeRefinementService;
  let mockValidationService: jest.Mocked<HubSpotValidationService>;
  let mockPromptService: jest.Mocked<HubSpotPromptService>;

  beforeEach(() => {
    refinementService = IterativeRefinementService.getInstance();
    
    // Mock validation service
    mockValidationService = {
      validateModule: jest.fn()
    } as any;
    
    // Mock prompt service
    mockPromptService = {
      generateModule: jest.fn()
    } as any;
  });

  describe('Confidence Metrics Calculation', () => {
    it('should calculate confidence metrics correctly for high-quality module', () => {
      const generatedModule: GeneratedModule = {
        fields: [
          { id: 'title', name: 'Title', label: 'Title', type: 'text' }
        ],
        meta: {
          label: 'Test Module',
          content_types: ['page']
        },
        template: '<h1>{{ module.title }}</h1>'
      };

      const validationResult = {
        valid: true,
        score: 95,
        errors: [],
        warnings: [],
        suggestions: [],
        metrics: {
          accessibility_score: 90,
          performance_score: 85,
          complexity_score: 75,
          maintainability_score: 80
        },
        processingTime: 100
      };

      const confidence = refinementService.calculateConfidenceMetrics(generatedModule, validationResult);

      expect(confidence.overall).toBeGreaterThan(90);
      expect(confidence.fieldAccuracy).toBe(100);
      expect(confidence.templateQuality).toBe(100);
      expect(confidence.syntaxCorrectness).toBe(100);
      expect(confidence.accessibilityCompliance).toBe(90);
      expect(confidence.performanceOptimization).toBe(85);
    });

    it('should calculate confidence metrics correctly for low-quality module', () => {
      const generatedModule: GeneratedModule = {
        fields: [
          { id: '123invalid', name: 'Invalid', type: 'invalid_type' }
        ],
        meta: {
          label: 'Test Module'
          // Missing content_types
        },
        template: '<div>{{ module.undefined_field }}</div>'
      };

      const validationResult = {
        valid: false,
        score: 25,
        errors: [
          {
            type: ValidationSeverity.CRITICAL,
            category: 'FIELD' as any,
            code: 'FIELD_INVALID_ID',
            message: 'Invalid field ID',
            fix: 'Use valid field ID'
          },
          {
            type: ValidationSeverity.CRITICAL,
            category: 'TEMPLATE' as any,
            code: 'TEMPLATE_UNDEFINED_FIELD',
            message: 'Undefined field reference',
            fix: 'Define field or remove reference'
          }
        ],
        warnings: [],
        suggestions: [],
        metrics: {
          accessibility_score: 40,
          performance_score: 30,
          complexity_score: 60,
          maintainability_score: 35
        },
        processingTime: 150
      };

      const confidence = refinementService.calculateConfidenceMetrics(generatedModule, validationResult);

      expect(confidence.overall).toBeLessThan(50);
      expect(confidence.fieldAccuracy).toBeLessThan(70);
      expect(confidence.templateQuality).toBeLessThan(70);
    });
  });

  describe('Refinement Prompt Generation', () => {
    it('should generate comprehensive refinement prompt', () => {
      const originalRequest: ModuleGenerationRequest = {
        moduleType: 'hero',
        designDescription: 'Create a hero section with title and button',
        requirements: 'Must be accessible and mobile-friendly'
      };

      const validationResult = {
        valid: false,
        score: 60,
        errors: [
          {
            type: ValidationSeverity.CRITICAL,
            category: 'FIELD' as any,
            code: 'FIELD_INVALID_ID',
            message: 'Field ID contains invalid characters',
            fix: 'Use lowercase letters, numbers, and underscores only'
          }
        ],
        warnings: [],
        suggestions: [
          {
            type: ValidationSeverity.LOW,
            category: 'ACCESSIBILITY' as any,
            code: 'ACCESSIBILITY_IMPROVEMENT',
            message: 'Consider adding ARIA labels',
            fix: 'Add aria-label attributes'
          }
        ],
        metrics: {},
        processingTime: 100
      };

      const prompt = refinementService.generateRefinementPrompt(
        originalRequest,
        validationResult,
        [],
        ['accessibility', 'field-validation']
      );

      expect(prompt).toContain('hero');
      expect(prompt).toContain('FIELD_INVALID_ID');
      expect(prompt).toContain('accessibility');
      expect(prompt).toContain('field-validation');
      expect(prompt).toContain('CRITICAL ISSUES TO FIX');
      expect(prompt).toContain('IMPROVEMENT SUGGESTIONS');
    });

    it('should include previous iteration context', () => {
      const originalRequest: ModuleGenerationRequest = {
        moduleType: 'hero',
        designDescription: 'Create a hero section'
      };

      const validationResult = {
        valid: false,
        score: 70,
        errors: [],
        warnings: [],
        suggestions: [],
        metrics: {},
        processingTime: 100
      };

      const previousIterations = [
        {
          iteration: 1,
          generatedModule: {} as GeneratedModule,
          validationResult: {} as any,
          confidence: {} as ConfidenceMetrics,
          improvements: ['Fixed field IDs', 'Added accessibility attributes'],
          refinementPrompt: 'Previous prompt',
          timestamp: new Date()
        }
      ];

      const prompt = refinementService.generateRefinementPrompt(
        originalRequest,
        validationResult,
        previousIterations
      );

      expect(prompt).toContain('Previous refinement attempts (1)');
      expect(prompt).toContain('Fixed field IDs');
      expect(prompt).toContain('Added accessibility attributes');
    });
  });

  describe('Refinement Process', () => {
    it('should stop refinement when confidence threshold is reached', async () => {
      const originalRequest: ModuleGenerationRequest = {
        moduleType: 'hero',
        designDescription: 'Create a hero section'
      };

      const initialModule: GeneratedModule = {
        fields: [{ id: 'title', name: 'Title', label: 'Title', type: 'text' }],
        meta: { label: 'Hero', content_types: ['page'] },
        template: '<h1>{{ module.title }}</h1>'
      };

      const config: RefinementConfig = {
        maxIterations: 3,
        confidenceThreshold: 85,
        improvementThreshold: 10,
        focusAreas: [],
        enableDeepRefinement: true
      };

      // Mock high-confidence validation result
      mockValidationService.validateModule = jest.fn().mockResolvedValue({
        valid: true,
        score: 90,
        errors: [],
        warnings: [],
        suggestions: [],
        metrics: {
          accessibility_score: 90,
          performance_score: 85,
          complexity_score: 80,
          maintainability_score: 85
        },
        processingTime: 100
      });

      // Replace the actual validation service with mock
      (refinementService as any).validationService = mockValidationService;

      const result = await refinementService.refineModule(originalRequest, initialModule, config);

      expect(result.totalIterations).toBe(1);
      expect(result.finalConfidence.overall).toBeGreaterThanOrEqual(85);
      expect(result.improvementAchieved).toBe(true);
    });

    it('should continue refinement until max iterations when confidence is low', async () => {
      const originalRequest: ModuleGenerationRequest = {
        moduleType: 'hero',
        designDescription: 'Create a hero section'
      };

      const initialModule: GeneratedModule = {
        fields: [{ id: 'invalid-id', name: 'Title', type: 'invalid' }],
        meta: { label: 'Hero' },
        template: '<div>{{ module.undefined }}</div>'
      };

      const config: RefinementConfig = {
        maxIterations: 2,
        confidenceThreshold: 90,
        improvementThreshold: 5,
        focusAreas: [],
        enableDeepRefinement: true
      };

      // Mock low-confidence validation results
      mockValidationService.validateModule = jest.fn().mockResolvedValue({
        valid: false,
        score: 40,
        errors: [
          {
            type: ValidationSeverity.CRITICAL,
            category: 'FIELD' as any,
            code: 'FIELD_INVALID_ID',
            message: 'Invalid field ID',
            fix: 'Fix field ID'
          }
        ],
        warnings: [],
        suggestions: [],
        metrics: {
          accessibility_score: 50,
          performance_score: 45,
          complexity_score: 60,
          maintainability_score: 40
        },
        processingTime: 150
      });

      // Mock prompt service to return improved module
      mockPromptService.generateModule = jest.fn().mockResolvedValue({
        fields: [{ id: 'title', name: 'Title', label: 'Title', type: 'text' }],
        meta: { label: 'Hero', content_types: ['page'] },
        template: '<h1>{{ module.title }}</h1>'
      });

      // Replace services with mocks
      (refinementService as any).validationService = mockValidationService;
      (refinementService as any).promptService = mockPromptService;

      const result = await refinementService.refineModule(originalRequest, initialModule, config);

      expect(result.totalIterations).toBe(2);
      expect(result.iterations).toHaveLength(2);
    });
  });

  describe('Improvement Analysis', () => {
    it('should generate appropriate improvement suggestions', () => {
      const validationResult = {
        valid: false,
        score: 50,
        errors: [
          {
            type: ValidationSeverity.CRITICAL,
            category: 'FIELD' as any,
            code: 'FIELD_INVALID_ID',
            message: 'Invalid field ID',
            fix: 'Fix field ID'
          },
          {
            type: ValidationSeverity.HIGH,
            category: 'TEMPLATE' as any,
            code: 'TEMPLATE_SYNTAX_ERROR',
            message: 'Template syntax error',
            fix: 'Fix syntax'
          }
        ],
        warnings: [],
        suggestions: [],
        metrics: {},
        processingTime: 100
      };

      const confidence: ConfidenceMetrics = {
        overall: 50,
        fieldAccuracy: 60,
        templateQuality: 70,
        syntaxCorrectness: 80,
        accessibilityCompliance: 40,
        performanceOptimization: 45,
        hubspotCompliance: 55
      };

      const improvements = (refinementService as any).generateImprovementsList(validationResult, confidence);

      expect(improvements).toContain('Fix 1 critical validation errors');
      expect(improvements).toContain('Resolve 1 high-priority issues');
      expect(improvements).toContain('Add accessibility attributes and ARIA labels');
      expect(improvements).toContain('Optimize for performance and loading speed');
    });
  });

  describe('Effectiveness Analysis', () => {
    it('should analyze refinement effectiveness correctly', () => {
      const result = {
        finalModule: {} as GeneratedModule,
        finalValidation: {} as any,
        finalConfidence: { overall: 85 } as ConfidenceMetrics,
        iterations: [
          {
            iteration: 1,
            confidence: { overall: 60 } as ConfidenceMetrics
          },
          {
            iteration: 2,
            confidence: { overall: 75 } as ConfidenceMetrics
          }
        ],
        totalIterations: 2,
        improvementAchieved: true,
        processingTime: 5000
      } as any;

      const analysis = refinementService.analyzeRefinementEffectiveness(result);

      expect(analysis.effectiveness).toBeGreaterThan(40); // 25 point improvement * 2
      expect(analysis.insights).toContain('Significant improvement achieved through refinement');
      expect(analysis.insights).toContain('Moderate efficiency per iteration');
      expect(analysis.insights).toContain('Good final quality achieved');
    });

    it('should provide recommendations for poor performance', () => {
      const result = {
        finalModule: {} as GeneratedModule,
        finalValidation: {} as any,
        finalConfidence: { 
          overall: 65,
          accessibilityCompliance: 70,
          performanceOptimization: 75
        } as ConfidenceMetrics,
        iterations: [
          {
            iteration: 1,
            confidence: { overall: 60 } as ConfidenceMetrics
          }
        ],
        totalIterations: 1,
        improvementAchieved: false,
        processingTime: 2000
      } as any;

      const analysis = refinementService.analyzeRefinementEffectiveness(result);

      expect(analysis.recommendations).toContain('Consider additional refinement iterations');
    });
  });
});
