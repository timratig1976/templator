# 📁 Project Structure Blueprint
## Scalable Monorepo Architecture with Domain-Driven Design

*Comprehensive project organization guide based on proven enterprise patterns. Includes complete folder structure, naming conventions, and architectural decisions for maintainable codebases.*

---

## 🎯 **Architecture Philosophy**

### **Monorepo Benefits**
- **Unified Codebase**: Single repository for all related projects
- **Shared Dependencies**: Common libraries and configurations
- **Atomic Changes**: Cross-project changes in single commits
- **Simplified CI/CD**: Unified build and deployment pipelines
- **Code Reusability**: Shared components and utilities

### **Domain-Driven Organization**
- **Business Alignment**: Structure reflects business domains
- **Clear Boundaries**: Explicit separation between domains
- **Independent Evolution**: Domains can evolve separately
- **Team Ownership**: Teams can own specific domains
- **Scalable Growth**: Easy to add new domains

---

## 🏗️ **Complete Project Structure**

```
project-root/
├── 📁 .github/                     # GitHub workflows and templates
│   ├── workflows/
│   │   ├── ci.yml                  # Continuous integration
│   │   ├── cd.yml                  # Continuous deployment
│   │   ├── security-scan.yml       # Security scanning
│   │   └── dependency-update.yml   # Automated dependency updates
│   ├── ISSUE_TEMPLATE/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
├── 📁 .vscode/                     # VS Code configuration
│   ├── settings.json               # Workspace settings
│   ├── extensions.json             # Recommended extensions
│   ├── launch.json                 # Debug configurations
│   └── tasks.json                  # Build tasks
├── 📁 docs/                        # Documentation
│   ├── 📁 blueprints/              # Architecture blueprints
│   │   ├── README.md               # Blueprint index
│   │   ├── 01-project-structure.md # This file
│   │   ├── 02-domain-driven-design.md
│   │   ├── 03-database-architecture.md
│   │   ├── 04-testing-strategy.md
│   │   ├── 05-security-implementation.md
│   │   ├── 06-monitoring-observability.md
│   │   ├── 07-ai-pipeline.md
│   │   ├── 08-realtime-communication.md
│   │   ├── 09-deployment-strategy.md
│   │   ├── 10-development-setup.md
│   │   ├── 11-package-management.md
│   │   └── 12-build-cicd.md
│   ├── 📁 api/                     # API documentation
│   │   ├── openapi.yml             # OpenAPI specification
│   │   ├── endpoints.md            # Endpoint documentation
│   │   └── authentication.md      # Auth documentation
│   ├── 📁 architecture/            # Architecture diagrams
│   │   ├── system-overview.md
│   │   ├── data-flow.md
│   │   └── deployment-diagram.md
│   ├── 📁 guides/                  # Development guides
│   │   ├── getting-started.md
│   │   ├── contributing.md
│   │   ├── deployment.md
│   │   └── troubleshooting.md
│   └── README.md                   # Main documentation
├── 📁 packages/                    # Shared packages (monorepo)
│   ├── 📁 shared/                  # Shared utilities
│   │   ├── 📁 types/               # TypeScript type definitions
│   │   ├── 📁 utils/               # Utility functions
│   │   ├── 📁 constants/           # Application constants
│   │   ├── 📁 validators/          # Validation schemas
│   │   ├── 📁 errors/              # Custom error classes
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── 📁 ui-components/           # Shared UI components
│   │   ├── 📁 src/
│   │   │   ├── 📁 components/
│   │   │   ├── 📁 hooks/
│   │   │   ├── 📁 styles/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── 📁 api-client/              # API client library
│       ├── 📁 src/
│       │   ├── 📁 clients/
│       │   ├── 📁 types/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── 📁 backend/                     # Backend application
│   ├── 📁 src/
│   │   ├── 📁 domains/             # Domain-driven modules
│   │   │   ├── 📁 user/            # User management domain
│   │   │   │   ├── user.controller.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   ├── user.repository.ts
│   │   │   │   ├── user.entity.ts
│   │   │   │   ├── user.dto.ts
│   │   │   │   ├── user.types.ts
│   │   │   │   ├── user.validators.ts
│   │   │   │   ├── user.events.ts
│   │   │   │   └── user.module.ts
│   │   │   ├── 📁 project/         # Project management domain
│   │   │   ├── 📁 template/        # Template management domain
│   │   │   ├── 📁 ai/              # AI processing domain
│   │   │   └── 📁 analytics/       # Analytics domain
│   │   ├── 📁 infrastructure/      # Infrastructure layer
│   │   │   ├── 📁 database/        # Database configuration
│   │   │   │   ├── 📁 migrations/
│   │   │   │   ├── 📁 seeds/
│   │   │   │   ├── database.module.ts
│   │   │   │   └── database.service.ts
│   │   │   ├── 📁 cache/           # Cache configuration
│   │   │   │   ├── cache.module.ts
│   │   │   │   └── redis.service.ts
│   │   │   ├── 📁 storage/         # File storage
│   │   │   │   ├── storage.module.ts
│   │   │   │   ├── local.service.ts
│   │   │   │   └── s3.service.ts
│   │   │   ├── 📁 messaging/       # Message queues
│   │   │   │   ├── messaging.module.ts
│   │   │   │   └── queue.service.ts
│   │   │   └── 📁 external/        # External API integrations
│   │   │       ├── openai.service.ts
│   │   │       ├── stripe.service.ts
│   │   │       └── email.service.ts
│   │   ├── 📁 application/         # Application layer
│   │   │   ├── 📁 usecases/        # Use case implementations
│   │   │   ├── 📁 services/        # Application services
│   │   │   ├── 📁 events/          # Event handlers
│   │   │   └── 📁 queries/         # Query handlers
│   │   ├── 📁 presentation/        # Presentation layer
│   │   │   ├── 📁 controllers/     # HTTP controllers
│   │   │   ├── 📁 middleware/      # Express middleware
│   │   │   ├── 📁 routes/          # Route definitions
│   │   │   ├── 📁 websockets/      # WebSocket handlers
│   │   │   └── 📁 graphql/         # GraphQL resolvers
│   │   ├── 📁 shared/              # Shared backend code
│   │   │   ├── 📁 decorators/      # Custom decorators
│   │   │   ├── 📁 filters/         # Exception filters
│   │   │   ├── 📁 guards/          # Authentication guards
│   │   │   ├── 📁 interceptors/    # Request interceptors
│   │   │   ├── 📁 pipes/           # Validation pipes
│   │   │   └── 📁 utils/           # Utility functions
│   │   ├── 📁 config/              # Configuration
│   │   │   ├── app.config.ts
│   │   │   ├── database.config.ts
│   │   │   ├── auth.config.ts
│   │   │   └── environment.ts
│   │   └── main.ts                 # Application entry point
│   ├── 📁 tests/                   # Test files
│   │   ├── 📁 unit/                # Unit tests
│   │   ├── 📁 integration/         # Integration tests
│   │   ├── 📁 e2e/                 # End-to-end tests
│   │   ├── 📁 fixtures/            # Test data
│   │   ├── 📁 mocks/               # Mock implementations
│   │   └── 📁 setup/               # Test setup files
│   ├── 📁 prisma/                  # Database schema
│   │   ├── schema.prisma
│   │   ├── 📁 migrations/
│   │   └── 📁 seeds/
│   ├── 📁 scripts/                 # Utility scripts
│   │   ├── build.sh
│   │   ├── deploy.sh
│   │   └── migrate.sh
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   ├── .env.example
│   └── Dockerfile
├── 📁 frontend/                    # Frontend application
│   ├── 📁 src/
│   │   ├── 📁 app/                 # Next.js app directory
│   │   │   ├── 📁 (auth)/          # Auth route group
│   │   │   ├── 📁 (dashboard)/     # Dashboard route group
│   │   │   ├── 📁 api/             # API routes
│   │   │   ├── layout.tsx          # Root layout
│   │   │   ├── page.tsx            # Home page
│   │   │   ├── loading.tsx         # Loading UI
│   │   │   ├── error.tsx           # Error UI
│   │   │   └── not-found.tsx       # 404 page
│   │   ├── 📁 components/          # React components
│   │   │   ├── 📁 ui/              # Base UI components
│   │   │   ├── 📁 forms/           # Form components
│   │   │   ├── 📁 layout/          # Layout components
│   │   │   ├── 📁 features/        # Feature-specific components
│   │   │   └── 📁 providers/       # Context providers
│   │   ├── 📁 hooks/               # Custom React hooks
│   │   │   ├── 📁 api/             # API hooks
│   │   │   ├── 📁 auth/            # Authentication hooks
│   │   │   └── 📁 utils/           # Utility hooks
│   │   ├── 📁 lib/                 # Utility libraries
│   │   │   ├── 📁 api/             # API client
│   │   │   ├── 📁 auth/            # Authentication
│   │   │   ├── 📁 utils/           # Utility functions
│   │   │   ├── 📁 validations/     # Form validations
│   │   │   └── 📁 constants/       # Constants
│   │   ├── 📁 stores/              # State management
│   │   │   ├── 📁 slices/          # Zustand slices
│   │   │   ├── 📁 providers/       # Store providers
│   │   │   └── index.ts            # Store configuration
│   │   ├── 📁 styles/              # Styling
│   │   │   ├── globals.css         # Global styles
│   │   │   ├── components.css      # Component styles
│   │   │   └── tailwind.css        # Tailwind imports
│   │   ├── 📁 types/               # TypeScript types
│   │   │   ├── api.ts              # API types
│   │   │   ├── auth.ts             # Auth types
│   │   │   └── global.ts           # Global types
│   │   └── 📁 utils/               # Utility functions
│   │       ├── api.ts              # API utilities
│   │       ├── auth.ts             # Auth utilities
│   │       ├── format.ts           # Formatting utilities
│   │       └── validation.ts       # Validation utilities
│   ├── 📁 public/                  # Static assets
│   │   ├── 📁 images/
│   │   ├── 📁 icons/
│   │   ├── favicon.ico
│   │   └── manifest.json
│   ├── 📁 tests/                   # Frontend tests
│   │   ├── 📁 __mocks__/           # Jest mocks
│   │   ├── 📁 components/          # Component tests
│   │   ├── 📁 hooks/               # Hook tests
│   │   ├── 📁 pages/               # Page tests
│   │   ├── 📁 utils/               # Utility tests
│   │   └── setup.ts                # Test setup
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── next.config.js
│   ├── jest.config.js
│   ├── playwright.config.ts
│   └── .env.local.example
├── 📁 mobile/                      # Mobile application (optional)
│   ├── 📁 src/
│   ├── 📁 android/
│   ├── 📁 ios/
│   ├── package.json
│   └── metro.config.js
├── 📁 infrastructure/              # Infrastructure as code
│   ├── 📁 docker/                  # Docker configurations
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.prod.yml
│   │   ├── Dockerfile.backend
│   │   └── Dockerfile.frontend
│   ├── 📁 kubernetes/              # Kubernetes manifests
│   │   ├── 📁 base/
│   │   ├── 📁 overlays/
│   │   └── kustomization.yaml
│   ├── 📁 terraform/               # Terraform configurations
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── 📁 scripts/                 # Infrastructure scripts
│       ├── setup.sh
│       ├── deploy.sh
│       └── backup.sh
├── 📁 tools/                       # Development tools
│   ├── 📁 generators/              # Code generators
│   ├── 📁 linters/                 # Custom linting rules
│   ├── 📁 scripts/                 # Build scripts
│   └── 📁 configs/                 # Shared configurations
├── 📁 .husky/                      # Git hooks
│   ├── pre-commit
│   ├── pre-push
│   └── commit-msg
├── package.json                    # Root package.json
├── package-lock.json
├── tsconfig.json                   # Root TypeScript config
├── .gitignore
├── .gitattributes
├── .nvmrc                          # Node version
├── .eslintrc.js                    # ESLint configuration
├── .prettierrc                     # Prettier configuration
├── .editorconfig                   # Editor configuration
├── LICENSE
└── README.md                       # Project overview
```

---

## 📋 **Naming Conventions**

### **File Naming**
```typescript
// Controllers (PascalCase + .controller.ts)
UserController.ts
ProjectController.ts
TemplateController.ts

// Services (PascalCase + .service.ts)
UserService.ts
EmailService.ts
PaymentService.ts

// Entities (PascalCase + .entity.ts)
User.entity.ts
Project.entity.ts
Template.entity.ts

// DTOs (PascalCase + .dto.ts)
CreateUserDto.ts
UpdateProjectDto.ts
TemplateResponseDto.ts

// Types (PascalCase + .types.ts)
User.types.ts
Project.types.ts
Api.types.ts

// Tests (PascalCase + .test.ts or .spec.ts)
UserService.test.ts
ProjectController.spec.ts
UserRepository.integration.test.ts

// React Components (PascalCase + .tsx)
UserProfile.tsx
ProjectCard.tsx
TemplateEditor.tsx

// Hooks (camelCase + .ts)
useAuth.ts
useProject.ts
useLocalStorage.ts

// Utilities (camelCase + .ts)
apiClient.ts
formatters.ts
validators.ts
```

### **Directory Naming**
```
📁 kebab-case/          # For multi-word directories
📁 camelCase/           # For single concept directories
📁 PascalCase/          # For component directories
```

### **Variable & Function Naming**
```typescript
// Variables (camelCase)
const userName = 'john';
const projectSettings = {};
const apiResponse = {};

// Functions (camelCase)
function getUserById() {}
function createProject() {}
function validateEmail() {}

// Classes (PascalCase)
class UserService {}
class ProjectRepository {}
class EmailValidator {}

// Constants (SCREAMING_SNAKE_CASE)
const API_BASE_URL = 'https://api.example.com';
const MAX_FILE_SIZE = 1024 * 1024;
const DEFAULT_TIMEOUT = 5000;

// Enums (PascalCase)
enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest'
}

// Interfaces (PascalCase with 'I' prefix optional)
interface User {}
interface IUserRepository {}
interface ProjectSettings {}
```

---

## 🔧 **Configuration Files**

### **Root Package.json**
```json
{
  "name": "templator-monorepo",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "backend",
    "frontend",
    "mobile"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend",
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "test:unit": "npm run test:unit --workspaces",
    "test:integration": "npm run test:integration --workspaces",
    "test:e2e": "npm run test:e2e --workspaces",
    "lint": "npm run lint --workspaces",
    "lint:fix": "npm run lint:fix --workspaces",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "prepare": "husky install",
    "clean": "npm run clean --workspaces && rm -rf node_modules",
    "reset": "npm run clean && npm install"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "concurrently": "^8.0.0",
    "eslint": "^8.0.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-prettier": "^5.0.0",
    "husky": "^8.0.0",
    "lint-staged": "^14.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.0.0"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

### **Root TypeScript Config**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["packages/shared/src/*"],
      "@ui/*": ["packages/ui-components/src/*"],
      "@api/*": ["packages/api-client/src/*"]
    },
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": [
    "packages/*/src/**/*",
    "backend/src/**/*",
    "frontend/src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build",
    "**/*.test.ts",
    "**/*.spec.ts"
  ],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/ui-components" },
    { "path": "./packages/api-client" },
    { "path": "./backend" },
    { "path": "./frontend" }
  ]
}
```

### **ESLint Configuration**
```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    'prefer-const': 'error',
    'no-var': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      env: {
        jest: true
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ]
};
```

---

## 📁 **Domain Organization Principles**

### **Domain Boundaries**
```typescript
// Clear domain interfaces
export interface UserDomain {
  controllers: UserController;
  services: UserService;
  repositories: UserRepository;
  entities: User;
  events: UserEvents;
}

// Domain module exports
export * from './user.controller';
export * from './user.service';
export * from './user.repository';
export * from './user.entity';
export * from './user.types';
export * from './user.dto';
```

### **Cross-Domain Communication**
```typescript
// Domain events for loose coupling
export class ProjectCreatedEvent {
  constructor(
    public readonly projectId: string,
    public readonly ownerId: string
  ) {}
}

// Event handlers in other domains
export class UserEventHandlers {
  async handleProjectCreated(event: ProjectCreatedEvent) {
    // Update user project count
    // Send notification
    // Update analytics
  }
}
```

### **Shared Kernel**
```typescript
// packages/shared/src/types/common.ts
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: PaginationMeta;
}
```

---

## 🔧 **Development Workflow**

### **Branch Structure**
```
main                    # Production branch
├── develop            # Development branch
├── feature/           # Feature branches
│   ├── feature/user-auth
│   ├── feature/project-templates
│   └── feature/ai-pipeline
├── hotfix/            # Hotfix branches
│   └── hotfix/security-patch
└── release/           # Release branches
    └── release/v1.2.0
```

### **Commit Convention**
```
type(scope): description

feat(user): add user authentication
fix(api): resolve CORS issue
docs(readme): update installation guide
style(ui): improve button styling
refactor(auth): simplify token validation
test(user): add unit tests for user service
chore(deps): update dependencies
```

### **Code Review Process**
1. **Feature Development**: Create feature branch from develop
2. **Pull Request**: Submit PR with description and tests
3. **Code Review**: Team review with approval required
4. **CI/CD Checks**: Automated testing and linting
5. **Merge**: Squash and merge to develop
6. **Release**: Merge develop to main for production

---

## 📋 **Project Structure Checklist**

### **Initial Setup**
- [ ] Create monorepo structure with workspaces
- [ ] Configure TypeScript with path mapping
- [ ] Set up ESLint and Prettier
- [ ] Configure Git hooks with Husky
- [ ] Create package.json scripts for common tasks

### **Domain Organization**
- [ ] Define domain boundaries
- [ ] Create domain modules with clear interfaces
- [ ] Implement cross-domain communication
- [ ] Set up shared packages
- [ ] Define naming conventions

### **Development Environment**
- [ ] Configure VS Code workspace
- [ ] Set up debugging configurations
- [ ] Create development scripts
- [ ] Configure environment variables
- [ ] Set up database and external services

### **Documentation**
- [ ] Create comprehensive README
- [ ] Document API endpoints
- [ ] Create architecture diagrams
- [ ] Write development guides
- [ ] Maintain changelog

---

*This project structure blueprint provides a solid foundation for scalable, maintainable applications. The organization supports team collaboration, code reusability, and long-term growth while maintaining clear separation of concerns.*

---

## 🧪 Tests Folder Blueprint (Reusable Runner)

Keep test harnesses portable across projects by colocating runner code and lightweight shared utilities entirely under `tests/`.

### Suggested structure
```
tests/
  shared/
    BaseService.ts          # Minimal lifecycle + events + handleError()
    ErrorSystem.ts          # Lightweight AppError/ErrorHandler
    logger.ts               # Simple console-based logger
  backend/
    runner/
      TestRunnerCLI.ts
      TestRunnerServer.ts
      TestReportGenerator.ts
      TestSuiteManager.ts
```

### Import pattern
```ts
// Example in tests/backend/runner/TestReportGenerator.ts
import { BaseService, FileOperationMixin } from '../../shared/BaseService';
import { createLogger } from '../../shared/logger';
```

### Optional path alias
Add a root alias to simplify imports from tests:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@tests/*": ["tests/*"]
    }
  }
}
```

This decouples tests from app internals and makes the runner copy-pastable into other repositories.
