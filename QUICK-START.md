# BSV Overlay Network - Quick Start Guide

🎉 **Your BSV Overlay Network application is now running!**

## 🚀 Application URLs

- **Main Application**: http://localhost:8788
- **Health Check**: http://localhost:8788/health
- **Database**: localhost:5432 (postgres/password)
- **Redis Cache**: localhost:6379

## 📋 How to Start the Application

### Simple Start (Recommended)
```bash
./run-app.sh
```

### Start with Admin Tools
```bash
./run-app.sh --admin
```
This adds:
- **pgAdmin**: http://localhost:8080 (admin@gitdata.dev/admin)
- **Redis Commander**: http://localhost:8081 (admin/admin)

### Clean Start (Fresh Database)
```bash
./run-app.sh --clean
```

### Get Help
```bash
./run-app.sh --help
```

## 🛠️ Available Commands

### Application Management
```bash
# View application logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Stop and remove data volumes
docker-compose down -v

# Restart just the app
docker-compose restart app

# Check service status
docker-compose ps
```

### Database Access
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d overlay

# List all tables
docker-compose exec postgres psql -U postgres -d overlay -c "\dt"

# Check a specific table
docker-compose exec postgres psql -U postgres -d overlay -c "SELECT * FROM overlay_agents LIMIT 5;"
```

### Redis Access
```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Check Redis info
docker-compose exec redis redis-cli info
```

## 🧪 Testing the API

### Test Health Endpoint
```bash
curl http://localhost:8788/health | jq
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-09-23T14:21:03.183Z",
  "database": "postgresql:ok",
  "cache": "redis:ok"
}
```

### Run Comprehensive API Tests
```bash
# Install Newman if not already installed
npm install -g newman

# Run overlay API tests
npm run postman:overlay

# Run BRC standards tests
npm run postman:brc

# Run agent marketplace tests
npm run postman:agents
```

## 📊 Database Schema

Your database includes these overlay network tables:
- `overlay_agents` - Agent registry
- `overlay_jobs` - Job orchestration
- `overlay_receipts` - Payment receipts
- `overlay_rules` - Automation rules
- `overlay_storage_index` - Content storage
- `agents` - Agent definitions
- `jobs` - Job execution
- `assets` - Data assets
- And many more!

## 🌐 Web Interface

Open your browser to http://localhost:8788 to access the web interface.

## 🤖 Agent Marketplace

The application includes a complete agent marketplace with:
- Agent registration and discovery
- BRC-88 SHIP/SLAP integration
- Automated job orchestration
- Performance tracking
- Reputation scoring

## 🔧 Troubleshooting

### Application Won't Start
1. **Check Docker is running**: `docker info`
2. **Check logs**: `docker-compose logs app`
3. **Clean restart**: `./run-app.sh --clean`

### Database Connection Issues
1. **Check PostgreSQL**: `docker-compose exec postgres pg_isready -U postgres`
2. **Restart database**: `docker-compose restart postgres`

### Port Conflicts
If port 8788 is already in use:
1. Stop other services using that port
2. Or modify `docker-compose.yml` to use different ports

### Performance Issues
1. **Check system resources**: `docker stats`
2. **View detailed logs**: `docker-compose logs -f`

## 📚 API Documentation

### Postman Collections
- **Main Collection**: `postman/BSV-Overlay-Network-API.postman_collection.json`
- **Environment**: `postman/BSV-Overlay-Network.postman_environment.json`

### Key API Endpoints
- `GET /health` - System health
- `GET /v1/search` - Search data assets
- `POST /overlay/agents/register` - Register new agent
- `GET /overlay/agents/search` - Search for agents
- `POST /overlay/rules` - Create automation rules

## 🚀 What's Next?

1. **Explore the web interface** at http://localhost:8788
2. **Run API tests** with `npm run postman:overlay`
3. **Register test agents** using the Postman collection
4. **Create automation rules** for agent coordination
5. **Explore the database** with pgAdmin (if started with `--admin`)

## 📞 Need Help?

- **Application logs**: `docker-compose logs -f app`
- **Database shell**: `docker-compose exec postgres psql -U postgres -d overlay`
- **Redis shell**: `docker-compose exec redis redis-cli`
- **Full documentation**: See `/postman/README.md`

**🎉 Your BSV Overlay Network is ready for development and testing!**