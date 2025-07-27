import { createLogger } from '../utils/logger';
import { logToFrontend } from '../routes/logs';

const logger = createLogger();

export interface PromptVersion {
  id: string;
  version: string;
  prompt: string;
  moduleType: string;
  created: Date;
  performance: PromptPerformance;
  isActive: boolean;
}

export interface PromptPerformance {
  successRate: number;
  averageValidationScore: number;
  averageGenerationTime: number;
  totalUsage: number;
  errorRate: number;
  userSatisfactionScore?: number;
}

export interface ABTestConfig {
  testId: string;
  name: string;
  moduleType: string;
  variants: PromptVersion[];
  trafficSplit: number[]; // Percentage split for each variant
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  metrics: ABTestMetrics;
}

export interface ABTestMetrics {
  totalRequests: number;
  variantPerformance: Map<string, PromptPerformance>;
  statisticalSignificance: number;
  winningVariant?: string;
}

export interface PromptEvaluationMetrics {
  syntaxCorrectness: number;
  fieldValidityScore: number;
  templateQualityScore: number;
  accessibilityScore: number;
  performanceScore: number;
  overallScore: number;
}

export class PromptVersioningService {
  private static instance: PromptVersioningService;
  private promptVersions: Map<string, PromptVersion[]> = new Map();
  private activeTests: Map<string, ABTestConfig> = new Map();
  private performanceHistory: Map<string, PromptPerformance[]> = new Map();

  public static getInstance(): PromptVersioningService {
    if (!PromptVersioningService.instance) {
      PromptVersioningService.instance = new PromptVersioningService();
    }
    return PromptVersioningService.instance;
  }

  /**
   * Create a new prompt version
   */
  async createPromptVersion(
    moduleType: string,
    prompt: string,
    version: string,
    description?: string
  ): Promise<PromptVersion> {
    const promptId = `${moduleType}_${version}_${Date.now()}`;
    
    const newVersion: PromptVersion = {
      id: promptId,
      version,
      prompt,
      moduleType,
      created: new Date(),
      performance: {
        successRate: 0,
        averageValidationScore: 0,
        averageGenerationTime: 0,
        totalUsage: 0,
        errorRate: 0
      },
      isActive: false
    };

    // Store the version
    if (!this.promptVersions.has(moduleType)) {
      this.promptVersions.set(moduleType, []);
    }
    this.promptVersions.get(moduleType)!.push(newVersion);

    logger.info('Created new prompt version', {
      promptId,
      moduleType,
      version,
      description
    });

    logToFrontend('info', 'system', '📝 Created new prompt version', {
      promptId,
      moduleType,
      version
    });

    return newVersion;
  }

  /**
   * Start A/B test for prompt variants
   */
  async startABTest(
    testName: string,
    moduleType: string,
    variants: PromptVersion[],
    trafficSplit: number[],
    durationDays: number = 7
  ): Promise<ABTestConfig> {
    if (variants.length !== trafficSplit.length) {
      throw new Error('Number of variants must match traffic split array length');
    }

    if (trafficSplit.reduce((sum, split) => sum + split, 0) !== 100) {
      throw new Error('Traffic split percentages must sum to 100');
    }

    const testId = `ab_${moduleType}_${Date.now()}`;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    const abTest: ABTestConfig = {
      testId,
      name: testName,
      moduleType,
      variants,
      trafficSplit,
      startDate: new Date(),
      endDate,
      isActive: true,
      metrics: {
        totalRequests: 0,
        variantPerformance: new Map(),
        statisticalSignificance: 0
      }
    };

    // Initialize performance tracking for each variant
    variants.forEach(variant => {
      abTest.metrics.variantPerformance.set(variant.id, {
        successRate: 0,
        averageValidationScore: 0,
        averageGenerationTime: 0,
        totalUsage: 0,
        errorRate: 0
      });
    });

    this.activeTests.set(testId, abTest);

    logger.info('Started A/B test', {
      testId,
      testName,
      moduleType,
      variantCount: variants.length,
      durationDays
    });

    logToFrontend('info', 'system', '🧪 Started A/B test', {
      testId,
      testName,
      moduleType,
      variantCount: variants.length
    });

    return abTest;
  }

  /**
   * Select prompt variant for A/B testing
   */
  selectPromptVariant(moduleType: string): PromptVersion | null {
    // Find active A/B test for this module type
    const activeTest = Array.from(this.activeTests.values())
      .find(test => test.moduleType === moduleType && test.isActive);

    if (!activeTest) {
      // No active test, return the default active prompt
      return this.getActivePrompt(moduleType);
    }

    // Select variant based on traffic split
    const random = Math.random() * 100;
    let cumulativePercentage = 0;

    for (let i = 0; i < activeTest.variants.length; i++) {
      cumulativePercentage += activeTest.trafficSplit[i];
      if (random <= cumulativePercentage) {
        logger.debug('Selected A/B test variant', {
          testId: activeTest.testId,
          variantId: activeTest.variants[i].id,
          random,
          cumulativePercentage
        });
        return activeTest.variants[i];
      }
    }

    // Fallback to first variant
    return activeTest.variants[0];
  }

  /**
   * Record prompt performance metrics
   */
  async recordPromptPerformance(
    promptId: string,
    metrics: {
      success: boolean;
      validationScore: number;
      generationTime: number;
      error?: string;
    }
  ): Promise<void> {
    // Find the prompt version
    let promptVersion: PromptVersion | null = null;
    for (const versions of this.promptVersions.values()) {
      const found = versions.find(v => v.id === promptId);
      if (found) {
        promptVersion = found;
        break;
      }
    }

    if (!promptVersion) {
      logger.warn('Prompt version not found for performance recording', { promptId });
      return;
    }

    // Update performance metrics
    const perf = promptVersion.performance;
    const newTotal = perf.totalUsage + 1;
    
    perf.averageValidationScore = (perf.averageValidationScore * perf.totalUsage + metrics.validationScore) / newTotal;
    perf.averageGenerationTime = (perf.averageGenerationTime * perf.totalUsage + metrics.generationTime) / newTotal;
    perf.totalUsage = newTotal;
    
    if (metrics.success) {
      perf.successRate = (perf.successRate * (newTotal - 1) + 100) / newTotal;
    } else {
      perf.errorRate = (perf.errorRate * (newTotal - 1) + 100) / newTotal;
    }

    // Update A/B test metrics if applicable
    const activeTest = Array.from(this.activeTests.values())
      .find(test => test.variants.some(v => v.id === promptId));

    if (activeTest) {
      activeTest.metrics.totalRequests++;
      const variantPerf = activeTest.metrics.variantPerformance.get(promptId);
      if (variantPerf) {
        const variantTotal = variantPerf.totalUsage + 1;
        variantPerf.averageValidationScore = (variantPerf.averageValidationScore * variantPerf.totalUsage + metrics.validationScore) / variantTotal;
        variantPerf.averageGenerationTime = (variantPerf.averageGenerationTime * variantPerf.totalUsage + metrics.generationTime) / variantTotal;
        variantPerf.totalUsage = variantTotal;
        
        if (metrics.success) {
          variantPerf.successRate = (variantPerf.successRate * (variantTotal - 1) + 100) / variantTotal;
        } else {
          variantPerf.errorRate = (variantPerf.errorRate * (variantTotal - 1) + 100) / variantTotal;
        }
      }
    }

    logger.debug('Recorded prompt performance', {
      promptId,
      success: metrics.success,
      validationScore: metrics.validationScore,
      generationTime: metrics.generationTime
    });
  }

  /**
   * Evaluate prompt effectiveness
   */
  async evaluatePrompt(
    promptId: string,
    generatedModule: any,
    validationResult: any
  ): Promise<PromptEvaluationMetrics> {
    const syntaxCorrectness = validationResult.errors.filter((e: any) => e.category === 'SYNTAX').length === 0 ? 100 : 0;
    const fieldValidityScore = Math.max(0, 100 - validationResult.errors.filter((e: any) => e.category === 'FIELD').length * 10);
    const templateQualityScore = Math.max(0, 100 - validationResult.errors.filter((e: any) => e.category === 'TEMPLATE').length * 15);
    
    const metrics: PromptEvaluationMetrics = {
      syntaxCorrectness,
      fieldValidityScore,
      templateQualityScore,
      accessibilityScore: validationResult.metrics.accessibility_score,
      performanceScore: validationResult.metrics.performance_score,
      overallScore: validationResult.score
    };

    logger.info('Evaluated prompt effectiveness', {
      promptId,
      metrics
    });

    return metrics;
  }

  /**
   * Get active prompt for module type
   */
  getActivePrompt(moduleType: string): PromptVersion | null {
    const versions = this.promptVersions.get(moduleType);
    if (!versions) return null;
    
    return versions.find(v => v.isActive) || versions[versions.length - 1] || null;
  }

  /**
   * Analyze A/B test results
   */
  async analyzeABTestResults(testId: string): Promise<{
    winningVariant?: string;
    confidence: number;
    recommendations: string[];
  }> {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`A/B test ${testId} not found`);
    }

    const results = Array.from(test.metrics.variantPerformance.entries())
      .map(([variantId, performance]) => ({
        variantId,
        performance,
        score: performance.averageValidationScore * 0.4 + 
               performance.successRate * 0.3 + 
               (100 - performance.errorRate) * 0.3
      }))
      .sort((a, b) => b.score - a.score);

    const winningVariant = results[0]?.variantId;
    const confidence = results.length > 1 ? 
      Math.min(95, Math.abs(results[0].score - results[1].score) * 2) : 0;

    const recommendations: string[] = [];
    
    if (confidence > 80) {
      recommendations.push(`Promote variant ${winningVariant} as the primary prompt`);
    } else if (confidence > 60) {
      recommendations.push('Continue test for more statistical significance');
    } else {
      recommendations.push('Results are inconclusive, consider revising test parameters');
    }

    if (results[0]?.performance.errorRate > 10) {
      recommendations.push('High error rate detected, review prompt quality');
    }

    logger.info('Analyzed A/B test results', {
      testId,
      winningVariant,
      confidence,
      recommendationCount: recommendations.length
    });

    return {
      winningVariant,
      confidence,
      recommendations
    };
  }

  /**
   * Get performance history for a prompt
   */
  getPromptPerformanceHistory(promptId: string): PromptPerformance[] {
    return this.performanceHistory.get(promptId) || [];
  }

  /**
   * Get all active A/B tests
   */
  getActiveABTests(): ABTestConfig[] {
    return Array.from(this.activeTests.values()).filter(test => test.isActive);
  }

  /**
   * Stop A/B test and promote winning variant
   */
  async stopABTest(testId: string, promoteWinner: boolean = true): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`A/B test ${testId} not found`);
    }

    test.isActive = false;
    test.endDate = new Date();

    if (promoteWinner) {
      const analysis = await this.analyzeABTestResults(testId);
      if (analysis.winningVariant && analysis.confidence > 70) {
        // Deactivate all current versions
        const versions = this.promptVersions.get(test.moduleType);
        if (versions) {
          versions.forEach(v => v.isActive = false);
          
          // Activate winning variant
          const winner = versions.find(v => v.id === analysis.winningVariant);
          if (winner) {
            winner.isActive = true;
            test.metrics.winningVariant = analysis.winningVariant;
          }
        }
      }
    }

    logger.info('Stopped A/B test', {
      testId,
      promoteWinner,
      winningVariant: test.metrics.winningVariant
    });

    logToFrontend('info', 'system', '🏁 Stopped A/B test', {
      testId,
      winningVariant: test.metrics.winningVariant
    });
  }
}

export default PromptVersioningService.getInstance();
