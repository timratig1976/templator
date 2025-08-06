/**
 * Quality Metrics Collector
 * Collects and analyzes quality metrics across the entire pipeline
 */

import { createLogger } from '../../../utils/logger';
import { HTMLValidator } from '../validation/HTMLValidator';

const logger = createLogger();

export interface QualityMetrics {
  id: string;
  timestamp: string;
  moduleId: string;
  pipelineId: string;
  
  // Core quality scores
  overallScore: number;
  syntaxScore: number;
  semanticScore: number;
  accessibilityScore: number;
  performanceScore: number;
  seoScore: number;
  
  // Detailed metrics
  validation: {
    errors: number;
    warnings: number;
    suggestions: number;
  };
  
  // Performance metrics
  performance: {
    loadTime: number;
    renderTime: number;
    codeSize: number;
    complexity: number;
  };
  
  // Accessibility metrics
  accessibility: {
    wcagLevel: 'A' | 'AA' | 'AAA' | 'None';
    colorContrast: number;
    keyboardNavigation: boolean;
    screenReaderCompatible: boolean;
  };
  
  // SEO metrics
  seo: {
    metaTags: number;
    headingStructure: boolean;
    altTexts: number;
    semanticMarkup: boolean;
  };
  
  // Code quality metrics
  codeQuality: {
    maintainabilityIndex: number;
    cyclomaticComplexity: number;
    linesOfCode: number;
    duplication: number;
  };
}

export interface QualityTrend {
  period: string;
  averageScore: number;
  improvement: number;
  totalModules: number;
  trends: {
    syntax: number;
    semantic: number;
    accessibility: number;
    performance: number;
    seo: number;
  };
}

/**
 * Quality Metrics Collector Service
 * Collects, analyzes, and reports on quality metrics
 */
export class QualityMetricsCollector {
  private static instance: QualityMetricsCollector;
  private htmlValidator: HTMLValidator;
  private metrics: Map<string, QualityMetrics> = new Map();

  public static getInstance(): QualityMetricsCollector {
    if (!QualityMetricsCollector.instance) {
      QualityMetricsCollector.instance = new QualityMetricsCollector();
    }
    return QualityMetricsCollector.instance;
  }

  private constructor() {
    this.htmlValidator = HTMLValidator.getInstance();
  }

  /**
   * Collect quality metrics for a module
   */
  async collectMetrics(
    moduleId: string,
    pipelineId: string,
    html: string,
    css: string
  ): Promise<QualityMetrics> {
    const startTime = Date.now();
    
    try {
      logger.info('Collecting quality metrics', { moduleId, pipelineId });

      // Validate HTML/CSS
      const validation = await this.htmlValidator.validateHTML(html, {
        checkAccessibility: true,
        checkPerformance: true,
        checkSEO: true
      });

      // Calculate performance metrics
      const performance = this.calculatePerformanceMetrics(html, css);
      
      // Calculate accessibility metrics
      const accessibility = this.calculateAccessibilityMetrics(html, validation);
      
      // Calculate SEO metrics
      const seo = this.calculateSEOMetrics(html, validation);
      
      // Calculate code quality metrics
      const codeQuality = this.calculateCodeQualityMetrics(html, css);

      const metrics: QualityMetrics = {
        id: `metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        moduleId,
        pipelineId,
        overallScore: validation.score || 0,
        syntaxScore: validation.score || 0,
        semanticScore: validation.score || 0,
        accessibilityScore: validation.score || 0,
        performanceScore: validation.score || 0,
        seoScore: validation.score || 0,
        validation: {
          errors: validation.errors?.length || 0,
          warnings: validation.warnings?.length || 0,
          suggestions: validation.suggestions?.length || 0
        },
        performance,
        accessibility,
        seo,
        codeQuality
      };

      // Store metrics
      this.metrics.set(metrics.id, metrics);

      logger.info('Quality metrics collected', {
        moduleId,
        overallScore: metrics.overallScore,
        collectionTime: Date.now() - startTime
      });

      return metrics;

    } catch (error) {
      logger.error('Failed to collect quality metrics', {
        moduleId,
        pipelineId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get quality metrics by ID
   */
  getMetrics(metricsId: string): QualityMetrics | undefined {
    return this.metrics.get(metricsId);
  }

  /**
   * Get all metrics for a module
   */
  getModuleMetrics(moduleId: string): QualityMetrics[] {
    return Array.from(this.metrics.values()).filter(m => m.moduleId === moduleId);
  }

  /**
   * Get all metrics for a pipeline
   */
  getPipelineMetrics(pipelineId: string): QualityMetrics[] {
    return Array.from(this.metrics.values()).filter(m => m.pipelineId === pipelineId);
  }

  /**
   * Get quality trends over time
   */
  getQualityTrends(days: number = 30): QualityTrend[] {
    const trends: QualityTrend[] = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayMetrics = Array.from(this.metrics.values()).filter(m => 
        m.timestamp.startsWith(dateStr)
      );

      if (dayMetrics.length > 0) {
        const averageScore = dayMetrics.reduce((sum, m) => sum + m.overallScore, 0) / dayMetrics.length;
        
        trends.push({
          period: dateStr,
          averageScore,
          improvement: i > 0 ? averageScore - trends[trends.length - 1]?.averageScore || 0 : 0,
          totalModules: dayMetrics.length,
          trends: {
            syntax: dayMetrics.reduce((sum, m) => sum + m.syntaxScore, 0) / dayMetrics.length,
            semantic: dayMetrics.reduce((sum, m) => sum + m.semanticScore, 0) / dayMetrics.length,
            accessibility: dayMetrics.reduce((sum, m) => sum + m.accessibilityScore, 0) / dayMetrics.length,
            performance: dayMetrics.reduce((sum, m) => sum + m.performanceScore, 0) / dayMetrics.length,
            seo: dayMetrics.reduce((sum, m) => sum + m.seoScore, 0) / dayMetrics.length
          }
        });
      }
    }

    return trends.reverse();
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(html: string, css: string) {
    const htmlSize = new Blob([html]).size;
    const cssSize = new Blob([css]).size;
    const totalSize = htmlSize + cssSize;
    
    // Simple complexity calculation based on DOM depth and CSS rules
    const domComplexity = (html.match(/<[^>]+>/g) || []).length;
    const cssComplexity = (css.match(/\{[^}]*\}/g) || []).length;
    
    return {
      loadTime: Math.max(100, totalSize / 1000), // Estimated load time
      renderTime: Math.max(50, domComplexity / 10), // Estimated render time
      codeSize: totalSize,
      complexity: domComplexity + cssComplexity
    };
  }

  /**
   * Calculate accessibility metrics
   */
  private calculateAccessibilityMetrics(html: string, validation: any) {
    const hasAltTexts = (html.match(/alt\s*=/gi) || []).length > 0;
    const hasAriaLabels = (html.match(/aria-\w+/gi) || []).length > 0;
    const hasHeadingStructure = /h[1-6]/i.test(html);
    
    let wcagLevel: 'A' | 'AA' | 'AAA' | 'None' = 'None';
    const accessibilityScore = validation.accessibilityScore || 0;
    
    if (accessibilityScore >= 95) wcagLevel = 'AAA';
    else if (accessibilityScore >= 85) wcagLevel = 'AA';
    else if (accessibilityScore >= 70) wcagLevel = 'A';

    return {
      wcagLevel,
      colorContrast: accessibilityScore >= 80 ? 4.5 : 3.0, // Estimated
      keyboardNavigation: hasAriaLabels,
      screenReaderCompatible: hasAltTexts && hasAriaLabels
    };
  }

  /**
   * Calculate SEO metrics
   */
  private calculateSEOMetrics(html: string, validation: any) {
    const metaTags = (html.match(/<meta[^>]*>/gi) || []).length;
    const altTexts = (html.match(/alt\s*=/gi) || []).length;
    const hasHeadingStructure = /h[1-6]/i.test(html);
    const hasSemanticMarkup = /<(article|section|nav|aside|header|footer|main)/i.test(html);

    return {
      metaTags,
      headingStructure: hasHeadingStructure,
      altTexts,
      semanticMarkup: hasSemanticMarkup
    };
  }

  /**
   * Calculate code quality metrics
   */
  private calculateCodeQualityMetrics(html: string, css: string) {
    const htmlLines = html.split('\n').length;
    const cssLines = css.split('\n').length;
    const totalLines = htmlLines + cssLines;
    
    // Simple maintainability index calculation
    const maintainabilityIndex = Math.max(0, 100 - (totalLines / 10));
    
    // Simple cyclomatic complexity (based on conditional structures)
    const conditionalPatterns = /if|else|switch|case|for|while|\?|&&|\|\|/gi;
    const cyclomaticComplexity = (html + css).match(conditionalPatterns)?.length || 1;
    
    // Simple duplication detection (repeated patterns)
    const duplicatedLines = this.detectDuplication(html + css);

    return {
      maintainabilityIndex,
      cyclomaticComplexity,
      linesOfCode: totalLines,
      duplication: duplicatedLines
    };
  }

  /**
   * Detect code duplication
   */
  private detectDuplication(code: string): number {
    const lines = code.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const lineCount = new Map<string, number>();
    
    lines.forEach(line => {
      lineCount.set(line, (lineCount.get(line) || 0) + 1);
    });
    
    let duplicatedLines = 0;
    lineCount.forEach(count => {
      if (count > 1) {
        duplicatedLines += count - 1;
      }
    });
    
    return duplicatedLines;
  }

  /**
   * Generate quality report
   */
  generateQualityReport(moduleId: string): {
    summary: any;
    recommendations: string[];
    trends: QualityTrend[];
  } {
    const moduleMetrics = this.getModuleMetrics(moduleId);
    
    if (moduleMetrics.length === 0) {
      return {
        summary: null,
        recommendations: ['No quality metrics available for this module'],
        trends: []
      };
    }

    const latest = moduleMetrics[moduleMetrics.length - 1];
    const recommendations: string[] = [];

    // Generate recommendations based on scores
    if (latest.syntaxScore < 90) {
      recommendations.push('Improve HTML/CSS syntax validation');
    }
    if (latest.accessibilityScore < 85) {
      recommendations.push('Enhance accessibility compliance (WCAG guidelines)');
    }
    if (latest.performanceScore < 80) {
      recommendations.push('Optimize performance (reduce code size, improve loading)');
    }
    if (latest.seoScore < 85) {
      recommendations.push('Improve SEO optimization (meta tags, semantic markup)');
    }

    return {
      summary: {
        overallScore: latest.overallScore,
        totalMetrics: moduleMetrics.length,
        lastUpdated: latest.timestamp,
        scores: {
          syntax: latest.syntaxScore,
          semantic: latest.semanticScore,
          accessibility: latest.accessibilityScore,
          performance: latest.performanceScore,
          seo: latest.seoScore
        }
      },
      recommendations,
      trends: this.getQualityTrends(7) // Last 7 days
    };
  }
}

export default QualityMetricsCollector.getInstance();
