#!/bin/bash

# Production server startup script
# This script builds and starts both frontend and backend in production mode

set -e

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Function to wait for server to be ready
wait_for_server() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    print_info "Waiting for $name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s $url >/dev/null 2>&1; then
            print_success "$name is ready!"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    print_error "$name failed to start within 30 seconds"
    return 1
}

# Cleanup function
cleanup() {
    print_warning "Shutting down production servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3009 | xargs kill -9 2>/dev/null || true
    print_success "Production servers stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

print_info "🚀 Starting Templator in Production Mode..."
print_info "Frontend: http://localhost:3000"
print_info "Backend: http://localhost:3009"
echo ""

# Check if ports are available
if ! check_port 3009; then
    print_error "Port 3009 is already in use. Please stop the process using this port."
    lsof -i :3009
    exit 1
fi

if ! check_port 3000; then
    print_error "Port 3000 is already in use. Please stop the process using this port."
    lsof -i :3000
    exit 1
fi

# Install dependencies if needed
if [ ! -d "backend/node_modules" ]; then
    print_warning "Backend dependencies not found. Installing..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    print_warning "Frontend dependencies not found. Installing..."
    cd frontend && npm install && cd ..
fi

# Build backend
print_info "🔨 Building backend..."
cd backend
npm run build
if [ $? -ne 0 ]; then
    print_error "Backend build failed!"
    exit 1
fi
cd ..

# Build frontend
print_info "🔨 Building frontend..."
cd frontend
npm run build
if [ $? -ne 0 ]; then
    print_error "Frontend build failed!"
    exit 1
fi
cd ..

# Start backend in production mode
print_info "📡 Starting backend server in production mode..."
cd backend
NODE_ENV=production npm start > ../backend-prod.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
if ! wait_for_server "http://localhost:3009/health" "Backend server"; then
    print_error "Backend server failed to start. Check backend-prod.log for details."
    tail -20 backend-prod.log
    exit 1
fi

# Start frontend in production mode
print_info "🎨 Starting frontend server in production mode..."
cd frontend
NODE_ENV=production npm start > ../frontend-prod.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to be ready
if ! wait_for_server "http://localhost:3000" "Frontend server"; then
    print_error "Frontend server failed to start. Check frontend-prod.log for details."
    tail -20 frontend-prod.log
    exit 1
fi

print_success "🎉 Production servers started successfully!"
print_info "📱 Frontend: http://localhost:3000"
print_info "🔧 Backend API: http://localhost:3009"
print_info "📊 Backend Health: http://localhost:3009/health"
print_info "📝 Logs: backend-prod.log and frontend-prod.log"
echo ""
print_warning "Press Ctrl+C to stop both servers"

# Wait for both processes
wait
