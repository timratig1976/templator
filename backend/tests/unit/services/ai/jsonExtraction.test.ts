/**
 * Unit Tests for Enhanced JSON Extraction
 * Tests the improved JSON parsing functionality for OpenAI responses
 */

import { OpenAIService } from '../../../../src/services/ai/openaiService';

// Mock OpenAI without importing the problematic unit.setup
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}));

// Set test environment variables
(process.env as any).NODE_ENV = 'test';
(process.env as any).OPENAI_API_KEY = 'test-openai-key';

describe('OpenAIService - Enhanced JSON Extraction', () => {
  let openaiService: OpenAIService;

  beforeEach(() => {
    openaiService = OpenAIService.getInstance();
    // Clear any previous mocks
    jest.clearAllMocks();
  });

  describe('extractJSON', () => {
    // Test the private extractJSON method by accessing it through reflection
    const callExtractJSON = (content: string, requestId?: string) => {
      return (openaiService as any).extractJSON(content, requestId);
    };

    describe('Markdown-wrapped JSON responses', () => {
      it('should extract JSON from standard markdown json block', () => {
        const content = '```json\n{\n  "html": "<div>Test</div>",\n  "sections": []\n}\n```';
        
        const result = callExtractJSON(content, 'test-request-1');
        
        expect(result).toEqual({
          html: '<div>Test</div>',
          sections: []
        });
      });

      it('should extract JSON from generic markdown block', () => {
        const content = '```\n{\n  "html": "<div>Generic</div>",\n  "components": []\n}\n```';
        
        const result = callExtractJSON(content, 'test-request-2');
        
        expect(result).toEqual({
          html: '<div>Generic</div>',
          components: []
        });
      });

      it('should handle markdown with extra whitespace', () => {
        const content = '  ```json  \n\n  {\n    "html": "<div>Whitespace</div>"\n  }\n\n  ```  ';
        
        const result = callExtractJSON(content, 'test-request-3');
        
        expect(result).toEqual({
          html: '<div>Whitespace</div>'
        });
      });

      it('should handle mixed case markdown tags', () => {
        const content = '```JSON\n{\n  "html": "<div>Mixed Case</div>"\n}\n```';
        
        const result = callExtractJSON(content, 'test-request-4');
        
        expect(result).toEqual({
          html: '<div>Mixed Case</div>'
        });
      });
    });

    describe('Raw JSON responses', () => {
      it('should extract raw JSON object', () => {
        const content = '{\n  "html": "<div>Raw JSON</div>",\n  "description": "Test"\n}';
        
        const result = callExtractJSON(content, 'test-request-5');
        
        expect(result).toEqual({
          html: '<div>Raw JSON</div>',
          description: 'Test'
        });
      });

      it('should handle JSON with surrounding text', () => {
        const content = 'Here is the analysis:\n\n{\n  "html": "<div>Surrounded</div>"\n}\n\nThat completes the analysis.';
        
        const result = callExtractJSON(content, 'test-request-6');
        
        expect(result).toEqual({
          html: '<div>Surrounded</div>'
        });
      });
    });

    describe('Aggressive cleanup scenarios', () => {
      it('should remove leading and trailing backticks', () => {
        const content = '`````json\n{\n  "html": "<div>Multiple Backticks</div>"\n}\n`````';
        
        const result = callExtractJSON(content, 'test-request-7');
        
        expect(result).toEqual({
          html: '<div>Multiple Backticks</div>'
        });
      });

      it('should handle malformed markdown blocks', () => {
        const content = '```json\n{\n  "html": "<div>Malformed</div>"\n}\n``'; // Missing closing backtick
        
        const result = callExtractJSON(content, 'test-request-8');
        
        expect(result).toEqual({
          html: '<div>Malformed</div>'
        });
      });

      it('should handle nested backticks in content', () => {
        const content = '```json\n{\n  "html": "<div>Code: `console.log()`</div>"\n}\n```';
        
        const result = callExtractJSON(content, 'test-request-9');
        
        expect(result).toEqual({
          html: '<div>Code: `console.log()`</div>'
        });
      });
    });

    describe('Complex JSON structures', () => {
      it('should handle nested objects and arrays', () => {
        const content = '```json\n{\n  "html": "<div>Complex</div>",\n  "sections": [\n    {\n      "id": "header",\n      "type": "header",\n      "editableFields": [\n        {\n          "id": "title",\n          "type": "text"\n        }\n      ]\n    }\n  ]\n}\n```';
        
        const result = callExtractJSON(content, 'test-request-10');
        
        expect(result).toEqual({
          html: '<div>Complex</div>',
          sections: [{
            id: 'header',
            type: 'header',
            editableFields: [{
              id: 'title',
              type: 'text'
            }]
          }]
        });
      });

      it('should handle JSON with special characters', () => {
        const content = '```json\n{\n  "html": "<div class=\\"test\\">Special \\n\\t chars</div>",\n  "description": "Contains \\"quotes\\" and \\\\backslashes\\\\"\n}\n```';
        
        const result = callExtractJSON(content, 'test-request-11');
        
        expect(result.html).toContain('Special');
        expect(result.html).toContain('chars');
        expect(result.description).toContain('"quotes"');
      });
    });

    describe('Error handling', () => {
      it('should throw error for empty content', () => {
        expect(() => callExtractJSON('')).toThrow('Empty response content');
        expect(() => callExtractJSON(null as any)).toThrow('Empty response content');
        expect(() => callExtractJSON(undefined as any)).toThrow('Empty response content');
      });

      it('should throw error for invalid JSON', () => {
        const content = '```json\n{\n  "html": "<div>Invalid</div>",\n  "missing": "closing brace"\n```';
        
        expect(() => callExtractJSON(content, 'test-request-error-1'))
          .toThrow('Failed to parse AI response');
      });

      it('should throw error for non-JSON content', () => {
        const content = 'This is just plain text without any JSON structure.';
        
        expect(() => callExtractJSON(content, 'test-request-error-2'))
          .toThrow('Invalid response format from AI');
      });

      it('should provide detailed error information', () => {
        const content = '```json\n{\n  "html": "<div>Syntax Error</div>"\n  "missing": "comma"\n}\n```';
        
        try {
          callExtractJSON(content, 'test-request-error-3');
          fail('Should have thrown an error');
        } catch (error: any) {
          expect(error.message).toContain('Failed to parse AI response');
        }
      });
    });

    describe('Edge cases', () => {
      it('should handle very large JSON responses', () => {
        const largeArray = Array(1000).fill({ id: 'test', content: 'Large response test' });
        const content = `\`\`\`json\n${JSON.stringify({ html: '<div>Large</div>', data: largeArray })}\n\`\`\``;
        
        const result = callExtractJSON(content, 'test-request-large');
        
        expect(result.html).toBe('<div>Large</div>');
        expect(result.data).toHaveLength(1000);
      });

      it('should handle JSON with unicode characters', () => {
        const content = '```json\n{\n  "html": "<div>Unicode: 🎉 ñáéíóú</div>",\n  "emoji": "✅"\n}\n```';
        
        const result = callExtractJSON(content, 'test-request-unicode');
        
        expect(result.html).toContain('🎉 ñáéíóú');
        expect(result.emoji).toBe('✅');
      });

      it('should handle JSON with null and boolean values', () => {
        const content = '```json\n{\n  "html": null,\n  "isValid": true,\n  "isEmpty": false\n}\n```';
        
        const result = callExtractJSON(content, 'test-request-types');
        
        expect(result.html).toBeNull();
        expect(result.isValid).toBe(true);
        expect(result.isEmpty).toBe(false);
      });
    });
  });

  describe('Integration with convertDesignToHTML', () => {
    it('should handle markdown-wrapped OpenAI response in convertDesignToHTML', async () => {
      // Mock the callOpenAI method to return a markdown-wrapped response
      const mockResponse = {
        choices: [{
          message: {
            content: '```json\n{\n  "html": "<!DOCTYPE html><html><body><h1>Markdown Test</h1></body></html>",\n  "sections": [],\n  "components": [],\n  "description": "Test with markdown wrapping"\n}\n```',
            role: 'assistant'
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'gpt-4o'
      };
      
      jest.spyOn(openaiService as any, 'callOpenAI').mockResolvedValue(mockResponse);

      const result = await openaiService.convertDesignToHTML('data:image/jpeg;base64,test', 'test.jpg');

      expect(result).toBeDefined();
      expect(result.html).toContain('<h1>Markdown Test</h1>');
      expect(result.description).toBe('Test with markdown wrapping');
    });

    it('should handle malformed markdown in OpenAI response', async () => {
      // Mock response with malformed markdown
      const mockResponse = {
        choices: [{
          message: {
            content: '```json\n{\n  "html": "<div>Malformed Markdown</div>",\n  "sections": []\n}\n``', // Missing closing backtick
            role: 'assistant'
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'gpt-4o'
      };
      
      jest.spyOn(openaiService as any, 'callOpenAI').mockResolvedValue(mockResponse);

      const result = await openaiService.convertDesignToHTML('data:image/jpeg;base64,test', 'test.jpg');

      expect(result).toBeDefined();
      expect(result.html).toContain('<div>Malformed Markdown</div>');
    });
  });
});
