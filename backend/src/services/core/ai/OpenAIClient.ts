import { createLogger } from '../../../utils/logger';
import { createMockLogger } from './MockLogger';

const logger = process.env.NODE_ENV === 'test' ? createMockLogger() : createLogger();

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Centralized OpenAI API client
 * Handles all OpenAI API interactions with consistent error handling and logging
 */
export class OpenAIClient {
  private static instance: OpenAIClient;
  private config: OpenAIConfig;

  public static getInstance(): OpenAIClient {
    if (!OpenAIClient.instance) {
      OpenAIClient.instance = new OpenAIClient();
    }
    return OpenAIClient.instance;
  }

  private constructor() {
    this.config = {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4o',
      maxTokens: 2000,
      temperature: 0.2
    };

    if (!this.config.apiKey) {
      logger.warn('OpenAI API key not found in environment variables');
    }
  }

  /**
   * Make a chat completion request to OpenAI
   */
  async chatCompletion(
    messages: OpenAIMessage[],
    options?: Partial<OpenAIConfig>
  ): Promise<OpenAIResponse> {
    const requestConfig = { ...this.config, ...options };

    try {
      const requestData = {
        model: requestConfig.model,
        messages,
        max_tokens: requestConfig.maxTokens,
        temperature: requestConfig.temperature
      };

      logger.info('Making OpenAI API request', {
        model: requestConfig.model,
        messagesCount: messages.length,
        maxTokens: requestConfig.maxTokens
      });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${requestConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      logger.info('OpenAI API request successful', {
        tokensUsed: result.usage?.total_tokens || 0,
        model: requestConfig.model
      });

      return result;

    } catch (error) {
      logger.error('OpenAI API request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        model: requestConfig.model
      });
      throw error;
    }
  }

  /**
   * Make a vision request (image + text) to OpenAI
   */
  async visionRequest(
    imageBase64: string,
    prompt: string,
    options?: Partial<OpenAIConfig>
  ): Promise<OpenAIResponse> {
    const messages: OpenAIMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      }
    ];

    return this.chatCompletion(messages, options);
  }

  /**
   * Create embeddings for text
   */
  async createEmbedding(text: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          input: text
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI Embeddings API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;

    } catch (error) {
      logger.error('OpenAI Embeddings API request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        model
      });
      throw error;
    }
  }

  /**
   * Calculate estimated cost for a request
   */
  calculateCost(totalTokens: number, model: string = 'gpt-4o'): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.005 / 1000, output: 0.015 / 1000 },
      'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
      'gpt-3.5-turbo': { input: 0.001 / 1000, output: 0.002 / 1000 }
    };

    const modelPricing = pricing[model] || pricing['gpt-4o'];
    const avgPrice = (modelPricing.input + modelPricing.output) / 2;
    return totalTokens * avgPrice;
  }

  /**
   * Validate base64 image format
   */
  isValidBase64Image(base64String: string): boolean {
    if (!base64String.startsWith('data:image/')) {
      return false;
    }
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,([A-Za-z0-9+\/=\s]*)$/;
    return base64Regex.test(base64String);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OpenAIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): OpenAIConfig {
    return { ...this.config };
  }
}

export default OpenAIClient.getInstance();
