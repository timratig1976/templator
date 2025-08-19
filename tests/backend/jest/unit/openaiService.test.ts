import { jest } from '@jest/globals';

// Stable mock for OpenAI that works with module-level instantiation
const createMock = jest.fn() as any;
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      chat: {
        completions: {
          create: createMock,
        },
      },
    })),
  };
});

import openaiService from '../../../../backend/src/services/ai/openaiService';

describe('OpenAI Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('convertDesignToHTML', () => {
    const mockImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const mockFileName = 'test-design.png';

    it('should successfully convert design to HTML with valid AI response', async () => {
      const mockAIResponse = {
        choices: [{
          message: {
            content: `Here's the HTML conversion:

\`\`\`json
{
  "html": "<div class=\\"bg-white p-8\\"><h1 class=\\"text-4xl font-bold text-gray-900\\">Welcome to Our Service</h1><p class=\\"text-gray-600 mt-4\\">This is a modern landing page design.</p><button class=\\"bg-blue-600 text-white px-6 py-3 rounded-lg mt-6 hover:bg-blue-700\\">Get Started</button></div>",
  "sections": [
    {
      "id": "hero-section",
      "name": "Hero Section",
      "type": "hero",
      "html": "<div class=\\"bg-white p-8\\"><h1 class=\\"text-4xl font-bold text-gray-900\\">Welcome to Our Service</h1><p class=\\"text-gray-600 mt-4\\">This is a modern landing page design.</p><button class=\\"bg-blue-600 text-white px-6 py-3 rounded-lg mt-6 hover:bg-blue-700\\">Get Started</button></div>",
      "editableFields": [
        {
          "id": "hero-title",
          "name": "Hero Title",
          "type": "text",
          "selector": "h1",
          "defaultValue": "Welcome to Our Service",
          "required": true
        },
        {
          "id": "hero-description",
          "name": "Hero Description",
          "type": "text",
          "selector": "p",
          "defaultValue": "This is a modern landing page design.",
          "required": false
        },
        {
          "id": "cta-button",
          "name": "CTA Button Text",
          "type": "text",
          "selector": "button",
          "defaultValue": "Get Started",
          "required": true
        }
      ]
    }
  ],
  "components": [
    {
      "id": "title-comp",
      "name": "Main Title",
      "type": "text",
      "selector": "h1",
      "defaultValue": "Welcome to Our Service"
    },
    {
      "id": "desc-comp",
      "name": "Description",
      "type": "text",
      "selector": "p",
      "defaultValue": "This is a modern landing page design."
    },
    {
      "id": "button-comp",
      "name": "CTA Button",
      "type": "button",
      "selector": "button",
      "defaultValue": "Get Started"
    }
  ],
  "description": "A clean and modern hero section with a prominent call-to-action button. The design uses a simple white background with clear typography hierarchy."
}
\`\`\``
          }
        }]
      };

      createMock.mockResolvedValue(mockAIResponse as any);

      const result = await openaiService.convertDesignToHTML(mockImageBase64, mockFileName);

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('sections');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('description');
      
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0]).toHaveProperty('id', 'hero-section');
      expect(result.sections[0]).toHaveProperty('type', 'hero');
      expect(result.sections[0].editableFields).toHaveLength(3);
      
      expect(result.components).toHaveLength(3);
      expect(result.description).toContain('hero section');

      // Verify OpenAI was called with correct parameters
      expect(createMock).toHaveBeenCalledWith({
        model: 'gpt-4-vision-preview',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: expect.stringContaining('Analyze this design image')
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${mockImageBase64}`,
                detail: 'high'
              }
            }
          ]
        }],
        max_tokens: 4000,
        temperature: 0.1
      });
    });

    it('should handle AI response without JSON markdown formatting', async () => {
      const mockAIResponse = {
        choices: [{
          message: {
            content: `{
              "html": "<div class=\\"simple\\">Test</div>",
              "sections": [],
              "components": [],
              "description": "Simple test design"
            }`
          }
        }]
      };

      createMock.mockResolvedValue(mockAIResponse as any);

      const result = await openaiService.convertDesignToHTML(mockImageBase64, mockFileName);

      expect(result.html).toContain('<div class="simple">Test</div>');
      expect(result.description).toBe('Simple test design');
    });

    it('should throw error when OpenAI returns no content', async () => {
      const mockAIResponse = {
        choices: [{
          message: {
            content: null
          }
        }]
      };

      createMock.mockResolvedValue(mockAIResponse as any);

      await expect(openaiService.convertDesignToHTML(mockImageBase64, mockFileName))
        .rejects
        .toThrow('No response from OpenAI');
    });

    it('should throw error when AI response has invalid JSON format', async () => {
      const mockAIResponse = {
        choices: [{
          message: {
            content: 'This is not a valid JSON response'
          }
        }]
      };

      createMock.mockResolvedValue(mockAIResponse as any);

      await expect(openaiService.convertDesignToHTML(mockImageBase64, mockFileName))
        .rejects
        .toThrow('Invalid response format from AI');
    });

    it('should throw error when JSON parsing fails', async () => {
      const mockAIResponse = {
        choices: [{
          message: {
            content: '```json\n{ invalid json }\n```'
          }
        }]
      };

      createMock.mockResolvedValue(mockAIResponse as any);

      await expect(openaiService.convertDesignToHTML(mockImageBase64, mockFileName))
        .rejects
        .toThrow('Failed to parse AI response');
    });

    it('should handle OpenAI API quota exceeded error', async () => {
      const quotaError = new Error('Quota exceeded');
      (quotaError as any).code = 'insufficient_quota';

      createMock.mockRejectedValue(quotaError);

      await expect(openaiService.convertDesignToHTML(mockImageBase64, mockFileName))
        .rejects
        .toThrow('OpenAI API quota exceeded');
    });

    it('should handle general OpenAI API errors', async () => {
      const apiError = new Error('API connection failed');
      createMock.mockRejectedValue(apiError);

      await expect(openaiService.convertDesignToHTML(mockImageBase64, mockFileName))
        .rejects
        .toThrow('Failed to convert design to HTML');
    });
  });

  describe('refineHTML', () => {
    const mockHTML = '<div class="container"><h1>Title</h1><p>Content</p></div>';
    const mockRequirements = 'Make it more modern with better colors and spacing';

    it('should successfully refine HTML with requirements', async () => {
      const mockAIResponse = {
        choices: [{
          message: {
            content: '<div class="container mx-auto px-6 py-12 bg-gradient-to-r from-blue-50 to-indigo-100"><h1 class="text-4xl font-bold text-gray-900 mb-6">Title</h1><p class="text-lg text-gray-700 leading-relaxed">Content</p></div>'
          }
        }]
      };

      createMock.mockResolvedValue(mockAIResponse as any);

      const result = await openaiService.refineHTML(mockHTML, mockRequirements);

      expect(result).toContain('gradient');
      expect(result).toContain('text-4xl');
      expect(result).toContain('mx-auto');

      // Verify OpenAI was called with correct parameters
      expect(createMock).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [{
          role: 'user',
          content: expect.stringContaining('Refine and improve this HTML code')
        }],
        max_tokens: 2000,
        temperature: 0.2
      });
    });

    it('should refine HTML without specific requirements', async () => {
      const mockAIResponse = {
        choices: [{
          message: {
            content: '<div class="container max-w-4xl mx-auto px-4 py-8"><h1 class="text-3xl font-semibold text-gray-800 mb-4">Title</h1><p class="text-gray-600 leading-6">Content</p></div>'
          }
        }]
      };

      createMock.mockResolvedValue(mockAIResponse as any);

      const result = await openaiService.refineHTML(mockHTML);

      expect(result).toContain('max-w-4xl');
      expect(result).toContain('text-3xl');
    });

    it('should throw error when OpenAI returns no content for refinement', async () => {
      const mockAIResponse = {
        choices: [{
          message: {
            content: null
          }
        }]
      };

      createMock.mockResolvedValue(mockAIResponse as any);

      await expect(openaiService.refineHTML(mockHTML, mockRequirements))
        .rejects
        .toThrow('No response from OpenAI');
    });

    it('should handle OpenAI API errors during refinement', async () => {
      const apiError = new Error('API rate limit exceeded');
      createMock.mockRejectedValue(apiError);

      await expect(openaiService.refineHTML(mockHTML, mockRequirements))
        .rejects
        .toThrow('Failed to convert design to HTML');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network connection failed');
      createMock.mockRejectedValue(networkError);

      await expect(openaiService.convertDesignToHTML('test-image', 'test.png'))
        .rejects
        .toThrow('Failed to convert design to HTML');
    });

    it('should handle malformed API responses', async () => {
      const mockAIResponse = {
        choices: [] // Empty choices array
      };

      createMock.mockResolvedValue(mockAIResponse as any);

      await expect(openaiService.convertDesignToHTML('test-image', 'test.png'))
        .rejects
        .toThrow('No response from OpenAI');
    });
  });
});
