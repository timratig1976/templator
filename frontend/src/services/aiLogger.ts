'use client';

export interface AILogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'openai' | 'upload' | 'processing' | 'network' | 'system';
  message: string;
  details?: any;
  requestId?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface AILogSubscriber {
  (log: AILogEntry): void;
}

class AILoggerService {
  private static instance: AILoggerService;
  private logs: AILogEntry[] = [];
  private subscribers: Set<AILogSubscriber> = new Set();
  private maxLogs = 1000; // Keep last 1000 logs

  public static getInstance(): AILoggerService {
    if (!AILoggerService.instance) {
      AILoggerService.instance = new AILoggerService();
    }
    return AILoggerService.instance;
  }

  private constructor() {
    // Initialize with a welcome message
    this.log('info', 'system', 'AI Logger initialized', {
      maxLogs: this.maxLogs,
      timestamp: new Date().toISOString()
    });
  }

  public log(
    level: AILogEntry['level'],
    category: AILogEntry['category'],
    message: string,
    details?: any,
    requestId?: string,
    duration?: number,
    metadata?: Record<string, any>
  ): void {
    const logEntry: AILogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
      requestId,
      duration,
      metadata
    };

    // Add to logs array
    this.logs.push(logEntry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify all subscribers
    this.subscribers.forEach(subscriber => {
      try {
        subscriber(logEntry);
      } catch (error) {
        console.error('Error notifying log subscriber:', error);
      }
    });

    // Also log to console for debugging
    const consoleMessage = `[${level.toUpperCase()}] [${category}] ${message}`;
    switch (level) {
      case 'error':
        console.error(consoleMessage, details);
        break;
      case 'warning':
        console.warn(consoleMessage, details);
        break;
      case 'success':
        console.log(`✅ ${consoleMessage}`, details);
        break;
      default:
        console.log(consoleMessage, details);
    }
  }

  public info(category: AILogEntry['category'], message: string, details?: any, requestId?: string, metadata?: Record<string, any>): void {
    this.log('info', category, message, details, requestId, undefined, metadata);
  }

  public success(category: AILogEntry['category'], message: string, details?: any, requestId?: string, duration?: number, metadata?: Record<string, any>): void {
    this.log('success', category, message, details, requestId, duration, metadata);
  }

  public warning(category: AILogEntry['category'], message: string, details?: any, requestId?: string, metadata?: Record<string, any>): void {
    this.log('warning', category, message, details, requestId, undefined, metadata);
  }

  public error(category: AILogEntry['category'], message: string, details?: any, requestId?: string, metadata?: Record<string, any>): void {
    this.log('error', category, message, details, requestId, undefined, metadata);
  }

  public subscribe(subscriber: AILogSubscriber): () => void {
    this.subscribers.add(subscriber);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public getLogs(): AILogEntry[] {
    return [...this.logs];
  }

  public getLogsByCategory(category: AILogEntry['category']): AILogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  public getLogsByLevel(level: AILogEntry['level']): AILogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  public getLogsByRequestId(requestId: string): AILogEntry[] {
    return this.logs.filter(log => log.requestId === requestId);
  }

  public clearLogs(): void {
    this.logs = [];
    this.info('system', 'Logs cleared');
  }

  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Compact flow-focused logging methods
  public logFlowStep(requestId: string, step: string, status: 'start' | 'complete' | 'error', metadata?: Record<string, any>): void {
    const emoji = status === 'start' ? '🔄' : status === 'complete' ? '✅' : '❌';
    const level = status === 'error' ? 'error' : status === 'complete' ? 'success' : 'info';
    this.log(level, 'processing', `${emoji} ${step}`, metadata, requestId);
  }

  public logAICall(requestId: string, model: string, purpose: string, status: 'start' | 'complete' | 'error', metadata?: Record<string, any>): void {
    const emoji = status === 'start' ? '🤖' : status === 'complete' ? '✨' : '💥';
    const level = status === 'error' ? 'error' : status === 'complete' ? 'success' : 'info';
    this.log(level, 'openai', `${emoji} ${purpose} (${model})`, metadata, requestId);
  }

  // Simplified OpenAI request logging
  public logOpenAIRequest(requestId: string, model: string, purpose: string, hasImages: boolean = false): void {
    this.logAICall(requestId, model, purpose, 'start', { hasImages });
  }

  public logOpenAIResponse(requestId: string, response: any, duration: number, purpose: string): void {
    const usage = response.usage || {};
    this.logAICall(requestId, response.model || 'unknown', purpose, 'complete', {
      tokens: usage.total_tokens,
      duration: `${duration}ms`,
      cost: this.estimateOpenAICost(usage, response.model)
    });
  }

  public logOpenAIError(requestId: string, error: any, duration: number, purpose: string): void {
    this.logAICall(requestId, 'unknown', purpose, 'error', {
      error: error.message || 'Unknown error',
      duration: `${duration}ms`
    });
  }

  private estimateOpenAICost(usage: any, model: string): string {
    if (!usage) return '$0.00';
    
    // OpenAI pricing (as of 2024) - these are approximate
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gpt-4o': { prompt: 0.005, completion: 0.015 }, // per 1K tokens
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 }
    };
    
    const modelPricing = pricing[model] || pricing['gpt-4']; // default to gpt-4 pricing
    const promptCost = (usage.prompt_tokens / 1000) * modelPricing.prompt;
    const completionCost = (usage.completion_tokens / 1000) * modelPricing.completion;
    const totalCost = promptCost + completionCost;
    
    return `$${totalCost.toFixed(4)}`;
  }

  private calculatePromptCost(tokens: number, model: string): string {
    const pricing: Record<string, number> = {
      'gpt-4o': 0.005,
      'gpt-4': 0.03,
      'gpt-4-turbo': 0.01,
      'gpt-3.5-turbo': 0.001
    };
    const rate = pricing[model] || pricing['gpt-4'];
    return `$${((tokens / 1000) * rate).toFixed(4)}`;
  }

  private calculateCompletionCost(tokens: number, model: string): string {
    const pricing: Record<string, number> = {
      'gpt-4o': 0.015,
      'gpt-4': 0.06,
      'gpt-4-turbo': 0.03,
      'gpt-3.5-turbo': 0.002
    };
    const rate = pricing[model] || pricing['gpt-4'];
    return `$${((tokens / 1000) * rate).toFixed(4)}`;
  }

  // Helper methods for upload process logging
  public logUploadStart(requestId: string, fileName: string, fileSize: number): void {
    this.info('upload', `📤 Starting file upload`, {
      fileName,
      fileSize,
      fileSizeFormatted: this.formatFileSize(fileSize)
    }, requestId);
  }

  public logUploadProgress(requestId: string, progress: number): void {
    this.info('upload', `📊 Upload progress: ${progress}%`, { progress }, requestId);
  }

  public logUploadSuccess(requestId: string, fileName: string, duration: number): void {
    this.success('upload', `✅ File uploaded successfully`, {
      fileName
    }, requestId, duration);
  }

  public logUploadError(requestId: string, error: string, duration: number): void {
    this.error('upload', `❌ Upload failed`, { error }, requestId, { duration });
  }

  // Helper methods for processing logging
  public logProcessingStart(requestId: string, stage: string, metadata?: Record<string, any>): void {
    this.info('processing', `🔄 Starting ${stage}`, metadata, requestId);
  }

  public logProcessingComplete(requestId: string, stage: string, duration: number, metadata?: Record<string, any>): void {
    this.success('processing', `✅ ${stage} completed`, metadata, requestId, duration);
  }

  public logProcessingError(requestId: string, stage: string, error: string, duration: number): void {
    this.error('processing', `❌ ${stage} failed`, { error }, requestId, { duration });
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const aiLogger = AILoggerService.getInstance();
export default aiLogger;
