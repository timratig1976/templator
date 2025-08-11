'use client';

import React, { useState, useEffect } from 'react';
import { useWorkflow } from '@/contexts/WorkflowContext';
import AIFirstPipelineUI from '@/components/pipeline/AIFirstPipelineUI';
import { aiPipelineService, AIPhaseProgress } from '@/services/aiPipelineService';
import { aiLogger } from '@/services/aiLogger';

/**
 * Unified AI Workflow Component
 * Replaces the legacy 5-step workflow with AI-first approach
 * Integrates the AI-based splitter as the core workflow
 */
export default function UnifiedAIWorkflow() {
  const { 
    currentStep,
    setCurrentStep,
    uploadedImageFile,
    setUploadedImageFile,
    hybridAnalysisResult,
    setHybridAnalysisResult,
    designResult,
    setDesignResult,
    error,
    setError
  } = useWorkflow();

  const [pipelinePhases, setPipelinePhases] = useState<AIPhaseProgress[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize AI-first workflow
  useEffect(() => {
    aiLogger.info('system', 'Unified AI Workflow initialized', { currentStep });
    
    // Set initial step to upload if not set
    if (!currentStep || currentStep === 'preview') {
      setCurrentStep('upload');
    }
  }, []);

  // Handle file upload with AI-first processing
  const handleAIFirstUpload = async (file: File) => {
    try {
      setIsProcessing(true);
      setError(null);
      setUploadedImageFile(file);
      
      aiLogger.info('system', 'Starting AI-first pipeline execution', { 
        fileName: file.name,
        fileSize: file.size 
      });

      // Execute AI-first pipeline (returns splitting suggestions first)
      const splittingResult = await aiPipelineService.executeAIFirstPipeline(
        file,
        {
          onPhaseProgress: (phases) => {
            setPipelinePhases(phases);
            
            // Update workflow step based on current phase
            const currentPhase = phases.find(p => p.status === 'running');
            if (currentPhase) {
              switch (currentPhase.phaseId) {
                case 'upload':
                  setCurrentStep('upload');
                  break;
                case 'section-detection':
                  setCurrentStep('hybrid-split');
                  break;
                case 'ai-analysis':
                  setCurrentStep('hybrid-split');
                  break;
                case 'smart-splitting':
                  setCurrentStep('hybrid-split');
                  break;
                case 'html-generation':
                  setCurrentStep('editor');
                  break;
                case 'module-packaging':
                  setCurrentStep('module');
                  break;
              }
            }
          }
        }
      );

      // Handle splitting suggestions phase - auto-confirm for now
      if (splittingResult.splittingSuggestions) {
        // For now, auto-confirm the splitting suggestions
        // In the future, this could show a UI for user review
        const finalResult = await splittingResult.continueWithAI(splittingResult.splittingSuggestions);
        
        // Set results for downstream components
        if (finalResult.sections) {
          setHybridAnalysisResult({
            sections: finalResult.sections.map(section => ({
              id: section.id,
              name: section.name,
              type: section.type,
              bounds: {
                x: section.bounds?.x || 0,
                y: section.bounds?.y || 0,
                width: section.bounds?.width || 0,
                height: section.bounds?.height || 0
              },
              html: section.html,
              editableFields: section.editableFields,
              aiConfidence: section.aiConfidence || 0.8
            })),
            confidence: finalResult.qualityScore,
            quality: finalResult.qualityScore
          });
        }

        // Convert AIEnhancedPipelineResult to PipelineExecutionResult format
        const compatibleResult = {
          id: `ai_pipeline_${Date.now()}`,
          sections: finalResult.sections || [],
          qualityScore: finalResult.qualityScore || 0.8,
          processingTime: Date.now() - Date.now(), // Will be calculated properly in real implementation
          validationPassed: true,
          enhancementsApplied: finalResult.aiInsights?.optimizations || [],
          packagedModule: null, // Will be set when module is created
          metadata: {
            phaseTimes: {},
            totalSections: finalResult.sections?.length || 0,
            averageQuality: finalResult.qualityScore || 0.8,
            timestamp: new Date().toISOString(),
            aiModelsUsed: finalResult.aiInsights?.aiModelsUsed || ['gpt-4o'],
            processingSteps: ['section-detection', 'ai-analysis']
          }
        };
        setDesignResult(compatibleResult);
        setCurrentStep('module'); // Jump to final step
      }
      
      aiLogger.info('system', 'AI pipeline execution completed', {
        sectionsDetected: splittingResult.splittingSuggestions?.length || 0
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'AI pipeline processing failed';
      setError(errorMessage);
      aiLogger.error('system', 'AI pipeline execution failed', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle sections confirmed from AI splitter
  const handleSectionsConfirmed = async (confirmedSections: any[]) => {
    try {
      setIsProcessing(true);
      
      aiLogger.info('system', 'Processing confirmed sections', {
        sectionsCount: confirmedSections.length
      });

      // Submit AI feedback for improvement
      if (hybridAnalysisResult?.sections) {
        await aiPipelineService.submitAIFeedback(
          hybridAnalysisResult.sections,
          confirmedSections
        );
      }

      // Continue with HTML generation
      setCurrentStep('editor');
      
      // Update hybrid analysis result with confirmed sections
      setHybridAnalysisResult(prev => prev ? {
        ...prev,
        sections: confirmedSections
      } : null);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Section confirmation failed';
      setError(errorMessage);
      aiLogger.error('system', 'Section confirmation failed', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle pipeline completion
  const handlePipelineComplete = (result: any) => {
    setDesignResult(result);
    setCurrentStep('module');
    
    aiLogger.info('system', 'Unified AI workflow completed', {
      finalStep: 'module',
      resultId: result.id
    });
  };

  // Handle workflow reset
  const handleReset = () => {
    setCurrentStep('upload');
    setUploadedImageFile(null);
    setHybridAnalysisResult(null);
    setDesignResult(null);
    setError(null);
    setPipelinePhases([]);
    setIsProcessing(false);
    
    aiLogger.info('system', 'Unified AI workflow reset');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* AI-First Pipeline UI */}
      <AIFirstPipelineUI
        onComplete={handlePipelineComplete}
      />

      {/* Error Display */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-md">
          <div className="flex items-start space-x-3">
            <div className="text-red-600">⚠️</div>
            <div>
              <h4 className="font-semibold text-red-900 text-sm">Workflow Error</h4>
              <p className="text-red-800 text-xs mt-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Processing</h3>
              <p className="text-gray-600 text-sm">
                Our AI is working on your design. This may take a few moments...
              </p>
              
              {pipelinePhases.length > 0 && (
                <div className="mt-4 space-y-2">
                  {pipelinePhases.map((phase) => (
                    <div key={phase.phaseId} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">{phase.name}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1">
                          <div 
                            className={`h-1 rounded-full transition-all duration-300 ${
                              phase.status === 'completed' ? 'bg-green-500' : 
                              phase.status === 'running' ? 'bg-blue-500' : 'bg-gray-300'
                            }`}
                            style={{ width: `${phase.progress}%` }}
                          />
                        </div>
                        <span className="text-gray-500 w-8">{phase.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
