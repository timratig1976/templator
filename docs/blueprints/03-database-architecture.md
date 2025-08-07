# 🗄️ Database Architecture Blueprint
## PostgreSQL + Prisma Implementation for Scalable Applications

*Comprehensive database architecture guide based on proven patterns from production systems. Includes complete schema design, performance optimization, and migration strategies.*

---

## 🎯 **Database Design Principles**

### **Core Architecture**
- **PostgreSQL 15**: Primary database with advanced features
- **Prisma ORM**: Type-safe database access with migrations
- **Redis**: Caching layer for performance optimization
- **Connection Pooling**: Efficient database connection management
- **Data Sovereignty**: Complete control over data location and access

### **Design Standards**
- **ACID Compliance**: Reliable transactions and data integrity
- **Normalized Schema**: Efficient data storage and relationships
- **Performance Optimization**: Proper indexing and query optimization
- **Scalability**: Horizontal and vertical scaling capabilities
- **Security**: Data encryption and access controls

---

## 📊 **Complete Database Schema**

### **Core Prisma Schema**
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// User Management
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      UserRole @default(USER)
  
  // Authentication
  passwordHash String
  emailVerified Boolean @default(false)
  isActive     Boolean @default(true)
  
  // Profile information
  avatar       String?
  bio          String?
  timezone     String?
  language     String @default("en")
  
  // Security
  lastLoginAt    DateTime?
  loginAttempts  Int      @default(0)
  lockedUntil    DateTime?
  
  // Relationships
  projects       Project[]
  sessions       AISession[]
  apiKeys        ApiKey[]
  notifications  Notification[]
  
  // Audit fields
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("users")
  @@index([email])
  @@index([role])
  @@index([isActive])
}

enum UserRole {
  USER
  ADMIN
  DEVELOPER
  MODERATOR
}

// API Key Management
model ApiKey {
  id          String   @id @default(cuid())
  userId      String
  name        String
  keyHash     String   @unique
  permissions Json     // Array of permissions
  
  // Usage tracking
  lastUsedAt  DateTime?
  usageCount  Int       @default(0)
  rateLimit   Int       @default(1000) // requests per hour
  
  // Status
  isActive    Boolean   @default(true)
  expiresAt   DateTime?
  
  // Relationships
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Audit fields
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  @@map("api_keys")
  @@index([userId])
  @@index([keyHash])
}

// AI Session Tracking
model AISession {
  id          String   @id @default(cuid())
  userId      String?
  sessionType String   // "pipeline", "analysis", "generation"
  status      SessionStatus @default(PENDING)
  
  // Session data (flexible JSON for AI-specific data)
  inputData   Json?
  outputData  Json?
  metadata    Json?
  
  // Cost and performance tracking
  tokensUsed     Int?
  costUsd        Float?
  duration       Int?     // milliseconds
  qualityScore   Float?   // 0-1 quality rating
  
  // Error tracking
  errorMessage   String?
  errorCode      String?
  retryCount     Int      @default(0)
  
  // Relationships
  user           User?    @relation(fields: [userId], references: [id])
  logs           AILog[]
  
  // Audit fields
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  completedAt    DateTime?
  
  @@map("ai_sessions")
  @@index([userId])
  @@index([status])
  @@index([sessionType])
  @@index([createdAt])
}

enum SessionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

// Template Management
model ModuleTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  category    TemplateCategory
  complexity  TemplateComplexity
  
  // Template content
  htmlContent String
  cssContent  String?
  jsContent   String?
  
  // Metadata
  tags        String[]
  version     String   @default("1.0.0")
  usageCount  Int      @default(0)
  rating      Float?   // Average rating 0-5
  downloads   Int      @default(0)
  
  // Publishing
  isPublic    Boolean  @default(false)
  isApproved  Boolean  @default(false)
  authorId    String?
  
  // SEO and discovery
  slug        String   @unique
  keywords    String[]
  
  // Relationships
  projects    Project[]
  reviews     TemplateReview[]
  
  // Audit fields
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  publishedAt DateTime?
  
  @@map("module_templates")
  @@index([category])
  @@index([complexity])
  @@index([isPublic])
  @@index([rating])
  @@index([usageCount])
}

enum TemplateCategory {
  HEADER
  HERO
  CONTENT
  FOOTER
  FORM
  GALLERY
  TESTIMONIAL
  PRICING
  CONTACT
  NAVIGATION
}

enum TemplateComplexity {
  SIMPLE
  MODERATE
  COMPLEX
  ADVANCED
}

// Template Reviews
model TemplateReview {
  id         String         @id @default(cuid())
  templateId String
  userId     String
  rating     Int            // 1-5 stars
  comment    String?
  
  // Moderation
  isApproved Boolean        @default(false)
  
  // Relationships
  template   ModuleTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  
  // Audit fields
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
  
  @@map("template_reviews")
  @@unique([templateId, userId])
  @@index([templateId])
  @@index([rating])
}

// Project Management
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  userId      String
  templateId  String?
  
  // Project configuration
  settings    Json     // Project-specific settings
  
  // Content
  designUrl   String?  // Original design file URL
  outputHtml  String?  // Generated HTML
  outputCss   String?  // Generated CSS
  outputJs    String?  // Generated JavaScript
  
  // Metadata
  metadata    Json?    // Additional project metadata
  tags        String[]
  
  // Status tracking
  status      ProjectStatus @default(DRAFT)
  progress    Float         @default(0) // 0-100 completion percentage
  
  // Publishing
  isPublic       Boolean   @default(false)
  deploymentUrl  String?   // Live deployment URL
  previewUrl     String?   // Preview URL
  
  // Performance metrics
  buildTime      Int?      // Build time in milliseconds
  bundleSize     Int?      // Bundle size in bytes
  lighthouseScore Float?   // Lighthouse performance score
  
  // Relationships
  user           User           @relation(fields: [userId], references: [id])
  template       ModuleTemplate? @relation(fields: [templateId], references: [id])
  collaborators  ProjectCollaborator[]
  
  // Audit fields
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  publishedAt    DateTime?
  
  @@map("projects")
  @@index([userId])
  @@index([status])
  @@index([isPublic])
  @@index([createdAt])
}

enum ProjectStatus {
  DRAFT
  PROCESSING
  COMPLETED
  PUBLISHED
  ARCHIVED
  FAILED
}

// Project Collaboration
model ProjectCollaborator {
  id        String           @id @default(cuid())
  projectId String
  userId    String
  role      CollaboratorRole
  
  // Permissions
  canEdit   Boolean @default(false)
  canDelete Boolean @default(false)
  canShare  Boolean @default(false)
  
  // Relationships
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Audit fields
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("project_collaborators")
  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
}

enum CollaboratorRole {
  VIEWER
  EDITOR
  ADMIN
}

// Comprehensive Logging
model AILog {
  id          String    @id @default(cuid())
  sessionId   String
  level       LogLevel
  message     String
  context     Json?
  
  // Performance data
  timestamp   DateTime  @default(now())
  duration    Int?      // milliseconds
  memoryUsage Int?      // bytes
  
  // Error tracking
  errorStack  String?
  errorCode   String?
  
  // Relationships
  session     AISession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  @@map("ai_logs")
  @@index([sessionId])
  @@index([level])
  @@index([timestamp])
}

enum LogLevel {
  DEBUG
  INFO
  WARN
  ERROR
  FATAL
}

// Notification System
model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType
  title     String
  message   String
  data      Json?            // Additional notification data
  
  // Status
  isRead    Boolean @default(false)
  isArchived Boolean @default(false)
  
  // Delivery
  channels  String[] // email, push, in-app
  sentAt    DateTime?
  readAt    DateTime?
  
  // Relationships
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Audit fields
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("notifications")
  @@index([userId])
  @@index([type])
  @@index([isRead])
  @@index([createdAt])
}

enum NotificationType {
  PROJECT_COMPLETED
  TEMPLATE_APPROVED
  COLLABORATION_INVITE
  SYSTEM_UPDATE
  SECURITY_ALERT
  PAYMENT_SUCCESS
  PAYMENT_FAILED
}

// Analytics and Metrics
model AnalyticsEvent {
  id         String   @id @default(cuid())
  userId     String?
  sessionId  String?
  eventType  String   // page_view, button_click, api_call, etc.
  eventName  String
  properties Json?    // Event-specific properties
  
  // Context
  userAgent  String?
  ipAddress  String?
  referer    String?
  
  // Timing
  timestamp  DateTime @default(now())
  
  @@map("analytics_events")
  @@index([userId])
  @@index([eventType])
  @@index([timestamp])
}
```

---

## 🚀 **Database Service Implementation**

### **Database Connection Service**
```typescript
// src/infrastructure/database/DatabaseService.ts
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

export class DatabaseService {
  private static prisma: PrismaClient;
  private static redis: any;

  static async connect(): Promise<void> {
    try {
      // Initialize Prisma
      this.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
        datasources: {
          db: {
            url: process.env.DATABASE_URL
          }
        }
      });

      // Test database connection
      await this.prisma.$connect();
      console.log('✅ Database connected successfully');

      // Initialize Redis
      this.redis = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      await this.redis.connect();
      console.log('✅ Redis connected successfully');

    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  static async disconnect(): Promise<void> {
    try {
      await this.prisma?.$disconnect();
      await this.redis?.quit();
      console.log('✅ Database disconnected successfully');
    } catch (error) {
      console.error('❌ Database disconnection failed:', error);
    }
  }

  static getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }

  static getRedis() {
    if (!this.redis) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.redis;
  }

  // Health check
  static async healthCheck(): Promise<{ database: boolean; redis: boolean }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.ping();
      return { database: true, redis: true };
    } catch (error) {
      return { database: false, redis: false };
    }
  }

  // Database cleanup for tests
  static async clearDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('clearDatabase can only be used in test environment');
    }

    const tablenames = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        try {
          await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
        } catch (error) {
          console.log(`Could not truncate ${tablename}:`, error);
        }
      }
    }
  }
}
```

### **Repository Pattern Implementation**
```typescript
// src/infrastructure/database/repositories/UserRepository.ts
import { PrismaClient, User, Prisma } from '@prisma/client';
import { DatabaseService } from '../DatabaseService';

export class UserRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = DatabaseService.getPrisma();
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
      include: {
        projects: true,
        sessions: true
      }
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        projects: {
          where: { status: 'PUBLISHED' },
          orderBy: { updatedAt: 'desc' },
          take: 10
        }
      }
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email }
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id }
    });
  }

  async findMany(options: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    return this.prisma.user.findMany(options);
  }

  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return this.prisma.user.count({ where });
  }

  // Advanced queries
  async findActiveUsers(limit = 50): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        lastLoginAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      orderBy: { lastLoginAt: 'desc' },
      take: limit
    });
  }

  async getUserStats(userId: string): Promise<{
    projectCount: number;
    templateCount: number;
    totalSessions: number;
  }> {
    const [projectCount, templateCount, totalSessions] = await Promise.all([
      this.prisma.project.count({ where: { userId } }),
      this.prisma.moduleTemplate.count({ where: { authorId: userId } }),
      this.prisma.aISession.count({ where: { userId } })
    ]);

    return { projectCount, templateCount, totalSessions };
  }
}
```

---

## ⚡ **Performance Optimization**

### **Database Indexes**
```sql
-- Performance indexes for common queries
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_users_role ON users(role);
CREATE INDEX CONCURRENTLY idx_users_active ON users(is_active);
CREATE INDEX CONCURRENTLY idx_users_last_login ON users(last_login_at);

CREATE INDEX CONCURRENTLY idx_projects_user_id ON projects(user_id);
CREATE INDEX CONCURRENTLY idx_projects_status ON projects(status);
CREATE INDEX CONCURRENTLY idx_projects_public ON projects(is_public);
CREATE INDEX CONCURRENTLY idx_projects_created ON projects(created_at);

CREATE INDEX CONCURRENTLY idx_ai_sessions_user_id ON ai_sessions(user_id);
CREATE INDEX CONCURRENTLY idx_ai_sessions_status ON ai_sessions(status);
CREATE INDEX CONCURRENTLY idx_ai_sessions_type ON ai_sessions(session_type);
CREATE INDEX CONCURRENTLY idx_ai_sessions_created ON ai_sessions(created_at);

CREATE INDEX CONCURRENTLY idx_ai_logs_session_id ON ai_logs(session_id);
CREATE INDEX CONCURRENTLY idx_ai_logs_level ON ai_logs(level);
CREATE INDEX CONCURRENTLY idx_ai_logs_timestamp ON ai_logs(timestamp);

CREATE INDEX CONCURRENTLY idx_templates_category ON module_templates(category);
CREATE INDEX CONCURRENTLY idx_templates_complexity ON module_templates(complexity);
CREATE INDEX CONCURRENTLY idx_templates_public ON module_templates(is_public);
CREATE INDEX CONCURRENTLY idx_templates_rating ON module_templates(rating);

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY idx_projects_user_status ON projects(user_id, status);
CREATE INDEX CONCURRENTLY idx_sessions_user_type ON ai_sessions(user_id, session_type);
CREATE INDEX CONCURRENTLY idx_templates_public_category ON module_templates(is_public, category);
```

### **Caching Strategy**
```typescript
// src/infrastructure/cache/CacheService.ts
import { DatabaseService } from '../database/DatabaseService';

export class CacheService {
  private redis: any;
  private defaultTTL = 3600; // 1 hour

  constructor() {
    this.redis = DatabaseService.getRedis();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl = this.defaultTTL): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache pattern invalidation error:', error);
    }
  }

  // Cache decorators for common patterns
  generateUserCacheKey(userId: string): string {
    return `user:${userId}`;
  }

  generateProjectCacheKey(projectId: string): string {
    return `project:${projectId}`;
  }

  generateTemplateCacheKey(templateId: string): string {
    return `template:${templateId}`;
  }
}
```

---

## 🔧 **Migration & Seeding**

### **Migration Strategy**
```typescript
// scripts/migrate-database.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting database migration...');

  try {
    // Run Prisma migrations
    console.log('📦 Running Prisma migrations...');
    // This would be run via: npx prisma migrate deploy

    // Custom data migrations
    await migrateExistingData();

    console.log('✅ Database migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function migrateExistingData() {
  // Example: Migrate old template format to new schema
  const oldTemplates = await prisma.$queryRaw`
    SELECT * FROM legacy_templates WHERE migrated = false
  `;

  for (const template of oldTemplates as any[]) {
    await prisma.moduleTemplate.create({
      data: {
        name: template.title,
        description: template.desc,
        category: mapOldCategory(template.type),
        complexity: 'SIMPLE',
        htmlContent: template.html,
        cssContent: template.css,
        tags: template.tags ? template.tags.split(',') : [],
        version: '1.0.0'
      }
    });

    // Mark as migrated
    await prisma.$executeRaw`
      UPDATE legacy_templates SET migrated = true WHERE id = ${template.id}
    `;
  }
}

function mapOldCategory(oldType: string): string {
  const mapping: Record<string, string> = {
    'header': 'HEADER',
    'hero': 'HERO',
    'content': 'CONTENT',
    'footer': 'FOOTER'
  };
  return mapping[oldType] || 'CONTENT';
}

main();
```

### **Database Seeding**
```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
      passwordHash: '$2a$12$hashed_password_here',
      emailVerified: true
    }
  });

  // Create sample templates
  const templates = await Promise.all([
    createTemplate('Modern Header', 'HEADER', 'SIMPLE'),
    createTemplate('Hero Section', 'HERO', 'MODERATE'),
    createTemplate('Contact Form', 'FORM', 'COMPLEX'),
    createTemplate('Pricing Table', 'PRICING', 'MODERATE'),
    createTemplate('Footer with Links', 'FOOTER', 'SIMPLE')
  ]);

  // Create sample projects
  for (let i = 0; i < 10; i++) {
    await prisma.project.create({
      data: {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        userId: adminUser.id,
        templateId: faker.helpers.arrayElement(templates).id,
        status: faker.helpers.arrayElement(['DRAFT', 'COMPLETED', 'PUBLISHED']),
        tags: faker.helpers.arrayElements(['web', 'mobile', 'responsive', 'modern'], { min: 1, max: 3 })
      }
    });
  }

  console.log('✅ Database seeded successfully');
}

async function createTemplate(name: string, category: string, complexity: string) {
  return prisma.moduleTemplate.create({
    data: {
      name,
      description: `A ${complexity.toLowerCase()} ${category.toLowerCase()} template`,
      category: category as any,
      complexity: complexity as any,
      htmlContent: generateSampleHTML(name),
      cssContent: generateSampleCSS(),
      tags: [category.toLowerCase(), complexity.toLowerCase()],
      isPublic: true,
      isApproved: true,
      slug: name.toLowerCase().replace(/\s+/g, '-')
    }
  });
}

function generateSampleHTML(name: string): string {
  return `
    <div class="template-${name.toLowerCase().replace(/\s+/g, '-')}">
      <h2>${name}</h2>
      <p>This is a sample ${name} template.</p>
    </div>
  `;
}

function generateSampleCSS(): string {
  return `
    .template { padding: 1rem; margin: 1rem 0; }
    .template h2 { color: #333; font-size: 1.5rem; }
    .template p { color: #666; line-height: 1.6; }
  `;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 🔧 **Environment Configuration**

### **Database Environment Variables**
```bash
# .env.example
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
DIRECT_URL="postgresql://username:password@localhost:5432/database_name"

# Redis
REDIS_URL="redis://localhost:6379"

# Connection pooling
DATABASE_POOL_SIZE=10
DATABASE_CONNECTION_TIMEOUT=60000

# Performance
QUERY_TIMEOUT=30000
STATEMENT_TIMEOUT=60000

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM
BACKUP_RETENTION_DAYS=30
```

---

*This database architecture provides a solid foundation for scalable applications with proper performance optimization, caching strategies, and migration patterns. Adapt the schema to your specific domain requirements while maintaining these proven patterns.*
