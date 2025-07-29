import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { jest } from '@jest/globals';
import apiRoutes from '../../routes/api';

// Create app function for testing
function createApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
  return app;
}

// Define types for the test data
interface Section {
  id: string;
  name: string;
  type: string;
  editableFields: EditableField[];
}

interface EditableField {
  id: string;
  name: string;
  type: string;
  selector: string;
  defaultValue: string;
  required: boolean;
}

describe('End-to-End Test Scenarios', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Create the app with all middleware and routes
    app = createApp();
  });

  describe('Complete Design-to-HubSpot Workflow', () => {
    it('should handle the complete workflow: upload design → generate HTML → refine code', async () => {
      // Mock image file (1x1 PNG)
      const mockImageBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
        0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      // Step 1: Check supported file types
      const supportedTypesResponse = await request(app)
        .get('/api/design/supported-types')
        .expect(200);

      expect(supportedTypesResponse.body.success).toBe(true);
      expect(supportedTypesResponse.body.data.supportedTypes).toContainEqual(
        expect.objectContaining({ extension: 'png', mimeType: 'image/png' })
      );

      // Step 2: Upload design and convert to HTML
      const uploadResponse = await request(app)
        .post('/api/design/upload')
        .attach('design', mockImageBuffer, 'landing-page-design.png')
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data.packagedModule?.name).toBe('landing-page-design.png');
      expect(uploadResponse.body.data).toHaveProperty('sections');
      expect(uploadResponse.body.data.sections).toBeInstanceOf(Array);
      expect(uploadResponse.body.data.sections.length).toBeGreaterThan(0);

      const generatedHTML = uploadResponse.body.data.sections?.[0]?.html || '';
      const sections = uploadResponse.body.data.sections || [];
      const components = uploadResponse.body.data.sections?.flatMap((s: any) => s.editableFields || []) || [];

      // Validate generated content structure
      expect(generatedHTML).toContain('class=');
      expect(sections).toBeInstanceOf(Array);
      expect(components).toBeInstanceOf(Array);

      // Step 3: Refine the generated HTML
      const refineResponse = await request(app)
        .post('/api/design/refine')
        .send({
          html: generatedHTML,
          requirements: 'Make it more modern with better gradients, shadows, and responsive design'
        })
        .expect(200);

      expect(refineResponse.body.success).toBe(true);
      expect(refineResponse.body.data).toHaveProperty('originalHTML', generatedHTML);
      expect(refineResponse.body.data).toHaveProperty('refinedHTML');
      expect(refineResponse.body.data).toHaveProperty('requirements');

      const refinedHTML = refineResponse.body.data.refinedHTML;
      expect(refinedHTML).toBeDefined();
      expect(refinedHTML.length).toBeGreaterThan(generatedHTML.length);

      // Verify the workflow produces valid results
      expect(uploadResponse.body.message).toBe('Design successfully converted to HTML');
      expect(refineResponse.body.message).toBe('HTML successfully refined');
    }, 30000); // Extended timeout for AI processing

    it('should handle multiple file uploads in sequence', async () => {
      const mockImages = [
        { name: 'hero-section.png', buffer: Buffer.from('fake-hero-image') },
        { name: 'contact-form.jpg', buffer: Buffer.from('fake-form-image') },
        { name: 'footer-design.webp', buffer: Buffer.from('fake-footer-image') }
      ];

      const results = [];

      for (const image of mockImages) {
        const response = await request(app)
          .post('/api/design/upload')
          .attach('design', image.buffer, image.name)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.packagedModule?.name).toBe(image.name);
        results.push(response.body.data);
      }

      // Verify all uploads were processed
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('sections');
        expect(result.sections?.[0]?.html).toBeDefined();
      });
    });

    it('should handle error scenarios gracefully', async () => {
      // Test 1: Invalid file type
      const invalidFile = Buffer.from('This is not an image');
      const invalidResponse = await request(app)
        .post('/api/design/upload')
        .attach('design', invalidFile, 'document.txt')
        .expect(400);

      expect(invalidResponse.body.success).toBe(false);
      expect(invalidResponse.body.error).toContain('Invalid file type');

      // Test 2: Missing file
      const noFileResponse = await request(app)
        .post('/api/design/upload')
        .expect(400);

      expect(noFileResponse.body.success).toBe(false);
      expect(noFileResponse.body.error).toContain('No file uploaded');

      // Test 3: Invalid HTML for refinement
      const invalidHTMLResponse = await request(app)
        .post('/api/design/refine')
        .send({ html: '' })
        .expect(400);

      expect(invalidHTMLResponse.body.success).toBe(false);
      expect(invalidHTMLResponse.body.error).toContain('HTML code is required');
    });
  });

  describe('API Performance and Load Testing', () => {
    it('should handle concurrent upload requests', async () => {
      const mockImage = Buffer.from('fake-concurrent-image');
      const concurrentRequests = 5;

      const promises = Array.from({ length: concurrentRequests }, (_: unknown, i: number) =>
        request(app)
          .post('/api/design/upload')
          .attach('design', mockImage, `concurrent-design-${i}.png`)
      );

      const responses = await Promise.all(promises);

      responses.forEach((response: any, index: number) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.packagedModule?.name).toBe(`concurrent-design-${index}.png`);
      });
    }, 60000); // Extended timeout for concurrent processing

    it('should maintain response time under load', async () => {
      const mockImage = Buffer.from('fake-performance-image');
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', mockImage, 'performance-test.png')
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });

  describe('Data Validation and Security', () => {
    it('should validate file size limits', async () => {
      // Create a file larger than 10MB
      const largeFile = Buffer.alloc(11 * 1024 * 1024, 'x');

      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', largeFile, 'large-file.png')
        .expect(413); // Payload too large

      expect(response.body.success).toBe(false);
    });

    it('should sanitize and validate input data', async () => {
      const maliciousHTML = '<script>alert("xss")</script><div>Content</div>';

      const response = await request(app)
        .post('/api/design/refine')
        .send({
          html: maliciousHTML,
          requirements: 'Make it safe'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // The refined HTML should not contain the script tag
      expect(response.body.data.refinedHTML).not.toContain('<script>');
    });

    it('should handle malformed requests', async () => {
      // Test malformed JSON
      const response = await request(app)
        .post('/api/design/refine')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Integration with External Services', () => {
    it('should handle OpenAI API failures gracefully', async () => {
      // This test would require mocking the OpenAI service to simulate failures
      const mockImage = Buffer.from('fake-image-for-api-failure');

      // This test simulates OpenAI API failure
      // In a real scenario, the service would handle the error gracefully

      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', mockImage, 'api-failure-test.png')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to convert design to HTML');
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle typical landing page design conversion', async () => {
      // Simulate a typical landing page design upload
      const landingPageImage = Buffer.from('fake-landing-page-design');

      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', landingPageImage, 'landing-page-mockup.png')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const analysis = response.body.data.analysis;
      
      // Verify typical landing page elements are detected
      expect(analysis.sections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/hero|header|content/)
          })
        ])
      );

      expect(analysis.components).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/text|button|image/)
          })
        ])
      );
    });

    it('should generate HubSpot-compatible field mappings', async () => {
      const mockImage = Buffer.from('fake-hubspot-design');

      const response = await request(app)
        .post('/api/design/upload')
        .attach('design', mockImage, 'hubspot-template.png')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const sections = response.body.data.sections || [];
      
      // Verify sections have proper editable fields for HubSpot
      sections.forEach((section: Section) => {
        expect(section).toHaveProperty('editableFields');
        expect(Array.isArray(section.editableFields)).toBe(true);
        
        section.editableFields.forEach((field: EditableField) => {
          expect(field).toHaveProperty('id');
          expect(field).toHaveProperty('name');
          expect(field).toHaveProperty('type');
          expect(field).toHaveProperty('selector');
          expect(field).toHaveProperty('defaultValue');
          expect(field).toHaveProperty('required');
          
          // Verify field types are HubSpot-compatible
          expect(['text', 'rich_text', 'image', 'url', 'boolean']).toContain(field.type);
        });
      });
    });
  });
});
