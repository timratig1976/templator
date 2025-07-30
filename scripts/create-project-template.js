#!/usr/bin/env node

/**
 * Project Template Generator
 * Creates a new project based on the Enterprise Application Blueprint
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${message}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Enhanced project structure with DDD and monorepo
const projectStructure = {
  // Backend API (NestJS with DDD)
  'apps/api/src/domains/user': ['user.controller.ts', 'user.service.ts', 'user.repository.ts', 'user.entity.ts', 'user.dto.ts', 'user.module.ts'],
  'apps/api/src/domains/project': ['project.controller.ts', 'project.service.ts', 'project.repository.ts', 'project.entity.ts', 'project.dto.ts', 'project.module.ts'],
  'apps/api/src/domains/template': ['template.controller.ts', 'template.service.ts', 'template.repository.ts', 'template.entity.ts', 'template.dto.ts', 'template.module.ts'],
  'apps/api/src/infrastructure/database': ['database.module.ts', 'database.config.ts'],
  'apps/api/src/infrastructure/cache': ['redis.module.ts', 'redis.service.ts'],
  'apps/api/src/infrastructure/monitoring': ['tracing.ts', 'metrics.ts', 'health.service.ts'],
  'apps/api/src/shared/middleware': ['auth.guard.ts', 'validation.pipe.ts', 'logging.interceptor.ts'],
  'apps/api/src/shared/decorators': ['user.decorator.ts', 'roles.decorator.ts'],
  'apps/api/src/shared/filters': ['http-exception.filter.ts'],
  'apps/api/prisma': ['schema.prisma', 'seed.ts'],
  'apps/api/tests/unit': [],
  'apps/api/tests/integration': [],
  'apps/api/tests/e2e': [],
  'apps/api/tests/fixtures': ['user.factory.ts', 'project.factory.ts'],
  'apps/api/tests/contracts': ['user-api.pact.test.ts'],
  
  // Frontend (Next.js 14)
  'apps/web/src/app': ['layout.tsx', 'page.tsx', 'globals.css'],
  'apps/web/src/components/ui': ['button.tsx', 'input.tsx', 'card.tsx'],
  'apps/web/src/features/auth': ['login.tsx', 'register.tsx', 'auth.store.ts'],
  'apps/web/src/features/dashboard': ['dashboard.tsx', 'dashboard.store.ts'],
  'apps/web/src/features/projects': ['project-list.tsx', 'project-form.tsx', 'projects.store.ts'],
  'apps/web/src/lib': ['api.ts', 'auth.ts', 'utils.ts'],
  'apps/web/src/hooks': ['use-auth.ts', 'use-api.ts'],
  'apps/web/src/store': ['index.ts'],
  'apps/web/stories': [],
  'apps/web/tests/components': [],
  'apps/web/tests/e2e': [],
  
  // Shared packages
  'packages/shared-types/src': ['api.ts', 'domain.ts', 'common.ts', 'events.ts'],
  'packages/ui-components/src/components': ['Button.tsx', 'Input.tsx', 'Card.tsx'],
  'packages/api-client/src': ['index.ts'],
  'packages/validation/src': ['user.schema.ts', 'project.schema.ts'],
  'packages/config/eslint': ['base.js', 'react.js', 'node.js'],
  'packages/config/typescript': ['base.json', 'nextjs.json', 'node.json'],
  'packages/config/jest': ['base.js', 'react.js'],
  
  // Tools and scripts
  'tools/scripts': ['build.sh', 'test.sh', 'deploy.sh', 'db-reset.sh'],
  'tools/generators': ['domain-generator.js', 'api-generator.js', 'component-generator.js'],
  'tools/docker': ['Dockerfile.api', 'Dockerfile.web', 'docker-compose.dev.yml'],
  
  // Documentation
  'docs/api': ['README.md'],
  'docs/architecture': ['system-overview.md', 'domain-model.md'],
  'docs/deployment': ['local.md', 'staging.md', 'production.md'],
  'docs/security': ['threat-model.md', 'security-checklist.md'],
  
  // GitHub workflows
  '.github/workflows': ['ci.yml', 'cd.yml', 'security.yml'],
  '.github/ISSUE_TEMPLATE': [],
  '.github/PULL_REQUEST_TEMPLATE': [],
  
  // Git hooks
  '.husky': ['pre-commit', 'pre-push', 'commit-msg']
};

// Template files content
const templateFiles = {
  // Root package.json for monorepo
  'package.json': {
    "name": "PROJECT_NAME",
    "version": "1.0.0",
    "description": "Modern application built with Enhanced Enterprise Blueprint",
    "private": true,
    "workspaces": ["apps/*", "packages/*"],
    "packageManager": "pnpm@8.0.0",
    "scripts": {
      "dev": "pnpm --parallel dev",
      "build": "pnpm --recursive build",
      "test": "pnpm --recursive test",
      "test:unit": "pnpm --recursive test:unit",
      "test:integration": "pnpm --recursive test:integration",
      "test:e2e": "pnpm --recursive test:e2e",
      "test:contracts": "pnpm --recursive test:contracts",
      "lint": "pnpm --recursive lint",
      "lint:fix": "pnpm --recursive lint:fix",
      "type-check": "pnpm --recursive type-check",
      "build-test": "pnpm --recursive build-test",
      "security:audit": "pnpm audit && pnpm --recursive security:scan",
      "generate:api-client": "openapi-generator-cli generate -i apps/api/docs/openapi.yaml -g typescript-fetch -o packages/api-client/src",
      "generate:domain": "node tools/generators/domain-generator.js",
      "generate:component": "node tools/generators/component-generator.js",
      "db:migrate": "cd apps/api && prisma migrate dev",
      "db:seed": "cd apps/api && prisma db seed",
      "db:reset": "cd apps/api && prisma migrate reset",
      "deploy:staging": "tools/scripts/deploy.sh staging",
      "deploy:production": "tools/scripts/deploy.sh production",
      "prepare": "husky install"
    },
    "dependencies": {
      "express": "^4.18.2",
      "helmet": "^7.1.0",
      "cors": "^2.8.5",
      "express-rate-limit": "^6.7.0",
      "joi": "^17.11.0",
      "jsonwebtoken": "^9.0.0",
      "bcrypt": "^5.1.0",
      "winston": "^3.8.2",
      "dotenv": "^16.0.3"
    },
    "devDependencies": {
      "@types/node": "^18.15.0",
      "@types/express": "^4.17.17",
      "@types/jest": "^29.5.0",
      "typescript": "^5.0.0",
      "jest": "^29.5.0",
      "ts-jest": "^29.1.0",
      "nodemon": "^2.0.22",
      "eslint": "^8.38.0",
      "@typescript-eslint/eslint-plugin": "^5.57.0",
      "supertest": "^6.3.3"
    }
  },

  'tsconfig.json': {
    "compilerOptions": {
      "target": "ES2020",
      "module": "commonjs",
      "lib": ["ES2020"],
      "outDir": "./dist",
      "rootDir": "./src",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "tests"]
  },

  'jest.config.js': `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/**/*.test.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000
};`,

  '.env.example': `# Application
NODE_ENV=development
PORT=3000
APP_VERSION=1.0.0

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/database

# Security
JWT_SECRET=your-super-secret-jwt-key
BCRYPT_ROUNDS=12

# External Services
OPENAI_API_KEY=your-openai-api-key

# Monitoring
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001`,

  'README.md': `# PROJECT_NAME

A robust, scalable application built with the Enterprise Application Blueprint.

## Features

- 🏗️ **Flow-Driven Architecture** with pipeline controllers
- 🧪 **Comprehensive Testing** with Jest
- 🔒 **Security First** with built-in middleware
- 🔧 **Automated Build Testing** for quality assurance
- 📊 **Monitoring & Logging** with Winston
- 🚀 **Production Ready** with Docker support

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run build tests
npm run build-test
\`\`\`

## Documentation

- [API Documentation](docs/API.md)
- [Architecture Guide](docs/ARCHITECTURE.md)
- [Security Guidelines](docs/SECURITY.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## Development

\`\`\`bash
# Development with auto-reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Testing with coverage
npm run test:coverage

# Build testing with watch
npm run build-test:watch
\`\`\`

Built with ❤️ using the Enterprise Application Blueprint.`
};

async function createProject(projectName, targetPath) {
  logHeader(`Creating Project: ${projectName}`);
  
  const projectPath = path.join(targetPath, projectName);
  
  try {
    // Create project directory
    if (fs.existsSync(projectPath)) {
      logError(`Directory ${projectName} already exists!`);
      process.exit(1);
    }
    
    fs.mkdirSync(projectPath, { recursive: true });
    logSuccess(`Created project directory: ${projectPath}`);
    
    // Create folder structure
    logInfo('Creating folder structure...');
    for (const [folderPath, files] of Object.entries(projectStructure)) {
      const fullPath = path.join(projectPath, folderPath);
      fs.mkdirSync(fullPath, { recursive: true });
      
      // Create placeholder files
      for (const file of files) {
        const filePath = path.join(fullPath, file);
        fs.writeFileSync(filePath, `// ${file}\n// TODO: Implement\n`);
      }
    }
    logSuccess('Folder structure created');
    
    // Create template files
    logInfo('Creating template files...');
    
    // Backend package.json
    const backendPackageJson = { ...templateFiles['package.json'] };
    backendPackageJson.name = `${projectName}-backend`;
    fs.writeFileSync(
      path.join(projectPath, 'backend', 'package.json'),
      JSON.stringify(backendPackageJson, null, 2)
    );
    
    // Backend tsconfig.json
    fs.writeFileSync(
      path.join(projectPath, 'backend', 'tsconfig.json'),
      JSON.stringify(templateFiles['tsconfig.json'], null, 2)
    );
    
    // Backend jest.config.js
    fs.writeFileSync(
      path.join(projectPath, 'backend', 'jest.config.js'),
      templateFiles['jest.config.js']
    );
    
    // Environment file
    fs.writeFileSync(
      path.join(projectPath, 'backend', '.env.example'),
      templateFiles['.env.example']
    );
    
    // Main README
    const readmeContent = templateFiles['README.md'].replace(/PROJECT_NAME/g, projectName);
    fs.writeFileSync(
      path.join(projectPath, 'README.md'),
      readmeContent
    );
    
    logSuccess('Template files created');
    
    // Create essential source files
    await createEssentialFiles(projectPath, projectName);
    
    // Create Docker files
    await createDockerFiles(projectPath, projectName);
    
    // Create GitHub workflows
    await createGitHubWorkflows(projectPath);
    
    logSuccess('Project template created successfully!');
    
    // Display next steps
    displayNextSteps(projectName, projectPath);
    
  } catch (error) {
    logError(`Failed to create project: ${error.message}`);
    process.exit(1);
  }
}

async function createEssentialFiles(projectPath, projectName) {
  logInfo('Creating essential source files...');
  
  // Server entry point
  const serverContent = `import app from './app';
import { createLogger } from './utils/logger';

const logger = createLogger('server');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(\`🚀 Server running on port \${PORT}\`);
  logger.info(\`📚 API docs available at http://localhost:\${PORT}/api/docs\`);
  logger.info(\`🏥 Health check at http://localhost:\${PORT}/health\`);
});`;

  fs.writeFileSync(
    path.join(projectPath, 'backend', 'src', 'server.ts'),
    serverContent
  );
  
  // App configuration
  const appContent = `import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createLogger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import apiRoutes from './routes/api';
import healthRoutes from './routes/health';

const app = express();
const logger = createLogger('app');

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRoutes);
app.use('/api', apiRoutes);

// Error handling
app.use(errorHandler);

export default app;`;

  fs.writeFileSync(
    path.join(projectPath, 'backend', 'src', 'app.ts'),
    appContent
  );
  
  logSuccess('Essential source files created');
}

async function createDockerFiles(projectPath, projectName) {
  logInfo('Creating Docker configuration...');
  
  const dockerfileContent = `FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]`;

  fs.writeFileSync(
    path.join(projectPath, 'backend', 'Dockerfile'),
    dockerfileContent
  );
  
  const dockerComposeContent = `version: '3.8'

services:
  app:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@db:5432/${projectName}
    depends_on:
      - db
    volumes:
      - ./backend:/app
      - /app/node_modules

  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=${projectName}
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:`;

  fs.writeFileSync(
    path.join(projectPath, 'docker-compose.yml'),
    dockerComposeContent
  );
  
  logSuccess('Docker configuration created');
}

async function createGitHubWorkflows(projectPath) {
  logInfo('Creating GitHub workflows...');
  
  const ciWorkflow = `name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: backend/package-lock.json
    
    - name: Install dependencies
      run: cd backend && npm ci
    
    - name: Run linting
      run: cd backend && npm run lint
    
    - name: Run type checking
      run: cd backend && npm run type-check
    
    - name: Run build tests
      run: cd backend && npm run build-test
    
    - name: Run tests
      run: cd backend && npm run test:coverage
    
    - name: Security audit
      run: cd backend && npm audit --audit-level moderate`;

  fs.writeFileSync(
    path.join(projectPath, '.github', 'workflows', 'ci.yml'),
    ciWorkflow
  );
  
  logSuccess('GitHub workflows created');
}

function displayNextSteps(projectName, projectPath) {
  logHeader('Next Steps');
  
  log('1. Navigate to your project:', 'cyan');
  log(`   cd ${projectName}`, 'yellow');
  
  log('\n2. Install dependencies:', 'cyan');
  log('   cd backend && npm install', 'yellow');
  
  log('\n3. Set up environment:', 'cyan');
  log('   cp backend/.env.example backend/.env', 'yellow');
  log('   # Edit .env with your configuration', 'yellow');
  
  log('\n4. Start development:', 'cyan');
  log('   npm run dev', 'yellow');
  
  log('\n5. Run tests:', 'cyan');
  log('   npm test', 'yellow');
  log('   npm run build-test', 'yellow');
  
  log('\n6. Available commands:', 'cyan');
  log('   npm run dev          # Start development server', 'yellow');
  log('   npm run build        # Build for production', 'yellow');
  log('   npm run test:watch   # Run tests in watch mode', 'yellow');
  log('   npm run lint         # Run linting', 'yellow');
  log('   npm run build-test   # Run build tests', 'yellow');
  
  log('\n📚 Documentation:', 'cyan');
  log(`   ${projectPath}/README.md`, 'yellow');
  log(`   ${projectPath}/docs/`, 'yellow');
  
  log('\n🎉 Your robust application is ready for development!', 'green');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    log('\n🏗️  Enterprise Application Template Generator', 'bright');
    log('\nUsage: node create-project-template.js <project-name> [target-directory]', 'cyan');
    log('\nExamples:', 'yellow');
    log('  node create-project-template.js my-awesome-app');
    log('  node create-project-template.js my-api ~/projects');
    log('\nThis will create a complete project structure based on the Enterprise Blueprint.');
    return;
  }
  
  const projectName = args[0];
  const targetPath = args[1] || process.cwd();
  
  if (!projectName.match(/^[a-z0-9-]+$/)) {
    logError('Project name must contain only lowercase letters, numbers, and hyphens');
    process.exit(1);
  }
  
  await createProject(projectName, targetPath);
}

main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});
