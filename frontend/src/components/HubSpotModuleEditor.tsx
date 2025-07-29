'use client';

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Edit3, 
  Save, 
  Eye,
  FileText,
  Code,
  Settings,
  ChevronDown,
  ChevronRight,
  Palette
} from 'lucide-react';
import { aiLogger } from '../services/aiLogger';
import { API_ENDPOINTS } from '../config/api';
import { PipelineExecutionResult } from '../services/pipelineService';

interface HubSpotModuleFile {
  name: string;
  content: string;
  type: 'html' | 'css' | 'js' | 'json';
  description: string;
}

interface HubSpotModuleEditorProps {
  designResult: PipelineExecutionResult;
}

const HubSpotModuleEditor: React.FC<HubSpotModuleEditorProps> = ({ designResult }) => {
  const [moduleFiles, setModuleFiles] = useState<HubSpotModuleFile[]>([]);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set(['module.html']));
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    generateHubSpotModuleFiles();
  }, [designResult]);

  const generateHubSpotModuleFiles = () => {
    const requestId = `hubspot_editor_${Date.now()}`;
    
    const moduleName = designResult.packagedModule?.name || 'Generated Module';
    const combinedHtml = designResult.sections?.map(s => s.html).join('\n') || '';
    
    aiLogger.info('processing', 'Generating HubSpot module files for editor', {
      fileName: moduleName,
      sectionsCount: designResult.sections?.length || 0
    }, requestId);

    // Generate fields.json for HubSpot
    const fieldsConfig = designResult.sections?.flatMap(section => 
      section.editableFields?.map((field: any) => ({
        id: field.id,
        label: field.name,
        type: field.type === 'rich_text' ? 'richtext' : field.type,
        required: field.required || false,
        default: field.defaultValue || ''
      })) || []
    );

    const files: HubSpotModuleFile[] = [
      {
        name: 'module.html',
        type: 'html',
        description: 'Main HTML template for the HubSpot module',
        content: combinedHtml
      },
      {
        name: 'fields.json',
        type: 'json',
        description: 'HubSpot field definitions for editable content',
        content: JSON.stringify(fieldsConfig, null, 2)
      },
      {
        name: 'meta.json',
        type: 'json',
        description: 'HubSpot module metadata and configuration',
        content: JSON.stringify({
          label: moduleName.replace(/\.[^/.]+$/, '') + ' Module',
          css_assets: [],
          external_js: [],
          global: false,
          help_text: designResult.metadata?.processingSteps?.join(', ') || 'Custom HubSpot module generated from design',
          host_template_types: ['PAGE', 'BLOG_POST', 'BLOG_LISTING'],
          module_id: Date.now(),
          no_wrapper: false,
          path: `/${moduleName.replace(/\.[^/.]+$/, '')}-module`,
          smart_type: 'NOT_SMART',
          tags: ['custom', 'generated'],
          wrap_field_tag: 'div'
        }, null, 2)
      },
      {
        name: 'module.css',
        type: 'css',
        description: 'Custom CSS styles for the module',
        content: `/* HubSpot Module CSS */
/* Generated from: ${moduleName} */

.custom-module {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

/* Section Styles */
${designResult.sections?.map((section: any) => `
.section-${section.id} {
  /* ${section.name} - ${section.type} */
  margin-bottom: 2rem;
}
`).join('\n') || ''}

/* Responsive Design */
@media (max-width: 768px) {
  .custom-module {
    padding: 0 1rem;
  }
}

/* Add your custom styles here */`
      },
      {
        name: 'module.js',
        type: 'js',
        description: 'JavaScript functionality for the module',
        content: `// HubSpot Module JavaScript
// Generated from: ${moduleName}

document.addEventListener('DOMContentLoaded', function() {
  // Initialize module functionality
  console.log('HubSpot module loaded');
  
  // Add your custom JavaScript here
  
  // Example: Handle interactive elements
  const interactiveElements = document.querySelectorAll('[data-interactive]');
  interactiveElements.forEach(element => {
    element.addEventListener('click', function() {
      console.log('Interactive element clicked:', this);
    });
  });
});`
      }
    ];

    setModuleFiles(files);
    aiLogger.success('processing', 'HubSpot module files generated', {
      filesCount: files.length,
      fieldsCount: fieldsConfig.length
    }, requestId);
  };

  const toggleFileExpansion = (fileName: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileName)) {
      newExpanded.delete(fileName);
    } else {
      newExpanded.add(fileName);
    }
    setExpandedFiles(newExpanded);
  };

  const startEditing = (fileName: string) => {
    setEditingFile(fileName);
    aiLogger.info('system', 'Started editing file', { fileName });
  };

  const saveFile = (fileName: string, newContent: string) => {
    setModuleFiles(prev => prev.map(file => 
      file.name === fileName 
        ? { ...file, content: newContent }
        : file
    ));
    setEditingFile(null);
    aiLogger.success('system', 'File saved', { fileName, contentLength: newContent.length });
  };

  const downloadHubSpotModule = async () => {
    const requestId = `download_${Date.now()}`;
    setIsDownloading(true);

    try {
      const moduleName = designResult.packagedModule?.name || 'Generated Module';
      aiLogger.info('processing', 'Starting HubSpot module download', {
        filesCount: moduleFiles.length,
        moduleName: moduleName
      }, requestId);

      // Convert sections and components to fields_config format for backend
      const fieldsConfig = designResult.sections?.flatMap(section => 
        section.editableFields?.map((field: any) => ({
          id: field.id,
          label: field.name,
          type: field.type === 'rich_text' ? 'richtext' : field.type,
          required: field.required || false
        })) || []
      );

      // Get the current HTML content (in case user modified it)
      const htmlFile = moduleFiles.find(f => f.name === 'module.html');
      const combinedHtml = designResult.sections?.map(s => s.html).join('\n') || '';
      const htmlContent = htmlFile?.content || combinedHtml;

      const response = await fetch(API_ENDPOINTS.MODULE_GENERATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html_normalized: htmlContent,
          fields_config: fieldsConfig,
          custom_files: moduleFiles.reduce((acc, file) => {
            acc[file.name] = file.content;
            return acc;
          }, {} as Record<string, string>)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate module');
      }

      const result = await response.json();
      
      if (result.module_zip_url) {
        // Download the ZIP file
        const downloadUrl = result.module_zip_url.startsWith('http') 
          ? result.module_zip_url 
          : `${API_ENDPOINTS.DESIGN_UPLOAD.replace('/api/design/upload', '')}${result.module_zip_url}`;

        const downloadResponse = await fetch(downloadUrl);
        if (downloadResponse.ok) {
          const blob = await downloadResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${moduleName.replace(/\.[^/.]+$/, '')}-hubspot-module.zip`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          aiLogger.success('system', 'HubSpot module downloaded successfully', {
            fileName: a.download,
            fileSize: `${(blob.size / 1024).toFixed(1)} KB`
          }, requestId);
        }
      }
    } catch (error) {
      aiLogger.error('system', 'Failed to download HubSpot module', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, requestId);
    } finally {
      setIsDownloading(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'html': return <Code className="w-4 h-4 text-orange-600" />;
      case 'css': return <Palette className="w-4 h-4 text-blue-600" />;
      case 'js': return <FileText className="w-4 h-4 text-yellow-600" />;
      case 'json': return <Settings className="w-4 h-4 text-green-600" />;
      default: return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">HubSpot Module Editor</h2>
          <p className="text-gray-600">Edit each part of your HubSpot module before downloading</p>
        </div>
        <button
          onClick={downloadHubSpotModule}
          disabled={isDownloading}
          className="flex items-center px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
        >
          <Download className="w-5 h-5 mr-2" />
          {isDownloading ? 'Generating ZIP...' : 'Download ZIP'}
        </button>
      </div>

      {/* Module Files Stack */}
      <div className="space-y-4">
        {moduleFiles.map((file) => (
          <div key={file.name} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* File Header */}
            <div 
              className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
              onClick={() => toggleFileExpansion(file.name)}
            >
              <div className="flex items-center space-x-3">
                {expandedFiles.has(file.name) ? 
                  <ChevronDown className="w-4 h-4 text-gray-500" /> : 
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                }
                {getFileIcon(file.type)}
                <div>
                  <h3 className="font-semibold text-gray-900">{file.name}</h3>
                  <p className="text-sm text-gray-600">{file.description}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(file.name);
                  }}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* File Content */}
            {expandedFiles.has(file.name) && (
              <div className="p-4 bg-white">
                {editingFile === file.name ? (
                  <FileEditor
                    fileName={file.name}
                    content={file.content}
                    onSave={(content) => saveFile(file.name, content)}
                    onCancel={() => setEditingFile(null)}
                  />
                ) : (
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{file.content}</code>
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// File Editor Component
interface FileEditorProps {
  fileName: string;
  content: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

const FileEditor: React.FC<FileEditorProps> = ({ fileName, content, onSave, onCancel }) => {
  const [editContent, setEditContent] = useState(content);

  return (
    <div className="space-y-4">
      <textarea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder={`Edit ${fileName} content...`}
      />
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(editContent)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default HubSpotModuleEditor;
