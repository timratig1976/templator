import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createLogger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { validateRequest } from './middleware/validation';
import apiRoutes from './routes/api';
import { createApp } from './app';
import { setSocketIO } from './utils/frontendLogger';

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
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000'],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging middleware
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Root endpoint
app.get('/', (req, res) => {
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
app.get('/health', (req, res) => {
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
app.use('*', (req, res) => {
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
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-domain.com'] 
      : ['http://localhost:3000'],
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
io.on('connection', (socket: any) => {
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

// Start HTTP server
server.listen(PORT, () => {
  logger.info(`Windsurf Backend Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('Socket.IO server initialized for real-time logging');
});

export default app;
