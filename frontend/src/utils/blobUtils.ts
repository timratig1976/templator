import React from 'react';

/**
 * Utility functions for safe blob URL management
 * Prevents ERR_FILE_NOT_FOUND errors and memory leaks
 */

export interface BlobUrlManager {
  url: string;
  cleanup: () => void;
}

/**
 * Creates a blob URL with automatic cleanup management
 * @param file - The file to create a blob URL for
 * @returns Object with URL and cleanup function
 */
export function createSafeBlobUrl(file: File | Blob): BlobUrlManager {
  const url = URL.createObjectURL(file);
  
  return {
    url,
    cleanup: () => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn('Failed to revoke blob URL:', error);
      }
    }
  };
}

/**
 * React hook for safe blob URL management
 * @param file - The file to create a blob URL for
 * @returns The blob URL string or null
 */
export function useSafeBlobUrl(file: File | Blob | null): string | null {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    if (file) {
      const manager = createSafeBlobUrl(file);
      setBlobUrl(manager.url);
      
      return manager.cleanup;
    } else {
      setBlobUrl(null);
    }
  }, [file]);
  
  return blobUrl;
}

/**
 * Validates if a blob URL is still accessible
 * @param url - The blob URL to validate
 * @returns Promise<boolean> - True if accessible, false otherwise
 */
export async function validateBlobUrl(url: string): Promise<boolean> {
  if (!url.startsWith('blob:')) {
    return false;
  }
  
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Safe image loader that handles blob URL errors gracefully
 * @param url - The image URL (blob or regular)
 * @returns Promise<HTMLImageElement> - Loaded image element
 */
export function loadImageSafely(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => resolve(img);
    img.onerror = (error) => {
      console.error('Failed to load image:', url, error);
      reject(new Error(`Failed to load image from ${url}`));
    };
    
    img.src = url;
  });
}
