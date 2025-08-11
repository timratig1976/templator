import { useCallback } from 'react';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { PipelineExecutionResult } from '@/services/pipelineService';
import { aiLogger } from '@/services/aiLogger';
import layoutSplittingService from '@/services/layoutSplittingService';
import { createCrops } from '@/services/aiEnhancementService';
import hybridLayoutService from '@/services/hybridLayoutService';

export function useWorkflowHandlers() {
  const {
    setDesignResult,
    setError,
    setCurrentStep,
    setOriginalFileName,
    setUploadedImageFile,
    setHybridAnalysisResult,
    setDownloadInfo,
    projectManager,
    designResult,
    originalFileName,
    uploadedImageFile,
    hybridAnalysisResult,
  } = useWorkflow();

  const handleUploadSuccess = useCallback(async (result: PipelineExecutionResult, fileName?: string, imageFile?: File) => {
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
        
        await projectManager.saveProject({
          name: fileName.replace(/\.[^/.]+$/, ""), // Remove file extension
          pipelineResult: result,
          originalFileName: fileName
        });
        
        aiLogger.success('system', 'Project Auto-saved Successfully', { fileName, sections: result.sections?.length || 0 });
      } catch (error) {
        console.error('Auto-save failed:', error);
        aiLogger.error('system', 'Auto-save Failed', { error: String(error) });
      }
    }
    
    // Log successful upload
    aiLogger.success('upload', 'File uploaded successfully', { fileName, fileSize: imageFile?.size || 0 });
    
    // Move to preview step
    setCurrentStep('preview');
  }, [setDesignResult, setError, setCurrentStep, setOriginalFileName, setUploadedImageFile, projectManager]);



  const handleUploadError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    aiLogger.error('upload', 'Upload failed', { error: errorMessage });
  }, [setError]);

  const handleHybridLayoutSelection = useCallback(async (imageFile: File, fileName: string) => {
    try {
      aiLogger.logFlowStep('hybrid-layout', 'Starting Hybrid Layout Analysis', 'start', {
        fileName,
        fileSize: imageFile.size
      });

      setError(null);
      setCurrentStep('hybrid-split');
      
      // Analyze the image with OpenAI vision
      const analysisResult = await hybridLayoutService.analyzeLayout(imageFile);
      
      setHybridAnalysisResult(analysisResult);
      
      aiLogger.logFlowStep('hybrid-layout', 'Hybrid Layout Analysis Complete', 'complete', {
        sectionsDetected: analysisResult.hybridSections?.length || 0,
        confidence: analysisResult.aiAnalysis?.averageConfidence || 0
      });
      
    } catch (error) {
      console.error('Hybrid layout analysis failed:', error);
      setError('Hybrid layout analysis failed. Please try again.');
      aiLogger.logFlowStep('hybrid-layout', 'Hybrid Layout Analysis Failed', 'error', { 
        error: String(error) 
      });
    }
  }, [setError, setCurrentStep, setHybridAnalysisResult]);

  const handleCreateModule = useCallback(async () => {
    if (!designResult) {
      setError('No design result available');
      return;
    }

    try {
      aiLogger.logFlowStep('module-creation', 'Starting Module Creation', 'start');
      
      const response = await fetch('/api/create-module', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sections: designResult.sections,
          metadata: {
            name: originalFileName?.replace(/\.[^/.]+$/, "") || 'untitled',
            description: 'Generated HubSpot module from design',
            version: '1.0.0'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create module');
      }

      const result = await response.json();
      
      // Set download info
      setDownloadInfo({
        url: result.downloadUrl,
        fileName: result.fileName
      });

      // Move to module step
      setCurrentStep('module');
      
      aiLogger.logFlowStep('module-creation', 'Module Creation Complete', 'complete', {
        fileName: result.fileName,
        sections: designResult.sections?.length || 0
      });

    } catch (error) {
      console.error('Module creation failed:', error);
      setError(error instanceof Error ? error.message : 'Module creation failed');
      aiLogger.logFlowStep('module-creation', 'Module Creation Failed', 'error', { 
        error: String(error) 
      });
    }
  }, [designResult, originalFileName, setError, setDownloadInfo, setCurrentStep]);

  const handleHybridSectionsConfirmed = useCallback(async (confirmedSections: any[]) => {
    try {
      if (!uploadedImageFile) {
        throw new Error('No image file available');
      }

      aiLogger.logFlowStep('hybrid-confirm', 'Processing Confirmed Sections', 'start', {
        sectionsCount: confirmedSections.length
      });

      // Generate HTML for the confirmed sections
      const result = await hybridLayoutService.generateHTML(confirmedSections, uploadedImageFile);
      
      // Convert to PipelineExecutionResult format
      const pipelineResult: PipelineExecutionResult = {
        id: `hybrid-${Date.now()}`,
        sections: result.analysis.sections.map((section: any) => ({
          id: section.id,
          name: section.name,
          type: section.type,
          html: section.html,
          editableFields: section.editableFields || []
        })),
        qualityScore: result.qualityScore || 0.9,
        processingTime: 0,
        validationPassed: true,
        enhancementsApplied: [],
        packagedModule: {
          id: `hybrid-module-${Date.now()}`,
          name: 'Hybrid Generated Module',
          version: '1.0.0',
          files: {
            'module.html': result.analysis.html,
            'module.css': '',
            'module.js': ''
          },
          metadata: {
            created: new Date().toISOString(),
            size: result.analysis.html.length,
            format: 'hubspot-module'
          }
        },
        metadata: {
          phaseTimes: { 'hybrid-generation': 0 },
          totalSections: result.analysis.sections.length,
          averageQuality: result.qualityScore || 0.9,
          timestamp: new Date().toISOString(),
          aiModelsUsed: ['hybrid-layout-gpt-4o'],
          processingSteps: ['hybrid-analysis', 'section-generation']
        }
      };

      setDesignResult(pipelineResult);

      setCurrentStep('editor');
      
      aiLogger.logFlowStep('hybrid-confirm', 'Hybrid Sections Processing Complete', 'complete', {
        sectionsProcessed: confirmedSections.length,
        htmlGenerated: true
      });

    } catch (error) {
      console.error('Hybrid sections confirmation failed:', error);
      setError('Failed to process confirmed sections. Please try again.');
      aiLogger.logFlowStep('hybrid-confirm', 'Hybrid Sections Processing Failed', 'error', { 
        error: String(error) 
      });
    }
  }, [uploadedImageFile, setDesignResult, setCurrentStep, setError]);

  const submitHybridFeedback = useCallback(async (originalSections: any[], finalSections: any[]) => {
    try {
      aiLogger.logFlowStep('hybrid-feedback', 'Submitting User Feedback', 'start');
      
      await hybridLayoutService.submitFeedback(
        originalSections,
        finalSections,
        0.9, // satisfactionScore
        'User feedback from hybrid workflow' // comments
      );
      
      aiLogger.logFlowStep('hybrid-feedback', 'User Feedback Submitted', 'complete');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      aiLogger.logFlowStep('hybrid-feedback', 'Feedback Submission Failed', 'error', { 
        error: String(error) 
      });
    }
  }, []);

  return {
    handleUploadSuccess,
    handleUploadError,
    handleHybridLayoutSelection,
    handleCreateModule,
    handleHybridSectionsConfirmed,
    submitHybridFeedback,
  };
}
