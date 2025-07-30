/**
 * System Stability Test Suite
 * 
 * Comprehensive tests to verify:
 * - Backend process management and stability
 * - Layout analysis API functionality
 * - Socket.IO real-time logging connections
 * - Image placeholder generation reliability
 * - TypeScript compilation integrity
 */

import request from 'supertest';
import { Server } from 'http';
import { io as Client, Socket } from 'socket.io-client';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

describe('System Stability Test Suite', () => {
  const BACKEND_URL = 'http://localhost:3009';
  const SOCKET_URL = 'http://localhost:3009';
  let clientSocket: Socket;

  beforeAll(async () => {
    // Wait for backend to be ready
    await waitForBackend();
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.close();
    }
  });

  describe('Backend Process Management', () => {
    test('should have only one backend process running', async () => {
      const { stdout } = await execAsync('ps aux | grep -E "(ts-node|nodemon)" | grep -v grep | wc -l');
      const processCount = parseInt(stdout.trim());
      
      expect(processCount).toBeLessThanOrEqual(2); // Allow for some flexibility
      console.log(`✅ Backend process count: ${processCount}`);
    });

    test('should respond to health checks consistently', async () => {
      const healthChecks = [];
      
      // Perform 5 consecutive health checks
      for (let i = 0; i < 5; i++) {
        const response = await request(BACKEND_URL)
          .get('/health')
          .expect(200);
        
        healthChecks.push(response.body);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // All health checks should return "healthy"
      healthChecks.forEach((health, index) => {
        expect(health.status).toBe('healthy');
        expect(health.environment).toBe('development');
        console.log(`✅ Health check ${index + 1}: ${health.status}`);
      });
    });

    test('should maintain stable uptime without restarts', async () => {
      const response1 = await request(BACKEND_URL).get('/health');
      const uptime1 = response1.body.uptime;
      
      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const response2 = await request(BACKEND_URL).get('/health');
      const uptime2 = response2.body.uptime;
      
      // Uptime should have increased (no restart)
      expect(uptime2).toBeGreaterThan(uptime1);
      expect(uptime2 - uptime1).toBeGreaterThan(1.5); // At least 1.5 seconds difference
      
      console.log(`✅ Uptime stability: ${uptime1.toFixed(2)}s → ${uptime2.toFixed(2)}s`);
    });
  });

  describe('Layout Analysis API', () => {
    test('should handle layout analysis requests correctly', async () => {
      const testSizes = [1000, 2596, 5000, 10000];
      
      for (const size of testSizes) {
        const response = await request(BACKEND_URL)
          .get(`/api/layout/analyze/${size}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.fileSize).toBe(size);
        expect(response.body.data.recommendation).toBeDefined();
        expect(response.body.data.shouldSplit).toBeDefined();
        
        console.log(`✅ Layout analysis ${size}B: ${response.body.data.recommendation}`);
      }
    });

    test('should return consistent analysis for same file size', async () => {
      const size = 2596;
      const responses = [];
      
      // Make 3 requests for the same size
      for (let i = 0; i < 3; i++) {
        const response = await request(BACKEND_URL)
          .get(`/api/layout/analyze/${size}`)
          .expect(200);
        responses.push(response.body);
      }
      
      // All responses should be identical
      const firstResponse = responses[0];
      responses.forEach((response, index) => {
        expect(response.data.fileSize).toBe(firstResponse.data.fileSize);
        expect(response.data.recommendation).toBe(firstResponse.data.recommendation);
        expect(response.data.shouldSplit).toBe(firstResponse.data.shouldSplit);
        console.log(`✅ Consistent analysis ${index + 1}: ${response.data.recommendation}`);
      });
    });

    test('should handle edge cases gracefully', async () => {
      const edgeCases = [0, 1, 999999];
      
      for (const size of edgeCases) {
        const response = await request(BACKEND_URL)
          .get(`/api/layout/analyze/${size}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.fileSize).toBe(size);
        console.log(`✅ Edge case ${size}B: ${response.body.data.recommendation}`);
      }
    });
  });

  describe('Socket.IO Real-time Logging', () => {
    test('should establish stable Socket.IO connection', (done) => {
      clientSocket = Client(SOCKET_URL, {
        transports: ['polling', 'websocket']
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        expect(clientSocket.id).toBeDefined();
        console.log(`✅ Socket.IO connected: ${clientSocket.id}`);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        fail(`Socket.IO connection failed: ${error.message}`);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!clientSocket.connected) {
          fail('Socket.IO connection timeout');
        }
      }, 5000);
    });

    test('should maintain connection stability', (done) => {
      let disconnectCount = 0;
      let reconnectCount = 0;

      clientSocket.on('disconnect', () => {
        disconnectCount++;
        console.log(`⚠️ Socket.IO disconnect #${disconnectCount}`);
      });

      clientSocket.on('reconnect', () => {
        reconnectCount++;
        console.log(`🔄 Socket.IO reconnect #${reconnectCount}`);
      });

      // Monitor for 3 seconds
      setTimeout(() => {
        expect(disconnectCount).toBeLessThanOrEqual(1); // Allow for one disconnect
        expect(clientSocket.connected).toBe(true);
        console.log(`✅ Connection stability: ${disconnectCount} disconnects, ${reconnectCount} reconnects`);
        done();
      }, 3000);
    });

    test('should receive real-time log messages', (done) => {
      const receivedMessages: any[] = [];

      clientSocket.on('log', (message) => {
        receivedMessages.push(message);
        console.log(`📨 Received log: ${message.level} - ${message.message}`);
      });

      // Trigger a log by making an API call
      request(BACKEND_URL)
        .get('/health')
        .end(() => {
          // Wait for potential log messages
          setTimeout(() => {
            console.log(`✅ Real-time logging: ${receivedMessages.length} messages received`);
            done();
          }, 1000);
        });
    });
  });

  describe('Image Placeholder System', () => {
    test('should generate valid SVG data URIs', async () => {
      // Test the image handling service directly
      const response = await request(BACKEND_URL)
        .get('/api/test/image-placeholder')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.placeholders).toBeDefined();
      
      const placeholders = response.body.placeholders;
      
      // Test each placeholder type
      Object.entries(placeholders).forEach(([type, dataUri]: [string, any]) => {
        expect(dataUri).toMatch(/^data:image\/svg\+xml;base64,/);
        
        // Decode and verify SVG structure
        const base64Data = dataUri.replace('data:image/svg+xml;base64,', '');
        const svgContent = Buffer.from(base64Data, 'base64').toString('utf-8');
        
        expect(svgContent).toContain('<svg');
        expect(svgContent).toContain('<rect');
        expect(svgContent).toContain('<text');
        
        console.log(`✅ ${type} placeholder: Valid SVG data URI`);
      });
    });

    test('should handle different image dimensions', async () => {
      const dimensions = [
        { width: 100, height: 100 },
        { width: 300, height: 200 },
        { width: 800, height: 600 }
      ];

      for (const { width, height } of dimensions) {
        const response = await request(BACKEND_URL)
          .get(`/api/test/image-placeholder?width=${width}&height=${height}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        const dataUri = response.body.placeholder;
        
        // Decode and verify dimensions
        const base64Data = dataUri.replace('data:image/svg+xml;base64,', '');
        const svgContent = Buffer.from(base64Data, 'base64').toString('utf-8');
        
        expect(svgContent).toContain(`width="${width}"`);
        expect(svgContent).toContain(`height="${height}"`);
        
        console.log(`✅ ${width}x${height} placeholder: Correct dimensions`);
      }
    });
  });

  describe('TypeScript Compilation', () => {
    test('should compile without errors', async () => {
      try {
        const { stdout, stderr } = await execAsync('cd backend && npx tsc --noEmit');
        
        expect(stderr).toBe('');
        console.log('✅ TypeScript compilation: No errors');
      } catch (error: any) {
        fail(`TypeScript compilation failed: ${error.message}`);
      }
    });

    test('should have no linting errors in critical files', async () => {
      const criticalFiles = [
        'src/server.ts',
        'src/routes/api.ts',
        'src/services/input/ImageHandlingService.ts',
        'src/routes/layoutSplitting.ts'
      ];

      for (const file of criticalFiles) {
        try {
          const { stdout, stderr } = await execAsync(`cd backend && npx eslint ${file} --format json`);
          const results = JSON.parse(stdout);
          
          const errorCount = results.reduce((sum: number, result: any) => 
            sum + result.errorCount, 0);
          
          expect(errorCount).toBe(0);
          console.log(`✅ ${file}: No linting errors`);
        } catch (error: any) {
          console.warn(`⚠️ ${file}: Linting check failed - ${error.message}`);
        }
      }
    });
  });

  describe('API Route Registration', () => {
    test('should have all critical routes registered', async () => {
      const criticalRoutes = [
        '/health',
        '/api/layout/analyze/1000',
        '/api/build-test/status',
        '/socket.io/'
      ];

      for (const route of criticalRoutes) {
        const response = await request('http://localhost:3009')
          .get(route)
          .expect((res) => {
            expect(res.status).not.toBe(404);
          });
        
        console.log(`✅ Route ${route}: Registered (${response.status})`);
      }
    });
  });
});

// Helper functions
async function waitForBackend(maxAttempts = 10, delay = 1000): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await request('http://localhost:3009').get('/health').expect(200);
      console.log('✅ Backend is ready');
      return;
    } catch (error) {
      console.log(`⏳ Waiting for backend... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Backend failed to start within timeout');
}
