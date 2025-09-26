#!/bin/bash

# Make script properly exitable with Ctrl+C
trap 'echo -e "\n❌ Script interrupted by user"; exit 130' INT TERM

echo "🚀 Starting BSV Overlay Network Application"
echo "==========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Detect docker-compose command
DOCKER_COMPOSE=""
if command -v docker-compose > /dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Neither 'docker-compose' nor 'docker compose' is available."
    echo "   Please install Docker Compose and try again."
    exit 1
fi

echo "ℹ️  Using: $DOCKER_COMPOSE"

# Parse command line arguments
ADMIN_MODE=false
CLEAN_VOLUMES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --admin)
            ADMIN_MODE=true
            shift
            ;;
        --clean)
            CLEAN_VOLUMES=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --admin    Start with admin tools (pgAdmin, Redis Commander)"
            echo "  --clean    Remove existing data volumes for fresh start"
            echo "  --help     Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0              # Start basic services"
            echo "  $0 --admin      # Start with admin tools"
            echo "  $0 --clean      # Clean volumes and start fresh"
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Clean up existing containers and cache
echo "🧹 Cleaning up existing containers and cache..."
$DOCKER_COMPOSE down --remove-orphans 2>/dev/null || true

# Clear application cache
echo "🗑️  Clearing application cache..."
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .next/cache 2>/dev/null || true
rm -rf dist/cache 2>/dev/null || true
rm -rf tmp/cache 2>/dev/null || true

# Clean volumes if requested
if [ "$CLEAN_VOLUMES" = true ]; then
    echo "🗑️  Removing existing data volumes..."
    $DOCKER_COMPOSE down -v 2>/dev/null || true
fi

# Build and start services
echo "🔨 Building and starting services..."
if [ "$ADMIN_MODE" = true ]; then
    echo "   - Starting with admin tools (pgAdmin + Redis Commander)"
    $DOCKER_COMPOSE --profile admin up --build -d
else
    echo "   - Starting core services (PostgreSQL + Redis + App)"
    $DOCKER_COMPOSE up --build -d postgres redis app
fi

# Wait for services to be ready with better health checks
echo "⏳ Waiting for services to start..."

# Wait for PostgreSQL
echo "   - Waiting for PostgreSQL..."
timeout 60 bash -c "until $DOCKER_COMPOSE exec postgres pg_isready -U postgres 2>/dev/null; do sleep 2; done" || {
    echo "❌ PostgreSQL health check failed after 60s"
    echo "📋 PostgreSQL logs:"
    $DOCKER_COMPOSE logs postgres --tail=10
    echo "ℹ️  Trying direct connection test..."
    if $DOCKER_COMPOSE exec postgres psql -U postgres -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ PostgreSQL is actually working, continuing..."
    else
        echo "❌ PostgreSQL is truly not ready"
        exit 1
    fi
}

echo "   - Initializing database schema..."
if $DOCKER_COMPOSE exec postgres psql -U postgres -c "SELECT 1 FROM information_schema.tables WHERE table_name = 'overlay_storage_index';" | grep -q "1 row"; then
  echo "     Database schema already exists, skipping initialization"
else
  echo "     Installing complete PostgreSQL schema..."
  $DOCKER_COMPOSE exec -T postgres psql -U postgres < src/db/postgresql-schema-complete.sql || {
    echo "❌ Failed to initialize database schema"
    exit 1
  }
  echo "     ✅ Database schema initialized successfully"
fi

# Wait for Redis
echo "   - Waiting for Redis..."
timeout 30 bash -c "until $DOCKER_COMPOSE exec redis redis-cli ping 2>/dev/null | grep -q PONG; do sleep 2; done" || {
    echo "❌ Redis health check failed after 30s"
    echo "📋 Redis logs:"
    $DOCKER_COMPOSE logs redis --tail=10
    echo "ℹ️  Trying direct connection test..."
    if $DOCKER_COMPOSE exec redis redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "✅ Redis is actually working, continuing..."
    else
        echo "❌ Redis is truly not ready"
        exit 1
    fi
}

# Wait for Application
echo "   - Waiting for application..."
timeout 120 bash -c 'until curl -sf http://localhost:8788/health > /dev/null; do sleep 3; done' || {
    echo "❌ Application failed to start"
    echo "📋 Application logs:"
    $DOCKER_COMPOSE logs app --tail=20
    exit 1
}

echo "✅ All services are ready!"

# Test the application
echo ""
echo "🧪 Testing API endpoints..."
echo "• Health Check: $(curl -s http://localhost:8788/health | jq -r '.status' 2>/dev/null || echo 'OK')"

# Test overlay endpoints if available
if curl -s http://localhost:8788/overlay/status > /dev/null 2>&1; then
    OVERLAY_STATUS=$(curl -s http://localhost:8788/overlay/status | jq -r '.enabled' 2>/dev/null || echo 'unknown')
    echo "• Overlay Network: $OVERLAY_STATUS"
fi

# Test market data
MARKET_COUNT=$(curl -s "http://localhost:8788/v1/search" 2>/dev/null | grep -o '"versionId"' | wc -l || echo "0")
echo "• Market Datasets: $MARKET_COUNT available"

echo ""
echo "🎉 BSV OVERLAY NETWORK IS READY!"
echo "================================="
echo "🌐 Main Application:      http://localhost:8788"
echo "🔍 Health Check:          http://localhost:8788/health"
echo "🌊 Overlay Status:        http://localhost:8788/overlay/status"
echo "📊 Market API:            http://localhost:8788/v1/search"
echo "💾 Database:              localhost:5432 (postgres/password)"
echo "🔄 Redis:                 localhost:6379"

if [ "$ADMIN_MODE" = true ]; then
    echo ""
    echo "🛠️ Admin Tools:"
    echo "📊 pgAdmin:               http://localhost:8080 (admin@gitdata.dev/admin)"
    echo "🔄 Redis Commander:       http://localhost:8081 (admin/admin)"
fi

echo ""
echo "💡 Useful commands:"
echo "   - View logs:           $DOCKER_COMPOSE logs -f app"
echo "   - Stop services:       $DOCKER_COMPOSE down"
echo "   - Stop + clean:        $DOCKER_COMPOSE down -v"
echo "   - Restart app:         $DOCKER_COMPOSE restart app"
echo "   - Run API tests:       npm run postman:overlay"
echo ""
echo "📚 Use Postman collection: postman/BSV-Overlay-Network-API.postman_collection.json"