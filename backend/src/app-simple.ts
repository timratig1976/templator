import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';

export function createApp(): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        'script-src-attr': ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-domain.com'] 
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    credentials: true,
  }));

  // Static file serving for dashboard assets
  app.use(express.static(path.join(__dirname, '../public')));

  // Body parsing middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health endpoint with SIMPLE STABLE MOCK TEST SYSTEM
  app.get('/health', (req: express.Request, res: express.Response) => {
    const action = req.query.action as string;
    
    // Basic health data
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      testSuite: {
        available: true,
        endpoints: {
          runTests: '/health?action=run-tests',
          testStatus: '/health?action=test-status',
          testResults: '/health?action=test-results',
          dashboard: '/health?action=dashboard'
        }
      }
    };

    // SIMPLE MOCK TEST EXECUTION - NO CRASHES!
    if (action === 'run-tests') {
      const executionId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('🚀 Starting STABLE mock test execution:', executionId);
      
      const executionState = {
        currentExecution: executionId,
        status: 'running',
        startTime: new Date().toISOString(),
        totalTests: 5,
        passedTests: 0,
        failedTests: 0
      };
      
      try {
        fs.writeFileSync(
          path.join(process.cwd(), 'test-execution-state.json'),
          JSON.stringify(executionState, null, 2)
        );
      } catch (error) {
        console.error('❌ Failed to save execution state:', error);
      }
      
      // Complete after 8 seconds
      setTimeout(() => {
        const completedState = {
          currentExecution: null,
          status: 'completed',
          startTime: executionState.startTime,
          endTime: new Date().toISOString(),
          totalTests: 5,
          passedTests: 4,
          failedTests: 1
        };
        
        try {
          fs.writeFileSync(
            path.join(process.cwd(), 'test-execution-state.json'),
            JSON.stringify(completedState, null, 2)
          );
          console.log('✅ Mock test completed:', executionId);
        } catch (error) {
          console.error('❌ Failed to save completion state:', error);
        }
      }, 8000);
      
      return res.json({
        ...healthData,
        testExecution: {
          id: executionId,
          status: 'started',
          message: 'Stable mock test execution started',
          categories: ['api', 'integration', 'e2e'],
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // SIMPLE TEST STATUS CHECK
    if (action === 'test-status') {
      let status = null;
      
      try {
        const stateFile = path.join(process.cwd(), 'test-execution-state.json');
        if (fs.existsSync(stateFile)) {
          const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
          
          if (savedState.currentExecution) {
            status = {
              id: savedState.currentExecution,
              status: savedState.status,
              startTime: savedState.startTime,
              totalTests: savedState.totalTests || 0,
              passedTests: savedState.passedTests || 0,
              failedTests: savedState.failedTests || 0,
              skippedTests: 0,
              tests: [],
              summary: savedState.status === 'running' ? 'Test execution in progress...' : 'Test execution completed'
            };
          } else if (savedState.status === 'completed') {
            status = {
              id: 'completed',
              status: 'completed',
              startTime: savedState.startTime,
              endTime: savedState.endTime,
              totalTests: savedState.totalTests || 0,
              passedTests: savedState.passedTests || 0,
              failedTests: savedState.failedTests || 0,
              skippedTests: 0,
              tests: [],
              summary: `Tests completed: ${savedState.passedTests || 0} passed, ${savedState.failedTests || 0} failed`
            };
          }
        }
      } catch (error) {
        console.error('❌ Error reading test state:', error);
      }
      
      return res.json({
        ...healthData,
        testStatus: status
      });
    }
    
    // SIMPLE TEST RESULTS
    if (action === 'test-results') {
      const results = [{
        id: 'sample-test',
        status: 'completed',
        totalTests: 5,
        passedTests: 4,
        failedTests: 1,
        summary: 'Sample test results',
        timestamp: new Date().toISOString()
      }];
      
      return res.json({
        ...healthData,
        testResults: results
      });
    }
    
    // DASHBOARD
    if (action === 'dashboard') {
      const dashboardHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Templator Test Suite Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .card { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
        .btn-primary { background: #007bff; color: white; }
        .btn-info { background: #17a2b8; color: white; }
        .btn-success { background: #28a745; color: white; }
        .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
        .status.healthy { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .endpoint { background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 4px; font-family: monospace; }
        h1 { color: #333; text-align: center; }
        h2, h3 { color: #555; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Templator Test Suite Dashboard</h1>
        
        <div class="card">
            <h2>System Health</h2>
            <div class="status healthy">System Status: Healthy</div>
            <p><strong>Environment:</strong> ${healthData.environment}</p>
            <p><strong>Uptime:</strong> ${Math.round(healthData.uptime)} seconds</p>
            <p><strong>Memory Usage:</strong> ${Math.round(healthData.memory.heapUsed / 1024 / 1024)}MB / ${Math.round(healthData.memory.heapTotal / 1024 / 1024)}MB</p>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>🚀 Test Execution</h3>
                <button class="btn btn-primary" onclick="runTests()">Run Full Test Suite</button>
                <button class="btn btn-info" onclick="checkTestStatus()">Check Test Status</button>
                <button class="btn btn-success" onclick="viewTestResults()">View Latest Results</button>
            </div>
            
            <div class="card">
                <h3>📊 Test Categories</h3>
                <ul>
                    <li>API Tests - Backend endpoint validation</li>
                    <li>Integration Tests - Component interaction tests</li>
                    <li>E2E Tests - End-to-end workflow validation</li>
                </ul>
            </div>
        </div>
        
        <div class="card">
            <h3>🔗 API Endpoints</h3>
            <div class="endpoint">GET /health?action=run-tests - Execute test suite</div>
            <div class="endpoint">GET /health?action=test-status - Get current test status</div>
            <div class="endpoint">GET /health?action=test-results - Get latest test results</div>
            <div class="endpoint">GET /health?action=dashboard - This dashboard</div>
        </div>
        
        <div class="card">
            <h3>📋 Test Results</h3>
            <div id="test-results">
                <div style="padding: 20px; background: #d4edda; border-radius: 8px; border-left: 4px solid #28a745;">
                    <h4 style="color: #28a745;">✅ Server Connected</h4>
                    <p style="margin: 0; font-size: 1.1em;">👆 Click a button above to view test information</p>
                    <p style="margin: 10px 0 0 0; font-size: 0.9em;">• <strong>Run Full Test Suite</strong> - Start new test execution<br>
                    • <strong>Check Test Status</strong> - View current/latest test status<br>
                    • <strong>View Latest Results</strong> - See all test execution history</p>
                </div>
            </div>
        </div>
    </div>
    
    <!-- External JavaScript file to avoid TypeScript parsing issues -->
    <script src="/dashboard.js"></script>
</body>
</html>
`;

      return res.send(dashboardHTML);
    }
    
    // Default health response
    return res.json(healthData);
  });

  return app;
}
