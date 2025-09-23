#!/bin/bash

echo "🚀 Starting BSV Overlay Network Application"
echo "==========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

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

# Clean up existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true

# Clean volumes if requested
if [ "$CLEAN_VOLUMES" = true ]; then
    echo "🗑️  Removing existing data volumes..."
    docker-compose down -v 2>/dev/null || true
fi

# Build and start services
echo "🔨 Building and starting services..."
if [ "$ADMIN_MODE" = true ]; then
    echo "   - Starting with admin tools (pgAdmin + Redis Commander)"
    docker-compose --profile admin up --build -d
else
    echo "   - Starting core services (PostgreSQL + Redis + App)"
    docker-compose up --build -d postgres redis app
fi

# Wait for services to be ready with better health checks
echo "⏳ Waiting for services to start..."

# Wait for PostgreSQL
echo "   - Waiting for PostgreSQL..."
timeout 60 bash -c 'until docker-compose exec postgres pg_isready -U postgres; do sleep 2; done' || {
    echo "❌ PostgreSQL failed to start"
    exit 1
}

# Wait for Redis
echo "   - Waiting for Redis..."
timeout 30 bash -c 'until docker-compose exec redis redis-cli ping | grep -q PONG; do sleep 2; done' || {
    echo "❌ Redis failed to start"
    exit 1
}

# Wait for Application
echo "   - Waiting for application..."
timeout 120 bash -c 'until curl -sf http://localhost:8788/health > /dev/null; do sleep 3; done' || {
    echo "❌ Application failed to start"
    echo "📋 Application logs:"
    docker-compose logs app --tail=20
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
echo "   - View logs:           docker-compose logs -f app"
echo "   - Stop services:       docker-compose down"
echo "   - Stop + clean:        docker-compose down -v"
echo "   - Restart app:         docker-compose restart app"
echo "   - Run API tests:       npm run postman:overlay"
echo ""
echo "📚 Use Postman collection: postman/BSV-Overlay-Network-API.postman_collection.json"