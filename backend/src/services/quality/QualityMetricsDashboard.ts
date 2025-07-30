/**
 * Quality Metrics Dashboard
 * Comprehensive quality tracking, analysis, and reporting system
 */

import { createLogger } from '../../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger();

export interface QualityMetric {
  id: string;
  name: string;
  category: 'html' | 'accessibility' | 'performance' | 'hubspot' | 'tailwind' | 'seo';
  value: number; // 0-100
  weight: number; // Importance weight
  threshold: {
    excellent: number; // >= excellent
    good: number; // >= good
    poor: number; // < poor
  };
  trend: 'improving' | 'declining' | 'stable';
  lastUpdated: Date;
  history: QualityHistoryPoint[];
}

export interface QualityHistoryPoint {
  timestamp: Date;
  value: number;
  pipelineId?: string;
  context?: Record<string, any>;
}

export interface QualityReport {
  id: string;
  pipelineId: string;
  overallScore: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  metrics: QualityMetric[];
  recommendations: QualityRecommendation[];
  trends: QualityTrend[];
  generatedAt: Date;
  sectionBreakdown: SectionQuality[];
}

export interface QualityRecommendation {
  id: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: number; // Expected quality improvement
  effort: 'low' | 'medium' | 'high';
  actionable: boolean;
  autoFixable: boolean;
}

export interface QualityTrend {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  change: number; // Percentage change
  period: '24h' | '7d' | '30d';
  significance: 'major' | 'minor' | 'negligible';
}

export interface SectionQuality {
  sectionId: string;
  name: string;
  overallScore: number;
  metrics: Record<string, number>;
  issues: QualityIssue[];
  strengths: string[];
}

export interface QualityIssue {
  type: 'error' | 'warning' | 'suggestion';
  category: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  fixable: boolean;
  location?: string;
}

export class QualityMetricsDashboard extends EventEmitter {
  private metrics: Map<string, QualityMetric> = new Map();
  private reports: Map<string, QualityReport> = new Map();
  private globalTrends: Map<string, QualityTrend[]> = new Map();

  constructor() {
    super();
    this.initializeDefaultMetrics();
    this.setupTrendAnalysis();
  }

  /**
   * Initialize default quality metrics
   */
  private initializeDefaultMetrics(): void {
    const defaultMetrics: Omit<QualityMetric, 'id' | 'value' | 'trend' | 'lastUpdated' | 'history'>[] = [
      {
        name: 'HTML Structure',
        category: 'html',
        weight: 20,
        threshold: { excellent: 90, good: 75, poor: 60 }
      },
      {
        name: 'Semantic HTML',
        category: 'html',
        weight: 15,
        threshold: { excellent: 85, good: 70, poor: 55 }
      },
      {
        name: 'Accessibility Score',
        category: 'accessibility',
        weight: 25,
        threshold: { excellent: 95, good: 80, poor: 65 }
      },
      {
        name: 'ARIA Implementation',
        category: 'accessibility',
        weight: 20,
        threshold: { excellent: 90, good: 75, poor: 60 }
      },
      {
        name: 'Performance Score',
        category: 'performance',
        weight: 20,
        threshold: { excellent: 90, good: 75, poor: 60 }
      },
      {
        name: 'HubSpot Compliance',
        category: 'hubspot',
        weight: 30,
        threshold: { excellent: 95, good: 85, poor: 70 }
      },
      {
        name: 'Tailwind Optimization',
        category: 'tailwind',
        weight: 15,
        threshold: { excellent: 85, good: 70, poor: 55 }
      },
      {
        name: 'SEO Readiness',
        category: 'seo',
        weight: 10,
        threshold: { excellent: 80, good: 65, poor: 50 }
      }
    ];

    defaultMetrics.forEach((metric, index) => {
      const fullMetric: QualityMetric = {
        ...metric,
        id: `metric_${index + 1}`,
        value: 0,
        trend: 'stable',
        lastUpdated: new Date(),
        history: []
      };
      this.metrics.set(fullMetric.id, fullMetric);
    });

    logger.info('Initialized quality metrics', { 
      totalMetrics: this.metrics.size 
    });
  }

  /**
   * Generate comprehensive quality report
   */
  async generateQualityReport(
    pipelineId: string,
    sectionData: any[],
    validationResults: any[]
  ): Promise<QualityReport> {
    const reportId = `report_${pipelineId}_${Date.now()}`;
    
    // Calculate section-level quality
    const sectionBreakdown = this.analyzeSectionQuality(sectionData, validationResults);
    
    // Update metrics based on current analysis
    const updatedMetrics = await this.updateMetricsFromAnalysis(pipelineId, sectionData, validationResults);
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(updatedMetrics);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(updatedMetrics, sectionBreakdown);
    
    // Analyze trends
    const trends = this.analyzeTrends(updatedMetrics);
    
    const report: QualityReport = {
      id: reportId,
      pipelineId,
      overallScore,
      grade: this.calculateGrade(overallScore),
      metrics: updatedMetrics,
      recommendations,
      trends,
      generatedAt: new Date(),
      sectionBreakdown
    };

    this.reports.set(reportId, report);
    this.emit('report-generated', report);

    logger.info('Quality report generated', {
      reportId,
      pipelineId,
      overallScore,
      grade: report.grade,
      sectionsAnalyzed: sectionBreakdown.length
    });

    return report;
  }

  /**
   * Update metrics from pipeline analysis
   */
  private async updateMetricsFromAnalysis(
    pipelineId: string,
    sectionData: any[],
    validationResults: any[]
  ): Promise<QualityMetric[]> {
    const updatedMetrics: QualityMetric[] = [];

    for (const [metricId, metric] of this.metrics) {
      let newValue = 0;

      switch (metric.category) {
        case 'html':
          newValue = this.calculateHtmlQuality(sectionData, validationResults);
          break;
        case 'accessibility':
          newValue = this.calculateAccessibilityQuality(sectionData, validationResults);
          break;
        case 'performance':
          newValue = this.calculatePerformanceQuality(sectionData);
          break;
        case 'hubspot':
          newValue = this.calculateHubSpotCompliance(sectionData, validationResults);
          break;
        case 'tailwind':
          newValue = this.calculateTailwindOptimization(sectionData);
          break;
        case 'seo':
          newValue = this.calculateSeoReadiness(sectionData);
          break;
      }

      // Update metric with new value
      const updatedMetric = {
        ...metric,
        value: newValue,
        trend: this.calculateTrend(metric.history, newValue),
        lastUpdated: new Date(),
        history: [
          ...metric.history.slice(-19), // Keep last 19 points
          {
            timestamp: new Date(),
            value: newValue,
            pipelineId,
            context: { sectionsCount: sectionData.length }
          }
        ]
      };

      this.metrics.set(metricId, updatedMetric);
      updatedMetrics.push(updatedMetric);
    }

    return updatedMetrics;
  }

  /**
   * Calculate HTML quality score
   */
  private calculateHtmlQuality(sectionData: any[], validationResults: any[]): number {
    let score = 100;
    let totalSections = sectionData.length;

    if (totalSections === 0) return 0;

    // Check for HTML validation errors
    const htmlErrors = validationResults.filter(r => r.category === 'html' && r.type === 'error');
    score -= (htmlErrors.length / totalSections) * 20;

    // Check for semantic HTML usage
    const semanticElements = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'];
    const semanticUsage = sectionData.reduce((acc, section) => {
      const html = section.html || '';
      const usedElements = semanticElements.filter(el => html.includes(`<${el}`));
      return acc + (usedElements.length / semanticElements.length);
    }, 0) / totalSections;

    score = (score * 0.7) + (semanticUsage * 100 * 0.3);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate accessibility quality score
   */
  private calculateAccessibilityQuality(sectionData: any[], validationResults: any[]): number {
    let score = 100;
    let totalSections = sectionData.length;

    if (totalSections === 0) return 0;

    // Check for accessibility errors
    const a11yErrors = validationResults.filter(r => r.category === 'accessibility');
    score -= (a11yErrors.length / totalSections) * 15;

    // Check for ARIA attributes
    const ariaUsage = sectionData.reduce((acc, section) => {
      const html = section.html || '';
      const ariaAttributes = (html.match(/aria-\w+/g) || []).length;
      const elements = (html.match(/<\w+/g) || []).length;
      return acc + (elements > 0 ? ariaAttributes / elements : 0);
    }, 0) / totalSections;

    score = (score * 0.8) + (ariaUsage * 100 * 0.2);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate performance quality score
   */
  private calculatePerformanceQuality(sectionData: any[]): number {
    let score = 100;
    let totalSections = sectionData.length;

    if (totalSections === 0) return 0;

    // Analyze CSS efficiency
    const avgCssClasses = sectionData.reduce((acc, section) => {
      const html = section.html || '';
      const classes = (html.match(/class="[^"]*"/g) || []).join(' ');
      const classCount = (classes.match(/\w+/g) || []).length;
      const elementCount = (html.match(/<\w+/g) || []).length;
      return acc + (elementCount > 0 ? classCount / elementCount : 0);
    }, 0) / totalSections;

    // Penalize excessive classes
    if (avgCssClasses > 5) score -= (avgCssClasses - 5) * 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate HubSpot compliance score
   */
  private calculateHubSpotCompliance(sectionData: any[], validationResults: any[]): number {
    let score = 100;

    // Check for HubSpot-specific validation errors
    const hubspotErrors = validationResults.filter(r => r.category === 'hubspot');
    score -= hubspotErrors.length * 10;

    // Check for required HubSpot patterns
    const requiredPatterns = ['{{', 'module.', 'content.'];
    const patternUsage = sectionData.reduce((acc, section) => {
      const html = section.html || '';
      const usedPatterns = requiredPatterns.filter(pattern => html.includes(pattern));
      return acc + (usedPatterns.length / requiredPatterns.length);
    }, 0) / sectionData.length;

    score = (score * 0.7) + (patternUsage * 100 * 0.3);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate Tailwind optimization score
   */
  private calculateTailwindOptimization(sectionData: any[]): number {
    let score = 100;

    // Analyze Tailwind class usage efficiency
    const tailwindUsage = sectionData.reduce((acc, section) => {
      const html = section.html || '';
      const allClasses = (html.match(/class="[^"]*"/g) || []).join(' ');
      const tailwindClasses = (allClasses.match(/\b(bg-|text-|p-|m-|flex|grid|w-|h-)/g) || []).length;
      const totalClasses = (allClasses.match(/\w+/g) || []).length;
      return acc + (totalClasses > 0 ? tailwindClasses / totalClasses : 0);
    }, 0) / sectionData.length;

    score = tailwindUsage * 100;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate SEO readiness score
   */
  private calculateSeoReadiness(sectionData: any[]): number {
    let score = 100;

    // Check for SEO elements
    const seoElements = sectionData.reduce((acc, section) => {
      const html = section.html || '';
      let seoScore = 0;
      
      if (html.includes('<h1') || html.includes('<h2') || html.includes('<h3')) seoScore += 25;
      if (html.includes('alt=')) seoScore += 25;
      if (html.includes('<meta')) seoScore += 25;
      if (html.includes('title=') || html.includes('<title')) seoScore += 25;
      
      return acc + seoScore;
    }, 0) / sectionData.length;

    return Math.max(0, Math.min(100, Math.round(seoElements)));
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallScore(metrics: QualityMetric[]): number {
    const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0);
    const weightedScore = metrics.reduce((sum, metric) => sum + (metric.value * metric.weight), 0);
    
    return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  }

  /**
   * Calculate grade from score
   */
  private calculateGrade(score: number): QualityReport['grade'] {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'B+';
    if (score >= 87) return 'B';
    if (score >= 83) return 'C+';
    if (score >= 80) return 'C';
    if (score >= 70) return 'D';
    return 'F';
  }

  /**
   * Generate quality recommendations
   */
  private generateRecommendations(
    metrics: QualityMetric[],
    sectionBreakdown: SectionQuality[]
  ): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = [];

    metrics.forEach((metric, index) => {
      if (metric.value < metric.threshold.good) {
        const priority = metric.value < metric.threshold.poor ? 'high' : 'medium';
        const impact = metric.threshold.good - metric.value;

        recommendations.push({
          id: `rec_${index + 1}`,
          category: metric.category,
          priority,
          title: `Improve ${metric.name}`,
          description: this.getRecommendationDescription(metric),
          impact,
          effort: this.getEffortLevel(metric.category),
          actionable: true,
          autoFixable: metric.category === 'tailwind' || metric.category === 'html'
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Helper methods
   */
  private getRecommendationDescription(metric: QualityMetric): string {
    const descriptions: Record<string, string> = {
      'HTML Structure': 'Improve HTML validation and semantic structure',
      'Semantic HTML': 'Use more semantic HTML5 elements like header, nav, main, section',
      'Accessibility Score': 'Add ARIA labels, improve color contrast, and keyboard navigation',
      'ARIA Implementation': 'Implement proper ARIA attributes for better screen reader support',
      'Performance Score': 'Optimize CSS classes and reduce DOM complexity',
      'HubSpot Compliance': 'Ensure proper HubSpot module syntax and required patterns',
      'Tailwind Optimization': 'Use more Tailwind utility classes for better consistency',
      'SEO Readiness': 'Add proper heading structure, alt text, and meta information'
    };
    return descriptions[metric.name] || 'Improve this metric for better quality';
  }

  private getEffortLevel(category: string): 'low' | 'medium' | 'high' {
    const effortMap: Record<string, 'low' | 'medium' | 'high'> = {
      html: 'low',
      tailwind: 'low',
      seo: 'medium',
      performance: 'medium',
      accessibility: 'high',
      hubspot: 'medium'
    };
    return effortMap[category] || 'medium';
  }

  private calculateTrend(history: QualityHistoryPoint[], newValue: number): 'improving' | 'declining' | 'stable' {
    if (history.length < 2) return 'stable';
    
    const lastValue = history[history.length - 1].value;
    const difference = newValue - lastValue;
    
    if (Math.abs(difference) < 2) return 'stable';
    return difference > 0 ? 'improving' : 'declining';
  }

  private analyzeSectionQuality(sectionData: any[], validationResults: any[]): SectionQuality[] {
    return sectionData.map((section, index) => ({
      sectionId: section.id || `section_${index + 1}`,
      name: section.name || `Section ${index + 1}`,
      overallScore: section.qualityScore || 75,
      metrics: {
        html: this.calculateHtmlQuality([section], validationResults),
        accessibility: this.calculateAccessibilityQuality([section], validationResults),
        performance: this.calculatePerformanceQuality([section])
      },
      issues: validationResults.filter(r => r.sectionId === section.id).map(r => ({
        type: r.type,
        category: r.category,
        message: r.message,
        severity: r.severity,
        fixable: r.fixable,
        location: r.location
      })),
      strengths: this.identifyStrengths(section)
    }));
  }

  private identifyStrengths(section: any): string[] {
    const strengths: string[] = [];
    const html = section.html || '';

    if (html.includes('aria-')) strengths.push('Good ARIA implementation');
    if (html.includes('<h1') || html.includes('<h2')) strengths.push('Proper heading structure');
    if (html.includes('alt=')) strengths.push('Image alt text provided');
    if (html.includes('{{')) strengths.push('HubSpot template syntax used');
    if (html.match(/class="[^"]*\b(bg-|text-|p-|m-)/)) strengths.push('Tailwind classes utilized');

    return strengths;
  }

  private analyzeTrends(metrics: QualityMetric[]): QualityTrend[] {
    return metrics.map(metric => ({
      metric: metric.name,
      direction: metric.trend === 'improving' ? 'up' : metric.trend === 'declining' ? 'down' : 'stable',
      change: this.calculateChangePercentage(metric.history),
      period: '24h',
      significance: this.calculateSignificance(metric.history)
    }));
  }

  private calculateChangePercentage(history: QualityHistoryPoint[]): number {
    if (history.length < 2) return 0;
    
    const latest = history[history.length - 1].value;
    const previous = history[history.length - 2].value;
    
    return previous > 0 ? Math.round(((latest - previous) / previous) * 100) : 0;
  }

  private calculateSignificance(history: QualityHistoryPoint[]): 'major' | 'minor' | 'negligible' {
    const change = Math.abs(this.calculateChangePercentage(history));
    
    if (change >= 10) return 'major';
    if (change >= 5) return 'minor';
    return 'negligible';
  }

  private setupTrendAnalysis(): void {
    // Analyze global trends every hour
    setInterval(() => {
      this.analyzeGlobalTrends();
    }, 60 * 60 * 1000);
  }

  private analyzeGlobalTrends(): void {
    // Implementation for global trend analysis
    logger.debug('Analyzing global quality trends');
  }

  // Public API methods
  public getMetric(metricId: string): QualityMetric | undefined {
    return this.metrics.get(metricId);
  }

  public getAllMetrics(): QualityMetric[] {
    return Array.from(this.metrics.values());
  }

  public getReport(reportId: string): QualityReport | undefined {
    return this.reports.get(reportId);
  }

  public getRecentReports(limit: number = 10): QualityReport[] {
    return Array.from(this.reports.values())
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
      .slice(0, limit);
  }

  public getQualityTrends(period: '24h' | '7d' | '30d' = '24h'): QualityTrend[] {
    return this.globalTrends.get(period) || [];
  }
}

export default QualityMetricsDashboard;
