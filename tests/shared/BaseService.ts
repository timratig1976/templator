import { EventEmitter } from 'events';
import { createLogger, Logger } from './logger';
import { ErrorHandler, AppError } from './ErrorSystem';

export class BaseService extends EventEmitter {
  protected serviceName: string;
  protected config: any;
  protected logger: Logger;
  private _initialized = false;

  constructor(serviceName: string, config: any = {}) {
    super();
    this.serviceName = serviceName;
    this.config = config;
    this.logger = createLogger(serviceName);
  }

  protected async initialize(): Promise<void> {
    // no-op by default
  }

  protected async cleanup(): Promise<void> {
    // no-op by default
  }

  protected getHealthStatus(): Record<string, any> {
    return { initialized: this._initialized };
  }

  protected async ensureInitialized(): Promise<void> {
    if (!this._initialized) {
      await this.initialize();
      this._initialized = true;
    }
  }

  protected handleError(error: Error, context?: any): AppError {
    const appError = ErrorHandler.handle(error, context);
    this.logger.error(appError.message, { statusCode: appError.statusCode, context });
    return appError;
  }
}

export class FileOperationMixin {
  async ensureDir(dirPath: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.mkdir(dirPath, { recursive: true });
  }

  async writeFileSafe(filePath: string, data: string | Buffer): Promise<void> {
    const path = await import('path');
    await this.ensureDir(path.dirname(filePath));
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, data);
  }
}
