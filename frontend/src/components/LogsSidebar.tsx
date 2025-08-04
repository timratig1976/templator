'use client';

import React, { useState, useEffect, useRef } from 'react';
import { aiLogger } from '@/services/aiLogger';
import { socketClient } from '@/services/socketClient';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  category: string;
  message: string;
  data?: any;
  source: 'frontend' | 'backend';
}

export default function LogsSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new logs arrive (if auto-scroll is enabled)
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Set up log listeners
  useEffect(() => {
    // Subscribe to frontend aiLogger events
    const frontendLogListener = (logEntry: any) => {
      const newLog: LogEntry = {
        id: logEntry.id || `frontend-${Date.now()}-${Math.random()}`,
        timestamp: logEntry.timestamp || new Date().toISOString(),
        level: logEntry.level || 'info',
        category: logEntry.category || 'system',
        message: logEntry.message || '',
        data: logEntry.details || logEntry.data,
        source: 'frontend'
      };
      
      setLogs(prev => [...prev.slice(-99), newLog]); // Keep last 100 logs
    };

    // Subscribe to aiLogger and get unsubscribe function
    const unsubscribeFromAiLogger = aiLogger.subscribe(frontendLogListener);

    // Listen to backend logs via Socket.IO
    const handleBackendLog = (logData: any) => {
      const newLog: LogEntry = {
        id: `backend-${Date.now()}-${Math.random()}`,
        timestamp: logData.timestamp || new Date().toISOString(),
        level: logData.level || 'info',
        category: logData.category || 'system',
        message: logData.message || '',
        data: logData.data || logData.details,
        source: 'backend'
      };
      
      setLogs(prev => [...prev.slice(-99), newLog]); // Keep last 100 logs
    };

    const handleOpenAILog = (logData: any) => {
      handleBackendLog({
        ...logData,
        category: 'openai',
        level: 'info'
      });
    };

    const handlePipelineProgress = (data: any) => {
      handleBackendLog({
        level: 'info',
        category: 'processing',
        message: 'Pipeline progress update',
        data,
        timestamp: new Date().toISOString()
      });
    };

    const handlePipelineError = (data: any) => {
      handleBackendLog({
        level: 'error',
        category: 'processing',
        message: 'Pipeline error',
        data,
        timestamp: new Date().toISOString()
      });
    };

    // Set up Socket.IO listeners for backend logs using public methods
    if (typeof window !== 'undefined') {
      const socket = socketClient;
      
      // Listen for log events from backend using public methods
      socket.on('log', handleBackendLog);
      socket.on('openai_log', handleOpenAILog);
      socket.on('pipeline-progress', handlePipelineProgress);
      socket.on('pipeline-error', handlePipelineError);
    }

    return () => {
      // Cleanup listeners
      unsubscribeFromAiLogger();
      
      if (typeof window !== 'undefined') {
        const socket = socketClient;
        socket.off('log', handleBackendLog);
        socket.off('openai_log', handleOpenAILog);
        socket.off('pipeline-progress', handlePipelineProgress);
        socket.off('pipeline-error', handlePipelineError);
      }
    };
  }, []);

  // Filter logs based on current filter
  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'frontend') return log.source === 'frontend';
    if (filter === 'backend') return log.source === 'backend';
    if (filter === 'errors') return log.level === 'error';
    if (filter === 'warnings') return log.level === 'warning';
    return log.level === filter;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'success': return 'text-green-600 bg-green-50';
      case 'info': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };

  const getSourceColor = (source: string) => {
    return source === 'backend' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const logsText = logs.map(log => 
      `[${log.timestamp}] [${log.source.toUpperCase()}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}${log.data ? ' ' + JSON.stringify(log.data) : ''}`
    ).join('\n');
    
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `templator-logs-${new Date().toISOString().slice(0, 19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-4 right-4 z-50 p-3 rounded-full shadow-lg transition-all duration-300 ${
          isOpen ? 'bg-gray-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
        }`}
        title="Toggle Logs Sidebar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {logs.length > 0 && (
          <span className="absolute -top-1 -left-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {logs.length > 99 ? '99+' : logs.length}
          </span>
        )}
      </button>

      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 z-40 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">System Logs</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-1 mb-3">
            {['all', 'frontend', 'backend', 'errors', 'warnings', 'info'].map(filterOption => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  filter === filterOption
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {filterOption}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded"
                />
                <span>Auto-scroll</span>
              </label>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={clearLogs}
                className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                Clear
              </button>
              <button
                onClick={exportLogs}
                className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
              >
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Logs Content */}
        <div className="flex-1 overflow-y-auto p-2 h-full pb-20">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <div className="text-4xl mb-2">📝</div>
              <p>No logs to display</p>
              <p className="text-xs mt-1">Logs will appear here as the system runs</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded text-xs border-l-2 ${getLevelColor(log.level)} ${
                    log.level === 'error' ? 'border-red-500' : 
                    log.level === 'warning' ? 'border-yellow-500' :
                    log.level === 'success' ? 'border-green-500' : 'border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center space-x-1">
                      <span>{getLevelIcon(log.level)}</span>
                      <span className={`px-1 rounded text-xs ${getSourceColor(log.source)}`}>
                        {log.source}
                      </span>
                      <span className="text-gray-600">[{log.category}]</span>
                    </div>
                    <span className="text-gray-500 text-xs">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-gray-800 mb-1">{log.message}</div>
                  {log.data && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                        Data
                      </summary>
                      <pre className="mt-1 p-1 bg-gray-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-20 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
