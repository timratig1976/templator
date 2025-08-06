/**
 * HubSpot Validation Service
 * Validates modules for HubSpot CMS compatibility
 */

import { createLogger } from '../../../utils/logger';
import { HTMLValidator } from '../../quality/validation/HTMLValidator';

const logger = createLogger();

export interface HubSpotValidationResult {
  isValid: boolean;
  score: number;
  errors: HubSpotValidationError[];
  warnings: HubSpotValidationWarning[];
  suggestions: string[];
  compatibility: {
    version: string;
    features: string[];
    limitations: string[];
  };
}

export interface HubSpotValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location?: {
    file: string;
    line: number;
    column: number;
  };
  fix?: string;
}

export interface HubSpotValidationWarning {
  code: string;
  message: string;
  recommendation: string;
  impact: 'performance' | 'compatibility' | 'maintenance';
}

export interface HubSpotModule {
  html: string;
  css: string;
  fields: HubSpotField[];
  metadata: {
    name: string;
    description: string;
    version: string;
  };
}

export interface HubSpotField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'rich_text' | 'image' | 'url' | 'color' | 'boolean' | 'choice';
  required: boolean;
  default?: any;
  help_text?: string;
  choices?: Array<{ value: string; label: string }>;
}

/**
 * HubSpot Validator Service
 * Validates modules for HubSpot CMS compatibility
 */
export class HubSpotValidator {
  private static instance: HubSpotValidator;
  private htmlValidator: HTMLValidator;

  public static getInstance(): HubSpotValidator {
    if (!HubSpotValidator.instance) {
      HubSpotValidator.instance = new HubSpotValidator();
    }
    return HubSpotValidator.instance;
  }

  private constructor() {
    this.htmlValidator = HTMLValidator.getInstance();
  }

  /**
   * Validate HubSpot module
   */
  async validateModule(module: HubSpotModule): Promise<HubSpotValidationResult> {
    try {
      logger.info('Starting HubSpot module validation', {
        moduleName: module.metadata.name
      });

      const errors: HubSpotValidationError[] = [];
      const warnings: HubSpotValidationWarning[] = [];
      const suggestions: string[] = [];

      // Validate HTML/CSS with base validator
      const baseValidation = await this.htmlValidator.validateHTML(module.html, {
        checkAccessibility: true,
        checkPerformance: true,
        checkSEO: true
      });

      // HubSpot-specific validations
      const templateValidation = this.validateHubSpotTemplate(module.html);
      const fieldValidation = this.validateHubSpotFields(module.fields);
      const cssValidation = this.validateHubSpotCSS(module.css);
      const compatibilityValidation = this.validateHubSpotCompatibility(module);

      // Combine all validation results
      errors.push(...templateValidation.errors);
      errors.push(...fieldValidation.errors);
      errors.push(...cssValidation.errors);
      errors.push(...compatibilityValidation.errors);

      warnings.push(...templateValidation.warnings);
      warnings.push(...fieldValidation.warnings);
      warnings.push(...cssValidation.warnings);
      warnings.push(...compatibilityValidation.warnings);

      suggestions.push(...templateValidation.suggestions);
      suggestions.push(...fieldValidation.suggestions);
      suggestions.push(...cssValidation.suggestions);
      suggestions.push(...compatibilityValidation.suggestions);

      // Calculate overall score
      const score = this.calculateHubSpotScore(errors, warnings, baseValidation.score || 0);

      const result: HubSpotValidationResult = {
        isValid: errors.filter(e => e.severity === 'critical' || e.severity === 'high').length === 0,
        score,
        errors,
        warnings,
        suggestions,
        compatibility: {
          version: 'CMS Hub Professional',
          features: this.detectHubSpotFeatures(module),
          limitations: this.detectLimitations(module)
        }
      };

      logger.info('HubSpot module validation completed', {
        moduleName: module.metadata.name,
        isValid: result.isValid,
        score: result.score,
        errorsCount: errors.length,
        warningsCount: warnings.length
      });

      return result;

    } catch (error) {
      logger.error('HubSpot module validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate HubSpot template syntax
   */
  private validateHubSpotTemplate(html: string): {
    errors: HubSpotValidationError[];
    warnings: HubSpotValidationWarning[];
    suggestions: string[];
  } {
    const errors: HubSpotValidationError[] = [];
    const warnings: HubSpotValidationWarning[] = [];
    const suggestions: string[] = [];

    // Check for HubL template syntax
    const hublPatterns = [
      /\{\{[^}]*\}\}/g, // HubL variables
      /\{%[^%]*%\}/g,   // HubL tags
      /\{#[^#]*#\}/g    // HubL comments
    ];

    let hasHubL = false;
    hublPatterns.forEach(pattern => {
      if (pattern.test(html)) {
        hasHubL = true;
      }
    });

    if (!hasHubL) {
      warnings.push({
        code: 'NO_HUBL_DETECTED',
        message: 'No HubL template syntax detected',
        recommendation: 'Consider using HubL for dynamic content',
        impact: 'compatibility'
      });
    }

    // Check for required HubSpot elements
    if (!html.includes('{{ module.')) {
      warnings.push({
        code: 'NO_MODULE_FIELDS',
        message: 'No module fields detected in template',
        recommendation: 'Add module fields for content management',
        impact: 'compatibility'
      });
    }

    // Check for forbidden elements
    const forbiddenElements = ['script', 'iframe', 'object', 'embed'];
    forbiddenElements.forEach(element => {
      const regex = new RegExp(`<${element}[^>]*>`, 'gi');
      if (regex.test(html)) {
        errors.push({
          code: 'FORBIDDEN_ELEMENT',
          message: `Forbidden element detected: <${element}>`,
          severity: 'high',
          fix: `Remove <${element}> elements or use HubSpot-approved alternatives`
        });
      }
    });

    // Check for inline JavaScript
    if (html.includes('javascript:') || html.includes('onclick=') || html.includes('onload=')) {
      errors.push({
        code: 'INLINE_JAVASCRIPT',
        message: 'Inline JavaScript detected',
        severity: 'high',
        fix: 'Move JavaScript to external files or use HubSpot-approved methods'
      });
    }

    return { errors, warnings, suggestions };
  }

  /**
   * Validate HubSpot fields
   */
  private validateHubSpotFields(fields: HubSpotField[]): {
    errors: HubSpotValidationError[];
    warnings: HubSpotValidationWarning[];
    suggestions: string[];
  } {
    const errors: HubSpotValidationError[] = [];
    const warnings: HubSpotValidationWarning[] = [];
    const suggestions: string[] = [];

    if (fields.length === 0) {
      warnings.push({
        code: 'NO_FIELDS_DEFINED',
        message: 'No editable fields defined',
        recommendation: 'Add editable fields to make content manageable',
        impact: 'compatibility'
      });
    }

    fields.forEach((field, index) => {
      // Validate field name
      if (!field.name || field.name.trim() === '') {
        errors.push({
          code: 'INVALID_FIELD_NAME',
          message: `Field at index ${index} has invalid name`,
          severity: 'high',
          fix: 'Provide a valid field name'
        });
      }

      // Check for reserved field names
      const reservedNames = ['id', 'class', 'style', 'data'];
      if (reservedNames.some(reserved => field.name.toLowerCase().includes(reserved))) {
        warnings.push({
          code: 'RESERVED_FIELD_NAME',
          message: `Field "${field.name}" uses reserved keyword`,
          recommendation: 'Use descriptive, non-reserved field names',
          impact: 'compatibility'
        });
      }

      // Validate field type
      const validTypes = ['text', 'textarea', 'rich_text', 'image', 'url', 'color', 'boolean', 'choice'];
      if (!validTypes.includes(field.type)) {
        errors.push({
          code: 'INVALID_FIELD_TYPE',
          message: `Invalid field type: ${field.type}`,
          severity: 'high',
          fix: `Use one of: ${validTypes.join(', ')}`
        });
      }

      // Validate choice fields
      if (field.type === 'choice' && (!field.choices || field.choices.length === 0)) {
        errors.push({
          code: 'CHOICE_FIELD_NO_OPTIONS',
          message: `Choice field "${field.name}" has no options`,
          severity: 'medium',
          fix: 'Add choices array with value/label pairs'
        });
      }
    });

    return { errors, warnings, suggestions };
  }

  /**
   * Validate HubSpot CSS
   */
  private validateHubSpotCSS(css: string): {
    errors: HubSpotValidationError[];
    warnings: HubSpotValidationWarning[];
    suggestions: string[];
  } {
    const errors: HubSpotValidationError[] = [];
    const warnings: HubSpotValidationWarning[] = [];
    const suggestions: string[] = [];

    // Check for !important usage
    const importantCount = (css.match(/!important/gi) || []).length;
    if (importantCount > 5) {
      warnings.push({
        code: 'EXCESSIVE_IMPORTANT',
        message: `Excessive use of !important (${importantCount} instances)`,
        recommendation: 'Reduce !important usage for better maintainability',
        impact: 'maintenance'
      });
    }

    // Check for absolute positioning
    if (css.includes('position: absolute') || css.includes('position:absolute')) {
      warnings.push({
        code: 'ABSOLUTE_POSITIONING',
        message: 'Absolute positioning detected',
        recommendation: 'Use relative positioning for better responsive behavior',
        impact: 'compatibility'
      });
    }

    // Check for fixed dimensions
    const fixedDimensionPattern = /\d+px/g;
    const fixedDimensions = css.match(fixedDimensionPattern) || [];
    if (fixedDimensions.length > 10) {
      suggestions.push('Consider using relative units (%, em, rem) for better responsiveness');
    }

    return { errors, warnings, suggestions };
  }

  /**
   * Validate HubSpot compatibility
   */
  private validateHubSpotCompatibility(module: HubSpotModule): {
    errors: HubSpotValidationError[];
    warnings: HubSpotValidationWarning[];
    suggestions: string[];
  } {
    const errors: HubSpotValidationError[] = [];
    const warnings: HubSpotValidationWarning[] = [];
    const suggestions: string[] = [];

    // Check module metadata
    if (!module.metadata.name) {
      errors.push({
        code: 'MISSING_MODULE_NAME',
        message: 'Module name is required',
        severity: 'critical',
        fix: 'Add module name to metadata'
      });
    }

    if (!module.metadata.description) {
      warnings.push({
        code: 'MISSING_DESCRIPTION',
        message: 'Module description is missing',
        recommendation: 'Add description for better module management',
        impact: 'maintenance'
      });
    }

    // Check for responsive design
    if (!module.css.includes('@media') && !module.css.includes('responsive')) {
      suggestions.push('Add responsive design for better mobile compatibility');
    }

    // Check for accessibility features
    if (!module.html.includes('alt=') && module.html.includes('<img')) {
      warnings.push({
        code: 'MISSING_ALT_ATTRIBUTES',
        message: 'Images missing alt attributes',
        recommendation: 'Add alt attributes for accessibility',
        impact: 'compatibility'
      });
    }

    return { errors, warnings, suggestions };
  }

  /**
   * Calculate HubSpot compatibility score
   */
  private calculateHubSpotScore(
    errors: HubSpotValidationError[],
    warnings: HubSpotValidationWarning[],
    baseScore: number
  ): number {
    let score = baseScore;

    // Deduct points for errors
    errors.forEach(error => {
      switch (error.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    });

    // Deduct points for warnings
    warnings.forEach(warning => {
      switch (warning.impact) {
        case 'compatibility':
          score -= 5;
          break;
        case 'performance':
          score -= 3;
          break;
        case 'maintenance':
          score -= 2;
          break;
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Detect HubSpot features used
   */
  private detectHubSpotFeatures(module: HubSpotModule): string[] {
    const features: string[] = [];

    if (module.html.includes('{{ module.')) {
      features.push('Module Fields');
    }

    if (module.html.includes('{% for') || module.html.includes('{% if')) {
      features.push('HubL Logic');
    }

    if (module.fields.some(f => f.type === 'rich_text')) {
      features.push('Rich Text Editor');
    }

    if (module.fields.some(f => f.type === 'image')) {
      features.push('Image Management');
    }

    return features;
  }

  /**
   * Detect potential limitations
   */
  private detectLimitations(module: HubSpotModule): string[] {
    const limitations: string[] = [];

    if (module.html.includes('<script')) {
      limitations.push('Custom JavaScript may require approval');
    }

    if (module.css.includes('position: fixed')) {
      limitations.push('Fixed positioning may not work in all contexts');
    }

    if (module.html.includes('iframe')) {
      limitations.push('iframes may be restricted in some environments');
    }

    return limitations;
  }

  /**
   * Generate HubSpot compatibility report
   */
  generateCompatibilityReport(validationResult: HubSpotValidationResult): string {
    const report = [
      '# HubSpot Compatibility Report',
      '',
      `**Overall Score:** ${validationResult.score}/100`,
      `**Status:** ${validationResult.isValid ? 'Compatible' : 'Issues Found'}`,
      '',
      '## Features Detected',
      ...validationResult.compatibility.features.map(f => `- ${f}`),
      '',
      '## Errors',
      ...validationResult.errors.map(e => `- **${e.code}:** ${e.message}`),
      '',
      '## Warnings',
      ...validationResult.warnings.map(w => `- **${w.code}:** ${w.message}`),
      '',
      '## Suggestions',
      ...validationResult.suggestions.map(s => `- ${s}`),
      '',
      '## Limitations',
      ...validationResult.compatibility.limitations.map(l => `- ${l}`)
    ];

    return report.join('\n');
  }
}

export default HubSpotValidator.getInstance();
