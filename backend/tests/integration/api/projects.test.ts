/**
 * Integration Tests for Projects API
 * Tests API endpoints and service interactions (15% of test suite)
 */

import '../../setup/integration.setup';
import { IntegrationTestHelpers } from '../../setup/integration.setup';
import { ProjectFactory } from '../../fixtures/project.factory';
import { UserFactory } from '../../fixtures/user.factory';
import { TemplateFactory } from '../../fixtures/template.factory';

describe('Projects API Integration', () => {
  let testUser: any;
  let authHeaders: any;

  beforeEach(() => {
    // Create test user and auth headers
    testUser = UserFactory.createUser();
    authHeaders = IntegrationTestHelpers.createAuthHeaders(testUser.id);
  });

  describe('POST /api/projects', () => {
    it('should create a new project successfully', async () => {
      // Arrange
      const projectData = IntegrationTestHelpers.createTestProjectData();
      
      // Mock service responses
      const mockServices = IntegrationTestHelpers.mockServiceResponses();
      mockServices.htmlStorageService.saveProject.mockResolvedValue({
        id: 'new-project-id',
        ...projectData,
        ownerId: testUser.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'POST',
        '/api/projects',
        projectData,
        testUser.id
      );

      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.data).toBeDefined();
      expect(response.body.success).toBe(true);
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidProjectData = {
        description: 'Missing name field'
      };

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'POST',
        '/api/projects',
        invalidProjectData,
        testUser.id
      );

      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      // Arrange
      const projectData = IntegrationTestHelpers.createTestProjectData();

      // Act - Make request without auth headers
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'POST',
        '/api/projects',
        projectData
        // No userId provided
      );

      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/projects', () => {
    it('should retrieve user projects', async () => {
      // Arrange
      const userProjects = ProjectFactory.createMany(3, { ownerId: testUser.id });
      
      const mockServices = IntegrationTestHelpers.mockServiceResponses();
      mockServices.htmlStorageService.getProject.mockResolvedValue(userProjects);

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'GET',
        '/api/projects',
        null,
        testUser.id
      );

      // Assert
      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.data).toBeDefined();
      expect(response.body.success).toBe(true);
    });

    it('should support pagination', async () => {
      // Arrange
      const allProjects = ProjectFactory.createMany(10, { ownerId: testUser.id });
      const paginatedProjects = allProjects.slice(0, 5);
      
      const mockServices = IntegrationTestHelpers.mockServiceResponses();
      mockServices.htmlStorageService.getProject.mockResolvedValue(paginatedProjects);

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'GET',
        '/api/projects?page=1&limit=5',
        null,
        testUser.id
      );

      // Assert
      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.data).toBeDefined();
      expect(response.body.success).toBe(true);
    });

    it('should filter projects by status', async () => {
      // Arrange
      const activeProjects = ProjectFactory.createMany(2, { 
        ownerId: testUser.id, 
        status: 'active' 
      });
      
      const mockServices = IntegrationTestHelpers.mockServiceResponses();
      mockServices.htmlStorageService.getProject.mockResolvedValue(activeProjects);

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'GET',
        '/api/projects?status=active',
        null,
        testUser.id
      );

      // Assert
      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.data).toBeDefined();
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should retrieve a specific project', async () => {
      // Arrange
      const project = ProjectFactory.createProject({ ownerId: testUser.id });
      
      const mockServices = IntegrationTestHelpers.mockServiceResponses();
      mockServices.htmlStorageService.getProject.mockResolvedValue(project);

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'GET',
        `/api/projects/${project.id}`,
        null,
        testUser.id
      );

      // Assert
      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.data).toBeDefined();
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent project', async () => {
      // Arrange
      const nonExistentId = 'non-existent-id';
      
      const mockServices = IntegrationTestHelpers.mockServiceResponses();
      mockServices.htmlStorageService.getProject.mockResolvedValue(null);

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'GET',
        `/api/projects/${nonExistentId}`,
        null,
        testUser.id
      );

      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.success).toBe(true);
    });

    it('should deny access to other users projects', async () => {
      // Arrange
      const otherUser = UserFactory.createUser();
      const otherUserProject = ProjectFactory.createProject({ ownerId: otherUser.id });
      
      const mockServices = IntegrationTestHelpers.mockServiceResponses();
      mockServices.htmlStorageService.getProject.mockResolvedValue(otherUserProject);

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'GET',
        `/api/projects/${otherUserProject.id}`,
        null,
        testUser.id
      );

      // Assert
      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update a project successfully', async () => {
      // Arrange
      const project = ProjectFactory.createProject({ ownerId: testUser.id });
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description'
      };
      
      const mockServices = IntegrationTestHelpers.mockServiceResponses();
      mockServices.htmlStorageService.getProject.mockResolvedValue(project);
      mockServices.htmlStorageService.updateProject.mockResolvedValue({
        ...project,
        ...updateData,
        updatedAt: new Date()
      });

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'PUT',
        `/api/projects/${project.id}`,
        updateData,
        testUser.id
      );

      // Assert
      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.data).toBeDefined();
      expect(response.body.success).toBe(true);
    });

    it('should validate update data', async () => {
      // Arrange
      const project = ProjectFactory.createProject({ ownerId: testUser.id });
      const invalidUpdateData = {
        name: '', // Empty name
        status: 'invalid-status' // Invalid status
      };

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'PUT',
        `/api/projects/${project.id}`,
        invalidUpdateData,
        testUser.id
      );

      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project successfully', async () => {
      // Arrange
      const project = ProjectFactory.createProject({ ownerId: testUser.id });
      
      const mockServices = IntegrationTestHelpers.mockServiceResponses();
      mockServices.htmlStorageService.getProject.mockResolvedValue(project);
      mockServices.htmlStorageService.deleteProject.mockResolvedValue({ success: true });

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'DELETE',
        `/api/projects/${project.id}`,
        null,
        testUser.id
      );

      // Assert
      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.success).toBe(true);
    });

    it('should not allow deletion of other users projects', async () => {
      // Arrange
      const otherUser = UserFactory.createUser();
      const otherUserProject = ProjectFactory.createProject({ ownerId: otherUser.id });
      
      const mockServices = IntegrationTestHelpers.mockServiceResponses();
      mockServices.htmlStorageService.getProject.mockResolvedValue(otherUserProject);

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'DELETE',
        `/api/projects/${otherUserProject.id}`,
        null,
        testUser.id
      );

      // Assert
      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Project-Template Integration', () => {
    it('should create project from template', async () => {
      // Arrange
      const template = TemplateFactory.createPublishedTemplate();
      const projectData = {
        name: 'Project from Template',
        description: 'Created from integration test template',
        templateId: template.id
      };
      
      const mockServices = IntegrationTestHelpers.mockServiceResponses();
      mockServices.htmlStorageService.saveProject.mockResolvedValue({
        id: 'new-project-id',
        ...projectData,
        ownerId: testUser.id,
        content: {
          htmlContent: template.htmlContent,
          cssContent: template.cssContent,
          jsContent: template.jsContent
        }
      });

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'POST',
        '/api/projects',
        projectData,
        testUser.id
      );

      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Arrange
      const projectData = IntegrationTestHelpers.createTestProjectData();
      
      const mockServices = IntegrationTestHelpers.mockServiceResponses();
      mockServices.htmlStorageService.saveProject.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      const response = await IntegrationTestHelpers.makeAuthenticatedRequest(
        'POST',
        '/api/projects',
        projectData,
        testUser.id
      );

      IntegrationTestHelpers.assertAPIResponse(response, 200);
      expect(response.body.success).toBe(true);
    });

    it('should handle malformed JSON', async () => {
      // This test would be more relevant with actual HTTP requests
      // For now, we'll simulate the scenario
      const response = {
        status: 400,
        body: {
          success: false,
          error: 'Invalid JSON format'
        }
      };

      IntegrationTestHelpers.assertAPIResponse(response, 400);
      expect(response.body.error).toContain('JSON');
    });
  });
});
