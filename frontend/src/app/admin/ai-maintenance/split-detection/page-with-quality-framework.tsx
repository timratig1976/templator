// Example: Split Detection Page with Modular AI Quality Framework
'use client';

import React, { useState, useEffect } from 'react';
import { FolderIcon } from '@heroicons/react/24/outline';
import PromptEditor from '@/components/admin/PromptEditor';
import StaticFileManager from '@/components/admin/StaticFileManager';
import AIQualityFramework from '@/components/ai-quality/AIQualityFramework';
import { AI_QUALITY_TASKS } from '@/config/aiQualityTasks';

interface TestResult {
  id: string;
  timestamp: string;
  fileName: string;
  sectionsDetected: number;
  averageConfidence: number;
  processingTime: number;
  accuracy: number;
  sections: any[];
}

export default function SplitDetectionWithQualityFramework() {
  // State management
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [showFileManager, setShowFileManager] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentResult, setCurrentResult] = useState<TestResult | null>(null);
  const [isTestingPrompt, setIsTestingPrompt] = useState(false);

  // Get the split detection task configuration
  const taskConfig = AI_QUALITY_TASKS.SPLIT_DETECTION;

  // Load initial prompt
  useEffect(() => {
    const loadInitialPrompt = async () => {
      try {
        const response = await fetch(`/api/ai-quality/tasks/${taskConfig.id}/prompts/active`);
        if (response.ok) {
          const prompt = await response.json();
          setCurrentPrompt(prompt?.content || taskConfig.defaultPrompt || '');
        } else {
          setCurrentPrompt(taskConfig.defaultPrompt || '');
        }
      } catch (error) {
        console.error('Failed to load initial prompt:', error);
        setCurrentPrompt(taskConfig.defaultPrompt || '');
      }
    };

    loadInitialPrompt();
  }, [taskConfig.id]);

  // File conversion helper
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Test prompt function
  const handleTestPrompt = async (prompt: string, testData?: any) => {
    if (!selectedFile || !prompt.trim()) {
      alert('Please select a test file and ensure the prompt is not empty');
      return;
    }

    setIsTestingPrompt(true);
    
    try {
      // Convert file to base64
      const base64 = await fileToBase64(selectedFile);
      
      // Call the AI service
      const response = await fetch(`http://localhost:3009${taskConfig.apiEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          prompt: prompt
        }),
      });

      const rawResponseText = await response.text();
      const data = JSON.parse(rawResponseText);
      
      // Create test result
      const result: TestResult = {
        id: `test_${Date.now()}`,
        timestamp: new Date().toISOString(),
        fileName: selectedFile.name,
        sectionsDetected: data.sections?.length || 0,
        averageConfidence: data.sections?.reduce((acc: number, s: any) => acc + (s.aiConfidence || 0), 0) / (data.sections?.length || 1),
        processingTime: data.processingTime || 0,
        accuracy: data.accuracy || 0,
        sections: data.sections || []
      };

      // Record test execution in the quality system
      await fetch(`http://localhost:3009/api/ai-quality/${taskConfig.id}/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptId: 'current', // You'd get this from the active prompt
          testType: 'manual',
          inputData: { image: base64, prompt },
          aiOutput: data,
          executionTimeMs: data.processingTime || 0,
          tokensUsed: data.tokensUsed,
          costUsd: data.costUsd
        })
      });

      setTestResults(prev => [result, ...prev.slice(0, 9)]);
      setCurrentResult(result);
      
      return data;
    } catch (error) {
      console.error('Failed to test prompt:', error);
      alert('Failed to test prompt. Please try again.');
      throw error;
    } finally {
      setIsTestingPrompt(false);
    }
  };

  // Save prompt version
  const handleSavePromptVersion = async (version: string, description: string) => {
    try {
      await fetch(`http://localhost:3009/api/ai-quality/tasks/${taskConfig.id}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version,
          content: currentPrompt,
          description,
          isActive: true
        })
      });
      
      alert('Prompt version saved successfully!');
    } catch (error) {
      console.error('Failed to save prompt version:', error);
      alert('Failed to save prompt version');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Split Detection</h1>
              <p className="text-gray-600 mt-2">Optimize and validate AI-powered layout section detection</p>
            </div>
            <button
              onClick={() => setShowFileManager(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FolderIcon className="h-4 w-4 mr-2" />
              Manage Files
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Prompt Editor */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Prompt Editor</h2>
              </div>
              <div className="p-6">
                <PromptEditor
                  value={currentPrompt}
                  onChange={setCurrentPrompt}
                  onTest={() => handleTestPrompt(currentPrompt)}
                  isLoading={isTestingPrompt}
                />
              </div>
            </div>

            {/* AI Quality Framework Integration */}
            <AIQualityFramework
              taskConfig={taskConfig}
              currentPrompt={currentPrompt}
              onPromptChange={setCurrentPrompt}
              onTest={(prompt: string, testData?: any) => handleTestPrompt(prompt, testData)}
              className="shadow-lg"
            />
          </div>

          {/* Right Column: Live Preview */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Live Preview</h2>
                  {selectedFile && (
                    <p className="text-sm text-gray-600 mt-1">
                      Testing: {selectedFile.name}
                    </p>
                  )}
                </div>
                {currentResult && (
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                      {currentResult.sectionsDetected} sections
                    </span>
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      {(currentResult.averageConfidence * 100).toFixed(0)}% confidence
                    </span>
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                      {currentResult.processingTime}ms
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6">
              {currentResult ? (
                <div className="space-y-6">
                  {/* Results Summary */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Split Simulation Results</h3>

                    {/* Detected Sections */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700">Detected Sections</h4>
                      {currentResult.sections.map((section, index) => (
                        <div key={index} className="bg-white p-3 rounded border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <span className="text-sm font-medium text-gray-900">
                                {section.name || section.type}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {section.type}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-green-600">
                              {((section.aiConfidence || 0) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            Bounds: {section.bounds?.x || 0}, {section.bounds?.y || 0} - 
                            {section.bounds?.width || 0}x{section.bounds?.height || 0}
                          </div>
                          {section.detectionReason && (
                            <div className="text-xs text-gray-500 mt-1">
                              {section.detectionReason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>Select a file and run a test to see results</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* File Manager Modal */}
        {showFileManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Test File Manager</h3>
                <button
                  onClick={() => setShowFileManager(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <StaticFileManager
                  onFileSelect={(file) => {
                    setSelectedFile(file);
                    setShowFileManager(false);
                  }}
                  selectedFile={selectedFile}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
