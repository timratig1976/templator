import { PipelineExecutionResult } from './pipelineService';

export interface SavedProject {
  id: string;
  name: string;
  originalFileName: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    fileSize: number;
    sectionsCount: number;
    fieldsCount: number;
    lastModified: string;
  };
  versionsCount: number;
  latestVersion?: number;
}

export interface ProjectVersion {
  id: string;
  version: number;
  createdAt: string;
  changes: string;
  author?: string;
  sectionsCount: number;
  htmlLength: number;
}

export interface SaveProjectRequest {
  name: string;
  originalFileName: string;
  pipelineResult: PipelineExecutionResult;
  author?: string;
}

export interface UpdateProjectRequest {
  changes: string;
  html?: string;
  sections?: any[];
  author?: string;
}

export interface ProjectsApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class ProjectsService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3009';
  }

  /**
   * Save a new project with generated HTML
   */
  async saveProject(request: SaveProjectRequest): Promise<SavedProject> {
    try {
      console.log('🔄 Saving project to backend...', {
        name: request.name,
        originalFileName: request.originalFileName,
        sectionsCount: request.pipelineResult.sections?.length || 0
      });

      const response = await fetch(`${this.baseUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result: ProjectsApiResponse<{ project: SavedProject }> = await response.json();
      
      console.log('✅ Project saved successfully:', result.data.project);
      return result.data.project;
    } catch (error) {
      console.error('❌ Failed to save project:', error);
      throw error;
    }
  }

  /**
   * Get all saved projects
   */
  async getAllProjects(): Promise<SavedProject[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/projects`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // Support multiple possible shapes from backend for robustness
      const raw = await response.json();
      // Common shapes:
      // 1) { success, data: { projects: [...], total } }
      // 2) { success, data: { items: [...] } }
      // 3) { success, data: [...] }
      // 4) direct array: [...]
      try {
        if (Array.isArray(raw)) {
          return raw as SavedProject[];
        }
        if (raw && typeof raw === 'object') {
          const data = (raw as any).data ?? raw;
          if (Array.isArray(data)) {
            return data as SavedProject[];
          }
          if (data?.projects && Array.isArray(data.projects)) {
            return data.projects as SavedProject[];
          }
          if (data?.items && Array.isArray(data.items)) {
            return data.items as SavedProject[];
          }
        }
      } catch (e) {
        console.warn('⚠️ Unexpected projects payload shape', e, raw);
      }
      console.warn('⚠️ Unrecognized projects response shape, returning empty list', raw);
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch projects:', error);
      throw error;
    }
  }

  /**
   * Get a specific project by ID
   */
  async getProject(projectId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/projects/${projectId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ProjectsApiResponse<{ project: any }> = await response.json();
      return result.data.project;
    } catch (error) {
      console.error('❌ Failed to fetch project:', error);
      throw error;
    }
  }

  /**
   * Update an existing project
   */
  async updateProject(projectId: string, request: UpdateProjectRequest): Promise<SavedProject> {
    try {
      console.log('🔄 Updating project...', {
        projectId,
        changes: request.changes
      });

      const response = await fetch(`${this.baseUrl}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result: ProjectsApiResponse<{ project: SavedProject }> = await response.json();
      
      console.log('✅ Project updated successfully:', result.data.project);
      return result.data.project;
    } catch (error) {
      console.error('❌ Failed to update project:', error);
      throw error;
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<boolean> {
    try {
      console.log('🔄 Deleting project...', { projectId });

      const response = await fetch(`${this.baseUrl}/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('✅ Project deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to delete project:', error);
      throw error;
    }
  }

  /**
   * Get project version history
   */
  async getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/projects/${projectId}/versions`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ProjectsApiResponse<{ projectId: string; versions: ProjectVersion[] }> = await response.json();
      return result.data.versions;
    } catch (error) {
      console.error('❌ Failed to fetch project versions:', error);
      throw error;
    }
  }

  /**
   * Export project as file
   */
  async exportProject(projectId: string, projectName: string): Promise<void> {
    try {
      console.log('🔄 Exporting project...', { projectId, projectName });

      const response = await fetch(`${this.baseUrl}/api/projects/${projectId}/export`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${projectName}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ Project exported successfully');
    } catch (error) {
      console.error('❌ Failed to export project:', error);
      throw error;
    }
  }

  /**
   * Auto-save project with generated name
   */
  async autoSaveProject(
    pipelineResult: PipelineExecutionResult,
    originalFileName: string
  ): Promise<SavedProject> {
    const timestamp = new Date().toLocaleString();
    const projectName = `${originalFileName.replace(/\.[^/.]+$/, '')} - ${timestamp}`;

    return this.saveProject({
      name: projectName,
      originalFileName,
      pipelineResult,
      author: 'Auto-save'
    });
  }

  /**
   * Generate a user-friendly project name
   */
  generateProjectName(originalFileName: string, customName?: string): string {
    if (customName && customName.trim()) {
      return customName.trim();
    }

    const baseName = originalFileName.replace(/\.[^/.]+$/, '');
    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `${baseName} - ${timestamp}`;
  }
}

// Export singleton instance
export const projectsService = new ProjectsService();
export default projectsService;
