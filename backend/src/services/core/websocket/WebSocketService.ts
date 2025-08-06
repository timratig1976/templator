/**
 * WebSocket Service
 * Centralized WebSocket management for real-time communication
 * Handles AI pipeline updates, logging, and user notifications
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createLogger } from '../../../utils/logger';

const logger = createLogger();

export interface WebSocketMessage {
  type: 'log' | 'progress' | 'error' | 'notification' | 'ai_update';
  data: any;
  timestamp: string;
  sessionId?: string;
  userId?: string;
}

export interface ProgressUpdate {
  phase: string;
  progress: number;
  message: string;
  details?: any;
}

export interface LogMessage {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  service: string;
  operation: string;
  data?: any;
}

/**
 * WebSocket Service
 * Manages real-time communication with frontend clients
 */
export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer | null = null;
  private connectedClients: Map<string, any> = new Map();

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private constructor() {}

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HttpServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    
    logger.info('WebSocket service initialized', {
      cors: process.env.FRONTEND_URL || "http://localhost:3000"
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      const clientId = socket.id;
      
      logger.info('Client connected', { clientId });
      
      // Store client connection
      this.connectedClients.set(clientId, {
        socket,
        connectedAt: new Date().toISOString(),
        sessionId: socket.handshake.query.sessionId,
        userId: socket.handshake.query.userId
      });

      // Handle client events
      socket.on('join_session', (sessionId: string) => {
        socket.join(`session_${sessionId}`);
        logger.debug('Client joined session', { clientId, sessionId });
      });

      socket.on('subscribe_logs', (filters: any) => {
        socket.join('logs');
        logger.debug('Client subscribed to logs', { clientId, filters });
      });

      socket.on('subscribe_progress', (pipelineId: string) => {
        socket.join(`progress_${pipelineId}`);
        logger.debug('Client subscribed to progress', { clientId, pipelineId });
      });

      socket.on('disconnect', (reason) => {
        this.connectedClients.delete(clientId);
        logger.info('Client disconnected', { clientId, reason });
      });

      socket.on('error', (error) => {
        logger.error('Socket error', { clientId, error });
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'notification',
        data: { message: 'Connected to Templator backend' },
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.connectedClients.get(clientId);
    if (client && client.socket) {
      client.socket.emit('message', message);
    }
  }

  /**
   * Send message to all clients in a session
   */
  sendToSession(sessionId: string, message: WebSocketMessage): void {
    if (this.io) {
      this.io.to(`session_${sessionId}`).emit('message', message);
    }
  }

  /**
   * Send message to all connected clients
   */
  broadcast(message: WebSocketMessage): void {
    if (this.io) {
      this.io.emit('message', message);
    }
  }

  /**
   * Send progress update
   */
  sendProgress(pipelineId: string, progress: ProgressUpdate): void {
    const message: WebSocketMessage = {
      type: 'progress',
      data: progress,
      timestamp: new Date().toISOString()
    };

    if (this.io) {
      this.io.to(`progress_${pipelineId}`).emit('progress', message);
    }

    logger.debug('Progress update sent', { pipelineId, progress: progress.progress });
  }

  /**
   * Send log message
   */
  sendLog(logMessage: LogMessage, sessionId?: string): void {
    const message: WebSocketMessage = {
      type: 'log',
      data: logMessage,
      timestamp: new Date().toISOString(),
      sessionId
    };

    if (sessionId) {
      this.sendToSession(sessionId, message);
    } else if (this.io) {
      this.io.to('logs').emit('log', message);
    }
  }

  /**
   * Send error notification
   */
  sendError(error: string, details?: any, sessionId?: string): void {
    const message: WebSocketMessage = {
      type: 'error',
      data: { error, details },
      timestamp: new Date().toISOString(),
      sessionId
    };

    if (sessionId) {
      this.sendToSession(sessionId, message);
    } else {
      this.broadcast(message);
    }

    logger.error('Error sent via WebSocket', { error, details, sessionId });
  }

  /**
   * Send AI update notification
   */
  sendAIUpdate(update: {
    phase: string;
    status: 'started' | 'completed' | 'failed';
    data?: any;
  }, sessionId?: string): void {
    const message: WebSocketMessage = {
      type: 'ai_update',
      data: update,
      timestamp: new Date().toISOString(),
      sessionId
    };

    if (sessionId) {
      this.sendToSession(sessionId, message);
    } else {
      this.broadcast(message);
    }

    logger.info('AI update sent', { phase: update.phase, status: update.status });
  }

  /**
   * Send notification
   */
  sendNotification(notification: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }, sessionId?: string): void {
    const message: WebSocketMessage = {
      type: 'notification',
      data: notification,
      timestamp: new Date().toISOString(),
      sessionId
    };

    if (sessionId) {
      this.sendToSession(sessionId, message);
    } else {
      this.broadcast(message);
    }
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get client information
   */
  getClientInfo(clientId: string): any {
    const client = this.connectedClients.get(clientId);
    if (client) {
      return {
        clientId,
        connectedAt: client.connectedAt,
        sessionId: client.sessionId,
        userId: client.userId
      };
    }
    return null;
  }

  /**
   * Get all connected clients
   */
  getAllClients(): any[] {
    return Array.from(this.connectedClients.entries()).map(([clientId, client]) => ({
      clientId,
      connectedAt: client.connectedAt,
      sessionId: client.sessionId,
      userId: client.userId
    }));
  }

  /**
   * Disconnect client
   */
  disconnectClient(clientId: string, reason?: string): void {
    const client = this.connectedClients.get(clientId);
    if (client && client.socket) {
      client.socket.disconnect(true);
      this.connectedClients.delete(clientId);
      logger.info('Client forcibly disconnected', { clientId, reason });
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.io !== null;
  }

  /**
   * Get WebSocket server instance
   */
  getServer(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Shutdown WebSocket service
   */
  shutdown(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
      this.connectedClients.clear();
      logger.info('WebSocket service shutdown');
    }
  }
}

export default WebSocketService.getInstance();
