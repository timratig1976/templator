import { createLogger } from '../../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import { PipelineExecutionResult, EnhancedSection } from '../../pipeline/types/PipelineTypes';

// Use EnhancedSection from pipeline types
type PipelineSection = EnhancedSection;

const logger = createLogger();

export interface SavedProject {
  id: string;
  name: string;
  originalFileName: string;
  createdAt: Date;
  updatedAt: Date;
  pipelineResult: PipelineExecutionResult;
  versions: ProjectVersion[];
  metadata: {
    fileSize: number;
    sectionsCount: number;
    fieldsCount: number;
    lastModified: Date;
  };
}

export interface ProjectVersion {
  id: string;
  version: number;
  createdAt: Date;
  changes: string;
  html: string;
  sections: PipelineSection[];
  author?: string;
}

export interface SaveProjectRequest {
  name: string;
  originalFileName: string;
  pipelineResult: PipelineExecutionResult;
  author?: string;
}

export interface UpdateProjectRequest {
  projectId: string;
  changes: string;
  html?: string;
  sections?: PipelineSection[];
  author?: string;
}

class HTMLStorageService {
  private static instance: HTMLStorageService;
  private readonly storageDir: string;
  private readonly projectsFile: string;
  private projects: Map<string, SavedProject> = new Map();

  constructor() {
    this.storageDir = path.join(process.cwd(), 'storage', 'projects');
    this.projectsFile = path.join(this.storageDir, 'projects.json');
    this.initializeStorage();
  }

  public static getInstance(): HTMLStorageService {
    if (!HTMLStorageService.instance) {
      HTMLStorageService.instance = new HTMLStorageService();
    }
    return HTMLStorageService.instance;
  }

  /**
   * Initialize storage directory and load existing projects
   */
  private async initializeStorage(): Promise<void> {
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storageDir, { recursive: true });
      
      // Load existing projects
      await this.loadProjects();
      
      logger.info('HTML Storage Service initialized', {
        storageDir: this.storageDir,
        projectsCount: this.projects.size
      });
    } catch (error) {
      logger.error('Failed to initialize HTML storage', { error });
    }
  }

  /**
   * Load projects from storage
   */
  private async loadProjects(): Promise<void> {
    try {
      const data = await fs.readFile(this.projectsFile, 'utf-8');
      const projectsArray = JSON.parse(data);
      
      this.projects.clear();
      projectsArray.forEach((project: any) => {
        // Convert date strings back to Date objects
        project.createdAt = new Date(project.createdAt);
        project.updatedAt = new Date(project.updatedAt);
        project.metadata.lastModified = new Date(project.metadata.lastModified);
        project.versions.forEach((version: any) => {
          version.createdAt = new Date(version.createdAt);
        });
        
        this.projects.set(project.id, project);
      });
      
      logger.info('Projects loaded from storage', { count: this.projects.size });
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error('Failed to load projects', { error });
      }
      // File doesn't exist yet, start with empty projects
    }
  }

  /**
   * Save projects to storage
   */
  private async saveProjects(): Promise<void> {
    try {
      const projectsArray = Array.from(this.projects.values());
      await fs.writeFile(this.projectsFile, JSON.stringify(projectsArray, null, 2));
      logger.debug('Projects saved to storage', { count: projectsArray.length });
    } catch (error) {
      logger.error('Failed to save projects', { error });
      throw error;
    }
  }

  /**
   * Save a new project with generated HTML
   */
  async saveProject(request: SaveProjectRequest): Promise<SavedProject> {
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    try {
      logger.info('Saving new project', {
        projectId,
        name: request.name,
        originalFileName: request.originalFileName,
        sectionsCount: request.pipelineResult.sections?.length || 0
      });

      // Create initial version
      const initialVersion: ProjectVersion = {
        id: `version_${Date.now()}_1`,
        version: 1,
        createdAt: now,
        changes: 'Initial project creation',
        html: request.pipelineResult.sections?.map((s: PipelineSection) => s.html).join('\n') || '',
        sections: request.pipelineResult.sections || [],
        author: request.author || 'Anonymous'
      };

      // Create project
      const project: SavedProject = {
        id: projectId,
        name: request.name,
        originalFileName: request.originalFileName,
        createdAt: now,
        updatedAt: now,
        pipelineResult: request.pipelineResult,
        versions: [initialVersion],
        metadata: {
          fileSize: request.originalFileName.length, // Placeholder
          sectionsCount: request.pipelineResult.sections?.length || 0,
          fieldsCount: request.pipelineResult.sections?.reduce((acc: number, s: PipelineSection) => acc + (s.editableFields?.length || 0), 0) || 0,
          lastModified: now
        }
      };

      // Save project HTML files
      await this.saveProjectFiles(project);
      
      // Store in memory and persist
      this.projects.set(projectId, project);
      await this.saveProjects();

      logger.info('Project saved successfully', {
        projectId,
        versionsCount: project.versions.length,
        sectionsCount: project.metadata.sectionsCount
      });

      return project;
    } catch (error) {
      logger.error('Failed to save project', { projectId, error });
      throw error;
    }
  }

  /**
   * Update an existing project with new HTML or sections
   */
  async updateProject(request: UpdateProjectRequest): Promise<SavedProject> {
    const project = this.projects.get(request.projectId);
    if (!project) {
      throw new Error(`Project not found: ${request.projectId}`);
    }

    try {
      logger.info('Updating project', {
        projectId: request.projectId,
        changes: request.changes
      });

      const now = new Date();
      const newVersion = project.versions.length + 1;

      // Create new version
      const version: ProjectVersion = {
        id: `version_${Date.now()}_${newVersion}`,
        version: newVersion,
        createdAt: now,
        changes: request.changes,
        html: request.html || project.pipelineResult.sections?.map((s: PipelineSection) => s.html).join('\n') || '',
        sections: request.sections || project.pipelineResult.sections || [],
        author: request.author || 'Anonymous'
      };

      // Update project
      project.versions.push(version);
      project.updatedAt = now;
      project.metadata.lastModified = now;

      // Update pipeline result if sections provided
      if (request.sections) {
        project.pipelineResult.sections = request.sections;
        project.metadata.sectionsCount = request.sections.length;
        project.metadata.fieldsCount = request.sections.reduce((acc, s) => acc + (s.editableFields?.length || 0), 0);
      }

      // Save updated project files
      await this.saveProjectFiles(project);
      
      // Persist changes
      await this.saveProjects();

      logger.info('Project updated successfully', {
        projectId: request.projectId,
        newVersion,
        totalVersions: project.versions.length
      });

      return project;
    } catch (error) {
      logger.error('Failed to update project', { projectId: request.projectId, error });
      throw error;
    }
  }

  /**
   * Save project HTML files to disk
   */
  private async saveProjectFiles(project: SavedProject): Promise<void> {
    const projectDir = path.join(this.storageDir, project.id);
    await fs.mkdir(projectDir, { recursive: true });

    // Save latest version HTML
    const latestVersion = project.versions[project.versions.length - 1];
    const htmlFile = path.join(projectDir, `version_${latestVersion.version}.html`);
    await fs.writeFile(htmlFile, latestVersion.html);

    // Save combined HTML
    const combinedHtml = this.generateCombinedHTML(latestVersion.sections);
    const combinedFile = path.join(projectDir, 'combined.html');
    await fs.writeFile(combinedFile, combinedHtml);

    // Save sections individually
    const sectionsDir = path.join(projectDir, 'sections');
    await fs.mkdir(sectionsDir, { recursive: true });
    
    for (const section of latestVersion.sections) {
      const sectionFile = path.join(sectionsDir, `${section.id}.html`);
      await fs.writeFile(sectionFile, section.html);
    }

    logger.debug('Project files saved', {
      projectId: project.id,
      version: latestVersion.version,
      sectionsCount: latestVersion.sections.length
    });
  }

  /**
   * Generate combined HTML from sections
   */
  private generateCombinedHTML(sections: PipelineSection[]): string {
    const sectionsHtml = sections.map(section => 
      `<!-- ${section.name} Section -->
${section.html}`
    ).join('\n\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Design</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
${sectionsHtml}
</body>
</html>`;
  }

  /**
   * Get a project by ID
   */
  async getProject(projectId: string): Promise<SavedProject | null> {
    return this.projects.get(projectId) || null;
  }

  /**
   * Get all projects
   */
  async getAllProjects(): Promise<SavedProject[]> {
    return Array.from(this.projects.values()).sort((a, b) => 
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<boolean> {
    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }

    try {
      // Delete project files
      const projectDir = path.join(this.storageDir, projectId);
      await fs.rm(projectDir, { recursive: true, force: true });
      
      // Remove from memory and persist
      this.projects.delete(projectId);
      await this.saveProjects();

      logger.info('Project deleted', { projectId });
      return true;
    } catch (error) {
      logger.error('Failed to delete project', { projectId, error });
      throw error;
    }
  }

  /**
   * Get project statistics
   */
  async getStorageStats(): Promise<{
    totalProjects: number;
    totalVersions: number;
    totalSections: number;
    storageSize: string;
    oldestProject: Date | null;
    newestProject: Date | null;
  }> {
    const projects = Array.from(this.projects.values());
    
    const stats = {
      totalProjects: projects.length,
      totalVersions: projects.reduce((acc, p) => acc + p.versions.length, 0),
      totalSections: projects.reduce((acc, p) => acc + p.metadata.sectionsCount, 0),
      storageSize: '0 MB', // TODO: Calculate actual storage size
      oldestProject: projects.length > 0 ? 
        new Date(Math.min(...projects.map(p => p.createdAt.getTime()))) : null,
      newestProject: projects.length > 0 ? 
        new Date(Math.max(...projects.map(p => p.updatedAt.getTime()))) : null
    };

    return stats;
  }
}

export default HTMLStorageService;
