'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  DocumentTextIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { Undo2, Redo2, Zap } from 'lucide-react';

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  onTest: () => void;
  isLoading?: boolean;
}

export default function PromptEditor({ value, onChange, onTest, isLoading = false }: PromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [history, setHistory] = useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Save to history when value changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (value !== history[historyIndex]) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(value);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [value, history, historyIndex]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      
      // Set cursor position after the inserted spaces
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <DocumentTextIcon className="h-5 w-5 text-gray-500" />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <div className="relative group">
            <InformationCircleIcon className="h-5 w-5 text-gray-400 cursor-help" />
            <div className="absolute right-0 top-6 w-64 bg-black text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              Use Tab for indentation. Templates available below editor.
            </div>
          </div>
          <button
            onClick={onTest}
            disabled={isLoading || !value.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <Zap className="h-4 w-4 mr-1.5 animate-pulse" />
                Testing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-1.5" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="w-full h-[500px] p-4 border border-gray-300 rounded-md font-mono text-xs resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 leading-relaxed"
            placeholder="Enter your AI prompt here..."
            spellCheck={false}
          />
        </div>



        {/* Prompt Statistics */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Characters:</span>
            <span className="ml-2 font-medium text-gray-900">{value.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Words:</span>
            <span className="ml-2 font-medium text-gray-900">
              {value.trim() ? value.trim().split(/\s+/).length : 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
