/**
 * File Utilities for AI Pipeline
 * Handles file conversion, validation, and processing
 */

import { aiLogger } from '../aiLogger';

/**
 * Convert file to base64 data URL string with comprehensive validation
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Step 1: Validate file before processing
    aiLogger.info('processing', 'Starting file to base64 conversion', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      lastModified: new Date(file.lastModified).toISOString()
    });

    // Step 2: File size validation (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const error = `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (10MB)`;
      aiLogger.error('processing', 'File size validation failed', { 
        fileSize: file.size, 
        maxSize,
        fileName: file.name 
      });
      reject(new Error(error));
      return;
    }

    // Step 3: File type validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      const error = `File type '${file.type}' is not supported. Allowed types: ${allowedTypes.join(', ')}`;
      aiLogger.error('processing', 'File type validation failed', { 
        fileType: file.type, 
        allowedTypes,
        fileName: file.name 
      });
      reject(new Error(error));
      return;
    }

    aiLogger.info('processing', 'File validation passed, starting FileReader', {
      fileName: file.name,
      validatedType: file.type,
      validatedSize: `${Math.round(file.size / 1024)}KB`
    });

    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        const result = reader.result as string;
        
        // Step 4: Validate base64 result
        if (!result || typeof result !== 'string') {
          const error = 'FileReader returned invalid result';
          aiLogger.error('processing', 'FileReader result validation failed', { 
            resultType: typeof result,
            resultLength: result?.length || 0
          });
          reject(new Error(error));
          return;
        }

        // Step 5: Validate data URL format
        if (!result.startsWith('data:image/')) {
          const error = `Invalid data URL format. Expected 'data:image/', got: ${result.substring(0, 50)}...`;
          aiLogger.error('processing', 'Data URL format validation failed', { 
            resultPrefix: result.substring(0, 50),
            expectedPrefix: 'data:image/'
          });
          reject(new Error(error));
          return;
        }

        // Step 6: Extract and validate base64 part
        const base64Match = result.match(/^data:image\/([^;]+);base64,(.+)$/);
        if (!base64Match) {
          const error = 'Failed to extract base64 data from data URL';
          aiLogger.error('processing', 'Base64 extraction failed', { 
            resultFormat: result.substring(0, 100),
            expectedPattern: 'data:image/[type];base64,[data]'
          });
          reject(new Error(error));
          return;
        }

        const [, imageType, base64Data] = base64Match;
        
        // Step 7: Validate base64 data
        if (!base64Data || base64Data.length < 100) {
          const error = `Base64 data is too short (${base64Data?.length || 0} characters). Minimum expected: 100`;
          aiLogger.error('processing', 'Base64 data validation failed', { 
            base64Length: base64Data?.length || 0,
            minimumLength: 100
          });
          reject(new Error(error));
          return;
        }

        // Step 8: Test base64 decodability
        try {
          const binaryString = atob(base64Data.substring(0, 100)); // Test first 100 chars
          if (!binaryString) {
            throw new Error('Base64 decode returned empty string');
          }
        } catch (decodeError) {
          const error = `Base64 data is not properly encoded: ${decodeError}`;
          aiLogger.error('processing', 'Base64 decode test failed', { 
            decodeError: decodeError instanceof Error ? decodeError.message : 'Unknown error',
            base64Sample: base64Data.substring(0, 50)
          });
          reject(new Error(error));
          return;
        }

        // Step 9: Log successful conversion
        aiLogger.success('processing', 'File to base64 conversion completed', {
          fileName: file.name,
          imageType,
          base64Length: base64Data.length,
          totalDataUrlLength: result.length,
          compressionRatio: Math.round((result.length / file.size) * 100) / 100
        });

        resolve(result);
        
      } catch (error) {
        aiLogger.error('processing', 'Unexpected error during base64 conversion', {
          error: error instanceof Error ? error.message : 'Unknown error',
          fileName: file.name
        });
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      aiLogger.error('processing', 'FileReader error', {
        error: error,
        fileName: file.name,
        fileSize: file.size
      });
      reject(new Error('Failed to read file'));
    };

    // Start reading the file
    reader.readAsDataURL(file);
  });
}

/**
 * Validate file for AI processing
 */
export function validateFileForAI(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (10MB)`
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type '${file.type}' is not supported. Allowed types: ${allowedTypes.join(', ')}`
    };
  }

  return { valid: true };
}
