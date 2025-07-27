/**
 * Layout Section Splitting Service
 * Intelligently splits large layout files into manageable sections for sequential processing
 */

import { createLogger } from '../utils/logger';
const logger = createLogger();
// Simplified error handler for testing
const createError = (message: string, status: number, code: string, details: string, suggestion: string) => {
  const error = new Error(message) as any;
  error.status = status;
  error.code = code;
  error.details = details;
  error.suggestion = suggestion;
  return error;
};
import * as cheerio from 'cheerio';

export interface LayoutSection {
  id: string;
  type: 'header' | 'hero' | 'content' | 'sidebar' | 'footer' | 'navigation' | 'feature' | 'testimonial' | 'contact' | 'gallery' | 'unknown';
  html: string;
  title: string;
  description: string;
  complexity: 'low' | 'medium' | 'high';
  estimatedFields: number;
  dependencies: string[]; // IDs of sections this depends on
  priority: number; // Processing order priority (1 = highest)
  boundingBox?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface SplittingResult {
  sections: LayoutSection[];
  totalSections: number;
  estimatedProcessingTime: number;
  recommendedBatchSize: number;
  metadata: {
    originalSize: number;
    averageSectionSize: number;
    complexitySummary: Record<string, number>;
  };
}

export interface SplittingOptions {
  maxSectionSize?: number; // Max HTML size per section (default: 50KB)
  minSectionSize?: number; // Min HTML size per section (default: 1KB)
  preserveStructure?: boolean; // Keep semantic structure intact (default: true)
  detectComponents?: boolean; // Auto-detect reusable components (default: true)
  splitStrategy?: 'semantic' | 'size' | 'hybrid'; // Splitting strategy (default: hybrid)
  maxSections?: number; // Maximum number of sections (default: 20)
}

class LayoutSectionSplittingService {
  private static instance: LayoutSectionSplittingService;

  public static getInstance(): LayoutSectionSplittingService {
    if (!LayoutSectionSplittingService.instance) {
      LayoutSectionSplittingService.instance = new LayoutSectionSplittingService();
    }
    return LayoutSectionSplittingService.instance;
  }

  /**
   * Split a large layout file into manageable sections
   */
  async splitLayout(html: string, options: SplittingOptions = {}): Promise<SplittingResult> {
    try {
      logger.info('Starting layout section splitting', { 
        htmlSize: html.length,
        options 
      });

      const opts = this.normalizeOptions(options);
      const $ = cheerio.load(html);
      
      // Remove scripts and styles for cleaner processing
      $('script, style, noscript').remove();
      
      // Detect and extract sections
      const sections = await this.detectSections($ as any, opts);
      
      // Analyze dependencies and set priorities
      this.analyzeDependencies(sections);
      
      // Calculate metadata
      const metadata = this.calculateMetadata(html, sections);
      
      const result: SplittingResult = {
        sections: sections.sort((a, b) => a.priority - b.priority),
        totalSections: sections.length,
        estimatedProcessingTime: this.estimateProcessingTime(sections),
        recommendedBatchSize: this.calculateBatchSize(sections),
        metadata
      };

      logger.info('Layout splitting completed', {
        totalSections: result.totalSections,
        estimatedTime: result.estimatedProcessingTime,
        batchSize: result.recommendedBatchSize
      });

      return result;
    } catch (error) {
      logger.error('Layout splitting failed', { error });
      throw createError(
        'Failed to split layout into sections',
        500,
        'LAYOUT_SPLITTING_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        'Check the HTML structure and try again'
      );
    }
  }

  /**
   * Detect semantic sections in the layout
   */
  private async detectSections($: cheerio.CheerioAPI, options: SplittingOptions): Promise<LayoutSection[]> {
    const sections: LayoutSection[] = [];
    let sectionId = 1;

    // Define section detection patterns
    const sectionPatterns = [
      // Header sections
      { 
        selector: 'header, .header, #header, [role="banner"]',
        type: 'header' as const,
        priority: 1
      },
      // Navigation sections
      { 
        selector: 'nav, .nav, .navigation, [role="navigation"]',
        type: 'navigation' as const,
        priority: 2
      },
      // Hero sections
      { 
        selector: '.hero, .banner, .jumbotron, .hero-section, .intro-section',
        type: 'hero' as const,
        priority: 3
      },
      // Main content areas
      { 
        selector: 'main, .main, .content, .main-content, [role="main"]',
        type: 'content' as const,
        priority: 4
      },
      // Sidebar sections
      { 
        selector: 'aside, .sidebar, .side-content, [role="complementary"]',
        type: 'sidebar' as const,
        priority: 6
      },
      // Feature sections
      { 
        selector: '.features, .feature-section, .services, .benefits',
        type: 'feature' as const,
        priority: 5
      },
      // Testimonial sections
      { 
        selector: '.testimonials, .reviews, .testimonial-section',
        type: 'testimonial' as const,
        priority: 7
      },
      // Contact sections
      { 
        selector: '.contact, .contact-form, .contact-section, form[name*="contact"]',
        type: 'contact' as const,
        priority: 8
      },
      // Gallery sections
      { 
        selector: '.gallery, .portfolio, .images, .photo-gallery',
        type: 'gallery' as const,
        priority: 9
      },
      // Footer sections
      { 
        selector: 'footer, .footer, #footer, [role="contentinfo"]',
        type: 'footer' as const,
        priority: 10
      }
    ];

    // Process each pattern
    for (const pattern of sectionPatterns) {
      $(pattern.selector).each((_: number, element: any) => {
        const $element = $(element);
        const html = $.html($element);
        
        if (this.shouldCreateSection(html, options)) {
          const section = this.createSection(
            `section_${sectionId++}`,
            pattern.type,
            html,
            $element,
            pattern.priority
          );
          sections.push(section);
          
          // Remove processed element to avoid duplication
          $element.remove();
        }
      });
    }

    // Handle remaining content by semantic structure
    if (options.splitStrategy !== 'semantic') {
      const remainingSections = this.splitRemainingContent($, sectionId, options);
      sections.push(...remainingSections);
    }

    return sections;
  }

  /**
   * Split remaining content that wasn't caught by semantic patterns
   */
  private splitRemainingContent($: cheerio.CheerioAPI, startId: number, options: SplittingOptions): LayoutSection[] {
    const sections: LayoutSection[] = [];
    let sectionId = startId;

    // Look for large containers that should be split
    $('div, section, article').each((_, element) => {
      const $element = $(element);
      const html = $.html($element);
      
      if (html && html.length > (options.maxSectionSize || 50000)) {
        // Split large containers by size
        const childSections = this.splitBySize($element, sectionId, options);
        sections.push(...childSections);
        sectionId += childSections.length;
        $element.remove();
      } else if (this.shouldCreateSection(html, options)) {
        const section = this.createSection(
          `section_${sectionId++}`,
          'content',
          html,
          $element,
          5
        );
        sections.push(section);
        $element.remove();
      }
    });

    return sections;
  }

  /**
   * Split large elements by size constraints
   */
  private splitBySize($element: any, startId: number, options: SplittingOptions): LayoutSection[] {
    const sections: LayoutSection[] = [];
    const maxSize = options.maxSectionSize || 50000;
    let currentHtml = '';
    let sectionId = startId;

    $element.children().each((_: number, child: any) => {
      const childHtml = $element.html(cheerio.load(child));
      
      if (currentHtml.length + childHtml.length > maxSize && currentHtml) {
        // Create section from accumulated content
        sections.push(this.createSectionFromHtml(
          `section_${sectionId++}`,
          'content',
          currentHtml,
          5
        ));
        currentHtml = childHtml;
      } else {
        currentHtml += childHtml;
      }
    });

    // Add remaining content
    if (currentHtml) {
      sections.push(this.createSectionFromHtml(
        `section_${sectionId}`,
        'content',
        currentHtml,
        5
      ));
    }

    return sections;
  }

  /**
   * Create a section from a Cheerio element
   */
  private createSection(
    id: string, 
    type: LayoutSection['type'], 
    html: string, 
    $element: any,
    priority: number
  ): LayoutSection {
    return {
      id,
      type,
      html,
      title: this.extractTitle($element, type),
      description: this.generateDescription($element, type),
      complexity: this.assessComplexity(html),
      estimatedFields: this.estimateFieldCount(html),
      dependencies: [],
      priority
    };
  }

  /**
   * Create a section from HTML string
   */
  private createSectionFromHtml(
    id: string, 
    type: LayoutSection['type'], 
    html: string,
    priority: number
  ): LayoutSection {
    const $ = cheerio.load(html);
    return this.createSection(id, type, html, $.root(), priority);
  }

  /**
   * Extract meaningful title from section
   */
  private extractTitle($element: any, type: string): string {
    // Try to find heading elements
    const headings = $element.find('h1, h2, h3, h4, h5, h6').first();
    if (headings.length) {
      return headings.text().trim().substring(0, 100);
    }

    // Try data attributes
    const title = $element.attr('data-title') || $element.attr('title');
    if (title) {
      return title.substring(0, 100);
    }

    // Try class names for hints
    const className = $element.attr('class') || '';
    const classHints = className.split(' ').find((cls: string) => 
      cls.includes('title') || cls.includes('heading') || cls.includes('name')
    );
    if (classHints) {
      return `${type} (${classHints})`;
    }

    // Fallback to type-based title
    return `${type.charAt(0).toUpperCase() + type.slice(1)} Section`;
  }

  /**
   * Generate description for section
   */
  private generateDescription($element: any, type: string): string {
    const textContent = $element.text().trim();
    const preview = textContent.substring(0, 200);
    
    const elementCount = $element.find('*').length;
    const imageCount = $element.find('img').length;
    const linkCount = $element.find('a').length;
    const formCount = $element.find('form, input, textarea, select').length;

    let description = `${type} section`;
    if (preview) {
      description += ` containing: "${preview}${textContent.length > 200 ? '...' : ''}"`;
    }
    
    description += ` (${elementCount} elements`;
    if (imageCount > 0) description += `, ${imageCount} images`;
    if (linkCount > 0) description += `, ${linkCount} links`;
    if (formCount > 0) description += `, ${formCount} form elements`;
    description += ')';

    return description;
  }

  /**
   * Assess complexity of a section
   */
  private assessComplexity(html: string): 'low' | 'medium' | 'high' {
    const $ = cheerio.load(html);
    
    const elementCount = $('*').length;
    const nestingDepth = this.calculateNestingDepth($);
    const interactiveElements = $('form, input, select, textarea, button, [onclick]').length;
    const mediaElements = $('img, video, audio, iframe').length;
    
    let complexityScore = 0;
    
    // Element count scoring
    if (elementCount > 50) complexityScore += 3;
    else if (elementCount > 20) complexityScore += 2;
    else if (elementCount > 10) complexityScore += 1;
    
    // Nesting depth scoring
    if (nestingDepth > 8) complexityScore += 3;
    else if (nestingDepth > 5) complexityScore += 2;
    else if (nestingDepth > 3) complexityScore += 1;
    
    // Interactive elements scoring
    if (interactiveElements > 10) complexityScore += 3;
    else if (interactiveElements > 5) complexityScore += 2;
    else if (interactiveElements > 0) complexityScore += 1;
    
    // Media elements scoring
    if (mediaElements > 5) complexityScore += 2;
    else if (mediaElements > 2) complexityScore += 1;
    
    if (complexityScore >= 7) return 'high';
    if (complexityScore >= 4) return 'medium';
    return 'low';
  }

  /**
   * Calculate maximum nesting depth
   */
  private calculateNestingDepth($: any): number {
    let maxDepth = 0;
    
    const calculateDepth = (element: any, depth: number): void => {
      maxDepth = Math.max(maxDepth, depth);
      $(element).children().each((_: number, child: any) => {
        calculateDepth(child, depth + 1);
      });
    };
    
    $('body').children().each((_: number, child: any) => {
      calculateDepth(child, 1);
    });
    
    return maxDepth;
  }

  /**
   * Estimate number of editable fields in section
   */
  private estimateFieldCount(html: string): number {
    const $ = cheerio.load(html);
    
    let fieldCount = 0;
    
    // Text content fields
    fieldCount += $('h1, h2, h3, h4, h5, h6').length; // Headings
    fieldCount += $('p').length; // Paragraphs
    fieldCount += $('span, div').filter((_, el) => {
      const text = $(el).text().trim();
      return text.length > 10 && text.length < 500;
    }).length;
    
    // Image fields
    fieldCount += $('img').length;
    
    // Link fields
    fieldCount += $('a[href]').length;
    
    // Form fields
    fieldCount += $('input, textarea, select').length;
    
    // Button fields
    fieldCount += $('button, .btn, [role="button"]').length;
    
    return Math.max(1, fieldCount);
  }

  /**
   * Analyze dependencies between sections
   */
  private analyzeDependencies(sections: LayoutSection[]): void {
    sections.forEach(section => {
      // Navigation typically depends on other sections for links
      if (section.type === 'navigation') {
        const contentSections = sections.filter(s => 
          s.type === 'content' || s.type === 'hero' || s.type === 'feature'
        );
        section.dependencies = contentSections.map(s => s.id);
      }
      
      // Footer often references other sections
      if (section.type === 'footer') {
        const mainSections = sections.filter(s => 
          s.type !== 'footer' && s.type !== 'header'
        );
        section.dependencies = mainSections.slice(0, 3).map(s => s.id);
      }
    });
  }

  /**
   * Check if HTML should create a new section
   */
  private shouldCreateSection(html: string, options: SplittingOptions): boolean {
    if (!html || html.trim().length === 0) return false;
    
    const minSize = options.minSectionSize || 1000;
    const maxSize = options.maxSectionSize || 50000;
    
    return html.length >= minSize && html.length <= maxSize;
  }

  /**
   * Normalize splitting options
   */
  private normalizeOptions(options: SplittingOptions): Required<SplittingOptions> {
    return {
      maxSectionSize: options.maxSectionSize || 50000,
      minSectionSize: options.minSectionSize || 1000,
      preserveStructure: options.preserveStructure ?? true,
      detectComponents: options.detectComponents ?? true,
      splitStrategy: options.splitStrategy || 'hybrid',
      maxSections: options.maxSections || 20
    };
  }

  /**
   * Estimate processing time for sections
   */
  private estimateProcessingTime(sections: LayoutSection[]): number {
    let totalTime = 0;
    
    sections.forEach(section => {
      // Base time per section
      let sectionTime = 30; // 30 seconds base
      
      // Complexity multiplier
      switch (section.complexity) {
        case 'high': sectionTime *= 2.5; break;
        case 'medium': sectionTime *= 1.5; break;
        case 'low': sectionTime *= 1; break;
      }
      
      // Field count impact
      sectionTime += section.estimatedFields * 2;
      
      totalTime += sectionTime;
    });
    
    return Math.round(totalTime);
  }

  /**
   * Calculate recommended batch size for processing
   */
  private calculateBatchSize(sections: LayoutSection[]): number {
    const totalComplexity = sections.reduce((sum, section) => {
      switch (section.complexity) {
        case 'high': return sum + 3;
        case 'medium': return sum + 2;
        case 'low': return sum + 1;
        default: return sum + 1;
      }
    }, 0);
    
    // Aim for batches that take ~5 minutes to process
    const targetComplexityPerBatch = 10;
    return Math.max(1, Math.min(5, Math.floor(targetComplexityPerBatch * sections.length / totalComplexity)));
  }

  /**
   * Calculate metadata about the splitting result
   */
  private calculateMetadata(originalHtml: string, sections: LayoutSection[]): SplittingResult['metadata'] {
    const complexitySummary = sections.reduce((summary, section) => {
      summary[section.complexity] = (summary[section.complexity] || 0) + 1;
      return summary;
    }, {} as Record<string, number>);

    const totalSectionSize = sections.reduce((sum, section) => sum + section.html.length, 0);

    return {
      originalSize: originalHtml.length,
      averageSectionSize: Math.round(totalSectionSize / sections.length),
      complexitySummary
    };
  }
}

export const layoutSectionSplittingService = LayoutSectionSplittingService.getInstance();
export default layoutSectionSplittingService;
