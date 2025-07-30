'use client';

import { io, Socket } from 'socket.io-client';
import { aiLogger } from './aiLogger';

class SocketClientService {
  private static instance: SocketClientService;
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  public static getInstance(): SocketClientService {
    if (!SocketClientService.instance) {
      SocketClientService.instance = new SocketClientService();
    }
    return SocketClientService.instance;
  }

  private constructor() {
    this.connect();
  }

  private connect(): void {
    try {
      // Connect to backend Socket.IO server
      this.socket = io('http://localhost:3009', {
        transports: ['polling', 'websocket'], // Try polling first, then websocket
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        upgrade: true,
        rememberUpgrade: false
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to create socket connection:', error);
      aiLogger.error('system', 'Failed to create socket connection', { error });
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ Socket.IO connected to backend');
      aiLogger.success('system', 'Real-time log streaming connected', {
        socketId: this.socket?.id
      });
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('❌ Socket.IO disconnected:', reason);
      aiLogger.warning('system', 'Real-time log streaming disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      this.isConnected = false;
      this.reconnectAttempts++;
      console.error('❌ Socket.IO connection error:', error);
      aiLogger.error('system', 'Log stream connection error', { 
        error: error.message,
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      });

      // Exponential backoff for reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000); // Max 10 seconds
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.isConnected = true;
      console.log(`✅ Socket.IO reconnected after ${attemptNumber} attempts`);
      aiLogger.success('system', 'Real-time log streaming reconnected', {
        attempts: attemptNumber
      });
      this.reconnectDelay = 1000; // Reset delay
    });

    this.socket.on('reconnect_failed', () => {
      this.isConnected = false;
      console.error('❌ Socket.IO failed to reconnect after maximum attempts');
      aiLogger.error('system', 'Failed to reconnect log stream', {
        maxAttempts: this.maxReconnectAttempts
      });
    });

    // Backend log events
    this.socket.on('log', (logData) => {
      // Receive backend logs and integrate with frontend logger
      aiLogger.log(
        logData.level,
        logData.category || 'system',
        `[Backend] ${logData.message}`,
        logData.data,
        logData.requestId,
        undefined,
        { source: 'backend', ...logData }
      );
    });

    this.socket.on('openai_log', (logData) => {
      // Receive OpenAI-specific logs from backend
      aiLogger.log(
        'info',
        'openai',
        `[Backend OpenAI] ${logData.type}`,
        logData.data,
        logData.requestId,
        undefined,
        { source: 'backend', type: logData.type, ...logData }
      );
    });

    // Pipeline progress events (if available)
    this.socket.on('pipeline-progress', (progressData) => {
      aiLogger.info('processing', 'Pipeline progress update', progressData, progressData.pipelineId);
    });

    this.socket.on('pipeline-error', (errorData) => {
      aiLogger.error('processing', 'Pipeline error', errorData, errorData.pipelineId);
    });
  }

  public getConnectionStatus(): { connected: boolean; socketId?: string } {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id
    };
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      aiLogger.info('system', 'Socket connection manually disconnected');
    }
  }

  public reconnect(): void {
    if (this.socket) {
      this.disconnect();
    }
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.connect();
    aiLogger.info('system', 'Attempting to reconnect socket...');
  }

  // Send events to backend (if needed)
  public emit(event: string, data: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      aiLogger.warning('system', 'Cannot emit event - socket not connected', { event, data });
    }
  }
}

export const socketClient = SocketClientService.getInstance();
export default socketClient;
