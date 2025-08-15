import express from 'express';
import { AIQualityService } from '../services/AIQualityService';
import { Pool } from 'pg';

const router = express.Router();

// Initialize AI Quality Service
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const aiQualityService = new AIQualityService(db);

// Task Management Routes
router.post('/tasks', async (req, res) => {
  try {
    const task = await aiQualityService.createTask(req.body);
    res.json(task);
  } catch (error) {
    console.error('Failed to create AI task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const tasks = await aiQualityService.listTasks();
    res.json(tasks);
  } catch (error) {
    console.error('Failed to list tasks:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

router.get('/tasks/:taskId', async (req, res) => {
  try {
    const task = await aiQualityService.getTask(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    console.error('Failed to get task:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// Prompt Management Routes
router.post('/tasks/:taskId/prompts', async (req, res) => {
  try {
    const promptData = {
      ...req.body,
      taskId: req.params.taskId
    };
    const prompt = await aiQualityService.createPrompt(promptData);
    res.json(prompt);
  } catch (error) {
    console.error('Failed to create prompt:', error);
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

router.get('/tasks/:taskId/prompts', async (req, res) => {
  try {
    const prompts = await aiQualityService.getPromptVersions(req.params.taskId);
    res.json(prompts);
  } catch (error) {
    console.error('Failed to get prompts:', error);
    res.status(500).json({ error: 'Failed to get prompts' });
  }
});

router.get('/tasks/:taskId/prompts/active', async (req, res) => {
  try {
    const prompt = await aiQualityService.getActivePrompt(req.params.taskId);
    res.json(prompt);
  } catch (error) {
    console.error('Failed to get active prompt:', error);
    res.status(500).json({ error: 'Failed to get active prompt' });
  }
});

// AI Prompt Optimization
router.post('/:taskId/optimize', async (req, res) => {
  try {
    const { currentPrompt, performanceIssues } = req.body;
    
    // Get the current active prompt for this task
    const activePrompt = await aiQualityService.getActivePrompt(req.params.taskId);
    if (!activePrompt) {
      return res.status(404).json({ error: 'No active prompt found for this task' });
    }

    // Generate optimized prompts
    const optimizedPrompts = await aiQualityService.generateOptimizedPrompts(
      activePrompt.id,
      performanceIssues || []
    );

    // Record the optimization
    await aiQualityService.recordOptimization(
      activePrompt.id,
      'meta_prompting',
      optimizedPrompts,
      { performanceIssues }
    );

    res.json({ optimizedPrompts });
  } catch (error) {
    console.error('Failed to optimize prompt:', error);
    res.status(500).json({ error: 'Failed to optimize prompt' });
  }
});

// Quality Validation
router.post('/:taskId/validate', async (req, res) => {
  try {
    const { prompt } = req.body;
    const taskId = req.params.taskId;

    // Get validation dataset for this task
    const dataset = await aiQualityService.getValidationDataset(taskId);
    if (!dataset) {
      return res.status(404).json({ error: 'No validation dataset found for this task' });
    }

    // Get task configuration
    const task = await aiQualityService.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Run validation tests
    const results = [];
    let totalTP = 0, totalFP = 0, totalFN = 0;

    for (const testCase of dataset.testCases) {
      // Call the AI service for this specific task type
      const aiResponse = await callAIService(task.taskType, {
        prompt,
        ...testCase.input
      });

      // Calculate metrics based on task type
      const metrics = calculateMetricsForTaskType(
        task.taskType,
        aiResponse,
        testCase.groundTruth
      );

      totalTP += metrics.truePositives;
      totalFP += metrics.falsePositives;
      totalFN += metrics.falseNegatives;

      results.push({
        testCase: testCase.name,
        metrics: {
          precision: metrics.precision,
          recall: metrics.recall,
          f1Score: metrics.f1Score
        },
        status: metrics.f1Score > 0.85 ? 'excellent' : 
                metrics.f1Score > 0.7 ? 'good' : 'poor'
      });
    }

    // Calculate overall metrics
    const overallPrecision = totalTP / (totalTP + totalFP) || 0;
    const overallRecall = totalTP / (totalTP + totalFN) || 0;
    const overallF1 = 2 * (overallPrecision * overallRecall) / (overallPrecision + overallRecall) || 0;

    // Generate recommendations
    const recommendations = generateRecommendations(overallPrecision, overallRecall, overallF1);

    const validationResult = {
      overallMetrics: {
        precision: overallPrecision,
        recall: overallRecall,
        f1Score: overallF1
      },
      testResults: results,
      recommendations
    };

    res.json(validationResult);
  } catch (error) {
    console.error('Failed to validate prompt:', error);
    res.status(500).json({ error: 'Failed to validate prompt' });
  }
});

// Performance Monitoring
router.get('/:taskId/performance', async (req, res) => {
  try {
    const performance = await aiQualityService.getTaskPerformanceOverview(req.params.taskId);
    res.json(performance);
  } catch (error) {
    console.error('Failed to get performance data:', error);
    res.status(500).json({ error: 'Failed to get performance data' });
  }
});

// Test Execution Recording
router.post('/:taskId/executions', async (req, res) => {
  try {
    const executionId = await aiQualityService.recordTestExecution(req.body);
    
    if (req.body.metrics) {
      await aiQualityService.recordQualityMetrics(executionId, req.body.metrics);
    }

    res.json({ executionId });
  } catch (error) {
    console.error('Failed to record test execution:', error);
    res.status(500).json({ error: 'Failed to record test execution' });
  }
});

// Validation Dataset Management
router.post('/:taskId/datasets', async (req, res) => {
  try {
    const datasetData = {
      ...req.body,
      taskId: req.params.taskId
    };
    const dataset = await aiQualityService.createValidationDataset(datasetData);
    res.json(dataset);
  } catch (error) {
    console.error('Failed to create validation dataset:', error);
    res.status(500).json({ error: 'Failed to create validation dataset' });
  }
});

router.get('/:taskId/datasets', async (req, res) => {
  try {
    const dataset = await aiQualityService.getValidationDataset(req.params.taskId);
    res.json(dataset);
  } catch (error) {
    console.error('Failed to get validation dataset:', error);
    res.status(500).json({ error: 'Failed to get validation dataset' });
  }
});

// Helper Functions
async function callAIService(taskType: string, input: any): Promise<any> {
  // Route to appropriate AI service based on task type
  switch (taskType) {
    case 'split_detection':
      return await callSplitDetectionAI(input);
    case 'content_generation':
      return await callContentGenerationAI(input);
    case 'classification':
      return await callClassificationAI(input);
    default:
      throw new Error(`Unsupported task type: ${taskType}`);
  }
}

async function callSplitDetectionAI(input: any): Promise<any> {
  // Call your existing split detection AI endpoint
  const response = await fetch('http://localhost:3009/api/ai-enhancement/detect-sections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  return await response.json();
}

async function callContentGenerationAI(input: any): Promise<any> {
  // Implement content generation AI call
  // This would call OpenAI or your content generation service
  return { generated_content: 'Sample generated content' };
}

async function callClassificationAI(input: any): Promise<any> {
  // Implement classification AI call
  return { classification: 'sample_class', confidence: 0.85 };
}

function calculateMetricsForTaskType(taskType: string, aiResponse: any, groundTruth: any): any {
  switch (taskType) {
    case 'split_detection':
      return calculateSplitDetectionMetrics(aiResponse, groundTruth);
    case 'content_generation':
      return calculateContentGenerationMetrics(aiResponse, groundTruth);
    case 'classification':
      return calculateClassificationMetrics(aiResponse, groundTruth);
    default:
      throw new Error(`Unsupported task type for metrics: ${taskType}`);
  }
}

function calculateSplitDetectionMetrics(aiResponse: any, groundTruth: any): any {
  // Implement IoU-based metrics calculation for split detection
  const predictions = aiResponse.sections || [];
  const gtSections = groundTruth.sections || [];
  
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  const matchedGT = new Set();

  // Calculate IoU and match predictions to ground truth
  predictions.forEach((pred: any) => {
    let bestMatch = null;
    let bestIoU = 0;
    
    gtSections.forEach((gt: any, gtIndex: number) => {
      if (matchedGT.has(gtIndex) || pred.type !== gt.type) return;
      
      const iou = calculateIoU(pred.bounds, gt.bounds);
      if (iou > bestIoU) {
        bestIoU = iou;
        bestMatch = gtIndex;
      }
    });

    if (bestMatch !== null && bestIoU >= 0.5) {
      truePositives++;
      matchedGT.add(bestMatch);
    } else {
      falsePositives++;
    }
  });

  falseNegatives = gtSections.length - matchedGT.size;

  const precision = truePositives / (truePositives + falsePositives) || 0;
  const recall = truePositives / (truePositives + falseNegatives) || 0;
  const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

  return { truePositives, falsePositives, falseNegatives, precision, recall, f1Score };
}

function calculateIoU(box1: any, box2: any): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
  
  if (x2 <= x1 || y2 <= y1) return 0;
  
  const intersection = (x2 - x1) * (y2 - y1);
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;
  
  return intersection / union;
}

function calculateContentGenerationMetrics(aiResponse: any, groundTruth: any): any {
  // Implement content generation metrics (BLEU, ROUGE, etc.)
  return {
    truePositives: 1,
    falsePositives: 0,
    falseNegatives: 0,
    precision: 1.0,
    recall: 1.0,
    f1Score: 1.0
  };
}

function calculateClassificationMetrics(aiResponse: any, groundTruth: any): any {
  // Implement classification metrics
  const correct = aiResponse.classification === groundTruth.expectedClass;
  return {
    truePositives: correct ? 1 : 0,
    falsePositives: correct ? 0 : 1,
    falseNegatives: correct ? 0 : 1,
    precision: correct ? 1.0 : 0.0,
    recall: correct ? 1.0 : 0.0,
    f1Score: correct ? 1.0 : 0.0
  };
}

function generateRecommendations(precision: number, recall: number, f1Score: number): string[] {
  const recommendations = [];

  if (precision < 0.8) {
    recommendations.push('High false positive rate detected. Consider making the prompt more conservative and specific about detection criteria.');
  }

  if (recall < 0.8) {
    recommendations.push('Missing important elements. Consider adding more detailed descriptions and examples to the prompt.');
  }

  if (f1Score < 0.7) {
    recommendations.push('Overall performance needs improvement. Consider using the AI optimizer to generate better prompt variations.');
  }

  if (f1Score > 0.85) {
    recommendations.push('Excellent performance! Consider using this as a baseline for future improvements.');
  }

  return recommendations;
}

export default router;
