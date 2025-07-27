/**
 * Layout Splitting Manager Component
 * Provides UI for splitting large layouts and processing sections sequentially
 */

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Scissors, 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Settings,
  Download,
  Eye,
  AlertTriangle,
  Info,
  Zap,
  BarChart3
} from 'lucide-react';
import layoutSplittingService, {
  LayoutSection,
  SplittingResult,
  ProcessingResult,
  ProcessedSection,
  SplittingOptions,
  ProcessingOptions,
  LayoutAnalysis
} from '../services/layoutSplittingService';

interface LayoutSplittingManagerProps {
  html: string;
  onComplete?: (result: ProcessingResult) => void;
  onSectionComplete?: (section: ProcessedSection) => void;
}

const LayoutSplittingManager: React.FC<LayoutSplittingManagerProps> = ({
  html,
  onComplete,
  onSectionComplete
}) => {
  const [currentStep, setCurrentStep] = useState<'analyze' | 'split' | 'process' | 'complete'>('analyze');
  const [analysis, setAnalysis] = useState<LayoutAnalysis | null>(null);
  const [splittingResult, setSplittingResult] = useState<SplittingResult | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [splittingOptions, setSplittingOptions] = useState<SplittingOptions>({});
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({});
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
    currentSection: number;
    totalSections: number;
  }>({ currentBatch: 0, totalBatches: 0, currentSection: 0, totalSections: 0 });

  useEffect(() => {
    if (html) {
      analyzeLayout();
    }
  }, [html]);

  const analyzeLayout = async () => {
    try {
      setError(null);
      const fileSize = layoutSplittingService.estimateFileSize(html);
      const analysisResult = await layoutSplittingService.analyzeLayout(fileSize);
      setAnalysis(analysisResult);
      
      // Set recommended options
      const recommended = layoutSplittingService.getRecommendedConfiguration(fileSize);
      setSplittingOptions(recommended.splitting);
      setProcessingOptions(recommended.processing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze layout');
    }
  };

  const splitLayout = async () => {
    try {
      setError(null);
      setIsProcessing(true);
      
      const result = await layoutSplittingService.splitLayout(html, splittingOptions);
      setSplittingResult(result);
      
      // Select all sections by default
      setSelectedSections(new Set(result.sections.map(s => s.id)));
      setCurrentStep('split');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to split layout');
    } finally {
      setIsProcessing(false);
    }
  };

  const processLayout = async () => {
    if (!splittingResult) return;

    try {
      setError(null);
      setIsProcessing(true);
      setCurrentStep('process');
      
      // Filter selected sections
      const filteredResult = {
        ...splittingResult,
        sections: splittingResult.sections.filter(s => selectedSections.has(s.id)),
        totalSections: selectedSections.size
      };

      const result = await layoutSplittingService.processSections(filteredResult, processingOptions);
      setProcessingResult(result);
      setCurrentStep('complete');
      
      if (onComplete) {
        onComplete(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process sections');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSectionSelection = (sectionId: string) => {
    const newSelection = new Set(selectedSections);
    if (newSelection.has(sectionId)) {
      newSelection.delete(sectionId);
    } else {
      newSelection.add(sectionId);
    }
    setSelectedSections(newSelection);
  };

  const selectAllSections = () => {
    if (splittingResult) {
      setSelectedSections(new Set(splittingResult.sections.map(s => s.id)));
    }
  };

  const deselectAllSections = () => {
    setSelectedSections(new Set());
  };

  const downloadResult = () => {
    if (processingResult?.combinedModule) {
      const blob = new Blob([JSON.stringify(processingResult.combinedModule, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'combined-module.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const renderAnalysisStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <FileText className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Layout Analysis</h3>
        <p className="text-gray-600">Analyzing your layout to determine the best processing strategy</p>
      </div>

      {analysis && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">File Size</label>
              <p className="text-lg font-semibold">{analysis.fileSizeFormatted}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Complexity</label>
              <p className={`text-lg font-semibold ${layoutSplittingService.getComplexityColor(analysis.complexity)}`}>
                {analysis.complexity}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Estimated Sections</label>
              <p className="text-lg font-semibold">{analysis.estimatedSections}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Processing Time</label>
              <p className="text-lg font-semibold">{analysis.estimatedProcessingTimeFormatted}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-start space-x-3">
              {analysis.shouldSplit ? (
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              )}
              <div>
                <p className="font-medium">{analysis.recommendation}</p>
                <p className="text-sm text-gray-600 mt-1">{analysis.qualityBenefit}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
            >
              <Settings className="w-4 h-4" />
              <span>Advanced Options</span>
            </button>
            
            <button
              onClick={splitLayout}
              disabled={isProcessing}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Scissors className="w-4 h-4" />
              <span>{isProcessing ? 'Splitting...' : 'Split Layout'}</span>
            </button>
          </div>
        </div>
      )}

      {showAdvancedOptions && (
        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <h4 className="font-medium">Splitting Options</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Section Size (bytes)
              </label>
              <input
                type="number"
                value={splittingOptions.maxSectionSize || ''}
                onChange={(e) => setSplittingOptions({
                  ...splittingOptions,
                  maxSectionSize: parseInt(e.target.value) || undefined
                })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="50000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Split Strategy
              </label>
              <select
                value={splittingOptions.splitStrategy || 'hybrid'}
                onChange={(e) => setSplittingOptions({
                  ...splittingOptions,
                  splitStrategy: e.target.value as 'semantic' | 'size' | 'hybrid'
                })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="semantic">Semantic</option>
                <option value="size">Size-based</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
          
          <h4 className="font-medium pt-4">Processing Options</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quality Threshold (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={processingOptions.qualityThreshold || ''}
                onChange={(e) => setProcessingOptions({
                  ...processingOptions,
                  qualityThreshold: parseInt(e.target.value) || undefined
                })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="75"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch Size
              </label>
              <input
                type="number"
                min="1"
                value={processingOptions.batchSize || ''}
                onChange={(e) => setProcessingOptions({
                  ...processingOptions,
                  batchSize: parseInt(e.target.value) || undefined
                })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="3"
              />
            </div>
          </div>
          
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={processingOptions.enableRefinement ?? true}
                onChange={(e) => setProcessingOptions({
                  ...processingOptions,
                  enableRefinement: e.target.checked
                })}
                className="rounded"
              />
              <span className="text-sm">Enable Refinement</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={processingOptions.enableAutoCorrection ?? true}
                onChange={(e) => setProcessingOptions({
                  ...processingOptions,
                  enableAutoCorrection: e.target.checked
                })}
                className="rounded"
              />
              <span className="text-sm">Auto-Correction</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );

  const renderSplitStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Scissors className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Layout Split Complete</h3>
        <p className="text-gray-600">
          Found {splittingResult?.totalSections} sections. Select which ones to process.
        </p>
      </div>

      {splittingResult && (
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="font-medium">
                {selectedSections.size} of {splittingResult.totalSections} sections selected
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={selectAllSections}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllSections}
                  className="text-sm text-gray-600 hover:text-gray-700"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Est. time: {layoutSplittingService.formatTime(splittingResult.estimatedProcessingTime)}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {splittingResult.sections.map((section) => (
              <div
                key={section.id}
                className={`p-4 border-b last:border-b-0 cursor-pointer transition-colors ${
                  selectedSections.has(section.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleSectionSelection(section.id)}
              >
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedSections.has(section.id)}
                    onChange={() => toggleSectionSelection(section.id)}
                    className="mt-1 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">
                        {layoutSplittingService.getSectionTypeIcon(section.type)}
                      </span>
                      <h4 className="font-medium">{section.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        layoutSplittingService.getComplexityColor(section.complexity)
                      } bg-opacity-10`}>
                        {section.complexity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{section.description}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>Type: {section.type}</span>
                      <span>Fields: {section.estimatedFields}</span>
                      <span>Size: {layoutSplittingService.formatFileSize(section.html.length)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t flex justify-between">
            <button
              onClick={() => setCurrentStep('analyze')}
              className="px-4 py-2 text-gray-600 hover:text-gray-700"
            >
              Back to Analysis
            </button>
            <button
              onClick={processLayout}
              disabled={selectedSections.size === 0 || isProcessing}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>{isProcessing ? 'Processing...' : `Process ${selectedSections.size} Sections`}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderProcessStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="relative">
          <Zap className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-pulse" />
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 border-4 border-yellow-200 border-t-yellow-500 rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        <h3 className="text-xl font-semibold mb-2">Processing Sections</h3>
        <p className="text-gray-600">
          AI is generating high-quality HubSpot modules for each section
        </p>
      </div>

      {processingResult && (
        <div className="bg-white rounded-lg border p-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {processingResult.processedSections}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {processingResult.failedSections}
              </div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {processingResult.skippedSections}
              </div>
              <div className="text-sm text-gray-600">Skipped</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                layoutSplittingService.getQualityScoreColor(processingResult.overallQualityScore)
              }`}>
                {processingResult.overallQualityScore}%
              </div>
              <div className="text-sm text-gray-600">Quality Score</div>
            </div>
          </div>

          <div className="space-y-3">
            {processingResult.batches.map((batch) => (
              <div key={batch.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Batch {batch.id}</h4>
                  <span className={`text-sm px-2 py-1 rounded ${
                    layoutSplittingService.getStatusColor(batch.status)
                  } bg-opacity-10`}>
                    {batch.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  {batch.processedSections.map((processedSection) => (
                    <div
                      key={processedSection.section.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div className="flex items-center space-x-2">
                        <span>{layoutSplittingService.getSectionTypeIcon(processedSection.section.type)}</span>
                        <span className="text-sm font-medium">{processedSection.section.title}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`text-sm ${
                          layoutSplittingService.getQualityScoreColor(processedSection.validationResult.score)
                        }`}>
                          {processedSection.validationResult.score}%
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          layoutSplittingService.getStatusColor(processedSection.status)
                        } bg-opacity-10`}>
                          {processedSection.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Processing Complete!</h3>
        <p className="text-gray-600">
          Successfully processed {processingResult?.processedSections} sections with an average quality score of {processingResult?.overallQualityScore}%
        </p>
      </div>

      {processingResult && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Results Summary</h4>
            <div className="flex space-x-2">
              <button
                onClick={downloadResult}
                className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                <span>Download Module</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Total Processing Time</label>
              <p className="text-lg font-semibold">
                {layoutSplittingService.formatTime(processingResult.totalProcessingTime / 1000)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Combined Fields</label>
              <p className="text-lg font-semibold">
                {processingResult.combinedModule?.fields.length || 0}
              </p>
            </div>
          </div>

          {processingResult.combinedModule && (
            <div className="border-t pt-4">
              <h5 className="font-medium mb-2">Generated Module Preview</h5>
              <div className="bg-gray-50 rounded p-3 text-sm">
                <div className="mb-2">
                  <strong>Label:</strong> {processingResult.combinedModule.meta.label}
                </div>
                <div className="mb-2">
                  <strong>Description:</strong> {processingResult.combinedModule.meta.description}
                </div>
                <div>
                  <strong>Content Types:</strong> {processingResult.combinedModule.meta.content_types?.join(', ')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-4">
          {[
            { step: 'analyze', label: 'Analyze', icon: BarChart3 },
            { step: 'split', label: 'Split', icon: Scissors },
            { step: 'process', label: 'Process', icon: Zap },
            { step: 'complete', label: 'Complete', icon: CheckCircle }
          ].map(({ step, label, icon: Icon }, index) => (
            <div key={step} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep === step
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : index < ['analyze', 'split', 'process', 'complete'].indexOf(currentStep)
                  ? 'border-green-500 bg-green-500 text-white'
                  : 'border-gray-300 bg-white text-gray-400'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`ml-2 text-sm font-medium ${
                currentStep === step ? 'text-blue-600' : 'text-gray-600'
              }`}>
                {label}
              </span>
              {index < 3 && (
                <div className={`w-8 h-0.5 mx-4 ${
                  index < ['analyze', 'split', 'process', 'complete'].indexOf(currentStep)
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-800">Error</h4>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      {currentStep === 'analyze' && renderAnalysisStep()}
      {currentStep === 'split' && renderSplitStep()}
      {currentStep === 'process' && renderProcessStep()}
      {currentStep === 'complete' && renderCompleteStep()}
    </div>
  );
};

export default LayoutSplittingManager;
