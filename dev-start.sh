#!/bin/bash

# Development startup script for Templator
# This script starts both frontend and backend with auto-restart

set -e  # Exit on any error

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to force-free one or more ports
kill_ports() {
    local ports=("$@")
    for port in "${ports[@]}"; do
        print_warning "Ensuring port $port is free..."
        # Collect unique PIDs listening on the port
        local pids
        pids=$(lsof -ti tcp:$port -sTCP:LISTEN 2>/dev/null | sort -u | tr '\n' ' ')
        if [ -n "$pids" ]; then
            print_warning "Terminating PIDs on port $port: $pids"
            kill -TERM $pids 2>/dev/null || true
            sleep 1
            # Force kill anything still alive
            for p in $pids; do
                if kill -0 "$p" 2>/dev/null; then
                    print_warning "Force killing PID $p on port $port"
                    kill -KILL "$p" 2>/dev/null || true
                fi
            done
        else
            print_info "No listeners on port $port"
        fi
    done
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

# Function to kill background processes on exit
cleanup() {
    print_warning "Shutting down development servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    # Kill any remaining processes on our ports
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3009 | xargs kill -9 2>/dev/null || true
    print_success "Cleanup completed"
    exit 0
}

# Set up trap to cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

print_info "🚀 Starting Templator Development Environment..."
print_info "Frontend: http://localhost:3000"
print_info "Backend: http://localhost:3009"
echo ""

# Always free the dev ports before starting
kill_ports 3009 3000

# Check if node_modules exist
if [ ! -d "backend/node_modules" ]; then
    print_warning "Backend dependencies not found. Installing..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    print_warning "Frontend dependencies not found. Installing..."
    cd frontend && npm install && cd ..
fi

# Start backend server
print_info "📡 Starting backend server on port 3009..."
cd backend
PORT=3009 npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
if ! wait_for_server "http://localhost:3009/health" "Backend server"; then
    print_error "Backend server failed to start. Check backend.log for details."
    tail -20 backend.log
    exit 1
fi

# Start frontend server
print_info "🎨 Starting frontend server on port 3000..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to be ready
if ! wait_for_server "http://localhost:3000" "Frontend server"; then
    print_error "Frontend server failed to start. Check frontend.log for details."
    tail -20 frontend.log
    exit 1
fi

print_success "🎉 Development servers started successfully!"
print_info "📱 Frontend: http://localhost:3000"
print_info "🔧 Backend API: http://localhost:3009"
print_info "📊 Backend Health: http://localhost:3009/health"
print_info "📝 Logs: backend.log and frontend.log"
echo ""
print_warning "Press Ctrl+C to stop both servers"

# Wait for both processes
wait
