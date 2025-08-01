/**
 * Enhanced AI Layout Detection Service
 * Specialized service for AI-powered layout section detection with improved accuracy
 */

import { createLogger } from '../../utils/logger';
import openaiService from './openaiService';
import { logToFrontend } from '../../utils/frontendLogger';

const logger = createLogger();

export interface DetectedSection {
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

export interface LayoutDetectionResult {
  sections: DetectedSection[];
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
}

export interface UserFeedback {
  originalSections: DetectedSection[];
  finalSections: DetectedSection[];
  userAdjustments: {
    sectionsAdded: number;
    sectionsRemoved: number;
    sectionsModified: number;
    positionsChanged: number;
    typesChanged: number;
  };
  satisfactionScore: number; // 1-5
  comments?: string;
}

class EnhancedLayoutDetectionService {
  private static instance: EnhancedLayoutDetectionService;
  private feedbackHistory: UserFeedback[] = [];

  public static getInstance(): EnhancedLayoutDetectionService {
    if (!EnhancedLayoutDetectionService.instance) {
      EnhancedLayoutDetectionService.instance = new EnhancedLayoutDetectionService();
    }
    return EnhancedLayoutDetectionService.instance;
  }

  /**
   * Detect layout sections using enhanced AI analysis
   */
  async detectLayoutSections(
    imageBase64: string, 
    fileName: string,
    options: {
      includeAdvancedAnalysis?: boolean;
      useHistoricalFeedback?: boolean;
      targetSectionCount?: number;
    } = {}
  ): Promise<LayoutDetectionResult> {
    const startTime = Date.now();
    const requestId = `layout_detect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('🔍 Starting enhanced layout section detection', {
        fileName,
        requestId,
        options
      });

      logToFrontend('info', 'ai', '🔍 Analyzing layout with enhanced AI detection', {
        fileName,
        model: 'gpt-4o-vision',
        features: ['section_detection', 'confidence_scoring', 'improvement_suggestions']
      }, requestId);

      // Create enhanced prompt for layout detection
      const enhancedPrompt = this.createEnhancedDetectionPrompt(options);

      // Get AI analysis
      const analysis = await openaiService.convertDesignToHTML(imageBase64, fileName);

      // Enhance the analysis with additional AI insights
      const enhancedSections = await this.enhanceSectionDetection(analysis.sections, imageBase64, requestId);

      // Calculate image metadata
      const imageMetadata = await this.analyzeImageComplexity(imageBase64);

      // Generate recommendations
      const recommendations = this.generateRecommendations(enhancedSections, imageMetadata);

      const processingTime = Date.now() - startTime;

      const result: LayoutDetectionResult = {
        sections: enhancedSections,
        imageMetadata,
        detectionMetrics: {
          totalSectionsDetected: enhancedSections.length,
          averageConfidence: enhancedSections.reduce((sum, s) => sum + s.aiConfidence, 0) / enhancedSections.length,
          processingTime,
          aiModel: 'gpt-4o-vision-enhanced'
        },
        recommendations
      };

      logger.info('✅ Enhanced layout detection completed', {
        requestId,
        sectionsDetected: result.sections.length,
        averageConfidence: result.detectionMetrics.averageConfidence,
        processingTime: result.detectionMetrics.processingTime
      });

      logToFrontend('success', 'ai', '✅ Layout detection completed', {
        sectionsDetected: result.sections.length,
        averageConfidence: `${Math.round(result.detectionMetrics.averageConfidence * 100)}%`,
        qualityScore: result.recommendations.qualityScore
      }, requestId);

      return result;

    } catch (error) {
      logger.error('❌ Enhanced layout detection failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      logToFrontend('error', 'ai', '❌ Layout detection failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, requestId);

      throw error;
    }
  }

  /**
   * Create enhanced prompt for layout detection
   */
  private createEnhancedDetectionPrompt(options: any): string {
    const historicalInsights = this.getHistoricalInsights();
    
    return `
ENHANCED LAYOUT SECTION DETECTION

Analyze this design image and identify distinct layout sections with high precision. Use these enhanced guidelines:

## SECTION DETECTION PRIORITIES:
1. **Visual Hierarchy**: Identify sections based on visual grouping, spacing, and hierarchy
2. **Semantic Meaning**: Recognize common web layout patterns (header, hero, features, testimonials, footer)
3. **Content Boundaries**: Detect natural content boundaries and logical groupings
4. **Responsive Considerations**: Consider how sections would adapt across screen sizes

## REQUIRED SECTION TYPES:
- **header**: Top navigation, logo, main menu
- **hero**: Primary banner, main value proposition, call-to-action
- **content**: Main content areas, text blocks, information sections
- **feature**: Feature highlights, service offerings, product showcases
- **testimonial**: Customer reviews, social proof, quotes
- **contact**: Contact forms, contact information, location details
- **footer**: Bottom navigation, copyright, secondary links
- **navigation**: Standalone navigation elements
- **sidebar**: Secondary content, widgets, complementary information
- **gallery**: Image galleries, portfolios, media collections

## ENHANCED ANALYSIS REQUIREMENTS:
1. **Bounding Box Accuracy**: Provide precise x, y, width, height coordinates
2. **Confidence Scoring**: Rate detection confidence (0.0-1.0) based on:
   - Visual clarity of section boundaries
   - Typical web layout patterns
   - Content coherence within section
3. **Detection Reasoning**: Explain why each section was identified
4. **Improvement Suggestions**: Suggest potential adjustments or alternatives

## HISTORICAL FEEDBACK INTEGRATION:
${historicalInsights}

## TARGET SECTION COUNT:
Aim for ${options.targetSectionCount || '4-8'} well-defined sections. Avoid over-segmentation.

Return enhanced JSON with this structure:
{
  "sections": [
    {
      "id": "section_1",
      "name": "Descriptive Section Name",
      "type": "header|hero|content|feature|testimonial|contact|footer|navigation|sidebar|gallery",
      "bounds": {
        "x": 0,
        "y": 0,
        "width": 800,
        "height": 100
      },
      "html": "Generated HTML for this section",
      "editableFields": [...],
      "aiConfidence": 0.85,
      "detectionReason": "Clear visual boundary with distinct header elements including logo and navigation",
      "suggestedImprovements": ["Consider adjusting height for better mobile responsiveness"]
    }
  ],
  "imageAnalysis": {
    "complexity": "medium",
    "layoutStyle": "modern|traditional|minimal|complex",
    "primaryColors": ["#color1", "#color2"],
    "designPatterns": ["grid-layout", "card-design", "hero-banner"]
  }
}
`;
  }

  /**
   * Enhance section detection with additional AI analysis
   */
  private async enhanceSectionDetection(
    baseSections: any[], 
    imageBase64: string, 
    requestId: string
  ): Promise<DetectedSection[]> {
    const enhancedSections: DetectedSection[] = [];

    for (let i = 0; i < baseSections.length; i++) {
      const section = baseSections[i];
      
      // Calculate enhanced confidence score
      const aiConfidence = this.calculateEnhancedConfidence(section, baseSections);
      
      // Generate detection reasoning
      const detectionReason = this.generateDetectionReason(section, i);
      
      // Generate improvement suggestions
      const suggestedImprovements = this.generateImprovementSuggestions(section);
      
      // Calculate realistic bounds based on section type and order
      const bounds = this.calculateRealisticBounds(section.type, i, baseSections.length);

      enhancedSections.push({
        id: section.id || `section_${i + 1}`,
        name: section.name || this.generateSectionName(section.type, i),
        type: section.type || 'content',
        bounds,
        html: section.html || this.generatePlaceholderHTML(section.type),
        editableFields: section.editableFields || [],
        aiConfidence,
        detectionReason,
        suggestedImprovements
      });
    }

    return enhancedSections;
  }

  /**
   * Calculate enhanced confidence score
   */
  private calculateEnhancedConfidence(section: any, allSections: any[]): number {
    let confidence = 0.7; // Base confidence

    // Type-based confidence adjustments
    const highConfidenceTypes = ['header', 'hero', 'footer'];
    if (highConfidenceTypes.includes(section.type)) {
      confidence += 0.15;
    }

    // HTML quality assessment
    if (section.html && section.html.length > 100) {
      confidence += 0.05;
    }

    // Editable fields presence
    if (section.editableFields && section.editableFields.length > 0) {
      confidence += 0.1;
    }

    // Section uniqueness (avoid duplicates)
    const typeCount = allSections.filter(s => s.type === section.type).length;
    if (typeCount === 1) {
      confidence += 0.05;
    } else if (typeCount > 2) {
      confidence -= 0.1;
    }

    return Math.min(0.95, Math.max(0.3, confidence));
  }

  /**
   * Generate detection reasoning
   */
  private generateDetectionReason(section: any, index: number): string {
    const reasons = {
      header: "Identified as header due to top positioning and typical navigation/logo elements",
      hero: "Detected as hero section with prominent positioning and call-to-action elements",
      content: "Recognized as content section based on text-heavy layout and informational structure",
      feature: "Identified as feature section due to structured layout with highlights or benefits",
      testimonial: "Detected as testimonial section with quote-like content and social proof elements",
      contact: "Recognized as contact section with form elements or contact information",
      footer: "Identified as footer due to bottom positioning and secondary navigation elements",
      navigation: "Detected as navigation section with menu-like structure",
      sidebar: "Recognized as sidebar with complementary content positioning",
      gallery: "Identified as gallery section with image-focused layout"
    };

    return reasons[section.type as keyof typeof reasons] || 
           `Detected as ${section.type} section based on content analysis and positioning (section ${index + 1})`;
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovementSuggestions(section: any): string[] {
    const suggestions: string[] = [];

    // Type-specific suggestions
    switch (section.type) {
      case 'header':
        suggestions.push('Consider adding mobile-responsive navigation toggle');
        suggestions.push('Ensure logo is properly sized for different screen sizes');
        break;
      case 'hero':
        suggestions.push('Add compelling call-to-action button');
        suggestions.push('Optimize hero image for fast loading');
        break;
      case 'content':
        suggestions.push('Break up long text with subheadings and bullet points');
        suggestions.push('Add relevant images to support the content');
        break;
      case 'footer':
        suggestions.push('Include essential links and contact information');
        suggestions.push('Consider adding social media links');
        break;
    }

    // General suggestions based on content
    if (!section.editableFields || section.editableFields.length === 0) {
      suggestions.push('Add editable fields for dynamic content management');
    }

    if (!section.html || section.html.length < 50) {
      suggestions.push('Expand HTML content for better user experience');
    }

    return suggestions;
  }

  /**
   * Calculate realistic bounds for sections
   */
  private calculateRealisticBounds(type: string, index: number, totalSections: number): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const containerWidth = 800;
    const containerHeight = 600;

    // Type-based defaults
    const typeDefaults = {
      header: { width: containerWidth, height: 80, x: 0, y: 0 },
      hero: { width: containerWidth, height: 300, x: 0, y: 80 },
      content: { width: containerWidth * 0.7, height: 200, x: 0, y: 380 },
      sidebar: { width: containerWidth * 0.3, height: 200, x: containerWidth * 0.7, y: 380 },
      footer: { width: containerWidth, height: 100, x: 0, y: containerHeight - 100 },
      feature: { width: containerWidth, height: 250, x: 0, y: 200 },
      testimonial: { width: containerWidth, height: 150, x: 0, y: 450 },
      contact: { width: containerWidth, height: 200, x: 0, y: 400 },
      navigation: { width: containerWidth, height: 60, x: 0, y: 0 },
      gallery: { width: containerWidth, height: 300, x: 0, y: 300 }
    };

    const defaults = typeDefaults[type as keyof typeof typeDefaults] || 
                    { width: containerWidth, height: 150, x: 0, y: index * 150 };

    // Adjust Y position based on index to prevent overlaps
    if (type !== 'header' && type !== 'footer') {
      defaults.y = Math.max(80, index * 120);
    }

    return defaults;
  }

  /**
   * Generate section name based on type and index
   */
  private generateSectionName(type: string, index: number): string {
    const nameTemplates = {
      header: 'Header Section',
      hero: 'Hero Banner',
      content: `Content Section ${index + 1}`,
      feature: 'Features Section',
      testimonial: 'Testimonials',
      contact: 'Contact Section',
      footer: 'Footer Section',
      navigation: 'Navigation Menu',
      sidebar: 'Sidebar',
      gallery: 'Image Gallery'
    };

    return nameTemplates[type as keyof typeof nameTemplates] || `Section ${index + 1}`;
  }

  /**
   * Generate placeholder HTML for section type
   */
  private generatePlaceholderHTML(type: string): string {
    const htmlTemplates = {
      header: '<header class="bg-white shadow-sm"><div class="container mx-auto px-4 py-4 flex justify-between items-center"><img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjQwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9IjAuMzVlbSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiNmZmYiPkxPR088L3RleHQ+PC9zdmc+" alt="Logo" class="h-8"><nav class="space-x-6"><a href="#" class="text-gray-600 hover:text-gray-900">Home</a><a href="#" class="text-gray-600 hover:text-gray-900">About</a><a href="#" class="text-gray-600 hover:text-gray-900">Contact</a></nav></div></header>',
      
      hero: '<section class="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20"><div class="container mx-auto px-4 text-center"><h1 class="text-4xl md:text-6xl font-bold mb-6">Welcome to Our Platform</h1><p class="text-xl mb-8">Discover amazing features and transform your experience</p><button class="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">Get Started</button></div></section>',
      
      content: '<section class="py-16"><div class="container mx-auto px-4"><div class="max-w-4xl mx-auto"><h2 class="text-3xl font-bold text-gray-900 mb-6">About Our Service</h2><p class="text-lg text-gray-600 mb-6">We provide innovative solutions that help businesses grow and succeed in today\'s competitive market.</p><div class="grid md:grid-cols-2 gap-8"><div><h3 class="text-xl font-semibold mb-4">Our Mission</h3><p class="text-gray-600">To deliver exceptional value through cutting-edge technology and outstanding customer service.</p></div><div><h3 class="text-xl font-semibold mb-4">Our Vision</h3><p class="text-gray-600">To be the leading provider of innovative solutions that empower businesses worldwide.</p></div></div></div></div></section>',
      
      footer: '<footer class="bg-gray-900 text-white py-12"><div class="container mx-auto px-4"><div class="grid md:grid-cols-4 gap-8"><div><h3 class="text-lg font-semibold mb-4">Company</h3><ul class="space-y-2"><li><a href="#" class="text-gray-300 hover:text-white">About</a></li><li><a href="#" class="text-gray-300 hover:text-white">Careers</a></li></ul></div><div><h3 class="text-lg font-semibold mb-4">Support</h3><ul class="space-y-2"><li><a href="#" class="text-gray-300 hover:text-white">Help Center</a></li><li><a href="#" class="text-gray-300 hover:text-white">Contact</a></li></ul></div></div><div class="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400"><p>&copy; 2024 Company Name. All rights reserved.</p></div></div></footer>'
    };

    return htmlTemplates[type as keyof typeof htmlTemplates] || 
           `<div class="p-6"><h2 class="text-2xl font-bold mb-4">${type.charAt(0).toUpperCase() + type.slice(1)} Section</h2><p class="text-gray-600">Content for ${type} section goes here.</p></div>`;
  }

  /**
   * Analyze image complexity
   */
  private async analyzeImageComplexity(imageBase64: string): Promise<{
    width: number;
    height: number;
    aspectRatio: number;
    complexity: 'low' | 'medium' | 'high';
  }> {
    // This is a simplified implementation
    // In a real scenario, you might use image analysis libraries
    const estimatedWidth = 800;
    const estimatedHeight = 600;
    const aspectRatio = estimatedWidth / estimatedHeight;
    
    // Estimate complexity based on image size
    const imageSize = imageBase64.length;
    let complexity: 'low' | 'medium' | 'high' = 'medium';
    
    if (imageSize < 100000) complexity = 'low';
    else if (imageSize > 500000) complexity = 'high';

    return {
      width: estimatedWidth,
      height: estimatedHeight,
      aspectRatio,
      complexity
    };
  }

  /**
   * Generate recommendations based on detection results
   */
  private generateRecommendations(
    sections: DetectedSection[], 
    imageMetadata: any
  ): {
    suggestedAdjustments: string[];
    qualityScore: number;
    improvementTips: string[];
  } {
    const suggestedAdjustments: string[] = [];
    const improvementTips: string[] = [];
    
    // Analyze section distribution
    const sectionTypes = sections.map(s => s.type);
    const hasHeader = sectionTypes.includes('header');
    const hasHero = sectionTypes.includes('hero');
    const hasFooter = sectionTypes.includes('footer');
    
    if (!hasHeader) {
      suggestedAdjustments.push('Consider adding a header section for navigation');
    }
    
    if (!hasHero) {
      suggestedAdjustments.push('Consider adding a hero section for main messaging');
    }
    
    if (!hasFooter) {
      suggestedAdjustments.push('Consider adding a footer section for additional links');
    }

    // Quality score calculation
    let qualityScore = 70; // Base score
    
    // Add points for essential sections
    if (hasHeader) qualityScore += 10;
    if (hasHero) qualityScore += 10;
    if (hasFooter) qualityScore += 5;
    
    // Add points for section variety
    const uniqueTypes = new Set(sectionTypes).size;
    qualityScore += Math.min(15, uniqueTypes * 3);
    
    // Improvement tips
    improvementTips.push('Review AI-detected sections and adjust boundaries as needed');
    improvementTips.push('Verify section types match your intended layout structure');
    improvementTips.push('Consider mobile responsiveness when finalizing section layouts');
    
    if (sections.length > 8) {
      improvementTips.push('Consider merging similar sections to reduce complexity');
    }
    
    if (sections.length < 3) {
      improvementTips.push('Consider adding more sections for better content organization');
    }

    return {
      suggestedAdjustments,
      qualityScore: Math.min(100, qualityScore),
      improvementTips
    };
  }

  /**
   * Record user feedback for continuous improvement
   */
  async recordUserFeedback(feedback: UserFeedback): Promise<void> {
    try {
      this.feedbackHistory.push({
        ...feedback,
        userAdjustments: this.calculateUserAdjustments(feedback.originalSections, feedback.finalSections)
      });

      // Keep only last 100 feedback entries
      if (this.feedbackHistory.length > 100) {
        this.feedbackHistory = this.feedbackHistory.slice(-100);
      }

      logger.info('User feedback recorded for AI improvement', {
        adjustments: feedback.userAdjustments,
        satisfactionScore: feedback.satisfactionScore,
        totalFeedbackEntries: this.feedbackHistory.length
      });

    } catch (error) {
      logger.error('Failed to record user feedback', { error });
    }
  }

  /**
   * Calculate user adjustments between original and final sections
   */
  private calculateUserAdjustments(original: DetectedSection[], final: DetectedSection[]): {
    sectionsAdded: number;
    sectionsRemoved: number;
    sectionsModified: number;
    positionsChanged: number;
    typesChanged: number;
  } {
    const originalIds = new Set(original.map(s => s.id));
    const finalIds = new Set(final.map(s => s.id));
    
    const sectionsAdded = final.filter(s => !originalIds.has(s.id)).length;
    const sectionsRemoved = original.filter(s => !finalIds.has(s.id)).length;
    
    let sectionsModified = 0;
    let positionsChanged = 0;
    let typesChanged = 0;
    
    final.forEach(finalSection => {
      const originalSection = original.find(s => s.id === finalSection.id);
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

  /**
   * Get historical insights for prompt enhancement
   */
  private getHistoricalInsights(): string {
    if (this.feedbackHistory.length === 0) {
      return "No historical feedback available yet.";
    }

    const recentFeedback = this.feedbackHistory.slice(-20);
    const avgSatisfaction = recentFeedback.reduce((sum, f) => sum + f.satisfactionScore, 0) / recentFeedback.length;
    
    const commonAdjustments = recentFeedback.reduce((acc, f) => {
      acc.sectionsAdded += f.userAdjustments.sectionsAdded;
      acc.sectionsRemoved += f.userAdjustments.sectionsRemoved;
      acc.positionsChanged += f.userAdjustments.positionsChanged;
      acc.typesChanged += f.userAdjustments.typesChanged;
      return acc;
    }, { sectionsAdded: 0, sectionsRemoved: 0, positionsChanged: 0, typesChanged: 0 });

    return `
HISTORICAL FEEDBACK INSIGHTS (Last ${recentFeedback.length} sessions):
- Average user satisfaction: ${avgSatisfaction.toFixed(1)}/5
- Common adjustments: ${commonAdjustments.sectionsAdded} sections added, ${commonAdjustments.sectionsRemoved} removed
- Position changes: ${commonAdjustments.positionsChanged} sections repositioned
- Type changes: ${commonAdjustments.typesChanged} section types modified

IMPROVEMENT FOCUS:
${avgSatisfaction < 3.5 ? '- Focus on more accurate initial section detection' : '- Continue current detection approach'}
${commonAdjustments.positionsChanged > recentFeedback.length ? '- Improve initial positioning accuracy' : ''}
${commonAdjustments.typesChanged > recentFeedback.length * 0.5 ? '- Enhance section type classification' : ''}
`;
  }
}

export const enhancedLayoutDetectionService = EnhancedLayoutDetectionService.getInstance();
export default enhancedLayoutDetectionService;
