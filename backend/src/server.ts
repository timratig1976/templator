import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
// Prefer backend/.env to avoid drift with root .env when backend needs a specific DB schema
const rootEnvPath = path.resolve(__dirname, '../../.env');
const backendEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  // Default to dotenv default resolution if neither file exists
  dotenv.config();
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createLogger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { validateRequest } from './middleware/unifiedValidation';
import apiRoutes from './routes/api';
import { createApp } from './app';
import { setSocketIO } from './utils/frontendLogger';
import { WebSocketService } from './services/core/websocket/WebSocketService';

const app = createApp();
const PORT = process.env.PORT || 3009;
const logger = createLogger();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const devOrigins = ['http://localhost:3000', 'http://localhost:3001'];
const envOrigins = (process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (envOrigins.length ? envOrigins : ['https://your-domain.com'])
  : (envOrigins.length ? envOrigins : devOrigins);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Body parsing middleware with larger limits for base64 images
app.use(express.json({ 
  limit: '50mb',
  verify: (req: express.Request, res: express.Response, buf: Buffer, encoding: BufferEncoding) => {
    // Only enforce non-empty JSON body for methods that should carry a body
    const method = (req.method || '').toUpperCase()
    const contentType = String(req.headers['content-type'] || '')
    const isJson = contentType.includes('application/json')
    const shouldHaveBody = ['POST', 'PUT', 'PATCH'].includes(method) && isJson
    if (shouldHaveBody && (!buf || buf.length === 0)) {
      throw new Error('Empty JSON request body')
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use(morgan('combined', {
  stream: { write: (message: string) => logger.info(message.trim()) }
}));

// Root endpoint
app.get('/', (req: express.Request, res: express.Response) => {
  res.json({
    name: 'Windsurf Templator API',
    version: '0.1.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api',
      designUpload: '/api/design/upload',
      designRefine: '/api/design/refine',
      moduleGenerate: '/api/module',
      preview: '/api/preview'
    },
    frontend: 'http://localhost:3000',
    documentation: 'Access the frontend at http://localhost:3000 to use the application'
  });
});

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// API routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({ 
    error: 'Not Found',
    code: 'ROUTE_NOT_FOUND',
    path: req.originalUrl 
  });
});

// Create HTTP server and Socket.IO server
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6
});

// Initialize socket connections
io.on('connection', (socket: Socket) => {
  logger.info('Client connected to socket.io', {
    socketId: socket.id,
    clientIP: socket.handshake.address
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected from socket.io', {
      socketId: socket.id
    });
  });
});

// Set socket.io instance in frontendLogger
setSocketIO(io);
// Attach io to central WebSocketService used by other services (e.g., build test)
try {
  WebSocketService.getInstance().setIO(io);
} catch {}

// Start HTTP server
server.listen(PORT, () => {
  logger.info(`Windsurf Backend Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('Socket.IO server initialized for real-time logging');
});

export default app;
