import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createError } from '../middleware/errorHandler';
import openaiService from '../services/ai/openaiService';
import { logToFrontend } from './logs';
import layoutSectionSplittingService from '../services/analysis/LayoutSectionSplittingService';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Test endpoint for hybrid layout analysis
 * @route POST /api/hybrid-layout-test/analyze
 */
router.post('/analyze', upload.single('design'), async (req, res, next) => {
  const requestId = `hybrid_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logToFrontend('info', 'system', '🧪 Testing hybrid layout analysis', {
      endpoint: '/api/hybrid-layout-test/analyze'
    }, requestId);
    
    // Validate file
    if (!req.file) {
      throw createError('No file uploaded', 400, 'INPUT_INVALID');
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      throw createError('Invalid file type. Only JPEG, PNG, and WebP are supported', 400, 'INPUT_INVALID');
    }
    
    // Get file data
    const imageBase64 = req.file.buffer.toString('base64');
    const fileName = req.file.originalname;
    
    logToFrontend('info', 'system', '🖼️ Processing design image', {
      fileName,
      fileSize: `${Math.round(req.file.size / 1024)} KB`,
      mimeType: req.file.mimetype
    }, requestId);
    
    // Call OpenAI service
    const analysisResult = await openaiService.convertDesignToHTML(imageBase64, fileName);
    
    // Process sections using LayoutSectionSplittingService
    const enhancedSections = await layoutSectionSplittingService.enhanceSections(analysisResult.sections);
    
    // Save result to debug file
    const debugDir = path.join(__dirname, '../../debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(debugDir, `hybrid-test-${Date.now()}.json`), 
      JSON.stringify({
        original: analysisResult,
        enhanced: {
          ...analysisResult,
          sections: enhancedSections
        }
      }, null, 2)
    );
    
    logToFrontend('success', 'system', '✅ Hybrid layout analysis completed', {
      sectionsCount: analysisResult.sections.length,
      componentsCount: analysisResult.components.length,
      enhancedSectionsCount: enhancedSections.length
    }, requestId);
    
    res.json({
      success: true,
      original: analysisResult,
      enhanced: {
        ...analysisResult,
        sections: enhancedSections
      }
    });
  } catch (error: any) {
    logToFrontend('error', 'system', '❌ Hybrid layout test failed', {
      error: error.message,
      code: error.code
    }, requestId);
    next(error);
  }
});

/**
 * Test endpoint for hybrid layout generation
 * @route POST /api/hybrid-layout-test/generate
 */
router.post('/generate', async (req, res, next) => {
  const requestId = `hybrid_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logToFrontend('info', 'system', '🧪 Testing hybrid layout generation', {
      endpoint: '/api/hybrid-layout-test/generate'
    }, requestId);
    
    // Validate request body
    if (!req.body || !req.body.sections || !Array.isArray(req.body.sections)) {
      throw createError('Invalid request. Sections array is required', 400, 'INPUT_INVALID');
    }
    
    const { sections } = req.body;
    
    // Validate sections
    if (sections.length === 0) {
      throw createError('At least one section is required', 400, 'INPUT_INVALID');
    }
    
    // Check for required fields in each section
    sections.forEach((section: any, index: number) => {
      if (!section.id) {
        throw createError(`Section at index ${index} is missing an id`, 400, 'INPUT_INVALID');
      }
      if (!section.type) {
        throw createError(`Section at index ${index} is missing a type`, 400, 'INPUT_INVALID');
      }
      if (!section.html) {
        throw createError(`Section at index ${index} is missing html content`, 400, 'INPUT_INVALID');
      }
    });
    
    logToFrontend('info', 'system', '🔄 Processing sections', {
      sectionCount: sections.length
    }, requestId);
    
    // Process sections using LayoutSectionSplittingService
    const processedHTML = await layoutSectionSplittingService.combineSectionsHTML(sections);
    
    // Save result to debug file
    const debugDir = path.join(__dirname, '../../debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(debugDir, `hybrid-test-generate-${Date.now()}.json`), 
      JSON.stringify({
        sections,
        processedHTML
      }, null, 2)
    );
    
    logToFrontend('success', 'system', '✅ Hybrid layout generation completed', {
      sectionsCount: sections.length,
      htmlLength: processedHTML.length
    }, requestId);
    
    res.json({
      success: true,
      html: processedHTML,
      sections
    });
  } catch (error: any) {
    logToFrontend('error', 'system', '❌ Hybrid layout generation test failed', {
      error: error.message,
      code: error.code
    }, requestId);
    next(error);
  }
});

export default router;
