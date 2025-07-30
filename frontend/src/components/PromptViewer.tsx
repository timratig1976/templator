import React, { useState, useEffect } from 'react';
import { Tabs, Tab } from '@mui/material';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { fetchPromptAndResultData } from '../services/apiService';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface PromptData {
  content: string;
  model: string;
  temperature: number;
  tokenCount: number;
  createdAt: string;
  promptType: string;
}

interface GeneratedHTML {
  content: string;
  generationTime: number;
  qualityScore: number;
  section: string;
}

interface PromptAndResultData {
  prompt: PromptData | null;
  result: GeneratedHTML | null;
  metrics?: {
    semanticsScore: number;
    tailwindScore: number;
    accessibilityScore: number;
    responsiveScore: number;
  };
  issues?: Array<{
    severity: string;
    category: string;
    message: string;
  }>;
}

interface PromptViewerProps {
  pipelineId: string;
  sectionId?: string;
}

export const PromptViewer: React.FC<PromptViewerProps> = ({ pipelineId, sectionId }) => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PromptAndResultData>({
    prompt: null,
    result: null,
  });
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const resultData = await fetchPromptAndResultData(pipelineId, sectionId);
        setData(resultData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load prompt data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [pipelineId, sectionId]);
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return <LoadingSpinner message="Loading prompt data..." />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="prompt-viewer bg-white rounded-lg shadow-lg overflow-hidden">
      <Tabs 
        value={tabValue} 
        onChange={handleTabChange}
        variant="fullWidth"
        className="border-b border-gray-200"
      >
        <Tab label="Prompt" />
        <Tab label="Generated HTML" />
        <Tab label="Quality Metrics" />
      </Tabs>
      
      <div className="p-4">
        {tabValue === 0 && (
          <div className="prompt-tab">
            <div className="prompt-metadata mb-4 grid grid-cols-2 gap-4 text-sm">
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-semibold">Model:</span> {data.prompt?.model || 'N/A'}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-semibold">Temperature:</span> {data.prompt?.temperature || 'N/A'}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-semibold">Token Count:</span> {data.prompt?.tokenCount || 'N/A'}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-semibold">Created:</span> {
                  data.prompt?.createdAt 
                    ? new Date(data.prompt.createdAt).toLocaleString() 
                    : 'N/A'
                }
              </div>
            </div>
            
            <div className="prompt-content overflow-auto max-h-[500px]">
              <SyntaxHighlighter 
                language="markdown" 
                style={atomOneDark}
                showLineNumbers
                customStyle={{ borderRadius: '4px' }}
              >
                {data.prompt?.content || 'No prompt data available'}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
        
        {tabValue === 1 && (
          <div className="result-tab">
            <div className="result-metadata mb-4 grid grid-cols-3 gap-4 text-sm">
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-semibold">Generation Time:</span> {data.result?.generationTime || 'N/A'}ms
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-semibold">Quality Score:</span> {data.result?.qualityScore || 'N/A'}/100
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-semibold">Section:</span> {data.result?.section || 'N/A'}
              </div>
            </div>
            
            <div className="result-content overflow-auto max-h-[500px]">
              <SyntaxHighlighter 
                language="html" 
                style={atomOneDark}
                showLineNumbers
                customStyle={{ borderRadius: '4px' }}
              >
                {data.result?.content || 'No HTML result available'}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
        
        {tabValue === 2 && (
          <div className="metrics-tab">
            <div className="metrics-overview mb-6">
              <h3 className="text-lg font-semibold mb-3">Quality Metrics</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {data.metrics ? (
                  <>
                    <MetricCard 
                      title="Semantics" 
                      score={data.metrics.semanticsScore} 
                      description="HTML structure and semantic elements"
                    />
                    <MetricCard 
                      title="Tailwind" 
                      score={data.metrics.tailwindScore} 
                      description="Tailwind CSS implementation quality"
                    />
                    <MetricCard 
                      title="Accessibility" 
                      score={data.metrics.accessibilityScore} 
                      description="Screen reader and keyboard accessibility"
                    />
                    <MetricCard 
                      title="Responsive" 
                      score={data.metrics.responsiveScore} 
                      description="Behavior across device sizes"
                    />
                  </>
                ) : (
                  <div className="col-span-4 text-center py-4 bg-gray-50 rounded">
                    No quality metrics available for this generation
                  </div>
                )}
              </div>
            </div>
            
            <div className="issues-list">
              <h3 className="text-lg font-semibold mb-3">Identified Issues</h3>
              
              {data.issues && data.issues.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {data.issues.map((issue, index) => (
                    <div key={index} className={`py-3 ${getIssueSeverityClass(issue.severity)}`}>
                      <div className="flex items-start">
                        <span className={`inline-block w-2 h-2 rounded-full mt-1.5 mr-2 ${getIssueDotClass(issue.severity)}`}></span>
                        <div>
                          <p className="font-medium">{issue.message}</p>
                          <p className="text-sm text-gray-600">
                            <span className="capitalize">{issue.category}</span>
                            {' • '}
                            <span className="capitalize">{issue.severity}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 bg-gray-50 rounded">
                  No issues detected
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  score: number;
  description: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, score, description }) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <div className="bg-gray-50 p-3 rounded">
      <div className="flex justify-between items-center mb-1">
        <h4 className="font-medium">{title}</h4>
        <span className={`text-lg font-bold ${getScoreColor(score)}`}>{score}</span>
      </div>
      <p className="text-xs text-gray-600">{description}</p>
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
