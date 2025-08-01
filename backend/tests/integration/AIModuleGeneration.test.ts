import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { HubSpotModuleBuilder } from '../../src/services/HubSpotModuleBuilder';
import { HubSpotValidationService } from '../../src/services/HubSpotValidationService';
import { IterativeRefinementService } from '../../src/services/IterativeRefinementService';
import { AutoErrorCorrectionService } from '../../src/services/AutoErrorCorrectionService';
import { PromptVersioningService } from '../../src/services/PromptVersioningService';
import { ModuleGenerationRequest } from '../../src/services/HubSpotPromptService';

// Mock OpenAI service for testing
jest.mock('../../src/services/openaiService', () => ({
  generateHubSpotModule: jest.fn()
}));

describe('AI Module Generation End-to-End Tests', () => {
  let moduleBuilder: HubSpotModuleBuilder;
  let validationService: HubSpotValidationService;
  let refinementService: IterativeRefinementService;
  let correctionService: AutoErrorCorrectionService;
  let versioningService: PromptVersioningService;

  beforeEach(() => {
    moduleBuilder = new HubSpotModuleBuilder();
    validationService = HubSpotValidationService.getInstance();
    refinementService = IterativeRefinementService.getInstance();
    correctionService = AutoErrorCorrectionService.getInstance();
    versioningService = PromptVersioningService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete AI Generation Pipeline', () => {
    it('should generate high-quality hero module with AI', async () => {
      // Mock OpenAI response for hero module
      const mockOpenAIResponse = `
Here's a complete HubSpot hero module:

\`\`\`json
[
  {
    "id": "hero_title",
    "name": "Hero Title",
    "label": "Hero Title",
    "type": "text",
    "required": false,
    "default": "Welcome to Our Website"
  },
  {
    "id": "hero_description",
    "name": "Hero Description", 
    "label": "Hero Description",
    "type": "textarea",
    "required": false,
    "default": "Discover amazing products and services"
  },
  {
    "id": "hero_button_text",
    "name": "Button Text",
    "label": "Button Text", 
    "type": "text",
    "required": false,
    "default": "Get Started"
  },
  {
    "id": "hero_button_url",
    "name": "Button URL",
    "label": "Button URL",
    "type": "url",
    "required": false
  }
]
\`\`\`

\`\`\`json
{
  "label": "Hero Section",
  "css_assets": [],
  "js_assets": [],
  "other_assets": [],
  "content_types": ["page", "blog-post"],
  "module_id": 123456789
}
\`\`\`

\`\`\`html
<div class="hero-section" role="banner">
  <div class="hero-content">
    <h1 class="hero-title">{{ module.hero_title }}</h1>
    <p class="hero-description">{{ module.hero_description }}</p>
    {% if module.hero_button_text and module.hero_button_url %}
      <a href="{{ module.hero_button_url }}" class="hero-button btn btn-primary" aria-label="{{ module.hero_button_text }}">
        {{ module.hero_button_text }}
      </a>
    {% endif %}
  </div>
</div>
      `;

      const mockOpenAI = require('../../src/services/openaiService');
      mockOpenAI.generateHubSpotModule.mockResolvedValue(mockOpenAIResponse);

      const request: ModuleGenerationRequest = {
        moduleType: 'hero',
        designDescription: 'Create a hero section with title, description, and call-to-action button',
        requirements: 'Must be accessible and mobile-friendly',
        accessibility: true,
        performance: true,
        mobileFirst: true
      };

      const result = await moduleBuilder.generateModuleWithAI(request);

      // Verify the module was generated
      expect(result).toBeDefined();
      expect(result.module_slug).toMatch(/^hero_module_\d+$/);
      expect(result.download_url).toContain('/download/');
      expect(result.manifest).toBeDefined();

      // Verify module structure
      expect(result.manifest.fields).toHaveLength(4);
      expect(result.manifest.module_slug).toMatch(/^hero_module_\d+$/);
      // Note: ModuleManifest doesn't include meta or template in the shared interface

      // Verify quality metrics
      expect(result.validation_result?.score).toBeGreaterThan(80);
      expect(result.validation_result?.valid).toBe(true);
    }, 30000);

    it('should handle complex feature grid module generation', async () => {
      const mockOpenAIResponse = `
\`\`\`json
[
  {
    "id": "features_title",
    "name": "Features Title",
    "label": "Features Section Title",
    "type": "text",
    "required": false,
    "default": "Our Features"
  },
  {
    "id": "features_list",
    "name": "Features List",
    "label": "Features List",
    "type": "repeater",
    "required": false,
    "children": [
      {
        "id": "feature_icon",
        "name": "Feature Icon",
        "label": "Feature Icon",
        "type": "image",
        "required": false
      },
      {
        "id": "feature_title",
        "name": "Feature Title",
        "label": "Feature Title",
        "type": "text",
        "required": true
      },
      {
        "id": "feature_description",
        "name": "Feature Description",
        "label": "Feature Description",
        "type": "textarea",
        "required": false
      }
    ]
  }
]
\`\`\`

\`\`\`json
{
  "label": "Feature Grid",
  "css_assets": [],
  "js_assets": [],
  "other_assets": [],
  "content_types": ["page"],
  "module_id": 123456790
}
\`\`\`

\`\`\`html
<section class="features-section" aria-labelledby="features-heading">
  <div class="container">
    <h2 id="features-heading" class="features-title">{{ module.features_title }}</h2>
    <div class="features-grid" role="list">
      {% for feature in module.features_list %}
        <div class="feature-item" role="listitem">
          {% if feature.feature_icon.src %}
            <img src="{{ feature.feature_icon.src }}" alt="{{ feature.feature_icon.alt or feature.feature_title }}" class="feature-icon">
          {% endif %}
          <h3 class="feature-title">{{ feature.feature_title }}</h3>
          {% if feature.feature_description %}
            <p class="feature-description">{{ feature.feature_description }}</p>
          {% endif %}
        </div>
      {% endfor %}
    </div>
  </div>
</section>
\`\`\`
      `;

      const mockOpenAI = require('../../src/services/openaiService');
      mockOpenAI.generateHubSpotModule.mockResolvedValue(mockOpenAIResponse);

      const request: ModuleGenerationRequest = {
        moduleType: 'feature_grid',
        designDescription: 'Create a responsive feature grid with icons, titles, and descriptions',
        requirements: 'Support for multiple features with repeater fields',
        accessibility: true,
        performance: true
      };

      const result = await moduleBuilder.generateModuleWithAI(request);

      expect(result).toBeDefined();
      expect(result.manifest.fields).toHaveLength(2);
      // Note: The shared DetectedField interface doesn't include 'repeater' type or 'children'
      // These are specific to the AI generation context
      expect(result.manifest.module_slug).toMatch(/^feature_grid_module_\d+$/);
    }, 30000);
  });

  describe('Quality Assurance Tests', () => {
    it('should achieve minimum quality thresholds', async () => {
      const testCases = [
        { moduleType: 'hero', minScore: 85 },
        { moduleType: 'feature_grid', minScore: 80 },
        { moduleType: 'contact_form', minScore: 85 },
        { moduleType: 'testimonial', minScore: 80 }
      ];

      for (const testCase of testCases) {
        // Mock appropriate OpenAI responses for each module type
        const mockOpenAI = require('../../src/services/openaiService');
        mockOpenAI.generateHubSpotModule.mockResolvedValue(generateMockResponse(testCase.moduleType));

        const request: ModuleGenerationRequest = {
          moduleType: testCase.moduleType as any,
          designDescription: `Create a ${testCase.moduleType} module`,
          accessibility: true,
          performance: true
        };

        const result = await moduleBuilder.generateModuleWithAI(request);
        
        expect(result.validation_result?.score).toBeGreaterThanOrEqual(testCase.minScore);
        if (result.validation_result) {
          expect(result.validation_result.valid).toBe(true);
        }
      }
    }, 60000);

    it('should handle validation errors gracefully', async () => {
      // Mock OpenAI response with intentional errors
      const mockBadResponse = `
\`\`\`json
[
  {
    "id": "123invalid",
    "name": "Invalid Field",
    "type": "invalid_type"
  }
]
\`\`\`

\`\`\`json
{
  "label": "Bad Module"
}
\`\`\`

\`\`\`html
<div>{{ module.undefined_field }}</div>
\`\`\`
      `;

      const mockOpenAI = require('../../src/services/openaiService');
      mockOpenAI.generateHubSpotModule.mockResolvedValue(mockBadResponse);

      const request: ModuleGenerationRequest = {
        moduleType: 'hero',
        designDescription: 'Create a hero section'
      };

      const result = await moduleBuilder.generateModuleWithAI(request);

      // Should still return a result but with validation errors
      expect(result).toBeDefined();
      expect(result.validation_result?.valid).toBe(false);
      expect(result.validation_result?.errors.length).toBeGreaterThan(0);
      expect(result.validation_result?.score).toBeLessThan(70);
    }, 30000);
  });

  describe('Performance Tests', () => {
    it('should generate modules within acceptable time limits', async () => {
      const mockOpenAI = require('../../src/services/openaiService');
      mockOpenAI.generateHubSpotModule.mockResolvedValue(generateMockResponse('hero'));

      const request: ModuleGenerationRequest = {
        moduleType: 'hero',
        designDescription: 'Create a hero section'
      };

      const startTime = Date.now();
      const result = await moduleBuilder.generateModuleWithAI(request);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    }, 20000);

    it('should handle concurrent generation requests', async () => {
      const mockOpenAI = require('../../src/services/openaiService');
      mockOpenAI.generateHubSpotModule.mockResolvedValue(generateMockResponse('hero'));

      const requests = Array.from({ length: 3 }, (_, i) => ({
        moduleType: 'hero' as const,
        designDescription: `Create hero section ${i + 1}`
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        requests.map(request => moduleBuilder.generateModuleWithAI(request))
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.validation_result.valid).toBe(true);
      });
      expect(duration).toBeLessThan(30000); // All should complete within 30 seconds
    }, 35000);
  });

  describe('Error Correction Tests', () => {
    it('should automatically correct common validation errors', async () => {
      const moduleWithErrors = {
        fields: [
          {
            id: '123invalid',
            name: 'Invalid Field',
            type: 'invalid_type'
          },
          {
            id: 'title',
            name: 'Title',
            type: 'text'
          },
          {
            id: 'title', // Duplicate ID
            name: 'Another Title',
            type: 'text'
          }
        ],
        meta: {
          label: 'Test Module'
          // Missing content_types
        },
        template: '<div>{{ module.undefined_field }}</div>',
        description: 'Test module with errors'
      };

      const validationResult = await validationService.validateModule(moduleWithErrors);
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);

      const correctionResult = await correctionService.correctErrors(
        moduleWithErrors,
        validationResult
      );

      expect(correctionResult.success).toBe(true);
      expect(correctionResult.appliedCorrections.length).toBeGreaterThan(0);
      expect(correctionResult.correctionConfidence).toBeGreaterThan(70);

      // Verify corrections were applied
      if (correctionResult.correctedModule) {
        const revalidationResult = await validationService.validateModule(correctionResult.correctedModule);
        expect(revalidationResult.score).toBeGreaterThan(validationResult.score);
      }
    });
  });

  describe('A/B Testing Framework', () => {
    it('should track prompt performance metrics', async () => {
      const promptV1 = await versioningService.createPromptVersion(
        'hero',
        'Create a hero section with title and description',
        'v1.0'
      );

      const promptV2 = await versioningService.createPromptVersion(
        'hero', 
        'Generate a compelling hero section with engaging title and persuasive description',
        'v2.0'
      );

      const abTest = await versioningService.startABTest(
        'Hero Prompt Optimization',
        'hero',
        [promptV1, promptV2],
        [50, 50],
        7
      );

      expect(abTest.testId).toBeDefined();
      expect(abTest.isActive).toBe(true);
      expect(abTest.variants).toHaveLength(2);

      // Simulate performance recording
      await versioningService.recordPromptPerformance(promptV1.id, {
        success: true,
        validationScore: 85,
        generationTime: 3000
      });

      await versioningService.recordPromptPerformance(promptV2.id, {
        success: true,
        validationScore: 92,
        generationTime: 2800
      });

      const analysis = await versioningService.analyzeABTestResults(abTest.testId);
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.recommendations).toBeDefined();
    });
  });
});

// Helper function to generate mock OpenAI responses
function generateMockResponse(moduleType: string): string {
  const responses = {
    hero: `
\`\`\`json
[
  {
    "id": "hero_title",
    "name": "Hero Title",
    "label": "Hero Title",
    "type": "text",
    "required": false,
    "default": "Welcome"
  }
]
\`\`\`

\`\`\`json
{
  "label": "Hero Section",
  "css_assets": [],
  "js_assets": [],
  "other_assets": [],
  "content_types": ["page", "blog-post"]
}
\`\`\`

\`\`\`html
<div class="hero-section" role="banner">
  <h1>{{ module.hero_title }}</h1>
</div>
\`\`\`
    `,
    feature_grid: `
\`\`\`json
[
  {
    "id": "features_title",
    "name": "Features Title",
    "label": "Features Title",
    "type": "text",
    "required": false
  }
]
\`\`\`

\`\`\`json
{
  "label": "Feature Grid",
  "css_assets": [],
  "js_assets": [],
  "other_assets": [],
  "content_types": ["page"]
}
\`\`\`

\`\`\`html
<section class="features" aria-labelledby="features-heading">
  <h2 id="features-heading">{{ module.features_title }}</h2>
</section>
\`\`\`
    `,
    contact_form: `
\`\`\`json
[
  {
    "id": "form_title",
    "name": "Form Title",
    "label": "Form Title",
    "type": "text",
    "required": false
  }
]
\`\`\`

\`\`\`json
{
  "label": "Contact Form",
  "css_assets": [],
  "js_assets": [],
  "other_assets": [],
  "content_types": ["page"]
}
\`\`\`

\`\`\`html
<form class="contact-form" aria-labelledby="form-heading">
  <h2 id="form-heading">{{ module.form_title }}</h2>
</form>
\`\`\`
    `,
    testimonial: `
\`\`\`json
[
  {
    "id": "testimonial_text",
    "name": "Testimonial Text",
    "label": "Testimonial Text",
    "type": "textarea",
    "required": false
  }
]
\`\`\`

\`\`\`json
{
  "label": "Testimonial",
  "css_assets": [],
  "js_assets": [],
  "other_assets": [],
  "content_types": ["page"]
}
\`\`\`

\`\`\`html
<blockquote class="testimonial">
  <p>{{ module.testimonial_text }}</p>
</blockquote>
\`\`\`
    `
  };

  return responses[moduleType as keyof typeof responses] || responses.hero;
}
