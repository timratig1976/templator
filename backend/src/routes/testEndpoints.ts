/**
 * Test Endpoints for System Stability Testing
 * 
 * Provides API endpoints specifically for testing:
 * - Image placeholder generation
 * - System health verification
 * - Component functionality validation
 */

import { Router } from 'express';
import ImageHandlingService from '../services/input/ImageHandlingService';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger();
const imageService = new ImageHandlingService();

/**
 * GET /api/test/image-placeholder
 * Test image placeholder generation with various types
 */
router.get('/image-placeholder', async (req, res) => {
  try {
    const width = parseInt(req.query.width as string) || 300;
    const height = parseInt(req.query.height as string) || 200;
    
    if (req.query.width && req.query.height) {
      // Single placeholder with specific dimensions
      const placeholder = generateDataURI(width, height, '#e5e7eb', '#6b7280', 'TEST');
      
      res.json({
        success: true,
        placeholder,
        dimensions: { width, height }
      });
    } else {
      // Multiple placeholder types for comprehensive testing
      const placeholders = {
        logo: generateDataURI(150, 50, '#3b82f6', '#ffffff', 'LOGO'),
        hero: generateDataURI(800, 400, '#8b5cf6', '#ffffff', 'HERO'),
        product: generateDataURI(300, 300, '#10b981', '#ffffff', 'PRODUCT'),
        avatar: generateDataURI(100, 100, '#f59e0b', '#ffffff', '👤'),
        icon: generateDataURI(50, 50, '#8b5cf6', '#ffffff', '⭐'),
        background: generateDataURI(1200, 600, '#e5e7eb', '#6b7280', 'BG'),
        default: generateDataURI(300, 200, '#9ca3af', '#ffffff', 'IMAGE')
      };
      
      res.json({
        success: true,
        placeholders,
        count: Object.keys(placeholders).length
      });
    }
  } catch (error: any) {
    logger.error('Image placeholder test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/test/system-status
 * Comprehensive system status for testing
 */
router.get('/system-status', async (req, res) => {
  try {
    const status = {
      server: {
        healthy: true,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      },
      services: {
        imageHandling: true,
        layoutSplitting: true,
        socketIO: true
      },
      endpoints: {
        health: '/health',
        layoutAnalysis: '/api/layout/analyze/:size',
        socketIO: '/socket.io/',
        buildTest: '/api/build-test/status'
      }
    };
    
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('System status test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/test/socket-emit
 * Test Socket.IO emission for real-time logging tests
 */
router.post('/socket-emit', async (req, res) => {
  try {
    const { message, level = 'info' } = req.body;
    
    // Emit test log message via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('log', {
        level,
        message: message || 'Test log message',
        timestamp: new Date().toISOString(),
        service: 'test-endpoint'
      });
      
      res.json({
        success: true,
        emitted: true,
        message: 'Test log message emitted'
      });
    } else {
      res.json({
        success: false,
        emitted: false,
        message: 'Socket.IO not available'
      });
    }
  } catch (error: any) {
    logger.error('Socket emit test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to generate SVG data URI
 */
function generateDataURI(width: number, height: number, bgColor: string, textColor: string, text: string): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bgColor}"/>
      <text x="50%" y="50%" text-anchor="middle" dy="0.35em" 
            font-family="system-ui, -apple-system, sans-serif" 
            font-size="${Math.min(width, height) / 8}" 
            fill="${textColor}">${text}</text>
    </svg>
  `;
  
  const base64 = Buffer.from(svg.trim()).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export default router;
