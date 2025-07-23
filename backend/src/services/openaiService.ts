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
    try {
      logger.info(`Starting design-to-HTML conversion for: ${fileName}`);

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

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw createError('No response from OpenAI', 500, 'INTERNAL_ERROR');
      }

      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw createError('Invalid response format from AI', 500, 'INTERNAL_ERROR');
      }

      const analysisData = JSON.parse(jsonMatch[0].replace(/```json\n?|\n?```/g, ''));
      
      logger.info(`Successfully converted design to HTML. Sections: ${analysisData.sections?.length || 0}`);
      
      return analysisData as DesignAnalysis;

    } catch (error) {
      logger.error('Error converting design to HTML:', {
        error: error,
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
        code: (error as any)?.code,
        status: (error as any)?.status,
        response: (error as any)?.response?.data
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
    try {
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

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3000,
        temperature: 0.1,
      });

      return response.choices[0]?.message?.content || html;
    } catch (error) {
      logger.error('Error refining HTML:', error);
      return html; // Return original if refinement fails
    }
  }
}

export default OpenAIService.getInstance();
