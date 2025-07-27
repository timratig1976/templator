'use client';

import React, { useState, useEffect } from 'react';
import { Download, Upload, Package, CheckCircle, XCircle, Eye, RefreshCw } from 'lucide-react';
import exportDeploymentService, { 
  PackageOptions, 
  ModuleFiles, 
  PackageResult, 
  HubSpotCredentials, 
  DeploymentOptions, 
  DeploymentResult 
} from '@/services/exportDeploymentService';

interface ExportDeploymentManagerProps {
  moduleData?: {
    html: string;
    css?: string;
    js?: string;
    fields: any[];
    meta: any;
  };
  onComplete?: (result: { packageResult?: PackageResult; deploymentResult?: DeploymentResult }) => void;
  className?: string;
}

export default function ExportDeploymentManager({
  moduleData,
  onComplete,
  className = ''
}: ExportDeploymentManagerProps) {
  const [currentStep, setCurrentStep] = useState<'package' | 'deploy' | 'monitor'>('package');
  const [packageOptions, setPackageOptions] = useState<PackageOptions>({
    format: 'zip',
    compression_level: 'best',
    include_source_maps: false,
    include_documentation: true,
    include_tests: false,
    minify_assets: true,
    optimize_images: true,
    bundle_dependencies: false
  });
  const [packageMetadata, setPackageMetadata] = useState({
    name: '',
    version: '1.0.0',
    description: '',
    author: ''
  });
  const [hubspotCredentials, setHubspotCredentials] = useState<HubSpotCredentials>({
    access_token: '',
    portal_id: ''
  });
  const [deploymentOptions, setDeploymentOptions] = useState<DeploymentOptions>({
    environment: 'sandbox',
    auto_publish: false,
    backup_existing: true,
    rollback_on_failure: true,
    validation_level: 'strict'
  });
  const [packageResult, setPackageResult] = useState<PackageResult | null>(null);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentialsValid, setCredentialsValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (moduleData) {
      setPackageMetadata(prev => ({
        ...prev,
        name: moduleData.meta?.label || 'Custom Module',
        description: moduleData.meta?.help_text || 'Generated HubSpot module'
      }));
    }
  }, [moduleData]);

  const handlePackageModule = async () => {
    if (!moduleData) {
      setError('No module data available for packaging');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const moduleFiles: ModuleFiles = {
        'module.html': moduleData.html,
        'fields.json': JSON.stringify(moduleData.fields, null, 2),
        'meta.json': JSON.stringify(moduleData.meta, null, 2)
      };

      if (moduleData.css) moduleFiles['module.css'] = moduleData.css;
      if (moduleData.js) moduleFiles['module.js'] = moduleData.js;

      const result = await exportDeploymentService.packageModule(
        moduleFiles,
        packageOptions,
        packageMetadata
      );

      setPackageResult(result);
      setCurrentStep('deploy');

      if (onComplete) {
        onComplete({ packageResult: result });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to package module');
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!packageResult) {
      setError('No package available for deployment');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await exportDeploymentService.deployModule(
        packageResult.package_id,
        hubspotCredentials,
        deploymentOptions
      );

      setDeploymentResult(result);
      setCurrentStep('monitor');

      if (onComplete) {
        onComplete({ packageResult, deploymentResult: result });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy module');
    } finally {
      setLoading(false);
    }
  };

  const renderPackageStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Package Configuration</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Module Name</label>
          <input
            type="text"
            value={packageMetadata.name}
            onChange={(e) => setPackageMetadata(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="My HubSpot Module"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
          <input
            type="text"
            value={packageMetadata.version}
            onChange={(e) => setPackageMetadata(prev => ({ ...prev, version: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="1.0.0"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={packageMetadata.description}
          onChange={(e) => setPackageMetadata(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Describe your module's purpose and functionality..."
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handlePackageModule}
          disabled={loading || !packageMetadata.name}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
        >
          {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
          <Package className="w-4 h-4" />
          <span>Create Package</span>
        </button>
      </div>
    </div>
  );

  const renderDeployStep = () => (
    <div className="space-y-6">
      {packageResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-900">Package Created Successfully</span>
          </div>
          <div className="text-sm text-green-700">
            Size: {Math.round(packageResult.manifest.metadata.total_size_bytes / 1024)} KB
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900">HubSpot Deployment</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Portal ID</label>
          <input
            type="text"
            value={hubspotCredentials.portal_id}
            onChange={(e) => setHubspotCredentials(prev => ({ ...prev, portal_id: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="12345678"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
          <input
            type="password"
            value={hubspotCredentials.access_token}
            onChange={(e) => setHubspotCredentials(prev => ({ ...prev, access_token: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="pat-na1-..."
          />
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep('package')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleDeploy}
          disabled={loading || !hubspotCredentials.access_token || !hubspotCredentials.portal_id}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
        >
          {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
          <Upload className="w-4 h-4" />
          <span>Deploy Now</span>
        </button>
      </div>
    </div>
  );

  const renderMonitorStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Deployment Status</h3>
      
      {deploymentResult && (
        <div className="border rounded-lg p-6 bg-green-50 border-green-200">
          <div className="flex items-center space-x-3 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <div className="font-medium">Deployment Completed</div>
              <div className="text-sm text-gray-600">ID: {deploymentResult.deployment_id}</div>
            </div>
          </div>

          {deploymentResult.deployment_url && (
            <a
              href={deploymentResult.deployment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800"
            >
              <Eye className="w-4 h-4" />
              <span>View in HubSpot</span>
            </a>
          )}
        </div>
      )}

      <button
        onClick={() => window.location.reload()}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Create Another Package
      </button>
    </div>
  );

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8">
          {[
            { id: 'package', label: 'Package', icon: Package },
            { id: 'deploy', label: 'Deploy', icon: Upload },
            { id: 'monitor', label: 'Monitor', icon: Eye }
          ].map((step, index) => {
            const isActive = currentStep === step.id;
            const isCompleted = 
              (step.id === 'package' && packageResult) ||
              (step.id === 'deploy' && deploymentResult);
            const Icon = step.icon;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-10 h-10 rounded-full border-2
                  ${isCompleted 
                    ? 'bg-green-600 border-green-600 text-white' 
                    : isActive
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-400'
                  }
                `}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`ml-3 text-sm font-medium ${
                  isActive ? 'text-blue-600' : 
                  isCompleted ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {step.label}
                </span>
                {index < 2 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {currentStep === 'package' && renderPackageStep()}
        {currentStep === 'deploy' && renderDeployStep()}
        {currentStep === 'monitor' && renderMonitorStep()}
      </div>
    </div>
  );
}
