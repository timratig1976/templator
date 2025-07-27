import OpenAI from 'openai';
import { createError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { logToFrontend } from '../routes/logs';

const logger = createLogger();

// Validate API key exists
if (!process.env.OPENAI_API_KEY) {
  logger.error('OPENAI_API_KEY environment variable is not set');
  throw new Error('OpenAI API key is required but not provided');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DesignAnalysis {
  html: string;
  sections: Section[];
  components: Component[];
  description: string;
}

export interface Section {
  id: string;
  name: string;
  type: 'header' | 'hero' | 'content' | 'footer' | 'sidebar' | 'navigation';
  html: string;
  editableFields: EditableField[];
}

export interface Component {
  id: string;
  name: string;
  type: 'text' | 'image' | 'button' | 'link' | 'form' | 'list';
  selector: string;
  defaultValue: string;
}

export interface EditableField {
  id: string;
  name: string;
  type: 'text' | 'rich_text' | 'image' | 'url' | 'boolean';
  selector: string;
  defaultValue: string;
  required: boolean;
}

export class OpenAIService {
  private static instance: OpenAIService;

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  /**
   * Enhanced OpenAI API call with detailed logging
   */
  private async callOpenAI(messages: any[], model: string = 'gpt-4o', maxTokens: number = 4000, temperature: number = 0.1): Promise<any> {
    const requestId = `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    // Extract prompt for detailed logging
    const prompt = messages[0]?.content || '';
    const imageCount = Array.isArray(messages[0]?.content) ? 
      messages[0].content.filter((c: any) => c.type === 'image_url').length : 0;

    // Prepare full request data for logging
    const requestData = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature
    };

    // Log to backend
    logger.info('OpenAI API Request', {
      requestId,
      model,
      maxTokens,
      temperature,
      messageCount: messages.length,
      promptLength: typeof prompt === 'string' ? prompt.length : JSON.stringify(prompt).length,
      imageCount
    });

    // Broadcast detailed request info to frontend via SSE
    logToFrontend('info', 'openai', `🚀 Starting OpenAI API request`, {
      requestId,
      model,
      maxTokens,
      temperature,
      messageCount: messages.length,
      promptLength: typeof prompt === 'string' ? prompt.length : JSON.stringify(prompt).length,
      imageCount
    }, requestId);

    // Broadcast full request details to frontend
    logToFrontend('info', 'openai', `📤 Full OpenAI API Request Details`, {
      requestId,
      model: requestData.model,
      maxTokens: requestData.max_tokens,
      temperature: requestData.temperature,
      messages: requestData.messages?.map((msg: any) => ({
        role: msg.role,
        contentLength: typeof msg.content === 'string' ? msg.content.length : JSON.stringify(msg.content).length,
        contentType: typeof msg.content,
        hasImages: Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'image_url')
      })),
      fullPrompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt)
    }, requestId);

    // Broadcast prompt analysis to frontend
    if (typeof prompt === 'string') {
      logToFrontend('info', 'openai', `📝 Prompt Analysis`, {
        requestId,
        promptLength: prompt.length,
        wordCount: prompt.split(/\s+/).length,
        lineCount: prompt.split('\n').length,
        imageCount,
        promptSample: prompt.substring(0, 500) + (prompt.length > 500 ? '\n\n[... truncated ...]' : ''),
        containsInstructions: prompt.toLowerCase().includes('analyze') || prompt.toLowerCase().includes('convert'),
        containsJSON: prompt.includes('JSON') || prompt.includes('json'),
        containsHTML: prompt.includes('HTML') || prompt.includes('html')
      }, requestId);
    }

    try {
      const response = await openai.chat.completions.create(requestData);
      const duration = Date.now() - startTime;
      const responseContent = response.choices?.[0]?.message?.content || '';

      // Calculate estimated cost
      const estimatedCost = this.estimateOpenAICost(response.usage, response.model);

      // Log successful response to backend
      logger.info('OpenAI API Response', {
        requestId,
        duration: `${duration}ms`,
        usage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
        responseLength: responseContent.length,
        estimatedCost
      });

      // Broadcast enhanced success response to frontend via SSE
      logToFrontend('success', 'openai', `✅ OpenAI API request completed`, {
        requestId,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
          estimatedCost
        },
        finishReason: response.choices?.[0]?.finish_reason,
        responseLength: responseContent.length,
        responsePreview: responseContent.substring(0, 300) + (responseContent.length > 300 ? '...' : ''),
        model: response.model,
        id: response.id,
        created: response.created,
        duration: `${duration}ms`
      }, requestId, duration);

      // Broadcast full response details to frontend
      logToFrontend('info', 'openai', `📥 Full OpenAI API Response`, {
        requestId,
        id: response.id,
        object: response.object,
        created: response.created,
        model: response.model,
        systemFingerprint: response.system_fingerprint,
        choices: response.choices?.map((choice: any) => ({
          index: choice.index,
          message: {
            role: choice.message?.role,
            contentLength: choice.message?.content?.length || 0
          },
          logprobs: choice.logprobs,
          finishReason: choice.finish_reason
        })),
        usage: response.usage,
        fullResponse: responseContent,
        duration: `${duration}ms`
      }, requestId, duration);

      // Broadcast token usage details to frontend
      logToFrontend('info', 'openai', `💰 Token Usage Analysis`, {
        requestId,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        model: response.model,
        estimatedCost,
        costBreakdown: {
          promptCost: this.calculatePromptCost(response.usage?.prompt_tokens || 0, response.model),
          completionCost: this.calculateCompletionCost(response.usage?.completion_tokens || 0, response.model)
        },
        operation: 'API Request'
      }, requestId, duration);

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Log error to backend
      logger.error('OpenAI API Error', {
        requestId,
        duration: `${duration}ms`,
        error: error.message,
        code: error.code,
        status: error.status,
        type: error.type,
        param: error.param,
        response: error.response?.data
      });

      // Broadcast enhanced error to frontend via SSE
      logToFrontend('error', 'openai', `❌ OpenAI API request failed`, {
        requestId,
        error: error.message || error,
        code: error.code,
        status: error.status,
        type: error.type,
        param: error.param,
        response: error.response?.data,
        headers: error.response?.headers,
        duration: `${duration}ms`
      }, requestId, duration);

      throw error;
    }
  }

  /**
   * Estimate OpenAI API cost based on usage and model
   */
  private estimateOpenAICost(usage: any, model: string): string {
    if (!usage) return '$0.00';
    
    // OpenAI pricing (as of 2024) - these are approximate
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gpt-4o': { prompt: 0.005, completion: 0.015 }, // per 1K tokens
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 }
    };
    
    const modelPricing = pricing[model] || pricing['gpt-4']; // default to gpt-4 pricing
    const promptCost = (usage.prompt_tokens / 1000) * modelPricing.prompt;
    const completionCost = (usage.completion_tokens / 1000) * modelPricing.completion;
    const totalCost = promptCost + completionCost;
    
    return `$${totalCost.toFixed(4)}`;
  }

  /**
   * Calculate prompt cost for given tokens and model
   */
  private calculatePromptCost(tokens: number, model: string): string {
    const pricing: Record<string, number> = {
      'gpt-4o': 0.005,
      'gpt-4': 0.03,
      'gpt-4-turbo': 0.01,
      'gpt-3.5-turbo': 0.001
    };
    const rate = pricing[model] || pricing['gpt-4'];
    return `$${((tokens / 1000) * rate).toFixed(4)}`;
  }

  /**
   * Calculate completion cost for given tokens and model
   */
  private calculateCompletionCost(tokens: number, model: string): string {
    const pricing: Record<string, number> = {
      'gpt-4o': 0.015,
      'gpt-4': 0.06,
      'gpt-4-turbo': 0.03,
      'gpt-3.5-turbo': 0.002
    };
    const rate = pricing[model] || pricing['gpt-4'];
    return `$${((tokens / 1000) * rate).toFixed(4)}`;
  }

  /**
   * Convert design image to HTML/Tailwind CSS code
   */
  async convertDesignToHTML(imageBase64: string, fileName: string): Promise<DesignAnalysis> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info(`🚀 [${requestId}] Starting OpenAI design-to-HTML conversion`, {
        fileName,
        imageSize: Math.round(imageBase64.length / 1024),
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('info', 'openai', '🚀 Starting OpenAI design-to-HTML conversion', {
        fileName,
        imageSize: `${Math.round(imageBase64.length / 1024)} KB`,
        model: 'gpt-4o'
      }, requestId);

      const prompt = `
Analyze this design image and convert it to clean, semantic HTML with Tailwind CSS. Follow these requirements:

1. **HTML Structure**: Create semantic HTML5 with proper sections (header, main, footer, etc.)
2. **Tailwind CSS**: Use modern Tailwind classes for styling, responsive design, and animations
3. **Responsive Design**: Ensure mobile-first approach with proper breakpoints
4. **Accessibility**: Include proper ARIA labels, alt text, and semantic elements
5. **Component Identification**: Identify reusable components and sections

**Output Format**: Return a JSON object with this structure:
{
  "html": "Complete HTML code with Tailwind classes",
  "sections": [
    {
      "id": "unique-id",
      "name": "Section Name",
      "type": "header|hero|content|footer|sidebar|navigation",
      "html": "HTML for this section only",
      "editableFields": [
        {
          "id": "field-id",
          "name": "Field Name",
          "type": "text|rich_text|image|url|boolean",
          "selector": "CSS selector for this element",
          "defaultValue": "Default content",
          "required": true|false
        }
      ]
    }
  ],
  "components": [
    {
      "id": "component-id",
      "name": "Component Name", 
      "type": "text|image|button|link|form|list",
      "selector": "CSS selector",
      "defaultValue": "Default value"
    }
  ],
  "description": "Brief description of the design and layout"
}

**Important**: 
- Use modern Tailwind classes (gradients, shadows, animations)
- Make text content editable by identifying headlines, paragraphs, buttons
- Identify images that should be replaceable
- Create logical sections that can become HubSpot modules
- Ensure responsive design with proper breakpoints
- Use semantic HTML elements
`;

      logger.info(`📤 [${requestId}] Sending OpenAI API request`, {
        model: "gpt-4o",
        maxTokens: 4000,
        temperature: 0.1,
        promptLength: prompt.length,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('info', 'openai', '📤 Sending request to OpenAI API', {
        model: 'gpt-4o',
        maxTokens: 4000,
        promptLength: prompt.length
      }, requestId);

      const response = await this.callOpenAI([
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ]);

      const apiDuration = Date.now() - startTime;
      logger.info(`✅ [${requestId}] OpenAI API request completed`, {
        usage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
        responseLength: response.choices[0]?.message?.content?.length || 0,
        apiDuration: `${apiDuration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('success', 'openai', '✅ OpenAI API request completed', {
        usage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
        responseLength: response.choices[0]?.message?.content?.length || 0,
        tokensUsed: response.usage?.total_tokens || 0
      }, requestId, apiDuration);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw createError('No response from OpenAI', 500, 'INTERNAL_ERROR');
      }

      // Extract JSON from response (handle potential markdown formatting)
      logger.info(`🔍 [${requestId}] Parsing OpenAI response`, {
        responseLength: content.length,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('info', 'processing', '🔍 Parsing OpenAI response', {
        responseLength: content.length
      }, requestId);

      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error(`❌ [${requestId}] Invalid response format from OpenAI`, {
          contentPreview: content.substring(0, 200),
          requestId,
          timestamp: new Date().toISOString()
        });
        throw createError('Invalid response format from AI', 500, 'INTERNAL_ERROR');
      }

      const jsonString = jsonMatch[0].replace(/```json\n?|\n?```/g, '');
      logger.info(`📋 [${requestId}] Extracted JSON from response`, {
        jsonLength: jsonString.length,
        requestId,
        timestamp: new Date().toISOString()
      });

      const analysisData = JSON.parse(jsonString);
      
      const totalDuration = Date.now() - startTime;
      logger.info(`✅ [${requestId}] Design analysis completed successfully`, {
        sectionsCount: analysisData.sections?.length || 0,
        componentsCount: analysisData.components?.length || 0,
        htmlLength: analysisData.html?.length || 0,
        totalDuration: `${totalDuration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('success', 'processing', '✅ Design analysis completed successfully', {
        sectionsCount: analysisData.sections?.length || 0,
        componentsCount: analysisData.components?.length || 0,
        htmlLength: analysisData.html?.length || 0,
        description: analysisData.description?.substring(0, 100) + '...'
      }, requestId, totalDuration);
      
      return analysisData as DesignAnalysis;

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      logger.error(`❌ [${requestId}] Error converting design to HTML`, {
        error: error,
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
        code: (error as any)?.code,
        status: (error as any)?.status,
        response: (error as any)?.response?.data,
        totalDuration: `${totalDuration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('error', 'openai', '❌ Error converting design to HTML', {
        error: (error as Error)?.message,
        code: (error as any)?.code,
        status: (error as any)?.status
      }, requestId, totalDuration);
      
      if (error instanceof SyntaxError) {
        logger.error('JSON parsing error:', error.message);
        throw createError('Failed to parse AI response', 500, 'INTERNAL_ERROR');
      }
      
      if ((error as any)?.code === 'insufficient_quota') {
        throw createError('OpenAI API quota exceeded', 503, 'INTERNAL_ERROR');
      }
      
      // Check for OpenAI API specific errors
      if ((error as any)?.response?.status === 401) {
        throw createError('OpenAI API key is invalid', 401, 'INTERNAL_ERROR');
      }
      
      if ((error as any)?.response?.status === 429) {
        throw createError('OpenAI API rate limit exceeded', 429, 'INTERNAL_ERROR');
      }
      
      throw createError(
        'Failed to convert design to HTML',
        500,
        'INTERNAL_ERROR',
        (error as Error)?.message || 'Unknown error occurred'
      );
    }
  }

  /**
   * Generate HubSpot module using structured prompts
   */
  async generateHubSpotModule(prompt: string): Promise<string> {
    const startTime = Date.now();
    const requestId = `hubspot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info(`🏗️ [${requestId}] Starting HubSpot module generation`, {
        promptLength: prompt.length,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('info', 'openai', '🏗️ Starting HubSpot module generation', {
        promptLength: prompt.length
      }, requestId);

      const response = await this.callOpenAI(
        [{ role: "user", content: prompt }],
        "gpt-4o",
        4000,
        0.1
      );

      const apiDuration = Date.now() - startTime;
      const moduleContent = response.choices[0]?.message?.content || '';
      
      logger.info(`✅ [${requestId}] HubSpot module generation completed`, {
        usage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
        responseLength: moduleContent.length,
        apiDuration: `${apiDuration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('success', 'openai', '✅ HubSpot module generation completed', {
        usage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
        responseLength: moduleContent.length,
        tokensUsed: response.usage?.total_tokens || 0
      }, requestId, apiDuration);

      return moduleContent;
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      logger.error(`❌ [${requestId}] Error generating HubSpot module`, {
        error: error,
        message: (error as Error)?.message,
        totalDuration: `${totalDuration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('error', 'openai', '❌ Error generating HubSpot module', {
        error: (error as Error)?.message
      }, requestId, totalDuration);
      
      throw error;
    }
  }

  /**
   * Refine generated HTML with additional AI processing
   */
  async refineHTML(html: string, requirements?: string): Promise<string> {
    const startTime = Date.now();
    const requestId = `refine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info(`🔧 [${requestId}] Starting HTML refinement`, {
        htmlLength: html.length,
        hasRequirements: !!requirements,
        requirementsLength: requirements?.length || 0,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('info', 'openai', '🔧 Starting HTML refinement', {
        htmlLength: html.length,
        hasRequirements: !!requirements,
        requirementsLength: requirements?.length || 0
      }, requestId);

      const prompt = `
Refine this HTML/Tailwind code to improve:
1. Code quality and structure
2. Responsive design
3. Accessibility
4. Performance
5. Modern Tailwind patterns

${requirements ? `Additional requirements: ${requirements}` : ''}

HTML to refine:
${html}

Return only the improved HTML code.
`;

      logger.info(`📤 [${requestId}] Sending HTML refinement request to OpenAI`, {
        model: "gpt-4",
        maxTokens: 3000,
        temperature: 0.1,
        promptLength: prompt.length,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('info', 'openai', '📤 Sending HTML refinement request to OpenAI', {
        model: 'gpt-4',
        maxTokens: 3000,
        promptLength: prompt.length
      }, requestId);

      const response = await this.callOpenAI(
        [{ role: "user", content: prompt }],
        "gpt-4",
        3000,
        0.1
      );

      const apiDuration = Date.now() - startTime;
      const refinedHTML = response.choices[0]?.message?.content || html;
      
      logger.info(`✅ [${requestId}] HTML refinement completed`, {
        usage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
        originalLength: html.length,
        refinedLength: refinedHTML.length,
        apiDuration: `${apiDuration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('success', 'openai', '✅ HTML refinement completed', {
        usage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
        originalLength: html.length,
        refinedLength: refinedHTML.length,
        tokensUsed: response.usage?.total_tokens || 0
      }, requestId, apiDuration);

      return refinedHTML;
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      logger.error(`❌ [${requestId}] Error refining HTML`, {
        error: error,
        message: (error as Error)?.message,
        totalDuration: `${totalDuration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('error', 'openai', '❌ Error refining HTML', {
        error: (error as Error)?.message
      }, requestId, totalDuration);
      return html; // Return original if refinement fails
    }
  }
}

export default OpenAIService.getInstance();
