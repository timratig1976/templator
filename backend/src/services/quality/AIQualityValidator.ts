import { createLogger } from '../../utils/logger';
import OpenAIService from '../ai/openaiService';
import { ValidationIssue, ValidationResult } from './HTMLQualityService';
import { logToFrontend } from '../../routes/logs';

const logger = createLogger();

export interface AIValidationResult {
  valid: boolean;
  score: number;
  issues: ValidationIssue[];
  metrics: {
    semanticsScore: number;
    tailwindScore: number;
    accessibilityScore: number;
    responsiveScore: number;
  };
  reasoning: string;
  suggestions: string[];
}

export class AIQualityValidator {
  private static instance: AIQualityValidator;

  public static getInstance(): AIQualityValidator {
    if (!AIQualityValidator.instance) {
      AIQualityValidator.instance = new AIQualityValidator();
    }
    return AIQualityValidator.instance;
  }

  /**
   * Validate HTML using AI for enhanced quality checks
   */
  async validateWithOpenAI(
    html: string, 
    sectionName: string = 'section', 
    requestId?: string
  ): Promise<AIValidationResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting AI quality validation', {
        sectionName,
        htmlLength: html.length,
        requestId
      });

      logToFrontend('info', 'processing', `🔍 Analyzing HTML quality for ${sectionName}...`, {
        sectionName
      }, requestId);

      // Create a focused prompt for HTML quality validation
      const prompt = `
# HTML Quality Analysis Task

Analyze this HTML code (created with Tailwind CSS v4) and evaluate its quality on the following criteria:

1. **Semantic Structure** (score 0-100):
   - Proper use of semantic HTML5 elements (header, nav, main, section, article, footer)
   - Logical document structure and heading hierarchy
   - Meaningful element nesting and organization

2. **Tailwind 4 Implementation** (score 0-100):
   - Effective use of Tailwind 4 features (container queries, subgrid, dynamic viewport units, color opacity syntax)
   - Optimal utility class composition and organization
   - Proper responsive design patterns using Tailwind breakpoints
   - Grid and flexbox implementation quality

3. **Accessibility Compliance** (score 0-100):
   - Images have alt text
   - Form elements have proper labels
   - ARIA attributes on complex UI elements
   - Keyboard navigability considerations
   - Color contrast concerns

4. **Responsive Design** (score 0-100):
   - Mobile-first approach
   - Proper breakpoint usage
   - Flexible images and media
   - Appropriate viewport meta tag
   - Handling of different device sizes

## Response Format
Provide your analysis in this exact JSON structure:
\`\`\`json
{
  "semantics": {
    "score": 85,
    "issues": [
      {"severity": "error|warning|suggestion", "message": "Issue description", "suggestion": "How to fix"}
    ]
  },
  "tailwind": {
    "score": 90,
    "issues": []
  },
  "accessibility": {
    "score": 75,
    "issues": []
  },
  "responsive": {
    "score": 80,
    "issues": []
  },
  "overall_score": 82,
  "reasoning": "Brief explanation of the main quality characteristics",
  "suggestions": ["Key improvement 1", "Key improvement 2"]
}
\`\`\`

## HTML to Analyze
\`\`\`html
${html}
\`\`\`
`;

      // Use the public generateHubSpotModule method instead of private callOpenAI
      const result = await OpenAIService.generateHubSpotModule(prompt);

      // Parse the validation response
      const validationResult = this.parseValidationResponse(result);
      const processingTime = Date.now() - startTime;

      logger.info('AI quality validation completed', {
        sectionName,
        score: validationResult.score,
        issuesFound: validationResult.issues.length,
        processingTime,
        requestId
      });

      logToFrontend('success', 'processing', `✅ HTML quality analysis complete: Score ${validationResult.score}/100`, {
        score: validationResult.score,
        issues: validationResult.issues.length,
        metrics: validationResult.metrics,
        processingTime
      }, requestId);

      return validationResult;
    } catch (error) {
      logger.error('AI quality validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sectionName,
        requestId
      });

      logToFrontend('error', 'processing', `❌ HTML quality analysis failed`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, requestId);

      // Return a fallback validation result
      return this.createFallbackValidationResult();
    }
  }
  
  /**
   * Parse the structured response from OpenAI
   */
  private parseValidationResponse(response: string): AIValidationResult {
    try {
      // Extract JSON object from the response (in case it includes markdown formatting)
      const jsonMatch = response.match(/```json\s*({[\s\S]*?})\s*```/) || 
                       response.match(/({[\s\S]*"overall_score"[\s\S]*})/);
      
      if (!jsonMatch) {
        logger.warn('Failed to extract JSON from OpenAI response', { response });
        return this.createFallbackValidationResult();
      }
      
      const jsonStr = jsonMatch[1];
      const data = JSON.parse(jsonStr);
      
      // Transform AI response into our validation format
      const issues: ValidationIssue[] = [
        ...(data.semantics?.issues || []).map((i: any) => ({
          ...i,
          category: 'semantics'
        })),
        ...(data.tailwind?.issues || []).map((i: any) => ({
          ...i,
          category: 'tailwind'
        })),
        ...(data.accessibility?.issues || []).map((i: any) => ({
          ...i,
          category: 'accessibility'
        })),
        ...(data.responsive?.issues || []).map((i: any) => ({
          ...i,
          category: 'responsive'
        }))
      ];

      return {
        valid: (data.overall_score || 0) >= 70,
        score: data.overall_score || 0,
        issues,
        metrics: {
          semanticsScore: data.semantics?.score || 0,
          tailwindScore: data.tailwind?.score || 0,
          accessibilityScore: data.accessibility?.score || 0,
          responsiveScore: data.responsive?.score || 0
        },
        reasoning: data.reasoning || '',
        suggestions: data.suggestions || []
      };
    } catch (error) {
      logger.error('Failed to parse AI validation response', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        response
      });
      return this.createFallbackValidationResult();
    }
  }

  /**
   * Create a fallback validation result if parsing fails
   */
  private createFallbackValidationResult(): AIValidationResult {
    return {
      valid: false,
      score: 0,
      issues: [{
        severity: 'error',
        category: 'semantics',
        message: 'Failed to analyze HTML quality',
        suggestion: 'Please review the HTML manually'
      }],
      metrics: {
        semanticsScore: 0,
        tailwindScore: 0,
        accessibilityScore: 0,
        responsiveScore: 0
      },
      reasoning: 'Quality analysis failed',
      suggestions: ['Review HTML manually']
    };
  }
}

export default AIQualityValidator;
