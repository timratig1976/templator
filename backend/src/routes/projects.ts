import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import HTMLStorageService from '../services/storage/HTMLStorageService';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { validateRequest, saveProjectSchema, updateProjectSchema } from '../middleware/unifiedValidation';

const router = Router();
const logger = createLogger();
const htmlStorage = HTMLStorageService.getInstance();

// Validation schemas are now imported from unifiedValidation
// No need to redefine them here

/**
 * Save a new project with generated HTML
 * POST /api/projects
 */
router.post('/', validateRequest(saveProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, originalFileName, pipelineResult, author } = req.body;
    
    logger.info('Saving new project', {
      name,
      originalFileName,
      sectionsCount: pipelineResult.sections?.length || 0,
      author: author || 'Anonymous'
    });

    const savedProject = await htmlStorage.saveProject({
      name,
      originalFileName,
      pipelineResult,
      author
    });

    res.status(201).json({
      success: true,
      data: {
        project: {
          id: savedProject.id,
          name: savedProject.name,
          originalFileName: savedProject.originalFileName,
          createdAt: savedProject.createdAt,
          updatedAt: savedProject.updatedAt,
          metadata: savedProject.metadata,
          versionsCount: savedProject.versions.length
        }
      },
      message: 'Project saved successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get all projects
 * GET /api/projects
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await htmlStorage.getAllProjects();
    
    // Return summary data for list view
    const projectSummaries = projects.map(project => ({
      id: project.id,
      name: project.name,
      originalFileName: project.originalFileName,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      metadata: project.metadata,
      versionsCount: project.versions.length,
      latestVersion: project.versions[project.versions.length - 1]?.version || 1
    }));

    res.json({
      success: true,
      data: {
        projects: projectSummaries,
        total: projectSummaries.length
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get a specific project by ID
 * GET /api/projects/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await htmlStorage.getProject(id);
    
    if (!project) {
      throw createError('Project not found', 404, 'INTERNAL_ERROR');
    }

    res.json({
      success: true,
      data: { project }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Update a project with new HTML or sections
 * PUT /api/projects/:id
 */
router.put('/:id', validateRequest(updateProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { changes, html, sections, author } = req.body;
    
    logger.info('Updating project', {
      projectId: id,
      changes,
      hasHtml: !!html,
      sectionsCount: sections?.length || 0,
      author: author || 'Anonymous'
    });

    const updatedProject = await htmlStorage.updateProject({
      projectId: id,
      changes,
      html,
      sections,
      author
    });

    res.json({
      success: true,
      data: {
        project: {
          id: updatedProject.id,
          name: updatedProject.name,
          updatedAt: updatedProject.updatedAt,
          metadata: updatedProject.metadata,
          versionsCount: updatedProject.versions.length,
          latestVersion: updatedProject.versions[updatedProject.versions.length - 1]
        }
      },
      message: 'Project updated successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Delete a project
 * DELETE /api/projects/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    logger.info('Deleting project', { projectId: id });
    
    const deleted = await htmlStorage.deleteProject(id);
    
    if (!deleted) {
      throw createError('Project not found', 404, 'INTERNAL_ERROR');
    }

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get project version history
 * GET /api/projects/:id/versions
 */
router.get('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await htmlStorage.getProject(id);
    
    if (!project) {
      throw createError('Project not found', 404, 'INTERNAL_ERROR');
    }

    res.json({
      success: true,
      data: {
        projectId: id,
        versions: project.versions.map(version => ({
          id: version.id,
          version: version.version,
          createdAt: version.createdAt,
          changes: version.changes,
          author: version.author,
          sectionsCount: version.sections.length,
          htmlLength: version.html.length
        }))
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get specific version HTML
 * GET /api/projects/:id/versions/:versionId/html
 */
router.get('/:id/versions/:versionId/html', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, versionId } = req.params;
    const project = await htmlStorage.getProject(id);
    
    if (!project) {
      throw createError('Project not found', 404, 'INTERNAL_ERROR');
    }

    const version = project.versions.find(v => v.id === versionId);
    if (!version) {
      throw createError('Version not found', 404, 'INTERNAL_ERROR');
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(version.html);

  } catch (error) {
    next(error);
  }
});

/**
 * Get storage statistics
 * GET /api/projects/stats
 */
router.get('/stats/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await htmlStorage.getStorageStats();
    
    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Export project as ZIP
 * GET /api/projects/:id/export
 */
router.get('/:id/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await htmlStorage.getProject(id);
    
    if (!project) {
      throw createError('Project not found', 404, 'INTERNAL_ERROR');
    }

    // TODO: Implement ZIP export functionality
    // For now, return the latest HTML
    const latestVersion = project.versions[project.versions.length - 1];
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name}.html"`);
    res.send(latestVersion.html);

  } catch (error) {
    next(error);
  }
});

export default router;
