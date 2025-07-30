import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

/**
 * Base service class providing common functionality for all services
 * Eliminates code duplication and provides standardized patterns
 */
export abstract class BaseService extends EventEmitter {
  protected readonly logger: ReturnType<typeof createLogger>;
  protected readonly serviceName: string;
  protected initialized = false;
  protected readonly config: Record<string, any>;

  constructor(serviceName: string, config: Record<string, any> = {}) {
    super();
    this.serviceName = serviceName;
    this.config = config;
    this.logger = createLogger();
    
    // Set max listeners to prevent memory leaks
    this.setMaxListeners(50);
  }

  /**
   * Initialize the service - must be implemented by subclasses
   */
  protected abstract initialize(): Promise<void>;

  /**
   * Cleanup resources - can be overridden by subclasses
   */
  protected async cleanup(): Promise<void> {
    this.removeAllListeners();
    this.initialized = false;
    this.logger.info(`${this.serviceName} cleaned up`);
  }

  /**
   * Ensure service is initialized before use
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      try {
        await this.initialize();
        this.initialized = true;
        this.logger.info(`${this.serviceName} initialized successfully`);
        this.emit('initialized');
      } catch (error) {
        this.logger.error(`Failed to initialize ${this.serviceName}`, { error });
        this.emit('error', error);
        throw error;
      }
    }
  }

  /**
   * Standardized error handling with context
   */
  protected handleError(error: Error, context: Record<string, any> = {}): Error {
    const enhancedError = new Error(`${this.serviceName}: ${error.message}`);
    enhancedError.stack = error.stack;
    
    this.logger.error(`Error in ${this.serviceName}`, {
      error: error.message,
      stack: error.stack,
      context,
      serviceName: this.serviceName
    });
    
    this.emit('error', enhancedError, context);
    return enhancedError;
  }

  /**
   * Standardized async operation wrapper with error handling
   */
  protected async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Record<string, any> = {}
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Starting ${operationName}`, { serviceName: this.serviceName, context });
      
      const result = await operation();
      
      const duration = Date.now() - startTime;
      this.logger.debug(`Completed ${operationName}`, { 
        serviceName: this.serviceName, 
        duration,
        context 
      });
      
      this.emit('operation-completed', { operationName, duration, context });
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const enhancedError = this.handleError(error as Error, { 
        operationName, 
        duration,
        ...context 
      });
      
      this.emit('operation-failed', { operationName, error: enhancedError, duration, context });
      throw enhancedError;
    }
  }

  /**
   * Validate required configuration
   */
  protected validateConfig(requiredKeys: string[]): void {
    const missingKeys = requiredKeys.filter(key => !(key in this.config));
    
    if (missingKeys.length > 0) {
      throw new Error(`${this.serviceName}: Missing required configuration keys: ${missingKeys.join(', ')}`);
    }
  }

  /**
   * Get service health status
   */
  public getHealthStatus(): {
    serviceName: string;
    initialized: boolean;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    eventListeners: number;
  } {
    return {
      serviceName: this.serviceName,
      initialized: this.initialized,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      eventListeners: this.listenerCount('error') + this.listenerCount('initialized')
    };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    this.logger.info(`Shutting down ${this.serviceName}`);
    await this.cleanup();
    this.emit('shutdown');
  }
}

/**
 * Base service class specifically for singleton services
 * Provides thread-safe singleton implementation
 */
export abstract class BaseSingletonService extends BaseService {
  private static instances: Map<string, BaseSingletonService> = new Map();
  private static initializationPromises: Map<string, Promise<void>> = new Map();

  protected constructor(serviceName: string, config: Record<string, any> = {}) {
    super(serviceName, config);
  }

  /**
   * Get singleton instance with thread-safe initialization
   */
  protected static async getInstance<T extends BaseSingletonService>(
    this: new (config?: Record<string, any>) => T,
    config: Record<string, any> = {}
  ): Promise<T> {
    const className = this.name;
    
    if (!BaseSingletonService.instances.has(className)) {
      // Prevent race conditions during initialization
      if (!BaseSingletonService.initializationPromises.has(className)) {
        const initPromise = (async () => {
          const instance = new this(config);
          await instance.ensureInitialized();
          BaseSingletonService.instances.set(className, instance);
        })();
        
        BaseSingletonService.initializationPromises.set(className, initPromise);
      }
      
      await BaseSingletonService.initializationPromises.get(className);
      BaseSingletonService.initializationPromises.delete(className);
    }
    
    return BaseSingletonService.instances.get(className) as T;
  }

  /**
   * Clear all singleton instances (useful for testing)
   */
  public static clearInstances(): void {
    BaseSingletonService.instances.clear();
    BaseSingletonService.initializationPromises.clear();
  }
}

/**
 * File operation utilities for services
 */
export class FileOperationMixin {
  protected readonly logger: ReturnType<typeof createLogger>;

  constructor() {
    this.logger = createLogger();
  }

  /**
   * Ensure directory exists
   */
  protected async ensureDirectory(dirPath: string): Promise<void> {
    const fs = await import('fs/promises');
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Safe file read with error handling
   */
  protected async readFileWithFallback(
    filePath: string, 
    fallbackContent: string = ''
  ): Promise<string> {
    const fs = await import('fs/promises');
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        this.logger.debug(`File not found, using fallback: ${filePath}`);
        return fallbackContent;
      }
      throw error;
    }
  }

  /**
   * Safe JSON file operations
   */
  protected async readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const content = await this.readFileWithFallback(filePath, JSON.stringify(fallback));
      return JSON.parse(content);
    } catch (error) {
      this.logger.warn(`Failed to parse JSON file, using fallback: ${filePath}`, { error });
      return fallback;
    }
  }

  protected async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    await this.ensureDirectory(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }
}
