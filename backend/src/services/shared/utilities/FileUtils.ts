/**
 * File Utilities Service
 * Shared utilities for file operations, path handling, and file system interactions
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../../../utils/logger';

const logger = createLogger();

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  extension: string;
  mimeType: string;
  lastModified: Date;
  isDirectory: boolean;
}

export interface DirectoryInfo {
  path: string;
  files: FileInfo[];
  totalSize: number;
  fileCount: number;
  directoryCount: number;
}

/**
 * File Utilities Service
 * Provides common file system operations and utilities
 */
export class FileUtils {
  private static instance: FileUtils;

  public static getInstance(): FileUtils {
    if (!FileUtils.instance) {
      FileUtils.instance = new FileUtils();
    }
    return FileUtils.instance;
  }

  private constructor() {}

  /**
   * Check if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    try {
      const stats = await fs.stat(filePath);
      const parsedPath = path.parse(filePath);

      return {
        name: parsedPath.base,
        path: filePath,
        size: stats.size,
        extension: parsedPath.ext,
        mimeType: this.getMimeType(parsedPath.ext),
        lastModified: stats.mtime,
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      logger.error('Failed to get file info', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get directory information
   */
  async getDirectoryInfo(dirPath: string): Promise<DirectoryInfo> {
    try {
      const files: FileInfo[] = [];
      let totalSize = 0;
      let fileCount = 0;
      let directoryCount = 0;

      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);

        const fileInfo: FileInfo = {
          name: entry.name,
          path: fullPath,
          size: stats.size,
          extension: path.extname(entry.name),
          mimeType: this.getMimeType(path.extname(entry.name)),
          lastModified: stats.mtime,
          isDirectory: entry.isDirectory()
        };

        files.push(fileInfo);
        totalSize += stats.size;

        if (entry.isDirectory()) {
          directoryCount++;
        } else {
          fileCount++;
        }
      }

      return {
        path: dirPath,
        files,
        totalSize,
        fileCount,
        directoryCount
      };
    } catch (error) {
      logger.error('Failed to get directory info', {
        dirPath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Ensure directory exists
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to ensure directory', {
        dirPath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Copy file
   */
  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      // Ensure destination directory exists
      await this.ensureDirectory(path.dirname(destinationPath));
      
      await fs.copyFile(sourcePath, destinationPath);
      
      logger.debug('File copied successfully', {
        sourcePath,
        destinationPath
      });
    } catch (error) {
      logger.error('Failed to copy file', {
        sourcePath,
        destinationPath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Move file
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      // Ensure destination directory exists
      await this.ensureDirectory(path.dirname(destinationPath));
      
      await fs.rename(sourcePath, destinationPath);
      
      logger.debug('File moved successfully', {
        sourcePath,
        destinationPath
      });
    } catch (error) {
      logger.error('Failed to move file', {
        sourcePath,
        destinationPath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      
      logger.debug('File deleted successfully', { filePath });
    } catch (error) {
      logger.error('Failed to delete file', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Read file as text
   */
  async readTextFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    try {
      return await fs.readFile(filePath, encoding);
    } catch (error) {
      logger.error('Failed to read text file', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Write text file
   */
  async writeTextFile(filePath: string, content: string, encoding: BufferEncoding = 'utf8'): Promise<void> {
    try {
      // Ensure directory exists
      await this.ensureDirectory(path.dirname(filePath));
      
      await fs.writeFile(filePath, content, encoding);
      
      logger.debug('Text file written successfully', {
        filePath,
        size: content.length
      });
    } catch (error) {
      logger.error('Failed to write text file', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.xml': 'application/xml'
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  /**
   * Get relative path
   */
  getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * Join paths safely
   */
  joinPath(...paths: string[]): string {
    return path.join(...paths);
  }

  /**
   * Normalize path
   */
  normalizePath(filePath: string): string {
    return path.normalize(filePath);
  }

  /**
   * Get file extension
   */
  getExtension(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * Get filename without extension
   */
  getBasename(filePath: string, ext?: string): string {
    return path.basename(filePath, ext);
  }

  /**
   * Get directory name
   */
  getDirname(filePath: string): string {
    return path.dirname(filePath);
  }
}

export default FileUtils.getInstance();
