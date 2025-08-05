# Database Quick Start Guide

## 🚀 **One-Command Installation**

I've created everything you need to install the database stack. Here's how to get started:

### **Step 1: Run the Installation Script**

```bash
# Navigate to your project directory
cd /Users/tim/smartmymeal/CascadeProjects/templator

# Run the installation script
./scripts/install-database.sh
```

That's it! The script will:
- ✅ Check if Docker is installed
- ✅ Create necessary directories
- ✅ Set up environment variables
- ✅ Pull and start all database services
- ✅ Verify everything is working

### **Step 2: Access Your Services**

After installation, you'll have access to:

| Service | URL | Default Credentials |
|---------|-----|-------------------|
| **PostgreSQL** | `localhost:5432` | `templator_user` / `secure_password_123` |
| **Redis** | `localhost:6379` | Password: `redis_secure_123` |
| **MinIO** | http://localhost:9000 | `minio_admin` / `minio_secret_123` |
| **MinIO Console** | http://localhost:9001 | `minio_admin` / `minio_secret_123` |
| **pgAdmin** | http://localhost:8080 | `admin@templator.local` / `admin_password_123` |

### **Step 3: Set Up Prisma (Optional)**

If you want to use the database schema I designed:

```bash
# Install Prisma if not already installed
npm install prisma @prisma/client

# Run migrations (after copying the schema from the implementation plan)
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

## 🛠️ **Manual Commands**

If you prefer to run things manually:

```bash
# Start all database services
docker-compose -f docker-compose.database.yml up -d

# Stop all services
docker-compose -f docker-compose.database.yml down

# View logs
docker-compose -f docker-compose.database.yml logs -f

# Check service status
docker-compose -f docker-compose.database.yml ps
```

## 🔧 **What Gets Installed**

1. **PostgreSQL 15** - Your main database
2. **Redis 7** - Caching and real-time features
3. **MinIO** - Self-hosted file storage
4. **pgAdmin 4** - Database management interface

All services are configured with:
- ✅ Health checks
- ✅ Automatic restarts
- ✅ Optimized settings
- ✅ Persistent data volumes
- ✅ Secure networking

## ⚠️ **Important Notes**

- **Change passwords** before production use!
- All data is stored in Docker volumes (persistent)
- Services are accessible on localhost only by default
- Backup scripts are included in the full implementation plan

## 🆘 **Troubleshooting**

If something doesn't work:

```bash
# Check if Docker is running
docker --version

# Check service logs
docker-compose -f docker-compose.database.yml logs [service-name]

# Restart a specific service
docker-compose -f docker-compose.database.yml restart [service-name]

# Clean restart (removes containers but keeps data)
docker-compose -f docker-compose.database.yml down
docker-compose -f docker-compose.database.yml up -d
```

## 📖 **Next Steps**

1. Run the installation script
2. Access pgAdmin to explore your database
3. Update your application's connection strings
4. Start building with your new database stack!

For the complete implementation details, see `DATABASE_IMPLEMENTATION_PLAN.md`.
