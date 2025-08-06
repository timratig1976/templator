/**
 * HTML Generator Service
 * AI-powered HTML/CSS generation from design sections
 * Consolidated from various generation services with improved structure
 */

import { createLogger } from '../../../utils/logger';
import { OpenAIClient } from '../../core/ai/OpenAIClient';
import { PromptManager } from '../prompts/PromptManager';
import { HTMLValidator } from '../../quality/validation/HTMLValidator';

const logger = createLogger();

export interface GenerationRequest {
  sectionType: 'header' | 'hero' | 'content' | 'features' | 'testimonials' | 'gallery' | 'contact' | 'footer';
  designDescription: string;
  imageBase64?: string;
  requirements?: string[];
  framework?: 'vanilla' | 'tailwind' | 'bootstrap';
  responsive?: boolean;
  accessibility?: boolean;
}

export interface GenerationResult {
  html: string;
  css: string;
  metadata: {
    sectionType: string;
    framework: string;
    features: string[];
    browserSupport: string;
    notes: string;
  };
  qualityScore: number;
  aiMetrics: {
    tokens: number;
    cost: number;
    duration: number;
    model: string;
  };
  validation: {
    errors: any[];
    warnings: any[];
    suggestions: string[];
  };
}

/**
 * HTML Generator Service
 * Generates HTML/CSS code from design descriptions using AI
 */
export class HTMLGenerator {
  private static instance: HTMLGenerator;
  private openaiClient: OpenAIClient;
  private promptManager: PromptManager;
  private htmlValidator: HTMLValidator;

  public static getInstance(): HTMLGenerator {
    if (!HTMLGenerator.instance) {
      HTMLGenerator.instance = new HTMLGenerator();
    }
    return HTMLGenerator.instance;
  }

  private constructor() {
    this.openaiClient = OpenAIClient.getInstance();
    this.promptManager = PromptManager.getInstance();
    this.htmlValidator = HTMLValidator.getInstance();
  }

  /**
   * Generate HTML/CSS from design section
   */
  async generateHTML(request: GenerationRequest): Promise<GenerationResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting HTML generation', {
        sectionType: request.sectionType,
        framework: request.framework,
        hasImage: !!request.imageBase64
      });

      // Build generation prompt
      const prompt = await this.promptManager.getGenerationPrompt({
        sectionType: request.sectionType,
        designDescription: request.designDescription,
        requirements: request.requirements,
        framework: request.framework || 'vanilla'
      });

      // Generate with AI
      const response = await this.openaiClient.chatCompletion(
        [{ role: 'user', content: prompt }],
        { maxTokens: 3000, temperature: 0.1 }
      );

      // Parse AI response
      const generatedCode = this.parseGenerationResponse(response.choices[0].message.content);
      
      // Validate generated code
      const validation = await this.htmlValidator.validateHTML(generatedCode.html, {});

      // Calculate AI metrics
      const aiMetrics = {
        tokens: response.usage?.total_tokens || 0,
        cost: this.openaiClient.calculateCost(response.usage?.total_tokens || 0, 'gpt-4'),
        duration: Date.now() - startTime,
        model: 'gpt-4'
      };

      const result: GenerationResult = {
        html: generatedCode.html,
        css: generatedCode.css,
        metadata: generatedCode.metadata || {
          sectionType: request.sectionType,
          framework: request.framework || 'vanilla',
          features: ['responsive', 'accessible', 'semantic'],
          browserSupport: 'Modern browsers',
          notes: 'AI-generated code'
        },
        qualityScore: validation.score || 0,
        aiMetrics,
        validation: {
          errors: validation.errors || [],
          warnings: validation.warnings || [],
          suggestions: validation.suggestions || []
        }
      };

      logger.info('HTML generation completed', {
        sectionType: request.sectionType,
        qualityScore: result.qualityScore,
        tokens: aiMetrics.tokens,
        cost: aiMetrics.cost,
        duration: aiMetrics.duration
      });

      return result;

    } catch (error) {
      logger.error('HTML generation failed', {
        sectionType: request.sectionType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return fallback result
      return this.getFallbackResult(request, Date.now() - startTime);
    }
  }

  /**
   * Generate multiple sections in batch
   */
  async generateBatch(requests: GenerationRequest[]): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];
    
    logger.info('Starting batch HTML generation', { count: requests.length });

    for (const request of requests) {
      try {
        const result = await this.generateHTML(request);
        results.push(result);
      } catch (error) {
        logger.error('Batch generation item failed', {
          sectionType: request.sectionType,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Add fallback result for failed item
        results.push(this.getFallbackResult(request, 0));
      }
    }

    logger.info('Batch HTML generation completed', {
      total: requests.length,
      successful: results.filter(r => r.qualityScore > 0).length
    });

    return results;
  }

  /**
   * Generate with image context (vision-based)
   */
  async generateWithImage(
    imageBase64: string,
    request: GenerationRequest
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting vision-based HTML generation', {
        sectionType: request.sectionType,
        imageSize: Math.round(imageBase64.length / 1024)
      });

      // Build vision prompt
      const prompt = await this.buildVisionPrompt(request);

      // Generate with AI Vision
      const response = await this.openaiClient.visionRequest(
        imageBase64,
        prompt,
        { maxTokens: 3000, temperature: 0.1 }
      );

      // Parse and validate response
      const generatedCode = this.parseGenerationResponse(response.choices[0].message.content);
      const validation = await this.htmlValidator.validateHTML(generatedCode.html, {});

      const aiMetrics = {
        tokens: response.usage?.total_tokens || 0,
        cost: this.openaiClient.calculateCost(response.usage?.total_tokens || 0, 'gpt-4o'),
        duration: Date.now() - startTime,
        model: 'gpt-4o'
      };

      const result: GenerationResult = {
        html: generatedCode.html,
        css: generatedCode.css,
        metadata: generatedCode.metadata || {
          sectionType: request.sectionType,
          framework: request.framework || 'vanilla',
          features: ['responsive', 'accessible', 'semantic', 'vision-based'],
          browserSupport: 'Modern browsers',
          notes: 'AI-generated from visual analysis'
        },
        qualityScore: validation.score || 0,
        aiMetrics,
        validation: {
          errors: validation.errors || [],
          warnings: validation.warnings || [],
          suggestions: validation.suggestions || []
        }
      };

      logger.info('Vision-based HTML generation completed', {
        sectionType: request.sectionType,
        qualityScore: result.qualityScore,
        tokens: aiMetrics.tokens,
        cost: aiMetrics.cost
      });

      return result;

    } catch (error) {
      logger.error('Vision-based HTML generation failed', {
        sectionType: request.sectionType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return this.getFallbackResult(request, Date.now() - startTime);
    }
  }

  /**
   * Parse AI generation response
   */
  private parseGenerationResponse(content: string): {
    html: string;
    css: string;
    metadata?: any;
  } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.html && parsed.css) {
          return {
            html: parsed.html,
            css: parsed.css,
            metadata: parsed.metadata
          };
        }
      }

      // Fallback: try to extract code blocks
      const htmlMatch = content.match(/```html\n([\s\S]*?)\n```/);
      const cssMatch = content.match(/```css\n([\s\S]*?)\n```/);

      return {
        html: htmlMatch ? htmlMatch[1] : '<div>Generated HTML not found</div>',
        css: cssMatch ? cssMatch[1] : '/* Generated CSS not found */',
        metadata: {
          notes: 'Parsed from code blocks'
        }
      };

    } catch (error) {
      logger.warn('Failed to parse generation response', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        html: '<div>Failed to parse generated HTML</div>',
        css: '/* Failed to parse generated CSS */',
        metadata: {
          notes: 'Response parsing failed'
        }
      };
    }
  }

  /**
   * Build vision-based generation prompt
   */
  private async buildVisionPrompt(request: GenerationRequest): Promise<string> {
    return `
Analyze this design image and generate modern, responsive HTML and CSS code for the ${request.sectionType} section.

**Section Requirements**:
- **Type**: ${request.sectionType}
- **Framework**: ${request.framework || 'vanilla'}
- **Responsive**: ${request.responsive !== false ? 'Yes' : 'No'}
- **Accessibility**: ${request.accessibility !== false ? 'Yes' : 'No'}

${request.requirements ? `**Additional Requirements**:\n${request.requirements.map(r => `- ${r}`).join('\n')}` : ''}

**Generation Guidelines**:

1. **Visual Analysis**:
   - Carefully analyze the design image
   - Identify colors, typography, spacing, and layout patterns
   - Match the visual design as closely as possible

2. **HTML Structure**:
   - Use semantic HTML5 elements appropriate for a ${request.sectionType} section
   - Implement proper accessibility (ARIA labels, alt text, proper heading hierarchy)
   - Ensure clean, readable markup

3. **CSS Styling**:
   - Match the visual design from the image
   - Use modern CSS features (Flexbox, Grid, Custom Properties)
   - Implement responsive design with mobile-first approach
   - Follow BEM methodology for class naming

4. **Framework Integration**:
   ${request.framework === 'tailwind' ? '- Use Tailwind CSS utility classes' : 
     request.framework === 'bootstrap' ? '- Use Bootstrap classes and components' : 
     '- Use vanilla CSS with modern features'}

**Response Format**:
Return a JSON object with this exact structure:

{
  "html": "<!-- Generated HTML code here -->",
  "css": "/* Generated CSS code here */",
  "metadata": {
    "sectionType": "${request.sectionType}",
    "framework": "${request.framework || 'vanilla'}",
    "features": ["responsive", "accessible", "semantic", "vision-based"],
    "browserSupport": "Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)",
    "notes": "Generated from visual analysis of design image"
  }
}

**Important Notes**:
- Focus on pixel-perfect recreation of the design
- Ensure the code is production-ready
- Include appropriate fallbacks for older browsers
- Optimize for performance and accessibility
`;
  }

  /**
   * Get fallback result when generation fails
   */
  private getFallbackResult(request: GenerationRequest, duration: number): GenerationResult {
    const fallbackHTML = this.getFallbackHTML(request.sectionType);
    const fallbackCSS = this.getFallbackCSS(request.sectionType);

    return {
      html: fallbackHTML,
      css: fallbackCSS,
      metadata: {
        sectionType: request.sectionType,
        framework: request.framework || 'vanilla',
        features: ['fallback'],
        browserSupport: 'All browsers',
        notes: 'Fallback template used due to generation failure'
      },
      qualityScore: 60, // Basic fallback score
      aiMetrics: {
        tokens: 0,
        cost: 0,
        duration,
        model: 'fallback'
      },
      validation: {
        errors: [],
        warnings: [{ type: 'generation', message: 'Using fallback template' }],
        suggestions: ['Retry generation with different parameters']
      }
    };
  }

  /**
   * Get fallback HTML for section type
   */
  private getFallbackHTML(sectionType: string): string {
    const templates: Record<string, string> = {
      header: `
<header class="header">
  <div class="container">
    <div class="header__brand">
      <h1>Brand</h1>
    </div>
    <nav class="header__nav">
      <ul>
        <li><a href="#home">Home</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#services">Services</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
  </div>
</header>`,
      hero: `
<section class="hero">
  <div class="container">
    <div class="hero__content">
      <h1 class="hero__title">Welcome to Our Service</h1>
      <p class="hero__subtitle">Discover amazing solutions for your needs</p>
      <a href="#cta" class="hero__cta">Get Started</a>
    </div>
  </div>
</section>`,
      content: `
<section class="content">
  <div class="container">
    <h2>Content Section</h2>
    <p>This is a placeholder content section with basic structure.</p>
  </div>
</section>`,
      footer: `
<footer class="footer">
  <div class="container">
    <p>&copy; 2024 Your Company. All rights reserved.</p>
  </div>
</footer>`
    };

    return templates[sectionType] || templates.content;
  }

  /**
   * Get fallback CSS for section type
   */
  private getFallbackCSS(sectionType: string): string {
    return `
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.${sectionType} {
  padding: 2rem 0;
}

.${sectionType}__title {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.${sectionType}__subtitle {
  font-size: 1.2rem;
  margin-bottom: 2rem;
}

@media (max-width: 768px) {
  .${sectionType} {
    padding: 1rem 0;
  }
  
  .${sectionType}__title {
    font-size: 1.5rem;
  }
}
`;
  }

  /**
   * Get generation statistics
   */
  async getGenerationStats(): Promise<{
    totalGenerations: number;
    averageQualityScore: number;
    sectionTypeBreakdown: Record<string, number>;
    frameworkUsage: Record<string, number>;
  }> {
    // This would typically query a database or log files
    return {
      totalGenerations: 0,
      averageQualityScore: 0,
      sectionTypeBreakdown: {},
      frameworkUsage: {}
    };
  }
}

export default HTMLGenerator.getInstance();
