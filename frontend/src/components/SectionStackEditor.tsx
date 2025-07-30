'use client';

import React, { useState } from 'react';
import { 
  Eye, 
  Edit3, 
  Download, 
  ChevronDown, 
  ChevronRight, 
  Code, 
  Settings,
  Package,
  Check,
  X,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { PipelineExecutionResult, PipelineSection, pipelineService } from '../services/pipelineService';
import { aiLogger } from '../services/aiLogger';
import { API_ENDPOINTS } from '../config/api';

interface SectionStackEditorProps {
  designResult: PipelineExecutionResult;
  splittingResult?: any;
  onSectionUpdate?: (sectionId: string, updatedSection: PipelineSection) => void;
  onCreateModuleFromSection?: (section: PipelineSection) => void;
}

interface SectionState {
  isExpanded: boolean;
  isEditing: boolean;
  editedHtml: string;
  isCreatingModule: boolean;
  moduleCreated: boolean;
  isRegenerating: boolean;
  showOriginalImage: boolean;
}

const SectionStackEditor: React.FC<SectionStackEditorProps> = ({
  designResult,
  splittingResult,
  onSectionUpdate,
  onCreateModuleFromSection
}) => {
  const [sectionStates, setSectionStates] = useState<Record<string, SectionState>>(() => {
    const initialStates: Record<string, SectionState> = {};
    designResult.sections?.forEach(section => {
      initialStates[section.id] = {
        isExpanded: true,
        isEditing: false,
        editedHtml: section.html,
        isCreatingModule: false,
        moduleCreated: false,
        isRegenerating: false,
        showOriginalImage: false
      };
    });
    return initialStates;
  });

  const updateSectionState = (sectionId: string, updates: Partial<SectionState>) => {
    setSectionStates(prev => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], ...updates }
    }));
  };

  const toggleExpanded = (sectionId: string) => {
    updateSectionState(sectionId, { 
      isExpanded: !sectionStates[sectionId]?.isExpanded 
    });
  };

  const startEditing = (sectionId: string) => {
    updateSectionState(sectionId, { isEditing: true });
    aiLogger.info('system', 'Started editing section', { sectionId });
  };

  const saveSection = (sectionId: string) => {
    const section = designResult.sections?.find(s => s.id === sectionId);
    if (!section) return;

    const editedHtml = sectionStates[sectionId]?.editedHtml || section.html;
    const updatedSection = { ...section, html: editedHtml };
    
    updateSectionState(sectionId, { isEditing: false });
    onSectionUpdate?.(sectionId, updatedSection);
    
    aiLogger.success('system', 'Section saved', { 
      sectionId, 
      htmlLength: editedHtml.length 
    });
  };

  const cancelEditing = (sectionId: string) => {
    const section = designResult.sections?.find(s => s.id === sectionId);
    if (!section) return;

    updateSectionState(sectionId, { 
      isEditing: false,
      editedHtml: section.html
    });
  };

  const toggleOriginalImage = (sectionId: string) => {
    updateSectionState(sectionId, { 
      showOriginalImage: !sectionStates[sectionId]?.showOriginalImage 
    });
  };

  const regenerateHTML = async (sectionId: string) => {
    const section = designResult.sections?.find(s => s.id === sectionId);
    if (!section) return;

    const requestId = `regenerate_${Date.now()}`;
    updateSectionState(sectionId, { isRegenerating: true });

    try {
      aiLogger.info('processing', 'Regenerating HTML for section', {
        sectionId: section.id,
        sectionName: section.name,
        sectionType: section.type
      }, requestId);

      const regeneratedSection = await pipelineService.regenerateHTML(
        sectionId, 
        section.originalImage,
        `Please regenerate HTML for this ${section.type} section with improved quality and Tailwind 4 styling.`
      );

      // Update the section with regenerated HTML
      updateSectionState(sectionId, { 
        isRegenerating: false,
        editedHtml: regeneratedSection.html
      });

      // Notify parent component of the update
      onSectionUpdate?.(sectionId, regeneratedSection);

      aiLogger.success('processing', 'HTML regenerated successfully', {
        sectionId,
        newHtmlLength: regeneratedSection.html.length,
        fieldsCount: regeneratedSection.editableFields?.length || 0
      }, requestId);

    } catch (error) {
      updateSectionState(sectionId, { isRegenerating: false });
      aiLogger.error('processing', 'Failed to regenerate HTML', {
        sectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, requestId);
    }
  };

  const createModuleFromSection = async (section: PipelineSection) => {
    const requestId = `section_module_${Date.now()}`;
    updateSectionState(section.id, { isCreatingModule: true });

    try {
      aiLogger.info('processing', 'Creating HubSpot module from section', {
        sectionId: section.id,
        sectionName: section.name,
        fieldsCount: section.editableFields?.length || 0
      }, requestId);

      // Convert section fields to HubSpot format
      const fieldsConfig = section.editableFields?.map(field => ({
        id: field.id,
        label: field.name,
        type: field.type === 'rich_text' ? 'richtext' : field.type,
        required: field.required || false,
        default: field.defaultValue || ''
      })) || [];

      const sectionHtml = sectionStates[section.id]?.editedHtml || section.html;

      const response = await fetch(API_ENDPOINTS.MODULE_GENERATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html_normalized: sectionHtml,
          fields_config: fieldsConfig,
          section_info: {
            id: section.id,
            name: section.name,
            type: section.type
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create module from section');
      }

      const result = await response.json();
      
      if (result.module_zip_url) {
        // Download the module
        const downloadUrl = result.module_zip_url.startsWith('http') 
          ? result.module_zip_url 
          : `${API_ENDPOINTS.DESIGN_UPLOAD.replace('/api/design/upload', '')}${result.module_zip_url}`;

        const downloadResponse = await fetch(downloadUrl);
        if (downloadResponse.ok) {
          const blob = await downloadResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${section.name || section.id}-hubspot-module.zip`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          updateSectionState(section.id, { 
            isCreatingModule: false, 
            moduleCreated: true 
          });

          aiLogger.success('processing', 'Section module created and downloaded', {
            sectionId: section.id,
            moduleSlug: result.module_slug,
            downloadUrl
          }, requestId);

          onCreateModuleFromSection?.(section);
        }
      }
    } catch (error) {
      updateSectionState(section.id, { isCreatingModule: false });
      aiLogger.error('processing', 'Failed to create module from section', {
        sectionId: section.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, requestId);
    }
  };

  const getSectionTypeColor = (type: string) => {
    const colors = {
      header: 'bg-purple-100 text-purple-800 border-purple-200',
      hero: 'bg-blue-100 text-blue-800 border-blue-200',
      content: 'bg-green-100 text-green-800 border-green-200',
      footer: 'bg-gray-100 text-gray-800 border-gray-200',
      sidebar: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      navigation: 'bg-indigo-100 text-indigo-800 border-indigo-200'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (!designResult.sections || designResult.sections.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No sections available for editing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Edit Sections Individually
        </h2>
        <p className="text-gray-600">
          Each section can be edited and converted to a HubSpot module separately.
        </p>
      </div>

      {designResult.sections.map((section, index) => {
        const state = sectionStates[section.id] || {
          isExpanded: true,
          isEditing: false,
          editedHtml: section.html,
          isCreatingModule: false,
          moduleCreated: false,
          isRegenerating: false,
          showOriginalImage: false
        };
        
        return (
          <div key={section.id} className="bg-white rounded-lg border shadow-sm">
            {/* Section Header */}
            <div className="p-4 border-b bg-gray-50 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toggleExpanded(section.id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {state.isExpanded ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                  
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-900">
                      Section {index + 1}: {section.name || section.id}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSectionTypeColor(section.type)}`}>
                      {section.type}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {state.moduleCreated && (
                    <span className="flex items-center space-x-1 text-green-600 text-sm">
                      <Check className="w-4 h-4" />
                      <span>Module Created</span>
                    </span>
                  )}
                  
                  {/* Toggle Original Image Button */}
                  {section.originalImage && (
                    <button
                      onClick={() => toggleOriginalImage(section.id)}
                      className="flex items-center space-x-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-200 text-sm"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>
                        {state.showOriginalImage ? 'Hide Image' : 'Show Original'}
                      </span>
                    </button>
                  )}
                  
                  {/* Regenerate HTML Button */}
                  <button
                    onClick={() => regenerateHTML(section.id)}
                    disabled={state.isRegenerating}
                    className="flex items-center space-x-1 bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${state.isRegenerating ? 'animate-spin' : ''}`} />
                    <span>
                      {state.isRegenerating ? 'Regenerating...' : 'Regenerate HTML'}
                    </span>
                  </button>
                  
                  <button
                    onClick={() => createModuleFromSection(section)}
                    disabled={state.isCreatingModule}
                    className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    <Package className="w-4 h-4" />
                    <span>
                      {state.isCreatingModule ? 'Creating...' : 'Create Module'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Section Content */}
            {state.isExpanded && (
              <div className="p-6 space-y-6">
                {/* Original Image Display */}
                {state.showOriginalImage && section.originalImage && (
                  <div className="bg-gray-50 rounded-lg p-4 border">
                    <h4 className="font-medium text-gray-700 mb-3 flex items-center space-x-2">
                      <ImageIcon className="w-4 h-4" />
                      <span>Original Section Image</span>
                    </h4>
                    <div className="flex justify-center">
                      <img 
                        src={section.originalImage} 
                        alt={`Original ${section.name} section`}
                        className="max-w-full max-h-96 rounded-lg shadow-sm border"
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      This is the original section from your uploaded design that AI used to generate the HTML below.
                    </p>
                  </div>
                )}

                {/* Section Info */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <label className="font-medium text-gray-700">HTML Size</label>
                    <p className="text-gray-600">{section.html.length} characters</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Editable Fields</label>
                    <p className="text-gray-600">{section.editableFields?.length || 0} fields</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Section Type</label>
                    <p className="text-gray-600">{section.type}</p>
                  </div>
                </div>

                {/* HTML Editor */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="font-medium text-gray-700">HTML Content</label>
                    <div className="flex items-center space-x-2">
                      {state.isEditing ? (
                        <>
                          <button
                            onClick={() => saveSection(section.id)}
                            className="flex items-center space-x-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                          >
                            <Check className="w-4 h-4" />
                            <span>Save</span>
                          </button>
                          <button
                            onClick={() => cancelEditing(section.id)}
                            className="flex items-center space-x-1 bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
                          >
                            <X className="w-4 h-4" />
                            <span>Cancel</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEditing(section.id)}
                          className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {state.isEditing ? (
                    <textarea
                      value={(state.editedHtml || section.html).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t')}
                      onChange={(e) => updateSectionState(section.id, { editedHtml: e.target.value })}
                      className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Edit HTML content..."
                    />
                  ) : (
                    <div className="bg-gray-50 rounded-lg border">
                      {/* HTML Preview */}
                      <div className="p-4 border-b">
                        <h4 className="font-medium text-gray-700 mb-2">Preview</h4>
                        <div 
                          className="bg-white rounded border p-4 max-h-64 overflow-auto"
                          dangerouslySetInnerHTML={{ 
                            __html: (state.editedHtml || section.html).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t') 
                          }}
                        />
                      </div>
                      
                      {/* HTML Code */}
                      <div className="p-4">
                        <h4 className="font-medium text-gray-700 mb-2">HTML Code</h4>
                        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-32">
                          <code>{(state.editedHtml || section.html).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t')}</code>
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Editable Fields */}
                {section.editableFields && section.editableFields.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">
                      Editable Fields ({section.editableFields.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {section.editableFields.map((field, fieldIndex) => (
                        <div key={field.id} className="bg-gray-50 rounded-lg p-4 border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">{field.name}</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              field.required ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {field.required ? 'Required' : 'Optional'}
                            </span>
                          </div>
                          <div className="space-y-2 text-sm text-gray-600">
                            <p><strong>ID:</strong> <code className="bg-white px-1 rounded">{field.id}</code></p>
                            <p><strong>Type:</strong> {field.type}</p>
                            <p><strong>Selector:</strong> <code className="bg-white px-1 rounded text-xs">{field.selector}</code></p>
                            {field.defaultValue && (
                              <p><strong>Default:</strong> <span className="italic">{field.defaultValue}</span></p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">📋 Section Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium text-blue-800">Total Sections:</span>
            <p className="text-blue-700">{designResult.sections.length}</p>
          </div>
          <div>
            <span className="font-medium text-blue-800">Modules Created:</span>
            <p className="text-blue-700">
              {Object.values(sectionStates).filter(s => s.moduleCreated).length}
            </p>
          </div>
          <div>
            <span className="font-medium text-blue-800">Currently Editing:</span>
            <p className="text-blue-700">
              {Object.values(sectionStates).filter(s => s.isEditing).length}
            </p>
          </div>
          <div>
            <span className="font-medium text-blue-800">Total Fields:</span>
            <p className="text-blue-700">
              {designResult.sections.reduce((total, section) => 
                total + (section.editableFields?.length || 0), 0
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SectionStackEditor;
