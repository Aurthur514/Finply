#!/bin/bash

# Health check script for Finply AI Financial Sandbox

BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:3000"

echo "🔍 Checking Finply AI Financial Sandbox health..."

# Check backend
echo "Checking backend API..."
if curl -s -f "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    echo "✅ Backend API is healthy"
else
    echo "❌ Backend API is not responding"
    exit 1
fi

# Check frontend
echo "Checking frontend..."
if curl -s -f "$FRONTEND_URL" > /dev/null 2>&1; then
    echo "✅ Frontend is responding"
else
    echo "❌ Frontend is not responding"
    exit 1
fi

echo "🎉 All services are healthy!"
echo ""
echo "🌐 Application URLs:"
echo "   Frontend: $FRONTEND_URL"
echo "   Backend API: $BACKEND_URL"
echo "   API Documentation: $BACKEND_URL/docs"
