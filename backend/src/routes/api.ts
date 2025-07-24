import { Router } from 'express';
import { validateRequest, parseRequestSchema, moduleRequestSchema, previewRequestSchema } from '../middleware/validation';
import { ParserService } from '../services/ParserService';
import { FieldMapperService } from '../services/FieldMapperService';
import { HubSpotModuleBuilder } from '../services/HubSpotModuleBuilder';
import { PreviewService } from '../services/PreviewService';
import { createError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import designRoutes from './design';
import logsRoutes from './logs';

const router = Router();
const logger = createLogger();

// Initialize services
const parserService = new ParserService();
const fieldMapperService = new FieldMapperService();
const hubspotBuilder = new HubSpotModuleBuilder();
const previewService = new PreviewService();

// Add correlation ID to all requests
router.use((req, res, next) => {
  req.headers['x-correlation-id'] = uuidv4();
  next();
});

// Design-to-HTML routes
router.use('/design', designRoutes);

// AI Logs routes
router.use('/logs', logsRoutes);

// Parse HTML/JSON input
router.post('/parse', validateRequest(parseRequestSchema), async (req, res, next) => {
  try {
    const { source_type, payload } = req.body;
    const correlationId = req.headers['x-correlation-id'] as string;
    
    logger.info('Parse request received', {
      correlationId,
      source_type,
      payload_size: payload.length,
    });

    const startTime = Date.now();
    
    // Parse and normalize HTML
    const normalizedHtml = await parserService.parseAndNormalize(payload, source_type);
    
    // Detect fields
    const detectedFields = await fieldMapperService.detectFields(normalizedHtml);
    
    const duration = Date.now() - startTime;
    
    logger.info('Parse completed', {
      correlationId,
      fields_count: detectedFields.length,
      duration_ms: duration,
    });

    if (detectedFields.length === 0) {
      throw createError(
        'No editable fields detected',
        400,
        'FIELD_MAPPING_EMPTY',
        'The HTML contains no recognizable content fields',
        'Try adding data-field attributes or ensure your HTML contains headings, paragraphs, images, or buttons'
      );
    }

    res.json({
      html_normalized: normalizedHtml,
      fields_detected: detectedFields,
    });
  } catch (error) {
    next(error);
  }
});

// Generate HubSpot module
router.post('/module', validateRequest(moduleRequestSchema), async (req, res, next) => {
  try {
    const { html_normalized, fields_config } = req.body;
    const correlationId = req.headers['x-correlation-id'] as string;
    
    logger.info('Module generation request received', {
      correlationId,
      html_size: html_normalized.length,
      fields_count: fields_config?.length || 0,
    });

    const startTime = Date.now();
    
    // Generate module files
    const moduleResult = await hubspotBuilder.generateModule(
      html_normalized,
      fields_config || []
    );
    
    const duration = Date.now() - startTime;
    
    logger.info('Module generation completed', {
      correlationId,
      module_slug: moduleResult.module_slug,
      zip_size: moduleResult.zip_size,
      duration_ms: duration,
    });

    res.json({
      module_zip_url: moduleResult.download_url,
      module_slug: moduleResult.module_slug,
      manifest: moduleResult.manifest,
    });
  } catch (error) {
    next(error);
  }
});

// Generate preview HTML
router.post('/preview', validateRequest(previewRequestSchema), async (req, res, next) => {
  try {
    const { html_normalized, sample_data } = req.body;
    const correlationId = req.headers['x-correlation-id'] as string;
    
    logger.info('Preview request received', {
      correlationId,
      html_size: html_normalized.length,
    });

    const previewHtml = await previewService.generatePreview(
      html_normalized,
      sample_data || {}
    );

    res.setHeader('Content-Type', 'text/html');
    res.send(previewHtml);
  } catch (error) {
    next(error);
  }
});

// Download generated module
router.get('/download/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const correlationId = req.headers['x-correlation-id'] as string;
    
    logger.info('Download request received', {
      correlationId,
      module_slug: slug,
    });

    const zipBuffer = await hubspotBuilder.getModuleZip(slug);
    
    if (!zipBuffer) {
      throw createError(
        'Module not found or expired',
        404,
        'EXPORT_FAILED',
        `Module with slug "${slug}" not found`,
        'Please regenerate the module'
      );
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`);
    res.send(zipBuffer);
  } catch (error) {
    next(error);
  }
});

export default router;
