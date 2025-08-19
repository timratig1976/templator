import OpenAI from 'openai';
import { createError } from '../../middleware/errorHandler';
import { createLogger } from '../../utils/logger';
import { logToFrontend } from '../../routes/logs';

const logger = createLogger();

// Validate API key exists (skip in test environment)
if (!process.env.OPENAI_API_KEY && process.env.NODE_ENV !== 'test') {
  logger.error('OPENAI_API_KEY environment variable is not set');
  throw new Error('OpenAI API key is required but not provided');
}

// Always construct the client so Jest can mock the constructor in tests
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
    // Timeout handle available to both try and catch
    let timeoutId: NodeJS.Timeout | undefined;

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

    // Compact AI call logging
    logToFrontend('info', 'openai', `🤖 AI Request (${model})`, {
      hasImages: imageCount > 0,
      messages: messages.length
    }, requestId);

    try {
      // Step 1: Log API call initiation
      logToFrontend('info', 'openai', '🔄 Initiating OpenAI API call', {
        requestId,
        model,
        maxTokens,
        temperature,
        messageCount: messages.length,
        imageCount,
        promptLength: typeof prompt === 'string' ? prompt.length : JSON.stringify(prompt).length
      }, requestId);

      // Step 2: Log request payload details
      logToFrontend('info', 'openai', '📋 Request payload prepared', {
        requestId,
        payloadSize: JSON.stringify(requestData).length,
        hasImages: imageCount > 0,
        messageStructure: messages.map((msg, i) => ({
          index: i,
          role: msg.role,
          contentType: Array.isArray(msg.content) ? 'multipart' : 'text',
          contentItems: Array.isArray(msg.content) ? msg.content.length : 1
        }))
      }, requestId);

      // Step 3: Add timeout wrapper for OpenAI API call (180 seconds to match frontend)
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const timeoutError = new Error('OpenAI API request timed out after 180 seconds');
          logToFrontend('error', 'openai', '⏰ OpenAI API Timeout', {
            requestId,
            timeout: '180 seconds',
            duration: Date.now() - startTime
          }, requestId);
          reject(timeoutError);
        }, 180000); // Increased to 3 minutes to match frontend timeout
      });

      // Step 4: Log API call start
      logToFrontend('info', 'openai', '🚀 Sending request to OpenAI API', {
        requestId,
        endpoint: 'chat/completions',
        startTime: new Date(startTime).toISOString()
      }, requestId);

      const apiPromise = openai.chat.completions.create(requestData);
      
      // Step 5: Race between API call and timeout
      logToFrontend('info', 'openai', '⏳ Waiting for OpenAI response...', {
        requestId,
        status: 'pending'
      }, requestId);
      
      const response = await Promise.race([apiPromise, timeoutPromise]) as any;
      // Clear timeout to avoid leaving open handles in tests
      if (timeoutId) clearTimeout(timeoutId);
      
      // Step 6: Log successful response receipt
      logToFrontend('success', 'openai', '📨 Received OpenAI response', {
        requestId,
        responseId: response.id,
        model: response.model,
        created: response.created,
        duration: Date.now() - startTime
      }, requestId);

      const duration = Date.now() - startTime;
      const responseContent = response.choices?.[0]?.message?.content || '';

      // Step 7: Log response analysis
      logToFrontend('info', 'openai', '🔍 Analyzing OpenAI response', {
        requestId,
        responseLength: responseContent.length,
        choicesCount: response.choices?.length || 0,
        finishReason: response.choices?.[0]?.finish_reason,
        usage: response.usage
      }, requestId);

      // Calculate estimated cost
      const estimatedCost = this.estimateOpenAICost(response.usage, response.model);
      
      // Step 8: Log cost calculation
      logToFrontend('info', 'openai', '💰 Cost calculation completed', {
        requestId,
        estimatedCost,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens
      }, requestId);

      // Log successful response to backend
      logger.info('OpenAI API Response', {
        requestId,
        duration: `${duration}ms`,
        usage: response.usage,
        finishReason: response.choices?.[0]?.finish_reason,
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

      // Compact success logging
      logToFrontend('success', 'openai', `✨ AI Response (${response.model})`, {
        tokens: response.usage?.total_tokens || 0,
        duration: `${duration}ms`,
        cost: estimatedCost
      }, requestId);

      return response;
    } catch (error: any) {
      // Ensure timeout is cleared on error as well
      // Note: timeoutId may be undefined if error occurred before assignment
      try { if (timeoutId) clearTimeout(timeoutId); } catch {}
      const duration = Date.now() - startTime;
      
      // Step 9: Log error occurrence
      logToFrontend('error', 'openai', '🚨 OpenAI API Error Detected', {
        requestId,
        errorType: error.constructor.name,
        errorMessage: error.message,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }, requestId);

      // Step 10: Analyze error details
      const errorDetails = {
        requestId,
        duration: `${duration}ms`,
        error: error.message,
        code: error.code,
        status: error.status,
        type: error.type,
        param: error.param,
        response: error.response?.data,
        headers: error.response?.headers,
        stack: error.stack?.split('\n').slice(0, 5) // First 5 lines of stack trace
      };

      // Step 11: Categorize error type
      let errorCategory = 'unknown';
      if (error.message?.includes('timeout')) {
        errorCategory = 'timeout';
      } else if (error.status === 401) {
        errorCategory = 'authentication';
      } else if (error.status === 429) {
        errorCategory = 'rate_limit';
      } else if (error.status >= 500) {
        errorCategory = 'server_error';
      } else if (error.status >= 400) {
        errorCategory = 'client_error';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorCategory = 'network';
      }

      logToFrontend('error', 'openai', `🔍 Error Analysis Complete`, {
        requestId,
        category: errorCategory,
        severity: error.status >= 500 ? 'high' : error.status >= 400 ? 'medium' : 'low',
        retryable: errorCategory === 'rate_limit' || errorCategory === 'server_error' || errorCategory === 'network'
      }, requestId);

      // Log error to backend
      logger.error('OpenAI API Error', errorDetails);

      // Step 12: Broadcast comprehensive error to frontend
      logToFrontend('error', 'openai', `❌ OpenAI API request failed [${errorCategory}]`, {
        ...errorDetails,
        category: errorCategory,
        troubleshooting: this.getErrorTroubleshooting(errorCategory, error)
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
   * Extract and parse JSON from OpenAI response with improved error handling
   */
  private extractJSON(content: string, requestId?: string): any {
    // Step 1: Log JSON extraction start
    logToFrontend('info', 'openai', '🔍 Starting JSON extraction', {
      requestId,
      contentLength: content?.length || 0,
      contentPreview: content?.substring(0, 200) + (content?.length > 200 ? '...' : '')
    }, requestId);

    if (!content) {
      logToFrontend('error', 'openai', '❌ Empty response content', {
        requestId,
        error: 'No content to extract JSON from'
      }, requestId);
      throw new Error('Empty response content');
    }

    // Step 2: Try multiple extraction patterns (improved for OpenAI responses)
    const patterns = [
      { regex: /```json\s*([\s\S]*?)\s*```/gi, name: 'markdown_json_block' },
      { regex: /```([\s\S]*?)```/gi, name: 'generic_markdown_block' },
      { regex: /\{[\s\S]*?\}/g, name: 'json_object_pattern' },
      { regex: /^\s*\{[\s\S]*\}\s*$/g, name: 'full_json_object' }
    ];

    let jsonStr = '';
    let extractedWith = '';

    logToFrontend('info', 'openai', '🔎 Trying extraction patterns', {
      requestId,
      patternCount: patterns.length,
      patterns: patterns.map(p => p.name)
    }, requestId);

    for (const [index, pattern] of patterns.entries()) {
      // Reset regex lastIndex for global patterns
      pattern.regex.lastIndex = 0;
      const match = content.match(pattern.regex);
      if (match) {
        // For markdown blocks, use captured group; for object patterns, use full match
        jsonStr = (match as any)[1] || match[0];
        extractedWith = pattern.name;
        // Clean up any remaining backticks or markdown artifacts
        jsonStr = jsonStr.replace(/^```json\s*/gi, '').replace(/\s*```$/gi, '').trim();
        logToFrontend('success', 'openai', `✅ Pattern match found: ${pattern.name}`, {
          requestId,
          patternIndex: index + 1,
          extractedLength: jsonStr.length,
          extractedPreview: jsonStr.substring(0, 200) + (jsonStr.length > 200 ? '...' : ''),
          cleanedUp: jsonStr !== ((match as any)[1] || match[0])
        }, requestId);
        break;
      }
    }

    // If we didn't extract anything, it's an invalid AI response format
    if (!jsonStr) {
      logToFrontend('error', 'openai', '❌ Invalid AI response format (no JSON detected)', {
        requestId,
        contentPreview: content.substring(0, 200)
      }, requestId);
      throw new Error('Invalid response format from AI');
    }

    // Step 3: Attempt JSON parsing
    logToFrontend('info', 'openai', '🔧 Attempting JSON parse', {
      requestId,
      extractionMethod: extractedWith,
      jsonLength: jsonStr.length,
      startsWithBrace: jsonStr.trim().startsWith('{'),
      endsWithBrace: jsonStr.trim().endsWith('}')
    }, requestId);

    const originalJsonStr = jsonStr;
    try {
      const parsed = JSON.parse(jsonStr);
      // Step 4: Log successful parsing
      logToFrontend('success', 'openai', '✅ JSON parsing successful', {
        requestId,
        extractionMethod: extractedWith,
        objectKeys: Object.keys(parsed || {}),
        objectType: Array.isArray(parsed) ? 'array' : typeof parsed
      }, requestId);
      return parsed;
    } catch (parseError: any) {
      // If content isn't obviously JSON, try to find a JSON-like structure
      if (!jsonStr.trim().startsWith('{')) {
        const startIdx = jsonStr.indexOf('{');
        const endIdx = jsonStr.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonStr = jsonStr.substring(startIdx, endIdx + 1);
        } else {
          // No JSON-like content found at all -> invalid AI response format
          logToFrontend('error', 'openai', '❌ Invalid AI response format (no JSON detected)', {
            requestId,
            contentPreview: content.substring(0, 200)
          }, requestId);
          throw new Error('Invalid response format from AI');
        }
      }

      // Try a second parse after cleanup
      try {
        const parsed = JSON.parse(jsonStr);
        logToFrontend('success', 'openai', '✅ JSON parsing successful after cleanup', {
          requestId,
          extractionMethod: extractedWith
        }, requestId);
        return parsed;
      } catch (parseError2: any) {
        // Step 5: Enhanced error logging for parse failures
        const errorDetails = {
          requestId,
          error: parseError2.message,
          extractedWith,
          contentLength: content.length,
          jsonStrLength: jsonStr.length,
          contentPreview: content.substring(0, 500),
          jsonStrPreview: jsonStr.substring(0, 500),
          parseErrorPosition: parseError2.message.match(/position (\d+)/)?.[1],
          jsonStructureAnalysis: {
            startsWithBrace: jsonStr.trim().startsWith('{'),
            endsWithBrace: jsonStr.trim().endsWith('}'),
            braceCount: (jsonStr.match(/\{/g) || []).length,
            closeBraceCount: (jsonStr.match(/\}/g) || []).length,
            hasNewlines: jsonStr.includes('\n'),
            hasBackticks: jsonStr.includes('`'),
            firstChars: jsonStr.substring(0, 50),
            lastChars: jsonStr.substring(Math.max(0, jsonStr.length - 50))
          },
          debugInfo: {
            originalContent: content.substring(0, 1000),
            finalJsonStr: jsonStr.substring(0, 1000),
            cleanupApplied: jsonStr !== originalJsonStr
          }
        };

        // Enhanced error logging
        logger.error('JSON Parse Error', errorDetails);
        logToFrontend('error', 'openai', '❌ JSON parsing failed', {
          ...errorDetails,
          troubleshooting: [
            'OpenAI response may not be in valid JSON format',
            'Response might be wrapped in unexpected markdown',
            'Check if response contains syntax errors',
            'Verify OpenAI model is returning structured data'
          ]
        }, requestId);

        // Throw a SyntaxError so callers can produce a specific user-facing message
        const syntaxErr = new SyntaxError(`Failed to parse JSON response: ${parseError2.message}`);
        (syntaxErr as any).cause = parseError2;
        throw syntaxErr;
      }
    }
  }

  // ...

  async convertDesignToHTML(imageBase64: string, fileName: string): Promise<DesignAnalysis> {
    const requestId = `convert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      // Ensure data URL prefix for base64 image
      let imageUrl = imageBase64 || '';
      if (imageUrl && !imageUrl.startsWith('data:image')) {
        // Default to jpeg if not specified
        imageUrl = `data:image/jpeg;base64,${imageUrl}`;
      }

      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Analyze this design image and return ONLY JSON with keys: html (string), sections (array), components (array), description (string). Do not include any extra text.'
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'high' }
            }
          ]
        }
      ];

      const response = await this.callOpenAI(messages as any, 'gpt-4-vision-preview', 4000, 0.1);
      const content = response?.choices?.[0]?.message?.content;
      if (!content) {
        throw createError('No response from OpenAI', 500, 'INTERNAL_ERROR');
      }
      // Early validation: if no JSON-like braces exist at all, flag invalid format per tests
      const hasBraces = typeof content === 'string' && content.includes('{') && content.includes('}');
      if (!hasBraces) {
        throw createError('Invalid response format from AI', 500, 'INTERNAL_ERROR');
      }

      // Parse JSON with localized error mapping to preserve exact messages
      let analysisData: DesignAnalysis;
      try {
        analysisData = this.extractJSON(content, requestId) as DesignAnalysis;
      } catch (parseErr: any) {
        const pm = (parseErr?.message || '').toLowerCase();
        if (parseErr?.message === 'Invalid response format from AI' || pm.includes('invalid response format from ai')) {
          throw createError('Invalid response format from AI', 500, 'INTERNAL_ERROR');
        }
        if (parseErr instanceof SyntaxError || parseErr?.name === 'SyntaxError' || pm.includes('failed to parse json') || pm.includes('unexpected token') || pm.includes('in json at position')) {
          throw createError('Failed to parse AI response', 500, 'INTERNAL_ERROR');
        }
        throw parseErr;
      }
      if (analysisData?.html) {
        analysisData.html = this.cleanupHTML(analysisData.html);
      }
      return analysisData;
    } catch (error: any) {
      // First: map known messages to exact test-expected messages
      {
        const msgRaw = (error as any)?.message ?? String(error ?? '');
        const msg = typeof msgRaw === 'string' ? msgRaw : '';
        if (msg.includes('Invalid response format from AI')) {
          throw createError('Invalid response format from AI', 500, 'INTERNAL_ERROR');
        }
        if (msg.includes('Failed to parse AI response')) {
          throw createError('Failed to parse AI response', 500, 'INTERNAL_ERROR');
        }
        if (msg.includes('OpenAI API quota exceeded')) {
          throw createError('OpenAI API quota exceeded', 503, 'INTERNAL_ERROR');
        }
        if (msg.includes('No response from OpenAI')) {
          throw createError('No response from OpenAI', 500, 'INTERNAL_ERROR');
        }
      }
      // Pass-through if this is already an AppError created earlier (preserve exact message)
      if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
        throw error;
      }
      // Immediate pass-through for explicitly thrown app errors with exact messages expected by tests
      if ((error as Error)?.message === 'Invalid response format from AI') {
        throw createError('Invalid response format from AI', 500, 'INTERNAL_ERROR');
      }
      if ((error as Error)?.message === 'No response from OpenAI') {
        throw createError('No response from OpenAI', 500, 'INTERNAL_ERROR');
      }
      const errStr = (typeof error === 'string' ? error : (error?.message || String(error || ''))).toLowerCase();
      if (error?.code === 'insufficient_quota' ||
          errStr.includes('insufficient_quota') ||
          errStr.includes('quota')) {
        throw createError('OpenAI API quota exceeded', 503, 'INTERNAL_ERROR');
      }
      if ((error as Error)?.message === 'Invalid response format from AI' ||
          errStr.includes('invalid response format from ai')) {
        throw createError('Invalid response format from AI', 500, 'INTERNAL_ERROR');
      }
      if (error instanceof SyntaxError || error?.name === 'SyntaxError' ||
          errStr.includes('failed to parse json') ||
          errStr.includes('unexpected token') ||
          errStr.includes('in json at position')) {
        throw createError('Failed to parse AI response', 500, 'INTERNAL_ERROR');
      }
      if (errStr.includes('no response from openai')) {
        throw createError('No response from OpenAI', 500, 'INTERNAL_ERROR');
      }
      if (error?.response?.status === 401) {
        throw createError('OpenAI API key is invalid', 401, 'INTERNAL_ERROR');
      }
      if (error?.response?.status === 429) {
        throw createError('OpenAI API rate limit exceeded', 429, 'INTERNAL_ERROR');
      }
      // Final safeguard was moved to the top of the catch
      throw createError('Failed to convert design to HTML', 500, 'INTERNAL_ERROR', (error as Error)?.message);
    }
  }

  /**
   * Clean up HTML formatting and remove excessive newlines
   */
  private cleanupHTML(html: string): string {
    if (!html) return html;
    
    return html
      // Remove excessive newlines and whitespace
      .replace(/\n\s*\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      // Clean up quotes around attributes
      .replace(/"([^"]*)"/g, '"$1"')
      // Remove extra spaces around tags
      .replace(/\s+>/g, '>')
      .replace(/<\s+/g, '<')
      // Clean up whitespace inside tags
      .replace(/\s{2,}/g, ' ')
      // Remove leading/trailing whitespace from lines
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      // Ensure proper HTML structure
      .replace(/^(?!<!DOCTYPE|<html)/i, '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Generated Design</title>\n<script src="https://cdn.tailwindcss.com"></script>\n</head>\n<body>\n')
      // Ensure closing tags if missing
      + (html.includes('</body>') ? '' : '\n</body>\n</html>');
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
        "gpt-4",
        4000,
        0.1
      );

      const apiDuration = Date.now() - startTime;
      const moduleContent = response.choices[0]?.message?.content || '';
      
      logger.info(`✅ [${requestId}] HubSpot module generation completed`, {
        usage: response.usage,
        finishReason: response.choices?.[0]?.finish_reason,
        responseLength: moduleContent.length,
        apiDuration: `${apiDuration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('success', 'openai', '✅ HubSpot module generation completed', {
        usage: response.usage,
        finishReason: response.choices?.[0]?.finish_reason,
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
Refine and improve this HTML code to be more modern, accessible, and visually appealing using Tailwind CSS. ${requirements ? `Requirements: ${requirements}` : ''}

HTML:
${html}

Return only the improved HTML code.
`;

      logger.info(`📤 [${requestId}] Sending HTML refinement request to OpenAI`, {
        model: "gpt-4",
        maxTokens: 2000,
        temperature: 0.2,
        promptLength: prompt.length,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('info', 'openai', '📤 Sending HTML refinement request to OpenAI', {
        model: 'gpt-4',
        maxTokens: 2000,
        promptLength: prompt.length
      }, requestId);

      const response = await this.callOpenAI(
        [{ role: "user", content: prompt }],
        "gpt-4",
        2000,
        0.2
      );

      const apiDuration = Date.now() - startTime;
      const content = response?.choices?.[0]?.message?.content;
      if (!content) {
        throw createError('No response from OpenAI', 500, 'INTERNAL_ERROR');
      }
      const refinedHTML = content;
      
      logger.info(`✅ [${requestId}] HTML refinement completed`, {
        usage: response.usage,
        finishReason: response.choices?.[0]?.finish_reason,
        originalLength: html.length,
        refinedLength: refinedHTML.length,
        apiDuration: `${apiDuration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('success', 'openai', '✅ HTML refinement completed', {
        usage: response.usage,
        finishReason: response.choices?.[0]?.finish_reason,
        originalLength: html.length,
        refinedLength: refinedHTML.length,
        tokensUsed: response.usage?.total_tokens || 0
      }, requestId, apiDuration);

      return refinedHTML;
    } catch (error: any) {
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
      // Surface errors to callers (unit tests expect thrown errors)
      // Pass-through if already an AppError to preserve message
      if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
        throw error;
      }
      const errStr = (typeof error === 'string' ? error : (error?.message || String(error || ''))).toLowerCase();
      if (error?.code === 'insufficient_quota' || errStr.includes('insufficient_quota') || errStr.includes('quota')) {
        throw createError('OpenAI API quota exceeded', 503, 'INTERNAL_ERROR');
      }
      if ((error as Error)?.message === 'No response from OpenAI' || errStr.includes('no response from openai')) {
        throw createError('No response from OpenAI', 500, 'INTERNAL_ERROR');
      }
      if (error instanceof SyntaxError || error?.name === 'SyntaxError' ||
          errStr.includes('failed to parse json') ||
          errStr.includes('unexpected token') ||
          errStr.includes('in json at position')) {
        throw createError('Failed to parse AI response', 500, 'INTERNAL_ERROR');
      }
      // Final safeguard was moved to the top of the catch
      throw createError('Failed to convert design to HTML', 500, 'INTERNAL_ERROR', (error as Error)?.message);
    }
  }

  /**
   * Get troubleshooting information for different error categories
   */
  private getErrorTroubleshooting(category: string, error: any): string[] {
    switch (category) {
      case 'timeout':
        return [
          'The OpenAI API request took longer than 120 seconds',
          'Try reducing image size or complexity',
          'Check your internet connection',
          'OpenAI servers may be experiencing high load'
        ];
      case 'authentication':
        return [
          'Invalid or missing OpenAI API key',
          'Check your .env file contains OPENAI_API_KEY',
          'Verify your API key is active and has sufficient credits',
          'Ensure no extra spaces in the API key'
        ];
      case 'rate_limit':
        return [
          'OpenAI API rate limit exceeded',
          'Wait a few minutes before retrying',
          'Consider upgrading your OpenAI plan',
          'Implement request queuing for high-volume usage'
        ];
      case 'server_error':
        return [
          'OpenAI servers are experiencing issues',
          'This is usually temporary - try again in a few minutes',
          'Check OpenAI status page for known issues',
          'Consider implementing retry logic with exponential backoff'
        ];
      case 'client_error':
        return [
          'Invalid request format or parameters',
          'Check image format is supported (JPEG, PNG, GIF, WebP)',
          'Verify image size is under OpenAI limits',
          'Review request payload structure'
        ];
      case 'network':
        return [
          'Network connectivity issue',
          'Check your internet connection',
          'Verify firewall/proxy settings allow OpenAI API access',
          'Try again in a few moments'
        ];
      default:
        return [
          'Unknown error occurred',
          'Check the error details above for more information',
          'Try refreshing the page and uploading again',
          'Contact support if the issue persists'
        ];
    }
  }
}

export default OpenAIService.getInstance();
