#!/bin/bash

set -e

echo "🚀 Installing Templator MVP Database (PostgreSQL only)..."

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

if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not available. Please install Docker Compose first.${NC}"
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are available${NC}"

if [ ! -f .env.database ]; then
    echo -e "${YELLOW}📝 Creating database environment file...${NC}"
    cat > .env.database << EOF
DB_USER=templator_user
DB_PASSWORD=CHANGE_THIS_PASSWORD
DB_NAME=templator
DB_HOST=localhost
DB_PORT=5432

DATABASE_URL="postgresql://\${DB_USER}:\${DB_PASSWORD}@\${DB_HOST}:\${DB_PORT}/\${DB_NAME}?schema=public"
EOF
    echo -e "${GREEN}✅ Created .env.database${NC}"
else
    echo -e "${BLUE}ℹ️  Using existing .env.database${NC}"
fi

echo -e "${YELLOW}🛑 Stopping any existing database containers...${NC}"
docker compose -f docker-compose.mvp-database.yml --env-file .env.database down 2>/dev/null || true

echo -e "${YELLOW}🚀 Starting MVP database stack...${NC}"
docker compose -f docker-compose.mvp-database.yml --env-file .env.database up -d

echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
timeout=60
counter=0
while ! docker exec templator-postgres-mvp pg_isready -U templator_user -d templator &>/dev/null; do
    if [ $counter -ge $timeout ]; then
        echo -e "${RED}❌ PostgreSQL failed to start within $timeout seconds${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
    ((counter++))
done

echo -e "\n${GREEN}✅ PostgreSQL is ready!${NC}"

echo -e "\n${BLUE}📊 Database Connection Information:${NC}"
echo -e "Host: localhost"
echo -e "Port: 5432"
echo -e "Database: templator"
echo -e "Username: templator_user"
echo -e "Password: \$DB_PASSWORD (from .env.database)"

echo -e "\n${GREEN}🎉 MVP Database installation completed successfully!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Install Prisma: cd backend && npm install prisma @prisma/client"
echo -e "2. Set up Prisma schema and run migrations"
echo -e "3. Update your application to use the database"

echo -e "\n${BLUE}To stop the database:${NC} docker compose -f docker-compose.mvp-database.yml down"
echo -e "${BLUE}To view logs:${NC} docker compose -f docker-compose.mvp-database.yml logs -f"
