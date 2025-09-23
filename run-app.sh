#!/bin/bash

echo "🚀 Starting Gitdata Application (Frictionless Docker Setup)"
echo "=================================================="

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker stop gitdata-app gitdata-postgres gitdata-redis 2>/dev/null || true
docker rm gitdata-app gitdata-postgres gitdata-redis 2>/dev/null || true

# Create network
echo "🔗 Creating Docker network..."
docker network create gitdata-net 2>/dev/null || echo "Network already exists"

# Start PostgreSQL with automatic schema and data
echo "🗄️ Starting PostgreSQL database with automatic setup..."
docker run -d --name gitdata-postgres \
  --network gitdata-net \
  -e POSTGRES_DB=overlay \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -v $(pwd)/populate-sample-data.sql:/docker-entrypoint-initdb.d/99-sample-data.sql \
  -v $(pwd)/src/db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql \
  -v $(pwd)/src/db/schema-d08-realtime-packets.sql:/docker-entrypoint-initdb.d/02-d08-schema.sql \
  -v $(pwd)/src/db/schema-d22-overlay-storage.sql:/docker-entrypoint-initdb.d/03-storage-schema.sql \
  -p 5432:5432 \
  postgres:15-alpine

# Start Redis
echo "🔄 Starting Redis cache..."
docker run -d --name gitdata-redis \
  --network gitdata-net \
  -p 6379:6379 \
  redis:7-alpine redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

# Wait for database to initialize
echo "⏳ Waiting for database initialization (30 seconds)..."
sleep 30

# Start application
echo "🚀 Starting Gitdata application..."
docker run -d --name gitdata-app \
  --network gitdata-net \
  -p 8788:8788 \
  -e NODE_ENV=production \
  -e PG_HOST=gitdata-postgres \
  -e PG_PORT=5432 \
  -e PG_DATABASE=overlay \
  -e PG_USER=postgres \
  -e PG_PASSWORD=password \
  -e REDIS_URL=redis://gitdata-redis:6379 \
  -e ALLOWED_ORIGINS=http://localhost:8788 \
  gitdata-app

# Wait for application to start
echo "⏳ Waiting for application to start (15 seconds)..."
sleep 15

# Test the application
echo "🔍 Testing application..."
if curl -s http://localhost:8788/health > /dev/null; then
    echo "✅ Health check passed!"

    # Test market data
    MARKET_COUNT=$(curl -s "http://localhost:8788/v1/search" | grep -o '"versionId"' | wc -l)
    echo "📊 Market has $MARKET_COUNT datasets available"

    echo ""
    echo "🎉 APPLICATION IS READY!"
    echo "=================================================="
    echo "🌐 Open your browser to: http://localhost:8788"
    echo "📊 Market page should show $MARKET_COUNT assets"
    echo "📈 API endpoint: http://localhost:8788/v1/search"
    echo ""
    echo "To stop the application:"
    echo "docker stop gitdata-app gitdata-postgres gitdata-redis"
    echo "docker rm gitdata-app gitdata-postgres gitdata-redis"

else
    echo "❌ Health check failed!"
    echo "🔍 Checking logs..."
    docker logs gitdata-app --tail 10
fi