# AI Quality System - Modular Framework

A comprehensive, reusable framework for AI prompt optimization, quality validation, and performance monitoring across all AI tasks in the application.

## Overview

The AI Quality System provides a professional-grade solution for:
- **AI Prompt Optimization**: Meta-prompting techniques to generate improved prompt variations
- **Quality Validation**: Industry-standard metrics (Precision, Recall, F1, IoU) with ground truth comparison
- **Performance Monitoring**: Track quality trends, execution metrics, and costs over time
- **Modular Architecture**: Easily extensible to any AI task beyond split detection

## Architecture

### Frontend Components

#### `AIQualityFramework` - Main Component
```typescript
import AIQualityFramework from '@/components/ai-quality/AIQualityFramework';

<AIQualityFramework
  taskConfig={AI_QUALITY_TASKS.SPLIT_DETECTION}
  currentPrompt={prompt}
  onPromptChange={setPrompt}
  onTest={handleTest}
/>
```

**Features:**
- Tabbed interface: AI Optimizer, Quality Validator, Performance Monitor
- Real-time prompt optimization using meta-prompting
- Comprehensive validation with detailed metrics
- Performance history and trend analysis

#### Task Configuration System
```typescript
// /frontend/src/config/aiQualityTasks.ts
export const AI_QUALITY_TASKS = {
  SPLIT_DETECTION: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Layout Section Detection',
    taskType: 'split_detection',
    apiEndpoint: '/api/ai-enhancement/detect-sections',
    qualityThresholds: { precision: 0.85, recall: 0.80, f1Score: 0.82 }
  }
};
```

### Backend Services

#### `AIQualityService` - Core Service
```typescript
// /backend/src/services/AIQualityService.ts
class AIQualityService {
  // Task Management
  async createTask(taskData: any): Promise<any>
  async getTask(taskId: string): Promise<any>
  
  // Prompt Management
  async createPrompt(promptData: any): Promise<any>
  async getActivePrompt(taskId: string): Promise<any>
  
  // Quality Validation
  async recordTestExecution(executionData: any): Promise<string>
  async recordQualityMetrics(executionId: string, metrics: any): Promise<void>
  
  // Performance Analysis
  async getTaskPerformanceOverview(taskId: string): Promise<any>
}
```

#### API Routes
```typescript
// /backend/src/routes/aiQuality.ts
POST /api/ai-quality/:taskId/optimize     // Generate optimized prompts
POST /api/ai-quality/:taskId/validate     // Run quality validation
GET  /api/ai-quality/:taskId/performance  // Get performance metrics
POST /api/ai-quality/:taskId/executions   // Record test execution
```

## Database Schema

### Core Tables

```sql
-- AI Tasks
CREATE TABLE ai_tasks (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  task_type VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Prompts and Versions
CREATE TABLE ai_prompts (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES ai_tasks(id),
  version VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Test Executions
CREATE TABLE ai_test_executions (
  id UUID PRIMARY KEY,
  prompt_id UUID REFERENCES ai_prompts(id),
  test_type VARCHAR(50),
  input_data JSONB,
  ai_output JSONB,
  execution_time_ms INTEGER,
  tokens_used INTEGER,
  cost_usd DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Quality Metrics
CREATE TABLE ai_quality_metrics (
  id UUID PRIMARY KEY,
  execution_id UUID REFERENCES ai_test_executions(id),
  precision DECIMAL(5,4),
  recall DECIMAL(5,4),
  f1_score DECIMAL(5,4),
  accuracy DECIMAL(5,4),
  custom_metrics JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Usage Examples

### 1. Split Detection Integration

```typescript
// Existing split detection page integration
import { AI_QUALITY_TASKS } from '@/config/aiQualityTasks';

export default function SplitDetectionPage() {
  const [currentPrompt, setCurrentPrompt] = useState('');
  const taskConfig = AI_QUALITY_TASKS.SPLIT_DETECTION;

  const handleTestPrompt = async (prompt: string, testData?: any) => {
    // Your existing test logic
    const result = await fetch(taskConfig.apiEndpoint, {
      method: 'POST',
      body: JSON.stringify({ prompt, ...testData })
    });
    
    // Record execution in quality system
    await fetch(`/api/ai-quality/${taskConfig.id}/executions`, {
      method: 'POST',
      body: JSON.stringify({
        promptId: 'current',
        testType: 'manual',
        inputData: testData,
        aiOutput: result
      })
    });
    
    return result;
  };

  return (
    <div>
      <AIQualityFramework
        taskConfig={taskConfig}
        currentPrompt={currentPrompt}
        onPromptChange={setCurrentPrompt}
        onTest={handleTestPrompt}
      />
    </div>
  );
}
```

### 2. Adding New AI Task

```typescript
// 1. Add task configuration
export const AI_QUALITY_TASKS = {
  // ... existing tasks
  CONTENT_GENERATION: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'AI Content Generation',
    taskType: 'content_generation',
    apiEndpoint: '/api/ai-enhancement/generate-content',
    qualityThresholds: { precision: 0.80, recall: 0.75, f1Score: 0.77 }
  }
};

// 2. Implement metrics calculation in backend
function calculateContentGenerationMetrics(aiResponse: any, groundTruth: any) {
  // BLEU score, ROUGE score, semantic similarity, etc.
  return {
    precision: calculateBLEUScore(aiResponse, groundTruth),
    recall: calculateROUGEScore(aiResponse, groundTruth),
    f1Score: calculateSemanticSimilarity(aiResponse, groundTruth)
  };
}

// 3. Use in your component
<AIQualityFramework
  taskConfig={AI_QUALITY_TASKS.CONTENT_GENERATION}
  currentPrompt={contentPrompt}
  onPromptChange={setContentPrompt}
  onTest={handleContentTest}
/>
```

## Quality Validation Framework

### Metrics Supported

1. **Precision**: `TP / (TP + FP)` - Accuracy of positive predictions
2. **Recall**: `TP / (TP + FN)` - Coverage of actual positives  
3. **F1 Score**: `2 * (Precision * Recall) / (Precision + Recall)` - Harmonic mean
4. **IoU**: Intersection over Union for bounding box accuracy
5. **Custom Metrics**: Task-specific quality measures

### Validation Process

1. **Load Dataset**: Ground truth annotations for test cases
2. **Run AI Tests**: Execute AI on test inputs with current prompt
3. **Calculate Metrics**: Compare AI output vs ground truth
4. **Generate Recommendations**: Actionable improvement suggestions
5. **Record Results**: Store metrics for trend analysis

### Quality Assessment

```typescript
const assessment = assessQuality(metrics, taskConfig);
// Returns: { overall: 'excellent' | 'good' | 'needs_improvement', details: string[] }
```

## AI Prompt Optimization

### Meta-Prompting Approach

The system uses advanced meta-prompting techniques to generate improved prompt variations:

```typescript
// Backend optimization logic
async generateOptimizedPrompts(promptId: string, performanceIssues: string[]) {
  const metaPrompt = `
    Analyze this AI prompt and generate 3 improved variations.
    
    Current Issues: ${performanceIssues.join(', ')}
    Original Prompt: ${originalPrompt}
    
    Focus on:
    - Clarity and specificity
    - Reducing false positives/negatives
    - Better instruction structure
    - Enhanced examples and context
  `;
  
  const optimizedPrompts = await callAI(metaPrompt);
  return optimizedPrompts;
}
```

### Optimization Features

- **Performance-Based**: Uses validation results to identify improvement areas
- **Multiple Variations**: Generates 3-5 optimized prompt alternatives
- **A/B Testing**: Compare performance of different prompt versions
- **Iterative Improvement**: Continuous refinement based on metrics

## Performance Monitoring

### Tracked Metrics

- **Quality Trends**: F1 score, precision, recall over time
- **Execution Performance**: Response time, token usage, costs
- **Usage Analytics**: Test frequency, prompt versions, success rates
- **Alerts**: Performance degradation notifications

### Dashboard Features

- **Historical Performance**: Charts showing quality trends
- **Cost Analysis**: Token usage and API costs per prompt version
- **Comparative Analysis**: Side-by-side prompt performance
- **Automated Alerts**: Notifications for quality drops

## Best Practices

### 1. Validation Dataset Quality
- Use diverse, representative test cases
- Ensure accurate ground truth annotations
- Regular dataset updates and expansion
- Balance positive and negative examples

### 2. Prompt Optimization
- Start with baseline metrics before optimization
- Test multiple prompt variations systematically
- Use A/B testing for production deployments
- Monitor long-term performance trends

### 3. Quality Thresholds
- Set realistic quality thresholds based on task complexity
- Adjust thresholds based on business requirements
- Consider precision vs recall trade-offs
- Regular threshold review and updates

### 4. Performance Monitoring
- Set up automated quality alerts
- Regular performance reviews and analysis
- Track costs alongside quality metrics
- Monitor for model drift and degradation

## Integration Checklist

- [ ] Install dependencies: `npm install pg @types/pg`
- [ ] Set up database schema (see schema section)
- [ ] Configure task definitions in `aiQualityTasks.ts`
- [ ] Implement task-specific metrics calculation
- [ ] Add validation datasets for your AI tasks
- [ ] Set appropriate quality thresholds
- [ ] Configure performance monitoring alerts
- [ ] Test integration with existing AI workflows

## Future Enhancements

1. **Advanced Optimization**: Genetic algorithms, reinforcement learning
2. **Multi-Modal Support**: Image, text, and hybrid AI tasks
3. **Real-Time Monitoring**: Live performance dashboards
4. **Automated A/B Testing**: Continuous prompt optimization
5. **Integration APIs**: Third-party AI service connectors
6. **Advanced Analytics**: Predictive quality modeling

This modular AI Quality System provides a professional foundation for systematic AI improvement across your entire application, enabling data-driven prompt optimization and continuous quality enhancement.
