import { describe, it, expect, beforeEach } from '@jest/globals';
import { HubSpotValidationService, ValidationSeverity, ValidationCategory } from '../../src/services/quality/HubSpotValidationService';

describe('HubSpotValidationService', () => {
  let validationService: HubSpotValidationService;

  beforeEach(() => {
    validationService = HubSpotValidationService.getInstance();
  });

  describe('Field Validation', () => {
    it('should validate correct field structure', async () => {
      const validModule = {
        fields: [
          {
            id: 'hero_title',
            name: 'Hero Title',
            label: 'Hero Title',
            type: 'text',
            required: false,
            default: 'Welcome to our site'
          }
        ],
        meta: {
          label: 'Test Module',
          content_types: ['page'],
          css_assets: [],
          js_assets: [],
          other_assets: []
        },
        template: '<div>{{ module.hero_title }}</div>'
      };

      const result = await validationService.validateModule(validModule);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect invalid field IDs', async () => {
      const invalidModule = {
        fields: [
          {
            id: '123invalid',
            name: 'Invalid Field',
            label: 'Invalid Field',
            type: 'text'
          }
        ],
        meta: {
          label: 'Test Module',
          content_types: ['page'],
          css_assets: [],
          js_assets: [],
          other_assets: []
        },
        template: '<div>{{ module.123invalid }}</div>'
      };

      const result = await validationService.validateModule(invalidModule);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('FIELD_INVALID_ID');
      expect(result.errors[0].type).toBe(ValidationSeverity.CRITICAL);
    });

    it('should detect duplicate field IDs', async () => {
      const duplicateModule = {
        fields: [
          {
            id: 'title',
            name: 'Title 1',
            label: 'Title 1',
            type: 'text'
          },
          {
            id: 'title',
            name: 'Title 2',
            label: 'Title 2',
            type: 'text'
          }
        ],
        meta: {
          label: 'Test Module',
          content_types: ['page'],
          css_assets: [],
          js_assets: [],
          other_assets: []
        },
        template: '<div>{{ module.title }}</div>'
      };

      const result = await validationService.validateModule(duplicateModule);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e: any) => e.code === 'FIELD_DUPLICATE_ID')).toBe(true);
    });

    it('should detect reserved field names', async () => {
      const reservedModule = {
        fields: [
          {
            id: 'id',
            name: 'ID Field',
            label: 'ID Field',
            type: 'text'
          }
        ],
        meta: {
          label: 'Test Module',
          content_types: ['page'],
          css_assets: [],
          js_assets: [],
          other_assets: []
        },
        template: '<div>{{ module.id }}</div>'
      };

      const result = await validationService.validateModule(reservedModule);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e: any) => e.code === 'FIELD_RESERVED_NAME')).toBe(true);
    });

    it('should validate field type constraints', async () => {
      const invalidTypeModule = {
        fields: [
          {
            id: 'invalid_field',
            name: 'Invalid Field',
            label: 'Invalid Field',
            type: 'invalid_type'
          }
        ],
        meta: {
          label: 'Test Module',
          content_types: ['page'],
          css_assets: [],
          js_assets: [],
          other_assets: []
        },
        template: '<div>{{ module.invalid_field }}</div>'
      };

      const result = await validationService.validateModule(invalidTypeModule);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e: any) => e.code === 'FIELD_INVALID_TYPE')).toBe(true);
    });
  });

  describe('Meta Validation', () => {
    it('should validate correct meta structure', async () => {
      const validModule = {
        fields: [
          {
            id: 'test_field',
            name: 'Test Field',
            label: 'Test Field',
            type: 'text'
          }
        ],
        meta: {
          label: 'Hero Section',
          css_assets: [],
          js_assets: [],
          other_assets: [],
          content_types: ['page', 'blog-post'],
          module_id: 123456789
        },
        template: '<div>{{ module.test_field }}</div>'
      };

      const result = await validationService.validateModule(validModule);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing content_types', async () => {
      const invalidModule = {
        fields: [
          {
            id: 'test_field',
            name: 'Test Field',
            label: 'Test Field',
            type: 'text'
          }
        ],
        meta: {
          label: 'Hero Section',
          css_assets: [],
          js_assets: [],
          other_assets: []
        },
        template: '<div>{{ module.test_field }}</div>'
      };

      const result = await validationService.validateModule(invalidModule);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e: any) => e.code === 'META_MISSING_CONTENT_TYPES')).toBe(true);
    });

    it('should detect invalid content_types values', async () => {
      const invalidModule = {
        fields: [
          {
            id: 'test_field',
            name: 'Test Field',
            label: 'Test Field',
            type: 'text'
          }
        ],
        meta: {
          label: 'Hero Section',
          css_assets: [],
          js_assets: [],
          other_assets: [],
          content_types: ['invalid-type']
        },
        template: '<div>{{ module.test_field }}</div>'
      };

      const result = await validationService.validateModule(invalidModule);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e: any) => e.code === 'META_INVALID_CONTENT_TYPE')).toBe(true);
    });
  });

  describe('Template Validation', () => {
    it('should validate correct HubL template', async () => {
      const validModule = {
        fields: [
          { id: 'hero_title', name: 'Hero Title', label: 'Hero Title', type: 'text' },
          { id: 'hero_description', name: 'Hero Description', label: 'Hero Description', type: 'textarea' },
          { id: 'show_button', name: 'Show Button', label: 'Show Button', type: 'boolean' },
          { id: 'button_url', name: 'Button URL', label: 'Button URL', type: 'url' },
          { id: 'button_text', name: 'Button Text', label: 'Button Text', type: 'text' }
        ],
        meta: {
          label: 'Hero Section',
          content_types: ['page'],
          css_assets: [],
          js_assets: [],
          other_assets: []
        },
        template: `
          <div class="hero-section">
            <h1>{{ module.hero_title }}</h1>
            <p>{{ module.hero_description }}</p>
            {% if module.show_button %}
              <a href="{{ module.button_url }}" class="btn">{{ module.button_text }}</a>
            {% endif %}
          </div>
        `
      };

      const result = await validationService.validateModule(validModule);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect undefined field references', async () => {
      const invalidModule = {
        fields: [
          { id: 'hero_title', name: 'Hero Title', label: 'Hero Title', type: 'text' }
        ],
        meta: {
          label: 'Hero Section',
          content_types: ['page'],
          css_assets: [],
          js_assets: [],
          other_assets: []
        },
        template: `
          <div class="hero-section">
            <h1>{{ module.undefined_field }}</h1>
          </div>
        `
      };

      const result = await validationService.validateModule(invalidModule);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e: any) => e.code === 'TEMPLATE_UNDEFINED_FIELD')).toBe(true);
    });

    it('should detect accessibility issues', async () => {
      const inaccessibleModule = {
        fields: [
          { id: 'hero_image', name: 'Hero Image', label: 'Hero Image', type: 'image' }
        ],
        meta: {
          label: 'Hero Section',
          content_types: ['page'],
          css_assets: [],
          js_assets: [],
          other_assets: []
        },
        template: `
          <div class="hero-section">
            <img src="{{ module.hero_image.src }}">
            <input type="text">
          </div>
        `
      };

      const result = await validationService.validateModule(inaccessibleModule);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e: any) => e.category === ValidationCategory.ACCESSIBILITY)).toBe(true);
    });
  });

  describe('Overall Module Validation', () => {
    it('should validate complete valid module', async () => {
      const validModule = {
        fields: [
          {
            id: 'hero_title',
            name: 'Hero Title',
            label: 'Hero Title',
            type: 'text',
            required: false,
            default: 'Welcome'
          }
        ],
        meta: {
          label: 'Hero Section',
          css_assets: [],
          js_assets: [],
          other_assets: [],
          content_types: ['page', 'blog-post']
        },
        template: '<div class="hero"><h1>{{ module.hero_title }}</h1></div>'
      };

      const result = await validationService.validateModule(validModule);
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should calculate quality metrics correctly', async () => {
      const module = {
        fields: [
          {
            id: 'title',
            name: 'Title',
            label: 'Title',
            type: 'text'
          }
        ],
        meta: {
          label: 'Test Module',
          content_types: ['page']
        },
        template: '<h1>{{ module.title }}</h1>'
      };

      const result = await validationService.validateModule(module);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.accessibility_score).toBeGreaterThanOrEqual(0);
      expect(result.metrics.performance_score).toBeGreaterThanOrEqual(0);
      expect(result.metrics.complexity_score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Tests', () => {
    it('should validate large modules efficiently', async () => {
      const largeModule = {
        fields: Array.from({ length: 50 }, (_, i) => ({
          id: `field_${i}`,
          name: `Field ${i}`,
          label: `Field ${i}`,
          type: 'text'
        })),
        meta: {
          label: 'Large Module',
          content_types: ['page']
        },
        template: Array.from({ length: 50 }, (_, i) => 
          `<div>{{ module.field_${i} }}</div>`
        ).join('\n')
      };

      const startTime = Date.now();
      const result = await validationService.validateModule(largeModule);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result).toBeDefined();
    });
  });
});
