/**
 * Frontend service for Export and Deployment functionality
 * Connects to Phase 5 backend Export and Deployment services
 */

import { API_ENDPOINTS } from '../config/api';

export interface PackageOptions {
  format: 'zip' | 'tar' | 'hubspot';
  compression_level: 'none' | 'fast' | 'best';
  include_source_maps: boolean;
  include_documentation: boolean;
  include_tests: boolean;
  minify_assets: boolean;
  optimize_images: boolean;
  bundle_dependencies: boolean;
}

export interface ModuleFiles {
  'module.html': string;
  'module.css'?: string;
  'module.js'?: string;
  'fields.json': string;
  'meta.json': string;
  'README.md'?: string;
}

export interface PackageResult {
  package_id: string;
  package_path: string;
  manifest: {
    package_id: string;
    module_name: string;
    version: string;
    created_at: string;
    created_by: string;
    description: string;
    files: Array<{
      path: string;
      size_bytes: number;
      checksum: string;
      type: string;
    }>;
    metadata: {
      total_size_bytes: number;
      file_count: number;
      compression_ratio: number;
      validation_status: 'valid' | 'invalid' | 'warning';
    };
  };
  download_url: string;
  expires_at: string;
  validation_report: {
    is_valid: boolean;
    errors: any[];
    warnings: any[];
    performance_score: number;
  };
}

export interface HubSpotCredentials {
  access_token: string;
  portal_id: string;
  refresh_token?: string;
  expires_at?: string;
}

export interface DeploymentOptions {
  environment: 'sandbox' | 'production';
  auto_publish: boolean;
  backup_existing: boolean;
  deployment_notes?: string;
  scheduled_deployment?: string;
  rollback_on_failure: boolean;
  validation_level: 'basic' | 'strict' | 'comprehensive';
}

export interface DeploymentResult {
  deployment_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  hubspot_module_id?: string;
  hubspot_module_path?: string;
  deployment_url?: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  validation_results: {
    passed: boolean;
    errors: any[];
    warnings: any[];
  };
  performance_metrics?: {
    upload_time_ms: number;
    validation_time_ms: number;
    total_deployment_time_ms: number;
  };
  rollback_info?: {
    backup_id: string;
    rollback_available: boolean;
  };
}

export interface DeploymentHistory {
  deployments: DeploymentResult[];
  total_count: number;
  success_rate: number;
  average_deployment_time_ms: number;
  last_successful_deployment?: string;
}

class ExportDeploymentService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Package a module for export
   */
  async packageModule(
    moduleFiles: ModuleFiles,
    packageOptions: PackageOptions,
    metadata: {
      name: string;
      version: string;
      description: string;
      author: string;
    }
  ): Promise<PackageResult> {
    const response = await fetch(`${this.baseUrl}/api/export/package`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        module_files: moduleFiles,
        package_options: packageOptions,
        metadata
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to package module: ${response.statusText}`);
    }

    const result = await response.json();
    return result.package_result;
  }

  /**
   * Get package information
   */
  async getPackageInfo(packageId: string): Promise<PackageResult['manifest']> {
    const response = await fetch(`${this.baseUrl}/api/export/package/${packageId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get package info: ${response.statusText}`);
    }

    const result = await response.json();
    return result.package_info;
  }

  /**
   * Download packaged module
   */
  async downloadPackage(packageId: string): Promise<void> {
    const downloadUrl = `${this.baseUrl}/api/export/package/${packageId}/download`;
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * List available packages
   */
  async listPackages(filters?: {
    created_after?: string;
    created_by?: string;
    module_type?: string;
  }): Promise<PackageResult['manifest'][]> {
    const params = new URLSearchParams();
    if (filters?.created_after) params.append('created_after', filters.created_after);
    if (filters?.created_by) params.append('created_by', filters.created_by);
    if (filters?.module_type) params.append('module_type', filters.module_type);

    const response = await fetch(`${this.baseUrl}/api/export/packages?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list packages: ${response.statusText}`);
    }

    const result = await response.json();
    return result.packages;
  }

  /**
   * Delete a package
   */
  async deletePackage(packageId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/export/package/${packageId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete package: ${response.statusText}`);
    }
  }

  /**
   * Deploy module to HubSpot
   */
  async deployModule(
    packageId: string,
    credentials: HubSpotCredentials,
    options: DeploymentOptions
  ): Promise<DeploymentResult> {
    const response = await fetch(`${this.baseUrl}/api/export/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        package_id: packageId,
        credentials,
        options
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Deployment failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.deployment_result;
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<DeploymentResult> {
    const response = await fetch(`${this.baseUrl}/api/export/deployment/${deploymentId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get deployment status: ${response.statusText}`);
    }

    const result = await response.json();
    return result.deployment;
  }

  /**
   * Get deployment history
   */
  async getDeploymentHistory(filters?: {
    portal_id?: string;
    environment?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<DeploymentHistory> {
    const params = new URLSearchParams();
    if (filters?.portal_id) params.append('portal_id', filters.portal_id);
    if (filters?.environment) params.append('environment', filters.environment);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);

    const response = await fetch(`${this.baseUrl}/api/export/deployments?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get deployment history: ${response.statusText}`);
    }

    const result = await response.json();
    return result.history;
  }

  /**
   * Schedule deployment
   */
  async scheduleDeployment(
    packageId: string,
    credentials: HubSpotCredentials,
    options: DeploymentOptions,
    scheduledTime: string
  ): Promise<{ scheduled_deployment_id: string }> {
    const response = await fetch(`${this.baseUrl}/api/export/deployment/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        package_id: packageId,
        credentials,
        options,
        scheduled_time: scheduledTime
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to schedule deployment: ${response.statusText}`);
    }

    const result = await response.json();
    return result.scheduled_deployment;
  }

  /**
   * Cancel scheduled deployment
   */
  async cancelScheduledDeployment(scheduledId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/export/deployment/scheduled/${scheduledId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel scheduled deployment: ${response.statusText}`);
    }
  }

  /**
   * Get module versions
   */
  async getModuleVersions(moduleId: string): Promise<Array<{
    version_id: string;
    version_number: string;
    deployed_at: string;
    deployed_by: string;
    status: 'active' | 'inactive' | 'archived';
    change_summary: string;
  }>> {
    const response = await fetch(`${this.baseUrl}/api/export/module/${moduleId}/versions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get module versions: ${response.statusText}`);
    }

    const result = await response.json();
    return result.versions;
  }

  /**
   * Validate HubSpot credentials
   */
  async validateCredentials(credentials: HubSpotCredentials): Promise<{
    valid: boolean;
    portal_info?: {
      portal_id: string;
      domain: string;
      name: string;
    };
    error?: string;
  }> {
    // This would typically validate against HubSpot API
    // For now, we'll do basic validation
    if (!credentials.access_token || !credentials.portal_id) {
      return {
        valid: false,
        error: 'Missing required credentials'
      };
    }

    // Simulate API validation
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      valid: true,
      portal_info: {
        portal_id: credentials.portal_id,
        domain: 'example.hubspot.com',
        name: 'Example Portal'
      }
    };
  }

  /**
   * Get export formats and their capabilities
   */
  getExportFormats(): Array<{
    format: PackageOptions['format'];
    name: string;
    description: string;
    features: string[];
    recommended_for: string[];
  }> {
    return [
      {
        format: 'zip',
        name: 'ZIP Archive',
        description: 'Standard ZIP compression format',
        features: ['Cross-platform', 'Good compression', 'Wide support'],
        recommended_for: ['General use', 'Manual uploads', 'Backup storage']
      },
      {
        format: 'tar',
        name: 'TAR Archive',
        description: 'Unix/Linux TAR format with compression',
        features: ['Preserves permissions', 'Better for large files', 'Unix-friendly'],
        recommended_for: ['Server deployments', 'Unix environments', 'CI/CD pipelines']
      },
      {
        format: 'hubspot',
        name: 'HubSpot Package',
        description: 'Optimized format for direct HubSpot upload',
        features: ['HubSpot optimized', 'Pre-validated', 'Direct upload ready'],
        recommended_for: ['Direct HubSpot deployment', 'Automated workflows']
      }
    ];
  }
}

export const exportDeploymentService = new ExportDeploymentService();
export default exportDeploymentService;
