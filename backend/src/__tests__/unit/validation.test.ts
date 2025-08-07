import request from 'supertest';
import { createApp } from '../../app';
import express from 'express';

describe('Validation API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createApp();
  });

  test('should validate a module', async () => {
    const response = await request(app)
      .post('/api/validation/validate')
      .send({
        module: {
          name: 'Test Module',
          template: '<div>Valid HTML</div>',
          fields: []
        }
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('errors');
    expect(response.body).toHaveProperty('recommendations');
  });

  test('should handle invalid module data', async () => {
    const response = await request(app)
      .post('/api/validation/validate')
      .send({
        module: {
          name: 'Invalid Module'
        }
      });

    expect(response.status).toBe(400);
  });

  test('should sanitize input to prevent XSS', async () => {
    const maliciousTemplate = '<div>Normal content<script>alert("XSS")</script></div>';
    
    const response = await request(app)
      .post('/api/validation/validate')
      .send({
        module: {
          name: 'XSS Test Module',
          template: maliciousTemplate,
          fields: []
        }
      });

    expect(response.status).toBe(200);
    
    expect(response.body.module.template).not.toContain('<script>');
    expect(response.body.module.template).not.toContain('alert("XSS")');
  });
});
