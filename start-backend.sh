#!/bin/bash

# Backend server startup script
# This script starts only the backend server

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
    print_warning "Shutting down backend server..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    lsof -ti:3009 | xargs kill -9 2>/dev/null || true
    print_success "Backend server stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

print_info "🚀 Starting Templator Backend Server..."
print_info "Backend API: http://localhost:3009"
print_info "Health Check: http://localhost:3009/health"
echo ""

# Check if port is available
if ! check_port 3009; then
    print_error "Port 3009 is already in use. Please stop the process using this port."
    lsof -i :3009
    exit 1
fi

# Check if node_modules exist
if [ ! -d "backend/node_modules" ]; then
    print_warning "Backend dependencies not found. Installing..."
    cd backend && npm install && cd ..
fi

# Start backend server
print_info "📡 Starting backend server on port 3009..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
if ! wait_for_server "http://localhost:3009/health" "Backend server"; then
    print_error "Backend server failed to start."
    exit 1
fi

print_success "🎉 Backend server started successfully!"
print_info "🔧 Backend API: http://localhost:3009"
print_info "📊 Health Check: http://localhost:3009/health"
echo ""
print_warning "Press Ctrl+C to stop the server"

# Wait for the process
wait
