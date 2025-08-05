# Database Implementation Plan - Templator Project

## 🎯 **Executive Summary**

This document outlines the comprehensive database implementation strategy for the Templator AI-powered HubSpot module generation system. The plan focuses on self-hosted database solutions to ensure data sovereignty, cost optimization, and performance control.

---

## 🏗️ **Architecture Overview**

### **Core Database Stack**
- **Primary Database**: PostgreSQL 15 (Self-hosted)
- **Caching Layer**: Redis 7 (Self-hosted)
- **Object Storage**: MinIO (Self-hosted S3-compatible)
- **Administration**: pgAdmin 4 (Web-based management)

### **Key Design Principles**
1. **Data Sovereignty**: Complete control over data location and access
2. **Performance Optimization**: Tailored for AI workload patterns
3. **Cost Efficiency**: Predictable infrastructure costs
4. **Scalability**: Horizontal and vertical scaling capabilities
5. **High Availability**: Robust backup and recovery strategies

---

## 📊 **Database Schema Design**

### **Core Entities**

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
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relationships
  projects  Project[]
  sessions  AISession[]
  
  @@map("users")
}

// Project Management
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  userId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relationships
  user        User       @relation(fields: [userId], references: [id])
  templates   Template[]
  sessions    AISession[]
  
  @@map("projects")
}

// AI Processing Sessions
model AISession {
  id            String        @id @default(cuid())
  projectId     String
  userId        String
  status        SessionStatus @default(PENDING)
  phase         String        @default("upload")
  progress      Float         @default(0)
  
  // AI Processing Data (JSONB for flexibility)
  inputData     Json?         // Original upload data
  sections      Json?         // Detected sections
  aiAnalysis    Json?         // AI analysis results
  suggestions   Json?         // Splitting suggestions
  finalResult   Json?         // Generated module data
  
  // Metadata
  processingTime Int?         // Processing time in ms
  errorLog       Json?        // Error details if failed
  qualityScore   Float?       // Quality assessment score
  
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  
  // Relationships
  project       Project      @relation(fields: [projectId], references: [id])
  user          User         @relation(fields: [userId], references: [id])
  templates     Template[]
  logs          ProcessingLog[]
  
  @@map("ai_sessions")
}

// Generated Templates/Modules
model Template {
  id            String       @id @default(cuid())
  name          String
  description   String?
  projectId     String
  sessionId     String?
  
  // Template Data
  htmlContent   String       // Generated HTML
  cssContent    String?      // Generated CSS
  jsContent     String?      // Generated JavaScript
  hubspotConfig Json         // HubSpot module configuration
  
  // Metadata
  version       String       @default("1.0.0")
  status        TemplateStatus @default(DRAFT)
  qualityScore  Float?
  tags          String[]
  
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  
  // Relationships
  project       Project      @relation(fields: [projectId], references: [id])
  session       AISession?   @relation(fields: [sessionId], references: [id])
  versions      TemplateVersion[]
  
  @@map("templates")
}

// Template Versioning
model TemplateVersion {
  id           String   @id @default(cuid())
  templateId   String
  version      String
  changes      Json     // Change log
  content      Json     // Full template content snapshot
  createdAt    DateTime @default(now())
  
  template     Template @relation(fields: [templateId], references: [id])
  
  @@unique([templateId, version])
  @@map("template_versions")
}

// Processing Logs (for debugging and analytics)
model ProcessingLog {
  id         String    @id @default(cuid())
  sessionId  String
  level      LogLevel  @default(INFO)
  phase      String
  message    String
  data       Json?
  timestamp  DateTime  @default(now())
  
  session    AISession @relation(fields: [sessionId], references: [id])
  
  @@index([sessionId, timestamp])
  @@map("processing_logs")
}

// Enums
enum UserRole {
  USER
  ADMIN
  EXPERT
}

enum SessionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

enum TemplateStatus {
  DRAFT
  REVIEW
  APPROVED
  PUBLISHED
  ARCHIVED
}

enum LogLevel {
  DEBUG
  INFO
  WARN
  ERROR
}
```

---

## 🐳 **Infrastructure Setup**

### **Docker Compose Configuration**

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Primary Database
  postgres:
    image: postgres:15-alpine
    container_name: templator-postgres
    environment:
      POSTGRES_DB: templator
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
      - ./database/backups:/backups
    ports:
      - "5432:5432"
    restart: unless-stopped
    command: >
      postgres
      -c shared_preload_libraries=pg_stat_statements
      -c pg_stat_statements.track=all
      -c max_connections=200
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c maintenance_work_mem=64MB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=100
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d templator"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Caching Layer
  redis:
    image: redis:7-alpine
    container_name: templator-redis
    command: >
      redis-server
      --appendonly yes
      --appendfsync everysec
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
      - ./database/redis.conf:/usr/local/etc/redis/redis.conf
    ports:
      - "6379:6379"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Self-Hosted Object Storage
  minio:
    image: minio/minio:latest
    container_name: templator-minio
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    command: server /data --console-address ":9001"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Database Administration
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: templator-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD}
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    ports:
      - "8080:80"
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  minio_data:
  pgadmin_data:
```

---

## 🔧 **Database Optimization**

### **PostgreSQL Initialization Scripts**

```sql
-- database/init/01-extensions.sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create optimized indexes for AI data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_sessions_jsonb_gin 
ON ai_sessions USING GIN (ai_analysis);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_sessions_status_created 
ON ai_sessions (status, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_search 
ON templates USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Create composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_sessions_user_project_status 
ON ai_sessions (user_id, project_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_logs_session_timestamp 
ON processing_logs (session_id, timestamp DESC);
```

### **Redis Configuration**

```conf
# database/redis.conf
# Memory optimization
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Performance
tcp-keepalive 300
timeout 0
tcp-backlog 511

# Security
requirepass ${REDIS_PASSWORD}

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
```

---

## 💻 **Application Integration**

### **Database Manager Service**

```typescript
// infrastructure/database/DatabaseManager.ts
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import Redis from 'ioredis';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private prisma: PrismaClient;
  private pgPool: Pool;
  private redis: Redis;

  private constructor() {
    // Prisma with connection pooling
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
    });

    // Direct PostgreSQL pool for complex queries
    this.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Redis connection with retry logic
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
    });
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  get db() { return this.prisma; }
  get pool() { return this.pgPool; }
  get cache() { return this.redis; }

  async healthCheck(): Promise<{ postgres: boolean; redis: boolean }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const postgresHealthy = true;
      
      await this.redis.ping();
      const redisHealthy = true;

      return { postgres: postgresHealthy, redis: redisHealthy };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { postgres: false, redis: false };
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pgPool.end();
    this.redis.disconnect();
  }
}
```

### **MinIO Storage Service**

```typescript
// infrastructure/storage/MinIOService.ts
import { Client as MinIOClient } from 'minio';

export class MinIOService {
  private client: MinIOClient;
  private bucketName = 'templator-assets';

  constructor() {
    this.client = new MinIOClient({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });

    this.initializeBucket();
  }

  private async initializeBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName, 'us-east-1');
        
        // Set bucket policy for public read access to certain paths
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/public/*`]
            }
          ]
        };
        
        await this.client.setBucketPolicy(this.bucketName, JSON.stringify(policy));
      }
    } catch (error) {
      console.error('Failed to initialize MinIO bucket:', error);
    }
  }

  async uploadDesignFile(sessionId: string, file: Buffer, contentType: string): Promise<string> {
    const objectName = `designs/${sessionId}/${Date.now()}.${this.getExtension(contentType)}`;
    
    await this.client.putObject(this.bucketName, objectName, file, file.length, {
      'Content-Type': contentType,
      'X-Session-ID': sessionId,
    });

    return objectName;
  }

  async uploadGeneratedModule(sessionId: string, moduleZip: Buffer): Promise<string> {
    const objectName = `modules/${sessionId}/module-${Date.now()}.zip`;
    
    await this.client.putObject(this.bucketName, objectName, moduleZip, moduleZip.length, {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="hubspot-module.zip"',
    });

    return objectName;
  }

  async getDownloadUrl(objectName: string, expiry = 3600): Promise<string> {
    return await this.client.presignedGetObject(this.bucketName, objectName, expiry);
  }

  private getExtension(contentType: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'text/html': 'html',
      'application/json': 'json',
    };
    return extensions[contentType] || 'bin';
  }
}
```

---

## 🔄 **Backup & Recovery Strategy**

### **Automated Backup Script**

```bash
#!/bin/bash
# scripts/backup-database.sh

set -e

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="templator"

# Create backup directory
mkdir -p $BACKUP_DIR

# PostgreSQL backup
echo "Creating PostgreSQL backup..."
docker exec templator-postgres pg_dump -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/postgres_$TIMESTAMP.sql.gz

# Redis backup
echo "Creating Redis backup..."
docker exec templator-redis redis-cli --rdb /data/dump_$TIMESTAMP.rdb
docker cp templator-redis:/data/dump_$TIMESTAMP.rdb $BACKUP_DIR/

# MinIO backup (sync to external storage)
echo "Syncing MinIO data..."
docker exec templator-minio mc mirror /data /backups/minio_$TIMESTAMP/

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "postgres_*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "dump_*.rdb" -mtime +7 -delete
find $BACKUP_DIR -name "minio_*" -mtime +7 -exec rm -rf {} \;

echo "Backup completed: $TIMESTAMP"
```

### **Recovery Procedures**

```bash
#!/bin/bash
# scripts/restore-database.sh

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_timestamp>"
    exit 1
fi

TIMESTAMP=$1
BACKUP_DIR="/backups"

# Stop services
docker-compose down

# Restore PostgreSQL
echo "Restoring PostgreSQL..."
docker-compose up -d postgres
sleep 10
zcat $BACKUP_DIR/postgres_$TIMESTAMP.sql.gz | docker exec -i templator-postgres psql -U $DB_USER -d $DB_NAME

# Restore Redis
echo "Restoring Redis..."
docker cp $BACKUP_DIR/dump_$TIMESTAMP.rdb templator-redis:/data/dump.rdb
docker-compose restart redis

# Restore MinIO
echo "Restoring MinIO..."
docker cp $BACKUP_DIR/minio_$TIMESTAMP/. templator-minio:/data/

# Start all services
docker-compose up -d

echo "Restore completed for timestamp: $TIMESTAMP"
```

---

## 📊 **Monitoring & Maintenance**

### **Database Monitor Service**

```typescript
// services/monitoring/DatabaseMonitor.ts
export class DatabaseMonitor {
  private dbManager = DatabaseManager.getInstance();

  async getSystemHealth(): Promise<SystemHealth> {
    const health = await this.dbManager.healthCheck();
    
    // Check connection pool status
    const poolStatus = {
      totalConnections: this.dbManager.pool.totalCount,
      idleConnections: this.dbManager.pool.idleCount,
      waitingClients: this.dbManager.pool.waitingCount,
    };

    // Check Redis memory usage
    const redisInfo = await this.dbManager.cache.info('memory');
    const memoryUsage = this.parseRedisMemory(redisInfo);

    // Check disk space (for Docker volumes)
    const diskSpace = await this.checkDiskSpace();

    return {
      databases: health,
      connectionPool: poolStatus,
      redisMemory: memoryUsage,
      diskSpace,
      timestamp: new Date().toISOString(),
    };
  }

  async optimizeDatabase(): Promise<void> {
    // Run VACUUM and ANALYZE on PostgreSQL
    await this.dbManager.pool.query('VACUUM ANALYZE;');
    
    // Clear expired Redis keys
    await this.dbManager.cache.eval(`
      for i, name in ipairs(redis.call('KEYS', ARGV[1])) do
        if redis.call('TTL', name) == -1 then
          redis.call('DEL', name)
        end
      end
    `, 0, 'session:*');
  }

  private parseRedisMemory(info: string): any {
    const lines = info.split('\r\n');
    const memory: any = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.includes('memory')) {
          memory[key] = value;
        }
      }
    });
    
    return memory;
  }

  private async checkDiskSpace(): Promise<any> {
    // Implementation for checking Docker volume disk space
    // This would typically use system commands or Docker API
    return {
      postgres: '85%',
      redis: '45%',
      minio: '60%'
    };
  }
}
```

---

## 🚀 **Implementation Timeline**

### **Phase 1: Infrastructure Setup (Week 1)**
- [ ] Set up Docker Compose environment
- [ ] Configure PostgreSQL with optimizations
- [ ] Set up Redis with persistence
- [ ] Configure MinIO object storage
- [ ] Set up pgAdmin for database management

### **Phase 2: Schema Implementation (Week 2)**
- [ ] Implement Prisma schema
- [ ] Create database migrations
- [ ] Set up indexes and constraints
- [ ] Create seed data for development
- [ ] Test schema with sample data

### **Phase 3: Application Integration (Week 3)**
- [ ] Implement DatabaseManager service
- [ ] Create MinIO storage service
- [ ] Set up connection pooling
- [ ] Implement caching strategies
- [ ] Create health check endpoints

### **Phase 4: Backup & Monitoring (Week 4)**
- [ ] Set up automated backup scripts
- [ ] Implement monitoring services
- [ ] Create recovery procedures
- [ ] Set up alerting for critical issues
- [ ] Performance testing and optimization

### **Phase 5: Production Deployment (Week 5)**
- [ ] Production environment setup
- [ ] Security hardening
- [ ] Load testing
- [ ] Documentation completion
- [ ] Team training and handover

---

## 🔒 **Security Considerations**

### **Database Security**
- Strong passwords and user authentication
- Network isolation using Docker networks
- Regular security updates and patches
- Encrypted connections (TLS/SSL)
- Role-based access control

### **Data Protection**
- Regular automated backups
- Backup encryption and secure storage
- Data retention policies
- GDPR compliance measures
- Audit logging for sensitive operations

---

## 📈 **Performance Targets**

### **Response Time Goals**
- Database queries: < 100ms (95th percentile)
- Cache operations: < 10ms (95th percentile)
- File uploads: < 5 seconds for 10MB files
- Backup operations: < 30 minutes for full backup

### **Throughput Targets**
- Concurrent users: 100+
- AI sessions per hour: 500+
- Database connections: 200 max
- Storage capacity: 1TB+ scalable

---

## 🎯 **Success Metrics**

### **Reliability**
- Database uptime: 99.9%
- Backup success rate: 100%
- Recovery time objective (RTO): < 1 hour
- Recovery point objective (RPO): < 15 minutes

### **Performance**
- Query response time: < 100ms average
- Cache hit ratio: > 90%
- Storage I/O latency: < 50ms
- Connection pool efficiency: > 85%

---

## 📚 **Documentation & Training**

### **Technical Documentation**
- Database schema documentation
- API integration guides
- Backup and recovery procedures
- Monitoring and alerting setup
- Troubleshooting guides

### **Team Training**
- Database administration basics
- Monitoring and alerting systems
- Backup and recovery procedures
- Performance optimization techniques
- Security best practices

---

This implementation plan provides a comprehensive roadmap for deploying a robust, self-hosted database infrastructure that will support the Templator project's AI-powered capabilities while maintaining full control over data and costs.
