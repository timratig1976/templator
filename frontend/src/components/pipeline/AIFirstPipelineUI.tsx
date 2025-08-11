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
import SplitGenerationPlanner from '@/components/SplitGenerationPlanner';
import LoadPreviousSplit, { type LoadedSplitSummary } from '@/components/LoadPreviousSplit';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { useWorkflowHandlers } from '@/hooks/useWorkflowHandlers';
import { aiPipelineService } from '@/services/aiPipelineService';
import { aiLogger } from '@/services/aiLogger';
import { hybridLayoutService } from '@/services/hybridLayoutService';

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
    setHybridAnalysisResult,
    setUploadedImageFile,
    designResult,
    setCurrentStep,
    error
  } = useWorkflow();
  
  const { 
    handleHybridSectionsConfirmed,
    submitHybridFeedback 
  } = useWorkflowHandlers();

  // Optional: load an existing split without re-upload
  const [showLoadPrevious, setShowLoadPrevious] = useState(false);
  const [loadedSplit, setLoadedSplit] = useState<LoadedSplitSummary | null>(null);

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
      id: 'section-detection',
      name: 'Section Detection',
      description: 'AI detects and suggests section splits',
      icon: Eye,
      status: 'pending',
      progress: 0,
      aiEnhanced: true
    },
    {
      id: 'ai-analysis',
      name: 'AI Vision Analysis',
      description: 'AI analyzes layout and generates HTML',
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
      id: 'plan-generation',
      name: 'Plan Generation',
      description: 'Choose which sections generate HTML and/or a module',
      icon: Settings,
      status: 'pending',
      progress: 0,
      aiEnhanced: false
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
  const [splittingSuggestions, setSplittingSuggestions] = useState<any[]>([]);
  const [splittingSuggestionsLoading, setSplittingSuggestionsLoading] = useState(false);
  const [splittingSuggestionsError, setSplittingSuggestionsError] = useState<string>('');
  const [confirmedSections, setConfirmedSections] = useState<any[] | null>(null);
  const [generationPlan, setGenerationPlan] = useState<any[] | null>(null);

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
        progress = 0; // Start at 0 until we have real progress
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
      setCurrentPhaseIndex(1); // Move to section detection phase
      setUploadedImageFile(file); // Set the uploaded file in workflow context
      setSplittingSuggestionsLoading(true);
      setSplittingSuggestionsError('');
      
      const analysisResult = await hybridLayoutService.analyzeLayout(file);
      
      setHybridAnalysisResult(analysisResult);
      setSplittingSuggestions(analysisResult.hybridSections || []);
      setSplittingSuggestionsLoading(false);
      // Auto-advance to Hybrid Splitter for user editing/approval
      setCurrentPhaseIndex(2);
    } catch (error) {
      console.error('Section detection failed:', error);
      setSplittingSuggestionsError(error instanceof Error ? error.message : 'Section detection failed');
      setSplittingSuggestionsLoading(false);
    }
  };
  
  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = error => reject(error);
    });
  };
  
  const handleSplittingSuggestionsConfirm = async (confirmedSuggestions: any[]) => {
    try {
      setCurrentPhaseIndex(2); // Move to AI analysis phase
      
      // Now call the full AI analysis with the confirmed sections
      // This would integrate with the existing aiPipelineService
      // For now, we'll simulate moving to the next phase
      console.log('Confirmed suggestions:', confirmedSuggestions);
      
    } catch (error) {
      console.error('AI analysis failed:', error);
    }
  };
  
  const handleRegenerateSuggestions = () => {
    if (uploadedImageFile) {
      handleFileUploadWithAI(uploadedImageFile);
    }
  };

  const handleSectionsConfirmedWithAI = async (sections: any[]) => {
    // Store sections and move to planning step
    setConfirmedSections(sections);
    setCurrentPhaseIndex(3); // Plan Generation phase
  };

  const handlePlanConfirmed = async (plan: any[]) => {
    setGenerationPlan(plan);
    // Submit AI feedback for continuous learning (based on original + confirmed)
    if (hybridAnalysisResult?.hybridSections && confirmedSections) {
      await submitHybridFeedback(hybridAnalysisResult.hybridSections, confirmedSections);
    }
    // Proceed with existing flow using confirmed sections; backend can be extended to accept plan
    if (confirmedSections) {
      await handleHybridSectionsConfirmed(confirmedSections);
    }
    setCurrentPhaseIndex(4); // Move to HTML generation phase
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
      'section-detection': {
        title: '👁️ AI Section Detection Active',
        content: 'AI is analyzing your design to suggest optimal section splits for better organization and user experience.',
        confidence: splittingSuggestions.length > 0 ? Math.round(splittingSuggestions.reduce((acc, s) => acc + s.confidence, 0) / splittingSuggestions.length * 100) : null
      },
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

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowLoadPrevious(true)}
                      className="w-full inline-flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Load previous layout (no upload)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Section Detection Phase (AI-only, requires approval to proceed) */}
          {currentPhaseIndex === 1 && uploadedImageFile && (
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-6">
              {splittingSuggestionsLoading ? (
                <>
                  <div className="flex items-center space-x-3 text-blue-600">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="font-medium">Analyzing design with AI Vision…</span>
                  </div>
                  <p className="text-sm text-gray-600 max-w-md">
                    Detecting sections and cutlines automatically.
                  </p>
                </>
              ) : (
                <div className="w-full max-w-xl bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-left">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Section Detection Complete</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Review and edit the detected sections before proceeding.
                  </p>
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-600">Detected Sections</div>
                      <div className="text-2xl font-semibold text-gray-900">
                        {hybridAnalysisResult?.hybridSections?.length || 0}
                      </div>
                    </div>
                    <button
                      onClick={() => setCurrentPhaseIndex(2)}
                      className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                    >
                      <span>Continue to Edit Sections</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {splittingSuggestionsError && (
                    <div className="text-red-600 text-sm mb-2">
                      {splittingSuggestionsError}
                    </div>
                  )}
                  <button
                    onClick={handleRegenerateSuggestions}
                    className="inline-flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry Analysis</span>
                  </button>
                </div>
              )}
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
                      AI detected {hybridAnalysisResult.hybridSections?.length || 0} sections. 
                      Review and refine before generating HTML.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <HybridLayoutSplitter
                  imageFile={uploadedImageFile}
                  aiDetectedSections={hybridAnalysisResult.hybridSections || []}
                  onSectionsConfirmed={handleSectionsConfirmedWithAI}
                  onBack={() => setCurrentPhaseIndex(0)}
                  enhancedAnalysis={hybridAnalysisResult.enhancedAnalysis}
                />
              </div>
            </div>
          )}

          {/* Plan Generation Phase */}
          {currentPhaseIndex === 3 && (confirmedSections || loadedSplit) && (
            <div className="p-6">
              <SplitGenerationPlanner
                imageFile={loadedSplit ? undefined : uploadedImageFile}
                imageUrl={loadedSplit?.imageUrl || null}
                designSplitId={loadedSplit?.designSplitId ?? hybridAnalysisResult?.splitId}
                sections={(loadedSplit ? loadedSplit.sections : confirmedSections!.map((s: any, idx: number) => ({
                  id: s.id || String(idx),
                  type: s.type || 'content',
                  description: s.description || '',
                  confidence: s.confidence ?? undefined,
                  bounds: s.bounds,
                })))}
                onBack={() => setCurrentPhaseIndex(loadedSplit ? 0 : 2)}
                onConfirm={handlePlanConfirmed}
              />
            </div>
          )}

          {/* HTML Generation Phase */}
          {currentPhaseIndex === 4 && (
            <div className="p-8" />
          )}

          {/* Module Packaging Phase */}
          {currentPhaseIndex === 5 && (
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

      {/* Load Previous Split Modal */}
      {showLoadPrevious && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <LoadPreviousSplit
              onCancel={() => setShowLoadPrevious(false)}
              onLoaded={(data) => {
                setLoadedSplit(data);
                setShowLoadPrevious(false);
                // Jump directly to plan generation using loaded sections
                setCurrentPhaseIndex(3);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
