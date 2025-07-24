'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, Image, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import { aiLogger } from '../services/aiLogger';

interface DesignUploadProps {
  onUploadSuccess: (result: DesignAnalysisResult) => void;
  onUploadError: (error: string) => void;
}

interface DesignAnalysisResult {
  fileName: string;
  fileSize: number;
  analysis: {
    html: string;
    sections: Section[];
    components: Component[];
    description: string;
  };
}

interface Section {
  id: string;
  name: string;
  type: 'header' | 'hero' | 'content' | 'footer' | 'sidebar' | 'navigation';
  html: string;
  editableFields: EditableField[];
}

interface Component {
  id: string;
  name: string;
  type: 'text' | 'image' | 'button' | 'link' | 'form' | 'list';
  selector: string;
  defaultValue: string;
}

interface EditableField {
  id: string;
  name: string;
  type: 'text' | 'rich_text' | 'image' | 'url' | 'boolean';
  selector: string;
  defaultValue: string;
  required: boolean;
}

export default function DesignUpload({ onUploadSuccess, onUploadError }: DesignUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    const startTime = Date.now();
    const requestId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setIsUploading(true);
    setUploadProgress(0);

    // Log upload start
    aiLogger.logUploadStart(requestId, selectedFile.name, selectedFile.size);
    aiLogger.info('processing', 'Starting design-to-HTML conversion process', {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type
    }, requestId);

    try {
      const formData = new FormData();
      formData.append('design', selectedFile);

      // Enhanced progress tracking with logging
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = Math.min(prev + 8, 85);
          if (newProgress > prev) {
            aiLogger.logUploadProgress(requestId, newProgress);
            
            // Log different stages based on progress
            if (newProgress >= 20 && prev < 20) {
              aiLogger.info('processing', 'File uploaded, starting AI analysis', {}, requestId);
            } else if (newProgress >= 50 && prev < 50) {
              aiLogger.info('openai', 'OpenAI processing design image', {}, requestId);
            } else if (newProgress >= 70 && prev < 70) {
              aiLogger.info('processing', 'Generating HTML structure', {}, requestId);
            }
          }
          return newProgress;
        });
      }, 300);

      const response = await fetch(API_ENDPOINTS.DESIGN_UPLOAD, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(95);

      if (!response.ok) {
        const errorData = await response.json();
        const duration = Date.now() - startTime;
        aiLogger.logUploadError(requestId, errorData.message || 'Upload failed', duration);
        aiLogger.error('network', 'API request failed', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        }, requestId);
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      const duration = Date.now() - startTime;
      
      setUploadProgress(100);
      aiLogger.logUploadSuccess(requestId, selectedFile.name, duration);
      aiLogger.success('processing', 'Design-to-HTML conversion completed successfully', {
        sectionsGenerated: result.data?.analysis?.sections?.length || 0,
        componentsGenerated: result.data?.analysis?.components?.length || 0,
        htmlLength: result.data?.analysis?.html?.length || 0
      }, requestId, duration);
      
      setTimeout(() => {
        onUploadSuccess(result.data);
        setIsUploading(false);
        setSelectedFile(null);
        setUploadProgress(0);
        aiLogger.info('system', 'Upload process completed, UI updated', {}, requestId);
      }, 500);

    } catch (error) {
      const duration = Date.now() - startTime;
      setIsUploading(false);
      setUploadProgress(0);
      
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      aiLogger.logUploadError(requestId, errorMessage, duration);
      aiLogger.error('system', 'Upload process failed', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      }, requestId);
      
      onUploadError(errorMessage);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Upload Area */}
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
                Converting Design to HTML...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {uploadProgress < 90 ? 'Uploading...' : 'AI is analyzing your design...'}
              </p>
            </div>
          </div>
        ) : selectedFile ? (
          <div className="space-y-4">
            <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
            <div className="space-y-2">
              <p className="text-lg font-semibold text-gray-900">
                {selectedFile.name}
              </p>
              <p className="text-sm text-gray-600">
                {formatFileSize(selectedFile.size)} • Ready to convert
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  uploadFile();
                }}
                className="btn-primary mt-4"
              >
                <Upload className="w-4 h-4 mr-2" />
                Convert to HTML
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

      {/* Tips */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Tips for Best Results</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Use high-resolution images for better AI analysis</li>
          <li>• Ensure text and elements are clearly visible</li>
          <li>• PNG format works best for designs with text</li>
          <li>• Clean, well-organized layouts convert better</li>
        </ul>
      </div>
    </div>
  );
}
