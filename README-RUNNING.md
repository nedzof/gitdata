# Gitdata Docker Setup & Running Guide

## 🚀 Quick Start - How This Application Was Started

This application is dockerized and running with the following services. Here are the **exact commands used** to start everything:

### Step 1: Create Docker Network
```bash
docker network create gitdata-network
```

### Step 2: Start PostgreSQL Database
```bash
docker run -d \
  --name gitdata-postgres \
  --network gitdata-network \
  -e POSTGRES_DB=overlay \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine
```

### Step 3: Start Redis Cache
```bash
docker run -d \
  --name gitdata-redis \
  --network gitdata-network \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### Step 4: Build Application Image
```bash
docker build -t gitdata-app .
```

### Step 5: Start Main Application
```bash
docker run -d \
  --name gitdata-app \
  --network gitdata-network \
  -p 8788:8788 \
  -e NODE_ENV=production \
  -e PORT=8788 \
  -e PG_HOST=gitdata-postgres \
  -e PG_PORT=5432 \
  -e PG_DATABASE=overlay \
  -e PG_USER=postgres \
  -e PG_PASSWORD=password \
  -e REDIS_URL=redis://gitdata-redis:6379 \
  -e USE_REDIS_BUNDLES=true \
  -v app_data:/app/data \
  -v app_logs:/app/logs \
  gitdata-app
```

### Step 6: Start Admin Tools (Optional)
```bash
# pgAdmin for database management
docker run -d \
  --name gitdata-pgadmin \
  --network gitdata-network \
  -p 8080:80 \
  -e PGADMIN_DEFAULT_EMAIL=admin@gitdata.dev \
  -e PGADMIN_DEFAULT_PASSWORD=admin \
  -e PGADMIN_CONFIG_SERVER_MODE=False \
  dpage/pgadmin4:latest

# Redis Commander for cache management
docker run -d \
  --name gitdata-redis-commander \
  --network gitdata-network \
  -p 8081:8081 \
  -e REDIS_HOSTS=redis:gitdata-redis:6379 \
  -e HTTP_USER=admin \
  -e HTTP_PASSWORD=admin \
  rediscommander/redis-commander:latest
```

---

## 🌐 **Live Service Endpoints**

### Main Application
- **🔗 URL**: http://localhost:8788
- **📊 Health**: http://localhost:8788/health
- **✅ Ready**: http://localhost:8788/ready
- **📖 API Root**: http://localhost:8788/

### Database & Cache
- **🗄️ PostgreSQL**: localhost:5432
  - Database: `overlay`
  - Username: `postgres`
  - Password: `password`
- **🚀 Redis**: localhost:6379

### Admin Tools
- **🔧 pgAdmin**: http://localhost:8080
  - Login: `admin@gitdata.dev` / `admin`
  - Use to manage PostgreSQL database
- **📊 Redis Commander**: http://localhost:8081
  - Login: `admin` / `admin`
  - Use to monitor Redis cache

---

## 🐳 **Container Status**

| Container | Status | Purpose | Port |
|-----------|--------|---------|------|
| `gitdata-app` | ✅ Healthy | Main Application | 8788 |
| `gitdata-postgres` | ✅ Running | Database | 5432 |
| `gitdata-redis` | ✅ Running | Cache | 6379 |
| `gitdata-pgadmin` | ✅ Running | DB Admin | 8080 |
| `gitdata-redis-commander` | ✅ Running | Cache Admin | 8081 |

---

## 🛠️ **Management Commands**

### Monitoring & Logs
```bash
# View application logs (real-time)
docker logs gitdata-app -f

# View all container status
docker ps | grep gitdata

# Check application health
curl http://localhost:8788/health
```

### Database Operations
```bash
# Connect to PostgreSQL
docker exec -it gitdata-postgres psql -U postgres -d overlay

# Run a query
docker exec gitdata-postgres psql -U postgres -d overlay -c "SELECT version();"

# View database schema
docker exec gitdata-postgres psql -U postgres -d overlay -c "\dt"
```

### Cache Operations
```bash
# Connect to Redis CLI
docker exec -it gitdata-redis redis-cli

# Check Redis info
docker exec gitdata-redis redis-cli info

# View cached keys
docker exec gitdata-redis redis-cli keys "*"
```

### Container Management
```bash
# Restart just the application
docker restart gitdata-app

# Restart all services
docker restart gitdata-app gitdata-postgres gitdata-redis

# Stop all services
docker stop gitdata-app gitdata-postgres gitdata-redis gitdata-pgadmin gitdata-redis-commander

# Start all services (if stopped)
docker start gitdata-postgres gitdata-redis gitdata-app gitdata-pgadmin gitdata-redis-commander

# Remove all containers (⚠️ Data will be lost)
docker rm gitdata-app gitdata-postgres gitdata-redis gitdata-pgadmin gitdata-redis-commander
```

---

## 📊 **Testing the Application**

### Health Checks
```bash
# Basic health check
curl http://localhost:8788/health

# Readiness check
curl http://localhost:8788/ready

# Application info
curl http://localhost:8788/
```

### Database Connectivity
```bash
# Test from application container
docker exec gitdata-app node -e "
const pg = require('pg');
const client = new pg.Client({
  host: 'gitdata-postgres',
  port: 5432,
  database: 'overlay',
  user: 'postgres',
  password: 'password'
});
client.connect().then(() => console.log('✅ Connected')).catch(console.error);
"
```

### Cache Connectivity
```bash
# Test Redis connection
docker exec gitdata-app node -e "
const redis = require('redis');
const client = redis.createClient({url: 'redis://gitdata-redis:6379'});
client.connect().then(() => console.log('✅ Connected')).catch(console.error);
"
```

---

## 🔧 **Configuration Details**

### Environment Variables
The application is running with these environment variables:
```bash
NODE_ENV=production
PORT=8788
PG_HOST=gitdata-postgres
PG_PORT=5432
PG_DATABASE=overlay
PG_USER=postgres
PG_PASSWORD=password
REDIS_URL=redis://gitdata-redis:6379
USE_REDIS_BUNDLES=true
```

### Network Configuration
- **Network**: `gitdata-network` (bridge)
- **Service Discovery**: Containers communicate by name
- **Port Mapping**: Host ports mapped to container ports

### Data Persistence
- **PostgreSQL**: Data stored in Docker volume
- **Redis**: AOF persistence enabled
- **Application**: Logs accessible via `docker logs`

---

## 📈 **Next Steps**

### Development
1. **Make Code Changes**: Edit files locally
2. **Rebuild Image**: `docker build -t gitdata-app .`
3. **Restart Container**: `docker restart gitdata-app`

## 🚀 **Alternative Deployment Methods**

### Using Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# With admin tools
docker-compose --profile admin up -d

# Development environment
docker-compose -f docker-compose.dev.yml up -d
```

### Production Deployment
1. **Use Docker Compose**: See `docker-compose.yml`
2. **Environment Variables**: Set production values
3. **SSL/TLS**: Add reverse proxy (nginx, traefik)
4. **Monitoring**: Add logging and metrics collection

### Database Setup
1. **Schema**: Already initialized with `postgresql-schema.sql`
2. **Migrations**: Run additional migrations as needed
3. **Data**: Populate with your application data

## 🔧 **Stop & Restart Commands**

### Stop All Services
```bash
docker stop gitdata-app gitdata-postgres gitdata-redis gitdata-pgadmin gitdata-redis-commander
```

### Start All Services (if stopped)
```bash
docker start gitdata-postgres gitdata-redis gitdata-app gitdata-pgadmin gitdata-redis-commander
```

### Complete Cleanup (removes all data)
```bash
docker stop gitdata-app gitdata-postgres gitdata-redis gitdata-pgadmin gitdata-redis-commander
docker rm gitdata-app gitdata-postgres gitdata-redis gitdata-pgadmin gitdata-redis-commander
docker volume rm postgres_data redis_data app_data app_logs
docker network rm gitdata-network
```

---

## ⚠️ **Important Notes**

- **Default Passwords**: Change in production
- **Data Persistence**: Currently using Docker volumes
- **Network Security**: All containers on same network
- **Health Checks**: Enabled and working
- **Logs**: Available via `docker logs <container-name>`

---

## 🆘 **Troubleshooting**

### Application Won't Start
```bash
# Check logs
docker logs gitdata-app

# Verify dependencies
docker ps | grep gitdata-postgres
docker ps | grep gitdata-redis
```

### Database Connection Issues
```bash
# Test PostgreSQL
docker exec gitdata-postgres pg_isready -U postgres

# Check network
docker network inspect gitdata-network
```

### Cache Connection Issues
```bash
# Test Redis
docker exec gitdata-redis redis-cli ping

# Check Redis logs
docker logs gitdata-redis
```

### Port Conflicts
```bash
# Check what's using ports
netstat -tulpn | grep :8788
netstat -tulpn | grep :5432
netstat -tulpn | grep :6379
```

---

**🎉 Your Gitdata application is live and ready to use!**

Visit http://localhost:8788 to start using your data lineage and overlay platform.