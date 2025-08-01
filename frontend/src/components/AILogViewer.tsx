'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Download, 
  Trash2, 
  Filter, 
  Search, 
  ChevronDown, 
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Zap,
  Upload,
  Cpu,
  Globe,
  Settings
} from 'lucide-react';

import { aiLogger, AILogEntry } from '../services/aiLogger';

interface AILogViewerProps {
  className?: string;
  maxHeight?: string;
  showFilters?: boolean;
  autoScroll?: boolean;
}

const categoryIcons = {
  openai: Zap || Terminal,
  upload: Upload || Terminal,
  processing: Cpu || Terminal,
  network: Globe || Terminal,
  system: Settings || Terminal
};

const levelColors = {
  info: 'text-blue-600 bg-blue-50',
  success: 'text-green-600 bg-green-50',
  warning: 'text-yellow-600 bg-yellow-50',
  error: 'text-red-600 bg-red-50'
};

const levelIcons = {
  info: Info || Terminal,
  success: CheckCircle || Terminal,
  warning: AlertTriangle || Terminal,
  error: AlertCircle || Terminal
};

export default function AILogViewer({ 
  className = '', 
  maxHeight = '400px',
  showFilters = true,
  autoScroll = true
}: AILogViewerProps) {
  const [logs, setLogs] = useState<AILogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AILogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get initial logs
    setLogs(aiLogger.getLogs());

    // Subscribe to new logs
    const unsubscribe = aiLogger.subscribe((newLog: AILogEntry) => {
      setLogs(prevLogs => [...prevLogs, newLog]);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Filter logs based on selected filters and search term
    let filtered = logs;

    if (selectedLevel !== 'all') {
      filtered = filtered.filter(log => log.level === selectedLevel);
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(log => log.category === selectedCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(term) ||
        log.requestId?.toLowerCase().includes(term) ||
        JSON.stringify(log.details).toLowerCase().includes(term)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, selectedLevel, selectedCategory, searchTerm]);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const clearLogs = () => {
    aiLogger.clearLogs();
    setLogs([]);
    setExpandedLogs(new Set());
  };

  const exportLogs = () => {
    const logsData = aiLogger.exportLogs();
    const blob = new Blob([logsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const renderLogDetails = (log: AILogEntry) => {
    if (!log.details && !log.metadata && !log.duration) return null;

    const details = {
      ...(log.details || {}),
      ...(log.metadata || {}),
      ...(log.duration ? { duration: formatDuration(log.duration) } : {})
    };

    return (
      <div className="mt-2 p-3 bg-gray-50 rounded-lg border-l-4 border-gray-300">
        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
          {JSON.stringify(details, null, 2)}
        </pre>
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-900">AI Process Logs</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              {logs.length}
            </span>
          </div>
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-gray-600" />
          <span className="font-medium text-gray-900">AI Process Logs</span>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
            {filteredLogs.length}/{logs.length}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={exportLogs}
            className="p-1 hover:bg-gray-100 rounded"
            title="Export logs"
          >
            <Download className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={clearLogs}
            className="p-1 hover:bg-gray-100 rounded"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex-1 min-w-48">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Level Filter */}
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="openai">OpenAI</option>
              <option value="upload">Upload</option>
              <option value="processing">Processing</option>
              <option value="network">Network</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>
      )}

      {/* Logs Container */}
      <div 
        ref={logContainerRef}
        className="overflow-y-auto font-mono text-sm"
        style={{ maxHeight }}
      >
        {filteredLogs.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Terminal className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No logs to display</p>
            {(selectedLevel !== 'all' || selectedCategory !== 'all' || searchTerm) && (
              <p className="text-xs mt-1">Try adjusting your filters</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map((log) => {
              const LevelIcon = levelIcons[log.level];
              const CategoryIcon = categoryIcons[log.category];
              const isExpanded = expandedLogs.has(log.id);
              const hasDetails = log.details || log.metadata || log.duration;

              return (
                <div key={log.id} className="p-3 hover:bg-gray-50">
                  <div 
                    className={`flex items-start space-x-3 ${hasDetails ? 'cursor-pointer' : ''}`}
                    onClick={() => hasDetails && toggleLogExpansion(log.id)}
                  >
                    {/* Timestamp */}
                    <div className="flex items-center space-x-1 text-xs text-gray-500 min-w-20">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(log.timestamp)}</span>
                    </div>

                    {/* Level Badge */}
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${levelColors[log.level]}`}>
                      <LevelIcon className="w-3 h-3" />
                      <span className="uppercase">{log.level}</span>
                    </div>

                    {/* Category Badge */}
                    <div className="flex items-center space-x-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                      <CategoryIcon className="w-3 h-3" />
                      <span>{log.category}</span>
                    </div>

                    {/* Message */}
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 break-words">{log.message}</p>
                      {log.requestId && (
                        <p className="text-xs text-gray-500 mt-1">
                          Request ID: {log.requestId}
                        </p>
                      )}
                      {log.duration && (
                        <p className="text-xs text-gray-500 mt-1">
                          Duration: {formatDuration(log.duration)}
                        </p>
                      )}
                    </div>

                    {/* Expand Icon */}
                    {hasDetails && (
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && renderLogDetails(log)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
