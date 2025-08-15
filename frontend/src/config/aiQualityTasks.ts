// AI Quality System Task Configurations
// This file defines all AI tasks that can use the quality framework

export interface AITaskConfig {
  id: string;
  name: string;
  taskType: string;
  apiEndpoint: string;
  validationEndpoint?: string;
  optimizationEndpoint?: string;
  description: string;
  inputSchema: any;
  outputSchema: any;
  defaultPrompt?: string;
  qualityThresholds: {
    precision: number;
    recall: number;
    f1Score: number;
  };
}

export const AI_QUALITY_TASKS: Record<string, AITaskConfig> = {
  // Layout Section Detection
  SPLIT_DETECTION: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Layout Section Detection',
    taskType: 'split_detection',
    apiEndpoint: '/api/ai-enhancement/detect-sections',
    validationEndpoint: '/api/ai-quality/550e8400-e29b-41d4-a716-446655440000/validate',
    optimizationEndpoint: '/api/ai-quality/550e8400-e29b-41d4-a716-446655440000/optimize',
    description: 'Detect and classify sections in web design layouts (header, hero, content, footer, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Base64 encoded image' },
        prompt: { type: 'string', description: 'AI prompt for section detection' }
      },
      required: ['image', 'prompt']
    },
    outputSchema: {
      type: 'object',
      properties: {
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', enum: ['header', 'hero', 'content', 'feature', 'testimonial', 'footer'] },
              bounds: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  width: { type: 'number' },
                  height: { type: 'number' }
                }
              },
              aiConfidence: { type: 'number', minimum: 0, maximum: 1 },
              detectionReason: { type: 'string' }
            }
          }
        }
      }
    },
    defaultPrompt: `ENHANCED LAYOUT SECTION DETECTION

Analyze this design image and identify distinct layout sections with these enhanced guidelines:

## SECTION DETECTION PRIORITIES:
1. **Visual Hierarchy**: Identify sections based on visual grouping, spacing, and hierarchy
2. **Semantic Meaning**: Recognize common web layout patterns
3. **Content Boundaries**: Detect natural content boundaries and logical groupings
4. **Confidence Scoring**: Rate detection confidence (0.0-1.0) based on visual clarity

## SECTION TYPES:
- **header**: Top navigation, logo, main menu
- **hero**: Primary banner, main value proposition, call-to-action
- **content**: Main content areas, text blocks, information sections
- **feature**: Feature highlights, service offerings, product showcases
- **testimonial**: Customer reviews, social proof, quotes
- **footer**: Bottom navigation, copyright, secondary links

## DETECTION RULES:
1. Each section must have clear visual boundaries
2. Minimum section height: 50px
3. Sections should not overlap significantly
4. Confidence score should reflect visual clarity and typical patterns
5. Include reasoning for each detection

Return JSON with detected sections, precise bounds, confidence scores, and detection reasoning.`,
    qualityThresholds: {
      precision: 0.85,
      recall: 0.80,
      f1Score: 0.82
    }
  },

  // Content Generation
  CONTENT_GENERATION: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'AI Content Generation',
    taskType: 'content_generation',
    apiEndpoint: '/api/ai-enhancement/generate-content',
    validationEndpoint: '/api/ai-quality/550e8400-e29b-41d4-a716-446655440001/validate',
    optimizationEndpoint: '/api/ai-quality/550e8400-e29b-41d4-a716-446655440001/optimize',
    description: 'Generate marketing copy, product descriptions, and website content',
    inputSchema: {
      type: 'object',
      properties: {
        contentType: { type: 'string', enum: ['headline', 'description', 'cta', 'feature_list'] },
        context: { type: 'string', description: 'Context about the product/service' },
        tone: { type: 'string', enum: ['professional', 'casual', 'persuasive', 'informative'] },
        length: { type: 'string', enum: ['short', 'medium', 'long'] }
      },
      required: ['contentType', 'context']
    },
    outputSchema: {
      type: 'object',
      properties: {
        generatedContent: { type: 'string' },
        alternatives: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number', minimum: 0, maximum: 1 }
      }
    },
    defaultPrompt: `Generate high-quality marketing content based on the provided context and requirements.

Focus on:
- Clear, compelling messaging
- Appropriate tone and style
- Target audience relevance
- Call-to-action effectiveness

Provide the main content plus 2-3 alternative variations.`,
    qualityThresholds: {
      precision: 0.80,
      recall: 0.75,
      f1Score: 0.77
    }
  },

  // Image Classification
  IMAGE_CLASSIFICATION: {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Design Style Classification',
    taskType: 'classification',
    apiEndpoint: '/api/ai-enhancement/classify-design',
    validationEndpoint: '/api/ai-quality/550e8400-e29b-41d4-a716-446655440002/validate',
    optimizationEndpoint: '/api/ai-quality/550e8400-e29b-41d4-a716-446655440002/optimize',
    description: 'Classify design styles, themes, and visual characteristics',
    inputSchema: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Base64 encoded image' },
        classificationTypes: { 
          type: 'array', 
          items: { type: 'string', enum: ['style', 'industry', 'complexity', 'color_scheme'] }
        }
      },
      required: ['image', 'classificationTypes']
    },
    outputSchema: {
      type: 'object',
      properties: {
        classifications: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              value: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              reasoning: { type: 'string' }
            }
          }
        }
      }
    },
    defaultPrompt: `Analyze this design image and classify it according to the requested classification types.

Provide accurate classifications with confidence scores and clear reasoning for each classification.

Consider visual elements, layout patterns, color schemes, typography, and overall design approach.`,
    qualityThresholds: {
      precision: 0.90,
      recall: 0.85,
      f1Score: 0.87
    }
  }
};

// Helper function to get task config
export function getAITaskConfig(taskId: string): AITaskConfig | null {
  const task = Object.values(AI_QUALITY_TASKS).find(t => t.id === taskId);
  return task || null;
}

// Helper function to get task config by type
export function getAITaskConfigByType(taskType: string): AITaskConfig | null {
  const task = Object.values(AI_QUALITY_TASKS).find(t => t.taskType === taskType);
  return task || null;
}

// Quality assessment helper
export function assessQuality(metrics: { precision: number; recall: number; f1Score: number }, taskConfig: AITaskConfig): {
  overall: 'excellent' | 'good' | 'needs_improvement';
  details: string[];
} {
  const { qualityThresholds } = taskConfig;
  const issues = [];

  if (metrics.precision < qualityThresholds.precision) {
    issues.push(`Precision (${(metrics.precision * 100).toFixed(1)}%) below threshold (${(qualityThresholds.precision * 100).toFixed(1)}%)`);
  }

  if (metrics.recall < qualityThresholds.recall) {
    issues.push(`Recall (${(metrics.recall * 100).toFixed(1)}%) below threshold (${(qualityThresholds.recall * 100).toFixed(1)}%)`);
  }

  if (metrics.f1Score < qualityThresholds.f1Score) {
    issues.push(`F1 Score (${(metrics.f1Score * 100).toFixed(1)}%) below threshold (${(qualityThresholds.f1Score * 100).toFixed(1)}%)`);
  }

  let overall: 'excellent' | 'good' | 'needs_improvement';
  if (issues.length === 0) {
    overall = 'excellent';
  } else if (metrics.f1Score > qualityThresholds.f1Score * 0.9) {
    overall = 'good';
  } else {
    overall = 'needs_improvement';
  }

  return { overall, details: issues };
}
