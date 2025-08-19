# 🧪 Testing Strategy Blueprint
## Comprehensive Testing Pyramid with Mock Architecture

*Complete testing strategy based on proven patterns from enterprise applications. Includes comprehensive mock architecture, test data factories, and testing pyramid implementation.*

---

## 🎯 **Testing Philosophy**

### **Testing Pyramid (80% Unit, 15% Integration, 5% E2E)**
- **Unit Tests**: Fast, isolated, comprehensive coverage
- **Integration Tests**: Service communication and database integration
- **E2E Tests**: Complete user journeys and critical paths
- **Contract Tests**: API contract validation with Pact

### **Quality Standards**
- **80%+ Code Coverage**: Comprehensive test coverage
- **Fast Execution**: Unit tests <50ms, full suite <5 minutes
- **Reliable Tests**: Deterministic, no flaky tests
- **Maintainable**: Clear test structure and reusable patterns

---

## 📁 **Test Structure Organization (Multi-project)**

```
src/__tests__/
├── setup/                    # Test configuration
│   ├── unit.setup.ts        # Unit test setup/mocks (80%)
│   ├── integration.setup.ts # Integration setup/mocks (15%)
│   ├── e2e.setup.ts         # E2E setup (5%)
│   └── jest.setup.ts        # Global Jest hooks/config
├── fixtures/                 # Test data and factories
│   ├── data/                # Static test data
│   ├── factories/           # Test data factories
│   └── mocks/               # Mock implementations
├── unit/                    # Unit tests (80% of suite)
│   ├── domains/
│   ├── services/
│   ├── controllers/
│   └── utils/
├── integration/             # Integration tests (15%)
│   ├── routes/
│   ├── database/
│   └── external/
└── e2e/                     # End-to-end tests (5%)
    ├── user-journeys/
    └── critical-paths/
```

---

## ⚙️ **Jest Configuration (Multi-project)**

```typescript
// backend/jest.config.js
module.exports = {
  projects: [
    {
      displayName: { name: 'UNIT', color: 'green' },
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['<rootDir>/src/__tests__/unit/**/*.test.ts'],
      transform: { '^.+\\.ts$': 'ts-jest' },
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/unit.setup.ts'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**', '!src/server.ts']
    },
    {
      displayName: { name: 'E2E', color: 'blue' },
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['<rootDir>/src/__tests__/e2e/**/*.test.ts'],
      transform: { '^.+\\.ts$': 'ts-jest' },
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/e2e.setup.ts'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      maxWorkers: 1
    },
    {
      displayName: { name: 'INTEGRATION', color: 'yellow' },
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.ts'],
      transform: { '^.+\\.ts$': 'ts-jest' },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      maxWorkers: 1
    }
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 30000
};
```

---

## 🎭 **Mock Architecture Implementation**

### **Unit Test Setup (`unit.setup.ts`)**
```typescript
// tests/setup/unit.setup.ts
import './jest.setup';

// Mock external dependencies for unit tests
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn()
  },
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn()
  }
}));

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}));

jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Unit test helpers
export const UnitTestHelpers = {
  createMockService: () => ({
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }),

  createMockRepository: () => ({
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  }),

  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides
  }),

  createMockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  },

  mockOpenAISuccess: (content = 'Mock AI response') => ({
    choices: [{
      message: { content, role: 'assistant' },
      finish_reason: 'stop'
    }],
    usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 }
  }),

  mockOpenAIError: (message = 'OpenAI API Error') => {
    const error = new Error(message);
    error.status = 500;
    return Promise.reject(error);
  },

  resetAllMocks: () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  }
};

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  UnitTestHelpers.resetAllMocks();
});
```

---

## 🏭 **Test Data Factories**

### **Project Factory**
```typescript
// tests/fixtures/factories/project.factory.ts
import { faker } from '@faker-js/faker';

export interface TestProject {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  templateId?: string;
  status: 'active' | 'completed' | 'archived' | 'draft';
  content: {
    htmlContent: string;
    cssContent: string;
    jsContent?: string;
    images: string[];
    assets: string[];
  };
  metadata: {
    lastModified: Date;
    version: string;
    buildStatus: 'pending' | 'building' | 'success' | 'failed';
  };
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectFactory {
  static createProjectDto(overrides = {}) {
    return {
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      templateId: faker.string.uuid(),
      isPublic: faker.datatype.boolean(),
      tags: faker.helpers.arrayElements(['web', 'mobile', 'responsive']),
      ...overrides
    };
  }

  static createProject(overrides = {}): TestProject {
    return {
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      ownerId: faker.string.uuid(),
      templateId: faker.string.uuid(),
      status: faker.helpers.arrayElement(['active', 'completed', 'draft']),
      content: {
        htmlContent: this.generateProjectHTML(),
        cssContent: this.generateProjectCSS(),
        jsContent: this.generateProjectJS(),
        images: this.generateImagePaths(),
        assets: this.generateAssetPaths()
      },
      metadata: {
        lastModified: faker.date.recent(),
        version: faker.system.semver(),
        buildStatus: faker.helpers.arrayElement(['success', 'failed', 'pending'])
      },
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  private static generateProjectHTML(title = 'Test Project'): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>${title}</title>
          <meta charset="UTF-8">
        </head>
        <body>
          <header class="header">
            <h1>${title}</h1>
          </header>
          <main class="main-content">
            <section class="hero">
              <h2>Welcome to ${title}</h2>
            </section>
          </main>
        </body>
      </html>
    `;
  }

  private static generateProjectCSS(): string {
    return `
      .header { background: #333; color: white; padding: 1rem; }
      .main-content { padding: 2rem; }
      .hero { text-align: center; }
    `;
  }

  private static generateProjectJS(): string {
    return `
      document.addEventListener('DOMContentLoaded', function() {
        console.log('Project loaded');
      });
    `;
  }

  private static generateImagePaths(): string[] {
    return Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => 
      `/images/${faker.system.fileName({ extensionCount: 0 })}.jpg`
    );
  }

  private static generateAssetPaths(): string[] {
    return Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => 
      `/assets/${faker.system.fileName()}`
    );
  }
}
```

### **User Factory**
```typescript
// tests/fixtures/factories/user.factory.ts
import { faker } from '@faker-js/faker';

export class UserFactory {
  static createUser(overrides = {}) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: faker.helpers.arrayElement(['user', 'admin', 'moderator']),
      isActive: true,
      emailVerified: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  static createUserDto(overrides = {}) {
    return {
      email: faker.internet.email(),
      name: faker.person.fullName(),
      password: 'SecurePass123!',
      ...overrides
    };
  }
}
```

---

## 🧪 **Test Examples**

### **Unit Test Example**
```typescript
// tests/unit/services/ProjectService.test.ts
import { ProjectService } from '../../../src/services/ProjectService';
import { ProjectFactory } from '../../fixtures/factories/project.factory';
import { UnitTestHelpers } from '../../setup/unit.setup';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = UnitTestHelpers.createMockRepository();
    service = new ProjectService(mockRepository);
  });

  describe('createProject', () => {
    it('should create project successfully', async () => {
      // Arrange
      const projectDto = ProjectFactory.createProjectDto();
      const expectedProject = ProjectFactory.createProject();
      mockRepository.save.mockResolvedValue(expectedProject);

      // Act
      const result = await service.createProject(projectDto);

      // Assert
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(projectDto)
      );
      expect(result).toEqual(expectedProject);
    });

    it('should throw error when project name is duplicate', async () => {
      // Arrange
      const projectDto = ProjectFactory.createProjectDto();
      mockRepository.save.mockRejectedValue(new Error('Duplicate name'));

      // Act & Assert
      await expect(service.createProject(projectDto))
        .rejects.toThrow('Duplicate name');
    });
  });

  describe('findById', () => {
    it('should return project when found', async () => {
      // Arrange
      const project = ProjectFactory.createProject();
      mockRepository.findOne.mockResolvedValue(project);

      // Act
      const result = await service.findById(project.id);

      // Assert
      expect(mockRepository.findOne).toHaveBeenCalledWith({ id: project.id });
      expect(result).toEqual(project);
    });

    it('should return null when project not found', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findById('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });
  });
});
```

### **Integration Test Example**
```typescript
// tests/integration/routes/project.routes.test.ts
import request from 'supertest';
import { app } from '../../../src/app';
import { DatabaseService } from '../../../src/infrastructure/database/DatabaseService';
import { ProjectFactory } from '../../fixtures/factories/project.factory';

describe('Project Routes Integration', () => {
  beforeAll(async () => {
    await DatabaseService.connect();
  });

  afterAll(async () => {
    await DatabaseService.disconnect();
  });

  beforeEach(async () => {
    await DatabaseService.clearDatabase();
  });

  describe('POST /api/projects', () => {
    it('should create project with valid data', async () => {
      const projectDto = ProjectFactory.createProjectDto();

      const response = await request(app)
        .post('/api/projects')
        .send(projectDto)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          name: projectDto.name,
          description: projectDto.description
        })
      });
    });

    it('should return 400 for invalid data', async () => {
      const invalidDto = { name: '' }; // Missing required fields

      const response = await request(app)
        .post('/api/projects')
        .send(invalidDto)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed'
      });
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return project when found', async () => {
      // Create a project first
      const project = await DatabaseService.createProject(
        ProjectFactory.createProjectDto()
      );

      const response = await request(app)
        .get(`/api/projects/${project.id}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: project.id,
        name: project.name
      });
    });
  });
});
```

### **E2E Test Example**
```typescript
// tests/e2e/user-journey.test.ts
import { test, expect } from '@playwright/test';

test.describe('Complete User Journey', () => {
  test('should complete project creation flow', async ({ page }) => {
    // Navigate to application
    await page.goto('/');
    
    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Wait for dashboard
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    
    // Create new project
    await page.click('[data-testid="new-project-button"]');
    await page.fill('[data-testid="project-name"]', 'Test Project');
    await page.fill('[data-testid="project-description"]', 'Test Description');
    await page.click('[data-testid="create-project-button"]');
    
    // Verify project created
    await expect(page.locator('[data-testid="project-created-success"]')).toBeVisible();
    await expect(page.locator('text=Test Project')).toBeVisible();
  });

  test('should handle file upload and AI processing', async ({ page }) => {
    await page.goto('/projects/new');
    
    // Upload design file
    await page.setInputFiles('[data-testid="file-upload"]', 'tests/fixtures/test-design.png');
    
    // Start AI pipeline
    await page.click('[data-testid="start-pipeline"]');
    
    // Wait for splitting suggestions
    await expect(page.locator('[data-testid="splitting-suggestions"]')).toBeVisible();
    
    // Confirm suggestions
    await page.click('[data-testid="confirm-suggestions"]');
    
    // Wait for completion
    await expect(page.locator('[data-testid="pipeline-complete"]')).toBeVisible({ timeout: 60000 });
    
    // Verify generated module
    const moduleContent = await page.locator('[data-testid="generated-module"]').textContent();
    expect(moduleContent).toContain('<!DOCTYPE html>');
  });
});
```

---

## 📊 **Test Scripts & Commands**

### **Package.json Scripts (Multi-project)**
```jsonc
{
  "scripts": {
    "test": "jest --config jest.config.js",
    "test:watch": "jest --config jest.config.js --watch",
    "test:coverage": "jest --config jest.config.js --coverage",
    "test:unit": "jest --config jest.config.js --selectProjects UNIT",
    "test:integration": "jest --config jest.config.js --selectProjects INTEGRATION",
    "test:e2e": "jest --config jest.config.js --selectProjects E2E",
    "test:pyramid": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:ci": "jest --config jest.config.js --coverage --watchAll=false --passWithNoTests"
  }
}
```

---

## ✅ **Testing Best Practices**

### **Test Organization**
- **Arrange-Act-Assert Pattern**: Clear test structure
- **Descriptive Test Names**: What is being tested and expected outcome
- **Single Responsibility**: One assertion per test when possible
- **Test Independence**: Tests should not depend on each other

### **Mock Strategy**
- **Unit Tests**: Mock all external dependencies
- **Integration Tests**: Mock external APIs, use real database
- **E2E Tests**: Mock only external services, test full stack

### **Data Management**
- **Use Factories**: Consistent, realistic test data
- **Avoid Hard-coded Values**: Use faker for dynamic data
- **Clean State**: Reset database/mocks between tests

### **Performance**
- **Fast Unit Tests**: <50ms per test
- **Parallel Execution**: Run tests in parallel when possible
- **Selective Testing**: Run only relevant tests during development

---

## 🧱 Additional Test Types

### **Functional Tests (Feature-level)**
- Scope: Validate a vertical slice (UI/API/DB) of a user capability
- Focus: Happy-path + critical edge cases with realistic data
- Patterns:
  - Test via public interfaces: HTTP routes, UI flows
  - Use factories/seed data; avoid over-mocking
  - Verify side effects: DB writes, emitted events, logs

Example structure:
```
tests/functional/
  ├── auth/
  ├── projects/
  └── ai-maintenance/
```

### **Smoke Tests (Readiness/Health)**
- Run post-deploy to validate essentials: app boot, key routes, DB/Redis, websockets
- Keep <1 min, low flakiness
- Include health endpoints: `/healthz`, `/readyz`, `/livez`

### **Build Verification Tests (BVT)**
- Gate merges/releases: minimal suite verifying core system contracts
- Includes:
  - API contract checks (Pact) for critical providers/consumers
  - Auth flow sanity with Clerk (login → protected route)
  - AI path sanity: prompt build → OpenAI call mocked → parse → validate

### **Dead-code & Unused Imports Detection**
- Static analysis to catch unused code paths early
- Tooling suggestions:
  - TypeScript: `tsc --noEmit`, ESLint rules (`no-unused-vars`, `@typescript-eslint/no-unused-vars`)
  - Unused files: `unimported` or `ts-prune` in CI
  - Bundle analysis to flag unreachable modules

Recommended CI stages:
- Lint/Typecheck → Unit → Integration → Contracts → Functional → Build → Smoke (post-deploy)

*This testing strategy provides a comprehensive foundation for building reliable, maintainable test suites. Adapt the patterns to your specific requirements and maintain high test quality standards.*
