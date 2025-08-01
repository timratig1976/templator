/**
 * Hybrid Layout Service
 * Handles API calls for hybrid AI + user-driven layout splitting
 */

import { API_BASE_URL } from '../config/api';

export interface HybridSection {
  id: string;
  name: string;
  type: 'header' | 'hero' | 'content' | 'footer' | 'sidebar' | 'navigation' | 'feature' | 'testimonial' | 'contact' | 'gallery' | 'unknown';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  html: string;
  editableFields: any[];
  aiConfidence: number;
  detectionReason: string;
  suggestedImprovements?: string[];
}

export interface HybridAnalysisResult {
  enhancedAnalysis: {
    sections: HybridSection[];
    imageMetadata: {
      width: number;
      height: number;
      aspectRatio: number;
      complexity: 'low' | 'medium' | 'high';
    };
    detectionMetrics: {
      totalSectionsDetected: number;
      averageConfidence: number;
      processingTime: number;
      aiModel: string;
    };
    recommendations: {
      suggestedAdjustments: string[];
      qualityScore: number;
      improvementTips: string[];
    };
  };
  hybridSections: HybridSection[];
  imageMetadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    dimensions: {
      width: number;
      height: number;
      aspectRatio: number;
      complexity: 'low' | 'medium' | 'high';
    };
  };
  aiAnalysis: {
    sectionsDetected: number;
    averageConfidence: number;
    qualityScore: number;
    processingTime: number;
  };
}

export interface HybridGenerationResult {
  analysis: {
    html: string;
    sections: any[];
    components: any[];
    description: string;
  };
  userModifications: {
    sectionsAdded: number;
    sectionsRemoved: number;
    sectionsModified: number;
    positionsChanged: number;
    typesChanged: number;
  };
  qualityScore: number;
}

class HybridLayoutService {
  private static instance: HybridLayoutService;

  public static getInstance(): HybridLayoutService {
    if (!HybridLayoutService.instance) {
      HybridLayoutService.instance = new HybridLayoutService();
    }
    return HybridLayoutService.instance;
  }

  /**
   * Analyze image with OpenAI Vision for initial section detection
   */
  async analyzeLayout(imageFile: File): Promise<HybridAnalysisResult> {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await fetch(`${API_BASE_URL}/api/hybrid-layout/analyze`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Analysis failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Analysis failed');
    }

    return result.data;
  }

  /**
   * Generate HTML from user-confirmed sections
   */
  async generateHTML(sections: HybridSection[], imageMetadata: any): Promise<HybridGenerationResult> {
    const response = await fetch(`${API_BASE_URL}/api/hybrid-layout/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sections,
        imageMetadata
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTML generation failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'HTML generation failed');
    }

    return result.data;
  }

  /**
   * Submit user feedback for AI improvement
   */
  async submitFeedback(
    originalSections: HybridSection[], 
    finalSections: HybridSection[], 
    satisfactionScore: number, 
    comments?: string
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/hybrid-layout/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        originalSections,
        finalSections,
        satisfactionScore,
        comments
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Feedback submission failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Feedback submission failed');
    }
  }

  /**
   * Validate hybrid sections before processing
   */
  validateSections(sections: HybridSection[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!sections || sections.length === 0) {
      errors.push('At least one section is required');
      return { isValid: false, errors };
    }

    sections.forEach((section, index) => {
      if (!section.id) {
        errors.push(`Section ${index + 1}: Missing ID`);
      }
      if (!section.name || section.name.trim() === '') {
        errors.push(`Section ${index + 1}: Missing name`);
      }
      if (!section.type) {
        errors.push(`Section ${index + 1}: Missing type`);
      }
      if (!section.bounds || typeof section.bounds.x !== 'number' || typeof section.bounds.y !== 'number') {
        errors.push(`Section ${index + 1}: Invalid bounds`);
      }
      if (section.bounds.width <= 0 || section.bounds.height <= 0) {
        errors.push(`Section ${index + 1}: Invalid dimensions`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Calculate user modifications compared to AI suggestions
   */
  calculateModifications(originalSections: HybridSection[], finalSections: HybridSection[]) {
    const originalIds = new Set(originalSections.map(s => s.id));
    const finalIds = new Set(finalSections.map(s => s.id));
    
    const sectionsAdded = finalSections.filter(s => !originalIds.has(s.id)).length;
    const sectionsRemoved = originalSections.filter(s => !finalIds.has(s.id)).length;
    
    let sectionsModified = 0;
    let positionsChanged = 0;
    let typesChanged = 0;
    
    finalSections.forEach(finalSection => {
      const originalSection = originalSections.find(s => s.id === finalSection.id);
      if (originalSection) {
        // Check for modifications
        if (originalSection.html !== finalSection.html || 
            originalSection.name !== finalSection.name) {
          sectionsModified++;
        }
        
        // Check for position changes
        if (originalSection.bounds.x !== finalSection.bounds.x || 
            originalSection.bounds.y !== finalSection.bounds.y) {
          positionsChanged++;
        }
        
        // Check for type changes
        if (originalSection.type !== finalSection.type) {
          typesChanged++;
        }
      }
    });

    return {
      sectionsAdded,
      sectionsRemoved,
      sectionsModified,
      positionsChanged,
      typesChanged
    };
  }
}

export const hybridLayoutService = HybridLayoutService.getInstance();
export default hybridLayoutService;
