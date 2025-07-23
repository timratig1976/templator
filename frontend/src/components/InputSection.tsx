'use client';

import { useState } from 'react';
import { Upload, Code, FileText, Sparkles, Info, Play } from 'lucide-react';

interface InputSectionProps {
  htmlInput: string;
  setHtmlInput: (value: string) => void;
  onParse: () => void;
  isProcessing: boolean;
}

export default function InputSection({ htmlInput, setHtmlInput, onParse, isProcessing }: InputSectionProps) {
  const [inputMethod, setInputMethod] = useState<'textarea' | 'upload'>('textarea');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/html') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setHtmlInput(content);
      };
      reader.readAsText(file);
    }
  };

  const loadSampleHtml = () => {
    const sampleHtml = `<section class="hero-section bg-gradient-to-r from-blue-600 to-purple-600 text-white" data-field="hero">
  <div class="container mx-auto px-6 py-20">
    <div class="text-center">
      <h1 data-field="headline" class="text-5xl md:text-7xl font-bold mb-6 leading-tight">
        Transform Your Ideas Into Reality
      </h1>
      <p data-field="body" class="text-xl md:text-2xl mb-12 max-w-3xl mx-auto opacity-90">
        Our innovative platform helps you convert designs into production-ready code with just a few clicks. Experience the future of web development.
      </p>
      <div class="mb-12">
        <img data-field="image_main" src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=600" alt="Hero Image" class="mx-auto rounded-2xl shadow-2xl max-w-lg" />
      </div>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a data-field="cta_primary" href="#" class="bg-white text-blue-600 font-semibold px-8 py-4 rounded-xl hover:bg-gray-100 transition-colors">
          Get Started Free
        </a>
        <a data-field="cta_secondary" href="#" class="border-2 border-white text-white font-semibold px-8 py-4 rounded-xl hover:bg-white hover:text-blue-600 transition-colors">
          Watch Demo
        </a>
      </div>
    </div>
  </div>
</section>`;
    setHtmlInput(sampleHtml);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-4">
          <Code className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 1: Input Your Design</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Paste your HTML code, upload a file, or try our sample to get started. We'll automatically detect fields and convert them into HubSpot-ready modules.
        </p>
      </div>
        
      {/* Input Method Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-xl flex space-x-1">
          <button
            onClick={() => setInputMethod('textarea')}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              inputMethod === 'textarea' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Code className="w-4 h-4 mr-2" />
            Paste HTML
          </button>
          <button
            onClick={() => setInputMethod('upload')}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              inputMethod === 'upload' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </button>
          <button
            onClick={loadSampleHtml}
            className="flex items-center px-6 py-3 rounded-lg font-medium text-purple-600 hover:text-purple-700 transition-colors"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Try Sample
          </button>
        </div>
      </div>

      {/* Input Area */}
      <div className="max-w-4xl mx-auto">
        {inputMethod === 'textarea' ? (
          <div className="space-y-6">
            <div className="relative">
              <textarea
                value={htmlInput}
                onChange={(e) => setHtmlInput(e.target.value)}
                placeholder="Paste your HTML code here...\n\nTip: Use data-field attributes for precise field mapping:\n• data-field='headline' for main headlines\n• data-field='body' for body text\n• data-field='image_main' for images\n• data-field='cta_primary' for call-to-action buttons"
                className="w-full h-80 p-6 border-2 border-gray-200 rounded-2xl font-mono text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
              />
              {htmlInput && (
                <div className="absolute top-4 right-4 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                  {htmlInput.length} characters
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-blue-400 transition-colors">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-6" />
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-xl font-semibold text-gray-900 block mb-2">Upload HTML file</span>
                <p className="text-gray-500 mb-4">or drag and drop your .html file here</p>
                <div className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept=".html"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            {htmlInput && (
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="flex items-center mb-3">
                  <FileText className="w-5 h-5 text-gray-600 mr-2" />
                  <p className="font-medium text-gray-900">File loaded successfully</p>
                </div>
                <pre className="text-sm text-gray-700 overflow-x-auto bg-white p-4 rounded-lg">
                  {htmlInput.substring(0, 300)}{htmlInput.length > 300 ? '...' : ''}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Parse Button */}
        <div className="flex justify-center mt-8">
          <button
            onClick={onParse}
            disabled={!htmlInput.trim() || isProcessing}
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-2xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Processing Magic...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-3" />
                Parse & Convert to HubSpot Module
              </>
            )}
          </button>
        </div>
      </div>

      {/* Field Mapping Info */}
      <div className="max-w-4xl mx-auto mt-12">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <Info className="w-6 h-6 text-blue-600 mt-0.5" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-3">How Field Detection Works</h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="font-medium text-blue-800 mb-2">🤖 Automatic Detection:</p>
                  <ul className="space-y-1 text-blue-700">
                    <li><code className="bg-white px-2 py-1 rounded">h1, .headline</code> → Headline field</li>
                    <li><code className="bg-white px-2 py-1 rounded">h2, h3, .subheadline</code> → Subheadline field</li>
                    <li><code className="bg-white px-2 py-1 rounded">p, .copy</code> → Rich text field</li>
                    <li><code className="bg-white px-2 py-1 rounded">img</code> → Image field</li>
                    <li><code className="bg-white px-2 py-1 rounded">a.btn, .button</code> → CTA button field</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-blue-800 mb-2">🎯 Explicit Mapping:</p>
                  <p className="text-blue-700 mb-2">Use <code className="bg-white px-2 py-1 rounded">data-field</code> attributes for precise control:</p>
                  <ul className="space-y-1 text-blue-700">
                    <li><code className="bg-white px-2 py-1 rounded">data-field="headline"</code></li>
                    <li><code className="bg-white px-2 py-1 rounded">data-field="body"</code></li>
                    <li><code className="bg-white px-2 py-1 rounded">data-field="image_main"</code></li>
                    <li><code className="bg-white px-2 py-1 rounded">data-field="cta_primary"</code></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
