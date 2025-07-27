import { describe, it, expect, beforeEach } from '@jest/globals';
import { HubSpotValidationService, ValidationSeverity, ValidationCategory } from '../../src/services/HubSpotValidationService';

describe('HubSpotValidationService', () => {
  let validationService: HubSpotValidationService;

  beforeEach(() => {
    validationService = HubSpotValidationService.getInstance();
  });

  describe('Field Validation', () => {
    it('should validate correct field structure', async () => {
      const validFields = [
        {
          id: 'hero_title',
          name: 'Hero Title',
          label: 'Hero Title',
          type: 'text',
          required: false,
          default: 'Welcome to our site'
        }
      ];

      const result = await validationService.validateFields(validFields);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect invalid field IDs', async () => {
      const invalidFields = [
        {
          id: '123invalid',
          name: 'Invalid Field',
          label: 'Invalid Field',
          type: 'text'
        }
      ];

      const result = await validationService.validateFields(invalidFields);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('FIELD_INVALID_ID');
      expect(result.errors[0].type).toBe(ValidationSeverity.CRITICAL);
    });

    it('should detect duplicate field IDs', async () => {
      const duplicateFields = [
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
      ];

      const result = await validationService.validateFields(duplicateFields);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'FIELD_DUPLICATE_ID')).toBe(true);
    });

    it('should detect reserved field names', async () => {
      const reservedFields = [
        {
          id: 'id',
          name: 'ID Field',
          label: 'ID Field',
          type: 'text'
        }
      ];

      const result = await validationService.validateFields(reservedFields);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'FIELD_RESERVED_NAME')).toBe(true);
    });

    it('should validate field type constraints', async () => {
      const invalidTypeFields = [
        {
          id: 'invalid_field',
          name: 'Invalid Field',
          label: 'Invalid Field',
          type: 'invalid_type'
        }
      ];

      const result = await validationService.validateFields(invalidTypeFields);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'FIELD_INVALID_TYPE')).toBe(true);
    });
  });

  describe('Meta Validation', () => {
    it('should validate correct meta structure', async () => {
      const validMeta = {
        label: 'Hero Section',
        css_assets: [],
        js_assets: [],
        other_assets: [],
        content_types: ['page', 'blog-post'],
        module_id: 123456789
      };

      const result = await validationService.validateMeta(validMeta);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing content_types', async () => {
      const invalidMeta = {
        label: 'Hero Section',
        css_assets: [],
        js_assets: [],
        other_assets: []
      };

      const result = await validationService.validateMeta(invalidMeta);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'META_MISSING_CONTENT_TYPES')).toBe(true);
    });

    it('should detect invalid content_types values', async () => {
      const invalidMeta = {
        label: 'Hero Section',
        css_assets: [],
        js_assets: [],
        other_assets: [],
        content_types: ['invalid-type']
      };

      const result = await validationService.validateMeta(invalidMeta);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'META_INVALID_CONTENT_TYPE')).toBe(true);
    });
  });

  describe('Template Validation', () => {
    it('should validate correct HubL template', async () => {
      const validTemplate = `
        <div class="hero-section">
          <h1>{{ module.hero_title }}</h1>
          <p>{{ module.hero_description }}</p>
          {% if module.show_button %}
            <a href="{{ module.button_url }}" class="btn">{{ module.button_text }}</a>
          {% endif %}
        </div>
      `;

      const fields = [
        { id: 'hero_title', type: 'text' },
        { id: 'hero_description', type: 'textarea' },
        { id: 'show_button', type: 'boolean' },
        { id: 'button_url', type: 'url' },
        { id: 'button_text', type: 'text' }
      ];

      const result = await validationService.validateTemplate(validTemplate, fields);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect undefined field references', async () => {
      const invalidTemplate = `
        <div class="hero-section">
          <h1>{{ module.undefined_field }}</h1>
        </div>
      `;

      const fields = [
        { id: 'hero_title', type: 'text' }
      ];

      const result = await validationService.validateTemplate(invalidTemplate, fields);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'TEMPLATE_UNDEFINED_FIELD')).toBe(true);
    });

    it('should detect accessibility issues', async () => {
      const inaccessibleTemplate = `
        <div class="hero-section">
          <img src="{{ module.hero_image.src }}">
          <input type="text">
        </div>
      `;

      const fields = [
        { id: 'hero_image', type: 'image' }
      ];

      const result = await validationService.validateTemplate(inaccessibleTemplate, fields);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.category === ValidationCategory.ACCESSIBILITY)).toBe(true);
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
