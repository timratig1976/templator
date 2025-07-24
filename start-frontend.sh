#!/bin/bash

# Frontend server startup script
# This script starts only the frontend server

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
    print_warning "Shutting down frontend server..."
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    print_success "Frontend server stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

print_info "🚀 Starting Templator Frontend Server..."
print_info "Frontend: http://localhost:3000"
echo ""

# Check if port is available
if ! check_port 3000; then
    print_error "Port 3000 is already in use. Please stop the process using this port."
    lsof -i :3000
    exit 1
fi

# Check if node_modules exist
if [ ! -d "frontend/node_modules" ]; then
    print_warning "Frontend dependencies not found. Installing..."
    cd frontend && npm install && cd ..
fi

# Start frontend server
print_info "🎨 Starting frontend server on port 3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for frontend to be ready
if ! wait_for_server "http://localhost:3000" "Frontend server"; then
    print_error "Frontend server failed to start."
    exit 1
fi

print_success "🎉 Frontend server started successfully!"
print_info "📱 Frontend: http://localhost:3000"
echo ""
print_warning "Press Ctrl+C to stop the server"

# Wait for the process
wait
