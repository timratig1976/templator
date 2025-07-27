'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Settings, Eye, Play, Save, Download, Zap, Target, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import ComponentLibraryBrowser from './ComponentLibraryBrowser';
import assemblyEngineService, { AssemblyRequest, AssemblyResult, AssemblyStatus } from '@/services/assemblyEngineService';
import testSuiteService, { TestSuiteExecution } from '@/services/testSuiteService';
import expertReviewService, { ReviewRequest } from '@/services/expertReviewService';
import { Component } from '@/services/componentLibraryService';

interface VisualModuleBuilderProps {
  initialDesignData?: any;
  onModuleComplete?: (moduleData: any) => void;
  className?: string;
}

export default function VisualModuleBuilder({
  initialDesignData,
  onModuleComplete,
  className = ''
}: VisualModuleBuilderProps) {
  const [currentStep, setCurrentStep] = useState<'design' | 'components' | 'assembly' | 'testing' | 'review' | 'complete'>('design');
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [assemblyRequest, setAssemblyRequest] = useState<Partial<AssemblyRequest>>({
    target_module_type: 'content',
    design_requirements: '',
    component_preferences: {
      complexity_preference: 'moderate'
    },
    constraints: {
      max_components: 10,
      accessibility_level: 'aa',
      performance_requirements: {
        max_load_time_ms: 3000,
        max_bundle_size_kb: 500
      }
    },
    customization_options: {
      allow_ai_modifications: true,
      preserve_branding: true,
      responsive_breakpoints: ['mobile', 'tablet', 'desktop']
    }
  });
  const [assemblyResult, setAssemblyResult] = useState<AssemblyResult | null>(null);
  const [assemblyStatus, setAssemblyStatus] = useState<AssemblyStatus | null>(null);
  const [testExecution, setTestExecution] = useState<TestSuiteExecution | null>(null);
  const [reviewRequest, setReviewRequest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDesignData) {
      setAssemblyRequest(prev => ({
        ...prev,
        design_requirements: initialDesignData.description || '',
        target_module_type: initialDesignData.moduleType || 'content'
      }));
    }
  }, [initialDesignData]);

  const handleComponentSelect = (component: Component) => {
    setSelectedComponents(prev => {
      const isSelected = prev.includes(component.id);
      if (isSelected) {
        return prev.filter(id => id !== component.id);
      } else {
        return [...prev, component.id];
      }
    });

    // Update assembly request with selected components
    setAssemblyRequest(prev => ({
      ...prev,
      component_preferences: {
        ...prev.component_preferences,
        preferred_components: selectedComponents.includes(component.id) 
          ? selectedComponents.filter(id => id !== component.id)
          : [...selectedComponents, component.id]
      }
    }));
  };

  const handleStartAssembly = async () => {
    if (!assemblyRequest.design_requirements) {
      setError('Please provide design requirements');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await assemblyEngineService.assembleComponents(assemblyRequest as AssemblyRequest);
      setAssemblyResult(result);
      setCurrentStep('assembly');
      
      // Poll for assembly status if needed
      if (result.status === 'partial') {
        pollAssemblyStatus(result.assembly_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start assembly');
    } finally {
      setLoading(false);
    }
  };

  const pollAssemblyStatus = async (assemblyId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await assemblyEngineService.getAssemblyStatus(assemblyId);
        setAssemblyStatus(status);
        
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollInterval);
          if (status.status === 'completed') {
            const result = await assemblyEngineService.getAssemblyResult(assemblyId);
            setAssemblyResult(result);
          }
        }
      } catch (err) {
        console.error('Failed to poll assembly status:', err);
        clearInterval(pollInterval);
      }
    }, 2000);

    // Clear interval after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const handleRunTests = async () => {
    if (!assemblyResult) return;

    setLoading(true);
    try {
      const execution = await testSuiteService.executeTestSuite(
        assemblyResult.assembly_id,
        'assembly',
        ['standard', 'performance', 'accessibility']
      );
      setTestExecution(execution);
      setCurrentStep('testing');
      
      // Poll for test completion
      pollTestExecution(execution.execution_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run tests');
    } finally {
      setLoading(false);
    }
  };

  const pollTestExecution = async (executionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await testSuiteService.getExecutionStatus(executionId);
        setTestExecution(status);
        
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Failed to poll test execution:', err);
        clearInterval(pollInterval);
      }
    }, 2000);

    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const handleRequestReview = async () => {
    if (!assemblyResult) return;

    setLoading(true);
    try {
      const request: ReviewRequest = {
        module_id: assemblyResult.assembly_id,
        module_type: assemblyRequest.target_module_type || 'content',
        priority: 'medium',
        review_type: 'comprehensive',
        context: {
          project_name: 'Visual Module Builder',
          target_audience: 'General users',
          business_goals: ['User engagement', 'Conversion optimization']
        }
      };

      const response = await expertReviewService.submitReviewRequest(request);
      setReviewRequest(response.request_id);
      setCurrentStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request review');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteModule = () => {
    if (assemblyResult && onModuleComplete) {
      onModuleComplete({
        assemblyResult,
        testExecution,
        reviewRequest,
        selectedComponents
      });
    }
    setCurrentStep('complete');
  };

  const getStepStatus = (step: string) => {
    const stepOrder = ['design', 'components', 'assembly', 'testing', 'review', 'complete'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(step);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8">
      {[
        { id: 'design', label: 'Design Requirements', icon: Target },
        { id: 'components', label: 'Select Components', icon: Plus },
        { id: 'assembly', label: 'AI Assembly', icon: Zap },
        { id: 'testing', label: 'Quality Testing', icon: Play },
        { id: 'review', label: 'Expert Review', icon: Eye },
        { id: 'complete', label: 'Complete', icon: CheckCircle }
      ].map((step, index) => {
        const status = getStepStatus(step.id);
        const Icon = step.icon;
        
        return (
          <div key={step.id} className="flex items-center">
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
              ${status === 'completed' 
                ? 'bg-green-600 border-green-600 text-white' 
                : status === 'active'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-400'
              }
            `}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="ml-3">
              <div className={`text-sm font-medium ${
                status === 'active' ? 'text-blue-600' : 
                status === 'completed' ? 'text-green-600' : 'text-gray-500'
              }`}>
                {step.label}
              </div>
            </div>
            {index < 5 && (
              <div className={`w-16 h-0.5 mx-4 ${
                status === 'completed' ? 'bg-green-600' : 'bg-gray-300'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderDesignStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Design Requirements</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Module Type
            </label>
            <select
              value={assemblyRequest.target_module_type}
              onChange={(e) => setAssemblyRequest(prev => ({ ...prev, target_module_type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="content">Content Module</option>
              <option value="hero">Hero Section</option>
              <option value="gallery">Image Gallery</option>
              <option value="testimonial">Testimonials</option>
              <option value="contact">Contact Form</option>
              <option value="pricing">Pricing Table</option>
              <option value="blog">Blog Layout</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Design Requirements
            </label>
            <textarea
              value={assemblyRequest.design_requirements}
              onChange={(e) => setAssemblyRequest(prev => ({ ...prev, design_requirements: e.target.value }))}
              placeholder="Describe your module requirements, target audience, design preferences, and any specific functionality needed..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Complexity Preference
              </label>
              <select
                value={assemblyRequest.component_preferences?.complexity_preference}
                onChange={(e) => setAssemblyRequest(prev => ({
                  ...prev,
                  component_preferences: {
                    ...prev.component_preferences,
                    complexity_preference: e.target.value as 'simple' | 'moderate' | 'complex'
                  }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="simple">Simple</option>
                <option value="moderate">Moderate</option>
                <option value="complex">Complex</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Accessibility Level
              </label>
              <select
                value={assemblyRequest.constraints?.accessibility_level}
                onChange={(e) => setAssemblyRequest(prev => ({
                  ...prev,
                  constraints: {
                    ...prev.constraints,
                    accessibility_level: e.target.value as 'basic' | 'aa' | 'aaa'
                  }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="basic">Basic</option>
                <option value="aa">WCAG AA</option>
                <option value="aaa">WCAG AAA</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setCurrentStep('components')}
          disabled={!assemblyRequest.design_requirements}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next: Select Components
        </button>
      </div>
    </div>
  );

  const renderComponentsStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Select Components</h3>
        <div className="text-sm text-gray-600">
          {selectedComponents.length} components selected
        </div>
      </div>

      <ComponentLibraryBrowser
        onComponentSelect={handleComponentSelect}
        selectedComponents={selectedComponents}
        maxSelections={assemblyRequest.constraints?.max_components}
        filterByType={assemblyRequest.target_module_type === 'content' ? undefined : assemblyRequest.target_module_type}
      />

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep('design')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleStartAssembly}
          disabled={loading || selectedComponents.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
          <Zap className="w-4 h-4" />
          <span>Start AI Assembly</span>
        </button>
      </div>
    </div>
  );

  const renderAssemblyStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">AI Assembly Results</h3>

      {assemblyStatus && assemblyStatus.status === 'processing' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <div>
              <div className="font-medium text-blue-900">Assembly in Progress</div>
              <div className="text-sm text-blue-700">{assemblyStatus.current_step}</div>
              <div className="w-64 bg-blue-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${assemblyStatus.progress_percentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {assemblyResult && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border ${
            assemblyResult.status === 'success' 
              ? 'bg-green-50 border-green-200' 
              : assemblyResult.status === 'partial'
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              {assemblyResult.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {assemblyResult.status === 'partial' && <Clock className="w-5 h-5 text-yellow-600" />}
              {assemblyResult.status === 'failed' && <AlertTriangle className="w-5 h-5 text-red-600" />}
              <span className="font-medium capitalize">{assemblyResult.status} Assembly</span>
            </div>
          </div>

          {/* Quality Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {assemblyResult.quality_metrics.overall_score}%
              </div>
              <div className="text-sm text-gray-600">Overall Score</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {assemblyResult.quality_metrics.component_compatibility}%
              </div>
              <div className="text-sm text-gray-600">Compatibility</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {assemblyResult.quality_metrics.performance_score}%
              </div>
              <div className="text-sm text-gray-600">Performance</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {assemblyResult.quality_metrics.maintainability_score}%
              </div>
              <div className="text-sm text-gray-600">Maintainability</div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Module Preview</h4>
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-auto">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                {assemblyResult.assembled_module.html_template.substring(0, 500)}
                {assemblyResult.assembled_module.html_template.length > 500 && '...'}
              </pre>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep('components')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleRunTests}
          disabled={!assemblyResult || assemblyResult.status !== 'success'}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Play className="w-4 h-4" />
          <span>Run Quality Tests</span>
        </button>
      </div>
    </div>
  );

  const renderTestingStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Quality Testing</h3>

      {testExecution && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border ${
            testExecution.status === 'completed' 
              ? 'bg-green-50 border-green-200' 
              : testExecution.status === 'running'
              ? 'bg-blue-50 border-blue-200'
              : testExecution.status === 'failed'
              ? 'bg-red-50 border-red-200'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {testExecution.status === 'running' && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                )}
                <span className="font-medium capitalize">{testExecution.status}</span>
              </div>
              <div className="text-sm text-gray-600">
                {testExecution.progress_percentage}% complete
              </div>
            </div>
            {testExecution.status === 'running' && (
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${testExecution.progress_percentage}%` }}
                ></div>
              </div>
            )}
          </div>

          {testExecution.status === 'completed' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {testExecution.passed_tests}
                </div>
                <div className="text-sm text-gray-600">Passed</div>
              </div>
              <div className="bg-white border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {testExecution.failed_tests}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="bg-white border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {testExecution.skipped_tests}
                </div>
                <div className="text-sm text-gray-600">Skipped</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep('assembly')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleRequestReview}
          disabled={!testExecution || testExecution.status !== 'completed'}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Eye className="w-4 h-4" />
          <span>Request Expert Review</span>
        </button>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Expert Review</h3>

      {reviewRequest && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-medium text-blue-900">Review Requested</div>
              <div className="text-sm text-blue-700">
                Request ID: {reviewRequest}
              </div>
              <div className="text-sm text-blue-700">
                Your module has been submitted for expert review. You'll receive feedback within 24-48 hours.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep('testing')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleCompleteModule}
          disabled={!reviewRequest}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Complete & Download</span>
        </button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Module Complete!</h3>
        <p className="text-gray-600">
          Your HubSpot module has been successfully created, tested, and submitted for review.
        </p>
      </div>
      
      <div className="flex justify-center space-x-4">
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Create Another Module
        </button>
        <button
          onClick={() => {/* TODO: Implement download */}}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Download Module</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6">
        {renderStepIndicator()}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {currentStep === 'design' && renderDesignStep()}
        {currentStep === 'components' && renderComponentsStep()}
        {currentStep === 'assembly' && renderAssemblyStep()}
        {currentStep === 'testing' && renderTestingStep()}
        {currentStep === 'review' && renderReviewStep()}
        {currentStep === 'complete' && renderCompleteStep()}
      </div>
    </div>
  );
}
