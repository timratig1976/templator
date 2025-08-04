/**
 * AI Analysis Service
 * Handles OpenAI Vision API calls and analysis processing
 */

import { aiLogger } from '../aiLogger';
import { fileToBase64 } from './fileUtils';
import type { AIAnalysisResult, SplittingSuggestion } from './types';

/**
 * Check backend connectivity before making requests
 */
export async function checkBackendConnectivity(): Promise<boolean> {
  try {
    aiLogger.info('system', 'Checking backend connectivity...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch('http://localhost:3009/health', {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      aiLogger.success('system', 'Backend is accessible', { status: response.status });
      return true;
    } else {
      aiLogger.error('system', 'Backend responded with error', { status: response.status });
      return false;
    }
  } catch (error) {
    aiLogger.error('system', 'Backend connectivity check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'Make sure backend server is running on port 3009'
    });
    return false;
  }
}

/**
 * Perform full AI Vision Analysis using OpenAI Vision API (only after user confirms sections)
 */
export async function performAIVisionAnalysis(designFile: File, confirmedSections?: SplittingSuggestion[]): Promise<AIAnalysisResult> {
  const requestId = `ai_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    aiLogger.info('processing', 'Starting AI vision analysis', { fileName: designFile.name, requestId });
    
    // Step 1: Check backend connectivity first
    const isBackendAccessible = await checkBackendConnectivity();
    if (!isBackendAccessible) {
      throw new Error('Backend server is not accessible.');
    }
    
    // Step 2: Convert file to base64
    const base64Image = await fileToBase64(designFile);
    aiLogger.info('processing', 'File converted to base64', { fileName: designFile.name, size: base64Image.length, requestId });
    
    // Step 3: Prepare request with confirmed sections if available
    const requestBody = {
      image: base64Image,
      fileName: designFile.name,
      requestId,
      ...(confirmedSections && { confirmedSections })
    };
    
    // Step 4: Make API request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      aiLogger.error('processing', 'API request timeout', { requestId, timeout: '180 seconds' });
    }, 180000);
    
    aiLogger.info('processing', 'Sending request to AI analysis endpoint', {
      endpoint: 'http://localhost:3009/api/ai-enhancement/analyze-layout',
      requestId,
      hasConfirmedSections: !!confirmedSections
    });
    
    const response = await fetch('http://localhost:3009/api/ai-enhancement/analyze-layout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      // Enhanced error handling with detailed parsing
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorDetails = '';
      let fullErrorMessage = errorMessage;
      
      try {
        const responseText = await response.text();
        aiLogger.error('processing', 'API error response received', {
          requestId,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText.substring(0, 500),
          headers: Object.fromEntries(response.headers.entries())
        });
        
        // Try to parse as JSON for structured error details
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error) {
            errorDetails = errorData.error;
          }
          if (errorData.details) {
            errorDetails += errorData.details ? ` - ${errorData.details}` : '';
          }
          if (errorData.code) {
            aiLogger.error('processing', 'Structured error received', {
              requestId,
              errorCode: errorData.code,
              errorMessage: errorData.error,
              errorDetails: errorData.details
            });
          }
        } catch (jsonError) {
          // JSON parsing failed, use raw text as details
          errorDetails = responseText.substring(0, 500);
          aiLogger.error('processing', 'JSON parsing failed, using raw text', {
            requestId,
            jsonError: jsonError instanceof Error ? jsonError.message : 'Unknown error',
            rawResponse: errorDetails
          });
        }
      } catch (textError) {
        aiLogger.error('processing', 'Failed to read error response', {
          requestId,
          textError: textError instanceof Error ? textError.message : 'Unknown error'
        });
      }
      
      // Create a more informative error message
      fullErrorMessage = errorDetails 
        ? `${errorMessage}: ${errorDetails}`
        : errorMessage;

      // Add specific troubleshooting suggestions for common errors
      if (response.status === 500) {
        fullErrorMessage += '\n\nTroubleshooting suggestions:\n';
        fullErrorMessage += '• Check if OPENAI_API_KEY is set in backend environment\n';
        fullErrorMessage += '• Verify backend server is running and accessible\n';
        fullErrorMessage += '• Check backend logs for detailed error information\n';
        fullErrorMessage += '• Ensure image data is valid and properly formatted';
      }

      throw new Error(fullErrorMessage);
    }

    const result = await response.json();
    
    aiLogger.success('processing', 'AI vision analysis completed', { 
      sectionsDetected: result.sections?.length || 0, 
      confidence: result.confidence,
      requestId 
    });
    
    return result;
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = 'AI analysis request timed out after 180 seconds. This may be due to high server load or complex image processing.';
      aiLogger.error('processing', 'AI analysis timeout', { requestId, timeout: '180 seconds' });
      throw new Error(timeoutError);
    }
    
    aiLogger.error('processing', 'AI vision analysis failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}
