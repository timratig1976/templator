'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, Image, FileText, Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import { aiLogger } from '../services/aiLogger';
import { pipelineService, PipelineExecutionResult, PipelineStatus } from '../services/pipelineService';

interface DesignUploadProps {
  onUploadSuccess: (result: PipelineExecutionResult, fileName?: string, imageFile?: File) => void;
  onUploadError: (error: string) => void;
  onHybridLayoutSelected?: (imageFile: File, fileName: string) => void;
}

export default function DesignUpload({ onUploadSuccess, onUploadError, onHybridLayoutSelected }: DesignUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [showProcessingOptions, setShowProcessingOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedTypes = [
    { ext: 'PNG', desc: 'High-quality designs' },
    { ext: 'JPG', desc: 'Photos and mockups' },
    { ext: 'GIF', desc: 'Animated designs' },
    { ext: 'WebP', desc: 'Modern format' }
  ];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, []);

  const handleFileSelection = (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      onUploadError('Please upload a valid image file (PNG, JPG, GIF, or WebP)');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      onUploadError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setShowProcessingOptions(true);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handlePipelineProgress = (status: PipelineStatus) => {
    setPipelineStatus(status);
    setCurrentPhase(status.currentPhase);
    setUploadProgress(status.progress);

    // Log progress updates using 'processing' category
    aiLogger.info('processing', `Pipeline ${status.status}: ${status.currentPhase}`, {
      pipelineId: status.pipelineId,
      progress: status.progress,
      phase: status.currentPhase,
      phases: status.phases.map(p => ({ name: p.name, status: p.status, progress: p.progress }))
    });
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    const startTime = Date.now();
    const requestId = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setIsUploading(true);
    setUploadProgress(0);
    setCurrentPhase('Initializing');
    setPipelineStatus(null);

    // Log upload start
    aiLogger.logUploadStart(requestId, selectedFile.name, selectedFile.size);
    aiLogger.info('processing', 'Starting modular 5-phase pipeline process', {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type
    }, requestId);

    try {
      // Execute pipeline with progress tracking
      const result = await pipelineService.executePipelineWithProgress(
        selectedFile,
        handlePipelineProgress
      );

      const processingTime = Date.now() - startTime;

      // Log successful completion - fix logUploadSuccess call
      aiLogger.logUploadSuccess(requestId, processingTime.toString(), processingTime);

      aiLogger.info('processing', 'Modular pipeline completed successfully', {
        pipelineId: result.id,
        totalSections: result.sections.length,
        qualityScore: result.qualityScore,
        processingTime: result.processingTime,
        phases: Object.keys(result.metadata.phaseTimes),
        validationStatus: result.validationPassed ? 'passed' : 'failed'
      }, requestId);

      // Call success callback with pipeline result and image file for hybrid layout analysis
      onUploadSuccess(result, selectedFile.name, selectedFile);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Handle pipeline-specific errors
      if (error instanceof Error && 'code' in error) {
        const pipelineError = error as any;
        aiLogger.logUploadError(requestId, pipelineError.message, processingTime);

        aiLogger.error('processing', `Pipeline failed in ${pipelineError.phase || 'unknown'} phase: ${pipelineError.message}`, {
          errorCode: pipelineError.code,
          phase: pipelineError.phase,
          details: pipelineError.details
        }, requestId);

        onUploadError(`Pipeline Error (${pipelineError.code}): ${pipelineError.message}`);
      } else {
        // Handle generic errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        aiLogger.logUploadError(requestId, errorMessage, processingTime);

        aiLogger.error('processing', `Unexpected error during pipeline execution: ${errorMessage}`, {
          error: error instanceof Error ? error.stack : error
        }, requestId);

        onUploadError(`Upload failed: ${errorMessage}`);
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentPhase('');
      setPipelineStatus(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPhaseDisplayName = (phase: string): string => {
    const phaseNames: Record<string, string> = {
      'input_processing': 'Processing Input',
      'ai_generation': 'AI Analysis',
      'quality_assurance': 'Quality Check',
      'enhancement': 'Enhancement',
      'module_packaging': 'Packaging'
    };
    return phaseNames[phase] || phase;
  };

  const getProgressMessage = (): string => {
    if (!pipelineStatus) {
      if (uploadProgress < 20) return 'Uploading file...';
      if (uploadProgress < 40) return 'Processing input...';
      return 'Starting AI analysis...';
    }

    const currentPhaseStatus = pipelineStatus.phases.find(p => p.status === 'running');
    if (currentPhaseStatus) {
      return `${getPhaseDisplayName(currentPhaseStatus.name)}...`;
    }

    return `${getPhaseDisplayName(pipelineStatus.currentPhase)}...`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`
          relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300
          ${isDragging 
            ? 'border-blue-400 bg-blue-50 scale-105' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${isUploading ? 'pointer-events-none opacity-75' : 'cursor-pointer hover:bg-gray-50'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {isUploading ? (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-blue-600 animate-spin" />
            <div className="space-y-2">
              <p className="text-lg font-semibold text-gray-900">
                Converting Design with AI Pipeline...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {getProgressMessage()}
              </p>
              
              {/* Phase Progress Indicators */}
              {pipelineStatus && (
                <div className="mt-4 grid grid-cols-5 gap-2">
                  {pipelineStatus.phases.map((phase, index) => (
                    <div key={phase.name} className="text-center">
                      <div className={`
                        w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-semibold
                        ${phase.status === 'completed' ? 'bg-green-500 text-white' : 
                          phase.status === 'running' ? 'bg-blue-500 text-white animate-pulse' :
                          phase.status === 'failed' ? 'bg-red-500 text-white' :
                          'bg-gray-300 text-gray-600'}
                      `}>
                        {index + 1}
                      </div>
                      <p className="text-xs mt-1 text-gray-600">
                        {getPhaseDisplayName(phase.name)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : selectedFile && showProcessingOptions ? (
          <div className="space-y-6">
            <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
            <div className="space-y-2">
              <p className="text-lg font-semibold text-gray-900">
                {selectedFile.name}
              </p>
              <p className="text-sm text-gray-600">
                {formatFileSize(selectedFile.size)} • Choose processing method
              </p>
            </div>
            
            {/* Processing Options */}
            <div className="grid gap-4">
              <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50 hover:bg-blue-100 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900 mb-1">🎯 Hybrid AI + User Layout Splitting</h4>
                    <p className="text-sm text-blue-800 mb-3">
                      AI analyzes your design and suggests section boundaries. You can then interactively adjust, add, or remove sections using a visual canvas before generating HTML.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-blue-700 mb-3">
                      <span className="bg-blue-200 px-2 py-1 rounded">✨ AI Section Detection</span>
                      <span className="bg-blue-200 px-2 py-1 rounded">🖱️ Interactive Canvas</span>
                      <span className="bg-blue-200 px-2 py-1 rounded">🎨 Visual Editing</span>
                      <span className="bg-blue-200 px-2 py-1 rounded">🎯 Higher Accuracy</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onHybridLayoutSelected) {
                          onHybridLayoutSelected(selectedFile, selectedFile.name);
                        }
                      }}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <Zap className="w-4 h-4 mr-2 inline" />
                      Use Hybrid Layout Splitting
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="border-2 border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">⚡ Traditional AI Pipeline</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Direct AI processing through the 5-phase pipeline. Fast and automated with quality assurance and enhancement phases.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-3">
                      <span className="bg-gray-200 px-2 py-1 rounded">🚀 5-Phase Processing</span>
                      <span className="bg-gray-200 px-2 py-1 rounded">⚡ Fast & Automated</span>
                      <span className="bg-gray-200 px-2 py-1 rounded">🔍 Quality Assurance</span>
                      <span className="bg-gray-200 px-2 py-1 rounded">📦 HubSpot Ready</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        uploadFile();
                      }}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                    >
                      <Upload className="w-4 h-4 mr-2 inline" />
                      Use Traditional Pipeline
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => {
                setSelectedFile(null);
                setShowProcessingOptions(false);
              }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Choose different file
            </button>
          </div>
        ) : selectedFile ? (
          <div className="space-y-4">
            <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
            <div className="space-y-2">
              <p className="text-lg font-semibold text-gray-900">
                {selectedFile.name}
              </p>
              <p className="text-sm text-gray-600">
                {formatFileSize(selectedFile.size)} • Ready for AI Pipeline
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  uploadFile();
                }}
                className="btn-primary mt-4"
              >
                <Upload className="w-4 h-4 mr-2" />
                Process with AI Pipeline
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-blue-100 rounded-full">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-gray-900">
                Upload Your Design
              </h3>
              <p className="text-gray-600">
                Drag and drop your design file here, or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Supports PNG, JPG, GIF, WebP • Max 10MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Supported Formats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {supportedTypes.map((type) => (
          <div key={type.ext} className="text-center p-3 bg-gray-50 rounded-lg">
            <Image className="w-6 h-6 mx-auto mb-1 text-gray-600" />
            <p className="text-sm font-medium text-gray-900">{type.ext}</p>
            <p className="text-xs text-gray-600">{type.desc}</p>
          </div>
        ))}
      </div>

      {/* Enhanced Tips for Pipeline */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">🚀 AI Pipeline Features</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>5-Phase Processing:</strong> Input → AI → Quality → Enhancement → Packaging</li>
          <li>• <strong>Real-time Progress:</strong> Track each phase with live updates</li>
          <li>• <strong>Quality Scoring:</strong> Automatic quality assessment and validation</li>
          <li>• <strong>Smart Enhancement:</strong> AI-powered improvements and error correction</li>
          <li>• <strong>HubSpot Ready:</strong> Fully validated and packaged modules</li>
        </ul>
      </div>
    </div>
  );
}
