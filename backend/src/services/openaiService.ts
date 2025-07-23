import OpenAI from 'openai';
import { createError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';

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

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
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
        ],
        max_tokens: 4000,
        temperature: 0.1,
      });

      const apiDuration = Date.now() - startTime;
      logger.info(`📥 [${requestId}] Received OpenAI API response`, {
        usage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
        responseLength: response.choices[0]?.message?.content?.length || 0,
        apiDuration: `${apiDuration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw createError('No response from OpenAI', 500, 'INTERNAL_ERROR');
      }

      // Extract JSON from response (handle potential markdown formatting)
      logger.info(`🔍 [${requestId}] Parsing OpenAI response`, {
        contentLength: content.length,
        hasJsonBlock: content.includes('```json'),
        requestId,
        timestamp: new Date().toISOString()
      });

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
      logger.info(`✅ [${requestId}] Successfully converted design to HTML`, {
        sectionsCount: analysisData.sections?.length || 0,
        componentsCount: analysisData.components?.length || 0,
        htmlLength: analysisData.html?.length || 0,
        totalDuration: `${totalDuration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });
      
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

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3000,
        temperature: 0.1,
      });

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
      return html; // Return original if refinement fails
    }
  }
}

export default OpenAIService.getInstance();
