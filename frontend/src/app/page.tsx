'use client';

import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { Upload, Eye, Package, ArrowRight, Activity, Download, AlertCircle, Copy, Code, Sparkles, Zap, Target, Terminal, Folder } from 'lucide-react';
import DesignUpload from '@/components/DesignUpload';
import HTMLPreview from '@/components/HTMLPreview';
import AILogViewer from '@/components/AILogViewer';
import HubSpotModuleEditor from '@/components/HubSpotModuleEditor';
import LayoutSplittingManager from '@/components/LayoutSplittingManager';
import SectionStackEditor from '@/components/SectionStackEditor';
import HybridLayoutSplitter from '@/components/HybridLayoutSplitter';
import SaveStatusIndicator from '@/components/SaveStatusIndicator';
import ProjectManager from '@/components/ProjectManager';
import { aiLogger } from '@/services/aiLogger';
import { socketClient } from '@/services/socketClient';
import layoutSplittingService from '@/services/layoutSplittingService';
import { PipelineExecutionResult, PipelineSection } from '@/services/pipelineService';
import { useProjectManager } from '@/hooks/useProjectManager';

// Legacy DesignAnalysisResult interface removed - now using PipelineExecutionResult

interface Section {
  id: string;
  name: string;
  type: 'header' | 'hero' | 'content' | 'footer' | 'sidebar' | 'navigation';
  html: string;
  editableFields: EditableField[];
}

interface EditableField {
  id: string;
  name: string;
  type: 'text' | 'rich_text' | 'image' | 'url' | 'boolean';
  selector: string;
  defaultValue: string;
  required: boolean;
}

interface Component {
  id: string;
  name: string;
  type: 'text' | 'image' | 'button' | 'link' | 'form' | 'list';
  selector: string;
  defaultValue: string;
}

type WorkflowStep = 'upload' | 'preview' | 'hybrid-split' | 'split' | 'editor' | 'module' | 'projects';

export default function Home() {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [designResult, setDesignResult] = useState<PipelineExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAILogs, setShowAILogs] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState<{url: string, fileName: string} | null>(null);
  const [isLogStreamConnected, setIsLogStreamConnected] = useState(false);
  const [shouldUseSplitting, setShouldUseSplitting] = useState<boolean | null>(null);
  const [splittingResult, setSplittingResult] = useState<any>(null);
  const [originalFileName, setOriginalFileName] = useState<string>('');
  const [hybridAnalysisResult, setHybridAnalysisResult] = useState<any>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);

  // Project management
  const projectManager = useProjectManager();

  useEffect(() => {
    // Initialize logging system
    aiLogger.logFlowStep('app-init', 'Templator Started', 'start');

    // Check log stream connection status
    const checkConnection = () => {
      const status = socketClient.getConnectionStatus();
      setIsLogStreamConnected(status.connected);
    };

    // Check connection status every 5 seconds
    const connectionInterval = setInterval(checkConnection, 5000);
    checkConnection(); // Initial check

    return () => {
      clearInterval(connectionInterval);
    };
  }, []);

  const handleUploadSuccess = async (result: PipelineExecutionResult, fileName?: string, imageFile?: File) => {
    setDesignResult(result);
    setError(null);
    
    // Store original filename and image file for hybrid layout analysis
    if (fileName) {
      setOriginalFileName(fileName);
    }
    if (imageFile) {
      setUploadedImageFile(imageFile);
    }
    
    // Auto-save the project if enabled
    if (projectManager.autoSaveEnabled && fileName) {
      try {
        aiLogger.logFlowStep('auto-save', 'Auto-saving Project', 'start', {
          fileName,
          sections: result.sections?.length || 0
        });
        const saveResult = await projectManager.autoSaveProject(result, fileName);
        aiLogger.logFlowStep('auto-save', 'Project Auto-saved', 'complete', {
          projectId: saveResult.id
        });
      } catch (error) {
        console.warn('Auto-save failed, continuing without saving:', error);
        aiLogger.logFlowStep('auto-save', 'Auto-save Failed', 'error', { error: error.message });
      }
    }
    
    // Start with AI-supported hybrid layout splitting
    if (imageFile) {
      try {
        aiLogger.logFlowStep('hybrid-analysis', 'Starting AI Layout Analysis', 'start');
        
        // Call hybrid layout analysis API
        const formData = new FormData();
        formData.append('image', imageFile);
        
        const response = await fetch('/api/hybrid-layout/analyze', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const analysisResult = await response.json();
          setHybridAnalysisResult(analysisResult);
          
          aiLogger.logFlowStep('hybrid-analysis', 'AI Layout Analysis Complete', 'complete', {
            sectionsDetected: analysisResult.sections?.length || 0,
            averageConfidence: analysisResult.enhancedAnalysis?.detectionMetrics?.averageConfidence || 0
          });
          
          // Move to hybrid layout splitting step
          setCurrentStep('hybrid-split');
        } else {
          throw new Error('Hybrid layout analysis failed');
        }
      } catch (error) {
        console.warn('Hybrid layout analysis failed, falling back to traditional flow:', error);
        aiLogger.logFlowStep('hybrid-analysis', 'Analysis Failed - Fallback', 'error', { error: error.message });
        
        // Fallback to traditional layout analysis
        await handleTraditionalLayoutAnalysis(result);
      }
    } else {
      // No image file, use traditional flow
      await handleTraditionalLayoutAnalysis(result);
    }
  };
  
  // Traditional layout analysis fallback
  const handleTraditionalLayoutAnalysis = async (result: PipelineExecutionResult) => {
    try {
      // Extract HTML from the pipeline result sections
      const combinedHtml = result.sections.map(section => section.html).join('\n');
      const fileSize = layoutSplittingService.estimateFileSize(combinedHtml);
      const analysis = await layoutSplittingService.analyzeLayout(fileSize);
      setShouldUseSplitting(analysis.shouldSplit);
      
      if (analysis.shouldSplit) {
        setCurrentStep('split');
      } else {
        setCurrentStep('preview');
      }
    } catch (err) {
      console.warn('Failed to analyze layout for splitting:', err);
      setCurrentStep('preview');
    }
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleCreateModule = async () => {
    if (!designResult) return;

    const requestId = `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    aiLogger.logFlowStep('module-creation', 'Creating HubSpot Module', 'start', {
      sections: designResult.sections?.length || 0
    });

    try {
      // Convert sections and components to fields_config format
      const fieldsConfig = designResult.sections?.flatMap(section => 
        section.editableFields.map(field => ({
          id: field.id,
          label: field.name,
          type: field.type === 'rich_text' ? 'richtext' : field.type,
          required: field.required
        }))
      );

      const combinedHtml = designResult.sections?.map(s => s.html).join('\n') || '';
      aiLogger.logFlowStep('module-creation', 'Sending to Backend', 'start', {
        fields: fieldsConfig.length
      });

      // Call the existing module creation endpoint with correct data structure
      const response = await fetch(API_ENDPOINTS.MODULE_GENERATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html_normalized: combinedHtml,
          fields_config: fieldsConfig
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        aiLogger.logFlowStep('module-creation', 'Backend Request Failed', 'error', {
          status: response.status
        });
        throw new Error(errorData.message || 'Failed to create HubSpot module');
      }

      const result = await response.json();
      aiLogger.logFlowStep('module-creation', 'Module Created Successfully', 'complete', {
        moduleId: result.moduleId
      });

      // Download the module with enhanced user feedback
      if (result.module_zip_url) {
        // Construct full download URL
        const downloadUrl = result.module_zip_url.startsWith('http') 
          ? result.module_zip_url 
          : `${API_ENDPOINTS.DESIGN_UPLOAD.replace('/api/design/upload', '')}${result.module_zip_url}`;
        
        const fileName = `${(designResult.packagedModule?.name || 'generated-module').replace(/\.[^/.]+$/, '')}-hubspot-module.zip`;
        
        aiLogger.info('network', 'Downloading module ZIP file', {
          downloadUrl,
          moduleSlug: result.module_slug,
          fileName
        }, requestId);

        try {
          const downloadResponse = await fetch(downloadUrl);
          if (downloadResponse.ok) {
            const blob = await downloadResponse.blob();
            
            // Verify it's a ZIP file
            if (blob.type !== 'application/zip' && blob.type !== 'application/x-zip-compressed') {
              aiLogger.warning('system', 'Downloaded file may not be a ZIP', {
                contentType: blob.type,
                size: blob.size
              }, requestId);
            }
            
            // Enhanced download with better browser compatibility
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            a.target = '_blank'; // Ensure it opens in new context
            
            // Add to DOM, click, and clean up
            document.body.appendChild(a);
            
            // Try multiple download approaches for better compatibility
            try {
              a.click();
            } catch (clickError) {
              // Fallback: try programmatic click
              const event = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
              });
              a.dispatchEvent(event);
            }
            
            // Clean up after a short delay
            setTimeout(() => {
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            }, 100);
            
            // Store download info for alternative access
            setDownloadInfo({
              url: downloadUrl,
              fileName
            });
            
            // Show user-friendly success message with download location info
            aiLogger.success('system', 'Module downloaded successfully', {
              fileName,
              fileSize: `${(blob.size / 1024).toFixed(1)} KB`,
              contentType: blob.type,
              downloadLocation: 'Check your Downloads folder or browser download manager',
              instructions: 'The ZIP file should appear in your default download location',
              alternativeAccess: 'If you cannot find the file, use the direct download link below'
            }, requestId);
            
            // Also show a browser notification if possible
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('HubSpot Module Downloaded', {
                body: `${fileName} has been downloaded to your Downloads folder`,
                icon: '/favicon.ico'
              });
            }
            
          } else {
            const errorText = await downloadResponse.text().catch(() => 'Unknown error');
            aiLogger.error('network', 'Failed to download module', {
              status: downloadResponse.status,
              statusText: downloadResponse.statusText,
              error: errorText,
              downloadUrl,
              troubleshooting: 'Check network connection and try again'
            }, requestId);
            throw new Error(`Download failed: ${downloadResponse.status} ${downloadResponse.statusText}`);
          }
        } catch (downloadError) {
          aiLogger.error('system', 'Download process failed', {
            error: downloadError instanceof Error ? downloadError.message : 'Unknown error',
            downloadUrl,
            fileName,
            troubleshooting: 'Try refreshing the page and generating the module again'
          }, requestId);
          throw downloadError;
        }
      } else {
        aiLogger.error('system', 'No download URL provided in response', {
          response: result,
          troubleshooting: 'Module generation may have failed - try regenerating'
        }, requestId);
        throw new Error('No download URL provided - please try generating the module again');
      }

      setCurrentStep('module');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create module';
      aiLogger.error('system', 'Module creation process failed', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      }, requestId);
      setError(errorMessage);
    }
  };

  // Handle hybrid layout sections confirmation
  const handleHybridSectionsConfirmed = async (confirmedSections: any[]) => {
    try {
      aiLogger.logFlowStep('hybrid-generate', 'Generating HTML from Confirmed Sections', 'start', {
        sectionsCount: confirmedSections.length
      });
      
      // Call hybrid layout generate API
      const response = await fetch('/api/hybrid-layout/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sections: confirmedSections,
          originalAnalysis: hybridAnalysisResult
        })
      });
      
      if (response.ok) {
        const generateResult = await response.json();
        
        // Convert hybrid result to PipelineExecutionResult format
        const hybridPipelineResult: PipelineExecutionResult = {
          id: `hybrid-${Date.now()}`,
          sections: generateResult.sections || [],
          qualityScore: generateResult.qualityScore || 0,
          processingTime: generateResult.processingTime || 0,
          validationPassed: true,
          enhancementsApplied: ['AI Layout Analysis', 'User Section Refinement'],
          packagedModule: generateResult.packagedModule || {
            name: 'Hybrid Generated Module',
            files: {},
            metadata: {}
          },
          metadata: {
            phaseTimes: { 'hybrid-analysis': generateResult.processingTime || 0 },
            totalSections: generateResult.sections?.length || 0,
            averageQuality: generateResult.qualityScore || 0,
            timestamp: new Date().toISOString(),
            aiModelsUsed: ['gpt-4-vision-preview'],
            processingSteps: ['AI Layout Analysis', 'User Section Refinement', 'HTML Generation']
          }
        };
        
        setDesignResult(hybridPipelineResult);
        
        aiLogger.logFlowStep('hybrid-generate', 'HTML Generation Complete', 'complete', {
          sectionsGenerated: generateResult.sections?.length || 0,
          qualityScore: generateResult.qualityScore || 0
        });
        
        // Submit feedback to improve AI
        if (hybridAnalysisResult?.sections) {
          await submitHybridFeedback(hybridAnalysisResult.sections, confirmedSections);
        }
        
        setCurrentStep('preview');
      } else {
        throw new Error('Failed to generate HTML from sections');
      }
    } catch (error) {
      console.error('Hybrid HTML generation failed:', error);
      aiLogger.logFlowStep('hybrid-generate', 'Generation Failed', 'error', { error: error.message });
      setError('Failed to generate HTML from sections. Please try again.');
    }
  };
  
  // Submit feedback for AI improvement
  const submitHybridFeedback = async (originalSections: any[], finalSections: any[]) => {
    try {
      await fetch('/api/hybrid-layout/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalSections,
          finalSections,
          satisfactionScore: 4, // Default good score
          comments: 'User refined AI suggestions'
        })
      });
    } catch (error) {
      console.warn('Failed to submit feedback:', error);
    }
  };
  
  const resetWorkflow = () => {
    setCurrentStep('upload');
    setDesignResult(null);
    setError(null);
    setDownloadInfo(null);
    setShouldUseSplitting(null);
    setSplittingResult(null);
    setHybridAnalysisResult(null);
    setUploadedImageFile(null);
  };

  const steps = [
    { id: 'upload', title: 'Upload Design', description: 'Upload your design image', icon: Upload },
    ...(hybridAnalysisResult ? [{ id: 'hybrid-split', title: 'AI Layout Analysis', description: 'Review and refine AI-detected sections', icon: Zap }] : []),
    ...(shouldUseSplitting ? [{ id: 'split', title: 'Split Layout', description: 'Process large layout in sections', icon: ArrowRight }] : []),
    { id: 'preview', title: 'Preview & Refine', description: 'Review generated HTML', icon: Eye },
    { id: 'editor', title: 'Edit Module', description: 'Customize HubSpot module parts', icon: Code },
    { id: 'module', title: 'Download Module', description: 'Get your HubSpot module', icon: Package }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold gradient-text">Windsurf MVP</h1>
              
              {/* Projects Button */}
              <button
                onClick={() => setCurrentStep('projects')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center space-x-1 ${
                  currentStep === 'projects'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                <Folder className="w-4 h-4" />
                <span>Projects</span>
                {projectManager.allProjects.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                    {projectManager.allProjects.length}
                  </span>
                )}
              </button>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Save Status Indicator */}
              {designResult && (
                <SaveStatusIndicator
                  saveStatus={projectManager.saveStatus}
                  isSaving={projectManager.isSaving}
                  lastSaved={projectManager.lastSaved}
                  error={projectManager.error}
                  autoSaveEnabled={projectManager.autoSaveEnabled}
                  onToggleAutoSave={projectManager.setAutoSaveEnabled}
                  className="hidden sm:flex"
                />
              )}
              
              <div className="text-sm text-gray-600">
                Design → HTML → HubSpot Module
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold gradient-text mb-6">
            Transform Designs into HubSpot Modules
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Upload any design file and our AI will convert it to responsive HTML with Tailwind CSS, 
            then generate a complete HubSpot module ready for deployment.
          </p>

          {/* Progress Steps */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
              
              return (
                <React.Fragment key={step.id}>
                  <div className={`
                    flex items-center space-x-3 px-4 py-2 rounded-full transition-all
                    ${isActive ? 'bg-white shadow-lg scale-105' : isCompleted ? 'bg-green-50' : 'bg-gray-50'}
                  `}>
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      ${isActive ? 'bg-blue-100' : isCompleted ? 'bg-green-100' : 'bg-gray-100'}
                    `}>
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="text-left">
                      <p className={`font-medium text-sm ${isActive ? 'text-gray-900' : isCompleted ? 'text-green-900' : 'text-gray-500'}`}>
                        {step.title}
                      </p>
                      <p className={`text-xs ${isActive ? 'text-gray-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Step Content */}
        <div className="mb-12">
          {currentStep === 'upload' && (
            <div className="space-y-8">
              <DesignUpload
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
            </div>
          )}

          {currentStep === 'hybrid-split' && hybridAnalysisResult && uploadedImageFile && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  🧠 AI Layout Analysis Complete
                </h2>
                <p className="text-gray-600">
                  Our AI has detected {hybridAnalysisResult.sections?.length || 0} sections in your design. 
                  Review and adjust the sections below, then confirm to generate HTML.
                </p>
                {hybridAnalysisResult.enhancedAnalysis && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm text-blue-800">
                      <strong>AI Confidence:</strong> {Math.round((hybridAnalysisResult.enhancedAnalysis.detectionMetrics?.averageConfidence || 0) * 100)}% • 
                      <strong>Quality Score:</strong> {Math.round((hybridAnalysisResult.enhancedAnalysis.recommendations?.qualityScore || 0) * 100)}%
                    </div>
                  </div>
                )}
              </div>
              
              <HybridLayoutSplitter
                imageFile={uploadedImageFile}
                aiDetectedSections={hybridAnalysisResult.sections || []}
                onSectionsConfirmed={handleHybridSectionsConfirmed}
                onBack={() => setCurrentStep('upload')}
                enhancedAnalysis={hybridAnalysisResult.enhancedAnalysis}
              />
            </div>
          )}

          {currentStep === 'split' && designResult && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Large Layout Detected
                </h2>
                <p className="text-gray-600">
                  Your layout is large and complex. We'll split it into sections for better quality.
                </p>
              </div>
              
              <LayoutSplittingManager
                html={designResult.sections?.map(s => s.html).join('\n') || ''}
                onComplete={(result) => {
                  setSplittingResult(result);
                  setCurrentStep('preview');
                }}
                onSectionComplete={(section) => {
                  aiLogger.info('processing', 'Section processing completed', {
                    sectionId: section.section.id,
                    sectionType: section.section.type,
                    qualityScore: section.validationResult.score,
                    processingTime: section.processingTime
                  });
                }}
              />
              
              <div className="text-center">
                <button
                  onClick={() => setCurrentStep('preview')}
                  className="btn-secondary mr-4"
                >
                  Skip Splitting
                </button>
                <button
                  onClick={resetWorkflow}
                  className="btn-secondary"
                >
                  Upload New Design
                </button>
              </div>
            </div>
          )}

          {currentStep === 'preview' && designResult && (
            <div className="space-y-8">
              {/* Check if we have multiple sections to show stacked editor */}
              {designResult.sections && designResult.sections.length > 1 ? (
                <SectionStackEditor
                  designResult={designResult}
                  splittingResult={splittingResult}
                  onSectionUpdate={(sectionId, updatedSection) => {
                    // Update the section in designResult
                    setDesignResult(prev => {
                      if (!prev || !prev.sections) return prev;
                      return {
                        ...prev,
                        sections: prev.sections.map(section => 
                          section.id === sectionId ? updatedSection : section
                        )
                      };
                    });
                  }}
                  onCreateModuleFromSection={(section) => {
                    aiLogger.success('processing', 'Module created from section', {
                      sectionId: section.id,
                      sectionName: section.name
                    });
                  }}
                />
              ) : (
                <HTMLPreview
                  html={splittingResult?.combinedModule?.html || designResult.sections?.map((s: PipelineSection) => s.html).join('\n') || ''}
                  sections={designResult.sections || []}
                  components={designResult.sections?.flatMap((s: PipelineSection) => 
                    (s.editableFields || []).map(field => ({
                      id: field.id,
                      name: field.name,
                      type: field.type === 'rich_text' ? 'text' : field.type === 'boolean' ? 'text' : field.type as 'text' | 'image' | 'button' | 'link' | 'form' | 'list',
                      selector: field.selector,
                      defaultValue: field.defaultValue
                    }))
                  ) || []}
                  description={designResult.metadata?.processingSteps?.join(', ') || 'AI-generated HubSpot module'}
                  fileName={designResult.packagedModule?.name || 'Generated Module'}
                  onCreateModule={handleCreateModule}
                />
              )}
              
              {splittingResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-2">✅ Layout Processing Complete</h3>
                  <p className="text-sm text-green-800">
                    Processed {splittingResult.processedSections}/{splittingResult.totalSections} sections 
                    with {splittingResult.overallQualityScore}% average quality score.
                  </p>
                </div>
              )}
              
              <div className="text-center">
                <button
                  onClick={resetWorkflow}
                  className="btn-secondary"
                >
                  Upload New Design
                </button>
              </div>
            </div>
          )}

          {currentStep === 'editor' && designResult && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Customize Your HubSpot Module
                </h2>
                <p className="text-gray-600">
                  Edit each part of your module before downloading the final ZIP file.
                </p>
              </div>
              <HubSpotModuleEditor designResult={designResult} />
            </div>
          )}

          {currentStep === 'module' && (
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  HubSpot Module Created Successfully!
                </h2>
                <p className="text-gray-600">
                  Your module has been generated and should be downloading automatically.
                </p>
              </div>

              {/* Download Status and Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
                  <Download className="w-5 h-5 mr-2" />
                  Download Instructions
                </h3>
                <div className="space-y-3 text-sm text-blue-800">
                  <p>
                    <strong>📁 Where to find your file:</strong> Check your browser's Downloads folder or download manager. 
                    The file is typically saved to your default download location.
                  </p>
                  <p>
                    <strong>🔍 File name:</strong> Look for a file ending with "-hubspot-module.zip"
                  </p>
                  <p>
                    <strong>💡 Can't find it?</strong> Check your browser's download history (Ctrl+J / Cmd+Shift+J) or use the direct download link below.
                  </p>
                </div>
              </div>

              {/* Alternative Download Method */}
              {downloadInfo && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h3 className="font-semibold text-yellow-900 mb-3 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Alternative Download
                  </h3>
                  <p className="text-yellow-800 text-sm mb-4">
                    If the automatic download didn't work or you can't find the file, use this direct download link:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={downloadInfo.url}
                      download={downloadInfo.fileName}
                      className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                      onClick={() => {
                        aiLogger.info('system', 'User clicked direct download link', {
                          fileName: downloadInfo.fileName,
                          url: downloadInfo.url
                        });
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download {downloadInfo.fileName}
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(downloadInfo.url);
                        aiLogger.info('system', 'Download URL copied to clipboard');
                      }}
                      className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </button>
                  </div>
                </div>
              )}

              {/* Next Steps */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">📋 Next Steps</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                  <li>Locate and extract the downloaded ZIP file</li>
                  <li>Log into your HubSpot account</li>
                  <li>Navigate to Marketing → Files and Templates → Design Manager</li>
                  <li>Upload the extracted module files to your HubSpot account</li>
                  <li>Use the module in your HubSpot pages and templates</li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={resetWorkflow}
                  className="btn-primary"
                >
                  Create Another Module
                </button>
                <button
                  onClick={() => setCurrentStep('preview')}
                  className="btn-secondary"
                >
                  Back to Preview
                </button>
              </div>
            </div>
          )}

          {currentStep === 'projects' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Project Manager
                </h2>
                <p className="text-gray-600">
                  Manage your saved projects, load previous work, or create new projects.
                </p>
              </div>
              
              <ProjectManager
                onLoadProject={(project) => {
                  // Load project data and switch to preview
                  setDesignResult(project.pipelineResult);
                  setOriginalFileName(project.originalFileName);
                  setCurrentStep('preview');
                  
                  aiLogger.info('system', '📂 Project loaded from manager', {
                    projectId: project.id,
                    projectName: project.name,
                    sectionsCount: project.pipelineResult.sections?.length || 0
                  });
                }}
                onCreateNew={() => {
                  // Reset workflow to start new project
                  resetWorkflow();
                  
                  aiLogger.info('system', '✨ Starting new project from manager');
                }}
                className="max-w-6xl mx-auto"
              />
            </div>
          )}
        </div>

        {/* AI Process Logs Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Terminal className="w-5 h-5 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">AI Process Logs</h2>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
                isLogStreamConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isLogStreamConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span>{isLogStreamConnected ? 'Live Stream Connected' : 'Stream Disconnected'}</span>
              </div>
            </div>
            <button
              onClick={() => setShowAILogs(!showAILogs)}
              className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                ${showAILogs 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }
              `}  
            >
              {showAILogs ? 'Hide Logs' : 'Show Logs'}
            </button>
          </div>
          
          {showAILogs && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">🔍 Real-time AI Process Monitoring</h3>
                <p className="text-sm text-blue-800 mb-3">
                  This log viewer shows real-time information about OpenAI API calls, upload progress, 
                  and processing stages. Use it to identify issues and monitor performance.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full" />
                    <span>Info & Progress</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span>Success</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <span>Warnings</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <span>Errors</span>
                  </div>
                </div>
              </div>
              
              <AILogViewer 
                className="max-w-full"
                maxHeight="500px"
                showFilters={true}
                autoScroll={true}
              />
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Conversion</h3>
            <p className="text-gray-600 text-sm">
              Advanced GPT-4 Vision analyzes your designs and generates clean, semantic HTML with Tailwind CSS.
            </p>
          </div>

          <div className="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Section Detection</h3>
            <p className="text-gray-600 text-sm">
              Automatically identifies headers, content areas, and components, creating optimal HubSpot field mappings.
            </p>
          </div>

          <div className="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">HubSpot Ready</h3>
            <p className="text-gray-600 text-sm">
              Generates complete module files with HubL templates, field definitions, and responsive design.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
