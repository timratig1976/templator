# 🔧 DevOps & Deployment Blueprint
## CI/CD, Infrastructure & Development Setup

*Comprehensive DevOps implementation covering Docker containerization, GitHub Actions CI/CD, infrastructure as code, and development environment setup. Production-ready deployment patterns for scalable applications.*

---

## 🎯 **DevOps Principles**

### **Core Components**
- **Containerization**: Docker for consistent environments across all stages
- **CI/CD Pipelines**: Automated testing, building, and deployment
- **Infrastructure as Code**: Terraform for reproducible infrastructure
- **Environment Management**: Development, staging, and production consistency
- **Monitoring & Observability**: Comprehensive application and infrastructure monitoring

### **Quality Standards**
- **Zero-Downtime Deployments**: Blue-green and rolling deployment strategies
- **Automated Testing**: 100% pipeline test coverage before deployment
- **Security Scanning**: Vulnerability scanning in CI/CD pipeline
- **Performance Monitoring**: Real-time application and infrastructure metrics
- **Disaster Recovery**: Automated backups and recovery procedures

---

## 🐳 **Docker Containerization**

### **Backend Dockerfile**
```dockerfile
# backend/Dockerfile
FROM node:18-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npm cache clean --force

FROM base AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=3000
USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

### **Frontend Dockerfile**
```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### **Docker Compose Development**
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: templator
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/templator
      REDIS_URL: redis://redis:6379
      JWT_SECRET: your-jwt-secret-key-here
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    ports:
      - "3001:3000"
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
      NEXT_PUBLIC_WS_URL: ws://localhost:3001
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

---

## 🚀 **GitHub Actions CI/CD**

### **Main CI/CD Pipeline**
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          cd backend && npm ci
          cd ../frontend && npm ci

      - name: Run linting
        run: |
          npm run lint
          cd backend && npm run lint
          cd ../frontend && npm run lint

      - name: Setup test database
        run: |
          cd backend
          npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db

      - name: Run tests
        run: |
          cd backend && npm run test:coverage
          cd ../frontend && npm run test:coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          JWT_SECRET: test-secret
          NODE_ENV: test

  security:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  build:
    runs-on: ubuntu-latest
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    
    strategy:
      matrix:
        component: [backend, frontend]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./${{ matrix.component }}
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-${{ matrix.component }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - name: Deploy to production
        run: |
          echo "Deploying to production environment"
          # Add deployment commands here
```

---

## 🏗️ **Infrastructure as Code**

### **Terraform Main Configuration**
```hcl
# infrastructure/terraform/main.tf
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "${var.project_name}-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  
  enable_nat_gateway = true
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier = "${var.project_name}-postgres"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class
  
  allocated_storage = 20
  storage_encrypted = true
  
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 7
  skip_final_snapshot     = false
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
```

---

## ⚙️ **Development Setup**

### **Setup Script**
```bash
#!/bin/bash
# scripts/setup-dev.sh

set -e

echo "🚀 Setting up Templator development environment..."

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed"
        exit 1
    fi
    
    echo "✅ Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    npm install
    cd backend && npm install && cd ..
    cd frontend && npm install && cd ..
    
    echo "✅ Dependencies installed"
}

# Setup environment
setup_environment() {
    echo "⚙️ Setting up environment files..."
    
    if [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        echo "📝 Created backend/.env"
    fi
    
    if [ ! -f frontend/.env.local ]; then
        cp frontend/.env.local.example frontend/.env.local
        echo "📝 Created frontend/.env.local"
    fi
    
    echo "✅ Environment setup complete"
}

# Setup database
setup_database() {
    echo "🗄️ Setting up database..."
    
    docker-compose up -d postgres redis
    sleep 10
    
    cd backend
    npx prisma migrate dev
    npx prisma db seed
    cd ..
    
    echo "✅ Database setup complete"
}

# Main setup
main() {
    check_prerequisites
    install_dependencies
    setup_environment
    setup_database
    
    echo ""
    echo "🎉 Setup complete!"
    echo "Run 'npm run dev' to start development"
}

main "$@"
```

### **Package.json Scripts**
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "build": "npm run build:backend && npm run build:frontend",
    "build:backend": "cd backend && npm run build",
    "build:frontend": "cd frontend && npm run build",
    "test": "npm run test:backend && npm run test:frontend",
    "test:backend": "cd backend && npm run test",
    "test:frontend": "cd frontend && npm run test",
    "lint": "npm run lint:backend && npm run lint:frontend",
    "lint:backend": "cd backend && npm run lint",
    "lint:frontend": "cd frontend && npm run lint",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "db:migrate": "cd backend && npx prisma migrate dev",
    "db:seed": "cd backend && npx prisma db seed",
    "setup": "./scripts/setup-dev.sh"
  }
}
```

---

## 📋 **DevOps Checklist**

### **Containerization**
- [ ] Multi-stage Dockerfiles for all services
- [ ] Docker Compose for development and production
- [ ] Health checks for all containers
- [ ] Container security scanning

### **CI/CD Pipeline**
- [ ] Automated testing in GitHub Actions
- [ ] Security scanning (Snyk, Trivy)
- [ ] Docker image building and pushing
- [ ] Automated deployment to staging/production

### **Infrastructure**
- [ ] Terraform configurations for cloud resources
- [ ] Environment-specific variable management
- [ ] Database backup and recovery procedures
- [ ] Monitoring and alerting setup

### **Development Environment**
- [ ] Automated development setup script
- [ ] VS Code workspace configuration
- [ ] Git hooks for code quality
- [ ] Documentation for onboarding

---

*This DevOps blueprint provides comprehensive automation and infrastructure patterns for building, testing, and deploying production-ready applications with confidence and reliability.*
