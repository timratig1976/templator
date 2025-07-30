import { createLogger } from '../../utils/logger';

const logger = createLogger();

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'suggestion';
  category: 'semantics' | 'tailwind' | 'accessibility' | 'responsive' | 'structure' | 'performance';
  message: string;
  code?: string;
  lineNumber?: number;
  columnNumber?: number;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  score: number;
  issues: ValidationIssue[];
  metrics: {
    semanticsScore: number;
    tailwindScore: number;
    accessibilityScore: number;
    responsiveScore: number;
  };
}

export class HTMLQualityService {
  private static instance: HTMLQualityService;

  public static getInstance(): HTMLQualityService {
    if (!HTMLQualityService.instance) {
      HTMLQualityService.instance = new HTMLQualityService();
    }
    return HTMLQualityService.instance;
  }

  /**
   * Validate HTML for quality, semantics, Tailwind usage, and accessibility
   */
  validateHTML(html: string): ValidationResult {
    const issues: ValidationIssue[] = [];
    
    // Validate semantic structure
    this.validateSemanticStructure(html, issues);
    
    // Validate Tailwind usage
    this.validateTailwindUsage(html, issues);
    
    // Validate accessibility
    this.validateAccessibility(html, issues);
    
    // Validate responsive design
    this.validateResponsiveDesign(html, issues);

    // Calculate category-specific scores
    const semanticsIssues = issues.filter(i => i.category === 'semantics');
    const tailwindIssues = issues.filter(i => i.category === 'tailwind');
    const accessibilityIssues = issues.filter(i => i.category === 'accessibility');
    const responsiveIssues = issues.filter(i => i.category === 'responsive');

    const semanticsScore = 100 - (
      semanticsIssues.filter(i => i.severity === 'error').length * 15 +
      semanticsIssues.filter(i => i.severity === 'warning').length * 5
    );

    const tailwindScore = 100 - (
      tailwindIssues.filter(i => i.severity === 'error').length * 15 +
      tailwindIssues.filter(i => i.severity === 'warning').length * 5
    );

    const accessibilityScore = 100 - (
      accessibilityIssues.filter(i => i.severity === 'error').length * 15 +
      accessibilityIssues.filter(i => i.severity === 'warning').length * 5
    );

    const responsiveScore = 100 - (
      responsiveIssues.filter(i => i.severity === 'error').length * 15 +
      responsiveIssues.filter(i => i.severity === 'warning').length * 5
    );

    // Calculate overall score (weighted average of category scores)
    const overallScore = Math.round(
      semanticsScore * 0.25 +
      tailwindScore * 0.35 +
      accessibilityScore * 0.25 +
      responsiveScore * 0.15
    );
    
    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(0, Math.min(100, overallScore)),
      issues,
      metrics: {
        semanticsScore: Math.max(0, Math.min(100, semanticsScore)),
        tailwindScore: Math.max(0, Math.min(100, tailwindScore)),
        accessibilityScore: Math.max(0, Math.min(100, accessibilityScore)),
        responsiveScore: Math.max(0, Math.min(100, responsiveScore))
      }
    };
  }

  /**
   * Validate semantic HTML structure
   */
  private validateSemanticStructure(html: string, issues: ValidationIssue[]): void {
    // Check for basic semantic elements
    const hasHeader = /<header|<nav/i.test(html);
    const hasMain = /<main|<article|<section/i.test(html);
    const hasFooter = /<footer/i.test(html);

    if (!hasHeader && !hasMain && !hasFooter) {
      issues.push({
        severity: 'warning',
        category: 'semantics',
        message: 'Missing semantic structure elements (header, main/section/article, footer)',
        suggestion: 'Use semantic HTML5 elements like <header>, <main>, <section>, <article>, and <footer>'
      });
    }

    // Check for heading hierarchy
    const h1Count = (html.match(/<h1/gi) || []).length;
    const hasHeadings = /<h[1-6]/i.test(html);

    if (h1Count > 1) {
      issues.push({
        severity: 'warning',
        category: 'semantics',
        message: 'Multiple <h1> elements found. Each page should have only one main heading.',
        suggestion: 'Keep a single <h1> element and use <h2>-<h6> for section headings'
      });
    }

    if (!hasHeadings) {
      issues.push({
        severity: 'warning',
        category: 'semantics',
        message: 'No heading elements (<h1>-<h6>) found',
        suggestion: 'Include appropriate heading elements for content structure'
      });
    }

    // Check for proper nesting
    if (/<div><p><div>/i.test(html)) {
      issues.push({
        severity: 'error',
        category: 'semantics',
        message: 'Improper element nesting detected',
        suggestion: 'Block elements should not be nested inside paragraph elements'
      });
    }
  }

  /**
   * Validate Tailwind CSS usage and quality
   */
  private validateTailwindUsage(html: string, issues: ValidationIssue[]): void {
    // Check for Tailwind 4 features in complex layouts
    if (/grid/i.test(html)) {
      if (!/(grid-cols-|grid-rows-)/i.test(html)) {
        issues.push({
          severity: 'warning',
          category: 'tailwind',
          message: 'Grid container missing column or row definitions',
          suggestion: 'Add grid-cols-* or grid-rows-* classes to grid containers'
        });
      }

      // Check for advanced grid features when using complex layouts
      if (/(grid-cols-[3-9]|grid-cols-1[0-2])/i.test(html) && !/(col-span-|col-start-|col-end-)/i.test(html)) {
        issues.push({
          severity: 'suggestion',
          category: 'tailwind',
          message: 'Complex grid layout could benefit from column span/positioning classes',
          suggestion: 'Use col-span-*, col-start-*, and col-end-* for more sophisticated layouts'
        });
      }

      // Check for Tailwind 4 subgrid feature in nested grids
      if (/(grid.*grid)/i.test(html) && !/(grid-cols-subgrid|grid-rows-subgrid)/i.test(html)) {
        issues.push({
          severity: 'suggestion',
          category: 'tailwind',
          message: 'Nested grid could benefit from subgrid feature in Tailwind 4',
          suggestion: 'Consider using grid-cols-subgrid or grid-rows-subgrid for nested grids'
        });
      }
    }

    // Check for container queries in component-based designs
    if (/component|card|panel|widget/i.test(html) && !/@container/i.test(html)) {
      issues.push({
        severity: 'suggestion',
        category: 'tailwind',
        message: 'Component-based design could benefit from container queries',
        suggestion: 'Use @container queries for component-based responsive design'
      });
    }

    // Check for utility composition vs. long class strings
    const longClassPattern = /class="([^"]{200,})"/i;
    if (longClassPattern.test(html)) {
      issues.push({
        severity: 'warning',
        category: 'tailwind',
        message: 'Very long class attribute may indicate poor Tailwind composition',
        suggestion: 'Consider extracting repeated utility patterns to custom classes or components'
      });
    }

    // Check for newer Tailwind 4 color opacity syntax
    if (/bg-[a-z]+-[0-9]+\/[0-9]+/i.test(html)) {
      // This is good, using the new syntax
    } else if (/opacity-[0-9]+/i.test(html) && /bg-[a-z]+-[0-9]+/i.test(html)) {
      issues.push({
        severity: 'suggestion',
        category: 'tailwind',
        message: 'Using separate opacity utility instead of Tailwind 4 opacity shorthand',
        suggestion: 'Use bg-color/opacity syntax instead of separate opacity-* utility'
      });
    }

    // Check for animation utilities in interactive elements
    if (/(button|link|nav|click)/i.test(html) && !/(hover:|focus:|active:|animate-)/i.test(html)) {
      issues.push({
        severity: 'suggestion',
        category: 'tailwind',
        message: 'Interactive elements without hover/focus/animation states',
        suggestion: 'Add hover:, focus:, and animate-* utilities to enhance interactivity'
      });
    }
  }

  /**
   * Validate accessibility features
   */
  private validateAccessibility(html: string, issues: ValidationIssue[]): void {
    // Check for images without alt text
    if (/<img(?![^>]*alt=)/i.test(html)) {
      issues.push({
        severity: 'error',
        category: 'accessibility',
        message: 'Images missing alt attribute',
        suggestion: 'Add alt text to all images for screen readers'
      });
    } else if (/<img[^>]*alt=""/i.test(html)) {
      issues.push({
        severity: 'warning',
        category: 'accessibility',
        message: 'Images with empty alt attribute',
        suggestion: 'Provide meaningful alt text or use alt="" only for decorative images'
      });
    }

    // Check for form inputs without labels
    if (/<input[^>]*id="([^"]*)"[^>]*>/i.test(html) && !/<label[^>]*for="([^"]*)"[^>]*>/i.test(html)) {
      issues.push({
        severity: 'error',
        category: 'accessibility',
        message: 'Form inputs without associated labels',
        suggestion: 'Add <label for="input-id"> elements for all form controls'
      });
    }

    // Check for buttons without accessible names
    if (/<button(?![^>]*aria-label=|[^>]*>\s*\w).*>/i.test(html)) {
      issues.push({
        severity: 'warning',
        category: 'accessibility',
        message: 'Buttons without text content or aria-label',
        suggestion: 'Ensure buttons have text content or aria-label for screen readers'
      });
    }

    // Check for color contrast indications (just a basic check)
    if (/text-(gray|white)-[1-3]00/i.test(html) && /bg-(gray|black)-[7-9]00/i.test(html)) {
      issues.push({
        severity: 'warning',
        category: 'accessibility',
        message: 'Potentially low contrast text detected',
        suggestion: 'Ensure sufficient color contrast (WCAG AA requires 4.5:1 ratio)'
      });
    }

    // Check for ARIA roles on complex components
    if (/(accordion|tab|dialog|menu)/i.test(html) && !/(role=|aria-)/i.test(html)) {
      issues.push({
        severity: 'warning',
        category: 'accessibility',
        message: 'Complex UI components without ARIA attributes',
        suggestion: 'Add appropriate ARIA roles and attributes to complex interactive elements'
      });
    }
  }

  /**
   * Validate responsive design implementation
   */
  private validateResponsiveDesign(html: string, issues: ValidationIssue[]): void {
    // Check for responsive utilities
    const hasResponsiveClasses = /(sm:|md:|lg:|xl:|2xl:)/i.test(html);
    if (!hasResponsiveClasses) {
      issues.push({
        severity: 'warning',
        category: 'responsive',
        message: 'No responsive breakpoint classes detected',
        suggestion: 'Add sm:, md:, lg:, xl: classes for responsive behavior'
      });
    }

    // Check for viewport meta tag
    if (!/<meta[^>]*name="viewport"[^>]*>/i.test(html) && !/<meta[^>]*viewport[^>]*>/i.test(html)) {
      issues.push({
        severity: 'warning',
        category: 'responsive',
        message: 'Missing viewport meta tag',
        suggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0">'
      });
    }

    // Check for mobile-first approach
    const desktopFirstPattern = /(xl:|lg:|md:).*(?!sm:)/i;
    if (desktopFirstPattern.test(html)) {
      issues.push({
        severity: 'suggestion',
        category: 'responsive',
        message: 'Consider mobile-first approach',
        suggestion: 'Define base styles for mobile and use breakpoints to enhance for larger screens'
      });
    }

    // Check for flexible image handling
    if (/<img[^>]*style="[^"]*width:[^"]*px/i.test(html) || /<img[^>]*width="[0-9]+"/) {
      issues.push({
        severity: 'warning',
        category: 'responsive',
        message: 'Images with fixed width may not be responsive',
        suggestion: 'Use max-width: 100% or Tailwind\'s max-w-full with width: auto for responsive images'
      });
    }

    // Check for dynamic viewport units
    const hasHeightClasses = /h-\[.*vh\]/i.test(html);
    if (hasHeightClasses && !/(svh|dvh|lvh)/i.test(html)) {
      issues.push({
        severity: 'suggestion',
        category: 'responsive',
        message: 'Consider using dynamic viewport units for better mobile experience',
        suggestion: 'Replace vh with dvh, svh, or lvh for better handling of mobile browser chrome'
      });
    }
  }
}

export default HTMLQualityService;
