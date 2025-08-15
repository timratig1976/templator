import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, Download, Trash2, Eye, Calendar, FileText, Layers, Settings, Plus, Search, Filter } from 'lucide-react';
import { SavedProject, ProjectVersion } from '../services/projectsService';
import { useProjectManager } from '../hooks/useProjectManager';
import { PipelineExecutionResult } from '../services/pipelineService';

interface ProjectManagerProps {
  onLoadProject: (project: any) => void;
  onCreateNew: () => void;
  className?: string;
}

export default function ProjectManager({ onLoadProject, onCreateNew, className = '' }: ProjectManagerProps) {
  const projectManager = useProjectManager();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created'>('updated');
  const [showVersions, setShowVersions] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<SavedProject | null>(null);

  // Filter and sort projects
  const filteredProjects = projectManager.allProjects
    .filter(project => 
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.originalFileName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'updated':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  };

  const handleLoadProject = async (project: SavedProject) => {
    try {
      const fullProject = await projectManager.loadProject(project.id);
      onLoadProject(fullProject);
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const handleDeleteProject = async (project: SavedProject, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (window.confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      await projectManager.deleteProject(project.id);
    }
  };

  const handleExportProject = async (project: SavedProject, event: React.MouseEvent) => {
    event.stopPropagation();
    await projectManager.exportProject(project.id, project.name);
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Folder className="w-5 h-5 mr-2 text-blue-600" />
            Project Manager
          </h2>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'updated' | 'created')}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="updated">Last Updated</option>
              <option value="created">Date Created</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="p-6">
        {projectManager.isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No projects found' : 'No projects yet'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm 
                ? 'Try adjusting your search terms.' 
                : 'Upload a design to create your first project.'
              }
            </p>
            {!searchTerm && (
              <button
                onClick={onCreateNew}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create First Project
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className={`border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer ${
                  projectManager.currentProject?.id === project.id ? 'border-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => handleLoadProject(project)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {project.name}
                      </h3>
                      {projectManager.currentProject?.id === project.id && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                      <div className="flex items-center space-x-1">
                        <FileText className="w-4 h-4" />
                        <span>{project.originalFileName}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Layers className="w-4 h-4" />
                        <span>{project.metadata.sectionsCount} sections</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Settings className="w-4 h-4" />
                        <span>{project.metadata.fieldsCount} fields</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>Updated {formatDate(project.updatedAt)}</span>
                      </div>
                      <span>v{project.latestVersion || project.versionsCount}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {(() => {
                      const splitId = (project as any)?.designSplitId
                        || (project as any)?.splitId
                        || (project as any)?.metadata?.designSplitId
                        || (project as any)?.metadata?.splitId;
                      if (splitId) {
                        const qp = new URLSearchParams({ splitId: String(splitId) });
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); window.location.href = `/split-assets?${qp.toString()}`; }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View parts (split assets)"
                            aria-label="View parts"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        );
                      }
                      return (
                        <button
                          disabled
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 text-gray-300 bg-gray-50 rounded-lg cursor-not-allowed"
                          title="No split available for this project"
                          aria-label="No parts available"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      );
                    })()}
                    <button
                      onClick={(e) => handleExportProject(project, e)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Export project"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteProject(project, e)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error Message */}
        {projectManager.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{projectManager.error}</p>
            <button
              onClick={projectManager.clearError}
              className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {filteredProjects.length} of {projectManager.allProjects.length} projects
          </span>
          <div className="flex items-center space-x-4">
            <span>Auto-save: {projectManager.autoSaveEnabled ? 'On' : 'Off'}</span>
            {projectManager.lastSaved && (
              <span>Last saved: {formatDate(projectManager.lastSaved.toISOString())}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
