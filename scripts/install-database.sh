#!/bin/bash
# Database Installation Script for Templator Project

set -e

echo "🚀 Installing Templator Database Stack..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are installed${NC}"

# Create necessary directories
echo -e "${BLUE}📁 Creating database directories...${NC}"
mkdir -p database/init database/backups

# Copy environment variables
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.database template...${NC}"
    cp .env.database .env
    echo -e "${YELLOW}📝 Please review and update passwords in .env file before production use!${NC}"
else
    echo -e "${BLUE}📋 Adding database variables to existing .env file...${NC}"
    echo "" >> .env
    echo "# Database Configuration (added by install-database.sh)" >> .env
    cat .env.database >> .env
fi

# Pull Docker images
echo -e "${BLUE}📦 Pulling Docker images...${NC}"
docker-compose -f docker-compose.database.yml pull

# Start the database services
echo -e "${BLUE}🚀 Starting database services...${NC}"
docker-compose -f docker-compose.database.yml up -d

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 30

# Check service health
echo -e "${BLUE}🔍 Checking service health...${NC}"

# Check PostgreSQL
if docker exec templator-postgres pg_isready -U templator_user -d templator > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not ready${NC}"
fi

# Check Redis
if docker exec templator-redis redis-cli --no-auth-warning -a redis_secure_123 ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is ready${NC}"
else
    echo -e "${RED}❌ Redis is not ready${NC}"
fi

# Check MinIO
if docker exec templator-minio curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MinIO is ready${NC}"
else
    echo -e "${RED}❌ MinIO is not ready${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Database installation completed!${NC}"
echo ""
echo -e "${BLUE}📋 Service URLs:${NC}"
echo -e "  PostgreSQL: ${YELLOW}localhost:5432${NC}"
echo -e "  Redis: ${YELLOW}localhost:6379${NC}"
echo -e "  MinIO: ${YELLOW}http://localhost:9000${NC}"
echo -e "  MinIO Console: ${YELLOW}http://localhost:9001${NC}"
echo -e "  pgAdmin: ${YELLOW}http://localhost:8080${NC}"
echo ""
echo -e "${BLUE}🔑 Default Credentials:${NC}"
echo -e "  PostgreSQL: ${YELLOW}templator_user / secure_password_123${NC}"
echo -e "  Redis: ${YELLOW}redis_secure_123${NC}"
echo -e "  MinIO: ${YELLOW}minio_admin / minio_secret_123${NC}"
echo -e "  pgAdmin: ${YELLOW}admin@templator.local / admin_password_123${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Change all default passwords before production use!${NC}"
echo ""
echo -e "${BLUE}📖 Next Steps:${NC}"
echo -e "  1. Update your application's DATABASE_URL in .env"
echo -e "  2. Run Prisma migrations: ${YELLOW}npx prisma migrate dev${NC}"
echo -e "  3. Generate Prisma client: ${YELLOW}npx prisma generate${NC}"
echo -e "  4. Access pgAdmin at http://localhost:8080 to manage your database"
echo ""
echo -e "${GREEN}✨ Happy coding!${NC}"
