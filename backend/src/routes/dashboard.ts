import express from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();

/**
 * Test Suite Dashboard Routes
 * Serves the visual test suite dashboard for monitoring and maintenance
 */

// Serve the main dashboard HTML
router.get('/', (req, res) => {
  try {
    const dashboardPath = path.join(__dirname, '../dashboard/BackendDashboard.html');
    
    if (fs.existsSync(dashboardPath)) {
      res.sendFile(dashboardPath);
    } else {
      res.status(404).json({
        success: false,
        error: 'Dashboard file not found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to serve dashboard'
    });
  }
});

// Serve dashboard JavaScript
router.get('/js', (req, res) => {
  try {
    const jsPath = path.join(__dirname, '../dashboard/BackendDashboard.js');
    
    if (fs.existsSync(jsPath)) {
      res.setHeader('Content-Type', 'application/javascript');
      res.sendFile(jsPath);
    } else {
      res.status(404).json({
        success: false,
        error: 'Dashboard JavaScript not found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to serve dashboard JavaScript'
    });
  }
});

// Dashboard status endpoint
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      dashboardVersion: '1.0.0',
      features: [
        'Interactive Test Suite Execution',
        'Real-time Test Progress Monitoring',
        'Build & Compilation Validation', 
        'Quality Metrics Dashboard',
        'Error Recovery System',
        'WebSocket Test Updates',
        'System Health Monitor'
      ],
      endpoints: {
        dashboard: '/api/dashboard',
        monitoring: '/api/monitoring/*',
        buildTest: '/api/build-test/*'
      },
      lastUpdated: new Date().toISOString()
    }
  });
});

export default router;
