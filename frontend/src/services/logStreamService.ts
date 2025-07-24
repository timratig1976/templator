'use client';

import { API_ENDPOINTS } from '../config/api';
import { AILogEntry, aiLogger } from './aiLogger';

class LogStreamService {
  private static instance: LogStreamService;
  private eventSource: EventSource | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  public static getInstance(): LogStreamService {
    if (!LogStreamService.instance) {
      LogStreamService.instance = new LogStreamService();
    }
    return LogStreamService.instance;
  }

  private constructor() {
    // Auto-connect when service is created
    this.connect();
  }

  public connect(): void {
    if (this.isConnected || this.eventSource) {
      return;
    }

    try {
      aiLogger.info('system', '🔗 Connecting to real-time log stream...');
      
      this.eventSource = new EventSource(API_ENDPOINTS.LOGS_STREAM);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        aiLogger.success('system', '✅ Connected to real-time log stream');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const logEntry: AILogEntry = JSON.parse(event.data);
          
          // Only add logs that don't come from the frontend logger itself
          // to avoid infinite loops
          if (logEntry.category !== 'system' || !logEntry.message.includes('Connected to real-time')) {
            // Add a special marker to indicate this came from backend
            const backendLog: AILogEntry = {
              ...logEntry,
              metadata: {
                ...logEntry.metadata,
                source: 'backend'
              }
            };
            
            // Manually trigger the logger's subscribers without adding to its internal store
            // since this log is already from the backend
            aiLogger.log(
              backendLog.level,
              backendLog.category,
              `[Backend] ${backendLog.message}`,
              backendLog.details,
              backendLog.requestId,
              backendLog.duration,
              backendLog.metadata
            );
          }
        } catch (error) {
          console.error('Error parsing log stream message:', error);
          aiLogger.error('system', 'Failed to parse log stream message', { error });
        }
      };

      this.eventSource.onerror = (error) => {
        this.isConnected = false;
        aiLogger.error('system', '❌ Log stream connection error', { error });
        
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Attempt to reconnect with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          
          aiLogger.warning('system', `🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          setTimeout(() => {
            this.connect();
          }, delay);
        } else {
          aiLogger.error('system', '💔 Max reconnection attempts reached. Log streaming disabled.');
        }
      };

    } catch (error) {
      aiLogger.error('system', 'Failed to establish log stream connection', { error });
    }
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    aiLogger.info('system', '🔌 Disconnected from log stream');
  }

  public isStreamConnected(): boolean {
    return this.isConnected;
  }

  public getConnectionStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }

  public forceReconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    setTimeout(() => this.connect(), 100);
  }
}

export const logStreamService = LogStreamService.getInstance();
export default logStreamService;
