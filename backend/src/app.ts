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

  // Health endpoint with real Jest test execution
  app.get('/health', (req: express.Request, res: express.Response) => {
    const action = req.query.action as string;
    
    // Basic health data
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      endpoints: {
        runTests: '/health?action=run-tests',
        testStatus: '/health?action=test-status',
        testResults: '/health?action=test-results',
        dashboard: '/health?action=dashboard'
      }
    };

    // REAL TEST EXECUTION with Jest Integration
    if (action === 'run-tests') {
      const executionId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize execution state
      const executionState = {
        currentExecution: executionId,
        status: 'running',
        startTime: new Date().toISOString(),
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        currentTest: 0,
        currentTestName: 'Initializing test suite...',
        currentSubtest: null,
        tests: [],
        summary: 'Starting test execution...'
      };
      
      // Save initial execution state
      const stateFile = path.join(process.cwd(), 'test-execution-state.json');
      fs.writeFileSync(stateFile, JSON.stringify(executionState, null, 2));
      
      // Execute real Jest tests asynchronously
      const { spawn } = require('child_process');
      
      setTimeout(() => {
        console.log('🚀 Starting real Jest test execution...');
        
        // Run Jest with our multi-project configuration
        const jestProcess = spawn('npm', ['test', '--', '--verbose', '--json'], {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let testOutput = '';
        let errorOutput = '';
        
        jestProcess.stdout.on('data', (data: Buffer) => {
          testOutput += data.toString();
        });
        
        jestProcess.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
          console.log('Jest stderr:', data.toString());
        });
        
        jestProcess.on('close', (code: number) => {
          console.log(`Jest process exited with code ${code}`);
          
          try {
            // Update execution state with real results
            let finalState = {
              currentExecution: executionId,
              status: 'completed',
              startTime: executionState.startTime,
              endTime: new Date().toISOString(),
              totalTests: 0,
              passedTests: 0,
              failedTests: 0,
              currentTest: 0,
              tests: [],
              summary: 'Test execution completed'
            };
            
            // Try to parse Jest JSON output
            try {
              const lines = testOutput.split('\n');
              const jsonLine = lines.find(line => line.trim().startsWith('{') && line.includes('testResults'));
              
              if (jsonLine) {
                const jestResults = JSON.parse(jsonLine);
                
                finalState.totalTests = jestResults.numTotalTests || 0;
                finalState.passedTests = jestResults.numPassedTests || 0;
                finalState.failedTests = jestResults.numFailedTests || 0;
                
                // Process test results
                if (jestResults.testResults) {
                  finalState.tests = jestResults.testResults.map((testFile: any) => {
                    const category = testFile.name.includes('/__tests__/unit/') ? 'unit' :
                                   testFile.name.includes('/__tests__/e2e/') ? 'e2e' :
                                   testFile.name.includes('/tests/') ? 'integration' : 'other';
                    
                    return {
                      name: path.basename(testFile.name, '.test.ts'),
                      file: testFile.name,
                      status: testFile.status === 'passed' ? 'passed' : 'failed',
                      duration: testFile.perfStats?.end - testFile.perfStats?.start || 0,
                      error: testFile.failureMessage || null,
                      category: category,
                      subtests: testFile.assertionResults?.map((assertion: any) => ({
                        name: assertion.title,
                        status: assertion.status === 'passed' ? 'passed' : 'failed',
                        duration: assertion.duration || 0,
                        error: assertion.failureMessages?.join('\n') || null
                      })) || []
                    };
                  });
                }
                
                finalState.summary = `Tests completed: ${finalState.passedTests} passed, ${finalState.failedTests} failed`;
              }
            } catch (parseError) {
              console.error('Error parsing Jest output:', parseError);
              finalState.summary = 'Test execution completed with parsing errors';
            }
            
            // Save final state
            fs.writeFileSync(stateFile, JSON.stringify(finalState, null, 2));
            console.log('✅ Test execution completed and state saved');
            
          } catch (error) {
            console.error('Error updating final test state:', error);
          }
        });
        
        // Update state periodically during execution
        const updateInterval = setInterval(() => {
          try {
            const currentState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            if (currentState.status === 'completed') {
              clearInterval(updateInterval);
              return;
            }
            
            // Update with progress indication
            currentState.currentTestName = 'Running test suite...';
            currentState.summary = 'Test execution in progress...';
            fs.writeFileSync(stateFile, JSON.stringify(currentState, null, 2));
          } catch (error) {
            console.error('Error updating test progress:', error);
          }
        }, 2000);
        
      }, 1000); // Start after 1 second
      
      return res.json({
        ...healthData,
        message: 'Real test execution started with Jest',
        executionId,
        status: 'started'
      });
    }

    // TEST STATUS endpoint
    if (action === 'test-status') {
      const stateFile = path.join(process.cwd(), 'test-execution-state.json');
      
      try {
        if (fs.existsSync(stateFile)) {
          const testState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
          return res.json({
            ...healthData,
            testStatus: testState
          });
        } else {
          return res.json({
            ...healthData,
            testStatus: null,
            message: 'No test execution state found'
          });
        }
      } catch (error) {
        console.error('Error reading test state:', error);
        return res.json({
          ...healthData,
          testStatus: null,
          error: 'Failed to read test execution state'
        });
      }
    }

    // TEST RESULTS endpoint
    if (action === 'test-results') {
      const stateFile = path.join(process.cwd(), 'test-execution-state.json');
      
      try {
        if (fs.existsSync(stateFile)) {
          const testState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
          return res.json({
            ...healthData,
            testResults: testState.status === 'completed' ? testState : null,
            message: testState.status === 'completed' ? 'Test results available' : 'Tests still running'
          });
        } else {
          return res.json({
            ...healthData,
            testResults: null,
            message: 'No test results available'
          });
        }
      } catch (error) {
        console.error('Error reading test results:', error);
        return res.json({
          ...healthData,
          testResults: null,
          error: 'Failed to read test results'
        });
      }
    }

    // DASHBOARD endpoint
    if (action === 'dashboard') {
      const dashboardHtml = `
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
        #live-feedback { min-height: 100px; max-height: 400px; overflow-y: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Templator Test Suite Dashboard</h1>
        
        <div class="card">
            <h2>Server Status</h2>
            <div class="status healthy">
                <strong>✅ Server Connected</strong><br>
                Environment: ${healthData.environment}<br>
                Uptime: ${Math.floor(healthData.uptime)}s
            </div>
        </div>

        <div class="card">
            <h2>Test Controls</h2>
            <button class="btn btn-primary" onclick="runTests()">🚀 Run Full Test Suite</button>
            <button class="btn btn-info" onclick="checkTestStatus()">📊 Check Test Status</button>
            <button class="btn btn-success" onclick="viewLatestResults()">📋 View Latest Results</button>
        </div>

        <div class="card">
            <h2>Live Test Feedback</h2>
            <div id="live-feedback">
                <p>Click "Run Full Test Suite" to start testing...</p>
            </div>
        </div>

        <div class="card">
            <h2>Available Endpoints</h2>
            <div class="endpoint">GET /health?action=run-tests</div>
            <div class="endpoint">GET /health?action=test-status</div>
            <div class="endpoint">GET /health?action=test-results</div>
            <div class="endpoint">GET /health?action=dashboard</div>
        </div>
    </div>

    <script src="/dashboard.js"></script>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html');
      return res.send(dashboardHtml);
    }

    // Default health response
    return res.json(healthData);
  });

  return app;
}
