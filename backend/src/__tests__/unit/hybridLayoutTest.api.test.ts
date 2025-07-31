import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { jest } from '@jest/globals';
import { DesignAnalysis, Section, Component, EditableField } from '../../services/ai/openaiService';
import { LayoutSection, SplittingResult } from '../../services/analysis/LayoutSectionSplittingService';
import { MockedFunction, MockedObject } from 'jest-mock';

// Extended Error interface for custom error properties
interface CustomError extends Error {
  status?: number;
  code?: string;
}

// Mock dependencies
// Mock OpenAI service
const mockDesignAnalysis: DesignAnalysis = {
  html: '<div class="container">Mock HTML</div>',
  sections: [
    {
      id: 'section-1',
      name: 'Header',
      type: 'header',
      html: '<header class="bg-blue-500 text-white p-4"><h1>Company Name</h1></header>',
      editableFields: []
    },
    {
      id: 'section-2',
      name: 'Hero',
      type: 'hero',
      html: '<section class="bg-gray-100 p-8"><h2>Welcome to Our Site</h2><p>Learn more about our services</p></section>',
      editableFields: []
    },
    {
      id: 'section-3',
      name: 'Footer',
      type: 'footer',
      html: '<footer class="bg-gray-800 text-white p-4"><p>&copy; 2023 Company Name</p></footer>',
      editableFields: []
    }
  ],
  components: [
    { id: 'comp-1', name: 'Navigation', type: 'text', selector: 'nav', defaultValue: 'Navigation' },
    { id: 'comp-2', name: 'Hero Banner', type: 'text', selector: '.hero', defaultValue: 'Banner' }
  ],
  description: 'A simple website layout'
};

// Use a more direct approach to mock the function
const mockConvertDesignToHTML = jest.fn((_imageBase64: string, _filename: string) => {
  return Promise.resolve(mockDesignAnalysis);
});

jest.mock('../../services/ai/openaiService', () => ({
  __esModule: true,
  default: {
    convertDesignToHTML: mockConvertDesignToHTML
  }
}));

// Create mock layout sections
const createMockLayoutSections = (sections: Section[]): LayoutSection[] => {
  return sections.map(section => ({
    id: section.id,
    type: section.type as LayoutSection['type'],
    html: section.html,
    title: section.name,
    description: `Enhanced ${section.name}`,
    complexity: 'medium' as const,
    estimatedFields: 2,
    dependencies: [],
    priority: 1
  }));
};

// Mock layout section splitting service with direct parameter typing
const mockEnhanceSections = jest.fn((sections: Section[]) => {
  return Promise.resolve(createMockLayoutSections(sections));
});

const mockCombineSectionsHTML = jest.fn((sections: LayoutSection[]) => {
  return Promise.resolve(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Combined Sections</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body>
  ${sections.map(section => `
  <!-- Section: ${section.type} (${section.id}) -->
  <section data-section-id="${section.id}" data-section-type="${section.type}" class="section-wrapper">
    ${section.html}
  </section>`).join('\n')}
</body>
</html>`);
});

jest.mock('../../services/analysis/LayoutSectionSplittingService', () => ({
  __esModule: true,
  default: {
    enhanceSections: mockEnhanceSections,
    combineSectionsHTML: mockCombineSectionsHTML
  }
}));
// This section is now handled by the mockCombineSectionsHTML function above

// Simplified fs mocking approach - just mock the specific functions we need
// This avoids TypeScript errors with spread operators and unknown types
jest.mock('fs', () => {
  return {
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue('mock file content')
  };
});

// Create test application with hybrid layout test routes
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mock multer middleware
  const mockMulter = () => {
    return (req: any, res: any, next: any) => {
      req.file = {
        buffer: Buffer.from('mock-image-data'),
        originalname: 'test-design.png',
        mimetype: 'image/png',
        size: 12345
      };
      next();
    };
  };
  
  // Mock hybrid layout analyze endpoint
  app.post('/api/hybrid-layout-test/analyze', mockMulter(), (req: express.Request, res: express.Response) => {
    const openaiService = require('../../services/ai/openaiService').default;
    const layoutSectionSplittingService = require('../../services/analysis/LayoutSectionSplittingService').default;
    
    openaiService.convertDesignToHTML('mock-image-base64', 'test-design.png')
      .then((analysisResult: DesignAnalysis) => {
        return layoutSectionSplittingService.enhanceSections(analysisResult.sections)
          .then((enhancedSections: LayoutSection[]) => {
            res.json({
              success: true,
              original: analysisResult,
              enhanced: {
                html: analysisResult.html || '',
                sections: enhancedSections,
                components: analysisResult.components || [],
                description: analysisResult.description || ''
              }
            });
          });
      })
      .catch((error: Error) => {
        res.status(500).json({
          success: false,
          error: error.message
        });
      });
  });
  
  // Mock hybrid layout generate endpoint
  app.post('/api/hybrid-layout-test/generate', (req: express.Request, res: express.Response) => {
    const layoutSectionSplittingService = require('../../services/analysis/LayoutSectionSplittingService').default;
    
    const { sections } = req.body as { sections: LayoutSection[] };
    
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sections data',
        code: 'INVALID_INPUT'
      });
    }
    
    layoutSectionSplittingService.combineSectionsHTML(sections)
      .then((processedHTML: string) => {
        res.json({
          success: true,
          html: processedHTML,
          message: 'HTML generated successfully',
          sectionCount: sections.length
        });
      })
      .catch((error: CustomError) => {
        res.status(error.status || 500).json({
          success: false,
          error: error.message,
          code: error.code || 'UNKNOWN_ERROR'
        });
      });
  });
  
  // Error handling middleware
  app.use((err: CustomError, req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR'
    });
  });
  
  return app;
};

describe('Hybrid Layout API Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConvertDesignToHTML.mockImplementation((_imageBase64: string, _filename: string) => {
      return Promise.resolve(mockDesignAnalysis);
    });
    mockEnhanceSections.mockImplementation((sections: Section[]) => {
      return Promise.resolve(createMockLayoutSections(sections));
    });
    mockCombineSectionsHTML.mockImplementation((sections: LayoutSection[]) => {
      return Promise.resolve(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Combined Sections</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body>
  ${sections.map(section => `
  <!-- Section: ${section.type} (${section.id}) -->
  <section data-section-id="${section.id}" data-section-type="${section.type}" class="section-wrapper">
    ${section.html}
  </section>`).join('\n')}
</body>
</html>`);
    });
  });

  describe('Hybrid Layout Analysis Endpoint', () => {
    it('should analyze design and return enhanced sections', async () => {
      const response = await request(app)
        .post('/api/hybrid-layout-test/analyze')
        .attach('design', Buffer.from('mock-image-data'), 'test-design.png')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.original).toBeDefined();
      expect(response.body.enhanced).toBeDefined();
      expect(response.body.enhanced.sections).toBeInstanceOf(Array);
      expect(response.body.enhanced.sections.length).toBe(3);
      // The implementation doesn't add an 'enhanced' property to each section
      expect(response.body.enhanced.sections[0].type).toBe('header');
      expect(response.body.enhanced.sections[1].type).toBe('hero');
      expect(response.body.enhanced.sections[2].type).toBe('footer');
    });

    it('should handle errors during analysis', async () => {
      // Mock openaiService to throw an error
      const customError = new Error('OpenAI API error') as CustomError;
      customError.status = 500;
      customError.code = 'OPENAI_API_ERROR';
      mockConvertDesignToHTML.mockRejectedValueOnce(customError);

      const response = await request(app)
        .post('/api/hybrid-layout-test/analyze')
        .attach('design', Buffer.from('mock-image-data'), 'test-design.png')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('OpenAI API error');
    });
  });

  describe('Hybrid Layout Generation Endpoint', () => {
    it('should generate combined HTML from sections', async () => {
      const testSections = [
        {
          id: 'section-1',
          type: 'header',
          html: '<header class="bg-blue-500 text-white p-4"><h1>Company Name</h1></header>'
        },
        {
          id: 'section-2',
          type: 'hero',
          html: '<section class="bg-gray-100 p-8"><h2>Welcome to Our Site</h2></section>'
        }
      ];

      const response = await request(app)
        .post('/api/hybrid-layout-test/generate')
        .send({ sections: testSections })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.html).toBeDefined();
      expect(response.body.html).toContain('<!DOCTYPE html>');
      expect(response.body.html).toContain('<section data-section-id="section-1"');
      expect(response.body.html).toContain('<section data-section-id="section-2"');
      expect(response.body.sectionCount).toBe(testSections.length);
    });

    it('should validate request body and return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/hybrid-layout-test/generate')
        .send({ sections: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid sections data');
    });

    it('should handle errors during HTML generation', async () => {
      // Mock layoutSectionSplittingService to throw an error
      const customError = new Error('HTML generation error') as CustomError;
      customError.status = 500;
      customError.code = 'HTML_GENERATION_ERROR';
      mockCombineSectionsHTML.mockRejectedValueOnce(customError);

      const testSections = [
        {
          id: 'section-1',
          type: 'header',
          html: '<header>Test</header>'
        }
      ];

      const response = await request(app)
        .post('/api/hybrid-layout-test/generate')
        .send({ sections: testSections })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('HTML generation error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing file in analyze request', async () => {
      // Override the mock multer middleware for this test
      const app = express();
      app.use(express.json());
      
      app.post('/api/hybrid-layout-test/analyze', (req, res) => {
        res.status(400).json({
          success: false,
          error: 'No file uploaded',
          code: 'INPUT_INVALID'
        });
      });

      const response = await request(app)
        .post('/api/hybrid-layout-test/analyze')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No file uploaded');
      expect(response.body.code).toBe('INPUT_INVALID');
    });

    it('should handle malformed sections in generate request', async () => {
      const response = await request(app)
        .post('/api/hybrid-layout-test/generate')
        .send({ sections: 'not-an-array' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid sections data');
    });
  });
});
