'use client';

import { useState } from 'react';
import { Monitor, Tablet, Smartphone, Eye } from 'lucide-react';

interface PreviewSectionProps {
  htmlContent: string;
  detectedFields: any[];
}

export default function PreviewSection({ htmlContent, detectedFields }: PreviewSectionProps) {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const viewportSizes = {
    desktop: { width: '100%', height: '600px' },
    tablet: { width: '768px', height: '600px' },
    mobile: { width: '375px', height: '600px' },
  };

  const previewHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Preview</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, sans-serif; }
        .container { max-width: 1200px; margin: 0 auto; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  return (
    <div className="space-y-6">
      {/* Viewport Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">Live Preview</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewport('desktop')}
              className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                viewport === 'desktop' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Monitor className="w-4 h-4 mr-2" />
              Desktop
            </button>
            <button
              onClick={() => setViewport('tablet')}
              className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                viewport === 'tablet' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Tablet className="w-4 h-4 mr-2" />
              Tablet
            </button>
            <button
              onClick={() => setViewport('mobile')}
              className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                viewport === 'mobile' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Mobile
            </button>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="bg-gray-100 px-4 py-2 border-b flex items-center">
            <Eye className="w-4 h-4 text-gray-500 mr-2" />
            <span className="text-sm text-gray-600">
              Preview - {viewport} ({viewportSizes[viewport].width})
            </span>
          </div>
          <div className="flex justify-center bg-gray-50 p-4">
            <iframe
              srcDoc={previewHtml}
              style={{
                width: viewportSizes[viewport].width,
                height: viewportSizes[viewport].height,
                maxWidth: '100%',
              }}
              className="border rounded shadow-sm bg-white"
              title="HTML Preview"
            />
          </div>
        </div>
      </div>

      {/* Detected Fields */}
      {detectedFields.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detected Fields</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {detectedFields.map((field, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{field.label}</h4>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    field.required 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {field.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>ID:</strong> <code className="bg-white px-1 rounded">{field.id}</code></p>
                  <p><strong>Type:</strong> {field.type}</p>
                  <p><strong>Selector:</strong> <code className="bg-white px-1 rounded text-xs">{field.selector}</code></p>
                  {field.default && (
                    <p><strong>Default:</strong> <span className="italic">{field.default}</span></p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HTML Output */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Normalized HTML</h3>
        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-green-400 text-sm">
            <code>{htmlContent}</code>
          </pre>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => navigator.clipboard.writeText(htmlContent)}
            className="btn-secondary text-sm"
          >
            Copy HTML
          </button>
        </div>
      </div>
    </div>
  );
}
