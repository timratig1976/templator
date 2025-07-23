'use client';

import React, { useState } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { Upload, Code, Package, ArrowRight, Sparkles, Zap, Target } from 'lucide-react';
import DesignUpload from '@/components/DesignUpload';
import HTMLPreview from '@/components/HTMLPreview';

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

type WorkflowStep = 'upload' | 'preview' | 'module';

export default function Home() {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [designResult, setDesignResult] = useState<DesignAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUploadSuccess = (result: DesignAnalysisResult) => {
    setDesignResult(result);
    setCurrentStep('preview');
    setError(null);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleCreateModule = async () => {
    if (!designResult) return;

    try {
      // Call the existing module creation endpoint
      const response = await fetch(API_ENDPOINTS.MODULE_GENERATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: designResult.analysis.html,
          sections: designResult.analysis.sections,
          components: designResult.analysis.components
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create HubSpot module');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${designResult.fileName.replace(/\.[^/.]+$/, '')}-hubspot-module.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setCurrentStep('module');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create module');
    }
  };

  const resetWorkflow = () => {
    setCurrentStep('upload');
    setDesignResult(null);
    setError(null);
  };

  const steps = [
    {
      id: 'upload',
      title: 'Upload Design',
      description: 'Upload your design file (PNG, JPG, etc.)',
      icon: Upload,
      color: 'text-blue-600'
    },
    {
      id: 'preview',
      title: 'Generate HTML',
      description: 'AI converts design to HTML/Tailwind',
      icon: Code,
      color: 'text-green-600'
    },
    {
      id: 'module',
      title: 'Create Module',
      description: 'Export HubSpot module files',
      icon: Package,
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold gradient-text">Windsurf MVP</h1>
            </div>
            <div className="text-sm text-gray-600">
              Design → HTML → HubSpot Module
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold gradient-text mb-6">
            Transform Designs into HubSpot Modules
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Upload any design file and our AI will convert it to responsive HTML with Tailwind CSS, 
            then generate a complete HubSpot module ready for deployment.
          </p>

          {/* Progress Steps */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
              
              return (
                <React.Fragment key={step.id}>
                  <div className={`
                    flex items-center space-x-3 px-4 py-2 rounded-full transition-all
                    ${isActive ? 'bg-white shadow-lg scale-105' : isCompleted ? 'bg-green-50' : 'bg-gray-50'}
                  `}>
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      ${isActive ? 'bg-blue-100' : isCompleted ? 'bg-green-100' : 'bg-gray-100'}
                    `}>
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="text-left">
                      <p className={`font-medium text-sm ${isActive ? 'text-gray-900' : isCompleted ? 'text-green-900' : 'text-gray-500'}`}>
                        {step.title}
                      </p>
                      <p className={`text-xs ${isActive ? 'text-gray-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Step Content */}
        <div className="mb-12">
          {currentStep === 'upload' && (
            <div className="space-y-8">
              <DesignUpload
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
            </div>
          )}

          {currentStep === 'preview' && designResult && (
            <div className="space-y-8">
              <HTMLPreview
                html={designResult.analysis.html}
                sections={designResult.analysis.sections}
                components={designResult.analysis.components}
                description={designResult.analysis.description}
                fileName={designResult.fileName}
                onCreateModule={handleCreateModule}
              />
              
              <div className="text-center">
                <button
                  onClick={resetWorkflow}
                  className="btn-secondary"
                >
                  Upload New Design
                </button>
              </div>
            </div>
          )}

          {currentStep === 'module' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Package className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  HubSpot Module Created Successfully!
                </h2>
                <p className="text-gray-600 mb-6">
                  Your module has been downloaded and is ready to upload to HubSpot.
                </p>
                <button
                  onClick={resetWorkflow}
                  className="btn-primary"
                >
                  Create Another Module
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Conversion</h3>
            <p className="text-gray-600 text-sm">
              Advanced GPT-4 Vision analyzes your designs and generates clean, semantic HTML with Tailwind CSS.
            </p>
          </div>

          <div className="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Section Detection</h3>
            <p className="text-gray-600 text-sm">
              Automatically identifies headers, content areas, and components, creating optimal HubSpot field mappings.
            </p>
          </div>

          <div className="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">HubSpot Ready</h3>
            <p className="text-gray-600 text-sm">
              Generates complete module files with HubL templates, field definitions, and responsive design.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
