/**
 * Auto Corrector Service
 * Automatically fixes common HTML/CSS issues and quality problems
 */

import { createLogger } from '../../../utils/logger';
import { HTMLValidator } from '../validation/HTMLValidator';
import { OpenAIClient } from '../../core/ai/OpenAIClient';

const logger = createLogger();

export interface CorrectionRule {
  id: string;
  name: string;
  description: string;
  category: 'syntax' | 'accessibility' | 'performance' | 'seo' | 'semantic';
  severity: 'error' | 'warning' | 'suggestion';
  autoFixable: boolean;
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
}

export interface CorrectionResult {
  originalHtml: string;
  originalCss: string;
  correctedHtml: string;
  correctedCss: string;
  appliedCorrections: AppliedCorrection[];
  qualityImprovement: {
    before: number;
    after: number;
    improvement: number;
  };
  metadata: {
    processingTime: number;
    rulesApplied: number;
    manualReviewNeeded: boolean;
  };
}

export interface AppliedCorrection {
  ruleId: string;
  ruleName: string;
  category: string;
  description: string;
  location: {
    line: number;
    column: number;
    context: string;
  };
  change: {
    before: string;
    after: string;
  };
}

/**
 * Auto Corrector Service
 * Provides automatic correction of common HTML/CSS quality issues
 */
export class AutoCorrector {
  private static instance: AutoCorrector;
  private htmlValidator: HTMLValidator;
  private openaiClient: OpenAIClient;
  private correctionRules: CorrectionRule[];

  public static getInstance(): AutoCorrector {
    if (!AutoCorrector.instance) {
      AutoCorrector.instance = new AutoCorrector();
    }
    return AutoCorrector.instance;
  }

  private constructor() {
    this.htmlValidator = HTMLValidator.getInstance();
    this.openaiClient = OpenAIClient.getInstance();
    this.correctionRules = this.initializeCorrectionRules();
  }

  /**
   * Auto-correct HTML and CSS code
   */
  async autoCorrect(
    html: string,
    css: string,
    options: {
      categories?: string[];
      aggressiveness?: 'conservative' | 'moderate' | 'aggressive';
      useAI?: boolean;
    } = {}
  ): Promise<CorrectionResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting auto-correction', {
        htmlSize: html.length,
        cssSize: css.length,
        options
      });

      // Get initial quality score
      const initialValidation = await this.htmlValidator.validateHTML(html, {});
      const initialScore = initialValidation.score || 0;

      // Apply rule-based corrections
      let correctedHtml = html;
      let correctedCss = css;
      const appliedCorrections: AppliedCorrection[] = [];

      // Filter rules based on options
      const applicableRules = this.getApplicableRules(options);

      // Apply each correction rule
      for (const rule of applicableRules) {
        const htmlResult = this.applyRule(rule, correctedHtml, 'html');
        const cssResult = this.applyRule(rule, correctedCss, 'css');

        correctedHtml = htmlResult.correctedCode;
        correctedCss = cssResult.correctedCode;
        
        appliedCorrections.push(...htmlResult.corrections, ...cssResult.corrections);
      }

      // Apply AI-powered corrections if enabled
      if (options.useAI && appliedCorrections.length > 0) {
        const aiResult = await this.applyAICorrections(correctedHtml, correctedCss, appliedCorrections);
        correctedHtml = aiResult.html;
        correctedCss = aiResult.css;
      }

      // Get final quality score
      const finalValidation = await this.htmlValidator.validateHTML(correctedHtml, {});
      const finalScore = finalValidation.score || 0;

      const result: CorrectionResult = {
        originalHtml: html,
        originalCss: css,
        correctedHtml,
        correctedCss,
        appliedCorrections,
        qualityImprovement: {
          before: initialScore,
          after: finalScore,
          improvement: finalScore - initialScore
        },
        metadata: {
          processingTime: Date.now() - startTime,
          rulesApplied: appliedCorrections.length,
          manualReviewNeeded: this.needsManualReview(appliedCorrections)
        }
      };

      logger.info('Auto-correction completed', {
        rulesApplied: appliedCorrections.length,
        qualityImprovement: result.qualityImprovement.improvement,
        processingTime: result.metadata.processingTime
      });

      return result;

    } catch (error) {
      logger.error('Auto-correction failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Apply a single correction rule
   */
  private applyRule(
    rule: CorrectionRule,
    code: string,
    codeType: 'html' | 'css'
  ): {
    correctedCode: string;
    corrections: AppliedCorrection[];
  } {
    const corrections: AppliedCorrection[] = [];
    let correctedCode = code;

    if (!rule.autoFixable) {
      return { correctedCode, corrections };
    }

    const matches = Array.from(code.matchAll(new RegExp(rule.pattern, 'g')));

    for (const match of matches) {
      if (match.index !== undefined) {
        const before = match[0];
        const after = typeof rule.replacement === 'function' 
          ? rule.replacement(match[0], ...match.slice(1))
          : rule.replacement;

        // Get line and column information
        const beforeMatch = code.substring(0, match.index);
        const line = beforeMatch.split('\n').length;
        const column = beforeMatch.split('\n').pop()?.length || 0;

        corrections.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          description: rule.description,
          location: {
            line,
            column,
            context: this.getContext(code, match.index, 50)
          },
          change: {
            before,
            after
          }
        });

        // Apply the correction
        correctedCode = correctedCode.replace(before, after);
      }
    }

    return { correctedCode, corrections };
  }

  /**
   * Apply AI-powered corrections
   */
  private async applyAICorrections(
    html: string,
    css: string,
    appliedCorrections: AppliedCorrection[]
  ): Promise<{ html: string; css: string }> {
    try {
      const prompt = this.buildAICorrectionPrompt(html, css, appliedCorrections);
      
      const response = await this.openaiClient.chatCompletion([
        { role: 'user', content: prompt }
      ], { maxTokens: 2000, temperature: 0.1 });

      const result = this.parseAICorrectionResponse(response.choices[0].message.content);
      
      return {
        html: result.html || html,
        css: result.css || css
      };

    } catch (error) {
      logger.warn('AI correction failed, using rule-based corrections only', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { html, css };
    }
  }

  /**
   * Get applicable rules based on options
   */
  private getApplicableRules(options: any): CorrectionRule[] {
    let rules = this.correctionRules;

    // Filter by categories
    if (options.categories && options.categories.length > 0) {
      rules = rules.filter(rule => options.categories.includes(rule.category));
    }

    // Filter by aggressiveness
    if (options.aggressiveness === 'conservative') {
      rules = rules.filter(rule => rule.severity === 'error');
    } else if (options.aggressiveness === 'moderate') {
      rules = rules.filter(rule => rule.severity !== 'suggestion');
    }

    return rules;
  }

  /**
   * Initialize correction rules
   */
  private initializeCorrectionRules(): CorrectionRule[] {
    return [
      // Accessibility corrections
      {
        id: 'missing-alt-text',
        name: 'Missing Alt Text',
        description: 'Add alt attribute to images',
        category: 'accessibility',
        severity: 'error',
        autoFixable: true,
        pattern: /<img([^>]*?)(?<!alt\s*=\s*"[^"]*")\s*\/?>/gi,
        replacement: (match, attrs) => {
          if (attrs.includes('alt=')) return match;
          return match.replace('>', ' alt="">')
        }
      },
      
      // SEO corrections
      {
        id: 'missing-meta-description',
        name: 'Missing Meta Description',
        description: 'Add meta description tag',
        category: 'seo',
        severity: 'warning',
        autoFixable: true,
        pattern: /<head[^>]*>(?!.*<meta\s+name\s*=\s*["']description["'][^>]*>)/gi,
        replacement: '<head>\n  <meta name="description" content="">'
      },

      // Performance corrections
      {
        id: 'inline-styles',
        name: 'Inline Styles',
        description: 'Move inline styles to CSS',
        category: 'performance',
        severity: 'suggestion',
        autoFixable: false, // Requires more complex logic
        pattern: /style\s*=\s*["'][^"']*["']/gi,
        replacement: ''
      },

      // Syntax corrections
      {
        id: 'unclosed-tags',
        name: 'Unclosed Tags',
        description: 'Close unclosed HTML tags',
        category: 'syntax',
        severity: 'error',
        autoFixable: true,
        pattern: /<(br|hr|img|input|meta|link)\s*(?!\/)>/gi,
        replacement: '<$1 />'
      },

      // Semantic corrections
      {
        id: 'div-soup',
        name: 'Generic Div Usage',
        description: 'Replace generic divs with semantic elements',
        category: 'semantic',
        severity: 'suggestion',
        autoFixable: false, // Requires context analysis
        pattern: /<div\s+class\s*=\s*["'](header|footer|nav|main|article|section)["'][^>]*>/gi,
        replacement: '<$1>'
      }
    ];
  }

  /**
   * Build AI correction prompt
   */
  private buildAICorrectionPrompt(
    html: string,
    css: string,
    corrections: AppliedCorrection[]
  ): string {
    const correctionSummary = corrections.map(c => 
      `- ${c.ruleName}: ${c.description}`
    ).join('\n');

    return `
Improve the following HTML and CSS code based on the corrections that have been applied:

**Applied Corrections:**
${correctionSummary}

**HTML:**
\`\`\`html
${html}
\`\`\`

**CSS:**
\`\`\`css
${css}
\`\`\`

**Instructions:**
1. Review the applied corrections and ensure they are properly implemented
2. Make additional improvements to enhance code quality
3. Ensure the code remains functional and maintains the original design intent
4. Focus on accessibility, performance, and semantic improvements

**Response Format:**
\`\`\`json
{
  "html": "<!-- Improved HTML code -->",
  "css": "/* Improved CSS code */",
  "improvements": ["List of additional improvements made"]
}
\`\`\`
`;
  }

  /**
   * Parse AI correction response
   */
  private parseAICorrectionResponse(content: string): {
    html?: string;
    css?: string;
    improvements?: string[];
  } {
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Fallback: extract code blocks
      const htmlMatch = content.match(/```html\n([\s\S]*?)\n```/);
      const cssMatch = content.match(/```css\n([\s\S]*?)\n```/);

      return {
        html: htmlMatch ? htmlMatch[1] : undefined,
        css: cssMatch ? cssMatch[1] : undefined,
        improvements: []
      };

    } catch (error) {
      logger.warn('Failed to parse AI correction response', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {};
    }
  }

  /**
   * Get context around a match
   */
  private getContext(code: string, index: number, contextLength: number): string {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(code.length, index + contextLength);
    return code.substring(start, end);
  }

  /**
   * Check if manual review is needed
   */
  private needsManualReview(corrections: AppliedCorrection[]): boolean {
    return corrections.some(c => 
      c.category === 'semantic' || 
      c.ruleName.includes('complex') ||
      corrections.length > 10
    );
  }

  /**
   * Get available correction rules
   */
  getAvailableRules(): CorrectionRule[] {
    return [...this.correctionRules];
  }

  /**
   * Add custom correction rule
   */
  addCustomRule(rule: CorrectionRule): void {
    this.correctionRules.push(rule);
    logger.info('Custom correction rule added', { ruleId: rule.id });
  }

  /**
   * Remove correction rule
   */
  removeRule(ruleId: string): boolean {
    const index = this.correctionRules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.correctionRules.splice(index, 1);
      logger.info('Correction rule removed', { ruleId });
      return true;
    }
    return false;
  }
}

export default AutoCorrector.getInstance();
