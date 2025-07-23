#!/bin/bash

# Development startup script for Templator
# This script starts both frontend and backend with auto-restart

echo "🚀 Starting Templator Development Environment..."
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3009"
echo ""

# Function to kill background processes on exit
cleanup() {
    echo "🛑 Shutting down development servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start backend server
echo "📡 Starting backend server on port 3009..."
cd backend && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend server
echo "🎨 Starting frontend server on port 3000..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

# Wait for both processes
echo "✅ Development servers started!"
echo "Press Ctrl+C to stop both servers"
wait
