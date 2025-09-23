#!/bin/bash

# Frictionless Docker startup script for Gitdata application
echo "🚀 Starting Gitdata BSV Overlay Network Application..."

# Stop any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose.production.yml down 2>/dev/null || true

# Remove old volumes to ensure fresh start
echo "🗑️  Removing old data volumes..."
docker volume rm gitdata_postgres_data gitdata_redis_data 2>/dev/null || true

# Build and start all services
echo "🔨 Building and starting services..."
docker-compose -f docker-compose.production.yml up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check health status
echo "🔍 Checking application health..."
curl -s http://localhost:8788/health || echo "❌ Health check failed"

echo ""
echo "✅ Gitdata application is ready!"
echo "🌐 Open your browser to: http://localhost:8788"
echo "📊 Market API: http://localhost:8788/v1/search"
echo "💾 Database: localhost:5432 (postgres/password)"
echo "🔄 Redis: localhost:6379"
echo ""
echo "To stop the application, run:"
echo "docker-compose -f docker-compose.production.yml down"