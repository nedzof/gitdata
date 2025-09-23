# Docker Setup for Gitdata

This document explains how to run the Gitdata overlay application using Docker.

## Quick Start

### Production Deployment

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Access the application:**
   - Main API: http://localhost:8788
   - Health check: http://localhost:8788/health

3. **Optional: Start admin tools:**
   ```bash
   docker-compose --profile admin up -d
   ```
   - pgAdmin: http://localhost:8080 (admin@gitdata.dev / admin)
   - Redis Commander: http://localhost:8081 (admin / admin)

### Development Environment

1. **Start development environment:**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Watch logs:**
   ```bash
   docker-compose -f docker-compose.dev.yml logs -f app
   ```

## Services

### Core Services
- **app**: Main Gitdata application (port 8788)
- **postgres**: PostgreSQL database (port 5432)
- **redis**: Redis cache (port 6379)

### Admin Tools (optional)
- **pgadmin**: Database management UI (port 8080)
- **redis-commander**: Redis management UI (port 8081)

## Environment Configuration

### Default Configuration
The application uses the following default environment variables in Docker:

```bash
# Database
PG_HOST=postgres
PG_PORT=5432
PG_DATABASE=overlay
PG_USER=postgres
PG_PASSWORD=password

# Cache
REDIS_URL=redis://redis:6379

# Application
PORT=8788
NODE_ENV=production
USE_REDIS_BUNDLES=true
```

### Custom Configuration
Create a `.env` file to override defaults:

```bash
# Copy example configuration
cp .env.docker .env

# Edit as needed
nano .env
```

## Data Persistence

All data is persisted using Docker volumes:
- `postgres_data`: Database files
- `redis_data`: Cache data
- `app_data`: Application data files
- `app_logs`: Application logs

## Commands

### Basic Operations
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart app only
docker-compose restart app

# Rebuild app
docker-compose up -d --build app
```

### Database Operations
```bash
# Run database migrations
docker-compose exec app npm run setup:database

# Access PostgreSQL shell
docker-compose exec postgres psql -U postgres -d overlay

# Access Redis CLI
docker-compose exec redis redis-cli
```

### Development
```bash
# Development mode with hot reload
docker-compose -f docker-compose.dev.yml up -d

# Run tests
docker-compose exec app npm test

# Run integration tests
docker-compose exec app npm run test:integration

# Access container shell
docker-compose exec app sh
```

### Cleanup
```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in docker-compose.yml if already in use
2. **Permission issues**: Ensure Docker daemon is running and user has permissions
3. **Database connection**: Check if PostgreSQL is healthy: `docker-compose exec postgres pg_isready`
4. **Redis connection**: Check Redis: `docker-compose exec redis redis-cli ping`

### Health Checks
```bash
# Check service health
docker-compose ps

# Check application health
curl http://localhost:8788/health

# Check logs for errors
docker-compose logs app
```

### Reset Everything
```bash
# Complete reset (removes all data)
docker-compose down -v
docker system prune -f
docker-compose up -d --build
```

## Network Configuration

The Docker setup creates an isolated network `gitdata-network` for service communication. Services communicate using their container names:
- App connects to `postgres:5432`
- App connects to `redis:6379`

## Security Notes

- Default passwords are for development only
- Change passwords in production
- Consider using Docker secrets for sensitive data
- The application runs as non-root user `gitdata`

## Monitoring

Health checks are configured for all services:
- PostgreSQL: `pg_isready` check
- Redis: `redis-cli ping` check
- App: HTTP health endpoint check

Use `docker-compose ps` to see health status.