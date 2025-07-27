/**
 * Module Packaging Service
 * Handles packaging, bundling, and export of generated HubSpot modules
 * Phase 5: Export and Deployment System
 */

import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { HubSpotValidationService } from './HubSpotValidationService';

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

export interface PackageManifest {
  package_id: string;
  module_name: string;
  version: string;
  created_at: string;
  created_by: string;
  description: string;
  module_type: string;
  hubspot_version: string;
  dependencies: {
    name: string;
    version: string;
    required: boolean;
  }[];
  files: {
    path: string;
    size_bytes: number;
    checksum: string;
    type: 'template' | 'style' | 'script' | 'config' | 'asset' | 'documentation';
  }[];
  metadata: {
    total_size_bytes: number;
    file_count: number;
    compression_ratio: number;
    validation_status: 'valid' | 'invalid' | 'warning';
    validation_errors: any[];
  };
}

export interface PackageResult {
  package_id: string;
  package_path: string;
  manifest: PackageManifest;
  download_url: string;
  expires_at: string;
  validation_report: {
    is_valid: boolean;
    errors: any[];
    warnings: any[];
    performance_score: number;
  };
}

export interface ModuleFiles {
  'module.html': string;
  'module.css'?: string;
  'module.js'?: string;
  'fields.json': string;
  'meta.json': string;
  'README.md'?: string;
  assets?: {
    [filename: string]: Buffer;
  };
}

class ModulePackagingService {
  private static instance: ModulePackagingService;
  private validationService: HubSpotValidationService;
  private packagesDir: string;

  private constructor() {
    this.validationService = HubSpotValidationService.getInstance();
    this.packagesDir = path.join(process.cwd(), 'temp', 'packages');
    this.ensurePackagesDirectory();
  }

  public static getInstance(): ModulePackagingService {
    if (!ModulePackagingService.instance) {
      ModulePackagingService.instance = new ModulePackagingService();
    }
    return ModulePackagingService.instance;
  }

  private async ensurePackagesDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.packagesDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create packages directory', { error });
    }
  }

  /**
   * Package a module with specified options
   */
  public async packageModule(
    moduleId: string,
    moduleFiles: ModuleFiles,
    options: PackageOptions,
    metadata: {
      name: string;
      version: string;
      description: string;
      author: string;
    }
  ): Promise<PackageResult> {
    const packageId = this.generatePackageId();
    
    logger.info('Starting module packaging', {
      packageId,
      moduleId,
      format: options.format,
      compression: options.compression_level
    });

    try {
      // Validate module before packaging
      const validationReport = await this.validateModuleForPackaging(moduleFiles);
      
      if (!validationReport.is_valid && validationReport.errors.length > 0) {
        throw new Error(`Module validation failed: ${validationReport.errors.map(e => e.message).join(', ')}`);
      }

      // Process and optimize files
      const processedFiles = await this.processModuleFiles(moduleFiles, options);
      
      // Create package manifest
      const manifest = await this.createPackageManifest(
        packageId,
        processedFiles,
        metadata,
        validationReport
      );

      // Create package archive
      const packagePath = await this.createPackageArchive(
        packageId,
        processedFiles,
        manifest,
        options
      );

      // Generate download URL and expiration
      const downloadUrl = this.generateDownloadUrl(packageId);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      const result: PackageResult = {
        package_id: packageId,
        package_path: packagePath,
        manifest,
        download_url: downloadUrl,
        expires_at: expiresAt,
        validation_report: validationReport
      };

      logger.info('Module packaging completed', {
        packageId,
        packageSize: manifest.metadata.total_size_bytes,
        fileCount: manifest.metadata.file_count
      });

      return result;

    } catch (error) {
      logger.error('Module packaging failed', { packageId, moduleId, error });
      throw error;
    }
  }

  /**
   * Validate module files before packaging
   */
  private async validateModuleForPackaging(moduleFiles: ModuleFiles): Promise<{
    is_valid: boolean;
    errors: any[];
    warnings: any[];
    performance_score: number;
  }> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Validate required files
    const requiredFiles = ['module.html', 'fields.json', 'meta.json'];
    for (const file of requiredFiles) {
      if (!moduleFiles[file as keyof ModuleFiles]) {
        errors.push({
          type: 'missing_file',
          message: `Required file missing: ${file}`,
          severity: 'error'
        });
      }
    }

    // Validate file contents
    if (moduleFiles['fields.json']) {
      try {
        const fields = JSON.parse(moduleFiles['fields.json']);
        if (!Array.isArray(fields) || fields.length === 0) {
          warnings.push({
            type: 'empty_fields',
            message: 'No editable fields defined',
            severity: 'warning'
          });
        }
      } catch (error) {
        errors.push({
          type: 'invalid_json',
          message: 'Invalid fields.json format',
          severity: 'error'
        });
      }
    }

    if (moduleFiles['meta.json']) {
      try {
        const meta = JSON.parse(moduleFiles['meta.json']);
        if (!meta.label || !meta.content_types) {
          errors.push({
            type: 'invalid_meta',
            message: 'Meta.json missing required properties',
            severity: 'error'
          });
        }
      } catch (error) {
        errors.push({
          type: 'invalid_json',
          message: 'Invalid meta.json format',
          severity: 'error'
        });
      }
    }

    // Calculate performance score
    let performanceScore = 100;
    
    // Penalize for large HTML
    if (moduleFiles['module.html'] && moduleFiles['module.html'].length > 10000) {
      performanceScore -= 10;
      warnings.push({
        type: 'large_html',
        message: 'HTML template is quite large, consider optimization',
        severity: 'warning'
      });
    }

    // Penalize for large CSS
    if (moduleFiles['module.css'] && moduleFiles['module.css'].length > 5000) {
      performanceScore -= 5;
      warnings.push({
        type: 'large_css',
        message: 'CSS file is large, consider minification',
        severity: 'warning'
      });
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings,
      performance_score: Math.max(0, performanceScore)
    };
  }

  /**
   * Process and optimize module files based on options
   */
  private async processModuleFiles(
    moduleFiles: ModuleFiles,
    options: PackageOptions
  ): Promise<ModuleFiles> {
    const processed = { ...moduleFiles };

    // Minify CSS if requested
    if (options.minify_assets && processed['module.css']) {
      processed['module.css'] = this.minifyCSS(processed['module.css']);
    }

    // Minify JavaScript if requested
    if (options.minify_assets && processed['module.js']) {
      processed['module.js'] = this.minifyJS(processed['module.js']);
    }

    // Optimize HTML
    if (options.minify_assets && processed['module.html']) {
      processed['module.html'] = this.minifyHTML(processed['module.html']);
    }

    // Add documentation if requested
    if (options.include_documentation && !processed['README.md']) {
      processed['README.md'] = this.generateDocumentation(moduleFiles);
    }

    return processed;
  }

  /**
   * Create package manifest
   */
  private async createPackageManifest(
    packageId: string,
    moduleFiles: ModuleFiles,
    metadata: any,
    validationReport: any
  ): Promise<PackageManifest> {
    const files: PackageManifest['files'] = [];
    let totalSize = 0;

    // Process each file
    for (const [filename, content] of Object.entries(moduleFiles)) {
      if (filename === 'assets') continue; // Handle assets separately
      
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
      const sizeBytes = Buffer.byteLength(contentStr, 'utf8');
      const checksum = createHash('sha256').update(contentStr).digest('hex');
      
      files.push({
        path: filename,
        size_bytes: sizeBytes,
        checksum,
        type: this.getFileType(filename)
      });
      
      totalSize += sizeBytes;
    }

    // Handle assets
    if (moduleFiles.assets) {
      for (const [filename, buffer] of Object.entries(moduleFiles.assets)) {
        const checksum = createHash('sha256').update(buffer).digest('hex');
        
        files.push({
          path: `assets/${filename}`,
          size_bytes: buffer.length,
          checksum,
          type: 'asset'
        });
        
        totalSize += buffer.length;
      }
    }

    return {
      package_id: packageId,
      module_name: metadata.name,
      version: metadata.version,
      created_at: new Date().toISOString(),
      created_by: metadata.author,
      description: metadata.description,
      module_type: 'custom',
      hubspot_version: '2024.1',
      dependencies: [],
      files,
      metadata: {
        total_size_bytes: totalSize,
        file_count: files.length,
        compression_ratio: 0, // Will be calculated after compression
        validation_status: validationReport.is_valid ? 'valid' : validationReport.warnings.length > 0 ? 'warning' : 'invalid',
        validation_errors: validationReport.errors
      }
    };
  }

  /**
   * Create package archive
   */
  private async createPackageArchive(
    packageId: string,
    moduleFiles: ModuleFiles,
    manifest: PackageManifest,
    options: PackageOptions
  ): Promise<string> {
    const packagePath = path.join(this.packagesDir, `${packageId}.${options.format}`);
    
    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(packagePath);
      const archive = archiver(options.format === 'zip' ? 'zip' : 'tar', {
        zlib: { level: options.compression_level === 'best' ? 9 : options.compression_level === 'fast' ? 1 : 0 }
      });

      output.on('close', () => {
        // Update compression ratio in manifest
        const originalSize = manifest.metadata.total_size_bytes;
        const compressedSize = archive.pointer();
        manifest.metadata.compression_ratio = originalSize > 0 ? (originalSize - compressedSize) / originalSize : 0;
        
        resolve(packagePath);
      });

      archive.on('error', reject);
      archive.pipe(output);

      // Add manifest
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

      // Add module files
      for (const [filename, content] of Object.entries(moduleFiles)) {
        if (filename === 'assets') continue;
        
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        archive.append(contentStr, { name: filename });
      }

      // Add assets
      if (moduleFiles.assets) {
        for (const [filename, buffer] of Object.entries(moduleFiles.assets)) {
          archive.append(buffer, { name: `assets/${filename}` });
        }
      }

      archive.finalize();
    });
  }

  /**
   * Get package information
   */
  public async getPackageInfo(packageId: string): Promise<PackageManifest | null> {
    try {
      const manifestPath = path.join(this.packagesDir, `${packageId}_manifest.json`);
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      return JSON.parse(manifestContent);
    } catch (error) {
      return null;
    }
  }

  /**
   * List available packages
   */
  public async listPackages(filters?: {
    created_after?: string;
    created_by?: string;
    module_type?: string;
  }): Promise<PackageManifest[]> {
    try {
      const files = await fs.readdir(this.packagesDir);
      const manifestFiles = files.filter(f => f.endsWith('_manifest.json'));
      
      const packages: PackageManifest[] = [];
      
      for (const file of manifestFiles) {
        try {
          const content = await fs.readFile(path.join(this.packagesDir, file), 'utf8');
          const manifest = JSON.parse(content);
          
          // Apply filters
          if (filters?.created_after && manifest.created_at < filters.created_after) continue;
          if (filters?.created_by && manifest.created_by !== filters.created_by) continue;
          if (filters?.module_type && manifest.module_type !== filters.module_type) continue;
          
          packages.push(manifest);
        } catch (error) {
          logger.warn('Failed to parse package manifest', { file, error });
        }
      }
      
      return packages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error) {
      logger.error('Failed to list packages', { error });
      return [];
    }
  }

  /**
   * Delete a package
   */
  public async deletePackage(packageId: string): Promise<boolean> {
    try {
      const packageFiles = [
        `${packageId}.zip`,
        `${packageId}.tar`,
        `${packageId}_manifest.json`
      ];
      
      for (const file of packageFiles) {
        try {
          await fs.unlink(path.join(this.packagesDir, file));
        } catch (error) {
          // File might not exist, continue
        }
      }
      
      logger.info('Package deleted', { packageId });
      return true;
    } catch (error) {
      logger.error('Failed to delete package', { packageId, error });
      return false;
    }
  }

  // Utility methods
  private generatePackageId(): string {
    return `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDownloadUrl(packageId: string): string {
    return `/api/packages/${packageId}/download`;
  }

  private getFileType(filename: string): PackageManifest['files'][0]['type'] {
    const ext = path.extname(filename).toLowerCase();
    
    switch (ext) {
      case '.html': return 'template';
      case '.css': return 'style';
      case '.js': return 'script';
      case '.json': return 'config';
      case '.md': return 'documentation';
      default: return 'asset';
    }
  }

  private minifyCSS(css: string): string {
    // Simple CSS minification
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
      .trim();
  }

  private minifyJS(js: string): string {
    // Simple JS minification
    return js
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  private minifyHTML(html: string): string {
    // Simple HTML minification
    return html
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/>\s+</g, '><') // Remove space between tags
      .trim();
  }

  private generateDocumentation(moduleFiles: ModuleFiles): string {
    let doc = `# HubSpot Module Documentation\n\n`;
    
    // Parse meta.json for module info
    try {
      const meta = JSON.parse(moduleFiles['meta.json']);
      doc += `## ${meta.label}\n\n`;
      if (meta.help_text) {
        doc += `${meta.help_text}\n\n`;
      }
    } catch (error) {
      doc += `## Custom Module\n\n`;
    }

    // Add fields documentation
    try {
      const fields = JSON.parse(moduleFiles['fields.json']);
      if (fields.length > 0) {
        doc += `## Editable Fields\n\n`;
        fields.forEach((field: any) => {
          doc += `- **${field.label}** (${field.type}): ${field.help_text || 'No description'}\n`;
        });
        doc += `\n`;
      }
    } catch (error) {
      // Ignore
    }

    doc += `## Installation\n\n`;
    doc += `1. Upload this module to your HubSpot Design Manager\n`;
    doc += `2. Use the module in your templates or pages\n`;
    doc += `3. Configure the editable fields as needed\n\n`;

    doc += `## Files Included\n\n`;
    Object.keys(moduleFiles).forEach(filename => {
      if (filename !== 'assets') {
        doc += `- \`${filename}\`\n`;
      }
    });

    return doc;
  }
}

export default ModulePackagingService;
