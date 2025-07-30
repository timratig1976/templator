/**
 * Core pipeline types and interfaces for the 5-phase architecture
 */

// Input types for each phase
export interface DesignFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface ProcessedInput {
  pipelineId: string;
  imageBase64: string;
  complexity: DesignComplexity;
  sections: DesignSection[];
  metadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    processingTime: number;
  };
}

export interface GeneratedSections {
  sections: GeneratedSection[];
  overallQuality: number;
  totalProcessingTime: number;
  metadata: {
    sectionsDetected: number;
    averageQuality: number;
    aiModelUsed: string;
  };
}

export interface ValidatedSections {
  sections: ValidatedSection[];
  overallValidation: ValidationSummary;
  qualityMetrics: QualityMetrics;
  recommendations: string[];
}

export interface EnhancedSections {
  sections: EnhancedSection[];
  enhancementsApplied: EnhancementSummary[];
  finalQuality: number;
  iterationsPerformed: number;
}

export interface PackagedModule {
  moduleId: string;
  packageResult: any; // From ModulePackagingService
  finalHTML: string;
  metadata: ModuleMetadata;
  exportFormat: 'hubspot' | 'zip' | 'json';
}

// Core data structures
export interface DesignSection {
  /**
   * Optional base64-encoded PNG/JPEG screenshot for this section
   */
  originalImage?: string;
  id: string;
  name: string;
  type: 'header' | 'hero' | 'content' | 'features' | 'footer' | 'navigation' | 'sidebar';
  imageData?: string;
  bounds: { x: number; y: number; width: number; height: number };
  complexity: number;
  estimatedElements: number;
}

export interface GeneratedSection {
  id: string;
  name: string;
  type: string;
  html: string;
  editableFields: EditableField[];
  qualityScore: number;
  issues: QualityIssue[];
  aiMetadata?: {
    model: string;
    tokensUsed: number;
    confidence: number;
  };
}

export interface ValidatedSection extends GeneratedSection {
  validationResult: {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
    suggestions: string[];
    complianceScore: number;
  };
  qualityMetrics: {
    htmlStructure: number;
    accessibility: number;
    tailwindUsage: number;
    hubspotCompliance: number;
  };
}

export interface EnhancedSection extends ValidatedSection {
  enhancements: {
    applied: Enhancement[];
    qualityImprovement: number;
    iterationsUsed: number;
  };
  finalHtml: string;
  finalQuality: number;
}

export interface EditableField {
  id: string;
  name: string;
  type: 'text' | 'rich_text' | 'image' | 'url' | 'boolean';
  selector: string;
  defaultValue: string;
  required: boolean;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

export interface QualityIssue {
  type: 'error' | 'warning' | 'suggestion';
  category: 'html' | 'accessibility' | 'tailwind' | 'hubspot' | 'performance';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fixable: boolean;
  suggestion?: string;
}

export interface ValidationError {
  type: any; // ValidationSeverity enum
  category: any; // ValidationCategory enum  
  code: string;
  message: string;
  fix: string;
  file?: string;
  line?: number;
  column?: number;
}

// Quality and metrics types
export interface DesignComplexity {
  sizeKB: number;
  recommendedSections: number;
  estimatedComplexity: 'low' | 'medium' | 'high';
  processingHints: string[];
}

export interface QualityMetrics {
  overall: number;
  htmlStructure: number;
  accessibility: number;
  tailwindOptimization: number;
  hubspotCompliance: number;
  editability: number;
  performance: number;
}

export interface ValidationSummary {
  isValid: boolean;
  overallScore: number;
  criticalErrors: number;
  warnings: number;
  suggestions: number;
  complianceLevel: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface Enhancement {
  type: 'quality' | 'accessibility' | 'performance' | 'styling';
  description: string;
  applied: boolean;
  impact: number; // Quality score improvement
  processingTime: number;
}

export interface EnhancementSummary {
  sectionId: string;
  enhancementsApplied: Enhancement[];
  qualityBefore: number;
  qualityAfter: number;
  totalImprovement: number;
}

export interface ModuleMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  created: string;
  totalSections: number;
  averageQuality: number;
  processingTime: number;
  aiModelsUsed: string[];
}

// Pipeline execution types
export interface PipelineExecutionResult {
  id: string;
  sections: EnhancedSection[];
  qualityScore: number;
  processingTime: number;
  validationPassed: boolean;
  enhancementsApplied: EnhancementSummary[];
  packagedModule?: PackagedModule;
  metadata: {
    phaseTimes: Record<string, number>;
    totalSections: number;
    averageQuality: number;
    warningsCount: number;
    timestamp: string;
  };
}

export interface PipelineOptions {
  enableEnhancement: boolean;
  qualityThreshold: number;
  maxIterations: number;
  fallbackOnError: boolean;
  exportFormat: 'hubspot' | 'zip' | 'json';
  customizations?: {
    skipPhases?: string[];
    phaseOptions?: Record<string, any>;
  };
}

// Error types
export type PipelineErrorCode = 
  | 'PHASE1_ERROR' 
  | 'PHASE2_ERROR' 
  | 'PHASE3_ERROR' 
  | 'PHASE4_ERROR' 
  | 'PHASE5_ERROR'
  | 'ORCHESTRATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'SERVICE_ERROR';

export interface PipelineError extends Error {
  code: PipelineErrorCode;
  phase?: string;
  pipelineId?: string;
  recoverable: boolean;
  context?: Record<string, any>;
}
