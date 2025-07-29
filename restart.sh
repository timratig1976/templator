#!/bin/bash

# Simple restart script for Templator
echo "🔄 Restarting Templator servers..."

# Kill any existing processes on our ports
echo "🛑 Stopping existing servers..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3009 | xargs kill -9 2>/dev/null || true

# Wait a moment for cleanup
sleep 2

# Start the development environment
echo "🚀 Starting servers..."
./dev-start.sh

echo "✅ Restart complete!"
