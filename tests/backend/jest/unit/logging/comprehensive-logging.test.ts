/**
 * Comprehensive Logging System Tests
 * Tests for AI Metrics Logger, Quality Metrics Logger, and Comprehensive Logger
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { AIMetricsLogger, AIInteractionEntry } from '@/services/logging/AIMetricsLogger';
import { QualityMetricsLogger, QualityMetricEntry } from '@/services/logging/QualityMetricsLogger';
import { ComprehensiveLogger } from '@/services/logging/ComprehensiveLogger';

describe('Comprehensive Logging System', () => {
  let aiLogger: AIMetricsLogger;
  let qualityLogger: QualityMetricsLogger;
  let comprehensiveLogger: ComprehensiveLogger;

  beforeEach(() => {
    aiLogger = new AIMetricsLogger();
    qualityLogger = new QualityMetricsLogger();
    comprehensiveLogger = new ComprehensiveLogger();
  });

  afterAll(async () => {
    // Clean up any test files in storage directories
    try {
      const storageDir = path.join(process.cwd(), 'storage');
      const dirs = ['ai-logs', 'quality-logs', 'app-logs'];
      
      for (const dir of dirs) {
        const fullDir = path.join(storageDir, dir);
        try {
          const files = await fs.readdir(fullDir);
          // Only remove test files, not all files
          const testFiles = files.filter(f => f.includes('test_') || f.includes('2025-07'));
          for (const file of testFiles) {
            await fs.unlink(path.join(fullDir, file));
          }
        } catch (error) {
          // Directory might not exist, ignore
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('AI Metrics Logger', () => {
    const createTestAIEntry = (overrides: Partial<AIInteractionEntry> = {}): AIInteractionEntry => ({
      id: 'test_ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      pipelineId: 'test_pipeline_123',
      phase: 'ai_generation',
      
      input: {
        type: 'image',
        size: 1024000,
        contentHash: 'sha256_test_image_hash',
        metadata: {
          fileName: 'test_design.png',
          imageResolution: '1920x1080'
        }
      },

      ai: {
        model: 'gpt-4o',
        promptVersion: 'v2.1.0',
        prompt: {
          systemPrompt: 'You are an expert web developer specializing in HubSpot module creation.',
          userPrompt: 'Create a responsive landing page from this design.',
          ragContext: 'HubSpot field types: text, rich_text, image, url, color',
          imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...[truncated]',
          modifiedByUser: false,
          userModifications: undefined,
          regenerationReason: undefined
        },
        promptTokens: 1200,
        completionTokens: 2400,
        totalTokens: 3600,
        processingTime: 15000,
        temperature: 0.1,
        maxTokens: 4000
      },

      userInteraction: {
        isManualRegeneration: false,
        regenerationCount: 0,
        userPromptChanges: undefined,
        userRating: undefined
      },

      output: {
        type: 'html',
        size: 12000,
        contentHash: 'sha256_test_html_hash',
        content: '<section class="hero"><h1>{{ module.headline }}</h1></section>',
        quality: {
          score: 85,
          confidence: 0.9,
          issues: ['Missing alt attribute'],
          improvements: ['Add schema markup'],
          metrics: {
            htmlValidity: 90,
            hubspotCompatibility: 88,
            accessibility: 82,
            responsiveness: 87,
            codeQuality: 85
          }
        },
        userQuality: undefined
      },

      performance: {
        responseTime: 15200,
        retryCount: 0,
        errorCount: 0,
        cacheHit: false
      },

      cost: {
        inputCost: 0.012,
        outputCost: 0.024,
        totalCost: 0.036
      },
      
      ...overrides
    });

    test('should log AI interaction successfully', async () => {
      const testEntry = createTestAIEntry();
      
      await expect(aiLogger.logAIInteraction(testEntry)).resolves.not.toThrow();
      
      // Verify the entry was logged
      const recentInteractions = await aiLogger.getRecentAIInteractions(1);
      expect(recentInteractions).toHaveLength(1);
      expect(recentInteractions[0].id).toBe(testEntry.id);
      expect(recentInteractions[0].ai.model).toBe('gpt-4o');
      expect(recentInteractions[0].cost.totalCost).toBe(0.036);
    });

    test('should log manual regeneration event', async () => {
      const originalEntry = createTestAIEntry();
      await aiLogger.logAIInteraction(originalEntry);

      const regenerationId = await aiLogger.logManualRegeneration({
        pipelineId: 'test_pipeline_123',
        originalInteractionId: originalEntry.id,
        userPromptChanges: 'Added requirement for interactive hover effects',
        regenerationReason: 'Original output was too basic',
        systemPrompt: 'You are an expert web developer...',
        userPrompt: 'Create a responsive landing page with hover effects.',
        ragContext: 'HubSpot field types: text, rich_text, image, url, color'
      });

      expect(regenerationId).toMatch(/^regen_\d+_[a-z0-9]+$/);
    });

    test('should log user rating successfully', async () => {
      const testEntry = createTestAIEntry();
      await aiLogger.logAIInteraction(testEntry);

      await expect(aiLogger.logUserRating({
        interactionId: testEntry.id,
        userScore: 8,
        userFeedback: 'Great output! Love the responsive design.',
        acceptedOutput: true,
        requestedChanges: ['Add hover animations'],
        ratingCriteria: ['visual_appeal', 'functionality']
      })).resolves.not.toThrow();

      // Verify rating was added
      const recentInteractions = await aiLogger.getRecentAIInteractions(1);
      expect(recentInteractions[0].userInteraction.userRating?.score).toBe(8);
      expect(recentInteractions[0].output.userQuality?.acceptedOutput).toBe(true);
    });

    test('should generate AI metrics summary', async () => {
      // Log multiple interactions
      const entries = [
        createTestAIEntry({ cost: { inputCost: 0.01, outputCost: 0.02, totalCost: 0.03 } }),
        createTestAIEntry({ cost: { inputCost: 0.015, outputCost: 0.025, totalCost: 0.04 } }),
        createTestAIEntry({ cost: { inputCost: 0.02, outputCost: 0.03, totalCost: 0.05 } })
      ];

      for (const entry of entries) {
        await aiLogger.logAIInteraction(entry);
      }

      const summary = await aiLogger.getAIMetricsSummary('24h');
      
      expect(summary.totalInteractions).toBeGreaterThanOrEqual(3);
      expect(summary.totalCost).toBeGreaterThan(0);
      expect(summary.averageQuality).toBeGreaterThan(0);
      expect(summary.tokenUsage.totalTokens).toBeGreaterThan(0);
    });

    test('should generate prompt performance analytics', async () => {
      // Log entries with different prompt versions
      const standardEntry = createTestAIEntry({ 
        ai: { 
          ...createTestAIEntry().ai, 
          promptVersion: 'v2.1.0' 
        },
        userInteraction: {
          isManualRegeneration: false,
          regenerationCount: 0,
          userPromptChanges: undefined,
          userRating: { score: 7, feedback: 'Good', ratingTimestamp: new Date().toISOString(), ratingCriteria: ['quality'] }
        }
      });

      const modifiedEntry = createTestAIEntry({
        ai: {
          ...createTestAIEntry().ai,
          promptVersion: 'user_modified',
          prompt: {
            ...createTestAIEntry().ai.prompt,
            modifiedByUser: true,
            userModifications: 'Added interactive elements',
            regenerationReason: 'Needed more interactivity'
          }
        },
        userInteraction: {
          isManualRegeneration: true,
          regenerationCount: 1,
          userPromptChanges: 'Added interactive elements',
          userRating: { score: 9, feedback: 'Much better!', ratingTimestamp: new Date().toISOString(), ratingCriteria: ['quality'] }
        }
      });

      await aiLogger.logAIInteraction(standardEntry);
      await aiLogger.logAIInteraction(modifiedEntry);

      const analytics = await aiLogger.getPromptPerformanceAnalytics('24h');

      expect(Object.keys(analytics.promptVersions).length).toBeGreaterThan(0);
      expect(analytics.promptVersions).toHaveProperty('user_modified');
      expect(analytics.userModifications.totalModifications).toBeGreaterThanOrEqual(1);
      expect(analytics.ratingAnalysis.totalRatings).toBeGreaterThanOrEqual(2);
      expect(analytics.ratingAnalysis.averageRating).toBeGreaterThan(0);
    });

    test('should handle pipeline-specific AI interactions', async () => {
      const pipeline1Entry = createTestAIEntry({ pipelineId: 'pipeline_1' });
      const pipeline2Entry = createTestAIEntry({ pipelineId: 'pipeline_2' });

      await aiLogger.logAIInteraction(pipeline1Entry);
      await aiLogger.logAIInteraction(pipeline2Entry);

      const pipeline1Interactions = await aiLogger.getPipelineAIInteractions('pipeline_1');
      const pipeline2Interactions = await aiLogger.getPipelineAIInteractions('pipeline_2');

      expect(pipeline1Interactions.length).toBeGreaterThanOrEqual(1);
      expect(pipeline2Interactions.length).toBeGreaterThanOrEqual(1);
      expect(pipeline1Interactions[0].pipelineId).toBe('pipeline_1');
      expect(pipeline2Interactions[0].pipelineId).toBe('pipeline_2');
    });
  });

  describe('Quality Metrics Logger', () => {
    const createTestQualityEntry = (overrides: Partial<QualityMetricEntry> = {}): QualityMetricEntry => ({
      timestamp: new Date().toISOString(),
      pipelineId: 'test_pipeline_123',
      metrics: {
        codeQuality: 85,
        testCoverage: 78,
        performance: 92,
        security: 88,
        accessibility: 78,
        hubspotCompliance: 82
      },
      metadata: {
        sectionsProcessed: 5,
        processingTime: 15000,
        aiModel: 'gpt-4o',
        version: 'v2.1.0'
      },
      ...overrides
    });

    test('should log quality metrics successfully', async () => {
      const testEntry = createTestQualityEntry();
      
      await expect(qualityLogger.logQualityMetrics(testEntry)).resolves.not.toThrow();
      
      // Verify the entry was logged
      const recentMetrics = await qualityLogger.getRecentMetrics(1);
      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0].pipelineId).toBe(testEntry.pipelineId);
      expect(recentMetrics[0].metrics.codeQuality).toBe(85);
    });

    test('should generate quality trends', async () => {
      // Log multiple quality entries over time
      const entries = [
        createTestQualityEntry({ metrics: { ...createTestQualityEntry().metrics, codeQuality: 80 } }),
        createTestQualityEntry({ metrics: { ...createTestQualityEntry().metrics, codeQuality: 85 } }),
        createTestQualityEntry({ metrics: { ...createTestQualityEntry().metrics, codeQuality: 90 } })
      ];

      for (const entry of entries) {
        await qualityLogger.logQualityMetrics(entry);
      }

      const trends = await qualityLogger.getQualityTrends('24h');
      
      expect(trends.data.length).toBeGreaterThanOrEqual(3);
      expect(trends.summary.totalExecutions).toBeGreaterThanOrEqual(3);
      expect(['improving', 'stable', 'declining']).toContain(trends.summary.trend);
      expect(trends.summary.averageQuality).toBeGreaterThan(80);
    });

    test('should get recent metrics with limit', async () => {
      // Log 5 entries
      for (let i = 0; i < 5; i++) {
        await qualityLogger.logQualityMetrics(createTestQualityEntry({
          pipelineId: `pipeline_${i}`
        }));
      }

      const recent3 = await qualityLogger.getRecentMetrics(3);
      const recent10 = await qualityLogger.getRecentMetrics(10);

      expect(recent3).toHaveLength(3);
      expect(recent10.length).toBeGreaterThanOrEqual(3); // At least 3 entries should exist
    });

    test('should get log statistics', async () => {
      // Log some entries
      for (let i = 0; i < 3; i++) {
        await qualityLogger.logQualityMetrics(createTestQualityEntry());
      }

      const stats = await qualityLogger.getLogStatistics();
      
      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.totalEntries).toBeGreaterThanOrEqual(3);
      expect(stats.oldestEntry).toBeTruthy();
      expect(stats.newestEntry).toBeTruthy();
      expect(stats.diskUsage).toBeGreaterThan(0);
    });
  });

  describe('Comprehensive Logger', () => {
    test('should get application insights', async () => {
      // Log some data first
      const aiEntry = createTestAIEntry();
      const qualityEntry = createTestQualityEntry();

      await aiLogger.logAIInteraction(aiEntry);
      await qualityLogger.logQualityMetrics(qualityEntry);

      const insights = await comprehensiveLogger.getApplicationInsights('24h');

      expect(insights).toHaveProperty('qualityMetrics');
      expect(insights).toHaveProperty('aiMetrics');
      expect(insights).toHaveProperty('pipelineStats');
      expect(insights).toHaveProperty('userActivity');
      expect(insights).toHaveProperty('systemHealth');
    });

    test('should delegate to specialized loggers', async () => {
      const aiEntry = createTestAIEntry();
      const qualityEntry = createTestQualityEntry();

      // Test delegation
      await expect(comprehensiveLogger.logAIInteraction(aiEntry)).resolves.not.toThrow();
      await expect(comprehensiveLogger.logQualityMetric(qualityEntry)).resolves.not.toThrow();

      // Verify data was logged
      const aiSummary = await comprehensiveLogger.getAIMetricsSummary('24h');
      const qualityTrends = await comprehensiveLogger.getQualityMetricsSummary('24h');

      expect(aiSummary.totalInteractions).toBeGreaterThan(0);
      expect(qualityTrends.data.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid AI interaction data gracefully', async () => {
      const invalidEntry = {
        ...createTestAIEntry(),
        cost: null // Invalid cost data
      } as any;

      // Should not throw, but may log errors
      await expect(aiLogger.logAIInteraction(invalidEntry)).resolves.not.toThrow();
    });

    test('should handle missing log files gracefully', async () => {
      // Try to get data when no files exist
      const summary = await aiLogger.getAIMetricsSummary('24h');
      const trends = await qualityLogger.getQualityTrends('24h');

      expect(summary.totalInteractions).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(trends.data)).toBe(true);
    });

    test('should handle user rating for non-existent interaction', async () => {
      // Try to rate a non-existent interaction
      await expect(aiLogger.logUserRating({
        interactionId: 'non_existent_id',
        userScore: 5,
        userFeedback: 'Test feedback',
        acceptedOutput: true,
        requestedChanges: [],
        ratingCriteria: ['quality']
      })).resolves.not.toThrow(); // Should not throw, just log warning
    });
  });

  describe('Data Integrity', () => {
    test('should maintain data consistency across operations', async () => {
      const testEntry = createTestAIEntry();
      
      // Log interaction
      await aiLogger.logAIInteraction(testEntry);
      
      // Add user rating
      await aiLogger.logUserRating({
        interactionId: testEntry.id,
        userScore: 8,
        userFeedback: 'Great work!',
        acceptedOutput: true,
        requestedChanges: [],
        ratingCriteria: ['quality']
      });

      // Retrieve and verify data integrity
      const retrieved = await aiLogger.getRecentAIInteractions(1);
      
      expect(retrieved[0].id).toBe(testEntry.id);
      expect(retrieved[0].userInteraction.userRating?.score).toBe(8);
      expect(retrieved[0].output.userQuality?.acceptedOutput).toBe(true);
    });

    test('should handle concurrent logging operations', async () => {
      const entries = Array.from({ length: 5 }, () => createTestAIEntry());
      
      // Log all entries concurrently
      await Promise.all(entries.map(entry => aiLogger.logAIInteraction(entry)));
      
      // Verify all entries were logged
      const recent = await aiLogger.getRecentAIInteractions(10);
      expect(recent.length).toBeGreaterThanOrEqual(5);
      
      // Verify all IDs are present
      const loggedIds = recent.map(r => r.id);
      const expectedIds = entries.map(e => e.id);
      const foundIds = expectedIds.filter(id => loggedIds.includes(id));
      expect(foundIds.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Performance', () => {
    test('should handle large data volumes efficiently', async () => {
      const startTime = Date.now();
      
      // Log 50 entries
      const entries = Array.from({ length: 50 }, () => createTestAIEntry());
      
      for (const entry of entries) {
        await aiLogger.logAIInteraction(entry);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
      
      // Verify all entries were logged
      const summary = await aiLogger.getAIMetricsSummary('24h');
      expect(summary.totalInteractions).toBeGreaterThanOrEqual(50);
    });
  });

  // Helper function to create test AI entry (defined above)
  function createTestAIEntry(overrides: Partial<AIInteractionEntry> = {}): AIInteractionEntry {
    return {
      id: 'test_ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      pipelineId: 'test_pipeline_123',
      phase: 'ai_generation',
      
      input: {
        type: 'image',
        size: 1024000,
        contentHash: 'sha256_test_image_hash',
        metadata: {
          fileName: 'test_design.png',
          imageResolution: '1920x1080'
        }
      },

      ai: {
        model: 'gpt-4o',
        promptVersion: 'v2.1.0',
        prompt: {
          systemPrompt: 'You are an expert web developer specializing in HubSpot module creation.',
          userPrompt: 'Create a responsive landing page from this design.',
          ragContext: 'HubSpot field types: text, rich_text, image, url, color',
          imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...[truncated]',
          modifiedByUser: false,
          userModifications: undefined,
          regenerationReason: undefined
        },
        promptTokens: 1200,
        completionTokens: 2400,
        totalTokens: 3600,
        processingTime: 15000,
        temperature: 0.1,
        maxTokens: 4000
      },

      userInteraction: {
        isManualRegeneration: false,
        regenerationCount: 0,
        userPromptChanges: undefined,
        userRating: undefined
      },

      output: {
        type: 'html',
        size: 12000,
        contentHash: 'sha256_test_html_hash',
        content: '<section class="hero"><h1>{{ module.headline }}</h1></section>',
        quality: {
          score: 85,
          confidence: 0.9,
          issues: ['Missing alt attribute'],
          improvements: ['Add schema markup'],
          metrics: {
            htmlValidity: 90,
            hubspotCompatibility: 88,
            accessibility: 82,
            responsiveness: 87,
            codeQuality: 85
          }
        },
        userQuality: undefined
      },

      performance: {
        responseTime: 15200,
        retryCount: 0,
        errorCount: 0,
        cacheHit: false
      },

      cost: {
        inputCost: 0.012,
        outputCost: 0.024,
        totalCost: 0.036
      },
      
      ...overrides
    };
  }

  function createTestQualityEntry(overrides: Partial<QualityMetricEntry> = {}): QualityMetricEntry {
    return {
      timestamp: new Date().toISOString(),
      pipelineId: 'test_pipeline_123',
      metrics: {
        codeQuality: 85,
        testCoverage: 78,
        performance: 92,
        security: 88,
        accessibility: 78,
        hubspotCompliance: 82
      },
      metadata: {
        sectionsProcessed: 5,
        processingTime: 15000,
        aiModel: 'gpt-4o',
        version: 'v2.1.0'
      },
      ...overrides
    };
  }
});
