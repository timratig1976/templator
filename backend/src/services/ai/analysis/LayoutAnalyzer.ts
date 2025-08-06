/**
 * Layout Analysis Service
 * Consolidated from LayoutSectionSplittingService and SequentialSectionProcessingService
 * Provides intelligent layout analysis and section detection
 */

import { createLogger } from '../../../utils/logger';
import { OpenAIClient } from '../../core/ai/OpenAIClient';

const logger = createLogger();

export interface LayoutSection {
  id: string;
  name: string;
  type: 'header' | 'hero' | 'content' | 'features' | 'testimonials' | 'gallery' | 'contact' | 'footer';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  description: string;
  elements?: LayoutElement[];
}

export interface LayoutElement {
  id: string;
  type: 'text' | 'image' | 'button' | 'form' | 'navigation' | 'logo';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  content?: string;
  attributes?: Record<string, any>;
}

export interface LayoutAnalysisResult {
  layout_style: string;
  complexity_overall: string;
  sections: LayoutSection[];
  elements: LayoutElement[];
  metadata: {
    analysisTime: number;
    confidence: number;
    recommendations: string[];
  };
}

/**
 * Layout Analyzer Service
 * Provides comprehensive layout analysis using AI vision and heuristic methods
 */
export class LayoutAnalyzer {
  private static instance: LayoutAnalyzer;
  private openaiClient: OpenAIClient;

  public static getInstance(): LayoutAnalyzer {
    if (!LayoutAnalyzer.instance) {
      LayoutAnalyzer.instance = new LayoutAnalyzer();
    }
    return LayoutAnalyzer.instance;
  }

  private constructor() {
    this.openaiClient = OpenAIClient.getInstance();
  }

  /**
   * Analyze layout using AI vision
   */
  async analyzeLayout(
    imageBase64: string,
    fileName: string,
    options: {
      includeElements?: boolean;
      detectionMethod?: 'ai' | 'heuristic' | 'hybrid';
    } = {}
  ): Promise<LayoutAnalysisResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting layout analysis', {
        fileName,
        imageSize: Math.round(imageBase64.length / 1024),
        options
      });

      let result: LayoutAnalysisResult;

      switch (options.detectionMethod || 'hybrid') {
        case 'ai':
          result = await this.analyzeWithAI(imageBase64, fileName, options);
          break;
        case 'heuristic':
          result = await this.analyzeWithHeuristics(imageBase64, fileName, options);
          break;
        case 'hybrid':
        default:
          result = await this.analyzeWithHybrid(imageBase64, fileName, options);
          break;
      }

      result.metadata.analysisTime = Date.now() - startTime;

      logger.info('Layout analysis completed', {
        fileName,
        sectionsFound: result.sections.length,
        elementsFound: result.elements.length,
        analysisTime: result.metadata.analysisTime,
        confidence: result.metadata.confidence
      });

      return result;

    } catch (error) {
      logger.error('Layout analysis failed', {
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return fallback result
      return this.getFallbackResult(fileName, Date.now() - startTime);
    }
  }

  /**
   * Analyze layout using AI vision
   */
  private async analyzeWithAI(
    imageBase64: string,
    fileName: string,
    options: any
  ): Promise<LayoutAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(options.includeElements);
    
    const response = await this.openaiClient.visionRequest(
      imageBase64,
      prompt,
      { maxTokens: 2500, temperature: 0.1 }
    );

    const content = response.choices[0].message.content;
    return this.parseAIResponse(content, fileName);
  }

  /**
   * Analyze layout using heuristic methods
   */
  private async analyzeWithHeuristics(
    imageBase64: string,
    fileName: string,
    options: any
  ): Promise<LayoutAnalysisResult> {
    // Basic heuristic analysis based on common layout patterns
    const sections: LayoutSection[] = [
      {
        id: 'header',
        name: 'Header',
        type: 'header',
        bounds: { x: 0, y: 0, width: 100, height: 15 },
        confidence: 0.8,
        description: 'Top navigation and branding area'
      },
      {
        id: 'hero',
        name: 'Hero Section',
        type: 'hero',
        bounds: { x: 0, y: 15, width: 100, height: 35 },
        confidence: 0.8,
        description: 'Main promotional content area'
      },
      {
        id: 'content',
        name: 'Main Content',
        type: 'content',
        bounds: { x: 0, y: 50, width: 100, height: 35 },
        confidence: 0.8,
        description: 'Primary content and information'
      },
      {
        id: 'footer',
        name: 'Footer',
        type: 'footer',
        bounds: { x: 0, y: 85, width: 100, height: 15 },
        confidence: 0.8,
        description: 'Bottom navigation and links'
      }
    ];

    return {
      layout_style: 'standard',
      complexity_overall: 'moderate',
      sections,
      elements: [],
      metadata: {
        analysisTime: 0,
        confidence: 0.8,
        recommendations: [
          'Consider using AI analysis for more accurate section detection',
          'Heuristic analysis provides basic layout structure'
        ]
      }
    };
  }

  /**
   * Analyze layout using hybrid approach (AI + heuristics)
   */
  private async analyzeWithHybrid(
    imageBase64: string,
    fileName: string,
    options: any
  ): Promise<LayoutAnalysisResult> {
    try {
      // Try AI analysis first
      const aiResult = await this.analyzeWithAI(imageBase64, fileName, options);
      
      // Validate AI results with heuristics
      const validatedResult = this.validateWithHeuristics(aiResult);
      
      return validatedResult;
    } catch (error) {
      logger.warn('AI analysis failed, falling back to heuristics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fallback to heuristic analysis
      return this.analyzeWithHeuristics(imageBase64, fileName, options);
    }
  }

  /**
   * Build analysis prompt for AI
   */
  private buildAnalysisPrompt(includeElements: boolean = false): string {
    return `
Analyze this design layout and identify all logical sections and ${includeElements ? 'elements' : 'their boundaries'}.

**Your Task**: 
Provide a comprehensive analysis of the layout structure, identifying distinct visual sections and ${includeElements ? 'individual elements within each section' : 'their precise boundaries'}.

**Analysis Requirements**:

1. **Layout Classification**:
   - Determine overall layout style (modern, classic, minimal, corporate, creative, etc.)
   - Assess complexity level (simple, moderate, complex)

2. **Section Detection**:
   - Identify clear visual sections with precise percentage-based boundaries
   - Classify each section type (header, hero, content, features, testimonials, gallery, contact, footer)
   - Provide confidence scores for each detection
   - Include descriptive names and purposes

${includeElements ? `
3. **Element Detection**:
   - Identify individual elements within sections (text, images, buttons, forms, navigation, logos)
   - Provide precise bounds for each element
   - Extract text content where visible
   - Note element relationships and hierarchy
` : ''}

**Response Format**:
Return a JSON object with this exact structure:

{
  "layout_style": "modern/classic/minimal/corporate/creative",
  "complexity_overall": "simple/moderate/complex",
  "sections": [
    {
      "id": "unique_section_id",
      "name": "Section Name",
      "type": "header/hero/content/features/testimonials/gallery/contact/footer",
      "bounds": {
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 25
      },
      "confidence": 0.95,
      "description": "Brief description of section content and purpose"
    }
  ]${includeElements ? `,
  "elements": [
    {
      "id": "unique_element_id",
      "type": "text/image/button/form/navigation/logo",
      "bounds": {
        "x": 10,
        "y": 5,
        "width": 80,
        "height": 15
      },
      "content": "Visible text content if applicable",
      "attributes": {
        "fontSize": "large",
        "color": "primary",
        "alignment": "center"
      }
    }
  ]` : ', "elements": []'}
}

**Important Notes**:
- Use percentage values (0-100) for all coordinates
- Y=0 is top, Y=100 is bottom; X=0 is left, X=100 is right
- Confidence should be 0.0-1.0 based on detection certainty
- Ensure sections cover the design comprehensively
- Focus on major structural elements, not decorative details
`;
  }

  /**
   * Parse AI response into structured result
   */
  private parseAIResponse(content: string, fileName: string): LayoutAnalysisResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.sections && Array.isArray(parsed.sections)) {
          return {
            layout_style: parsed.layout_style || 'modern',
            complexity_overall: parsed.complexity_overall || 'moderate',
            sections: parsed.sections.map((section: any, index: number) => ({
              id: section.id || `section_${index + 1}`,
              name: section.name || `Section ${index + 1}`,
              type: section.type || 'content',
              bounds: section.bounds || { x: 0, y: index * 25, width: 100, height: 25 },
              confidence: section.confidence || 0.7,
              description: section.description || `AI-detected ${section.type || 'content'} section`
            })),
            elements: parsed.elements || [],
            metadata: {
              analysisTime: 0,
              confidence: parsed.sections.reduce((sum: number, s: any) => sum + (s.confidence || 0.7), 0) / parsed.sections.length,
              recommendations: [
                'AI-powered analysis completed',
                'Review section boundaries and adjust if needed'
              ]
            }
          };
        }
      }

      throw new Error('Invalid AI response format');

    } catch (error) {
      logger.warn('Failed to parse AI response, using fallback', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return this.getFallbackResult(fileName, 0);
    }
  }

  /**
   * Validate AI results with heuristic checks
   */
  private validateWithHeuristics(aiResult: LayoutAnalysisResult): LayoutAnalysisResult {
    // Basic validation rules
    const validatedSections = aiResult.sections.filter(section => {
      // Ensure sections have valid bounds
      return section.bounds.width > 0 && section.bounds.height > 0 &&
             section.bounds.x >= 0 && section.bounds.x <= 100 &&
             section.bounds.y >= 0 && section.bounds.y <= 100;
    });

    // Sort sections by Y position
    validatedSections.sort((a, b) => a.bounds.y - b.bounds.y);

    // Adjust confidence based on validation
    const avgConfidence = validatedSections.reduce((sum, s) => sum + s.confidence, 0) / validatedSections.length;

    return {
      ...aiResult,
      sections: validatedSections,
      metadata: {
        ...aiResult.metadata,
        confidence: avgConfidence,
        recommendations: [
          ...aiResult.metadata.recommendations,
          'Results validated with heuristic checks'
        ]
      }
    };
  }

  /**
   * Get fallback result when analysis fails
   */
  private getFallbackResult(fileName: string, analysisTime: number): LayoutAnalysisResult {
    return {
      layout_style: 'standard',
      complexity_overall: 'moderate',
      sections: [
        {
          id: 'header',
          name: 'Header',
          type: 'header',
          bounds: { x: 0, y: 0, width: 100, height: 15 },
          confidence: 0.6,
          description: 'Top navigation and branding area'
        },
        {
          id: 'hero',
          name: 'Hero Section',
          type: 'hero',
          bounds: { x: 0, y: 15, width: 100, height: 35 },
          confidence: 0.6,
          description: 'Main promotional content area'
        },
        {
          id: 'content',
          name: 'Main Content',
          type: 'content',
          bounds: { x: 0, y: 50, width: 100, height: 35 },
          confidence: 0.6,
          description: 'Primary content and information'
        },
        {
          id: 'footer',
          name: 'Footer',
          type: 'footer',
          bounds: { x: 0, y: 85, width: 100, height: 15 },
          confidence: 0.6,
          description: 'Bottom navigation and links'
        }
      ],
      elements: [],
      metadata: {
        analysisTime,
        confidence: 0.6,
        recommendations: [
          'Analysis failed, using fallback layout structure',
          'Consider manual section adjustment'
        ]
      }
    };
  }

  /**
   * Get layout analysis statistics
   */
  async getAnalysisStats(): Promise<{
    totalAnalyses: number;
    averageConfidence: number;
    commonLayoutStyles: Record<string, number>;
    averageAnalysisTime: number;
  }> {
    // This would typically query a database or log files
    // For now, return mock data
    return {
      totalAnalyses: 0,
      averageConfidence: 0,
      commonLayoutStyles: {},
      averageAnalysisTime: 0
    };
  }
}

export default LayoutAnalyzer.getInstance();
