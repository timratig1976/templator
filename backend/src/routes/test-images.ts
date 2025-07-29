import express from 'express';
import { createLogger } from '../utils/logger';
import ImageHandlingService from '../services/ImageHandlingService';

const router = express.Router();
const logger = createLogger();

/**
 * Test endpoint for image handling functionality
 */
router.post('/process-html', async (req, res) => {
  try {
    const { html, originalImageBase64 } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'HTML content is required'
      });
    }

    logger.info('Testing image processing in HTML', {
      htmlLength: html.length,
      hasOriginalImage: !!originalImageBase64
    });

    const imageService = ImageHandlingService.getInstance();
    const processedHTML = await imageService.processImagesInHTML(html, originalImageBase64);

    // Count images before and after processing
    const originalImgCount = (html.match(/<img[^>]*>/gi) || []).length;
    const processedImgCount = (processedHTML.match(/<img[^>]*>/gi) || []).length;

    res.json({
      success: true,
      data: {
        originalHTML: html,
        processedHTML,
        originalImageCount: originalImgCount,
        processedImageCount: processedImgCount,
        processing: {
          imagesFound: originalImgCount,
          imagesProcessed: processedImgCount,
          hasChanges: html !== processedHTML
        }
      }
    });

  } catch (error) {
    logger.error('Image processing test failed', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test endpoint for generating contextual images
 */
router.post('/generate-contextual', async (req, res) => {
  try {
    const { imageType, width, height, description } = req.body;
    
    const imageService = ImageHandlingService.getInstance();
    const contextualImage = imageService.generateContextualImage({
      type: imageType || 'generic',
      width: width || 400,
      height: height || 300,
      description: description || 'Test image',
      alt: description || 'Test image'
    });

    res.json({
      success: true,
      data: {
        image: contextualImage,
        imageTag: `<img src="${contextualImage.src}" alt="${contextualImage.alt}" width="${contextualImage.width}" height="${contextualImage.height}" loading="lazy">`
      }
    });

  } catch (error) {
    logger.error('Contextual image generation test failed', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test endpoint with sample HTML containing various image types
 */
router.get('/sample-html', async (req, res) => {
  try {
    const sampleHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sample HTML with Images</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <header class="bg-gray-800 text-white p-4">
    <div class="container mx-auto flex justify-between items-center">
      <img src="/path/to/logo.png" alt="Company Logo" class="h-10 w-auto logo">
      <nav>
        <ul class="flex space-x-4">
          <li><a href="#" class="hover:underline">Home</a></li>
          <li><a href="#" class="hover:underline">About</a></li>
          <li><a href="#" class="hover:underline">Contact</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <section class="hero bg-gradient-to-r from-blue-500 to-purple-600 text-white py-20">
    <div class="container mx-auto text-center">
      <h1 class="text-5xl font-bold mb-6">Welcome to Our Website</h1>
      <p class="text-xl mb-8">Experience the future of web design</p>
      <img src="/path/to/hero-image.jpg" alt="Hero Image" class="w-full max-w-2xl mx-auto rounded-lg shadow-lg hero">
      <button class="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold mt-8">Get Started</button>
    </div>
  </section>

  <section class="py-16">
    <div class="container mx-auto px-4">
      <h2 class="text-3xl font-bold text-center mb-12">Our Products</h2>
      <div class="grid md:grid-cols-3 gap-8">
        <div class="text-center">
          <img src="/path/to/product1.jpg" alt="Product 1" class="w-full h-48 object-cover rounded-lg mb-4 product">
          <h3 class="text-xl font-semibold mb-2">Product One</h3>
          <p class="text-gray-600">Amazing product description here.</p>
        </div>
        <div class="text-center">
          <img src="/path/to/product2.jpg" alt="Product 2" class="w-full h-48 object-cover rounded-lg mb-4 product">
          <h3 class="text-xl font-semibold mb-2">Product Two</h3>
          <p class="text-gray-600">Another great product description.</p>
        </div>
        <div class="text-center">
          <img src="/path/to/product3.jpg" alt="Product 3" class="w-full h-48 object-cover rounded-lg mb-4 product">
          <h3 class="text-xl font-semibold mb-2">Product Three</h3>
          <p class="text-gray-600">Yet another excellent product.</p>
        </div>
      </div>
    </div>
  </section>

  <footer class="bg-gray-800 text-white py-8">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center">
        <p>&copy; 2024 Company Name. All rights reserved.</p>
        <div class="flex space-x-4">
          <img src="/path/to/facebook-icon.png" alt="Facebook" class="w-6 h-6 icon">
          <img src="/path/to/twitter-icon.png" alt="Twitter" class="w-6 h-6 icon">
          <img src="/path/to/linkedin-icon.png" alt="LinkedIn" class="w-6 h-6 icon">
        </div>
      </div>
    </div>
  </footer>
</body>
</html>`;

    const imageService = ImageHandlingService.getInstance();
    const processedHTML = await imageService.processImagesInHTML(sampleHTML);

    res.json({
      success: true,
      data: {
        originalHTML: sampleHTML,
        processedHTML,
        demo: {
          description: 'This sample shows how images are automatically processed and replaced with contextual placeholders',
          imageTypes: ['logo', 'hero', 'product', 'icon'],
          processing: 'All img tags are analyzed and replaced with appropriate placeholder images'
        }
      }
    });

  } catch (error) {
    logger.error('Sample HTML processing failed', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
