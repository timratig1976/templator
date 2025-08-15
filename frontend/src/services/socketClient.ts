'use client';

import { io, Socket } from 'socket.io-client';
import { aiLogger } from './aiLogger';

// Guards to avoid connecting during SSR/build
const isBrowser = typeof window !== 'undefined';
const socketsDisabled = process.env.NEXT_PUBLIC_DISABLE_SOCKETS === '1';
const socketsEnabled = isBrowser && !socketsDisabled;

class SocketClientService {
  private static instance: SocketClientService;
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private connecting = false;

  public static getInstance(): SocketClientService {
    // Persist across HMR by stashing on globalThis
    const g = globalThis as any;
    if (!g.__templatorSocketClient) {
      g.__templatorSocketClient = new SocketClientService();
    }
    return g.__templatorSocketClient as SocketClientService;
  }

  private constructor() {
    // Lazy connect: do not connect on import/constructor to avoid duplicate connects/HMR
    if (!socketsEnabled) {
      aiLogger.info('system', 'Socket disabled (SSR/build or env flag)');
    }
    // Optionally auto-init after window load to avoid startup race
    if (socketsEnabled && typeof window !== 'undefined') {
      window.addEventListener('load', () => this.ensureConnected());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.ensureConnected();
      });
    }
  }

  private ensureConnected(): void {
    if (!socketsEnabled) return;
    if (this.isConnected || this.socket || this.connecting) return;
    this.connect();
  }

  private connect(): void {
    try {
      // Connect to backend Socket.IO server
      const backendUrl = (typeof window !== 'undefined' && (window as any).NEXT_PUBLIC_BACKEND_URL)
        || process.env.NEXT_PUBLIC_BACKEND_URL
        || 'http://localhost:3009';

      // Probe backend health first to avoid immediate connection refused
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      fetch(`${backendUrl}/health`, { signal: controller.signal })
        .then(() => {
          clearTimeout(timeoutId);
          this.openSocket(backendUrl);
        })
        .catch(() => {
          clearTimeout(timeoutId);
          // Backend not ready; retry later via ensureConnected
          this.connecting = false;
          setTimeout(() => this.ensureConnected(), 1500);
        });

    } catch (error) {
      console.error('Failed to create socket connection:', error);
      aiLogger.error('system', 'Failed to create socket connection', { error });
      this.connecting = false;
    }
  }

  private openSocket(backendUrl: string): void {
    try {
      this.connecting = true;
      this.socket = io(backendUrl, {
        // Allow both transports and attempt upgrade for resilience
        transports: ['websocket', 'polling'],
        // Explicit Socket.IO path
        path: '/socket.io',
        withCredentials: true,
        timeout: 20000,
        forceNew: false,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        upgrade: true,
        rememberUpgrade: true
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to open socket:', error);
      aiLogger.error('system', 'Failed to open socket', { error });
      this.connecting = false;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.connecting = false;
      this.reconnectAttempts = 0;
      console.log('✅ Socket.IO connected to backend');
      aiLogger.success('system', 'Real-time log streaming connected', {
        socketId: this.socket?.id
      });
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.connecting = false;
      console.log('❌ Socket.IO disconnected:', reason);
      aiLogger.warning('system', 'Real-time log streaming disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      this.isConnected = false;
      this.connecting = false;
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
      this.connecting = false;
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
    this.ensureConnected();
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      aiLogger.warning('system', 'Cannot emit event - socket not connected', { event, data });
    }
  }

  // Add event listener to socket
  public on(event: string, listener: (...args: any[]) => void): void {
    this.ensureConnected();
    if (this.socket) {
      this.socket.on(event, listener);
    }
  }

  // Remove event listener from socket
  public off(event: string, listener?: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, listener);
    }
  }
}

export const socketClient = SocketClientService.getInstance();
export default socketClient;
