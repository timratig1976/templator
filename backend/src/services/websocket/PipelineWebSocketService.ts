/**
 * Pipeline WebSocket Service
 * Real-time communication for pipeline progress updates
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createLogger } from '../../utils/logger';
import PipelineProgressTracker, { ProgressUpdate } from '../pipeline/PipelineProgressTracker';

const logger = createLogger();

export interface ClientConnection {
  id: string;
  userId?: string;
  subscribedPipelines: Set<string>;
  connectedAt: Date;
  lastActivity: Date;
}

export class PipelineWebSocketService {
  private io: SocketIOServer;
  private progressTracker: PipelineProgressTracker;
  private clients: Map<string, ClientConnection> = new Map();

  constructor(server: HTTPServer, progressTracker: PipelineProgressTracker) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      path: '/api/pipeline/socket'
    });

    this.progressTracker = progressTracker;
    this.setupEventHandlers();
    this.setupProgressTracking();
    this.setupCleanupInterval();

    logger.info('Pipeline WebSocket service initialized');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      const clientId = socket.id;
      const client: ClientConnection = {
        id: clientId,
        subscribedPipelines: new Set(),
        connectedAt: new Date(),
        lastActivity: new Date()
      };

      this.clients.set(clientId, client);

      logger.info('Client connected', { clientId });

      // Handle pipeline subscription
      socket.on('subscribe-pipeline', (pipelineId: string) => {
        client.subscribedPipelines.add(pipelineId);
        client.lastActivity = new Date();
        
        // Send current progress if available
        const progress = this.progressTracker.getProgress(pipelineId);
        if (progress) {
          socket.emit('pipeline-progress', progress);
        }

        logger.debug('Client subscribed to pipeline', { clientId, pipelineId });
      });

      // Handle pipeline unsubscription
      socket.on('unsubscribe-pipeline', (pipelineId: string) => {
        client.subscribedPipelines.delete(pipelineId);
        client.lastActivity = new Date();
        
        logger.debug('Client unsubscribed from pipeline', { clientId, pipelineId });
      });

      // Handle get all active pipelines
      socket.on('get-active-pipelines', () => {
        client.lastActivity = new Date();
        const activePipelines = this.progressTracker.getAllActiveProgresses();
        socket.emit('active-pipelines', activePipelines);
      });

      // Handle client disconnect
      socket.on('disconnect', () => {
        this.clients.delete(clientId);
        logger.info('Client disconnected', { clientId });
      });

      // Handle ping for keepalive
      socket.on('ping', () => {
        client.lastActivity = new Date();
        socket.emit('pong');
      });
    });
  }

  private setupProgressTracking(): void {
    // Listen to progress tracker events
    this.progressTracker.on('progress-update', (update: ProgressUpdate) => {
      this.broadcastToSubscribers(update.pipelineId, 'pipeline-progress', update.data);
    });

    this.progressTracker.on('phase_started', (update: ProgressUpdate) => {
      this.broadcastToSubscribers(update.pipelineId, 'phase-started', {
        pipelineId: update.pipelineId,
        phase: update.data.currentPhase,
        timestamp: update.timestamp
      });
    });

    this.progressTracker.on('phase_completed', (update: ProgressUpdate) => {
      this.broadcastToSubscribers(update.pipelineId, 'phase-completed', {
        pipelineId: update.pipelineId,
        phase: update.data.currentPhase,
        timestamp: update.timestamp
      });
    });

    this.progressTracker.on('pipeline_completed', (update: ProgressUpdate) => {
      this.broadcastToSubscribers(update.pipelineId, 'pipeline-completed', {
        pipelineId: update.pipelineId,
        result: update.data,
        timestamp: update.timestamp
      });
    });

    this.progressTracker.on('pipeline_failed', (update: ProgressUpdate) => {
      this.broadcastToSubscribers(update.pipelineId, 'pipeline-failed', {
        pipelineId: update.pipelineId,
        error: update.data,
        timestamp: update.timestamp
      });
    });
  }

  private broadcastToSubscribers(pipelineId: string, event: string, data: any): void {
    let subscriberCount = 0;

    this.clients.forEach((client, clientId) => {
      if (client.subscribedPipelines.has(pipelineId)) {
        const socket = this.io.sockets.sockets.get(clientId);
        if (socket) {
          socket.emit(event, data);
          subscriberCount++;
        }
      }
    });

    if (subscriberCount > 0) {
      logger.debug('Broadcasted pipeline update', {
        pipelineId,
        event,
        subscriberCount
      });
    }
  }

  private setupCleanupInterval(): void {
    // Clean up inactive clients every 5 minutes
    setInterval(() => {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      
      this.clients.forEach((client, clientId) => {
        if (client.lastActivity.getTime() < fiveMinutesAgo) {
          const socket = this.io.sockets.sockets.get(clientId);
          if (socket) {
            socket.disconnect(true);
          }
          this.clients.delete(clientId);
          logger.debug('Cleaned up inactive client', { clientId });
        }
      });
    }, 5 * 60 * 1000);
  }

  // Public methods for external use
  public getConnectedClients(): ClientConnection[] {
    return Array.from(this.clients.values());
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public broadcastSystemMessage(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    this.io.emit('system-message', {
      message,
      type,
      timestamp: new Date()
    });

    logger.info('Broadcasted system message', { message, type });
  }

  public disconnectClient(clientId: string): boolean {
    const socket = this.io.sockets.sockets.get(clientId);
    if (socket) {
      socket.disconnect(true);
      return true;
    }
    return false;
  }

  public getProgressTracker(): PipelineProgressTracker {
    return this.progressTracker;
  }
}

export default PipelineWebSocketService;
