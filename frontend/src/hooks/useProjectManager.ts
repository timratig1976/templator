import { useState, useCallback, useEffect } from 'react';
import { PipelineExecutionResult } from '../services/pipelineService';
import projectsService, { SavedProject, SaveProjectRequest, UpdateProjectRequest } from '../services/projectsService';

export interface ProjectManagerState {
  currentProject: SavedProject | null;
  allProjects: SavedProject[];
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  autoSaveEnabled: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  error: string | null;
}

export interface ProjectManagerActions {
  saveProject: (request: SaveProjectRequest) => Promise<SavedProject | null>;
  autoSaveProject: (pipelineResult: PipelineExecutionResult, originalFileName: string) => Promise<SavedProject | null>;
  updateProject: (projectId: string, request: UpdateProjectRequest) => Promise<SavedProject | null>;
  loadProject: (projectId: string) => Promise<any>;
  deleteProject: (projectId: string) => Promise<boolean>;
  loadAllProjects: () => Promise<void>;
  exportProject: (projectId: string, projectName: string) => Promise<void>;
  clearError: () => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
}

export interface UseProjectManagerReturn extends ProjectManagerState, ProjectManagerActions {}

export const useProjectManager = (): UseProjectManagerReturn => {
  const [state, setState] = useState<ProjectManagerState>({
    currentProject: null,
    allProjects: [],
    isLoading: false,
    isSaving: false,
    lastSaved: null,
    autoSaveEnabled: true,
    saveStatus: 'idle',
    error: null,
  });

  // Autoload removed: we directly choose which project to edit.

  const updateState = useCallback((updates: Partial<ProjectManagerState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const clearError = useCallback(() => {
    updateState({ error: null, saveStatus: 'idle' });
  }, [updateState]);

  const setAutoSaveEnabled = useCallback((enabled: boolean) => {
    updateState({ autoSaveEnabled: enabled });
    console.log(`🔧 Auto-save ${enabled ? 'enabled' : 'disabled'}`);
  }, [updateState]);

  const saveProject = useCallback(async (request: SaveProjectRequest): Promise<SavedProject | null> => {
    try {
      updateState({ isSaving: true, saveStatus: 'saving', error: null });

      const savedProject = await projectsService.saveProject(request);
      
      updateState({
        currentProject: savedProject,
        lastSaved: new Date(),
        isSaving: false,
        saveStatus: 'saved',
      });

      // Skipping auto-refresh of all projects

      console.log('✅ Project saved successfully:', savedProject.name);
      return savedProject;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save project';
      updateState({
        isSaving: false,
        saveStatus: 'error',
        error: errorMessage,
      });
      console.error('❌ Save project failed:', error);
      return null;
    }
  }, [updateState]);

  const autoSaveProject = useCallback(async (
    pipelineResult: PipelineExecutionResult,
    originalFileName: string
  ): Promise<SavedProject | null> => {
    if (!state.autoSaveEnabled) {
      console.log('⏸️ Auto-save disabled, skipping...');
      return null;
    }

    try {
      console.log('🔄 Auto-saving project...', {
        originalFileName,
        sectionsCount: pipelineResult.sections?.length || 0
      });

      updateState({ isSaving: true, saveStatus: 'saving', error: null });

      const savedProject = await projectsService.autoSaveProject(pipelineResult, originalFileName);
      
      updateState({
        currentProject: savedProject,
        lastSaved: new Date(),
        isSaving: false,
        saveStatus: 'saved',
      });

      // Refresh project list
      await loadAllProjects();

      console.log('✅ Auto-save completed:', savedProject.name);
      return savedProject;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Auto-save failed';
      updateState({
        isSaving: false,
        saveStatus: 'error',
        error: errorMessage,
      });
      console.error('❌ Auto-save failed:', error);
      return null;
    }
  }, [state.autoSaveEnabled, updateState]);

  const updateProject = useCallback(async (
    projectId: string,
    request: UpdateProjectRequest
  ): Promise<SavedProject | null> => {
    try {
      updateState({ isSaving: true, saveStatus: 'saving', error: null });

      const updatedProject = await projectsService.updateProject(projectId, request);
      
      updateState({
        currentProject: updatedProject,
        lastSaved: new Date(),
        isSaving: false,
        saveStatus: 'saved',
      });

      // Refresh project list
      await loadAllProjects();

      console.log('✅ Project updated successfully');
      return updatedProject;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update project';
      updateState({
        isSaving: false,
        saveStatus: 'error',
        error: errorMessage,
      });
      console.error('❌ Update project failed:', error);
      return null;
    }
  }, [updateState]);

  const loadProject = useCallback(async (projectId: string): Promise<any> => {
    try {
      updateState({ isLoading: true, error: null });

      const project = await projectsService.getProject(projectId);
      
      updateState({
        currentProject: project,
        isLoading: false,
      });

      console.log('✅ Project loaded successfully:', project.name);
      return project;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load project';
      updateState({
        isLoading: false,
        error: errorMessage,
      });
      console.error('❌ Load project failed:', error);
      return null;
    }
  }, [updateState]);

  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      updateState({ isLoading: true, error: null });

      const success = await projectsService.deleteProject(projectId);
      
      if (success) {
        // Clear current project if it was deleted
        if (state.currentProject?.id === projectId) {
          updateState({ currentProject: null });
        }
        
        // Skipping auto-refresh of all projects
        
        console.log('✅ Project deleted successfully');
      }

      updateState({ isLoading: false });
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete project';
      updateState({
        isLoading: false,
        error: errorMessage,
      });
      console.error('❌ Delete project failed:', error);
      return false;
    }
  }, [state.currentProject, updateState]);

  const loadAllProjects = useCallback(async (): Promise<void> => {
    try {
      updateState({ isLoading: true, error: null });

      const projects = await projectsService.getAllProjects();
      
      updateState({
        allProjects: projects,
        isLoading: false,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load projects';
      updateState({
        isLoading: false,
        error: errorMessage,
      });
      console.error('❌ Load projects failed:', error);
    }
  }, [updateState]);

  const exportProject = useCallback(async (projectId: string, projectName: string): Promise<void> => {
    try {
      updateState({ isLoading: true, error: null });

      await projectsService.exportProject(projectId, projectName);
      
      updateState({ isLoading: false });
      console.log('✅ Project exported successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export project';
      updateState({
        isLoading: false,
        error: errorMessage,
      });
      console.error('❌ Export project failed:', error);
    }
  }, [updateState]);

  return {
    ...state,
    saveProject,
    autoSaveProject,
    updateProject,
    loadProject,
    deleteProject,
    loadAllProjects,
    exportProject,
    clearError,
    setAutoSaveEnabled,
  };
};

export default useProjectManager;
