/**
 * Frontend service for interacting with the modular pipeline backend
 * Provides comprehensive integration with the 5-phase pipeline architecture
 */

import { API_ENDPOINTS } from '../config/api';

// Pipeline Types (matching backend interfaces)
export interface PipelineExecutionResult {
  id: string;
  sections: PipelineSection[];
  qualityScore: number;
  processingTime: number;
  validationPassed: boolean;
  enhancementsApplied: string[];
  packagedModule: PackagedModule;
  metadata: PipelineMetadata;
}

export interface PipelineSection {
  id: string;
  name: string;
  type: 'header' | 'hero' | 'content' | 'footer' | 'sidebar' | 'navigation';
  html: string;
  editableFields: EditableField[];
  qualityScore?: number;
  validationStatus?: 'passed' | 'failed' | 'warning';
  enhancementSuggestions?: string[];
  originalImage?: string; // Base64 encoded original section image
  boundingBox?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface EditableField {
  id: string;
  name: string;
  type: 'text' | 'rich_text' | 'image' | 'url' | 'boolean';
  selector: string;
  defaultValue: string;
  required: boolean;
}

export interface PackagedModule {
  id: string;
  name: string;
  version: string;
  files: Record<string, string>;
  metadata: {
    created: string;
    size: number;
    format: string;
  };
}

export interface PipelineMetadata {
  phaseTimes: Record<string, number>;
  totalSections: number;
  averageQuality: number;
  timestamp: string;
  aiModelsUsed: string[];
  processingSteps: string[];
}

export interface PipelineStatus {
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentPhase: string;
  phases: PhaseStatus[];
  progress: number;
  estimatedTimeRemaining?: number;
}

export interface PhaseStatus {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  duration?: number;
  progress: number;
  message?: string;
}

export interface QualityMetrics {
  pipelineId: string;
  overallQuality: number;
  metrics: {
    htmlValidity: number;
    accessibilityScore: number;
    responsiveDesign: number;
    codeQuality: number;
    hubspotCompliance: number;
    performanceScore: number;
  };
  sectionQuality: Record<string, number>;
  recommendations: string[];
  validationErrors: string[];
}

export interface SupportedTypesResponse {
  supportedTypes: string[];
  maxFileSize: number;
  recommendations: string[];
  qualityGuidelines: string[];
}



/**
 * Main Pipeline Service Class
 */
export class PipelineService {
  private static instance: PipelineService;

  public static getInstance(): PipelineService {
    if (!PipelineService.instance) {
      PipelineService.instance = new PipelineService();
    }
    return PipelineService.instance;
  }

  /**
   * Execute the complete 5-phase pipeline
   */
  async executePipeline(designFile: File): Promise<PipelineExecutionResult> {
    const formData = new FormData();
    formData.append('design', designFile);

    const response = await fetch(API_ENDPOINTS.PIPELINE_EXECUTE, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new PipelineError({
        code: `HTTP_${response.status}`,
        message: errorData.error || `Pipeline execution failed: ${response.statusText}`,
        details: errorData,
        timestamp: new Date().toISOString()
      });
    }

    const result = await response.json();
    if (!result.success) {
      throw new PipelineError({
        code: result.code || 'PIPELINE_ERROR',
        message: result.error || 'Pipeline execution failed',
        details: result,
        timestamp: new Date().toISOString()
      });
    }

    return result.data;
  }

  /**
   * Get pipeline execution status
   */
  async getPipelineStatus(pipelineId: string): Promise<PipelineStatus> {
    const response = await fetch(`${API_ENDPOINTS.PIPELINE_STATUS}/${pipelineId}`);
    
    if (!response.ok) {
      throw new PipelineError({
        code: `HTTP_${response.status}`,
        message: `Failed to get pipeline status: ${response.statusText}`,
        timestamp: new Date().toISOString()
      });
    }

    const result = await response.json();
    if (!result.success) {
      throw new PipelineError({
        code: result.code || 'STATUS_ERROR',
        message: result.error || 'Failed to get pipeline status',
        details: result,
        timestamp: new Date().toISOString()
      });
    }

    return result.data;
  }

  /**
   * Get quality metrics for a pipeline execution
   */
  async getQualityMetrics(pipelineId: string): Promise<QualityMetrics> {
    const response = await fetch(`${API_ENDPOINTS.PIPELINE_QUALITY}/${pipelineId}`);
    
    if (!response.ok) {
      throw new PipelineError({
        code: `HTTP_${response.status}`,
        message: `Failed to get quality metrics: ${response.statusText}`,
        timestamp: new Date().toISOString()
      });
    }

    const result = await response.json();
    if (!result.success) {
      throw new PipelineError({
        code: result.code || 'QUALITY_ERROR',
        message: result.error || 'Failed to get quality metrics',
        details: result,
        timestamp: new Date().toISOString()
      });
    }

    return result.data;
  }

  /**
   * Enhance a specific section
   */
  async enhanceSection(sectionId: string, enhancementType: string): Promise<PipelineSection> {
    const response = await fetch(`${API_ENDPOINTS.PIPELINE_ENHANCE}/${sectionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enhancementType }),
    });

    if (!response.ok) {
      throw new PipelineError({
        code: `HTTP_${response.status}`,
        message: `Failed to enhance section: ${response.statusText}`,
        timestamp: new Date().toISOString()
      });
    }

    const result = await response.json();
    if (!result.success) {
      throw new PipelineError({
        code: result.code || 'ENHANCEMENT_ERROR',
        message: result.error || 'Failed to enhance section',
        details: result,
        timestamp: new Date().toISOString()
      });
    }

    return result.data;
  }

  /**
   * Regenerate HTML for a specific section using OpenAI
   */
  async regenerateHTML(sectionId: string, originalImage?: string, customPrompt?: string): Promise<PipelineSection> {
    const response = await fetch(API_ENDPOINTS.PIPELINE_REGENERATE_HTML, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        sectionId, 
        originalImage,
        customPrompt 
      }),
    });

    if (!response.ok) {
      throw new PipelineError({
        code: `HTTP_${response.status}`,
        message: `Failed to regenerate HTML: ${response.statusText}`,
        timestamp: new Date().toISOString()
      });
    }

    const result = await response.json();
    if (!result.success) {
      throw new PipelineError({
        code: result.code || 'REGENERATE_ERROR',
        message: result.error || 'Failed to regenerate HTML',
        details: result,
        timestamp: new Date().toISOString()
      });
    }

    return result.data;
  }

  /**
   * Get supported file types and guidelines
   */
  async getSupportedTypes(): Promise<SupportedTypesResponse> {
    const response = await fetch(API_ENDPOINTS.PIPELINE_SUPPORTED_TYPES);
    
    if (!response.ok) {
      throw new PipelineError({
        code: `HTTP_${response.status}`,
        message: `Failed to get supported types: ${response.statusText}`,
        timestamp: new Date().toISOString()
      });
    }

    const result = await response.json();
    if (!result.success) {
      throw new PipelineError({
        code: result.code || 'TYPES_ERROR',
        message: result.error || 'Failed to get supported types',
        details: result,
        timestamp: new Date().toISOString()
      });
    }

    return result.data;
  }

  /**
   * Poll pipeline status until completion
   */
  async pollPipelineStatus(
    pipelineId: string,
    onProgress?: (status: PipelineStatus) => void,
    pollInterval: number = 2000,
    maxAttempts: number = 150 // 5 minutes max
  ): Promise<PipelineStatus> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const status = await this.getPipelineStatus(pipelineId);
        
        if (onProgress) {
          onProgress(status);
        }

        if (status.status === 'completed' || status.status === 'failed') {
          return status;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new PipelineError({
      code: 'TIMEOUT',
      message: 'Pipeline status polling timed out',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Execute pipeline with real-time progress tracking
   */
  async executePipelineWithProgress(
    designFile: File,
    onProgress?: (status: PipelineStatus) => void
  ): Promise<PipelineExecutionResult> {
    // Start pipeline execution
    const result = await this.executePipeline(designFile);
    
    // If we have a pipeline ID, poll for detailed progress
    if (result.id && onProgress) {
      try {
        await this.pollPipelineStatus(result.id, onProgress);
      } catch (error) {
        // Don't fail the entire operation if progress polling fails
        console.warn('Progress polling failed:', error);
      }
    }

    return result;
  }
}

// Custom error class for pipeline operations
class PipelineError extends Error {
  public code: string;
  public details?: any;
  public phase?: string;
  public timestamp: string;

  constructor(error: { code: string; message: string; details?: any; phase?: string; timestamp: string }) {
    super(error.message);
    this.name = 'PipelineError';
    this.code = error.code;
    this.details = error.details;
    this.phase = error.phase;
    this.timestamp = error.timestamp;
  }
}

// Export singleton instance
export const pipelineService = PipelineService.getInstance();
export default pipelineService;
