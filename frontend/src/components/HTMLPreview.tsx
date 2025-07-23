'use client';

import React, { useState } from 'react';
import { Eye, Code, Edit3, Download, Layers, Settings } from 'lucide-react';

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

interface HTMLPreviewProps {
  html: string;
  sections: Section[];
  components: Component[];
  description: string;
  fileName: string;
  onCreateModule: () => void;
}

export default function HTMLPreview({ 
  html, 
  sections, 
  components, 
  description, 
  fileName,
  onCreateModule 
}: HTMLPreviewProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'sections'>('preview');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const getSectionTypeColor = (type: Section['type']) => {
    const colors = {
      header: 'bg-purple-100 text-purple-800 border-purple-200',
      hero: 'bg-blue-100 text-blue-800 border-blue-200',
      content: 'bg-green-100 text-green-800 border-green-200',
      footer: 'bg-gray-100 text-gray-800 border-gray-200',
      sidebar: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      navigation: 'bg-indigo-100 text-indigo-800 border-indigo-200'
    };
    return colors[type] || colors.content;
  };

  const getFieldTypeIcon = (type: EditableField['type']) => {
    switch (type) {
      case 'text': return '📝';
      case 'rich_text': return '📄';
      case 'image': return '🖼️';
      case 'url': return '🔗';
      case 'boolean': return '☑️';
      default: return '📝';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Generated HTML Preview</h2>
            <p className="text-gray-600 mt-1">
              From: <span className="font-medium">{fileName}</span>
            </p>
            {description && (
              <p className="text-sm text-gray-500 mt-2">{description}</p>
            )}
          </div>
          <button
            onClick={onCreateModule}
            className="btn-primary"
          >
            <Download className="w-4 h-4 mr-2" />
            Create HubSpot Module
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Layers className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">{sections.length}</p>
              <p className="text-sm text-gray-600">Sections</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Edit3 className="w-8 h-8 text-green-600" />
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">
                {sections.reduce((acc, section) => acc + section.editableFields.length, 0)}
              </p>
              <p className="text-sm text-gray-600">Editable Fields</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Settings className="w-8 h-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">{components.length}</p>
              <p className="text-sm text-gray-600">Components</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'preview', label: 'Preview', icon: Eye },
              { id: 'code', label: 'HTML Code', icon: Code },
              { id: 'sections', label: 'Sections', icon: Layers }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Live preview of your generated HTML with Tailwind CSS styling:
                </p>
                <div 
                  className="bg-white rounded-lg border shadow-sm overflow-hidden"
                  style={{ minHeight: '400px' }}
                >
                  <iframe
                    srcDoc={`
                      <!DOCTYPE html>
                      <html lang="en">
                      <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Preview</title>
                        <script src="https://cdn.tailwindcss.com"></script>
                      </head>
                      <body>
                        ${html}
                      </body>
                      </html>
                    `}
                    className="w-full h-96 border-0"
                    title="HTML Preview"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Generated HTML with Tailwind CSS classes:
                </p>
                <button
                  onClick={() => navigator.clipboard.writeText(html)}
                  className="btn-secondary text-sm"
                >
                  Copy Code
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{html}</code>
              </pre>
            </div>
          )}

          {activeTab === 'sections' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Identified sections and their editable fields:
              </p>
              <div className="grid gap-4">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className={`
                      border rounded-lg p-4 cursor-pointer transition-all
                      ${selectedSection === section.id ? 'ring-2 ring-blue-500 border-blue-300' : 'hover:border-gray-300'}
                    `}
                    onClick={() => setSelectedSection(
                      selectedSection === section.id ? null : section.id
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSectionTypeColor(section.type)}`}>
                          {section.type}
                        </span>
                        <h3 className="font-semibold text-gray-900">{section.name}</h3>
                      </div>
                      <span className="text-sm text-gray-500">
                        {section.editableFields.length} fields
                      </span>
                    </div>

                    {selectedSection === section.id && (
                      <div className="mt-4 space-y-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <h4 className="font-medium text-gray-900 mb-2">Editable Fields:</h4>
                          <div className="grid gap-2">
                            {section.editableFields.map((field) => (
                              <div key={field.id} className="flex items-center justify-between bg-white rounded p-2 border">
                                <div className="flex items-center space-x-2">
                                  <span className="text-lg">{getFieldTypeIcon(field.type)}</span>
                                  <div>
                                    <p className="font-medium text-sm text-gray-900">{field.name}</p>
                                    <p className="text-xs text-gray-500">{field.selector}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">{field.type}</span>
                                  {field.required && (
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded ml-1">Required</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 rounded-lg p-3">
                          <h4 className="font-medium text-gray-900 mb-2">Section HTML:</h4>
                          <pre className="bg-white border rounded p-2 text-xs overflow-x-auto">
                            <code>{section.html}</code>
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
