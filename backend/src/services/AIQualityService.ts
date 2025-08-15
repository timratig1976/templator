import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface AITask {
  id: string;
  name: string;
  description?: string;
  taskType: string;
  inputSchema: any;
  outputSchema: any;
}

export interface AIPrompt {
  id: string;
  taskId: string;
  version: string;
  content: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  isActive: boolean;
  performanceScore?: number;
}

export interface ValidationDataset {
  id: string;
  taskId: string;
  name: string;
  description?: string;
  testCases: any[];
}

export interface QualityMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  accuracy?: number;
  customMetrics?: Record<string, number>;
}

export interface TestExecution {
  id: string;
  promptId: string;
  datasetId?: string;
  testType: 'validation' | 'manual' | 'production';
  inputData: any;
  aiOutput: any;
  groundTruth?: any;
  executionTimeMs: number;
  tokensUsed?: number;
  costUsd?: number;
  metrics?: QualityMetrics;
}

export class AIQualityService {
  private db: Pool;

  constructor(database: Pool) {
    this.db = database;
  }

  // Task Management
  async createTask(task: Omit<AITask, 'id'>): Promise<AITask> {
    const id = uuidv4();
    const query = `
      INSERT INTO ai_tasks (id, name, description, task_type, input_schema, output_schema)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      id, task.name, task.description, task.taskType, 
      JSON.stringify(task.inputSchema), JSON.stringify(task.outputSchema)
    ]);
    
    return this.mapTaskFromDb(result.rows[0]);
  }

  async getTask(taskId: string): Promise<AITask | null> {
    const query = 'SELECT * FROM ai_tasks WHERE id = $1';
    const result = await this.db.query(query, [taskId]);
    return result.rows[0] ? this.mapTaskFromDb(result.rows[0]) : null;
  }

  async listTasks(): Promise<AITask[]> {
    const query = 'SELECT * FROM ai_tasks ORDER BY created_at DESC';
    const result = await this.db.query(query);
    return result.rows.map(this.mapTaskFromDb);
  }

  // Prompt Management
  async createPrompt(prompt: Omit<AIPrompt, 'id'>): Promise<AIPrompt> {
    const id = uuidv4();
    const query = `
      INSERT INTO ai_prompts (id, task_id, version, content, system_prompt, temperature, max_tokens, model, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      id, prompt.taskId, prompt.version, prompt.content, prompt.systemPrompt,
      prompt.temperature, prompt.maxTokens, prompt.model, prompt.isActive
    ]);
    
    return this.mapPromptFromDb(result.rows[0]);
  }

  async updatePromptPerformance(promptId: string, performanceScore: number): Promise<void> {
    const query = 'UPDATE ai_prompts SET performance_score = $1, updated_at = NOW() WHERE id = $2';
    await this.db.query(query, [performanceScore, promptId]);
  }

  async getActivePrompt(taskId: string): Promise<AIPrompt | null> {
    const query = 'SELECT * FROM ai_prompts WHERE task_id = $1 AND is_active = true LIMIT 1';
    const result = await this.db.query(query, [taskId]);
    return result.rows[0] ? this.mapPromptFromDb(result.rows[0]) : null;
  }

  async getPromptVersions(taskId: string): Promise<AIPrompt[]> {
    const query = 'SELECT * FROM ai_prompts WHERE task_id = $1 ORDER BY created_at DESC';
    const result = await this.db.query(query, [taskId]);
    return result.rows.map(this.mapPromptFromDb);
  }

  // Validation Dataset Management
  async createValidationDataset(dataset: Omit<ValidationDataset, 'id'>): Promise<ValidationDataset> {
    const id = uuidv4();
    const query = `
      INSERT INTO validation_datasets (id, task_id, name, description, test_cases)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      id, dataset.taskId, dataset.name, dataset.description, JSON.stringify(dataset.testCases)
    ]);
    
    return this.mapDatasetFromDb(result.rows[0]);
  }

  async getValidationDataset(taskId: string): Promise<ValidationDataset | null> {
    const query = 'SELECT * FROM validation_datasets WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1';
    const result = await this.db.query(query, [taskId]);
    return result.rows[0] ? this.mapDatasetFromDb(result.rows[0]) : null;
  }

  // Test Execution
  async recordTestExecution(execution: Omit<TestExecution, 'id'>): Promise<string> {
    const id = uuidv4();
    const query = `
      INSERT INTO ai_test_executions (id, prompt_id, dataset_id, test_type, input_data, ai_output, ground_truth, execution_time_ms, tokens_used, cost_usd)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    
    const result = await this.db.query(query, [
      id, execution.promptId, execution.datasetId, execution.testType,
      JSON.stringify(execution.inputData), JSON.stringify(execution.aiOutput),
      execution.groundTruth ? JSON.stringify(execution.groundTruth) : null,
      execution.executionTimeMs, execution.tokensUsed, execution.costUsd
    ]);
    
    return result.rows[0].id;
  }

  async recordQualityMetrics(executionId: string, metrics: QualityMetrics): Promise<void> {
    const metricEntries = [
      { type: 'precision', value: metrics.precision },
      { type: 'recall', value: metrics.recall },
      { type: 'f1_score', value: metrics.f1Score },
    ];

    if (metrics.accuracy !== undefined) {
      metricEntries.push({ type: 'accuracy', value: metrics.accuracy });
    }

    if (metrics.customMetrics) {
      Object.entries(metrics.customMetrics).forEach(([key, value]) => {
        metricEntries.push({ type: key, value });
      });
    }

    for (const metric of metricEntries) {
      const query = `
        INSERT INTO ai_quality_metrics (id, execution_id, metric_type, value)
        VALUES ($1, $2, $3, $4)
      `;
      await this.db.query(query, [uuidv4(), executionId, metric.type, metric.value]);
    }
  }

  // Performance Analysis
  async getPerformanceHistory(promptId: string, limit = 50): Promise<TestExecution[]> {
    const query = `
      SELECT e.*, 
             json_agg(json_build_object('type', m.metric_type, 'value', m.value)) as metrics
      FROM ai_test_executions e
      LEFT JOIN ai_quality_metrics m ON e.id = m.execution_id
      WHERE e.prompt_id = $1
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT $2
    `;
    
    const result = await this.db.query(query, [promptId, limit]);
    return result.rows.map(this.mapExecutionFromDb);
  }

  async getTaskPerformanceOverview(taskId: string): Promise<any> {
    const query = `
      SELECT 
        p.version,
        p.performance_score,
        COUNT(e.id) as total_executions,
        AVG(m.value) FILTER (WHERE m.metric_type = 'f1_score') as avg_f1_score,
        AVG(m.value) FILTER (WHERE m.metric_type = 'precision') as avg_precision,
        AVG(m.value) FILTER (WHERE m.metric_type = 'recall') as avg_recall,
        AVG(e.execution_time_ms) as avg_execution_time,
        SUM(e.cost_usd) as total_cost
      FROM ai_prompts p
      LEFT JOIN ai_test_executions e ON p.id = e.prompt_id
      LEFT JOIN ai_quality_metrics m ON e.id = m.execution_id
      WHERE p.task_id = $1
      GROUP BY p.id, p.version, p.performance_score
      ORDER BY p.created_at DESC
    `;
    
    const result = await this.db.query(query, [taskId]);
    return result.rows;
  }

  // AI Prompt Optimization
  async generateOptimizedPrompts(promptId: string, performanceIssues: string[]): Promise<string[]> {
    // This would integrate with your AI service to generate optimized prompts
    const prompt = await this.getPrompt(promptId);
    if (!prompt) throw new Error('Prompt not found');

    const optimizationPrompt = `
You are an expert prompt engineer. Analyze this AI prompt and its performance issues:

CURRENT PROMPT:
${prompt.content}

PERFORMANCE ISSUES:
${performanceIssues.join('\n- ')}

Generate 3 improved prompt variations that address these specific issues.
Focus on clarity, specificity, and better instruction structure.

Return as JSON array of strings.
    `;

    // Call your AI service here
    // const optimizedPrompts = await this.aiService.generateText(optimizationPrompt);
    
    // For now, return mock data
    return [
      `${prompt.content}\n\nIMPROVED: Added specific validation criteria`,
      `${prompt.content}\n\nIMPROVED: Enhanced boundary detection instructions`,
      `${prompt.content}\n\nIMPROVED: Better confidence calibration guidance`
    ];
  }

  async recordOptimization(promptId: string, strategy: string, generatedPrompts: string[], analysis?: any): Promise<string> {
    const id = uuidv4();
    const query = `
      INSERT INTO ai_prompt_optimizations (id, original_prompt_id, optimization_strategy, generated_prompts, performance_analysis)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const result = await this.db.query(query, [
      id, promptId, strategy, JSON.stringify(generatedPrompts), analysis ? JSON.stringify(analysis) : null
    ]);
    
    return result.rows[0].id;
  }

  // Helper methods
  private async getPrompt(promptId: string): Promise<AIPrompt | null> {
    const query = 'SELECT * FROM ai_prompts WHERE id = $1';
    const result = await this.db.query(query, [promptId]);
    return result.rows[0] ? this.mapPromptFromDb(result.rows[0]) : null;
  }

  private mapTaskFromDb(row: any): AITask {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      taskType: row.task_type,
      inputSchema: row.input_schema,
      outputSchema: row.output_schema
    };
  }

  private mapPromptFromDb(row: any): AIPrompt {
    return {
      id: row.id,
      taskId: row.task_id,
      version: row.version,
      content: row.content,
      systemPrompt: row.system_prompt,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
      model: row.model,
      isActive: row.is_active,
      performanceScore: row.performance_score
    };
  }

  private mapDatasetFromDb(row: any): ValidationDataset {
    return {
      id: row.id,
      taskId: row.task_id,
      name: row.name,
      description: row.description,
      testCases: row.test_cases
    };
  }

  private mapExecutionFromDb(row: any): TestExecution {
    return {
      id: row.id,
      promptId: row.prompt_id,
      datasetId: row.dataset_id,
      testType: row.test_type,
      inputData: row.input_data,
      aiOutput: row.ai_output,
      groundTruth: row.ground_truth,
      executionTimeMs: row.execution_time_ms,
      tokensUsed: row.tokens_used,
      costUsd: row.cost_usd,
      metrics: row.metrics ? this.parseMetrics(row.metrics) : undefined
    };
  }

  private parseMetrics(metricsArray: any[]): QualityMetrics {
    const metrics: any = {};
    metricsArray.forEach(m => {
      metrics[m.type] = m.value;
    });
    
    return {
      precision: metrics.precision || 0,
      recall: metrics.recall || 0,
      f1Score: metrics.f1_score || 0,
      accuracy: metrics.accuracy,
      customMetrics: Object.keys(metrics)
        .filter(k => !['precision', 'recall', 'f1_score', 'accuracy'].includes(k))
        .reduce((obj, k) => ({ ...obj, [k]: metrics[k] }), {})
    };
  }
}
