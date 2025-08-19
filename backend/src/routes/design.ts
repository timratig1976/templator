import { Router, Request, Response, NextFunction } from 'express';
import { validateRequest, refineHTMLSchema, createFileUploadValidator } from '../middleware/unifiedValidation';
import { createError } from '../middleware/errorHandler';
import multer from 'multer';
import storage from '../services/storage';
import { sha256 } from '../utils/checksum';
import designUploadRepo from '../services/database/DesignUploadRepository';
import { 
  getSupportedFileTypes as getSupportedFileTypesFn,
  convertDesignToHTMLFromUpload,
  refineHTMLHandler
} from './designController';

const router = Router();
// Back-compat: allow tests to inject a controller while defaulting to function-based handlers
type PipelineControllerLike = {
  getSupportedFileTypes?: () => any;
  convertDesignToHTML?: (designFile: { buffer: Buffer; originalname: string; mimetype: string; }) => Promise<{
    fileName: string;
    fileSize: number;
    analysis: { html: string; sections: any[]; components: any[]; description: string };
  }>;
  refineHTML?: (params: { html: string; requirements?: string }) => Promise<{
    originalHTML: string;
    refinedHTML: string;
    requirements: string | null;
  }>;
} | undefined;

let injectedController: PipelineControllerLike;
export function setPipelineController(controller: any) {
  injectedController = controller as PipelineControllerLike;
}

// Configure multer for design uploads (migrated from designController)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(createError(
        'Invalid file type. Please upload PNG, JPG, GIF, WebP, or PDF files.',
        400,
        'INPUT_INVALID'
      ));
    }
  }
});

// Validation schemas are now imported from unifiedValidation
// No need to redefine refineHTMLSchema here

// ===== MIGRATED ROUTES USING UNIFIED PIPELINECONTROLLER =====

/**
 * GET /api/design/supported-types
 * Get supported file types (Legacy API - now uses PipelineController)
 */
router.get('/supported-types', (req: Request, res: Response) => {
  const supportedTypes = injectedController?.getSupportedFileTypes
    ? injectedController.getSupportedFileTypes()
    : getSupportedFileTypesFn();
  res.json({
    success: true,
    data: supportedTypes,
    message: 'Supported file types retrieved successfully'
  });
});

/**
 * GET /api/design/supported-formats
 * Alternative endpoint name for supported file types (for backward compatibility)
 */
router.get('/supported-formats', (req: Request, res: Response) => {
  const supportedTypes = injectedController?.getSupportedFileTypes
    ? injectedController.getSupportedFileTypes()
    : getSupportedFileTypesFn();
  res.json({
    success: true,
    data: supportedTypes,
    message: 'Supported file formats retrieved successfully'
  });
});

/**
 * POST /api/design/upload
 * Convert uploaded design file to HTML (Legacy API - now uses PipelineController)
 */
router.post('/upload', upload.single('design'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw createError('No file uploaded', 400, 'INPUT_INVALID');
    }

    const { originalname, mimetype, buffer } = req.file;
    // Best-effort: persist original file to storage and record in DB
    let storageUrl: string | null = null;
    let checksum: string | null = null;
    try {
      const put = await storage.put(buffer, { mime: mimetype, extension: originalname.split('.')?.pop() || 'bin' });
      storageUrl = put.url;
      checksum = sha256(buffer);
      await designUploadRepo.create({
        filename: originalname,
        mime: mimetype,
        size: buffer.length,
        storageUrl,
        checksum,
        meta: { source: 'design-upload' }
      });
    } catch (e) {
      // non-blocking
    }

    if (injectedController?.convertDesignToHTML) {
      const result = await injectedController.convertDesignToHTML({ buffer, originalname, mimetype });
      res.json({
        success: true,
        data: {
          packagedModule: { name: originalname, id: result.fileName || originalname, status: 'completed' },
          fileName: result.fileName || originalname,
          fileSize: result.fileSize || buffer.length,
          analysis: result.analysis || {
            html: '<div>Generated HTML</div>',
            sections: [],
            components: [],
            description: 'Design converted to HTML'
          }
        },
        message: 'Design successfully converted to HTML'
      });
    } else {
      // Delegate to function-based handler which constructs the response
      await convertDesignToHTMLFromUpload(req, res, next);
    }

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/design/refine
 * Refine generated HTML code (Legacy API - now uses PipelineController)
 */
router.post('/refine', validateRequest(refineHTMLSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (injectedController?.refineHTML) {
      const { html, requirements } = req.body;
      const result = await injectedController.refineHTML({ html, requirements });
      res.json({ success: true, data: result, message: 'HTML successfully refined' });
    } else {
      await refineHTMLHandler(req, res, next);
    }

  } catch (error) {
    next(error);
  }
});

export default router;
