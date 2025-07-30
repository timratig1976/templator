import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// API client with base configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Fetch prompt and generated HTML result data for a specific pipeline execution
 */
export const fetchPromptAndResultData = async (pipelineId: string, sectionId?: string) => {
  try {
    const response = await apiClient.get(`/prompts/${pipelineId}`, {
      params: { sectionId }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch prompt data:', error);
    throw new Error('Failed to load prompt and result data. Please try again.');
  }
};

/**
 * Upload design file for HTML generation
 */
export const uploadDesign = async (file: File, options: any = {}) => {
  const formData = new FormData();
  formData.append('designFile', file);
  
  // Add any options as form fields
  Object.entries(options).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  
  try {
    const response = await apiClient.post('/pipeline/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Design upload failed:', error);
    throw new Error('Failed to upload design. Please try again.');
  }
};

/**
 * Fetch generated HTML sections for a pipeline execution
 */
export const fetchGeneratedSections = async (pipelineId: string) => {
  try {
    const response = await apiClient.get(`/pipeline/${pipelineId}/sections`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch generated sections:', error);
    throw new Error('Failed to load generated sections. Please try again.');
  }
};

/**
 * Update a generated HTML section
 */
export const updateGeneratedSection = async (
  pipelineId: string,
  sectionId: string,
  html: string
) => {
  try {
    const response = await apiClient.put(`/pipeline/${pipelineId}/sections/${sectionId}`, {
      html
    });
    return response.data;
  } catch (error) {
    console.error('Failed to update section:', error);
    throw new Error('Failed to update HTML section. Please try again.');
  }
};

/**
 * Trigger quality validation for HTML
 */
export const validateHtml = async (html: string, sectionName: string) => {
  try {
    const response = await apiClient.post('/validation/html', {
      html,
      sectionName
    });
    return response.data;
  } catch (error) {
    console.error('HTML validation failed:', error);
    throw new Error('Failed to validate HTML. Please try again.');
  }
};

/**
 * Get list of all saved projects
 */
export const fetchProjects = async () => {
  try {
    const response = await apiClient.get('/projects');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    throw new Error('Failed to load projects. Please try again.');
  }
};

/**
 * Get specific project by ID
 */
export const fetchProject = async (projectId: string) => {
  try {
    const response = await apiClient.get(`/projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch project:', error);
    throw new Error('Failed to load project. Please try again.');
  }
};

/**
 * Save project
 */
export const saveProject = async (projectData: any) => {
  try {
    const response = await apiClient.post('/projects', projectData);
    return response.data;
  } catch (error) {
    console.error('Failed to save project:', error);
    throw new Error('Failed to save project. Please try again.');
  }
};

/**
 * Delete project
 */
export const deleteProject = async (projectId: string) => {
  try {
    const response = await apiClient.delete(`/projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete project:', error);
    throw new Error('Failed to delete project. Please try again.');
  }
};

/**
 * Export project as ZIP
 */
export const exportProjectZip = async (projectId: string) => {
  try {
    const response = await apiClient.get(`/projects/${projectId}/export`, {
      responseType: 'blob'
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `project-${projectId}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    return { success: true };
  } catch (error) {
    console.error('Failed to export project:', error);
    throw new Error('Failed to export project. Please try again.');
  }
};

export default {
  fetchPromptAndResultData,
  uploadDesign,
  fetchGeneratedSections,
  updateGeneratedSection,
  validateHtml,
  fetchProjects,
  fetchProject,
  saveProject,
  deleteProject,
  exportProjectZip
};
