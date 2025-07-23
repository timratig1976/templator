'use client';

import React, { useState } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { Download, Package, FileText, Code } from 'lucide-react';

interface OutputSectionProps {
  htmlContent: string;
  detectedFields: any[];
}

export default function OutputSection({ htmlContent, detectedFields }: OutputSectionProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [moduleSlug, setModuleSlug] = useState('windsurf_hero');
  const [downloadUrl, setDownloadUrl] = useState('');

  const generateHubSpotModule = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(API_ENDPOINTS.MODULE_GENERATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html_normalized: htmlContent,
          fields_config: detectedFields,
        }),
      });
      
      if (!response.ok) throw new Error('Module generation failed');
      
      const data = await response.json();
      setDownloadUrl(data.module_zip_url);
      setModuleSlug(data.module_slug);
    } catch (error) {
      console.error('Module generation error:', error);
      alert('Failed to generate HubSpot module. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadModule = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Configuration */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">HubSpot Module Export</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="module-slug" className="block text-sm font-medium text-gray-700 mb-2">
              Module Slug
            </label>
            <input
              id="module-slug"
              type="text"
              value={moduleSlug}
              onChange={(e) => setModuleSlug(e.target.value)}
              placeholder="windsurf_hero"
              className="input-field"
            />
            <p className="text-sm text-gray-500 mt-1">
              Used for folder name and module identification. Use lowercase letters, numbers, and underscores only.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Module Structure</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                <code>{moduleSlug}/module.html</code> - HubL template with Tailwind
              </div>
              <div className="flex items-center">
                <Code className="w-4 h-4 mr-2" />
                <code>{moduleSlug}/fields.json</code> - Editable field definitions
              </div>
              <div className="flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                <code>{moduleSlug}/meta.json</code> - Module metadata
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={generateHubSpotModule}
              disabled={isGenerating || !htmlContent}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 mr-2" />
                  Generate HubSpot Module
                </>
              )}
            </button>
            
            {downloadUrl && (
              <button
                onClick={downloadModule}
                className="btn-secondary"
              >
                <Download className="w-4 h-4 mr-2" />
                Download ZIP
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Field Configuration */}
      {detectedFields.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Field Configuration</h3>
          <div className="space-y-4">
            {detectedFields.map((field, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field Label
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      className="input-field text-sm"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field ID
                    </label>
                    <input
                      type="text"
                      value={field.id}
                      className="input-field text-sm font-mono"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={field.type}
                      className="input-field text-sm"
                      disabled
                    >
                      <option value="text">Text</option>
                      <option value="richtext">Rich Text</option>
                      <option value="image">Image</option>
                      <option value="url">URL</option>
                      <option value="choice">Choice</option>
                    </select>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <input
                    type="checkbox"
                    checked={field.required}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    disabled
                  />
                  <label className="ml-2 text-sm text-gray-600">Required field</label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Files */}
      {downloadUrl && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Files Preview</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">module.html</h4>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto max-h-64">
                <pre className="text-green-400 text-xs">
                  <code>{`<!-- HubSpot Module Template -->
<div class="module-wrapper">
  ${htmlContent.replace(/data-field="([^"]+)"/g, '').replace(/\{\{/g, '{{ module.')}
</div>`}</code>
                </pre>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-2">fields.json</h4>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto max-h-64">
                <pre className="text-green-400 text-xs">
                  <code>{JSON.stringify(detectedFields, null, 2)}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Installation Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Installation Instructions</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>1.</strong> Download the ZIP file containing your HubSpot module</p>
          <p><strong>2.</strong> Extract the ZIP file to get the module folder</p>
          <p><strong>3.</strong> Upload the module folder to your HubSpot Design Manager</p>
          <p><strong>4.</strong> The module will be available in the HubSpot page editor</p>
          <p><strong>5.</strong> Add the module to pages and customize the content fields</p>
        </div>
      </div>
    </div>
  );
}
