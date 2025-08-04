/**
 * Section Detection Service
 * Handles lightweight section detection and splitting suggestions
 */

import { aiLogger } from '../aiLogger';
import { fileToBase64 } from './fileUtils';
import type { SplittingSuggestion } from './types';

/**
 * Perform lightweight section detection for splitting suggestions
 */
export async function performLightweightSectionDetection(designFile: File): Promise<SplittingSuggestion[]> {
  const requestId = `section_detection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    aiLogger.info('processing', 'Starting lightweight section detection', { fileName: designFile.name, requestId });
    
    // Step 1: Convert to base64 for analysis
    const base64Image = await fileToBase64(designFile);
    
    aiLogger.info('processing', 'Sending request for section detection', {
      endpoint: 'http://localhost:3009/api/ai-enhancement/detect-sections',
      requestId
    });
    
    // Step 2: Call lightweight section detection endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      aiLogger.error('processing', 'Section detection timeout', { requestId, timeout: '30 seconds' });
    }, 30000); // Much shorter timeout for quick detection
    
    const response = await fetch('http://localhost:3009/api/ai-enhancement/detect-sections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        fileName: designFile.name,
        requestId: requestId,
        analysisType: 'lightweight' // Quick detection only
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle error response (reuse existing error handling logic)
      aiLogger.error('processing', 'Section detection API error', {
        requestId,
        status: response.status,
        statusText: response.statusText
      });
      
      // Fall back to basic grid-based suggestions
      return generateBasicSplittingSuggestions(designFile);
    }

    const result = await response.json();
    
    aiLogger.success('processing', 'Section detection completed', {
      sectionsDetected: result.suggestions?.length || 0,
      requestId
    });

    return result.suggestions || generateBasicSplittingSuggestions(designFile);
    
  } catch (error) {
    aiLogger.error('processing', 'Section detection failed, using fallback', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Fallback to basic suggestions if detection fails
    return generateBasicSplittingSuggestions(designFile);
  }
}

/**
 * Generate basic splitting suggestions as fallback
 */
export function generateBasicSplittingSuggestions(designFile: File): SplittingSuggestion[] {
  aiLogger.info('processing', 'Generating basic splitting suggestions', { fileName: designFile.name });
  
  // Create basic grid-based suggestions
  return [
    {
      id: 'header-section',
      name: 'Header Section',
      type: 'header',
      bounds: { x: 0, y: 0, width: 100, height: 15 }, // Percentage-based
      confidence: 0.8,
      description: 'Top navigation and branding area',
      suggested: true
    },
    {
      id: 'hero-section',
      name: 'Hero Section',
      type: 'hero',
      bounds: { x: 0, y: 15, width: 100, height: 35 },
      confidence: 0.7,
      description: 'Main banner or hero content area',
      suggested: true
    },
    {
      id: 'content-section',
      name: 'Main Content',
      type: 'content',
      bounds: { x: 0, y: 50, width: 100, height: 40 },
      confidence: 0.9,
      description: 'Primary content area',
      suggested: true
    },
    {
      id: 'footer-section',
      name: 'Footer Section',
      type: 'footer',
      bounds: { x: 0, y: 90, width: 100, height: 10 },
      confidence: 0.8,
      description: 'Footer links and information',
      suggested: true
    }
  ];
}

/**
 * Validate splitting suggestions
 */
export function validateSplittingSuggestions(suggestions: SplittingSuggestion[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for overlapping sections
  for (let i = 0; i < suggestions.length; i++) {
    for (let j = i + 1; j < suggestions.length; j++) {
      const a = suggestions[i].bounds;
      const b = suggestions[j].bounds;
      
      // Check if rectangles overlap
      if (!(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)) {
        errors.push(`Sections "${suggestions[i].name}" and "${suggestions[j].name}" overlap`);
      }
    }
  }
  
  // Check bounds are within 0-100 range
  suggestions.forEach(suggestion => {
    const { bounds } = suggestion;
    if (bounds.x < 0 || bounds.x > 100 || bounds.y < 0 || bounds.y > 100 ||
        bounds.width <= 0 || bounds.width > 100 || bounds.height <= 0 || bounds.height > 100) {
      errors.push(`Section "${suggestion.name}" has invalid bounds`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}
