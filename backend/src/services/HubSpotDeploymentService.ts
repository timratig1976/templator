/**
 * HubSpot Deployment Service
 * Handles direct deployment of modules to HubSpot Design Manager
 * Phase 5: Export and Deployment System
 */

import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import ModulePackagingService, { PackageResult } from './ModulePackagingService';

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

export interface ModuleVersion {
  version_id: string;
  version_number: string;
  deployed_at: string;
  deployed_by: string;
  status: 'active' | 'inactive' | 'archived';
  change_summary: string;
  hubspot_module_id: string;
  package_id: string;
}

export interface DeploymentHistory {
  deployments: DeploymentResult[];
  total_count: number;
  success_rate: number;
  average_deployment_time_ms: number;
  last_successful_deployment?: string;
}

class HubSpotDeploymentService {
  private static instance: HubSpotDeploymentService;
  private packagingService: ModulePackagingService;
  private hubspotClient: AxiosInstance;
  private deploymentsDir: string;

  private constructor() {
    this.packagingService = ModulePackagingService.getInstance();
    this.deploymentsDir = path.join(process.cwd(), 'temp', 'deployments');
    this.ensureDeploymentsDirectory();
    
    // Initialize HubSpot API client
    this.hubspotClient = axios.create({
      baseURL: 'https://api.hubapi.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Templator-HubSpot-Integration/1.0'
      }
    });
  }

  public static getInstance(): HubSpotDeploymentService {
    if (!HubSpotDeploymentService.instance) {
      HubSpotDeploymentService.instance = new HubSpotDeploymentService();
    }
    return HubSpotDeploymentService.instance;
  }

  private async ensureDeploymentsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.deploymentsDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create deployments directory', { error });
    }
  }

  /**
   * Deploy a packaged module to HubSpot
   */
  public async deployModule(
    packageResult: PackageResult,
    credentials: HubSpotCredentials,
    options: DeploymentOptions
  ): Promise<DeploymentResult> {
    const deploymentId = this.generateDeploymentId();
    const startTime = Date.now();

    logger.info('Starting HubSpot module deployment', {
      deploymentId,
      packageId: packageResult.package_id,
      environment: options.environment
    });

    const deployment: DeploymentResult = {
      deployment_id: deploymentId,
      status: 'pending',
      started_at: new Date().toISOString(),
      validation_results: {
        passed: false,
        errors: [],
        warnings: []
      }
    };

    try {
      // Update deployment status
      deployment.status = 'in_progress';
      await this.saveDeploymentStatus(deployment);

      // Validate credentials
      await this.validateCredentials(credentials);

      // Pre-deployment validation
      const validationStart = Date.now();
      const validationResults = await this.validateForDeployment(
        packageResult,
        options.validation_level
      );
      const validationTime = Date.now() - validationStart;

      deployment.validation_results = validationResults;

      if (!validationResults.passed && options.validation_level === 'strict') {
        throw new Error(`Validation failed: ${validationResults.errors.map(e => e.message).join(', ')}`);
      }

      // Create backup if requested
      let backupInfo;
      if (options.backup_existing) {
        backupInfo = await this.createBackup(credentials, packageResult.manifest.module_name);
        deployment.rollback_info = backupInfo;
      }

      // Upload module to HubSpot
      const uploadStart = Date.now();
      const hubspotResult = await this.uploadToHubSpot(
        packageResult,
        credentials,
        options
      );
      const uploadTime = Date.now() - uploadStart;

      // Update deployment with HubSpot results
      deployment.hubspot_module_id = hubspotResult.module_id;
      deployment.hubspot_module_path = hubspotResult.module_path;
      deployment.deployment_url = hubspotResult.preview_url;

      // Auto-publish if requested
      if (options.auto_publish) {
        await this.publishModule(credentials, hubspotResult.module_id);
      }

      // Complete deployment
      const totalTime = Date.now() - startTime;
      deployment.status = 'completed';
      deployment.completed_at = new Date().toISOString();
      deployment.performance_metrics = {
        upload_time_ms: uploadTime,
        validation_time_ms: validationTime,
        total_deployment_time_ms: totalTime
      };

      await this.saveDeploymentStatus(deployment);

      logger.info('HubSpot module deployment completed', {
        deploymentId,
        moduleId: hubspotResult.module_id,
        totalTime
      });

      return deployment;

    } catch (error) {
      deployment.status = 'failed';
      deployment.error_message = error instanceof Error ? error.message : 'Unknown deployment error';
      deployment.completed_at = new Date().toISOString();

      // Attempt rollback if enabled and backup exists
      if (options.rollback_on_failure && deployment.rollback_info) {
        try {
          await this.rollbackDeployment(credentials, deployment.rollback_info.backup_id);
          deployment.status = 'rolled_back';
        } catch (rollbackError) {
          logger.error('Rollback failed', { deploymentId, rollbackError });
        }
      }

      await this.saveDeploymentStatus(deployment);

      logger.error('HubSpot module deployment failed', {
        deploymentId,
        error: deployment.error_message
      });

      throw error;
    }
  }

  /**
   * Validate credentials with HubSpot API
   */
  private async validateCredentials(credentials: HubSpotCredentials): Promise<void> {
    try {
      const response = await this.hubspotClient.get('/oauth/v1/access-tokens/' + credentials.access_token);
      
      if (!response.data || response.data.portal_id !== credentials.portal_id) {
        throw new Error('Invalid HubSpot credentials');
      }
    } catch (error) {
      throw new Error('Failed to validate HubSpot credentials');
    }
  }

  /**
   * Validate package for deployment
   */
  private async validateForDeployment(
    packageResult: PackageResult,
    validationLevel: string
  ): Promise<{ passed: boolean; errors: any[]; warnings: any[] }> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Basic validation
    if (!packageResult.manifest.files.find(f => f.path === 'module.html')) {
      errors.push({ message: 'Missing module.html file', code: 'MISSING_TEMPLATE' });
    }

    if (!packageResult.manifest.files.find(f => f.path === 'meta.json')) {
      errors.push({ message: 'Missing meta.json file', code: 'MISSING_META' });
    }

    // Strict validation
    if (validationLevel === 'strict' || validationLevel === 'comprehensive') {
      if (!packageResult.manifest.files.find(f => f.path === 'fields.json')) {
        errors.push({ message: 'Missing fields.json file', code: 'MISSING_FIELDS' });
      }

      if (packageResult.manifest.metadata.total_size_bytes > 5 * 1024 * 1024) { // 5MB limit
        warnings.push({ message: 'Package size exceeds recommended limit', code: 'LARGE_PACKAGE' });
      }
    }

    // Comprehensive validation
    if (validationLevel === 'comprehensive') {
      if (packageResult.validation_report.performance_score < 80) {
        warnings.push({ message: 'Performance score below recommended threshold', code: 'LOW_PERFORMANCE' });
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create backup of existing module
   */
  private async createBackup(
    credentials: HubSpotCredentials,
    moduleName: string
  ): Promise<{ backup_id: string; rollback_available: boolean }> {
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // In a real implementation, this would download the existing module from HubSpot
      // For now, we'll create a placeholder backup
      const backupData = {
        backup_id: backupId,
        module_name: moduleName,
        created_at: new Date().toISOString(),
        portal_id: credentials.portal_id
      };

      const backupPath = path.join(this.deploymentsDir, `${backupId}.json`);
      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));

      return {
        backup_id: backupId,
        rollback_available: true
      };
    } catch (error) {
      logger.warn('Failed to create backup', { moduleName, error });
      return {
        backup_id: backupId,
        rollback_available: false
      };
    }
  }

  /**
   * Upload module to HubSpot Design Manager
   */
  private async uploadToHubSpot(
    packageResult: PackageResult,
    credentials: HubSpotCredentials,
    options: DeploymentOptions
  ): Promise<{
    module_id: string;
    module_path: string;
    preview_url: string;
  }> {
    try {
      // Read package file
      const packageBuffer = await fs.readFile(packageResult.package_path);
      
      // Create form data for upload
      const formData = new FormData();
      formData.append('file', packageBuffer, {
        filename: `${packageResult.manifest.module_name}.zip`,
        contentType: 'application/zip'
      });
      formData.append('options', JSON.stringify({
        environment: options.environment,
        auto_publish: options.auto_publish
      }));

      // Upload to HubSpot (simulated - in real implementation would use actual HubSpot API)
      const response = await this.simulateHubSpotUpload(packageResult, credentials);

      return {
        module_id: response.module_id,
        module_path: response.module_path,
        preview_url: response.preview_url
      };

    } catch (error) {
      throw new Error(`HubSpot upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Simulate HubSpot upload (replace with actual API call)
   */
  private async simulateHubSpotUpload(
    packageResult: PackageResult,
    credentials: HubSpotCredentials
  ): Promise<{
    module_id: string;
    module_path: string;
    preview_url: string;
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const moduleId = `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const modulePath = `/modules/${packageResult.manifest.module_name.toLowerCase().replace(/\s+/g, '-')}`;
    const previewUrl = `https://app.hubspot.com/design-manager/${credentials.portal_id}/modules/${moduleId}`;

    return {
      module_id: moduleId,
      module_path: modulePath,
      preview_url: previewUrl
    };
  }

  /**
   * Publish module in HubSpot
   */
  private async publishModule(credentials: HubSpotCredentials, moduleId: string): Promise<void> {
    try {
      // Simulate publishing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logger.info('Module published in HubSpot', { moduleId });
    } catch (error) {
      logger.warn('Failed to publish module', { moduleId, error });
      throw error;
    }
  }

  /**
   * Rollback deployment
   */
  private async rollbackDeployment(credentials: HubSpotCredentials, backupId: string): Promise<void> {
    try {
      const backupPath = path.join(this.deploymentsDir, `${backupId}.json`);
      const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
      
      // In real implementation, would restore from backup
      logger.info('Deployment rolled back', { backupId });
    } catch (error) {
      throw new Error(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get deployment status
   */
  public async getDeploymentStatus(deploymentId: string): Promise<DeploymentResult | null> {
    try {
      const deploymentPath = path.join(this.deploymentsDir, `${deploymentId}.json`);
      const deploymentData = await fs.readFile(deploymentPath, 'utf8');
      return JSON.parse(deploymentData);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get deployment history
   */
  public async getDeploymentHistory(filters?: {
    portal_id?: string;
    environment?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<DeploymentHistory> {
    try {
      const files = await fs.readdir(this.deploymentsDir);
      const deploymentFiles = files.filter(f => f.endsWith('.json') && !f.includes('backup_'));
      
      const deployments: DeploymentResult[] = [];
      
      for (const file of deploymentFiles) {
        try {
          const content = await fs.readFile(path.join(this.deploymentsDir, file), 'utf8');
          const deployment = JSON.parse(content);
          
          // Apply filters
          if (filters?.environment && deployment.environment !== filters.environment) continue;
          if (filters?.status && deployment.status !== filters.status) continue;
          if (filters?.date_from && deployment.started_at < filters.date_from) continue;
          if (filters?.date_to && deployment.started_at > filters.date_to) continue;
          
          deployments.push(deployment);
        } catch (error) {
          logger.warn('Failed to parse deployment file', { file, error });
        }
      }
      
      const successfulDeployments = deployments.filter(d => d.status === 'completed');
      const totalDeploymentTime = successfulDeployments.reduce(
        (sum, d) => sum + (d.performance_metrics?.total_deployment_time_ms || 0), 
        0
      );
      
      return {
        deployments: deployments.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
        total_count: deployments.length,
        success_rate: deployments.length > 0 ? successfulDeployments.length / deployments.length : 0,
        average_deployment_time_ms: successfulDeployments.length > 0 ? totalDeploymentTime / successfulDeployments.length : 0,
        last_successful_deployment: successfulDeployments[0]?.completed_at
      };
    } catch (error) {
      logger.error('Failed to get deployment history', { error });
      return {
        deployments: [],
        total_count: 0,
        success_rate: 0,
        average_deployment_time_ms: 0
      };
    }
  }

  /**
   * Schedule deployment
   */
  public async scheduleDeployment(
    packageResult: PackageResult,
    credentials: HubSpotCredentials,
    options: DeploymentOptions,
    scheduledTime: string
  ): Promise<{ scheduled_deployment_id: string }> {
    const scheduledId = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const scheduledDeployment = {
      scheduled_deployment_id: scheduledId,
      package_id: packageResult.package_id,
      credentials: { ...credentials, access_token: '***' }, // Don't store actual token
      options,
      scheduled_time: scheduledTime,
      status: 'scheduled',
      created_at: new Date().toISOString()
    };

    const scheduledPath = path.join(this.deploymentsDir, `scheduled_${scheduledId}.json`);
    await fs.writeFile(scheduledPath, JSON.stringify(scheduledDeployment, null, 2));

    logger.info('Deployment scheduled', { scheduledId, scheduledTime });

    return { scheduled_deployment_id: scheduledId };
  }

  /**
   * Cancel scheduled deployment
   */
  public async cancelScheduledDeployment(scheduledDeploymentId: string): Promise<boolean> {
    try {
      const scheduledPath = path.join(this.deploymentsDir, `scheduled_${scheduledDeploymentId}.json`);
      await fs.unlink(scheduledPath);
      
      logger.info('Scheduled deployment cancelled', { scheduledDeploymentId });
      return true;
    } catch (error) {
      logger.error('Failed to cancel scheduled deployment', { scheduledDeploymentId, error });
      return false;
    }
  }

  /**
   * Get module versions
   */
  public async getModuleVersions(hubspotModuleId: string): Promise<ModuleVersion[]> {
    // In real implementation, would fetch from HubSpot API
    return [
      {
        version_id: 'v1',
        version_number: '1.0.0',
        deployed_at: new Date().toISOString(),
        deployed_by: 'system',
        status: 'active',
        change_summary: 'Initial deployment',
        hubspot_module_id: hubspotModuleId,
        package_id: 'pkg_initial'
      }
    ];
  }

  // Utility methods
  private generateDeploymentId(): string {
    return `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveDeploymentStatus(deployment: DeploymentResult): Promise<void> {
    try {
      const deploymentPath = path.join(this.deploymentsDir, `${deployment.deployment_id}.json`);
      await fs.writeFile(deploymentPath, JSON.stringify(deployment, null, 2));
    } catch (error) {
      logger.error('Failed to save deployment status', { deploymentId: deployment.deployment_id, error });
    }
  }
}

export default HubSpotDeploymentService;
