/**
 * Iterative Refinement Service
 * Provides AI-powered iterative improvement of generated HTML/CSS code
 * Consolidated from the original IterativeRefinementService with improved structure
 */

import { createLogger } from '../../../utils/logger';
import { OpenAIClient } from '../../core/ai/OpenAIClient';
import { HTMLValidator } from '../../quality/validation/HTMLValidator';

const logger = createLogger();

export interface RefinementRequest {
  html: string;
  css: string;
  feedback: string;
  targetQualityScore?: number;
  maxIterations?: number;
  focusAreas?: ('accessibility' | 'performance' | 'semantics' | 'design' | 'responsiveness')[];
}

export interface RefinementResult {
  html: string;
  css: string;
  iterations: RefinementIteration[];
  finalQualityScore: number;
  improvementAchieved: boolean;
  metadata: {
    totalTime: number;
    totalCost: number;
    totalTokens: number;
    convergenceReached: boolean;
  };
}

export interface RefinementIteration {
  iteration: number;
  timestamp: string;
  input: {
    html: string;
    css: string;
    feedback: string;
  };
  output: {
    html: string;
    css: string;
    changes: string[];
  };
  qualityScore: number;
  improvement: number;
  aiMetrics: {
    tokens: number;
    cost: number;
    duration: number;
  };
}

/**
 * Iterative Refinement Service
 * Provides AI-powered code refinement with quality tracking
 */
export class IterativeRefinement {
  private static instance: IterativeRefinement;
  private openaiClient: OpenAIClient;
  private htmlValidator: HTMLValidator;

  public static getInstance(): IterativeRefinement {
    if (!IterativeRefinement.instance) {
      IterativeRefinement.instance = new IterativeRefinement();
    }
    return IterativeRefinement.instance;
  }

  private constructor() {
    this.openaiClient = OpenAIClient.getInstance();
    this.htmlValidator = HTMLValidator.getInstance();
  }

  /**
   * Perform iterative refinement of HTML/CSS code
   */
  async refineCode(request: RefinementRequest): Promise<RefinementResult> {
    const startTime = Date.now();
    const maxIterations = request.maxIterations || 3;
    const targetQualityScore = request.targetQualityScore || 85;
    
    logger.info('Starting iterative refinement', {
      targetQualityScore,
      maxIterations,
      focusAreas: request.focusAreas
    });

    const iterations: RefinementIteration[] = [];
    let currentHtml = request.html;
    let currentCss = request.css;
    let currentFeedback = request.feedback;
    let previousQualityScore = 0;
    let totalCost = 0;
    let totalTokens = 0;

    // Get initial quality score
    const initialValidation = await this.htmlValidator.validateHTML(currentHtml, {});
    previousQualityScore = initialValidation.score;

    logger.info('Initial quality score', { score: previousQualityScore });

    for (let i = 0; i < maxIterations; i++) {
      const iterationStart = Date.now();
      
      try {
        logger.info(`Starting refinement iteration ${i + 1}`, {
          currentScore: previousQualityScore,
          targetScore: targetQualityScore
        });

        // Generate refinement prompt
        const prompt = this.buildRefinementPrompt(
          currentHtml,
          currentCss,
          currentFeedback,
          request.focusAreas,
          previousQualityScore,
          targetQualityScore
        );

        // Get AI refinement
        const response = await this.openaiClient.chatCompletion(
          [{ role: 'user', content: prompt }],
          { maxTokens: 3000, temperature: 0.1 }
        );

        const aiResult = this.parseRefinementResponse(response.choices[0].message.content);
        
        // Validate refined code
        const validation = await this.htmlValidator.validateHTML(aiResult.html, {});
        const qualityScore = validation.score;
        const improvement = qualityScore - previousQualityScore;

        // Track iteration
        const iteration: RefinementIteration = {
          iteration: i + 1,
          timestamp: new Date().toISOString(),
          input: {
            html: currentHtml,
            css: currentCss,
            feedback: currentFeedback
          },
          output: {
            html: aiResult.html,
            css: aiResult.css,
            changes: aiResult.changes
          },
          qualityScore,
          improvement,
          aiMetrics: {
            tokens: response.usage?.total_tokens || 0,
            cost: this.openaiClient.calculateCost(response.usage?.total_tokens || 0, 'gpt-4o'),
            duration: Date.now() - iterationStart
          }
        };

        iterations.push(iteration);
        totalCost += iteration.aiMetrics.cost;
        totalTokens += iteration.aiMetrics.tokens;

        logger.info(`Iteration ${i + 1} completed`, {
          qualityScore,
          improvement,
          tokens: iteration.aiMetrics.tokens,
          cost: iteration.aiMetrics.cost
        });

        // Update current state
        currentHtml = aiResult.html;
        currentCss = aiResult.css;
        
        // Check if we've reached the target or if improvement is minimal
        if (qualityScore >= targetQualityScore) {
          logger.info('Target quality score reached', { score: qualityScore });
          break;
        }

        if (improvement < 1 && i > 0) {
          logger.info('Minimal improvement detected, stopping refinement', { improvement });
          break;
        }

        // Prepare feedback for next iteration
        currentFeedback = this.generateNextIterationFeedback(validation, request.focusAreas);
        previousQualityScore = qualityScore;

      } catch (error) {
        logger.error(`Refinement iteration ${i + 1} failed`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Continue with previous version if iteration fails
        break;
      }
    }

    const finalQualityScore = iterations.length > 0 
      ? iterations[iterations.length - 1].qualityScore 
      : previousQualityScore;

    const result: RefinementResult = {
      html: currentHtml,
      css: currentCss,
      iterations,
      finalQualityScore,
      improvementAchieved: finalQualityScore > initialValidation.score,
      metadata: {
        totalTime: Date.now() - startTime,
        totalCost,
        totalTokens,
        convergenceReached: finalQualityScore >= targetQualityScore
      }
    };

    logger.info('Iterative refinement completed', {
      iterations: iterations.length,
      initialScore: initialValidation.score,
      finalScore: finalQualityScore,
      improvement: finalQualityScore - initialValidation.score,
      totalCost,
      totalTime: result.metadata.totalTime
    });

    return result;
  }

  /**
   * Build refinement prompt for AI
   */
  private buildRefinementPrompt(
    html: string,
    css: string,
    feedback: string,
    focusAreas?: string[],
    currentScore?: number,
    targetScore?: number
  ): string {
    const focusAreasText = focusAreas && focusAreas.length > 0 
      ? `Focus particularly on: ${focusAreas.join(', ')}`
      : 'Focus on overall code quality and best practices';

    return `
You are an expert web developer tasked with refining HTML and CSS code based on feedback and quality metrics.

**Current Code Quality Score**: ${currentScore || 'Unknown'}/100
**Target Quality Score**: ${targetScore || 85}/100

**Current HTML**:
\`\`\`html
${html}
\`\`\`

**Current CSS**:
\`\`\`css
${css}
\`\`\`

**Feedback to Address**:
${feedback}

**Refinement Instructions**:
${focusAreasText}

**Your Task**:
1. Analyze the current code and identify specific improvements needed
2. Refine the HTML and CSS to address the feedback and improve quality
3. Ensure the code remains functional while improving:
   - Semantic HTML structure
   - Accessibility compliance (WCAG guidelines)
   - Performance optimization
   - Responsive design principles
   - Clean, maintainable code structure

**Response Format**:
Provide your response in this exact JSON format:

{
  "html": "<!-- Refined HTML code here -->",
  "css": "/* Refined CSS code here */",
  "changes": [
    "Specific change 1 made",
    "Specific change 2 made",
    "Specific change 3 made"
  ],
  "reasoning": "Brief explanation of the refinements made and how they improve quality"
}

**Important Notes**:
- Maintain the original design intent while improving code quality
- Make incremental improvements, don't completely rewrite unless necessary
- Focus on the most impactful changes first
- Ensure all changes are backward compatible
- Validate that the refined code is syntactically correct
`;
  }

  /**
   * Parse AI refinement response
   */
  private parseRefinementResponse(content: string): {
    html: string;
    css: string;
    changes: string[];
  } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          html: parsed.html || '',
          css: parsed.css || '',
          changes: parsed.changes || []
        };
      }

      // Fallback: try to extract code blocks
      const htmlMatch = content.match(/```html\n([\s\S]*?)\n```/);
      const cssMatch = content.match(/```css\n([\s\S]*?)\n```/);

      return {
        html: htmlMatch ? htmlMatch[1] : '',
        css: cssMatch ? cssMatch[1] : '',
        changes: ['AI response parsing fallback used']
      };

    } catch (error) {
      logger.warn('Failed to parse refinement response', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        html: '',
        css: '',
        changes: ['Failed to parse AI response']
      };
    }
  }

  /**
   * Generate feedback for next iteration
   */
  private generateNextIterationFeedback(
    validation: any,
    focusAreas?: string[]
  ): string {
    const issues: string[] = [];

    // Add validation errors and warnings
    if (validation.errors && validation.errors.length > 0) {
      issues.push(`Validation errors: ${validation.errors.map((e: any) => e.message).join(', ')}`);
    }

    if (validation.warnings && validation.warnings.length > 0) {
      issues.push(`Validation warnings: ${validation.warnings.map((w: any) => w.message).join(', ')}`);
    }

    // Add focus area specific feedback
    if (focusAreas) {
      focusAreas.forEach(area => {
        switch (area) {
          case 'accessibility':
            if (validation.accessibilityScore < 90) {
              issues.push('Improve accessibility: add ARIA labels, ensure proper heading hierarchy, improve color contrast');
            }
            break;
          case 'performance':
            if (validation.performanceScore < 90) {
              issues.push('Optimize performance: minimize CSS, optimize images, reduce DOM complexity');
            }
            break;
          case 'semantics':
            if (validation.semanticScore < 90) {
              issues.push('Improve semantic HTML: use appropriate HTML5 elements, improve document structure');
            }
            break;
        }
      });
    }

    return issues.length > 0 
      ? issues.join('. ')
      : 'Continue improving overall code quality and best practices.';
  }

  /**
   * Get refinement statistics
   */
  async getRefinementStats(): Promise<{
    totalRefinements: number;
    averageIterations: number;
    averageImprovement: number;
    successRate: number;
  }> {
    // This would typically query a database or log files
    // For now, return mock data
    return {
      totalRefinements: 0,
      averageIterations: 0,
      averageImprovement: 0,
      successRate: 0
    };
  }
}

export default IterativeRefinement.getInstance();
