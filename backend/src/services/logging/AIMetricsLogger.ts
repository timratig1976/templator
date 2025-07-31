/**
 * AI Metrics Logger
 * Comprehensive logging for AI interactions, prompts, outputs, and quality metrics
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

export interface AIInteractionEntry {
  id: string;
  timestamp: string;
  pipelineId: string;
  phase: 'input_processing' | 'ai_generation' | 'quality_assurance' | 'enhancement' | 'packaging';
  
  // Input data
  input: {
    type: 'image' | 'text' | 'html' | 'validation_results';
    size: number; // bytes or character count
    contentHash: string; // for deduplication
    metadata: Record<string, any>;
  };

  // AI Processing with Full Prompt Details
  ai: {
    model: string; // e.g., 'gpt-4o', 'gpt-4-turbo'
    promptVersion: string;
    
    // EXACT PROMPT CONTENT
    prompt: {
      systemPrompt: string;           // Complete system prompt
      userPrompt: string;             // User/instruction prompt
      ragContext?: string;            // RAG context if applicable
      imageData?: string;             // Base64 image data (truncated for logging)
      modifiedByUser: boolean;        // Was prompt manually modified?
      userModifications?: string;     // What user changed
      regenerationReason?: string;    // Why user regenerated
    };
    
    // Token and performance metrics
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    processingTime: number; // milliseconds
    temperature: number;
    maxTokens: number;
  };

  // User Interaction Tracking
  userInteraction: {
    isManualRegeneration: boolean;  // User clicked regenerate?
    regenerationCount: number;      // How many times regenerated
    userPromptChanges?: string;     // User's prompt modifications
    userRating?: {
      score: number;                // User's rating (1-5 or 1-10)
      feedback?: string;            // User's text feedback
      ratingTimestamp: string;      // When user rated
      ratingCriteria?: string[];    // What user rated (quality, accuracy, etc.)
    };
  };

  // Output data with Enhanced Quality Tracking
  output: {
    type: 'html' | 'json' | 'text' | 'validation_report';
    size: number;
    contentHash: string;
    content?: string;               // Actual output content (truncated if too large)
    
    // Automated Quality Assessment
    quality: {
      score: number;                // 0-100 automated score
      confidence: number;           // 0-1 AI confidence
      issues: string[];
      improvements: string[];
      
      // Detailed Quality Metrics
      metrics: {
        htmlValidity?: number;      // HTML validation score
        hubspotCompatibility?: number; // HubSpot compatibility score
        accessibility?: number;     // Accessibility score
        responsiveness?: number;    // Responsive design score
        codeQuality?: number;       // Code quality score
      };
    };
    
    // User Quality Assessment
    userQuality?: {
      userScore: number;            // User's quality rating
      userFeedback?: string;        // User's quality feedback
      acceptedOutput: boolean;      // Did user accept this output?
      requestedChanges?: string[];  // What changes user requested
    };
  };

  // Performance metrics
  performance: {
    responseTime: number;
    retryCount: number;
    errorCount: number;
    cacheHit: boolean;
  };

  // Cost tracking
  cost: {
    inputCost: number; // USD
    outputCost: number; // USD
    totalCost: number; // USD
  };
}

export interface AIMetricsSummary {
  period: '1h' | '24h' | '7d' | '30d';
  totalInteractions: number;
  totalCost: number;
  averageQuality: number;
  averageResponseTime: number;
  tokenUsage: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
  };
  modelUsage: Record<string, number>;
  errorRate: number;
  cacheHitRate: number;
}

export class AIMetricsLogger {
  private readonly logDir: string;
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB for AI logs (larger due to content)
  private readonly maxFiles = 6; // Keep 6 months of AI interaction data

  constructor() {
    this.logDir = path.join(process.cwd(), 'storage', 'ai-logs');
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      logger.info('AI metrics log directory initialized', { logDir: this.logDir });
    } catch (error) {
      logger.error('Failed to create AI metrics log directory', { error, logDir: this.logDir });
      throw error;
    }
  }

  /**
   * Log AI interaction with enhanced prompt and user data
   */
  async logAIInteraction(entry: AIInteractionEntry): Promise<void> {
    try {
      const filename = this.getLogFilename(new Date(entry.timestamp));
      const filepath = path.join(this.logDir, filename);

      // Read existing data or create new array
      let existingData: AIInteractionEntry[] = [];
      try {
        const fileContent = await fs.readFile(filepath, 'utf-8');
        existingData = JSON.parse(fileContent);
      } catch (error) {
        // File doesn't exist, start with empty array
        existingData = [];
      }

      // Add new entry
      existingData.push(entry);

      // Sort by timestamp (newest first)
      existingData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Write back to file
      await fs.writeFile(filepath, JSON.stringify(existingData, null, 2), 'utf-8');

      logger.info('AI interaction logged successfully', {
        id: entry.id,
        pipelineId: entry.pipelineId,
        phase: entry.phase,
        model: entry.ai.model,
        promptVersion: entry.ai.promptVersion,
        totalTokens: entry.ai.totalTokens,
        cost: entry.cost.totalCost,
        quality: entry.output.quality.score,
        userRating: entry.userInteraction.userRating?.score,
        isManualRegeneration: entry.userInteraction.isManualRegeneration,
        regenerationCount: entry.userInteraction.regenerationCount,
        filename
      });

      // Check if file rotation is needed
      await this.rotateLogsIfNeeded();

    } catch (error) {
      logger.error('Failed to log AI interaction', { error, entryId: entry.id });
      throw error;
    }
  }

  /**
   * Get AI metrics summary for a period
   */
  async getAIMetricsSummary(period: '1h' | '24h' | '7d' | '30d'): Promise<AIMetricsSummary> {
    try {
      const now = new Date();
      const periodStart = this.getPeriodStart(now, period);
      
      // Get all relevant log files
      const logFiles = await this.getLogFilesInPeriod(periodStart, now);
      
      // Read and aggregate data
      const allEntries: AIInteractionEntry[] = [];
      
      for (const filename of logFiles) {
        try {
          const filepath = path.join(this.logDir, filename);
          const fileContent = await fs.readFile(filepath, 'utf-8');
          const entries: AIInteractionEntry[] = JSON.parse(fileContent);
          
          // Filter entries within the period
          const filteredEntries = entries.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate >= periodStart && entryDate <= now;
          });
          
          allEntries.push(...filteredEntries);
        } catch (error) {
          logger.warn('Failed to read AI log file', { filename, error });
        }
      }

      // Calculate summary
      return this.calculateAIMetricsSummary(allEntries, period);

    } catch (error) {
      logger.error('Failed to get AI metrics summary', { error, period });
      throw error;
    }
  }

  /**
   * Get recent AI interactions
   */
  async getRecentAIInteractions(limit: number = 20): Promise<AIInteractionEntry[]> {
    try {
      const now = new Date();
      const filename = this.getLogFilename(now);
      const filepath = path.join(this.logDir, filename);

      try {
        const fileContent = await fs.readFile(filepath, 'utf-8');
        const entries: AIInteractionEntry[] = JSON.parse(fileContent);
        
        // Return most recent entries
        return entries.slice(0, limit);
      } catch (error) {
        // File doesn't exist, return empty array
        return [];
      }

    } catch (error) {
      logger.error('Failed to get recent AI interactions', { error, limit });
      return [];
    }
  }

  /**
   * Get AI interactions for a specific pipeline
   */
  async getPipelineAIInteractions(pipelineId: string): Promise<AIInteractionEntry[]> {
    try {
      // Search through recent log files (last 3 months)
      const now = new Date();
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const logFiles = await this.getLogFilesInPeriod(threeMonthsAgo, now);
      const pipelineEntries: AIInteractionEntry[] = [];
      
      for (const filename of logFiles) {
        try {
          const filepath = path.join(this.logDir, filename);
          const fileContent = await fs.readFile(filepath, 'utf-8');
          const entries: AIInteractionEntry[] = JSON.parse(fileContent);
          
          // Filter entries for this pipeline
          const filteredEntries = entries.filter(entry => entry.pipelineId === pipelineId);
          pipelineEntries.push(...filteredEntries);
        } catch (error) {
          logger.warn('Failed to read AI log file for pipeline search', { filename, error });
        }
      }

      // Sort by timestamp
      pipelineEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      return pipelineEntries;

    } catch (error) {
      logger.error('Failed to get pipeline AI interactions', { error, pipelineId });
      return [];
    }
  }

  /**
   * Calculate AI metrics summary
   */
  private calculateAIMetricsSummary(entries: AIInteractionEntry[], period: string): AIMetricsSummary {
    if (entries.length === 0) {
      return {
        period: period as any,
        totalInteractions: 0,
        totalCost: 0,
        averageQuality: 0,
        averageResponseTime: 0,
        tokenUsage: {
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0
        },
        modelUsage: {},
        errorRate: 0,
        cacheHitRate: 0
      };
    }

    // Calculate totals and averages
    const totalCost = entries.reduce((sum, entry) => sum + entry.cost.totalCost, 0);
    const averageQuality = entries.reduce((sum, entry) => sum + entry.output.quality.score, 0) / entries.length;
    const averageResponseTime = entries.reduce((sum, entry) => sum + entry.performance.responseTime, 0) / entries.length;
    
    // Token usage
    const totalTokens = entries.reduce((sum, entry) => sum + entry.ai.totalTokens, 0);
    const promptTokens = entries.reduce((sum, entry) => sum + entry.ai.promptTokens, 0);
    const completionTokens = entries.reduce((sum, entry) => sum + entry.ai.completionTokens, 0);

    // Model usage
    const modelUsage: Record<string, number> = {};
    entries.forEach(entry => {
      modelUsage[entry.ai.model] = (modelUsage[entry.ai.model] || 0) + 1;
    });

    // Error rate
    const errorCount = entries.reduce((sum, entry) => sum + entry.performance.errorCount, 0);
    const errorRate = errorCount / entries.length;

    // Cache hit rate
    const cacheHits = entries.filter(entry => entry.performance.cacheHit).length;
    const cacheHitRate = cacheHits / entries.length;

    return {
      period: period as any,
      totalInteractions: entries.length,
      totalCost: Math.round(totalCost * 100) / 100,
      averageQuality: Math.round(averageQuality * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      tokenUsage: {
        totalTokens,
        promptTokens,
        completionTokens
      },
      modelUsage,
      errorRate: Math.round(errorRate * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100
    };
  }

  /**
   * Helper methods
   */
  private getLogFilename(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `ai-metrics-${year}-${month}.json`;
  }

  private getPeriodStart(now: Date, period: '1h' | '24h' | '7d' | '30d'): Date {
    const start = new Date(now);
    
    switch (period) {
      case '1h':
        start.setHours(start.getHours() - 1);
        break;
      case '24h':
        start.setHours(start.getHours() - 24);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
    }
    
    return start;
  }

  private async getLogFilesInPeriod(start: Date, end: Date): Promise<string[]> {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('ai-metrics-') && file.endsWith('.json'));
      
      // Filter files that might contain data in the period
      const relevantFiles = logFiles.filter(filename => {
        const match = filename.match(/ai-metrics-(\d{4})-(\d{2})\.json/);
        if (!match) return false;
        
        const fileYear = parseInt(match[1]);
        const fileMonth = parseInt(match[2]);
        const fileDate = new Date(fileYear, fileMonth - 1, 1);
        const fileEndDate = new Date(fileYear, fileMonth, 0);
        
        return fileDate <= end && fileEndDate >= start;
      });

      return relevantFiles.sort();
    } catch (error) {
      logger.error('Failed to get AI log files in period', { error, start, end });
      return [];
    }
  }

  private async rotateLogsIfNeeded(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('ai-metrics-') && file.endsWith('.json'));

      // Remove old files if we have too many
      if (logFiles.length > this.maxFiles) {
        const sortedFiles = logFiles.sort();
        const filesToRemove = sortedFiles.slice(0, logFiles.length - this.maxFiles);
        
        for (const filename of filesToRemove) {
          const filepath = path.join(this.logDir, filename);
          await fs.unlink(filepath);
          logger.info('Old AI log file removed', { filename });
        }
      }

    } catch (error) {
      logger.error('Failed to rotate AI logs', { error });
    }
  }

  /**
   * Log manual HTML regeneration event
   */
  async logManualRegeneration({
    pipelineId,
    originalInteractionId,
    userPromptChanges,
    regenerationReason,
    systemPrompt,
    userPrompt,
    ragContext
  }: {
    pipelineId: string;
    originalInteractionId: string;
    userPromptChanges: string;
    regenerationReason: string;
    systemPrompt: string;
    userPrompt: string;
    ragContext?: string;
  }): Promise<string> {
    const regenerationId = `regen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const regenerationEntry: Partial<AIInteractionEntry> = {
      id: regenerationId,
      timestamp: new Date().toISOString(),
      pipelineId,
      phase: 'ai_generation',
      
      ai: {
        model: '', // Will be filled when actual AI call is made
        promptVersion: 'user_modified',
        prompt: {
          systemPrompt,
          userPrompt,
          ragContext,
          modifiedByUser: true,
          userModifications: userPromptChanges,
          regenerationReason
        },
        promptTokens: 0, // Will be updated
        completionTokens: 0,
        totalTokens: 0,
        processingTime: 0,
        temperature: 0,
        maxTokens: 0
      },
      
      userInteraction: {
        isManualRegeneration: true,
        regenerationCount: 1, // Will be updated based on history
        userPromptChanges
      }
    };

    logger.info('Manual regeneration initiated', {
      regenerationId,
      pipelineId,
      originalInteractionId,
      userPromptChanges: userPromptChanges.substring(0, 100) + '...', // Truncate for logging
      regenerationReason
    });

    return regenerationId;
  }

  /**
   * Log user rating/score for AI output
   */
  async logUserRating({
    interactionId,
    userScore,
    userFeedback,
    acceptedOutput,
    requestedChanges,
    ratingCriteria
  }: {
    interactionId: string;
    userScore: number;
    userFeedback?: string;
    acceptedOutput: boolean;
    requestedChanges?: string[];
    ratingCriteria?: string[];
  }): Promise<void> {
    try {
      // Find and update the existing interaction entry
      const now = new Date();
      const filename = this.getLogFilename(now);
      const filepath = path.join(this.logDir, filename);

      let existingData: AIInteractionEntry[] = [];
      try {
        const fileContent = await fs.readFile(filepath, 'utf-8');
        existingData = JSON.parse(fileContent);
      } catch (error) {
        logger.warn('Could not find existing AI log file for rating update', { filename });
        return;
      }

      // Find the interaction to update
      const interactionIndex = existingData.findIndex(entry => entry.id === interactionId);
      if (interactionIndex === -1) {
        logger.warn('Could not find AI interaction to update with user rating', { interactionId });
        return;
      }

      // Update the interaction with user rating
      existingData[interactionIndex].userInteraction.userRating = {
        score: userScore,
        feedback: userFeedback,
        ratingTimestamp: new Date().toISOString(),
        ratingCriteria
      };

      existingData[interactionIndex].output.userQuality = {
        userScore,
        userFeedback,
        acceptedOutput,
        requestedChanges
      };

      // Write back to file
      await fs.writeFile(filepath, JSON.stringify(existingData, null, 2), 'utf-8');

      logger.info('User rating logged successfully', {
        interactionId,
        userScore,
        acceptedOutput,
        hasFeedback: !!userFeedback,
        hasRequestedChanges: !!requestedChanges?.length
      });

    } catch (error) {
      logger.error('Failed to log user rating', { error, interactionId });
    }
  }

  /**
   * Get prompt performance analytics
   */
  async getPromptPerformanceAnalytics(period: '1h' | '24h' | '7d' | '30d' = '7d'): Promise<{
    promptVersions: Record<string, {
      count: number;
      averageQuality: number;
      averageUserRating: number;
      averageCost: number;
      regenerationRate: number;
    }>;
    userModifications: {
      totalModifications: number;
      commonReasons: Record<string, number>;
      improvementRate: number; // % of modifications that improved quality
    };
    ratingAnalysis: {
      totalRatings: number;
      averageRating: number;
      acceptanceRate: number;
      commonFeedback: string[];
    };
  }> {
    try {
      const now = new Date();
      const periodStart = this.getPeriodStart(now, period);
      const logFiles = await this.getLogFilesInPeriod(periodStart, now);
      const allEntries: AIInteractionEntry[] = [];
      
      // Collect all entries in period
      for (const filename of logFiles) {
        try {
          const filepath = path.join(this.logDir, filename);
          const fileContent = await fs.readFile(filepath, 'utf-8');
          const entries: AIInteractionEntry[] = JSON.parse(fileContent);
          
          const filteredEntries = entries.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate >= periodStart && entryDate <= now;
          });
          
          allEntries.push(...filteredEntries);
        } catch (error) {
          logger.warn('Failed to read AI log file for prompt analytics', { filename, error });
        }
      }

      // Analyze prompt versions
      const promptVersions: Record<string, any> = {};
      const userModifications = {
        totalModifications: 0,
        commonReasons: {} as Record<string, number>,
        improvementRate: 0
      };
      const ratingAnalysis = {
        totalRatings: 0,
        averageRating: 0,
        acceptanceRate: 0,
        commonFeedback: [] as string[]
      };

      let totalRatingSum = 0;
      let acceptedCount = 0;
      let modificationsWithImprovement = 0;

      allEntries.forEach(entry => {
        const version = entry.ai.promptVersion;
        
        // Track prompt version performance
        if (!promptVersions[version]) {
          promptVersions[version] = {
            count: 0,
            qualitySum: 0,
            userRatingSum: 0,
            userRatingCount: 0,
            costSum: 0,
            regenerationCount: 0
          };
        }
        
        const versionData = promptVersions[version];
        versionData.count++;
        versionData.qualitySum += entry.output.quality.score;
        versionData.costSum += entry.cost.totalCost;
        
        if (entry.userInteraction.isManualRegeneration) {
          versionData.regenerationCount++;
        }
        
        // Track user modifications
        if (entry.ai.prompt.modifiedByUser) {
          userModifications.totalModifications++;
          
          if (entry.ai.prompt.regenerationReason) {
            const reason = entry.ai.prompt.regenerationReason;
            userModifications.commonReasons[reason] = (userModifications.commonReasons[reason] || 0) + 1;
          }
          
          // Check if modification improved quality (compare with previous version if available)
          if (entry.output.userQuality?.userScore && entry.output.userQuality.userScore > entry.output.quality.score) {
            modificationsWithImprovement++;
          }
        }
        
        // Track user ratings
        if (entry.userInteraction.userRating) {
          ratingAnalysis.totalRatings++;
          totalRatingSum += entry.userInteraction.userRating.score;
          versionData.userRatingSum += entry.userInteraction.userRating.score;
          versionData.userRatingCount++;
          
          if (entry.userInteraction.userRating.feedback) {
            ratingAnalysis.commonFeedback.push(entry.userInteraction.userRating.feedback);
          }
        }
        
        if (entry.output.userQuality?.acceptedOutput) {
          acceptedCount++;
        }
      });

      // Calculate final metrics
      Object.keys(promptVersions).forEach(version => {
        const data = promptVersions[version];
        promptVersions[version] = {
          count: data.count,
          averageQuality: Math.round((data.qualitySum / data.count) * 100) / 100,
          averageUserRating: data.userRatingCount > 0 ? Math.round((data.userRatingSum / data.userRatingCount) * 100) / 100 : 0,
          averageCost: Math.round((data.costSum / data.count) * 10000) / 10000,
          regenerationRate: Math.round((data.regenerationCount / data.count) * 100) / 100
        };
      });

      userModifications.improvementRate = userModifications.totalModifications > 0 
        ? Math.round((modificationsWithImprovement / userModifications.totalModifications) * 100) / 100 
        : 0;

      ratingAnalysis.averageRating = ratingAnalysis.totalRatings > 0 
        ? Math.round((totalRatingSum / ratingAnalysis.totalRatings) * 100) / 100 
        : 0;
      
      ratingAnalysis.acceptanceRate = allEntries.length > 0 
        ? Math.round((acceptedCount / allEntries.length) * 100) / 100 
        : 0;

      return {
        promptVersions,
        userModifications,
        ratingAnalysis
      };

    } catch (error) {
      logger.error('Failed to get prompt performance analytics', { error, period });
      throw error;
    }
  }
}
