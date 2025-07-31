/**
 * Test script for AI and Quality Metrics Logging
 * Run this to verify logging implementation works correctly
 */

import { AIMetricsLogger, AIInteractionEntry } from './src/services/logging/AIMetricsLogger';
import { QualityMetricsLogger, QualityMetricEntry } from './src/services/logging/QualityMetricsLogger';
import { ComprehensiveLogger } from './src/services/logging/ComprehensiveLogger';

async function testLoggingImplementation() {
  console.log('🧪 Testing Templator Logging Implementation...\n');

  try {
    // Initialize loggers
    const aiLogger = new AIMetricsLogger();
    const qualityLogger = new QualityMetricsLogger();
    const comprehensiveLogger = new ComprehensiveLogger();

    console.log('✅ Loggers initialized successfully');

    // Test 1: AI Interaction Logging
    console.log('\n📝 Test 1: AI Interaction Logging');
    
    const testAIEntry: AIInteractionEntry = {
      id: 'test_ai_' + Date.now(),
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
      }
    };

    await aiLogger.logAIInteraction(testAIEntry);
    console.log('✅ AI interaction logged successfully');

    // Test 2: Manual Regeneration Logging
    console.log('\n🔄 Test 2: Manual Regeneration Logging');
    
    const regenerationId = await aiLogger.logManualRegeneration({
      pipelineId: 'test_pipeline_123',
      originalInteractionId: testAIEntry.id,
      userPromptChanges: 'Added requirement for interactive hover effects and testimonials section',
      regenerationReason: 'Original output was too basic, needed more interactive elements',
      systemPrompt: 'You are an expert web developer specializing in HubSpot module creation.',
      userPrompt: 'Create a responsive landing page with hover effects and testimonials section.',
      ragContext: 'HubSpot field types: text, rich_text, image, url, color'
    });
    
    console.log('✅ Manual regeneration logged with ID:', regenerationId);

    // Test 3: User Rating Logging
    console.log('\n⭐ Test 3: User Rating Logging');
    
    await aiLogger.logUserRating({
      interactionId: testAIEntry.id,
      userScore: 8,
      userFeedback: 'Great output! Love the responsive design. Could use more interactive elements.',
      acceptedOutput: true,
      requestedChanges: ['Add hover animations', 'Include testimonials'],
      ratingCriteria: ['visual_appeal', 'functionality', 'responsiveness']
    });
    
    console.log('✅ User rating logged successfully');

    // Test 4: Quality Metrics Logging
    console.log('\n📊 Test 4: Quality Metrics Logging');
    
    const testQualityEntry: QualityMetricEntry = {
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
      }
    };

    await qualityLogger.logQualityMetrics(testQualityEntry);
    console.log('✅ Quality metrics logged successfully');

    // Test 5: Retrieve and Verify Data
    console.log('\n🔍 Test 5: Data Retrieval and Verification');
    
    // Get recent AI interactions
    const recentAI = await aiLogger.getRecentAIInteractions(5);
    console.log(`✅ Retrieved ${recentAI.length} recent AI interactions`);
    
    // Get AI metrics summary
    const aiSummary = await aiLogger.getAIMetricsSummary('24h');
    console.log('✅ AI metrics summary:', {
      totalInteractions: aiSummary.totalInteractions,
      totalCost: aiSummary.totalCost,
      averageQuality: aiSummary.averageQuality
    });

    // Get quality trends
    const qualityTrends = await qualityLogger.getQualityTrends('24h');
    console.log('✅ Quality trends:', {
      totalEntries: qualityTrends.data.length,
      averageQuality: qualityTrends.summary.averageQuality,
      trend: qualityTrends.summary.trend
    });

    // Test 6: Prompt Performance Analytics
    console.log('\n📈 Test 6: Prompt Performance Analytics');
    
    const promptAnalytics = await aiLogger.getPromptPerformanceAnalytics('24h');
    console.log('✅ Prompt performance analytics:', {
      promptVersionsCount: Object.keys(promptAnalytics.promptVersions).length,
      totalModifications: promptAnalytics.userModifications.totalModifications,
      totalRatings: promptAnalytics.ratingAnalysis.totalRatings,
      averageRating: promptAnalytics.ratingAnalysis.averageRating
    });

    // Test 7: Comprehensive Application Insights
    console.log('\n🎯 Test 7: Comprehensive Application Insights');
    
    const insights = await comprehensiveLogger.getApplicationInsights('24h');
    console.log('✅ Application insights retrieved:', {
      hasQualityMetrics: !!insights.qualityMetrics,
      hasAIMetrics: !!insights.aiMetrics,
      hasPipelineStats: !!insights.pipelineStats,
      hasUserActivity: !!insights.userActivity,
      hasSystemHealth: !!insights.systemHealth
    });

    console.log('\n🎉 All logging tests completed successfully!');
    console.log('\n📁 Check the following directories for log files:');
    console.log('   - storage/quality-logs/');
    console.log('   - storage/ai-logs/');
    console.log('   - storage/app-logs/');

  } catch (error) {
    console.error('❌ Logging test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testLoggingImplementation()
    .then(() => {
      console.log('\n✅ Logging implementation test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Logging implementation test failed:', error);
      process.exit(1);
    });
}

export { testLoggingImplementation };
