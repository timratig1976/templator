import { createLogger } from '../../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = createLogger();

export interface StorageOptions {
  basePath?: string;
  createDirectories?: boolean;
  overwrite?: boolean;
}

export interface StoredItem {
  id: string;
  path: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  metadata?: any;
}

/**
 * Core Storage Service
 * Consolidated from HTMLStorageService and other storage services
 * Provides unified file storage with metadata tracking
 */
export class StorageService {
  private static instance: StorageService;
  private basePath: string;

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private constructor() {
    this.basePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
  }

  /**
   * Store HTML content with metadata
   */
  async storeHTML(
    content: string,
    fileName: string,
    metadata?: any,
    options: StorageOptions = {}
  ): Promise<StoredItem> {
    return this.storeFile(content, fileName, 'html', metadata, options);
  }

  /**
   * Store CSS content with metadata
   */
  async storeCSS(
    content: string,
    fileName: string,
    metadata?: any,
    options: StorageOptions = {}
  ): Promise<StoredItem> {
    return this.storeFile(content, fileName, 'css', metadata, options);
  }

  /**
   * Store JSON data with metadata
   */
  async storeJSON(
    data: any,
    fileName: string,
    metadata?: any,
    options: StorageOptions = {}
  ): Promise<StoredItem> {
    const content = JSON.stringify(data, null, 2);
    return this.storeFile(content, fileName, 'json', metadata, options);
  }

  /**
   * Store any file content with metadata
   */
  async storeFile(
    content: string,
    fileName: string,
    type: string,
    metadata?: any,
    options: StorageOptions = {}
  ): Promise<StoredItem> {
    try {
      const id = this.generateId();
      const timestamp = new Date().toISOString();
      
      // Determine storage path
      const basePath = options.basePath || this.basePath;
      const typeDir = path.join(basePath, type);
      const filePath = path.join(typeDir, `${id}_${fileName}`);
      const metadataPath = path.join(typeDir, `${id}_${fileName}.meta.json`);

      // Create directories if needed
      if (options.createDirectories !== false) {
        await fs.mkdir(typeDir, { recursive: true });
      }

      // Check if file exists and handle overwrite
      try {
        await fs.access(filePath);
        if (!options.overwrite) {
          throw new Error(`File already exists: ${filePath}`);
        }
      } catch (error) {
        // File doesn't exist, which is fine
      }

      // Store content
      await fs.writeFile(filePath, content, 'utf8');

      // Create metadata
      const storedItem: StoredItem = {
        id,
        path: filePath,
        size: Buffer.byteLength(content, 'utf8'),
        createdAt: timestamp,
        updatedAt: timestamp,
        metadata: {
          type,
          fileName,
          originalName: fileName,
          ...metadata
        }
      };

      // Store metadata
      await fs.writeFile(metadataPath, JSON.stringify(storedItem, null, 2), 'utf8');

      logger.info('File stored successfully', {
        id,
        fileName,
        type,
        size: storedItem.size,
        path: filePath
      });

      return storedItem;

    } catch (error) {
      logger.error('Failed to store file', {
        fileName,
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Retrieve stored content by ID
   */
  async retrieveFile(id: string, type?: string): Promise<{
    content: string;
    metadata: StoredItem;
  }> {
    try {
      // Find the file
      const searchPaths = type 
        ? [path.join(this.basePath, type)]
        : await this.getAllTypeDirs();

      let filePath: string | null = null;
      let metadataPath: string | null = null;

      for (const searchPath of searchPaths) {
        try {
          const files = await fs.readdir(searchPath);
          const targetFile = files.find(file => file.startsWith(`${id}_`) && !file.endsWith('.meta.json'));
          
          if (targetFile) {
            filePath = path.join(searchPath, targetFile);
            metadataPath = path.join(searchPath, `${targetFile}.meta.json`);
            break;
          }
        } catch (error) {
          // Directory doesn't exist or can't be read, continue searching
        }
      }

      if (!filePath || !metadataPath) {
        throw new Error(`File not found: ${id}`);
      }

      // Read content and metadata
      const [content, metadataContent] = await Promise.all([
        fs.readFile(filePath, 'utf8'),
        fs.readFile(metadataPath, 'utf8')
      ]);

      const metadata = JSON.parse(metadataContent);

      logger.info('File retrieved successfully', {
        id,
        size: content.length,
        path: filePath
      });

      return { content, metadata };

    } catch (error) {
      logger.error('Failed to retrieve file', {
        id,
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * List stored files by type
   */
  async listFiles(type: string, limit?: number): Promise<StoredItem[]> {
    try {
      const typeDir = path.join(this.basePath, type);
      
      try {
        const files = await fs.readdir(typeDir);
        const metadataFiles = files.filter(file => file.endsWith('.meta.json'));
        
        const items: StoredItem[] = [];
        
        for (const metaFile of metadataFiles.slice(0, limit)) {
          try {
            const metadataPath = path.join(typeDir, metaFile);
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            items.push(metadata);
          } catch (error) {
            logger.warn('Failed to read metadata file', { metaFile, error });
          }
        }

        // Sort by creation date (newest first)
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return items;

      } catch (error) {
        // Directory doesn't exist
        return [];
      }

    } catch (error) {
      logger.error('Failed to list files', {
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete stored file by ID
   */
  async deleteFile(id: string, type?: string): Promise<boolean> {
    try {
      const { metadata } = await this.retrieveFile(id, type);
      const metadataPath = `${metadata.path}.meta.json`;

      // Delete both content and metadata files
      await Promise.all([
        fs.unlink(metadata.path),
        fs.unlink(metadataPath)
      ]);

      logger.info('File deleted successfully', {
        id,
        path: metadata.path
      });

      return true;

    } catch (error) {
      logger.error('Failed to delete file', {
        id,
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Update file metadata
   */
  async updateMetadata(id: string, newMetadata: any, type?: string): Promise<StoredItem> {
    try {
      const { content, metadata } = await this.retrieveFile(id, type);
      
      const updatedMetadata: StoredItem = {
        ...metadata,
        updatedAt: new Date().toISOString(),
        metadata: {
          ...metadata.metadata,
          ...newMetadata
        }
      };

      const metadataPath = `${metadata.path}.meta.json`;
      await fs.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2), 'utf8');

      logger.info('Metadata updated successfully', {
        id,
        path: metadata.path
      });

      return updatedMetadata;

    } catch (error) {
      logger.error('Failed to update metadata', {
        id,
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    typeBreakdown: Record<string, { count: number; size: number }>;
  }> {
    try {
      const typeDirs = await this.getAllTypeDirs();
      let totalFiles = 0;
      let totalSize = 0;
      const typeBreakdown: Record<string, { count: number; size: number }> = {};

      for (const typeDir of typeDirs) {
        const type = path.basename(typeDir);
        const files = await this.listFiles(type);
        
        const typeSize = files.reduce((sum, file) => sum + file.size, 0);
        
        typeBreakdown[type] = {
          count: files.length,
          size: typeSize
        };
        
        totalFiles += files.length;
        totalSize += typeSize;
      }

      return {
        totalFiles,
        totalSize,
        typeBreakdown
      };

    } catch (error) {
      logger.error('Failed to get storage stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate unique ID for stored items
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all type directories
   */
  private async getAllTypeDirs(): Promise<string[]> {
    try {
      const items = await fs.readdir(this.basePath, { withFileTypes: true });
      return items
        .filter(item => item.isDirectory())
        .map(item => path.join(this.basePath, item.name));
    } catch (error) {
      return [];
    }
  }
}

export default StorageService.getInstance();
