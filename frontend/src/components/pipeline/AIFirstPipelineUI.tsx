'use client';

import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Sparkles, 
  Brain, 
  Zap, 
  Eye, 
  Code, 
  Package, 
  ArrowRight,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Settings
} from 'lucide-react';
import HybridLayoutSplitter from '@/components/HybridLayoutSplitter';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { useWorkflowHandlers } from '@/hooks/useWorkflowHandlers';
import { aiPipelineService } from '@/services/aiPipelineService';
import { aiLogger } from '@/services/aiLogger';

interface AIPhase {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  aiEnhanced: boolean;
}

interface AIFirstPipelineUIProps {
  onComplete?: (result: any) => void;
}

export default function AIFirstPipelineUI({ onComplete }: AIFirstPipelineUIProps) {
  const { 
    currentStep,
    uploadedImageFile,
    hybridAnalysisResult,
    designResult,
    setCurrentStep,
    error
  } = useWorkflow();
  
  const { 
    handleHybridSectionsConfirmed,
    submitHybridFeedback 
  } = useWorkflowHandlers();

  const [aiPhases, setAiPhases] = useState<AIPhase[]>([
    {
      id: 'upload',
      name: 'Design Upload',
      description: 'Upload your design mockup',
      icon: Upload,
      status: 'pending',
      progress: 0,
      aiEnhanced: false
    },
    {
      id: 'ai-analysis',
      name: 'AI Vision Analysis',
      description: 'AI analyzes layout and detects sections',
      icon: Brain,
      status: 'pending',
      progress: 0,
      aiEnhanced: true
    },
    {
      id: 'smart-splitting',
      name: 'Smart Section Splitting',
      description: 'Interactive AI-guided section refinement',
      icon: Sparkles,
      status: 'pending',
      progress: 0,
      aiEnhanced: true
    },
    {
      id: 'html-generation',
      name: 'AI HTML Generation',
      description: 'Generate responsive HTML with AI optimization',
      icon: Code,
      status: 'pending',
      progress: 0,
      aiEnhanced: true
    },
    {
      id: 'module-packaging',
      name: 'HubSpot Module',
      description: 'Package as HubSpot module with AI enhancements',
      icon: Package,
      status: 'pending',
      progress: 0,
      aiEnhanced: true
    }
  ]);

  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [showAIInsights, setShowAIInsights] = useState(true);

  // Update phase status based on workflow state
  useEffect(() => {
    setAiPhases(prev => prev.map((phase, index) => {
      let status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
      let progress = 0;

      if (index < currentPhaseIndex) {
        status = 'completed';
        progress = 100;
      } else if (index === currentPhaseIndex) {
        status = 'running';
        progress = 50; // Could be dynamic based on actual progress
      }

      // Special handling for specific phases
      if (phase.id === 'upload' && uploadedImageFile) {
        status = 'completed';
        progress = 100;
      }
      if (phase.id === 'ai-analysis' && hybridAnalysisResult) {
        status = 'completed';
        progress = 100;
      }
      if (phase.id === 'smart-splitting' && currentStep === 'editor') {
        status = 'completed';
        progress = 100;
      }

      return { ...phase, status, progress };
    }));
  }, [currentPhaseIndex, uploadedImageFile, hybridAnalysisResult, currentStep]);

  const handleFileUploadWithAI = async (file: File) => {
    try {
      setCurrentPhaseIndex(1); // Move to AI analysis phase
      
      // Use aiPipelineService's public executeAIFirstPipeline method
      // This will handle the file upload and AI analysis
      aiPipelineService.executeAIFirstPipeline(file, (phases) => {
        // This callback will be called as phases progress
        // We can use it to update our UI accordingly
        const aiAnalysisPhase = phases.find(p => p.phaseId === 'ai-analysis');
        
        if (aiAnalysisPhase && aiAnalysisPhase.status === 'completed') {
          // When AI analysis is complete, move to smart splitting phase
          setCurrentPhaseIndex(2);
        }
      });
      
      // Note: We don't immediately set to phase 2 here as it will be handled by the callback
      
    } catch (error) {
      aiLogger.error('processing', 'Error in AI file analysis', error);
      throw error;
    }
  };

  const handleSectionsConfirmedWithAI = async (confirmedSections: any[]) => {
    setCurrentPhaseIndex(3); // Move to HTML generation phase
    
    // Submit AI feedback for continuous learning
    if (hybridAnalysisResult?.sections) {
      await submitHybridFeedback(hybridAnalysisResult.sections, confirmedSections);
    }
    
    await handleHybridSectionsConfirmed(confirmedSections);
    setCurrentPhaseIndex(4); // Move to module packaging phase
  };

  const getPhaseStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPhaseStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'running': return RefreshCw;
      case 'failed': return AlertCircle;
      default: return null;
    }
  };

  const renderAIInsights = () => {
    if (!showAIInsights) return null;

    const currentPhase = aiPhases[currentPhaseIndex];
    const insights = {
      'ai-analysis': {
        title: '🧠 AI Vision Analysis Active',
        content: 'Using OpenAI Vision API to analyze your design layout, detect sections, and understand visual hierarchy.',
        confidence: hybridAnalysisResult?.confidence ? Math.round(hybridAnalysisResult.confidence * 100) : null
      },
      'smart-splitting': {
        title: '✨ Smart Section Detection',
        content: `AI detected ${hybridAnalysisResult?.sections?.length || 0} sections with intelligent boundary detection.`,
        confidence: hybridAnalysisResult?.confidence ? Math.round(hybridAnalysisResult.confidence * 100) : null
      },
      'html-generation': {
        title: '🚀 AI-Powered HTML Generation',
        content: 'Generating semantic, responsive HTML with AI-optimized code structure and accessibility features.',
        confidence: null
      }
    };

    const insight = insights[currentPhase?.id as keyof typeof insights];
    if (!insight) return null;

    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 mb-8">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-2">{insight.title}</h3>
            <p className="text-blue-800 text-sm mb-3">{insight.content}</p>
            {insight.confidence && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-blue-900">
                    AI Confidence: {insight.confidence}%
                  </span>
                </div>
                <div className="w-32 bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${insight.confidence}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowAIInsights(false)}
            className="text-blue-400 hover:text-blue-600 ml-4"
          >
            ×
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">AI-First Design Pipeline</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Advanced AI-powered design-to-code conversion with intelligent section detection, 
            real-time optimization, and seamless HubSpot integration.
          </p>
        </div>

        {/* AI Phase Progress */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Pipeline Progress</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Settings className="w-4 h-4" />
              <span>AI-Enhanced Workflow</span>
            </div>
          </div>
          
          <div className="space-y-4">
            {aiPhases.map((phase, index) => {
              const Icon = phase.icon;
              const StatusIcon = getPhaseStatusIcon(phase.status);
              const isActive = index === currentPhaseIndex;
              
              return (
                <div key={phase.id} className={`
                  flex items-center p-4 rounded-xl transition-all duration-300
                  ${isActive ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50 border border-gray-200'}
                `}>
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center mr-4
                    ${getPhaseStatusColor(phase.status)}
                  `}>
                    {StatusIcon ? <StatusIcon className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-medium text-gray-900">{phase.name}</h3>
                      {phase.aiEnhanced && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
                          <Brain className="w-3 h-3 text-blue-600" />
                          <span className="text-xs font-medium text-blue-700">AI</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{phase.description}</p>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`
                          h-2 rounded-full transition-all duration-500
                          ${phase.status === 'completed' ? 'bg-green-500' : 
                            phase.status === 'running' ? 'bg-blue-500' : 'bg-gray-300'}
                        `}
                        style={{ width: `${phase.progress}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-600 w-12">
                      {phase.progress}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Insights Panel */}
        {renderAIInsights()}

        {/* Main Content Area */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Upload Phase */}
          {currentPhaseIndex === 0 && (
            <div className="p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload Your Design</h3>
                <p className="text-gray-600 mb-6">
                  Upload a PNG design mockup to begin AI-powered analysis and conversion
                </p>
                
                <div className="max-w-md mx-auto">
                  <input
                    type="file"
                    accept="image/png,image/jpg,image/jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUploadWithAI(file);
                    }}
                    className="hidden"
                    id="design-upload"
                  />
                  <label
                    htmlFor="design-upload"
                    className="flex items-center justify-center w-full px-6 py-4 border-2 border-dashed border-blue-300 rounded-xl hover:border-blue-400 cursor-pointer transition-colors"
                  >
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <span className="text-blue-600 font-medium">Click to upload design</span>
                      <p className="text-sm text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* AI Analysis Phase */}
          {currentPhaseIndex === 1 && (
            <div className="p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">AI Vision Analysis in Progress</h3>
                <p className="text-gray-600 mb-6">
                  Our AI is analyzing your design layout and detecting sections...
                </p>
                
                <div className="max-w-md mx-auto">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                      <span className="text-blue-800 font-medium">Processing with OpenAI Vision</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Smart Splitting Phase */}
          {currentPhaseIndex === 2 && hybridAnalysisResult && uploadedImageFile && (
            <div className="p-0">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
                <div className="flex items-center space-x-3">
                  <Sparkles className="w-6 h-6" />
                  <div>
                    <h3 className="text-xl font-semibold">Smart Section Splitting</h3>
                    <p className="text-blue-100">
                      AI detected {hybridAnalysisResult.sections?.length || 0} sections. 
                      Review and refine before generating HTML.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <HybridLayoutSplitter
                  imageFile={uploadedImageFile}
                  aiDetectedSections={hybridAnalysisResult.sections || []}
                  onSectionsConfirmed={handleSectionsConfirmedWithAI}
                  onBack={() => setCurrentPhaseIndex(0)}
                  enhancedAnalysis={hybridAnalysisResult.enhancedAnalysis}
                />
              </div>
            </div>
          )}

          {/* HTML Generation Phase */}
          {currentPhaseIndex === 3 && (
            <div className="p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Code className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Generating AI-Optimized HTML</h3>
                <p className="text-gray-600 mb-6">
                  Creating responsive, semantic HTML with AI-powered optimization...
                </p>
                
                <div className="max-w-md mx-auto">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <RefreshCw className="w-4 h-4 text-green-600 animate-spin" />
                      <span className="text-green-800 font-medium">AI HTML Generation</span>
                    </div>
                    <div className="w-full bg-green-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{ width: '80%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Module Packaging Phase */}
          {currentPhaseIndex === 4 && (
            <div className="p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Creating HubSpot Module</h3>
                <p className="text-gray-600 mb-6">
                  Packaging your AI-generated HTML as a HubSpot module with enhanced features...
                </p>
                
                <div className="max-w-md mx-auto">
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <RefreshCw className="w-4 h-4 text-purple-600 animate-spin" />
                      <span className="text-purple-800 font-medium">Module Packaging</span>
                    </div>
                    <div className="w-full bg-purple-200 rounded-full h-2">
                      <div className="bg-purple-600 h-2 rounded-full animate-pulse" style={{ width: '90%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Handling */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mt-8">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-900">Pipeline Error</h3>
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
