import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import designRoutes from './routes/design';
import apiRoutes from './routes/api';
import validationRoutes from './routes/validation';
import projectsRoutes from './routes/projects';
import testStorageRoutes from './routes/test-storage';
import testImageRoutes from './routes/test-images';
import pipelineMonitoringRoutes from './routes/pipelineMonitoring';
import buildTestRoutes from './routes/buildTest';
import aiEnhancementRoutes from './routes/aiEnhancement';
import sectionComparisonRoutes from './routes/sectionComparison';
import interactivePromptsRoutes from './routes/interactivePrompts';
import hybridLayoutRoutes from './routes/hybridLayout';
import hybridLayoutTestRoutes from './routes/hybridLayoutTest';
import exportRoutes from './routes/exportRoutes';
import generationRoutes from './routes/generation';
import pipelineRoutes from './routes/pipeline';
import logsRoutes from './routes/logs';
// import htmlValidationRoutes from './routes/htmlValidation'; // Temporarily disabled due to TypeScript errors
import layoutSplittingRoutes from './routes/layoutSplittingRoutes';
import designUploadsRoutes from './routes/designUploads';
import aiPromptManagementRoutes from './routes/aiPromptManagement';
import staticFilesRoutes from './routes/staticFiles';
import testsRoutes from './routes/tests';
import adminPipelinesRoutes from './routes/admin/pipelines';
import adminAiStepsRoutes from './routes/admin/aiSteps';
import { TestRunnerService } from './services/TestRunnerService';
import { TestStateStore } from './services/TestStateStore';

export function createApp(): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet({
    // Allow the frontend (localhost:3000) to request assets from backend (localhost:3009)
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Disable COEP for local dev to avoid NotSameOrigin blocking for images
    crossOriginEmbedderPolicy: false,
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

  // Health endpoint with Jest test integration via services
  app.get('/health', async (req: express.Request, res: express.Response) => {
    const action = req.query.action as string;
    const runner = TestRunnerService.getInstance();
    const store = new TestStateStore();
    
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
        dashboard: '/health?action=dashboard',
        testsuite: '/health?action=testsuite'
      }
    };

    // Start test execution
    if (action === 'run-tests') {
      const result = await runner.start();
      if ('error' in result) {
        return res.status(409).json({ ...healthData, error: result.error });
      }
      return res.json({ ...healthData, message: 'Jest started', executionId: result.executionId, status: 'started' });
    }

    // TEST STATUS endpoint
    if (action === 'test-status') {
      const state = store.readState();
      return res.json({ ...healthData, testStatus: state || null });
    }

    // TEST RESULTS endpoint
    if (action === 'test-results') {
      const state = store.readState();
      return res.json({
        ...healthData,
        testResults: state && state.status === 'completed' ? state : null,
        message: state && state.status === 'completed' ? 'Test results available' : 'Tests still running'
      });
    }

    // Legacy inline dashboard removed

    // Default health response
    return res.json(healthData);
  });

  // Register API routes
  app.use('/api/design', designRoutes);
  app.use('/api', apiRoutes);
  app.use('/api/validation', validationRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/tests', testsRoutes);
  app.use('/api/test-storage', testStorageRoutes);
  app.use('/api/test-images', testImageRoutes);
  app.use('/api/pipeline-monitoring', pipelineMonitoringRoutes);
  app.use('/api/build-test', buildTestRoutes);
  app.use('/api/ai-enhancement', aiEnhancementRoutes);
  app.use('/api/comparison', sectionComparisonRoutes);
  app.use('/api/prompts', interactivePromptsRoutes);
  app.use('/api/hybrid-layout', hybridLayoutRoutes);
  app.use('/api/hybrid-layout-test', hybridLayoutTestRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api/generation', generationRoutes);
  app.use('/api/pipeline', pipelineRoutes);
  app.use('/api/logs', logsRoutes);
  // app.use('/api/html-validation', htmlValidationRoutes); // Temporarily disabled due to TypeScript errors
  app.use('/api/layout-splitting', layoutSplittingRoutes);
  app.use('/api/design-uploads', designUploadsRoutes);
  app.use('/api/admin/ai-prompts', aiPromptManagementRoutes);
  app.use('/api/admin/static-files', staticFilesRoutes);
  app.use('/api/admin/pipelines', adminPipelinesRoutes);
  app.use('/api/admin/ai-steps', adminAiStepsRoutes);

  const { errorHandler } = require('./middleware/errorHandler');
  app.use(errorHandler);

  return app;
}
