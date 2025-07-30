import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { createError } from '../middleware/errorHandler';
import openaiService, { DesignAnalysis } from '../services/ai/openaiService';
import { createLogger } from '../utils/logger';

const logger = createLogger();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
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

export const uploadDesign = upload.single('design');

/**
 * Convert uploaded design file to HTML/Tailwind CSS
 */
export const convertDesignToHTML = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw createError('No file uploaded', 400, 'INPUT_INVALID');
    }

    const { originalname, mimetype, buffer } = req.file;
    logger.info(`Processing design file: ${originalname} (${mimetype})`);

    // Convert file to base64 image
    let imageBase64: string;
    
    if (mimetype === 'application/pdf') {
      // For PDF files, we'd need a PDF-to-image converter
      // For now, return an error asking for image files
      throw createError(
        'PDF conversion not yet supported. Please upload an image file (PNG, JPG, etc.)',
        400,
        'INPUT_INVALID'
      );
    } else {
      // Process image file
      const processedImage = await sharp(buffer)
        .resize(1920, null, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      imageBase64 = processedImage.toString('base64');
    }

    // Convert design to HTML using OpenAI
    const analysis: DesignAnalysis = await openaiService.convertDesignToHTML(
      imageBase64,
      originalname
    );

    // Return the analysis result
    res.json({
      success: true,
      data: {
        fileName: originalname,
        fileSize: buffer.length,
        analysis: {
          html: analysis.html,
          sections: analysis.sections,
          components: analysis.components,
          description: analysis.description
        }
      },
      message: 'Design successfully converted to HTML'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Refine generated HTML code
 */
export const refineHTML = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { html, requirements } = req.body;

    if (!html) {
      throw createError('HTML code is required', 400, 'INPUT_INVALID');
    }

    const refinedHTML = await openaiService.refineHTML(html, requirements);

    res.json({
      success: true,
      data: {
        originalHTML: html,
        refinedHTML,
        requirements: requirements || null
      },
      message: 'HTML successfully refined'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get supported file types
 */
export const getSupportedFileTypes = (
  req: Request,
  res: Response
): void => {
  res.json({
    success: true,
    data: {
      supportedTypes: [
        {
          type: 'image/jpeg',
          extensions: ['.jpg', '.jpeg'],
          description: 'JPEG images'
        },
        {
          type: 'image/png', 
          extensions: ['.png'],
          description: 'PNG images'
        },
        {
          type: 'image/gif',
          extensions: ['.gif'], 
          description: 'GIF images'
        },
        {
          type: 'image/webp',
          extensions: ['.webp'],
          description: 'WebP images'
        }
      ],
      maxFileSize: '10MB',
      recommendations: [
        'Use high-resolution images for better AI analysis',
        'Ensure design elements are clearly visible',
        'PNG format recommended for designs with text',
        'JPEG format recommended for photographs'
      ]
    }
  });
};
