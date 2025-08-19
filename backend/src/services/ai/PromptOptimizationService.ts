import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { createLogger } from '../../utils/logger';
import OpenAIService from '../ai/openaiService';
import { ValidationIssue, ValidationResult } from '../quality/HTMLQualityService';

const logger = createLogger();

export interface PromptVariation {
  id: string;
  basePromptId: string;
  modifications: PromptModification[];
  createdAt: Date;
  performanceMetrics: {
    avgQualityScore: number;
    usageCount: number;
  };
  lastUsed?: Date;
}

export interface PromptModification {
  section: string;
  originalText?: string;
  replacementText: string;
  reason: string;
}

export interface ImprovedPrompt {
  originalPrompt: string;
  improvedPrompt: string;
  improvements: string[];
  variationId: string;
}

export class PromptOptimizationService {
  private static instance: PromptOptimizationService;
  private basePrompts: Map<string, string> = new Map();
  private promptVariations: PromptVariation[] = [];
  private dataPath: string;

  constructor() {
    // Set up data directory for storing prompt variations under centralized storage
    // __dirname: backend/src/services/ai -> ../../../storage/ai/prompts => backend/storage/ai/prompts
    this.dataPath = path.join(__dirname, '../../../storage/ai/prompts');
    this.ensureDataDirectoryExists();
    this.loadBasePrompts();
    this.loadPromptVariations();
  }

  public static getInstance(): PromptOptimizationService {
    if (!PromptOptimizationService.instance) {
      PromptOptimizationService.instance = new PromptOptimizationService();
    }
    return PromptOptimizationService.instance;
  }

  /**
   * Get the best performing prompt variation based on quality metrics
   */
  getBestPromptVariation(promptType: string = 'tailwind4-html'): string {
    const basePrompt = this.basePrompts.get(promptType) || this.getFallbackBasePrompt();
    
    if (this.promptVariations.length === 0) {
      logger.debug('No prompt variations found, using base prompt', { promptType });
      return basePrompt;
    }
    
    // Get relevant variations for this prompt type
    const relevantVariations = this.promptVariations
      .filter(v => v.basePromptId === promptType);

    if (relevantVariations.length === 0) {
      return basePrompt;
    }
    
    // Find variation with highest quality score (with minimum usage threshold)
    const bestVariations = relevantVariations
      .filter(v => v.performanceMetrics.usageCount >= 3) // Minimum usage threshold
      .sort((a, b) => b.performanceMetrics.avgQualityScore - a.performanceMetrics.avgQualityScore);
    
    if (bestVariations.length === 0) {
      return basePrompt;
    }
    
    const bestVariation = bestVariations[0];
    logger.debug('Using optimized prompt variation', {
      variationId: bestVariation.id,
      score: bestVariation.performanceMetrics.avgQualityScore,
      usageCount: bestVariation.performanceMetrics.usageCount
    });
    
    // Apply modifications to base prompt
    return this.applyModifications(basePrompt, bestVariation.modifications);
  }
  
  /**
   * Generate an improved prompt based on validation feedback
   */
  async improvePromptBasedOnFeedback(
    originalPrompt: string,
    generatedHTML: string,
    validationResult: ValidationResult,
    requestId?: string
  ): Promise<ImprovedPrompt> {
    try {
      logger.info('Generating improved prompt based on validation feedback', {
        currentScore: validationResult.score,
        issuesCount: validationResult.issues.length,
        requestId
      });

      // Step 1: Identify patterns of issues
      const issuePatterns = this.identifyIssuePatterns(validationResult);
      
      // Step 2: Use OpenAI to suggest prompt improvements
      const improvementSuggestion = await this.getAIPromptImprovements(
        originalPrompt,
        issuePatterns,
        generatedHTML,
        requestId
      );
      
      // Step 3: Create new prompt variation
      const newVariation: PromptVariation = {
        id: uuid(),
        basePromptId: 'tailwind4-html',
        modifications: improvementSuggestion.modifications,
        createdAt: new Date(),
        performanceMetrics: {
          avgQualityScore: 0,
          usageCount: 0
        },
        lastUsed: new Date()
      };
      
      // Step 4: Save new variation for testing
      this.promptVariations.push(newVariation);
      await this.savePromptVariations();

      const improvedPrompt = this.applyModifications(originalPrompt, newVariation.modifications);
      
      logger.debug('Created new prompt variation', {
        variationId: newVariation.id,
        modificationsCount: newVariation.modifications.length,
        requestId
      });
      
      return {
        originalPrompt,
        improvedPrompt,
        improvements: improvementSuggestion.improvements,
        variationId: newVariation.id
      };
    } catch (error) {
      logger.error('Failed to improve prompt', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      
      // Return original prompt if improvement fails
      return {
        originalPrompt,
        improvedPrompt: originalPrompt,
        improvements: ['Prompt improvement failed'],
        variationId: 'fallback'
      };
    }
  }
  
  /**
   * Update metrics for a prompt variation after use
   */
  updatePromptMetrics(variationId: string, qualityScore: number): void {
    const variation = this.promptVariations.find(v => v.id === variationId);
    if (!variation) {
      logger.warn('Could not find prompt variation to update metrics', { variationId });
      return;
    }
    
    variation.performanceMetrics.usageCount++;
    
    // Calculate running average for quality score
    variation.performanceMetrics.avgQualityScore = 
      (variation.performanceMetrics.avgQualityScore * (variation.performanceMetrics.usageCount - 1) + qualityScore) / 
      variation.performanceMetrics.usageCount;
      
    variation.lastUsed = new Date();
    
    logger.debug('Updated prompt variation metrics', {
      variationId,
      newScore: variation.performanceMetrics.avgQualityScore,
      usageCount: variation.performanceMetrics.usageCount
    });
    
    // Save updated metrics
    this.savePromptVariations();
  }
  
  /**
   * Apply modifications to a base prompt
   */
  private applyModifications(basePrompt: string, modifications: PromptModification[]): string {
    let modifiedPrompt = basePrompt;
    
    for (const mod of modifications) {
      if (mod.originalText && modifiedPrompt.includes(mod.originalText)) {
        // Replace specific text
        modifiedPrompt = modifiedPrompt.replace(mod.originalText, mod.replacementText);
      } else if (mod.section === 'append') {
        // Append to end of prompt
        modifiedPrompt += `\n\n${mod.replacementText}`;
      } else if (mod.section === 'prepend') {
        // Prepend to beginning of prompt
        modifiedPrompt = `${mod.replacementText}\n\n${modifiedPrompt}`;
      } else {
        // Try to find section by heading pattern
        const sectionPattern = new RegExp(`(#+\\s*${mod.section}[^#]*?)\\n#+\\s`, 'i');
        const match = modifiedPrompt.match(sectionPattern);
        
        if (match) {
          // Insert after section heading and before next heading
          const sectionContent = match[1];
          modifiedPrompt = modifiedPrompt.replace(
            sectionContent,
            `${sectionContent}\n${mod.replacementText}`
          );
        } else {
          // Just append if section not found
          modifiedPrompt += `\n\n${mod.replacementText}`;
        }
      }
    }
    
    return modifiedPrompt;
  }
  
  /**
   * Identify patterns in validation issues
   */
  private identifyIssuePatterns(validation: ValidationResult): string[] {
    const patterns: string[] = [];
    
    // Group issues by category
    const semanticsIssues = validation.issues.filter(i => i.category === 'semantics');
    const tailwindIssues = validation.issues.filter(i => i.category === 'tailwind');
    const accessibilityIssues = validation.issues.filter(i => i.category === 'accessibility');
    const responsiveIssues = validation.issues.filter(i => i.category === 'responsive');
    
    // Identify semantic structure issues
    if (semanticsIssues.length > 0) {
      if (semanticsIssues.some((i: ValidationIssue) => i.message.includes('alt'))) {
        patterns.push('Insufficient semantic HTML structure');
      }
      if (semanticsIssues.some((i: ValidationIssue) => i.message.includes('button') || i.message.includes('link'))) {
        patterns.push('Improper heading hierarchy');
      }
    }
    
    // Identify Tailwind usage issues
    if (tailwindIssues.length > 0) {
      if (tailwindIssues.some((i: any) => i.message.includes('grid'))) {
        patterns.push('Suboptimal grid implementation');
      }
      if (tailwindIssues.some((i: any) => i.message.includes('container'))) {
        patterns.push('Missing container queries for component-based design');
      }
      if (tailwindIssues.some((i: any) => i.message.includes('class') && i.message.includes('long'))) {
        patterns.push('Excessive class length indicating poor composition');
      }
    }
    
    // Identify accessibility issues
    if (accessibilityIssues.length > 0) {
      if (accessibilityIssues.some((i: any) => i.message.includes('alt'))) {
        patterns.push('Missing image alt text');
      }
      if (accessibilityIssues.some((i: any) => i.message.includes('ARIA') || i.message.includes('aria'))) {
        patterns.push('Missing ARIA attributes on complex components');
      }
    }
    
    // Identify responsive design issues
    if (responsiveIssues.length > 0) {
      if (responsiveIssues.some((i: any) => i.message.includes('breakpoint'))) {
        patterns.push('Insufficient responsive breakpoints');
      }
      if (responsiveIssues.some((i: any) => i.message.includes('mobile'))) {
        patterns.push('Missing mobile-first approach');
      }
    }
    
    return patterns;
  }
  
  /**
   * Use AI to generate prompt improvements
   */
  private async getAIPromptImprovements(
    currentPrompt: string,
    issuePatterns: string[],
    sampleOutput: string,
    requestId?: string
  ): Promise<{
    modifications: PromptModification[];
    improvements: string[];
  }> {
    try {
      // Create a focused prompt for getting suggestions to improve the HTML generation prompt
      const improvementPrompt = `
# Prompt Engineering Optimization Task

You are an expert prompt engineer tasked with improving a prompt that generates HTML with Tailwind CSS. The current prompt has produced HTML with quality issues. Your job is to suggest specific, targeted improvements to the prompt.

## Current Prompt
\`\`\`
${currentPrompt}
\`\`\`

## Quality Issues Detected
${issuePatterns.map(p => `- ${p}`).join('\n')}

## Sample Output That Needs Improvement
\`\`\`html
${sampleOutput.length > 2000 ? sampleOutput.substring(0, 2000) + '...(truncated)' : sampleOutput}
\`\`\`

## Your Task
Suggest 1-3 specific improvements to the prompt that would address these issues. For each improvement:
1. Identify which part of the prompt to modify
2. Provide the exact text to add or replace
3. Explain why this change will help

## Response Format
Respond in this JSON format only:
\`\`\`json
{
  "modifications": [
    {
      "section": "section name or 'append' or 'prepend'",
      "originalText": "text to replace (if applicable)",
      "replacementText": "new text to insert",
      "reason": "reason for this change"
    }
  ],
  "improvements": [
    "Brief description of improvement 1",
    "Brief description of improvement 2"
  ]
}
\`\`\`

Focus on practical, concrete changes that would make the prompt generate better HTML that addresses the specific issues found.
`;

      logger.debug('Requesting AI prompt improvements', {
        issuePatterns,
        requestId
      });

      // Use the public generateHubSpotModule method instead of private callOpenAI
      const result = await OpenAIService.generateHubSpotModule(improvementPrompt);

      // Extract JSON from response
      const jsonMatch = result.match(/```json\s*({[\s\S]*?})\s*```/) || 
                       result.match(/({[\s\S]*"improvements"[\s\S]*})/);
      
      if (!jsonMatch) {
        logger.warn('Failed to extract JSON from improvement suggestion', {
          result,
          requestId
        });
        
        // Return empty modifications
        return {
          modifications: [],
          improvements: ['Failed to generate improvements']
        };
      }
      
      const jsonStr = jsonMatch[1];
      const data = JSON.parse(jsonStr);
      
      logger.info('Generated prompt improvements', {
        modificationsCount: data.modifications?.length || 0,
        improvements: data.improvements?.length || 0,
        requestId
      });
      
      return {
        modifications: data.modifications || [],
        improvements: data.improvements || []
      };
    } catch (error) {
      logger.error('Failed to generate prompt improvements', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      
      return {
        modifications: [],
        improvements: ['Failed to generate improvements due to an error']
      };
    }
  }
  
  /**
   * Ensure the data directory exists
   */
  private ensureDataDirectoryExists(): void {
    if (!fs.existsSync(this.dataPath)) {
      try {
        fs.mkdirSync(this.dataPath, { recursive: true });
      } catch (error) {
        logger.error('Failed to create prompt data directory', {
          path: this.dataPath,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
  
  /**
   * Load base prompts from files
   */
  private loadBasePrompts(): void {
    try {
      // Use the centralized storage path for base prompts as well
      const basePromptPath = this.dataPath;
      
      // Create default prompts directory if it doesn't exist
      if (!fs.existsSync(basePromptPath)) {
        fs.mkdirSync(basePromptPath, { recursive: true });
      }
      
      // Load or create default Tailwind 4 HTML prompt
      const tailwind4PromptPath = path.join(basePromptPath, 'tailwind4-html.md');
      if (!fs.existsSync(tailwind4PromptPath)) {
        fs.writeFileSync(tailwind4PromptPath, this.getFallbackBasePrompt());
      }
      
      const tailwind4Prompt = fs.readFileSync(tailwind4PromptPath, 'utf8');
      this.basePrompts.set('tailwind4-html', tailwind4Prompt);
      
      logger.info('Base prompts loaded', {
        promptCount: this.basePrompts.size
      });
    } catch (error) {
      logger.error('Failed to load base prompts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Set fallback prompt
      this.basePrompts.set('tailwind4-html', this.getFallbackBasePrompt());
    }
  }
  
  /**
   * Load prompt variations from data file
   */
  private loadPromptVariations(): void {
    try {
      const variationsPath = path.join(this.dataPath, 'variations.json');
      
      if (fs.existsSync(variationsPath)) {
        const data = fs.readFileSync(variationsPath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Convert date strings back to Date objects
        this.promptVariations = parsed.map((v: any) => ({
          ...v,
          createdAt: new Date(v.createdAt),
          lastUsed: v.lastUsed ? new Date(v.lastUsed) : undefined
        }));
        
        logger.info('Prompt variations loaded', {
          variationsCount: this.promptVariations.length
        });
      } else {
        this.promptVariations = [];
        logger.info('No prompt variations found, starting fresh');
      }
    } catch (error) {
      logger.error('Failed to load prompt variations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.promptVariations = [];
    }
  }
  
  /**
   * Save prompt variations to data file
   */
  private async savePromptVariations(): Promise<void> {
    try {
      const variationsPath = path.join(this.dataPath, 'variations.json');
      await fs.promises.writeFile(variationsPath, JSON.stringify(this.promptVariations, null, 2));
      logger.debug('Prompt variations saved', {
        count: this.promptVariations.length,
        path: variationsPath
      });
    } catch (error) {
      logger.error('Failed to save prompt variations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Get the fallback base prompt for Tailwind 4 HTML generation
   */
  private getFallbackBasePrompt(): string {
    return `
# Tailwind 4 HTML Generation Guide

## Output Requirements

Create production-quality HTML with Tailwind CSS v4 that meets these requirements:

### 1. Semantic Structure
- Use proper HTML5 semantic elements (header, nav, main, section, article, footer)
- Create logical document hierarchy with proper heading levels (h1-h6)
- Include meaningful container elements with appropriate ARIA roles
- Add descriptive section/div IDs and data attributes where helpful

### 2. Tailwind 4 Features
- Leverage the latest Tailwind 4 features:
  - New color opacity syntax (bg-blue/75 instead of bg-blue bg-opacity-75)
  - Container queries (@container) for component-based responsive design
  - Subgrid layout support (grid-cols-subgrid) for complex nested grids
  - Dynamic viewport units (dvh, svh, lvh) for mobile-friendly layouts
  - Animation utilities (animate-*) for subtle UI enhancements
  - Multi-column layout utilities for text-heavy content

### 3. Accessibility
- Include proper alt text for ALL images (descriptive and contextual)
- Ensure proper contrast ratios with appropriate text/background combinations
- Add ARIA attributes and roles to complex interactive elements
- Ensure keyboard navigability with proper focus states
- Include form labels and appropriate aria-describedby attributes

### 4. Responsive Design
- Implement true mobile-first approach (base styles for mobile, then scale up)
- Use responsive breakpoints consistently (sm, md, lg, xl, 2xl)
- Apply proper container constraints and padding for different viewports
- Ensure text remains readable at all screen sizes
- Use flexible layouts that adapt gracefully to different devices

### 5. Advanced Layout Techniques
- Combine CSS Grid and Flexbox appropriately:
  - Grid for 2D layouts and complex page structures
  - Flexbox for 1D flows and alignment
- Use grid-template-areas for complex layout regions
- Implement responsive column layouts with auto-fit/auto-fill
- Use aspect-ratio utilities for responsive media
- Apply position: sticky with appropriate z-index management

### 6. Performance and Maintainability
- Avoid unnecessary wrapper divs
- Use Tailwind's composition patterns over custom CSS
- Group related utility classes logically
- Apply appropriate CSS variables for theme consistency
- Use proper HTML element hierarchy

## Always Include
- Viewport meta tag
- At least one appropriate image with alt text
- Responsive navigation pattern
- Interactive elements with proper states (hover, focus, active)
- HTML comments for complex sections

## For Complex Layouts
- Implement grid areas with named template areas
- Use gap utilities instead of margins for spacing grid items
- Consider subgrid for alignment across nested grids
- Implement appropriate container queries for component-based layouts
`;
  }
}

export default PromptOptimizationService;
