import express from 'express';
import { createLogger } from '../utils/logger';
import { AILogService } from '../services/logging/AILogService';

const router = express.Router();
const logger = createLogger();

// Store for SSE connections
const sseConnections = new Set<express.Response>();

// Log entry interface matching frontend
interface LogEntry {
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

// In-memory log store (in production, you might want to use Redis or similar)
const logStore: LogEntry[] = [];
const MAX_LOGS = 1000;

// Function to broadcast log to all connected clients
export const broadcastLog = (logEntry: LogEntry) => {
  // Add to log store
  logStore.push(logEntry);
  
  // Keep only the last MAX_LOGS entries
  if (logStore.length > MAX_LOGS) {
    logStore.splice(0, logStore.length - MAX_LOGS);
  }

  // Broadcast to all SSE connections
  const message = `data: ${JSON.stringify(logEntry)}\n\n`;
  sseConnections.forEach(res => {
    try {
      res.write(message);
    } catch (error) {
      // Remove dead connections
      sseConnections.delete(res);
    }
  });
};

// Helper function to create and broadcast log entries
export const logToFrontend = (
  level: LogEntry['level'],
  category: LogEntry['category'],
  message: string,
  details?: any,
  requestId?: string,
  duration?: number,
  metadata?: Record<string, any>
) => {
  const logEntry: LogEntry = {
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

  // Log to backend logger as well
  const logMessage = `[${category.toUpperCase()}] ${message}`;
  switch (level) {
    case 'error':
      logger.error(logMessage, { details, requestId, duration, metadata });
      break;
    case 'warning':
      logger.warn(logMessage, { details, requestId, duration, metadata });
      break;
    case 'success':
    case 'info':
    default:
      logger.info(logMessage, { details, requestId, duration, metadata });
  }

  broadcastLog(logEntry);

  // Persist to DB asynchronously (best-effort)
  AILogService.insert({
    timestamp: new Date(logEntry.timestamp),
    level: logEntry.level,
    category: logEntry.category,
    message: logEntry.message,
    requestId: logEntry.requestId ?? null,
    durationMs: logEntry.duration ?? null,
    input: logEntry.details?.input ?? null,
    output: logEntry.details?.output ?? null,
    rag: logEntry.details?.rag ?? null,
    error: logEntry.details?.error || logEntry.metadata?.error || null,
    meta: { ...logEntry.metadata, details: logEntry.details },
  }).catch(() => {
    // ignore
  });
};

// SSE endpoint for real-time log streaming
router.get('/stream', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Add connection to the set
  sseConnections.add(res);

  // Send initial connection message
  const welcomeLog: LogEntry = {
    id: `welcome_${Date.now()}`,
    timestamp: new Date().toISOString(),
    level: 'info',
    category: 'system',
    message: '🔗 Connected to real-time AI logs',
    metadata: { connectionId: req.ip }
  };
  res.write(`data: ${JSON.stringify(welcomeLog)}\n\n`);

  // Send recent logs
  logStore.slice(-10).forEach(log => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  });

  // Handle client disconnect
  req.on('close', () => {
    sseConnections.delete(res);
    logger.info('SSE client disconnected', { ip: req.ip });
  });

  req.on('error', () => {
    sseConnections.delete(res);
  });
});

// Get all logs (REST endpoint)
router.get('/', (req, res) => {
  const { level, category, limit = 100, offset = 0 } = req.query;
  
  let filteredLogs = [...logStore];

  // Filter by level
  if (level && typeof level === 'string') {
    filteredLogs = filteredLogs.filter(log => log.level === level);
  }

  // Filter by category
  if (category && typeof category === 'string') {
    filteredLogs = filteredLogs.filter(log => log.category === category);
  }

  // Apply pagination
  const startIndex = parseInt(offset as string) || 0;
  const limitNum = Math.min(parseInt(limit as string) || 100, 1000);
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + limitNum);

  res.json({
    success: true,
    data: {
      logs: paginatedLogs,
      total: filteredLogs.length,
      offset: startIndex,
      limit: limitNum
    }
  });
});

// Clear logs
router.delete('/', (req, res) => {
  logStore.length = 0;
  
  const clearLog: LogEntry = {
    id: `clear_${Date.now()}`,
    timestamp: new Date().toISOString(),
    level: 'info',
    category: 'system',
    message: '🗑️ Logs cleared',
    metadata: { clearedBy: req.ip }
  };
  
  broadcastLog(clearLog);
  
  res.json({
    success: true,
    message: 'Logs cleared successfully'
  });
});

// Export logs
router.get('/export', (req, res) => {
  const { format = 'json' } = req.query;
  const timestamp = new Date().toISOString().split('T')[0];
  
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ai-logs-${timestamp}.json"`);
    res.json(logStore);
  } else if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ai-logs-${timestamp}.csv"`);
    
    // Convert to CSV
    const csvHeader = 'timestamp,level,category,message,requestId,duration\n';
    const csvRows = logStore.map(log => 
      `"${log.timestamp}","${log.level}","${log.category}","${log.message}","${log.requestId || ''}","${log.duration || ''}"`
    ).join('\n');
    
    res.send(csvHeader + csvRows);
  } else {
    res.status(400).json({
      success: false,
      error: 'Unsupported format. Use json or csv.'
    });
  }
});

export default router;
