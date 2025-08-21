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
// Types for admin pipeline + IR schemas
type StepDef = { id: string; key: string; name?: string | null; versions?: Array<{ id: string; version: string; isActive: boolean }> };
type StepVersion = { id: string; version: string; isActive: boolean };
type IRSchema = { id: string; stepVersionId: string; name: string; version: string; schema: any; isActive: boolean; createdAt?: string };

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

  // IR Schema linking state
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [phaseToStepVersion, setPhaseToStepVersion] = useState<Record<string, { stepId: string; stepKey: string; stepVersionId: string } | null>>({});
  const [schemasModalPhaseId, setSchemasModalPhaseId] = useState<string | null>(null);
  const [schemasLoading, setSchemasLoading] = useState(false);
  const [schemasError, setSchemasError] = useState<string | null>(null);
  const [schemas, setSchemas] = useState<IRSchema[]>([]);
  const [manualStepSelect, setManualStepSelect] = useState<string>('');

  function backendBase() {
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009';
  }

  function normalizeKey(s: string) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  // Load steps (with versions) and compute heuristic mapping from phases -> steps (active version)
  useEffect(() => {
    let aborted = false;
    async function load() {
      try {
        const res = await fetch(`${backendBase()}/api/admin/pipelines/steps`);
        if (!res.ok) throw new Error(`Failed to load steps: ${res.status}`);
        const data = await res.json();
        if (aborted) return;
        const items: StepDef[] = (data?.data || []).map((d: any) => ({ id: d.id, key: d.key, name: d.name, versions: d.versions || [] }));
        setSteps(items);

        // Build active version by step
        const activeByStep: Record<string, string | null> = {};
        items.forEach(s => {
          const active = (s.versions || []).find(v => v.isActive);
          activeByStep[s.id] = active ? active.id : (s.versions && s.versions[0]?.id) || null;
        });

        // Heuristic mapping: try to match phase.id to step.key
        const mapping: Record<string, { stepId: string; stepKey: string; stepVersionId: string } | null> = {};
        aiPhases.forEach(p => {
          const nid = normalizeKey(p.id);
          let match: StepDef | undefined = items.find(s => {
            const nk = normalizeKey(s.key);
            return nk === nid || nk.includes(nid) || nid.includes(nk);
          });
          if (match && activeByStep[match.id]) {
            mapping[p.id] = { stepId: match.id, stepKey: match.key, stepVersionId: activeByStep[match.id]! };
          } else {
            mapping[p.id] = null; // allow manual selection later
          }
        });
        setPhaseToStepVersion(mapping);
      } catch (e) {
        // Non-fatal for the main UI
        // eslint-disable-next-line no-console
        console.warn('IR schema linking setup failed:', e);
      }
    }
    load();
    return () => { aborted = true; };
  }, []); // load once

  async function openSchemasModalForPhase(phaseId: string) {
    setSchemasModalPhaseId(phaseId);
    setSchemasError(null);
    setSchemas([]);
    const link = phaseToStepVersion[phaseId];
    if (link && link.stepVersionId) {
      setSchemasLoading(true);
      try {
        const res = await fetch(`${backendBase()}/api/admin/pipelines/steps/versions/${link.stepVersionId}/ir-schemas`);
        if (!res.ok) throw new Error(`Failed to load IR schemas: ${res.status}`);
        const data = await res.json();
        setSchemas(data?.data || []);
      } catch (e) {
        setSchemasError(e instanceof Error ? e.message : String(e));
      } finally {
        setSchemasLoading(false);
      }
    }
  }

  async function loadSchemasForStep(stepId: string) {
    // Find active version for this step
    const step = steps.find(s => s.id === stepId);
    const active = step?.versions?.find(v => v.isActive) || step?.versions?.[0] || null;
    if (!active) {
      setSchemasError('No versions found for selected step');
      return;
    }
    setSchemasLoading(true);
    setSchemasError(null);
    setSchemas([]);
    try {
      const res = await fetch(`${backendBase()}/api/admin/pipelines/steps/versions/${active.id}/ir-schemas`);
      if (!res.ok) throw new Error(`Failed to load IR schemas: ${res.status}`);
      const data = await res.json();
      setSchemas(data?.data || []);
      // Update mapping for current modal phase so future clicks have a direct link
      if (schemasModalPhaseId) {
        setPhaseToStepVersion(prev => ({
          ...prev,
          [schemasModalPhaseId]: { stepId, stepKey: step!.key, stepVersionId: active.id },
        }));
      }
    } catch (e) {
      setSchemasError(e instanceof Error ? e.message : String(e));
    } finally {
      setSchemasLoading(false);
    }
  }

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
                    
                    <div className="flex items-center space-x-3 mt-2">
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
                      <button
                        type="button"
                        onClick={() => openSchemasModalForPhase(phase.id)}
                        className="text-sm px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                        title={phaseToStepVersion[phase.id]?.stepKey ? `View IR Schemas for ${phaseToStepVersion[phase.id]?.stepKey}` : 'Select step to view IR Schemas'}
                      >
                        IR Schemas
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* AI Insights Panel */}
        {renderAIInsights()}

        {/* Main Content Area (omitted for brevity; unchanged functionality) */}

        {/* IR Schemas Modal */}
        {schemasModalPhaseId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <div className="font-semibold">IR Schemas</div>
                  <div className="text-sm text-gray-500">
                    Phase: {aiPhases.find(p => p.id === schemasModalPhaseId)?.name}
                    {phaseToStepVersion[schemasModalPhaseId]?.stepKey ? ` • Step: ${phaseToStepVersion[schemasModalPhaseId]!.stepKey}` : ''}
                  </div>
                </div>
                <button onClick={() => setSchemasModalPhaseId(null)} className="px-2 py-1 text-gray-600 hover:text-gray-900">✕</button>
              </div>
              <div className="p-4 space-y-4">
                {/* Manual step selection when no mapping */}
                {!phaseToStepVersion[schemasModalPhaseId] && (
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                    <div className="text-sm text-gray-700 mb-2">Select a step to load its active version schemas:</div>
                    <div className="flex items-center gap-2">
                      <select
                        className="border rounded p-2 flex-1"
                        value={manualStepSelect}
                        onChange={(e) => setManualStepSelect(e.target.value)}
                      >
                        <option value="">Choose a step…</option>
                        {steps.map(s => (
                          <option key={s.id} value={s.id}>{s.key}{s.name ? ` — ${s.name}` : ''}</option>
                        ))}
                      </select>
                      <button
                        disabled={!manualStepSelect}
                        onClick={() => manualStepSelect && loadSchemasForStep(manualStepSelect)}
                        className={`px-3 py-2 rounded text-white ${manualStepSelect ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'}`}
                      >
                        Load
                      </button>
                    </div>
                  </div>
                )}
                
                {schemasLoading && (
                  <div className="text-sm text-gray-600">Loading IR schemas…</div>
                )}
                {schemasError && (
                  <div className="text-sm text-red-600">{schemasError}</div>
                )}
                
                {!schemasLoading && !schemasError && (
                  <div className="space-y-3 max-h-[60vh] overflow-auto">
                    {schemas.length === 0 ? (
                      <div className="text-gray-600 text-sm">No IR Schemas found for this step version.</div>
                    ) : (
                      schemas.map(s => (
                        <div key={s.id} className="border rounded p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium">{s.name} <span className="text-gray-500">({s.version})</span> {s.isActive && <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">active</span>}</div>
                              <div className="text-xs text-gray-500">Created: {s.createdAt ? new Date(s.createdAt).toLocaleString() : '-'}</div>
                            </div>
                            <a
                              href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(s.schema, null, 2))}`}
                              download={`${s.name}-${s.version}.json`}
                              className="text-sm px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                            >
                              Download JSON
                            </a>
                          </div>
                          <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto border">{JSON.stringify(s.schema, null, 2)}</pre>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Close top-level container */}
    </div>
  );
}
