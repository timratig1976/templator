# ⚡ Performance & Real-time Blueprint
## Caching, WebSockets, Background Jobs & Monitoring

*Comprehensive performance optimization and real-time communication patterns. Includes Redis caching strategies, Socket.IO implementation, background job processing, and monitoring systems.*

---

## 🎯 **Performance Principles**

### **Core Components**
- **Redis Caching**: Multi-layer caching strategies for optimal performance
- **Socket.IO Real-time**: WebSocket communication for live updates
- **Background Jobs**: Asynchronous task processing with queues
- **Performance Monitoring**: APM, metrics collection, and alerting
- **Database Optimization**: Query optimization and connection pooling

### **Performance Standards**
- **Response Times**: API responses <200ms, database queries <50ms
- **Caching Strategy**: 90%+ cache hit rate for frequently accessed data
- **Real-time Latency**: WebSocket messages <100ms round-trip
- **Background Processing**: Job processing <5 seconds for standard tasks
- **Monitoring Coverage**: 100% endpoint monitoring with alerting

---

## 🚀 **Redis Caching System**

### **Multi-Layer Caching Strategy**
```typescript
// src/services/Cache.service.ts
import Redis from 'ioredis';
import { Logger } from './Logger.service';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
  serialize?: boolean;
}

export class CacheService {
  private redis: Redis;
  private logger: Logger;
  private defaultTTL = 3600; // 1 hour

  constructor(redisUrl: string, logger: Logger) {
    this.redis = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
    this.logger = logger;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', { error: error.message });
    });
  }

  // Basic cache operations
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const value = await this.redis.get(fullKey);
      
      if (!value) {
        this.logger.debug('Cache miss', { key: fullKey });
        return null;
      }

      this.logger.debug('Cache hit', { key: fullKey });
      
      if (options?.serialize !== false) {
        return JSON.parse(value);
      }
      
      return value as T;
    } catch (error) {
      this.logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const ttl = options?.ttl || this.defaultTTL;
      
      let serializedValue: string;
      if (options?.serialize !== false) {
        serializedValue = JSON.stringify(value);
      } else {
        serializedValue = value as string;
      }

      await this.redis.setex(fullKey, ttl, serializedValue);
      
      this.logger.debug('Cache set', { key: fullKey, ttl });
      return true;
    } catch (error) {
      this.logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }

  // Advanced caching patterns
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await this.redis.del(...keys);
      this.logger.info('Cache pattern invalidated', { pattern, count: result });
      return result;
    } catch (error) {
      this.logger.error('Cache pattern invalidation error', { pattern, error: error.message });
      return 0;
    }
  }

  private buildKey(key: string, prefix?: string): string {
    const basePrefix = process.env.CACHE_PREFIX || 'templator';
    return prefix ? `${basePrefix}:${prefix}:${key}` : `${basePrefix}:${key}`;
  }
}

// Cache decorators for easy usage
export function Cacheable(options?: CacheOptions) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cache = this.cacheService as CacheService;
      if (!cache) {
        return method.apply(this, args);
      }
      
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      return cache.getOrSet(
        cacheKey,
        () => method.apply(this, args),
        options
      );
    };
  };
}
```

---

## 🔄 **Socket.IO Real-time Communication**

### **WebSocket Service Implementation**
```typescript
// src/services/WebSocket.service.ts
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { Logger } from './Logger.service';

export interface SocketUser {
  id: string;
  role: string;
  name: string;
}

export class WebSocketService {
  private io: SocketIOServer;
  private logger: Logger;
  private connectedUsers = new Map<string, SocketUser>();

  constructor(httpServer: HTTPServer, logger: Logger) {
    this.logger = logger;
    
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user: SocketUser = {
          id: decoded.userId,
          role: decoded.role,
          name: decoded.name
        };

        socket.data.user = user;
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      const user = socket.data.user as SocketUser;
      
      this.logger.info('Socket connected', {
        socketId: socket.id,
        userId: user.id,
        totalConnections: this.io.engine.clientsCount
      });

      // Store user connection
      this.connectedUsers.set(socket.id, user);

      // Join user to their personal room
      socket.join(`user:${user.id}`);

      // Handle room joining
      socket.on('join_room', async (data: { roomId: string; roomType: string }) => {
        const { roomId, roomType } = data;
        
        // Validate room access
        const hasAccess = await this.validateRoomAccess(user, roomId, roomType);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to room' });
          return;
        }

        socket.join(roomId);
        socket.emit('room_joined', { roomId, roomType });
        
        // Notify others in the room
        socket.to(roomId).emit('user_joined_room', {
          userId: user.id,
          userName: user.name
        });
      });

      // Handle real-time messages
      socket.on('send_message', async (data: {
        roomId: string;
        message: string;
        type: 'text' | 'system' | 'notification';
      }) => {
        const { roomId, message, type } = data;
        
        // Validate message
        if (!message || message.length > 1000) {
          socket.emit('error', { message: 'Invalid message' });
          return;
        }

        const messageData = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          roomId,
          userId: user.id,
          userName: user.name,
          message,
          type,
          timestamp: new Date().toISOString()
        };

        // Broadcast to room
        this.io.to(roomId).emit('new_message', messageData);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.logger.info('Socket disconnected', {
          socketId: socket.id,
          userId: user.id,
          reason
        });

        this.connectedUsers.delete(socket.id);
      });
    });
  }

  // Public methods for sending messages from other services
  async sendToUser(userId: string, event: string, data: any): Promise<boolean> {
    try {
      this.io.to(`user:${userId}`).emit(event, data);
      return true;
    } catch (error) {
      this.logger.error('Send to user error', { userId, event, error: error.message });
      return false;
    }
  }

  async sendToRoom(roomId: string, event: string, data: any): Promise<boolean> {
    try {
      this.io.to(roomId).emit(event, data);
      return true;
    } catch (error) {
      this.logger.error('Send to room error', { roomId, event, error: error.message });
      return false;
    }
  }

  // Real-time progress updates for long-running tasks
  async sendProgressUpdate(
    userId: string,
    taskId: string,
    progress: {
      percentage: number;
      stage: string;
      message?: string;
    }
  ): Promise<void> {
    await this.sendToUser(userId, 'task_progress', {
      taskId,
      ...progress,
      timestamp: new Date().toISOString()
    });
  }

  private async validateRoomAccess(
    user: SocketUser,
    roomId: string,
    roomType: string
  ): Promise<boolean> {
    switch (roomType) {
      case 'project':
        return true; // Simplified for example
      case 'admin':
        return user.role === 'admin';
      case 'public':
        return true;
      default:
        return false;
    }
  }
}
```

---

## ⚙️ **Background Job Processing**

### **Job Queue System**
```typescript
// src/services/JobQueue.service.ts
import Bull, { Queue, Job } from 'bull';
import { Logger } from './Logger.service';
import { WebSocketService } from './WebSocket.service';

export interface JobData {
  id: string;
  type: string;
  payload: any;
  userId?: string;
}

export class JobQueueService {
  private queues = new Map<string, Queue>();
  private logger: Logger;
  private webSocket?: WebSocketService;

  constructor(redisUrl: string, logger: Logger, webSocket?: WebSocketService) {
    this.logger = logger;
    this.webSocket = webSocket;
    
    // Initialize queues
    this.createQueue('default', { concurrency: 5 });
    this.createQueue('email', { concurrency: 10 });
    this.createQueue('ai-processing', { concurrency: 2 });
    this.createQueue('file-processing', { concurrency: 3 });
  }

  private createQueue(name: string, options: { concurrency: number }): Queue {
    const queue = new Bull(name, process.env.REDIS_URL!, {
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    // Set up event handlers
    queue.on('completed', (job: Job, result: any) => {
      this.logger.info('Job completed', {
        queueName: name,
        jobId: job.id,
        jobType: job.data.type
      });

      // Send real-time update to user
      if (job.data.userId && this.webSocket) {
        this.webSocket.sendProgressUpdate(job.data.userId, job.data.id, {
          percentage: 100,
          stage: 'completed',
          message: 'Task completed successfully'
        });
      }
    });

    queue.on('failed', (job: Job, error: Error) => {
      this.logger.error('Job failed', {
        queueName: name,
        jobId: job.id,
        error: error.message
      });
    });

    // Set concurrency and processor
    queue.process(options.concurrency, this.processJob.bind(this));
    
    this.queues.set(name, queue);
    return queue;
  }

  async addJob(queueName: string, jobData: JobData): Promise<Job> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(jobData.type, jobData);
    
    this.logger.info('Job added to queue', {
      queueName,
      jobId: job.id,
      jobType: jobData.type
    });

    return job;
  }

  private async processJob(job: Job): Promise<any> {
    const { type, payload } = job.data;

    switch (type) {
      case 'send-email':
        return this.processEmailJob(job, payload);
      case 'ai-analysis':
        return this.processAIJob(job, payload);
      case 'file-processing':
        return this.processFileJob(job, payload);
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  }

  private async processEmailJob(job: Job, payload: any): Promise<any> {
    job.progress(25);
    // Email processing logic
    await new Promise(resolve => setTimeout(resolve, 1000));
    job.progress(100);
    return { emailSent: true };
  }

  private async processAIJob(job: Job, payload: any): Promise<any> {
    job.progress(10);
    // AI processing logic
    await new Promise(resolve => setTimeout(resolve, 2000));
    job.progress(50);
    await new Promise(resolve => setTimeout(resolve, 2000));
    job.progress(100);
    return { analysisComplete: true };
  }

  private async processFileJob(job: Job, payload: any): Promise<any> {
    job.progress(20);
    // File processing logic
    await new Promise(resolve => setTimeout(resolve, 1500));
    job.progress(100);
    return { fileProcessed: true };
  }
}
```

---

## 📊 **Performance Monitoring**

### **Metrics Collection Service**
```typescript
// src/services/Metrics.service.ts
import { Logger } from './Logger.service';
import { CacheService } from './Cache.service';

export interface Metric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  timestamp: Date;
}

export class MetricsService {
  private logger: Logger;
  private cache: CacheService;
  private metrics: Metric[] = [];

  constructor(logger: Logger, cache: CacheService) {
    this.logger = logger;
    this.cache = cache;
    
    // Flush metrics every 30 seconds
    setInterval(() => this.flushMetrics(), 30000);
  }

  // Record different types of metrics
  recordCounter(name: string, value = 1, tags?: Record<string, string>): void {
    this.addMetric({
      name,
      value,
      unit: 'count',
      tags,
      timestamp: new Date()
    });
  }

  recordGauge(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    this.addMetric({
      name,
      value,
      unit,
      tags,
      timestamp: new Date()
    });
  }

  recordTimer(name: string, duration: number, tags?: Record<string, string>): void {
    this.addMetric({
      name,
      value: duration,
      unit: 'ms',
      tags,
      timestamp: new Date()
    });
  }

  // Performance monitoring helpers
  async measureExecutionTime<T>(
    name: string,
    operation: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - start;
      
      this.recordTimer(name, duration, { ...tags, status: 'success' });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      this.recordTimer(name, duration, { ...tags, status: 'error' });
      throw error;
    }
  }

  // API endpoint monitoring
  recordApiRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    userId?: string
  ): void {
    this.recordTimer('api.request.duration', duration, {
      method,
      endpoint,
      status_code: statusCode.toString(),
      user_id: userId
    });

    this.recordCounter('api.request.count', 1, {
      method,
      endpoint,
      status_code: statusCode.toString()
    });
  }

  // Database monitoring
  recordDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    success: boolean
  ): void {
    this.recordTimer('database.query.duration', duration, {
      operation,
      table,
      status: success ? 'success' : 'error'
    });
  }

  // Cache monitoring
  recordCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete',
    key: string,
    duration?: number
  ): void {
    this.recordCounter('cache.operation.count', 1, {
      operation,
      key_prefix: key.split(':')[0]
    });

    if (duration) {
      this.recordTimer('cache.operation.duration', duration, {
        operation,
        key_prefix: key.split(':')[0]
      });
    }
  }

  private addMetric(metric: Metric): void {
    this.metrics.push(metric);
    
    // Log high-value metrics immediately
    if (metric.value > 1000 && metric.unit === 'ms') {
      this.logger.warn('High latency detected', {
        metric: metric.name,
        value: metric.value,
        unit: metric.unit,
        tags: metric.tags
      });
    }
  }

  private async flushMetrics(): Promise<void> {
    if (this.metrics.length === 0) return;

    const metricsToFlush = [...this.metrics];
    this.metrics = [];

    try {
      // Store metrics in cache for dashboard
      await this.cache.set(
        `metrics:${Date.now()}`,
        metricsToFlush,
        { ttl: 86400 } // 24 hours
      );

      // Log aggregated metrics
      this.logger.info('Metrics flushed', {
        count: metricsToFlush.length,
        timestamp: new Date().toISOString()
      });

      // Send to external monitoring service (Prometheus, DataDog, etc.)
      // await this.sendToExternalService(metricsToFlush);
      
    } catch (error) {
      this.logger.error('Metrics flush error', { error: error.message });
      
      // Re-add metrics to queue for retry
      this.metrics.unshift(...metricsToFlush);
    }
  }

  async getMetricsSummary(timeRange: string = '1h'): Promise<{
    apiRequests: number;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
  }> {
    // This would typically query a time-series database
    // For now, return mock data
    return {
      apiRequests: 1250,
      averageResponseTime: 145,
      errorRate: 0.02,
      cacheHitRate: 0.94
    };
  }
}

// Middleware for automatic API monitoring
export const metricsMiddleware = (metricsService: MetricsService) => {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      
      metricsService.recordApiRequest(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration,
        req.user?.id
      );
    });

    next();
  };
};
```

---

## 📋 **Performance & Real-time Checklist**

### **Caching Implementation**
- [ ] Set up Redis with connection pooling
- [ ] Implement multi-layer caching strategy
- [ ] Add cache invalidation patterns
- [ ] Monitor cache hit rates
- [ ] Set up cache warming for critical data

### **Real-time Communication**
- [ ] Configure Socket.IO with authentication
- [ ] Implement room-based messaging
- [ ] Add real-time progress updates
- [ ] Set up connection monitoring
- [ ] Handle reconnection scenarios

### **Background Processing**
- [ ] Set up job queues with Bull
- [ ] Implement job processors for different types
- [ ] Add job monitoring and retry logic
- [ ] Set up real-time job progress updates
- [ ] Configure queue scaling

### **Performance Monitoring**
- [ ] Implement metrics collection
- [ ] Set up API endpoint monitoring
- [ ] Add database query monitoring
- [ ] Configure alerting for performance issues
- [ ] Create performance dashboards

---

*This performance and real-time blueprint provides comprehensive patterns for building high-performance, real-time applications. These implementations ensure optimal user experience through efficient caching, instant updates, and robust background processing.*
