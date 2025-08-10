import { createLogger } from '../../../utils/logger';
import { isValidBase64Image as validateBase64Image } from '../../../utils/base64';
import { logToFrontend } from '../../../utils/frontendLogger';

const logger = createLogger();

interface SplittingSuggestion {
  name: string;
  type: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  description: string;
}

interface SplittingAnalysis {
  layout_style?: string;
  complexity_overall?: string;
  sections: SplittingSuggestion[];
}

/**
 * AI-powered design splitting service
 * Handles OpenAI Vision API calls for intelligent section detection
 */
export class SplittingService {
  private static instance: SplittingService;

  public static getInstance(): SplittingService {
    if (!SplittingService.instance) {
      SplittingService.instance = new SplittingService();
    }
    return SplittingService.instance;
  }

  private constructor() {}

  /**
   * Generate AI-powered splitting suggestions using OpenAI Vision
   */
  async generateSplittingSuggestions(
    imageBase64: string, 
    fileName: string, 
    requestId: string
  ): Promise<SplittingSuggestion[]> {
    try {
      logger.info(`[${requestId}] Starting AI-powered section detection`, {
        requestId,
        fileName,
        imageSize: Math.round(imageBase64.length / 1024)
      });

      logToFrontend('info', 'openai', '🤖 Analyzing design with AI Vision', {
        fileName,
        model: 'gpt-4o'
      }, requestId);

      const prompt = this.buildSplittingPrompt();
      const startTime = Date.now();

      // Validate base64 image format
      if (!this.isValidBase64Image(imageBase64)) {
        throw new Error('Invalid base64 image format');
      }

      // Make OpenAI API call
      const requestData = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.2
      };

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const apiDuration = Date.now() - startTime;

      // Parse AI response
      const aiAnalysis = this.parseAIResponse(result.choices[0].message.content);
      const suggestions = aiAnalysis.sections;

      // Calculate metrics
      const tokensUsed = result.usage?.total_tokens || 0;
      const estimatedCost = this.calculateCost(tokensUsed);
      const avgConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;

      // Log success metrics
      logToFrontend('success', 'openai', `✅ AI analysis complete: ${suggestions.length} sections detected`, {
        sectionsCount: suggestions.length,
        tokensUsed,
        apiDuration: `${apiDuration}ms`,
        estimatedCost: `$${estimatedCost.toFixed(4)}`,
        avgConfidence: `${Math.round(avgConfidence * 100)}%`,
        layoutStyle: aiAnalysis.layout_style,
        overallComplexity: aiAnalysis.complexity_overall
      }, requestId);

      return suggestions;

    } catch (error: any) {
      logger.error(`[${requestId}] AI section detection failed`, {
        requestId,
        error: error?.message || 'Unknown error',
        fileName,
        imageSize: Math.round(imageBase64.length / 1024),
        errorStack: error?.stack,
        errorType: error?.constructor?.name
      });

      logToFrontend('error', 'openai', `❌ AI analysis failed: ${error?.message || 'Unknown error'}. Using fallback suggestions.`, {
        error: error?.message || 'Unknown error',
        errorType: error?.constructor?.name || 'Unknown',
        fallbackUsed: true
      }, requestId);

      // Log that we're using fallback
      logger.warn(`[${requestId}] Using fallback basic suggestions due to AI failure`);
      
      // Fallback to basic suggestions if AI fails
      return this.generateBasicSplittingSuggestions(fileName);
    }
  }

  /**
   * Build the AI splitting prompt
   */
  private buildSplittingPrompt(): string {
    return `
Analyze this design image and identify logical sections that should be split for modular development.

**Your Task**: 
Identify distinct visual sections in this design and suggest optimal splitting boundaries. DO NOT generate any HTML or CSS code.

**Analysis Requirements**:

1. **Visual Section Detection**:
   - Identify clear visual boundaries between different content areas
   - Look for natural breaks in layout (whitespace, borders, color changes)
   - Detect repeating patterns that could be componentized
   - Consider responsive behavior and how sections might stack

2. **Section Classification**:
   - Header/Navigation (top navigation, logos, menus)
   - Hero/Banner (main promotional content, large images)
   - Content (main body content, text blocks, articles)
   - Features (feature lists, service descriptions, benefits)
   - Testimonials (customer reviews, quotes, social proof)
   - Gallery (image collections, portfolios, showcases)
   - Contact (contact forms, contact information)
   - Footer (bottom navigation, legal links, company info)

3. **Boundary Precision**:
   - Provide exact pixel coordinates for section boundaries
   - Use percentage-based positioning (0-100% for both X and Y axes)
   - Ensure sections don't overlap
   - Account for padding and margins in boundary detection

**Response Format**:
Return a JSON object with this exact structure:

{
  "layout_style": "modern/classic/minimal/corporate/creative",
  "complexity_overall": "simple/moderate/complex",
  "sections": [
    {
      "name": "Section Name",
      "type": "header/hero/content/features/testimonials/gallery/contact/footer",
      "bounds": {
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 25
      },
      "confidence": 0.95,
      "description": "Brief description of what this section contains"
    }
  ]
}

**Important Notes**:
- Use percentage values (0-100) for all coordinates
- Y=0 is top of image, Y=100 is bottom
- X=0 is left edge, X=100 is right edge
- Confidence should be 0.0-1.0 based on clarity of section boundaries
- Ensure sections cover the entire design vertically (sum of heights ≈ 100%)
- Focus on major visual sections, not individual elements
`;
  }

  /**
   * Parse AI response and extract sections
   */
  private parseAIResponse(content: string): SplittingAnalysis {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.sections && Array.isArray(parsed.sections)) {
          return parsed;
        }
      }

      // Fallback parsing strategies
      const lines = content.split('\n');
      const sections: SplittingSuggestion[] = [];
      
      for (const line of lines) {
        if (line.includes('section') || line.includes('Section')) {
          // Try to extract section info from text
          const sectionMatch = line.match(/(header|hero|content|features|testimonials|gallery|contact|footer)/i);
          if (sectionMatch) {
            sections.push({
              name: sectionMatch[1].charAt(0).toUpperCase() + sectionMatch[1].slice(1),
              type: sectionMatch[1].toLowerCase(),
              bounds: { x: 0, y: sections.length * 25, width: 100, height: 25 },
              confidence: 0.7,
              description: `AI-detected ${sectionMatch[1]} section`
            });
          }
        }
      }

      return {
        layout_style: 'modern',
        complexity_overall: 'moderate',
        sections: sections.length > 0 ? sections : this.generateBasicSplittingSuggestions('design').map(s => ({
          name: s.name,
          type: s.type,
          bounds: s.bounds,
          confidence: s.confidence || 0.8,
          description: s.description || `${s.type} section`
        }))
      };

    } catch (error) {
      logger.warn('Failed to parse AI response, using fallback', { error });
      return {
        layout_style: 'modern',
        complexity_overall: 'moderate',
        sections: this.generateBasicSplittingSuggestions('design').map(s => ({
          name: s.name,
          type: s.type,
          bounds: s.bounds,
          confidence: s.confidence || 0.8,
          description: s.description || `${s.type} section`
        }))
      };
    }
  }

  /**
   * Generate basic fallback suggestions when AI fails
   */
  private generateBasicSplittingSuggestions(fileName: string): SplittingSuggestion[] {
    return [
      {
        name: 'Header',
        type: 'header',
        bounds: { x: 0, y: 0, width: 100, height: 15 },
        confidence: 0.8,
        description: 'Top navigation and branding area'
      },
      {
        name: 'Hero Section',
        type: 'hero',
        bounds: { x: 0, y: 15, width: 100, height: 35 },
        confidence: 0.8,
        description: 'Main promotional content area'
      },
      {
        name: 'Main Content',
        type: 'content',
        bounds: { x: 0, y: 50, width: 100, height: 35 },
        confidence: 0.8,
        description: 'Primary content and information'
      },
      {
        name: 'Footer',
        type: 'footer',
        bounds: { x: 0, y: 85, width: 100, height: 15 },
        confidence: 0.8,
        description: 'Bottom navigation and links'
      }
    ];
  }

  /**
   * Validate base64 image format
   */
  private isValidBase64Image(base64String: string): boolean {
    return validateBase64Image(base64String);
  }

  /**
   * Calculate estimated cost for OpenAI API call
   */
  private calculateCost(totalTokens: number): number {
    // GPT-4o pricing (approximate)
    const modelPricing = {
      input: 0.005 / 1000,  // $0.005 per 1K input tokens
      output: 0.015 / 1000  // $0.015 per 1K output tokens
    };
    const avgPrice = (modelPricing.input + modelPricing.output) / 2;
    return totalTokens * avgPrice;
  }
}

export default SplittingService.getInstance();
