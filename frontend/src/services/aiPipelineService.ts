/**
 * AI-Enhanced Pipeline Service (Legacy Export)
 * 
 * This file has been refactored into a modular structure for better maintainability.
 * The original 860+ line monolithic service has been split into focused modules:
 * 
 * - ai/types.ts - Type definitions
 * - ai/fileUtils.ts - File conversion and validation
 * - ai/sectionDetection.ts - Lightweight section detection
 * - ai/progressTracking.ts - Phase progress management
 * - ai/aiAnalysis.ts - OpenAI Vision API integration
 * - ai/aiPipelineService.ts - Main pipeline orchestrator
 * 
 * This file now serves as a legacy export for backward compatibility.
 */

// Import the refactored modular service
import { aiPipelineService as refactoredService } from './ai';

// Re-export types for backward compatibility
export type {
  AIPhaseProgress,
  SplittingSuggestion,
  AIAnalysisResult,
  AIDetectedSection,
  AIEnhancedPipelineResult
} from './ai/types';

// Export the service instance
export const aiPipelineService = refactoredService;
export default aiPipelineService;
