/**
 * Module Versioning Service
 * Manages module versions, history, and rollback capabilities
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface ModuleVersion {
  version_id: string;
  version_number: string;
  module_id: string;
  package_id: string;
  deployment_id?: string;
  created_at: string;
  created_by: string;
  status: 'draft' | 'packaged' | 'deployed' | 'active' | 'inactive' | 'archived';
  change_summary: string;
  change_log: string[];
  metadata: {
    module_name: string;
    description: string;
    file_count: number;
    total_size_bytes: number;
    checksum: string;
  };
  files: Record<string, string>;
  deployment_info?: {
    hubspot_module_id: string;
    portal_id: string;
    environment: 'sandbox' | 'production';
    deployed_at: string;
    deployment_url?: string;
  };
  rollback_info?: {
    can_rollback: boolean;
    previous_version_id?: string;
    backup_id?: string;
  };
}

export interface VersionHistory {
  module_id: string;
  versions: ModuleVersion[];
  total_versions: number;
  active_version?: ModuleVersion;
  latest_version: ModuleVersion;
  version_stats: {
    total_deployments: number;
    successful_deployments: number;
    failed_deployments: number;
    rollbacks: number;
  };
}

export interface VersionComparison {
  version_a: ModuleVersion;
  version_b: ModuleVersion;
  differences: {
    files_added: string[];
    files_removed: string[];
    files_modified: string[];
    metadata_changes: Record<string, { old: any; new: any }>;
  };
  compatibility_score: number;
  migration_required: boolean;
}

class ModuleVersioningService {
  private static instance: ModuleVersioningService;
  private versionsDir: string;
  private versionsIndex: Map<string, ModuleVersion[]>;

  constructor() {
    this.versionsDir = path.join(process.cwd(), 'data', 'versions');
    this.versionsIndex = new Map();
    this.initializeStorage();
  }

  static getInstance(): ModuleVersioningService {
    if (!ModuleVersioningService.instance) {
      ModuleVersioningService.instance = new ModuleVersioningService();
    }
    return ModuleVersioningService.instance;
  }

  /**
   * Initialize storage directories
   */
  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.versionsDir, { recursive: true });
      await this.loadVersionsIndex();
    } catch (error) {
      console.error('Failed to initialize versioning storage:', error);
    }
  }

  /**
   * Load versions index from storage
   */
  private async loadVersionsIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.versionsDir, 'index.json');
      const indexData = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexData);
      
      for (const [moduleId, versions] of Object.entries(index)) {
        this.versionsIndex.set(moduleId, versions as ModuleVersion[]);
      }
    } catch (error) {
      // Index doesn't exist yet, start with empty index
      this.versionsIndex = new Map();
    }
  }

  /**
   * Save versions index to storage
   */
  private async saveVersionsIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.versionsDir, 'index.json');
      const index = Object.fromEntries(this.versionsIndex);
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    } catch (error) {
      console.error('Failed to save versions index:', error);
    }
  }

  /**
   * Create a new module version
   */
  async createVersion(
    moduleId: string,
    packageId: string,
    files: Record<string, string>,
    metadata: {
      module_name: string;
      description: string;
      created_by: string;
      change_summary: string;
      change_log?: string[];
    }
  ): Promise<ModuleVersion> {
    const versionId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    // Calculate version number
    const existingVersions = this.versionsIndex.get(moduleId) || [];
    const versionNumber = this.generateVersionNumber(existingVersions);
    
    // Calculate metadata
    const totalSize = Object.values(files).reduce((size, content) => size + content.length, 0);
    const checksum = this.calculateChecksum(files);
    
    const version: ModuleVersion = {
      version_id: versionId,
      version_number: versionNumber,
      module_id: moduleId,
      package_id: packageId,
      created_at: timestamp,
      created_by: metadata.created_by,
      status: 'packaged',
      change_summary: metadata.change_summary,
      change_log: metadata.change_log || [],
      metadata: {
        module_name: metadata.module_name,
        description: metadata.description,
        file_count: Object.keys(files).length,
        total_size_bytes: totalSize,
        checksum
      },
      files,
      rollback_info: {
        can_rollback: existingVersions.length > 0,
        previous_version_id: existingVersions.length > 0 ? existingVersions[existingVersions.length - 1].version_id : undefined
      }
    };

    // Save version to storage
    await this.saveVersion(version);
    
    // Update index
    if (!this.versionsIndex.has(moduleId)) {
      this.versionsIndex.set(moduleId, []);
    }
    this.versionsIndex.get(moduleId)!.push(version);
    await this.saveVersionsIndex();

    return version;
  }

  /**
   * Get version by ID
   */
  async getVersion(versionId: string): Promise<ModuleVersion | null> {
    try {
      const versionPath = path.join(this.versionsDir, `${versionId}.json`);
      const versionData = await fs.readFile(versionPath, 'utf-8');
      return JSON.parse(versionData);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all versions for a module
   */
  async getModuleVersions(moduleId: string): Promise<VersionHistory> {
    const versions = this.versionsIndex.get(moduleId) || [];
    
    // Load full version data
    const fullVersions: ModuleVersion[] = [];
    for (const version of versions) {
      const fullVersion = await this.getVersion(version.version_id);
      if (fullVersion) {
        fullVersions.push(fullVersion);
      }
    }

    // Calculate stats
    const deployedVersions = fullVersions.filter(v => v.deployment_info);
    const successfulDeployments = deployedVersions.filter(v => v.status === 'active' || v.status === 'deployed');
    const failedDeployments = deployedVersions.filter(v => v.status === 'inactive');
    const rollbacks = fullVersions.filter(v => v.change_log.some(log => log.includes('rollback')));

    const activeVersion = fullVersions.find(v => v.status === 'active');
    const latestVersion = fullVersions[fullVersions.length - 1];

    return {
      module_id: moduleId,
      versions: fullVersions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      total_versions: fullVersions.length,
      active_version: activeVersion,
      latest_version: latestVersion,
      version_stats: {
        total_deployments: deployedVersions.length,
        successful_deployments: successfulDeployments.length,
        failed_deployments: failedDeployments.length,
        rollbacks: rollbacks.length
      }
    };
  }

  /**
   * Update version status
   */
  async updateVersionStatus(
    versionId: string,
    status: ModuleVersion['status'],
    deploymentInfo?: ModuleVersion['deployment_info']
  ): Promise<ModuleVersion | null> {
    const version = await this.getVersion(versionId);
    if (!version) return null;

    version.status = status;
    if (deploymentInfo) {
      version.deployment_info = deploymentInfo;
    }

    // If setting as active, deactivate other versions
    if (status === 'active') {
      const moduleVersions = this.versionsIndex.get(version.module_id) || [];
      for (const v of moduleVersions) {
        if (v.version_id !== versionId && v.status === 'active') {
          const otherVersion = await this.getVersion(v.version_id);
          if (otherVersion) {
            otherVersion.status = 'deployed';
            await this.saveVersion(otherVersion);
          }
        }
      }
    }

    await this.saveVersion(version);
    return version;
  }

  /**
   * Compare two versions
   */
  async compareVersions(versionIdA: string, versionIdB: string): Promise<VersionComparison | null> {
    const versionA = await this.getVersion(versionIdA);
    const versionB = await this.getVersion(versionIdB);

    if (!versionA || !versionB) return null;

    const filesA = new Set(Object.keys(versionA.files));
    const filesB = new Set(Object.keys(versionB.files));

    const filesAdded = Array.from(filesB).filter(file => !filesA.has(file));
    const filesRemoved = Array.from(filesA).filter(file => !filesB.has(file));
    const filesModified = Array.from(filesA)
      .filter(file => filesB.has(file) && versionA.files[file] !== versionB.files[file]);

    // Calculate compatibility score
    const totalChanges = filesAdded.length + filesRemoved.length + filesModified.length;
    const totalFiles = Math.max(filesA.size, filesB.size);
    const compatibilityScore = Math.max(0, 100 - (totalChanges / totalFiles) * 100);

    // Check metadata changes
    const metadataChanges: Record<string, { old: any; new: any }> = {};
    if (versionA.metadata.module_name !== versionB.metadata.module_name) {
      metadataChanges.module_name = { old: versionA.metadata.module_name, new: versionB.metadata.module_name };
    }

    return {
      version_a: versionA,
      version_b: versionB,
      differences: {
        files_added: filesAdded,
        files_removed: filesRemoved,
        files_modified: filesModified,
        metadata_changes: metadataChanges
      },
      compatibility_score: Math.round(compatibilityScore),
      migration_required: filesRemoved.length > 0 || Object.keys(metadataChanges).length > 0
    };
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(
    currentVersionId: string,
    targetVersionId: string,
    rollbackReason: string,
    performedBy: string
  ): Promise<ModuleVersion | null> {
    const currentVersion = await this.getVersion(currentVersionId);
    const targetVersion = await this.getVersion(targetVersionId);

    if (!currentVersion || !targetVersion) return null;

    // Create a new version based on the target version
    const rollbackVersion = await this.createVersion(
      targetVersion.module_id,
      `rollback_${targetVersion.package_id}`,
      targetVersion.files,
      {
        module_name: targetVersion.metadata.module_name,
        description: `Rollback to version ${targetVersion.version_number}`,
        created_by: performedBy,
        change_summary: `Rollback: ${rollbackReason}`,
        change_log: [
          `Rolled back from version ${currentVersion.version_number} to ${targetVersion.version_number}`,
          `Reason: ${rollbackReason}`,
          `Performed by: ${performedBy}`
        ]
      }
    );

    // Update current version status
    if (currentVersion.status === 'active') {
      await this.updateVersionStatus(currentVersionId, 'inactive');
    }

    return rollbackVersion;
  }

  /**
   * Archive old versions
   */
  async archiveOldVersions(moduleId: string, keepCount: number = 10): Promise<number> {
    const versions = this.versionsIndex.get(moduleId) || [];
    const sortedVersions = versions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    let archivedCount = 0;
    for (let i = keepCount; i < sortedVersions.length; i++) {
      const version = sortedVersions[i];
      if (version.status !== 'active' && version.status !== 'deployed') {
        await this.updateVersionStatus(version.version_id, 'archived');
        archivedCount++;
      }
    }

    return archivedCount;
  }

  /**
   * Delete archived versions
   */
  async deleteArchivedVersions(moduleId: string): Promise<number> {
    const versions = this.versionsIndex.get(moduleId) || [];
    let deletedCount = 0;

    for (const version of versions) {
      if (version.status === 'archived') {
        try {
          const versionPath = path.join(this.versionsDir, `${version.version_id}.json`);
          await fs.unlink(versionPath);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete version ${version.version_id}:`, error);
        }
      }
    }

    // Update index
    const remainingVersions = versions.filter(v => v.status !== 'archived');
    this.versionsIndex.set(moduleId, remainingVersions);
    await this.saveVersionsIndex();

    return deletedCount;
  }

  /**
   * Generate version number
   */
  private generateVersionNumber(existingVersions: ModuleVersion[]): string {
    if (existingVersions.length === 0) {
      return '1.0.0';
    }

    const latestVersion = existingVersions[existingVersions.length - 1];
    const [major, minor, patch] = latestVersion.version_number.split('.').map(Number);
    
    // For now, increment patch version
    return `${major}.${minor}.${patch + 1}`;
  }

  /**
   * Calculate checksum for files
   */
  private calculateChecksum(files: Record<string, string>): string {
    const content = Object.entries(files)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, content]) => `${path}:${content}`)
      .join('|');
    
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Save version to storage
   */
  private async saveVersion(version: ModuleVersion): Promise<void> {
    try {
      const versionPath = path.join(this.versionsDir, `${version.version_id}.json`);
      await fs.writeFile(versionPath, JSON.stringify(version, null, 2));
    } catch (error) {
      console.error(`Failed to save version ${version.version_id}:`, error);
      throw error;
    }
  }

  /**
   * Get version statistics
   */
  async getVersionStatistics(): Promise<{
    total_modules: number;
    total_versions: number;
    active_versions: number;
    archived_versions: number;
    storage_size_bytes: number;
  }> {
    let totalVersions = 0;
    let activeVersions = 0;
    let archivedVersions = 0;
    let storageSize = 0;

    for (const versions of this.versionsIndex.values()) {
      totalVersions += versions.length;
      activeVersions += versions.filter(v => v.status === 'active').length;
      archivedVersions += versions.filter(v => v.status === 'archived').length;
      
      for (const version of versions) {
        storageSize += version.metadata.total_size_bytes;
      }
    }

    return {
      total_modules: this.versionsIndex.size,
      total_versions: totalVersions,
      active_versions: activeVersions,
      archived_versions: archivedVersions,
      storage_size_bytes: storageSize
    };
  }
}

export const moduleVersioningService = ModuleVersioningService.getInstance();
export default moduleVersioningService;
