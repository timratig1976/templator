'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  CloudArrowUpIcon, 
  PhotoIcon,
  TrashIcon,
  EyeIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface StaticFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  dimensions?: { width: number; height: number };
  complexity?: 'low' | 'medium' | 'high';
}

interface StaticFileManagerProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
}

export default function StaticFileManager({ selectedFile, onFileSelect }: StaticFileManagerProps) {
  const [staticFiles, setStaticFiles] = useState<StaticFile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [dragOver, setDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<StaticFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load static files on mount
  useEffect(() => {
    loadStaticFiles();
  }, []);

  const loadStaticFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/static-files/list');
      const result = await response.json();
      
      if (result.success) {
        setStaticFiles(result.data);
      } else {
        console.error('Failed to load static files:', result.error);
      }
    } catch (error) {
      console.error('Error loading static files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const uploads = Array.from(files);
    const doUpload = async (file: File) => {
      if (!file.type.startsWith('image/')) {
        alert('Please upload only image files (png/jpg)');
        return;
      }
      // Convert to data URL for JSON upload
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const resp = await fetch('/api/admin/static-files/upload-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, type: file.type, dataUrl })
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || 'Upload failed');
      }
    };

    (async () => {
      try {
        for (const f of uploads) {
          // eslint-disable-next-line no-await-in-loop
          await doUpload(f);
        }
        await loadStaticFiles();
      } catch (e) {
        console.error('Upload error', e);
        alert('Failed to upload one or more files.');
      }
    })();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files);
    e.target.value = ''; // Reset input
  };

  const handleFileSelect = async (staticFile: StaticFile) => {
    try {
      // Convert static file to File object for testing
      const response = await fetch(`/api/admin/static-files/${staticFile.id}/blob`);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      const blob = await response.blob();
      const file = new File([blob], staticFile.name, { type: staticFile.type });
      onFileSelect(file);
    } catch (error) {
      console.error('Failed to load static file:', error);
      alert(`Failed to load ${staticFile.name}. Please try again.`);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!id.startsWith('u-')) {
      alert('Bundled example files cannot be deleted.');
      return;
    }
    if (!confirm('Delete this uploaded file?')) return;
    try {
      const resp = await fetch(`/api/admin/static-files/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Delete failed');
      await loadStaticFiles();
    } catch (e) {
      console.error('Delete error', e);
      alert('Failed to delete file.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getComplexityColor = (complexity?: string) => {
    switch (complexity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <PhotoIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Static Test Files</h3>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <CloudArrowUpIcon className="h-4 w-4 mr-1.5" />
            Upload
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>

        {/* File List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading test files...</p>
          </div>
        ) : (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Available Test Files</h4>
            <div className="space-y-2">
              {staticFiles.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedFile?.name === file.name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => handleFileSelect(file)}
                >
                  <div className="flex items-center space-x-3">
                    <PhotoIcon className="h-8 w-8 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>{formatFileSize(file.size)}</span>
                        {file.dimensions && (
                          <span>• {file.dimensions.width}×{file.dimensions.height}</span>
                        )}
                        {file.complexity && (
                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getComplexityColor(file.complexity)}`}>
                            {file.complexity}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewFile(file);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected File Info */}
        {selectedFile && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <InformationCircleIcon className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Selected: {selectedFile.name}
                </p>
                <p className="text-xs text-blue-700">
                  This file will be used for prompt testing
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-7xl max-h-[95vh] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">{previewFile.name}</h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {previewFile.type.startsWith('image/') ? (
                <img
                  src={`/api/admin/static-files/${previewFile.id}`}
                  alt={previewFile.name}
                  className="max-w-full max-h-[70vh] object-contain mx-auto"
                  onError={(e) => {
                    // Fallback for missing images
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTUwTDE3NSAxMjVIMjI1TDIwMCAxNTBaIiBmaWxsPSIjOUI5QjlCIi8+CjwvZz4KPC9zdmc+';
                  }}
                />
              ) : previewFile.type.includes('html') ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <iframe
                    src={`/api/admin/static-files/${previewFile.id}`}
                    className="w-full h-[80vh]"
                    title={previewFile.name}
                    sandbox="allow-same-origin"
                    style={{ minHeight: '800px' }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">Preview not available for {previewFile.type}</p>
                    <p className="text-xs text-gray-400">File can still be used for testing</p>
                  </div>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Size:</span>
                  <span className="ml-2 font-medium">{formatFileSize(previewFile.size)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Type:</span>
                  <span className="ml-2 font-medium">{previewFile.type}</span>
                </div>
                {previewFile.dimensions && (
                  <>
                    <div>
                      <span className="text-gray-500">Dimensions:</span>
                      <span className="ml-2 font-medium">
                        {previewFile.dimensions.width}×{previewFile.dimensions.height}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Complexity:</span>
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${getComplexityColor(previewFile.complexity)}`}>
                        {previewFile.complexity || 'unknown'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
