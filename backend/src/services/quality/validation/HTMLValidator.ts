import { createLogger } from '../../../utils/logger';

const logger = createLogger();

export interface ValidationResult {
  isValid: boolean;
  score: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  type: 'syntax' | 'semantic' | 'accessibility' | 'performance';
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationWarning {
  type: 'best-practice' | 'optimization' | 'compatibility' | 'performance';
  message: string;
  suggestion: string;
}

/**
 * HTML Quality Validation Service
 * Consolidated from the original HTMLQualityService with improved structure
 */
export class HTMLValidator {
  private static instance: HTMLValidator;

  public static getInstance(): HTMLValidator {
    if (!HTMLValidator.instance) {
      HTMLValidator.instance = new HTMLValidator();
    }
    return HTMLValidator.instance;
  }

  private constructor() {}

  /**
   * Validate HTML content for quality, accessibility, and best practices
   */
  async validateHTML(html: string, options: {
    checkAccessibility?: boolean;
    checkPerformance?: boolean;
    checkSEO?: boolean;
  } = {}): Promise<ValidationResult> {
    try {
      logger.info('Starting HTML validation', {
        htmlLength: html.length,
        options
      });

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const suggestions: string[] = [];

      // Basic syntax validation
      const syntaxErrors = this.validateSyntax(html);
      errors.push(...syntaxErrors);

      // Semantic validation
      const semanticErrors = this.validateSemantics(html);
      errors.push(...semanticErrors);

      // Accessibility validation
      if (options.checkAccessibility !== false) {
        const accessibilityErrors = this.validateAccessibility(html);
        errors.push(...accessibilityErrors);
      }

      // Performance validation
      if (options.checkPerformance) {
        const performanceWarnings = this.validatePerformance(html);
        warnings.push(...performanceWarnings);
      }

      // SEO validation
      if (options.checkSEO) {
        const seoSuggestions = this.validateSEO(html);
        suggestions.push(...seoSuggestions);
      }

      // Calculate overall score
      const score = this.calculateQualityScore(errors, warnings);

      const result: ValidationResult = {
        isValid: errors.filter(e => e.severity === 'error').length === 0,
        score,
        errors,
        warnings,
        suggestions
      };

      logger.info('HTML validation completed', {
        isValid: result.isValid,
        score: result.score,
        errorsCount: errors.length,
        warningsCount: warnings.length
      });

      return result;

    } catch (error) {
      logger.error('HTML validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isValid: false,
        score: 0,
        errors: [{
          type: 'syntax',
          message: 'Validation process failed',
          severity: 'error'
        }],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * Validate HTML syntax
   */
  private validateSyntax(html: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for basic HTML structure
    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      errors.push({
        type: 'syntax',
        message: 'Missing DOCTYPE declaration or html tag',
        severity: 'warning'
      });
    }

    // Check for unclosed tags (basic check)
    const openTags = html.match(/<[^\/][^>]*>/g) || [];
    const closeTags = html.match(/<\/[^>]*>/g) || [];
    
    if (openTags.length > closeTags.length + 10) { // Allow for self-closing tags
      errors.push({
        type: 'syntax',
        message: 'Potential unclosed HTML tags detected',
        severity: 'warning'
      });
    }

    // Check for invalid characters in tag names
    const invalidTags = html.match(/<[^a-zA-Z\/!][^>]*>/g);
    if (invalidTags) {
      errors.push({
        type: 'syntax',
        message: 'Invalid HTML tag names detected',
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Validate semantic HTML structure
   */
  private validateSemantics(html: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for semantic elements
    const hasSemanticElements = /(<header|<nav|<main|<section|<article|<aside|<footer)/i.test(html);
    if (!hasSemanticElements) {
      errors.push({
        type: 'semantic',
        message: 'Consider using semantic HTML5 elements (header, nav, main, section, etc.)',
        severity: 'info'
      });
    }

    // Check for proper heading hierarchy
    const headings = html.match(/<h[1-6][^>]*>/gi) || [];
    if (headings.length === 0) {
      errors.push({
        type: 'semantic',
        message: 'No heading elements found - consider adding headings for better structure',
        severity: 'info'
      });
    }

    // Check for multiple h1 tags
    const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
    if (h1Count > 1) {
      errors.push({
        type: 'semantic',
        message: 'Multiple h1 elements found - should typically have only one per page',
        severity: 'warning'
      });
    }

    return errors;
  }

  /**
   * Validate accessibility features
   */
  private validateAccessibility(html: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for alt attributes on images
    const images = html.match(/<img[^>]*>/gi) || [];
    const imagesWithoutAlt = images.filter(img => !img.includes('alt='));
    if (imagesWithoutAlt.length > 0) {
      errors.push({
        type: 'accessibility',
        message: `${imagesWithoutAlt.length} image(s) missing alt attributes`,
        severity: 'error'
      });
    }

    // Check for form labels
    const inputs = html.match(/<input[^>]*>/gi) || [];
    const labels = html.match(/<label[^>]*>/gi) || [];
    if (inputs.length > 0 && labels.length === 0) {
      errors.push({
        type: 'accessibility',
        message: 'Form inputs found without associated labels',
        severity: 'error'
      });
    }

    // Check for ARIA attributes where needed
    const interactiveElements = html.match(/<(button|a|input|select|textarea)[^>]*>/gi) || [];
    const elementsWithAria = html.match(/aria-[a-z]+=/gi) || [];
    if (interactiveElements.length > 5 && elementsWithAria.length === 0) {
      errors.push({
        type: 'accessibility',
        message: 'Consider adding ARIA attributes for better accessibility',
        severity: 'info'
      });
    }

    return errors;
  }

  /**
   * Validate performance considerations
   */
  private validatePerformance(html: string): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for inline styles
    const inlineStyles = html.match(/style\s*=/gi) || [];
    if (inlineStyles.length > 10) {
      warnings.push({
        type: 'performance',
        message: 'Many inline styles detected',
        suggestion: 'Consider moving styles to external CSS files for better performance'
      });
    }

    // Check for large inline scripts
    const inlineScripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    const largeScripts = inlineScripts.filter(script => script.length > 1000);
    if (largeScripts.length > 0) {
      warnings.push({
        type: 'performance',
        message: 'Large inline scripts detected',
        suggestion: 'Consider moving large scripts to external files'
      });
    }

    return warnings;
  }

  /**
   * Validate SEO considerations
   */
  private validateSEO(html: string): string[] {
    const suggestions: string[] = [];

    // Check for title tag
    if (!html.includes('<title>')) {
      suggestions.push('Add a title tag for better SEO');
    }

    // Check for meta description
    if (!html.includes('name="description"')) {
      suggestions.push('Add a meta description for better search engine visibility');
    }

    // Check for heading structure
    const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
    if (h1Count === 0) {
      suggestions.push('Add an h1 tag for better SEO structure');
    }

    return suggestions;
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(errors: ValidationError[], warnings: ValidationWarning[]): number {
    let score = 100;

    // Deduct points for errors
    errors.forEach(error => {
      switch (error.severity) {
        case 'error':
          score -= 10;
          break;
        case 'warning':
          score -= 5;
          break;
        case 'info':
          score -= 2;
          break;
      }
    });

    // Deduct points for warnings
    warnings.forEach(() => {
      score -= 3;
    });

    return Math.max(0, Math.min(100, score));
  }
}

export default HTMLValidator.getInstance();
