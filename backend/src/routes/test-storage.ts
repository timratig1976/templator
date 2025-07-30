import { Router } from 'express';
import { Request, Response } from 'express';
import HTMLStorageService from '../services/storage/HTMLStorageService';
import { createLogger } from '../utils/logger';
import { PipelineExecutionResult } from '../pipeline/types/PipelineTypes';

const router = Router();
const logger = createLogger();

/**
 * Test route for HTML storage functionality
 * POST /api/test/storage
 */
router.post('/', async (req: Request, res: Response) => {
  const testId = `test_${Date.now()}`;
  const htmlStorage = HTMLStorageService.getInstance();
  
  try {
    logger.info('Starting HTML storage test', { testId });
    
    // Test data - simplified for core functionality testing
    const mockPipelineResult: any = {
      pipelineId: testId,
      status: 'completed',
      sections: [
        {
          id: 'section_1',
          name: 'Header Section',
          type: 'header',
          html: '<header class="bg-blue-600 text-white p-4"><h1>Test Header</h1></header>'
        },
        {
          id: 'section_2',
          name: 'Content Section',
          type: 'content',
          html: '<main class="p-8"><p>Test content paragraph</p></main>'
        }
      ],
      metadata: {
        fileName: `test-design-${testId}.jpg`,
        processingTime: 5000,
        qualityScore: 90,
        sectionsCount: 2,
        fieldsCount: 2
      },
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };

    const tests = [];
    let passedTests = 0;
    let failedTests = 0;

    // Test 1: Save new project
    try {
      const savedProject = await htmlStorage.saveProject({
        name: `Test Project ${testId}`,
        originalFileName: `test-design-${testId}.jpg`,
        pipelineResult: mockPipelineResult,
        author: 'Test Suite'
      });

      tests.push({
        name: 'Save New Project',
        status: 'passed',
        details: `Project saved with ID: ${savedProject.id}`,
        data: { projectId: savedProject.id, sectionsCount: savedProject.metadata.sectionsCount }
      });
      passedTests++;

      // Test 2: Retrieve saved project
      try {
        const retrievedProject = await htmlStorage.getProject(savedProject.id);
        
        if (retrievedProject && retrievedProject.name === savedProject.name) {
          tests.push({
            name: 'Retrieve Project',
            status: 'passed',
            details: `Successfully retrieved project: ${retrievedProject.name}`,
            data: { projectId: retrievedProject.id, versionsCount: retrievedProject.versions.length }
          });
          passedTests++;
        } else {
          tests.push({
            name: 'Retrieve Project',
            status: 'failed',
            details: 'Retrieved project data mismatch',
            data: { expected: savedProject.name, actual: retrievedProject?.name || 'null' }
          });
          failedTests++;
        }
      } catch (error) {
        tests.push({
          name: 'Retrieve Project',
          status: 'failed',
          details: `Failed to retrieve project: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
        failedTests++;
      }

      // Test 3: Update project
      try {
        const updatedProject = await htmlStorage.updateProject({
          projectId: savedProject.id,
          changes: 'Added test update',
          author: 'Test Suite Update'
        });

        if (updatedProject.versions.length === 2) {
          tests.push({
            name: 'Update Project',
            status: 'passed',
            details: `Project updated with new version. Total versions: ${updatedProject.versions.length}`,
            data: { projectId: updatedProject.id, versionsCount: updatedProject.versions.length }
          });
          passedTests++;
        } else {
          tests.push({
            name: 'Update Project',
            status: 'failed',
            details: `Expected 2 versions, got ${updatedProject.versions.length}`,
            data: { expected: 2, actual: updatedProject.versions.length }
          });
          failedTests++;
        }
      } catch (error) {
        tests.push({
          name: 'Update Project',
          status: 'failed',
          details: `Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
        failedTests++;
      }

      // Test 4: List all projects
      try {
        const allProjects = await htmlStorage.getAllProjects();
        const testProject = allProjects.find(p => p.id === savedProject.id);
        
        if (testProject) {
          tests.push({
            name: 'List All Projects',
            status: 'passed',
            details: `Found test project in list of ${allProjects.length} projects`,
            data: { totalProjects: allProjects.length, testProjectFound: true }
          });
          passedTests++;
        } else {
          tests.push({
            name: 'List All Projects',
            status: 'failed',
            details: 'Test project not found in project list',
            data: { totalProjects: allProjects.length, testProjectFound: false }
          });
          failedTests++;
        }
      } catch (error) {
        tests.push({
          name: 'List All Projects',
          status: 'failed',
          details: `Failed to list projects: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
        failedTests++;
      }

      // Test 5: Storage statistics
      try {
        const stats = await htmlStorage.getStorageStats();
        
        if (stats.totalProjects > 0) {
          tests.push({
            name: 'Storage Statistics',
            status: 'passed',
            details: `Storage stats retrieved: ${stats.totalProjects} projects, ${stats.totalVersions} versions`,
            data: stats
          });
          passedTests++;
        } else {
          tests.push({
            name: 'Storage Statistics',
            status: 'failed',
            details: 'Storage statistics show no projects',
            data: stats
          });
          failedTests++;
        }
      } catch (error) {
        tests.push({
          name: 'Storage Statistics',
          status: 'failed',
          details: `Failed to get storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
        failedTests++;
      }

      // Test 6: Delete project (cleanup)
      try {
        const deleted = await htmlStorage.deleteProject(savedProject.id);
        
        if (deleted) {
          tests.push({
            name: 'Delete Project (Cleanup)',
            status: 'passed',
            details: 'Test project successfully deleted',
            data: { projectId: savedProject.id, deleted: true }
          });
          passedTests++;
        } else {
          tests.push({
            name: 'Delete Project (Cleanup)',
            status: 'failed',
            details: 'Failed to delete test project',
            data: { projectId: savedProject.id, deleted: false }
          });
          failedTests++;
        }
      } catch (error) {
        tests.push({
          name: 'Delete Project (Cleanup)',
          status: 'failed',
          details: `Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
        failedTests++;
      }

    } catch (error) {
      tests.push({
        name: 'Save New Project',
        status: 'failed',
        details: `Failed to save project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      failedTests++;
    }

    const totalTests = tests.length;
    const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    logger.info('HTML storage test completed', {
      testId,
      totalTests,
      passedTests,
      failedTests,
      successRate
    });

    res.json({
      success: true,
      data: {
        testId,
        summary: {
          totalTests,
          passedTests,
          failedTests,
          successRate,
          status: failedTests === 0 ? 'all_passed' : 'some_failed'
        },
        tests,
        timestamp: new Date().toISOString()
      },
      message: `HTML Storage test completed: ${passedTests}/${totalTests} tests passed (${successRate}%)`
    });

  } catch (error) {
    logger.error('HTML storage test failed', { testId, error });
    
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        testId,
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;
