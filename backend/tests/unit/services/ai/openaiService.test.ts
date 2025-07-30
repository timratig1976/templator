/**
 * Unit Tests for OpenAI Service
 * Tests the core AI functionality in isolation
 */

import { OpenAIService, DesignAnalysis } from '../../../../src/services/ai/openaiService';
import '../../../setup/unit.setup';

// Import UnitTestHelpers from global
declare const UnitTestHelpers: any;

describe('OpenAIService', () => {
  let openaiService: OpenAIService;

  beforeEach(() => {
    // Get singleton instance
    openaiService = OpenAIService.getInstance();
  });

  describe('convertDesignToHTML', () => {
    it('should convert design to HTML successfully', async () => {
      // Arrange
      const imageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
      const fileName = 'test-design.jpg';

      // Mock the private callOpenAI method
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              html: '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Test Design</h1></body></html>',
              sections: [],
              components: [],
              description: 'A test design'
            }),
            role: 'assistant'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        },
        model: 'gpt-4o'
      };
      
      // Mock the private method
      jest.spyOn(openaiService as any, 'callOpenAI').mockResolvedValue(mockResponse);

      // Act
      const result = await openaiService.convertDesignToHTML(imageBase64, fileName);

      // Assert
      expect(result).toBeDefined();
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<h1>Test Design</h1>');
      expect((openaiService as any).callOpenAI).toHaveBeenCalledTimes(1);
    });

    it('should handle OpenAI API errors gracefully', async () => {
      // Arrange
      const imageBase64 = 'data:image/jpeg;base64,test';
      const fileName = 'test-design.jpg';
      const error = new Error('Rate limit exceeded');
      
      jest.spyOn(openaiService as any, 'callOpenAI').mockRejectedValue(error);

      // Act & Assert
      await expect(openaiService.convertDesignToHTML(imageBase64, fileName))
        .rejects.toThrow('Rate limit exceeded');
    });

    it('should validate input parameters', async () => {
      // Act & Assert
      await expect(openaiService.convertDesignToHTML('', 'test.jpg'))
        .rejects.toThrow();

      await expect(openaiService.convertDesignToHTML('valid-base64', ''))
        .rejects.toThrow();
    });
  });

  describe('refineHTML', () => {
    it('should refine HTML content successfully', async () => {
      // Arrange
      const originalHTML = '<html><body><h1>Basic Design</h1></body></html>';
      const requirements = 'Add meta viewport tag';
      
      const mockResponse = {
        choices: [{
          message: {
            content: '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Refined Design</title></head><body><h1>Improved Design</h1></body></html>',
            role: 'assistant'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      };
      
      jest.spyOn(openaiService as any, 'callOpenAI').mockResolvedValue(mockResponse);

      // Act
      const result = await openaiService.refineHTML(originalHTML, requirements);

      // Assert
      expect(result).toBeDefined();
      expect(result).toContain('meta name="viewport"');
      expect(result).toContain('Improved Design');
    });

    it('should handle empty HTML input', async () => {
      // Act & Assert
      const result = await openaiService.refineHTML('', 'improve design');
      
      // Should return original HTML on error
      expect(result).toBe('');
    });
  });
});
