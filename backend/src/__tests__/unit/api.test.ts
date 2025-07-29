import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Create a simple test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
  });
  
  // Mock design upload endpoint
  app.post('/api/design/upload', (req, res) => {
    res.json({
      success: true,
      data: {
        fileName: 'test-design.png',
        fileSize: 1024,
        analysis: {
          html: '<div class="bg-white p-8"><h1 class="text-4xl font-bold">Welcome</h1></div>',
          sections: [{
            id: 'hero-1',
            name: 'Hero Section',
            type: 'hero',
            html: '<h1 class="text-4xl font-bold">Welcome</h1>',
            editableFields: [{
              id: 'title-1',
              name: 'Main Title',
              type: 'text',
              selector: 'h1',
              defaultValue: 'Welcome',
              required: true
            }]
          }],
          components: [{
            id: 'comp-1',
            name: 'Title',
            type: 'text',
            selector: 'h1',
            defaultValue: 'Welcome'
          }],
          description: 'A simple welcome page design'
        }
      },
      message: 'Design successfully converted to HTML'
    });
  });
  
  // Mock supported types endpoint
  app.get('/api/design/supported-types', (req, res) => {
    res.json({
      success: true,
      data: {
        supportedTypes: [
          { extension: 'png', mimeType: 'image/png', description: 'PNG images' },
          { extension: 'jpg', mimeType: 'image/jpeg', description: 'JPEG images' }
        ],
        maxFileSize: '10MB'
      }
    });
  });
  
  return app;
};

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Design API', () => {
    it('should return supported file types', async () => {
      const response = await request(app)
        .get('/api/design/supported-types')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.supportedTypes).toHaveLength(2);
      expect(response.body.data.maxFileSize).toBe('10MB');
    });

    it('should handle design upload (mocked)', async () => {
      const response = await request(app)
        .post('/api/design/upload')
        .send({ mockData: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.packagedModule?.name).toBe('test-design.png');
      expect(response.body.data).toHaveProperty('sections');
      expect(response.body.data.sections).toBeInstanceOf(Array);
      expect(response.body.data.sections?.[0]?.html).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/unknown-endpoint')
        .expect(404);
    });
  });
});
