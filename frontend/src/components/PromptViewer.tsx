import React, { useState, useEffect } from 'react';
import { fetchPromptAndResultData } from '../services/apiService';

interface PromptData {
  content: string;
  metadata: {
    model: string;
    temperature: number;
    maxTokens: number;
    timestamp: string;
  };
}

interface ResultData {
  content: string;
  metadata: {
    tokensUsed: number;
    processingTime: number;
    timestamp: string;
  };
}

interface QualityMetrics {
  score: number;
  breakdown: {
    semanticQuality: number;
    responsiveness: number;
    accessibility: number;
    codeQuality: number;
  };
  suggestions: string[];
}

interface PromptViewerProps {
  promptId?: string;
  resultId?: string;
  onClose?: () => void;
}

const PromptViewer: React.FC<PromptViewerProps> = ({ promptId, resultId, onClose }) => {
  const [activeTab, setActiveTab] = useState<'prompt' | 'result' | 'metrics'>('prompt');
  const [promptData, setPromptData] = useState<PromptData | null>(null);
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!promptId && !resultId) {
        setError('No prompt or result ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await fetchPromptAndResultData(promptId, resultId);
        
        if (data.prompt) setPromptData(data.prompt);
        if (data.result) setResultData(data.result);
        if (data.qualityMetrics) setQualityMetrics(data.qualityMetrics);
        
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [promptId, resultId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {['prompt', 'result', 'metrics'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'prompt' ? 'Prompt' : tab === 'result' ? 'Generated HTML' : 'Quality Metrics'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'prompt' && promptData && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Prompt Content</h3>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                <pre className="whitespace-pre-wrap text-sm">{promptData.content}</pre>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Model:</span>
                <p className="text-gray-900">{promptData.metadata.model}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Temperature:</span>
                <p className="text-gray-900">{promptData.metadata.temperature}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Max Tokens:</span>
                <p className="text-gray-900">{promptData.metadata.maxTokens}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Timestamp:</span>
                <p className="text-gray-900">{new Date(promptData.metadata.timestamp).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'result' && resultData && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Generated HTML</h3>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                <pre className="whitespace-pre-wrap text-sm">{resultData.content}</pre>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Tokens Used:</span>
                <p className="text-gray-900">{resultData.metadata.tokensUsed}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Processing Time:</span>
                <p className="text-gray-900">{resultData.metadata.processingTime}ms</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Generated:</span>
                <p className="text-gray-900">{new Date(resultData.metadata.timestamp).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'metrics' && qualityMetrics && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Quality Score</h3>
              <div className="flex items-center space-x-4">
                <div className="text-3xl font-bold text-green-600">{qualityMetrics.score}%</div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${qualityMetrics.score}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Quality Breakdown</h4>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(qualityMetrics.breakdown).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-medium">{value}%</span>
                  </div>
                ))}
              </div>
            </div>
            
            {qualityMetrics.suggestions.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Improvement Suggestions</h4>
                <ul className="space-y-1">
                  {qualityMetrics.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-gray-700">• {suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Close Button */}
      {onClose && (
        <div className="border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

const getIssueSeverityClass = (severity: string) => {
  switch (severity.toLowerCase()) {
    case 'error': return 'bg-red-50';
    case 'warning': return 'bg-yellow-50';
    default: return '';
  }
};

const getIssueDotClass = (severity: string) => {
  switch (severity.toLowerCase()) {
    case 'error': return 'bg-red-500';
    case 'warning': return 'bg-yellow-500';
    default: return 'bg-blue-500';
  }
};

export default PromptViewer;
