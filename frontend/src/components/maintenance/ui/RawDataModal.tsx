/**
 * Raw Data Modal Component for Maintenance Dashboard
 * Specialized modal for displaying JSON data with copy/download functionality
 */

import React, { useState } from 'react';
import Modal from './Modal';

export interface RawDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any;
  isLoading?: boolean;
}

export const RawDataModal: React.FC<RawDataModalProps> = ({
  isOpen,
  onClose,
  title,
  data,
  isLoading = false
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDownload = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="full">
      <div className="h-[80vh] flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading raw data...</p>
            </div>
          </div>
        ) : data ? (
          <div className="flex flex-col h-full">
            {/* Action Buttons */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleCopy}
                  className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md transition-colors ${
                    copied 
                      ? 'text-green-700 bg-green-100 hover:bg-green-200' 
                      : 'text-gray-700 bg-white hover:bg-gray-50 border-gray-300'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy to Clipboard
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download JSON
                </button>
              </div>
              
              {/* Metadata */}
              {data?.meta && (
                <div className="text-sm text-gray-500">
                  <div className="flex items-center space-x-4">
                    {data.meta.source && (
                      <span><strong>Source:</strong> {data.meta.source}</span>
                    )}
                    {data.meta.methodology && (
                      <span><strong>Method:</strong> {data.meta.methodology}</span>
                    )}
                    {data.meta.dataFreshness && (
                      <span><strong>Freshness:</strong> {data.meta.dataFreshness}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* JSON Content */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full bg-gray-900 flex flex-col">
                {/* JSON Header */}
                <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-400 text-sm font-mono">JSON</span>
                    <span className="text-gray-400 text-xs">•</span>
                    <span className="text-gray-400 text-xs">{JSON.stringify(data).length} characters</span>
                  </div>
                  <div className="text-gray-400 text-xs">
                    Use Ctrl+F to search • Scroll to navigate
                  </div>
                </div>
                
                {/* Scrollable JSON Content */}
                <div className="flex-1 overflow-y-auto overflow-x-auto">
                  <pre className="text-green-400 p-4 text-sm font-mono whitespace-pre leading-relaxed h-full">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-2">📄</div>
              <p>No data available</p>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              {data?.meta && (
                <span>Generated: {new Date(data.meta.generatedAt).toLocaleString()}</span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span>Press ESC to close</span>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default RawDataModal;
