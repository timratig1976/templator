/**
 * Layout Splitting Frontend Service
 * Handles large layout file splitting and sequential processing
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface LayoutSection {
  id: string;
  type: 'header' | 'hero' | 'content' | 'sidebar' | 'footer' | 'navigation' | 'feature' | 'testimonial' | 'contact' | 'gallery' | 'unknown';
  html: string;
  title: string;
  description: string;
  complexity: 'low' | 'medium' | 'high';
  estimatedFields: number;
  dependencies: string[];
  priority: number;
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

export interface ProcessedSection {
  section: LayoutSection;
  moduleData: {
    fields: any[];
    meta: any;
    html: string;
    css?: string;
  };
  validationResult: {
    isValid: boolean;
    score: number;
    issues: any[];
    fixedIssues: any[];
  };
  processingTime: number;
  refinementIterations: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  error?: string;
}

export interface ProcessingBatch {
  id: string;
  sections: LayoutSection[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  processedSections: ProcessedSection[];
  totalProcessingTime: number;
  averageQualityScore: number;
}

export interface ProcessingResult {
  batches: ProcessingBatch[];
  totalSections: number;
  processedSections: number;
  failedSections: number;
  skippedSections: number;
  overallQualityScore: number;
  totalProcessingTime: number;
  combinedModule?: {
    fields: any[];
    meta: any;
    html: string;
    css: string;
  };
}

export interface SplittingOptions {
  maxSectionSize?: number;
  minSectionSize?: number;
  preserveStructure?: boolean;
  detectComponents?: boolean;
  splitStrategy?: 'semantic' | 'size' | 'hybrid';
  maxSections?: number;
}

export interface ProcessingOptions {
  batchSize?: number;
  maxRetries?: number;
  skipFailedSections?: boolean;
  combineResults?: boolean;
  qualityThreshold?: number;
  timeoutPerSection?: number;
  enableRefinement?: boolean;
  enableAutoCorrection?: boolean;
}

export interface LayoutAnalysis {
  fileSize: number;
  fileSizeFormatted: string;
  shouldSplit: boolean;
  recommendation: string;
  estimatedSections: number;
  estimatedProcessingTime: number;
  estimatedProcessingTimeFormatted: string;
  qualityBenefit: string;
  complexity: string;
}

class LayoutSplittingService {
  private static instance: LayoutSplittingService;

  public static getInstance(): LayoutSplittingService {
    if (!LayoutSplittingService.instance) {
      LayoutSplittingService.instance = new LayoutSplittingService();
    }
    return LayoutSplittingService.instance;
  }

  /**
   * Split a large layout file into manageable sections
   */
  async splitLayout(html: string, options: SplittingOptions = {}): Promise<SplittingResult> {
    const response = await fetch(`${API_BASE_URL}/api/layout/split`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html,
        options
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to split layout');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Process a layout by splitting and processing all sections
   */
  async processLayout(
    html: string,
    splittingOptions: SplittingOptions = {},
    processingOptions: ProcessingOptions = {}
  ): Promise<{ splitting: SplittingResult; processing: ProcessingResult }> {
    const response = await fetch(`${API_BASE_URL}/api/layout/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html,
        splittingOptions,
        processingOptions
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to process layout');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Process pre-split sections
   */
  async processSections(
    splittingResult: SplittingResult,
    processingOptions: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const response = await fetch(`${API_BASE_URL}/api/layout/process-sections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...splittingResult,
        processingOptions
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to process sections');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Analyze if a layout should be split based on size
   */
  async analyzeLayout(size: number): Promise<LayoutAnalysis> {
    const response = await fetch(`${API_BASE_URL}/api/layout/analyze/${size}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to analyze layout');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Get processing status for a batch
   */
  async getProcessingStatus(batchId: string): Promise<ProcessingBatch | null> {
    const response = await fetch(`${API_BASE_URL}/api/layout/status/${batchId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.json();
      throw new Error(error.message || 'Failed to get processing status');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Cancel processing for a batch
   */
  async cancelProcessing(batchId: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/api/layout/cancel/${batchId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to cancel processing');
    }

    const result = await response.json();
    return result.data.cancelled;
  }

  /**
   * Get example configurations for different layout sizes
   */
  async getExampleConfigurations(): Promise<Record<string, any>> {
    const response = await fetch(`${API_BASE_URL}/api/layout/examples`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get example configurations');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Estimate file size from HTML content
   */
  estimateFileSize(html: string): number {
    return new Blob([html]).size;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format processing time for display
   */
  formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  /**
   * Get complexity color for UI display
   */
  getComplexityColor(complexity: string): string {
    switch (complexity.toLowerCase()) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }

  /**
   * Get section type icon
   */
  getSectionTypeIcon(type: string): string {
    switch (type) {
      case 'header': return '🏠';
      case 'hero': return '🌟';
      case 'navigation': return '🧭';
      case 'content': return '📄';
      case 'feature': return '⭐';
      case 'testimonial': return '💬';
      case 'contact': return '📞';
      case 'gallery': return '🖼️';
      case 'sidebar': return '📋';
      case 'footer': return '🔗';
      default: return '📦';
    }
  }

  /**
   * Get processing status color
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'processing': return 'text-blue-600';
      case 'failed': return 'text-red-600';
      case 'skipped': return 'text-yellow-600';
      case 'pending': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  }

  /**
   * Calculate quality score color
   */
  getQualityScoreColor(score: number): string {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  }

  /**
   * Get recommended configuration based on file size
   */
  getRecommendedConfiguration(size: number): { splitting: SplittingOptions; processing: ProcessingOptions } {
    const SMALL_LAYOUT = 10000; // 10KB
    const MEDIUM_LAYOUT = 50000; // 50KB
    const LARGE_LAYOUT = 150000; // 150KB

    if (size < SMALL_LAYOUT) {
      return {
        splitting: {
          maxSectionSize: 50000,
          minSectionSize: 1000,
          splitStrategy: 'semantic'
        },
        processing: {
          batchSize: 1,
          qualityThreshold: 80,
          enableRefinement: true,
          enableAutoCorrection: true
        }
      };
    } else if (size < MEDIUM_LAYOUT) {
      return {
        splitting: {
          maxSectionSize: 30000,
          minSectionSize: 2000,
          splitStrategy: 'hybrid',
          maxSections: 5
        },
        processing: {
          batchSize: 2,
          qualityThreshold: 85,
          enableRefinement: true,
          enableAutoCorrection: true
        }
      };
    } else if (size < LARGE_LAYOUT) {
      return {
        splitting: {
          maxSectionSize: 25000,
          minSectionSize: 1500,
          splitStrategy: 'hybrid',
          maxSections: 10
        },
        processing: {
          batchSize: 3,
          qualityThreshold: 75,
          enableRefinement: true,
          enableAutoCorrection: true,
          skipFailedSections: true
        }
      };
    } else {
      return {
        splitting: {
          maxSectionSize: 20000,
          minSectionSize: 1000,
          splitStrategy: 'size',
          maxSections: 20
        },
        processing: {
          batchSize: 2,
          qualityThreshold: 70,
          enableRefinement: true,
          enableAutoCorrection: true,
          skipFailedSections: true,
          timeoutPerSection: 180
        }
      };
    }
  }
}

export const layoutSplittingService = LayoutSplittingService.getInstance();
export default layoutSplittingService;
