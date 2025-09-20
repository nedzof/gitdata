# Pure PostgreSQL/Redis Hybrid Database Implementation

## Overview

This implementation provides a modern, production-ready PostgreSQL/Redis hybrid database architecture following D011HR and D022HR specifications. This is a **pure implementation** with no legacy SQLite dependencies.

## Architecture

### Core Components

- **PostgreSQL**: Source of truth for all persistent data
  - ACID compliance for critical operations
  - Complex queries and reporting
  - Audit trails and lineage events

- **Redis**: High-performance cache layer
  - Cache-aside pattern implementation
  - OpenLineage graph caching
  - Session and real-time data
  - Bundle caching (D011HR)

### Key Features

✅ **Cache-Aside Pattern**: Automatic cache warming and invalidation
✅ **TTL Management**: Configurable cache lifetimes
✅ **Health Monitoring**: Comprehensive health checks
✅ **Performance Optimized**: Sub-100ms response times
✅ **Production Ready**: Connection pooling, error handling

## Quick Start

### 1. Prerequisites

Ensure you have PostgreSQL and Redis running:

```bash
# PostgreSQL
createdb overlay

# Redis
redis-server
```

### 2. Configuration

Copy and configure environment:

```bash
cp .env.example .env
# Edit .env with your database credentials
```

Key environment variables:
```bash
PG_URL=postgres://user:password@localhost:5432/overlay
REDIS_URL=redis://localhost:6379/0
USE_REDIS_BUNDLES=true
```

### 3. Database Setup

Initialize the database schema:

```bash
npm run setup:database
```

### 4. Start Application

```bash
npm start
# or for development
npm run dev
```

### 5. Verify Setup

Check health endpoints:
- `GET /health` - Overall system health
- `GET /health/db` - Database-specific health

## Performance Benefits

### Cache Hit Scenarios
- **Asset lookups**: ~5-50ms (vs 50-200ms database-only)
- **Catalog searches**: ~3-30ms (vs 100-500ms)
- **Bundle assembly**: ~10-100ms (vs 200-2000ms)

### Expected Metrics
- Cache hit ratio: 80-95%
- P95 response time: <200ms
- Database load reduction: 60-80%

## Configuration

### Cache TTL Settings

Default TTL values (in milliseconds):
```json
{
  "headers": 60000,      // 1 minute - SPV headers
  "bundles": 60000,      // 1 minute - Bundle cache
  "assets": 300000,      // 5 minutes - Asset metadata
  "listings": 180000,    // 3 minutes - Search results
  "lineage": 120000,     // 2 minutes - Lineage graphs
  "sessions": 1800000,   // 30 minutes - User sessions
  "policies": 600000,    // 10 minutes - Policy docs
  "prices": 120000       // 2 minutes - Price data
}
```

Configure via `CACHE_TTLS_JSON` environment variable.

### Database Connection Pooling

```bash
PG_POOL_MIN=2          # Minimum connections
PG_POOL_MAX=20         # Maximum connections
```

## API Endpoints

### Health & Monitoring
- `GET /health` - System health status
- `GET /health/db` - Database health details

### Core APIs
- `GET /listings` - Cached catalog search
- `GET /listings/:versionId` - Cached asset details
- `GET /bundle?versionId=...` - Cached bundle assembly
- `GET /ready?versionId=...` - SPV verification

### Cache Headers
Successful responses include cache control headers:
- Assets: `Cache-Control: public, max-age=300`
- Listings: `Cache-Control: public, max-age=120`

## Development

### Database Schema

The PostgreSQL schema includes:
- `producers` - Producer registry
- `assets` - Asset metadata (replaces manifests)
- `policies` - Policy documents
- `receipts` - Payment receipts
- `lineage_event_audit` - OpenLineage events

### Redis Keyspace

Cache keys follow D022HR conventions:
- `cache:asset:<versionId>` - Asset metadata
- `cache:listings:<params>` - Search results
- `ol:cache:lineage:<params>` - Lineage graphs
- `bundle:<versionId>:<depth>` - Bundle cache

### Testing

```bash
npm run test:hybrid      # Run integration tests
npm run setup:database   # Reset database schema
```

## Monitoring

### Key Metrics to Monitor

1. **Cache Performance**
   - Hit/miss ratios per endpoint
   - Cache invalidation frequency
   - TTL effectiveness

2. **Database Health**
   - Connection pool utilization
   - Query performance
   - Lock contention

3. **Response Times**
   - P50, P95, P99 latencies
   - Cache vs database response times
   - Error rates

### Alerting Thresholds

- Cache hit ratio < 70%
- P95 response time > 500ms
- Database connection pool > 80%
- Redis memory usage > 80%

## Production Deployment

### Scaling Considerations

1. **PostgreSQL**
   - Use read replicas for read-heavy workloads
   - Implement connection pooling (pgBouncer)
   - Monitor slow query log

2. **Redis**
   - Enable persistence (AOF)
   - Configure max memory policy
   - Consider Redis Cluster for high availability

### Security

- Use TLS for database connections
- Implement Redis AUTH
- Network isolation (VPC/security groups)
- Secret management for credentials

## Troubleshooting

### Common Issues

1. **Cache Misses**
   - Check TTL configurations
   - Verify Redis connectivity
   - Monitor cache invalidation patterns

2. **Slow Queries**
   - Review PostgreSQL slow query log
   - Check index usage
   - Optimize cache warming strategies

3. **Connection Errors**
   - Verify database credentials
   - Check connection pool settings
   - Monitor network connectivity

### Debug Commands

```bash
# Check database connectivity
npm run setup:database

# Monitor Redis
redis-cli monitor

# Check PostgreSQL connections
psql -c "SELECT * FROM pg_stat_activity;"
```

## Migration from Legacy Systems

If migrating from an SQLite-based system:

1. Export existing data to SQL format
2. Transform schema to PostgreSQL-compatible format
3. Import data using `psql` or `pg_restore`
4. Warm Redis caches with frequently accessed data
5. Monitor performance and tune TTL values

## Contributing

When adding new features:

1. Use the hybrid database interface (`getHybridDatabase()`)
2. Implement cache-aside pattern for read operations
3. Include cache invalidation for write operations
4. Add appropriate TTL values
5. Include health checks for new components

---

**Note**: This is a pure PostgreSQL/Redis implementation. Legacy SQLite compatibility has been completely removed for optimal performance and maintainability.