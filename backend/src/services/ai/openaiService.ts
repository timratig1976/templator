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

let openai: OpenAI | null = null;

if (process.env.NODE_ENV === 'test') {
  openai = null;
} else {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

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
  private async callOpenAI(messages: any[], model: string = 'gpt-4-vision-preview', maxTokens: number = 4000, temperature: number = 0.1): Promise<any> {
    const client = process.env.NODE_ENV === 'test' ? new OpenAI({ apiKey: 'test-key' }) : openai;
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

    // Compact AI call logging
    logToFrontend('info', 'openai', `🤖 AI Request (${model})`, {
      hasImages: imageCount > 0,
      messages: messages.length
    }, requestId);

    try {
      if (!client) {
        const error = 'OpenAI client not available';
        logToFrontend('error', 'openai', '❌ OpenAI Client Error', {
          error,
          requestId
        }, requestId);
        throw new Error(error);
      }

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
        setTimeout(() => {
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

      const apiPromise = client.chat.completions.create(requestData);
      
      // Step 5: Race between API call and timeout
      logToFrontend('info', 'openai', '⏳ Waiting for OpenAI response...', {
        requestId,
        status: 'pending'
      }, requestId);
      
      const response = await Promise.race([apiPromise, timeoutPromise]) as any;
      
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

      // Compact success logging
      logToFrontend('success', 'openai', `✨ AI Response (${response.model})`, {
        tokens: response.usage?.total_tokens || 0,
        duration: `${duration}ms`,
        cost: estimatedCost
      }, requestId);

      return response;
    } catch (error: any) {
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
      'gpt-4-vision-preview': { prompt: 0.01, completion: 0.03 }, // per 1K tokens
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
      'gpt-4-vision-preview': 0.01,
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
      'gpt-4-vision-preview': 0.03,
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
        jsonStr = match[1] || match[0];
        extractedWith = pattern.name;
        
        // Clean up any remaining backticks or markdown artifacts
        jsonStr = jsonStr.replace(/^```json\s*/gi, '').replace(/\s*```$/gi, '').trim();
        
        logToFrontend('success', 'openai', `✅ Pattern match found: ${pattern.name}`, {
          requestId,
          patternIndex: index + 1,
          extractedLength: jsonStr.length,
          extractedPreview: jsonStr.substring(0, 200) + (jsonStr.length > 200 ? '...' : ''),
          cleanedUp: jsonStr !== (match[1] || match[0])
        }, requestId);
        break;
      }
    }

    if (!jsonStr) {
      // If no pattern matches, try the entire content
      jsonStr = content.trim();
      extractedWith = 'full_content';
      
      logToFrontend('warning', 'openai', '⚠️ No pattern matched, using full content', {
        requestId,
        fallbackMethod: 'full_content',
        contentLength: jsonStr.length
      }, requestId);
    }

    // Step 2.5: Aggressive cleanup of any remaining markdown artifacts
    const originalJsonStr = jsonStr;
    jsonStr = jsonStr
      .replace(/^```json\s*/gi, '')  // Remove opening ```json
      .replace(/^```\s*/gi, '')      // Remove opening ```
      .replace(/\s*```$/gi, '')      // Remove closing ```
      .replace(/^`+/g, '')           // Remove leading backticks
      .replace(/`+$/g, '')           // Remove trailing backticks
      .trim();
    
    if (jsonStr !== originalJsonStr) {
      logToFrontend('info', 'openai', '🧹 Applied aggressive cleanup', {
        requestId,
        originalLength: originalJsonStr.length,
        cleanedLength: jsonStr.length,
        removedArtifacts: true
      }, requestId);
    }

    // Step 3: Attempt JSON parsing
    logToFrontend('info', 'openai', '🔧 Attempting JSON parse', {
      requestId,
      extractionMethod: extractedWith,
      jsonLength: jsonStr.length,
      startsWithBrace: jsonStr.trim().startsWith('{'),
      endsWithBrace: jsonStr.trim().endsWith('}')
    }, requestId);

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
      // Step 5: Enhanced error logging for parse failures
      const errorDetails = {
        requestId,
        error: parseError.message,
        extractedWith,
        contentLength: content.length,
        jsonStrLength: jsonStr.length,
        contentPreview: content.substring(0, 500),
        jsonStrPreview: jsonStr.substring(0, 500),
        parseErrorPosition: parseError.message.match(/position (\d+)/)?.[1],
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

      if (extractedWith === 'full_content') {
        throw new Error('Invalid response format from AI');
      } else {
        throw new Error('Failed to parse AI response');
      }
    }
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
        model: 'gpt-4-vision-preview'
      }, requestId);

      const prompt = `
Analyze this design image and convert it to clean, semantic HTML with Tailwind CSS. Follow these requirements:

1. **HTML Structure**: Create semantic HTML5 with proper sections (header, main, footer, etc.)
2. **Tailwind CSS Excellence**: 
   - Use ONLY Tailwind utility classes - NO custom CSS
   - Follow mobile-first responsive design: base styles for mobile, then sm:, md:, lg:, xl:
   - Use Tailwind spacing scale consistently (p-4, m-8, space-y-6, gap-4)
   - Apply proper color palette (bg-blue-500, text-gray-900, border-gray-200)
   - Use layout utilities: flex, grid, container mx-auto px-4
   - Add hover states and transitions: hover:bg-blue-600, transition-all duration-300
3. **Responsive Design**: Mobile-first with proper breakpoints (sm:640px, md:768px, lg:1024px, xl:1280px)
4. **Accessibility**: Include proper ARIA labels, alt text, and semantic elements
5. **Component Identification**: Identify reusable components and sections
6. **Clean Formatting**: Generate properly formatted, minified HTML without excessive newlines
7. **REQUIRED IMAGE PLACEHOLDERS**: You MUST include <img> tags with placeholder paths for ALL visual elements in the design
8. **Tailwind Best Practices**:
   - Group related utilities logically
   - Use semantic color meanings (red for errors, green for success)
   - Apply consistent typography hierarchy (text-4xl font-bold for headings)
   - Include proper focus states for interactive elements
   - Use shadow and border utilities for depth

**Output Format**: Return a JSON object with this structure:
{
"html": "Complete clean HTML code with Tailwind classes - properly formatted without excessive newlines",
"sections": [
  {
    "id": "unique-id",
    "name": "Section Name",
    "type": "header|hero|content|footer|sidebar|navigation",
    "html": "Clean HTML for this section only - no excessive newlines",
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

**Critical HTML Requirements**: 
- Generate clean, properly formatted HTML without excessive \\n characters
- Use semantic HTML elements (header, main, section, article, aside, footer)
- Include proper DOCTYPE and html structure with head and body tags
- Use modern Tailwind classes (gradients, shadows, animations, responsive breakpoints)
- Make text content editable by identifying headlines, paragraphs, buttons
- **MANDATORY IMAGE REQUIREMENTS**: You MUST include <img> tags for ALL visual elements using ONLY these safe placeholder patterns:
  * Header sections: Include logo image with <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxZjI5MzciLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9IjAuMzVlbSIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiI+TE9HTzwvdGV4dD48L3N2Zz4=" alt="Company Logo" class="h-10 w-auto">
  * Hero sections: Include hero/banner image with <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNjM2NmYxIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIwLjM1ZW0iIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiNmZmZmZmYiPkhFUk88L3RleHQ+PC9zdmc+" alt="Hero Image" class="w-full h-96 object-cover">
  * Content sections: Include relevant content images with <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTVlN2ViIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIwLjM1ZW0iIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzIiIGZpbGw9IiM2Yjc2ODAiPklNQUdFPC90ZXh0Pjwvc3ZnPg==" alt="Content Image" class="w-full h-auto rounded-lg">
  * Product sections: Include product images with <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjU5ZTBiIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIwLjM1ZW0iIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzIiIGZpbGw9IiNmZmZmZmYiPlBST0RVQ1Q8L3RleHQ+PC9zdmc+" alt="Product Image" class="w-full h-48 object-cover">
  * Footer sections: Include social media icons with <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzNiODJmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zNWVtIiBmb250LWZhbWlseT0ic3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmaWxsPSIjZmZmZmZmIj7imIU8L3RleHQ+PC9zdmc+" alt="Social Icon" class="w-6 h-6">
  * Navigation: Include menu icons for mobile with <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzNiODJmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zNWVtIiBmb250LWZhbWlseT0ic3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmaWxsPSIjZmZmZmZmIj7imIU8L3RleHQ+PC9zdmc+" alt="Menu" class="w-6 h-6">
- Create logical sections that can become HubSpot modules
- Ensure responsive design with proper breakpoints (sm:, md:, lg:, xl:)
- Use proper indentation and formatting - avoid excessive newlines
- Generate valid, well-structured HTML that renders correctly
- ALWAYS include image placeholders even if the design doesn't show specific images - infer where images should logically be placed
- **CRITICAL**: NEVER use file paths like logo.png, feature1.jpg, image.jpg, or template variables like {{ logo_url }}
- **CRITICAL**: ONLY use the exact data:image/svg+xml;base64 URLs provided above - NO exceptions
- **CRITICAL**: If you need different image types, use the provided data URI patterns and modify dimensions in the SVG
`;

      logger.info(`📤 [${requestId}] Sending OpenAI API request`, {
        model: "gpt-4-vision-preview",
        maxTokens: 4000,
        temperature: 0.1,
        promptLength: prompt.length,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Log to frontend
      logToFrontend('info', 'openai', '📤 Sending request to OpenAI API', {
        model: 'gpt-4-vision-preview',
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

      const analysisData = this.extractJSON(content, requestId);
      if (!analysisData) {
        throw new Error('Invalid response format from AI');
      }
      
      if (process.env.NODE_ENV !== 'test' && analysisData.html) {
        analysisData.html = this.cleanupHTML(analysisData.html);
      }
      
      // Clean up section HTML
      if (analysisData.sections) {
        analysisData.sections = analysisData.sections.map((section: any) => ({
          ...section,
          html: section.html ? this.cleanupHTML(section.html) : section.html
        }));
      }
      
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
        throw new Error('Invalid response format from AI');
      }
      
      if ((error as any)?.code === 'insufficient_quota') {
        throw createError('OpenAI API quota exceeded', 503, 'INTERNAL_ERROR');
      }
      
      // Check for OpenAI API specific errors
      if ((error as any)?.response?.status === 401) {
        throw createError('OpenAI API key is invalid', 401, 'INTERNAL_ERROR');
      }
      
      if ((error as any)?.response?.status === 429) {
        throw createError('Rate limit exceeded', 429, 'INTERNAL_ERROR');
      }
      
      const errorMessage = (error as Error)?.message || '';
      
      if (errorMessage.includes('No response from OpenAI') ||
          errorMessage.includes('Invalid response format from AI') ||
          errorMessage.includes('Failed to parse AI response') ||
          errorMessage.includes('OpenAI API quota exceeded') ||
          errorMessage.includes('Rate limit exceeded')) {
        throw error;
      }
      
      throw createError(
        'Failed to convert design to HTML',
        500,
        'INTERNAL_ERROR',
        errorMessage || 'Unknown error occurred'
      );
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
Refine and improve this HTML code to enhance:
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
      
      if (!response.choices || response.choices.length === 0) {
        throw new Error('No response from OpenAI');
      }

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }
      
      const refinedHTML = content;
      
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
      
      const errorMessage = (error as any)?.message || '';
      
      if (errorMessage.includes('No response from OpenAI') ||
          errorMessage.includes('Invalid response format from AI') ||
          errorMessage.includes('Failed to parse AI response') ||
          errorMessage.includes('OpenAI API quota exceeded') ||
          errorMessage.includes('Rate limit exceeded')) {
        throw error;
      }
      
      if (errorMessage.includes('API rate limit exceeded')) {
        throw new Error('Failed to convert design to HTML');
      }
      
      return html; // Return original if refinement fails
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
