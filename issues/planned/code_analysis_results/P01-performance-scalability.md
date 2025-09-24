# P01: Performance & Scalability Analysis

**Status**: Planned
**Priority**: High
**Component**: Core Infrastructure
**Estimated Effort**: 2-3 weeks

## Executive Summary

This analysis identifies critical performance bottlenecks and scalability concerns in the BSV Overlay Network codebase. The system shows several areas requiring immediate optimization for production deployment and horizontal scaling.

## Key Findings Summary

| Category | Severity | Issues Found | Priority |
|----------|----------|--------------|----------|
| Database Optimization | **HIGH** | 8 | Immediate |
| Memory Management | **MEDIUM** | 5 | High |
| API Performance | **HIGH** | 6 | Immediate |
| Connection Pooling | **MEDIUM** | 3 | High |
| Caching Strategy | **MEDIUM** | 4 | Medium |
| Scaling Readiness | **HIGH** | 7 | High |

## 1. Database Query Optimization and Indexing

### Critical Issues Found

#### 1.1 N+1 Query Problems
**Location**: `/src/routes/streaming.ts:26-33`, `/src/services/streaming-delivery.ts:52-78`
```typescript
// PROBLEMATIC: Separate queries for receipt and policy
const receipt = await getReceipt(receiptId);
const windows = await db.query(`SELECT * FROM quota_usage_windows WHERE receipt_id = $1...`);
```

**Impact**: **HIGH** - Each streaming request triggers 2-3 separate database queries instead of a single JOIN
**Recommendation**: Implement proper JOIN queries with eager loading

#### 1.2 Missing Query Optimization in Hybrid Database
**Location**: `/src/db/hybrid.ts:167-198`
```typescript
// INEFFICIENT: Text search without proper full-text indexing
sql += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex + 1} OR policy_meta::text ILIKE $${paramIndex + 2})`;
```

**Impact**: **HIGH** - ILIKE queries on large datasets without proper indexing cause table scans
**Recommendation**: Implement PostgreSQL full-text search with GIN indexes

#### 1.3 Redundant Database Connections
**Location**: `/src/services/streaming-delivery.ts:11-17`, `/src/middleware/quota-enforcement.ts:10-16`
```typescript
// PROBLEMATIC: Multiple Pool instances instead of singleton
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  // ... duplicated in multiple files
});
```

**Impact**: **MEDIUM** - Connection pool fragmentation and resource waste
**Recommendation**: Use centralized connection management from `/src/db/postgresql.ts`

### Database Schema Analysis

#### 1.4 Index Coverage Analysis
**Location**: `/src/db/postgresql-schema-complete.sql`

**Well-Indexed Tables** ✅:
- `overlay_receipts`: Comprehensive covering indexes (lines 838-848)
- `streaming_usage`: Good session and content-based indexes (lines 851-859)
- `brc22_utxos`: Proper topic and transaction indexes (lines 1350-1353)

**Under-Indexed Tables** ❌:
- `policy_runs`: Missing composite index on (policy_id, version_id, evaluated_at)
- `quota_usage_windows`: Missing time-range optimized indexes
- `storage_verifications`: Missing composite indexes for verification queries

**Recommended Indexes**:
```sql
-- Policy runs optimization
CREATE INDEX IF NOT EXISTS idx_policy_runs_composite ON policy_runs(policy_id, version_id, evaluated_at DESC);

-- Quota time-window optimization
CREATE INDEX IF NOT EXISTS idx_quota_windows_time_range ON quota_usage_windows(receipt_id, window_type, window_start, window_end);

-- Storage verification optimization
CREATE INDEX IF NOT EXISTS idx_storage_verification_composite ON storage_verifications(content_hash, verification_type, verified_at DESC);
```

## 2. Memory Usage Patterns and Potential Leaks

### Critical Issues Found

#### 2.1 Buffer Accumulation in Streaming
**Location**: `/src/services/streaming-delivery.ts:426-433`
```typescript
// MEMORY LEAK RISK: Accumulating all chunks in memory
const chunks: Buffer[] = [];
for await (const chunk of data) {
  chunks.push(chunk);
}
const buffer = Buffer.concat(chunks);
```

**Impact**: **HIGH** - Large file uploads can cause memory exhaustion
**Recommendation**: Implement streaming uploads without buffer accumulation

#### 2.2 Cache Key Accumulation
**Location**: `/src/cache/brc-cache.ts:34-52`
```typescript
// POTENTIAL LEAK: Pattern deletions without proper cleanup
await redis.delPattern(`${API_CLIENT_PREFIX}*`);
```

**Impact**: **MEDIUM** - Redis pattern operations on large key sets can block event loop
**Recommendation**: Use SCAN-based pattern deletion with yield points

#### 2.3 Event Handler Memory Leaks
**Location**: `/src/routes/data.ts:186-198`
```typescript
// RISK: Error handlers may not clean up properly
data.on('error', (err) => {
  if (!res.headersSent) {
    return json(res, 500, {...});
  }
  try {
    res.end();
  } catch {
    // Ignore res.end() errors
  }
});
```

**Impact**: **MEDIUM** - Stream error handlers don't ensure complete cleanup
**Recommendation**: Implement proper stream lifecycle management

#### 2.4 OpenLineage Cache Growth
**Location**: `/src/db/hybrid.ts:384-443`
```typescript
// UNBOUNDED GROWTH: No cleanup of old lineage data
await this.redis.zadd(CacheKeys.olEventsByTime(namespace), new Date(event.eventTime).getTime(), hash);
```

**Impact**: **MEDIUM** - Lineage events accumulate without TTL or cleanup
**Recommendation**: Implement sliding window cleanup for old events

## 3. API Response Times and Bottlenecks

### Critical Issues Found

#### 3.1 Synchronous File Operations
**Location**: `/src/routes/data.ts:88-98`
```typescript
// BLOCKING: Synchronous storage operations in request handler
const objectExists = await storage.objectExists(contentHash, DATA_DELIVERY_TIER);
const metadata = await storage.headObject(contentHash, DATA_DELIVERY_TIER);
```

**Impact**: **HIGH** - Sequential async operations block request processing
**Recommendation**: Parallelize independent operations using Promise.all()

#### 3.2 Inefficient Streaming Data Path
**Location**: `/src/routes/streaming.ts:92-141`
```typescript
// INEFFICIENT: Multiple database hits per streaming request
const receiptResult = await db.query(`SELECT * FROM overlay_receipts WHERE content_hash = $1...`);
await db.query(`INSERT INTO streaming_usage...`);
```

**Impact**: **HIGH** - 3-4 database round trips per streaming request
**Recommendation**: Batch operations or use stored procedures

#### 3.3 Missing Response Compression
**Location**: Multiple API endpoints
```typescript
// MISSING: No compression middleware for JSON responses
return json(res, 200, {
  items, // Large response objects without compression
  limit,
  offset
});
```

**Impact**: **MEDIUM** - Large API responses without gzip compression increase latency
**Recommendation**: Implement compression middleware for responses >1KB

#### 3.4 Quota Validation Overhead
**Location**: `/src/middleware/quota-enforcement.ts:29-157`
```typescript
// EXPENSIVE: Complex quota calculation on every request
const receiptQuery = `SELECT r.*, qp.* FROM overlay_receipts r LEFT JOIN quota_policies qp...`;
const usageQuery = `SELECT bytes_used, requests_used FROM quota_usage_windows...`;
```

**Impact**: **HIGH** - Quota enforcement requires 2-3 database queries per protected request
**Recommendation**: Cache quota status with short TTL (30-60 seconds)

## 4. Connection Pooling and Resource Management

### Issues Found

#### 4.1 Fragmented Connection Pools
**Locations**:
- `/src/db/postgresql.ts:19-24` (Main pool: 2-20 connections)
- `/src/services/streaming-delivery.ts:11-17` (Duplicate pool)
- `/src/middleware/quota-enforcement.ts:10-16` (Duplicate pool)

**Impact**: **MEDIUM** - Multiple pools compete for database connections
**Configuration Analysis**:
```typescript
// Current configuration
min: 2, max: 20  // Per pool instance
// With 3 pools = 6-60 total connections (inefficient)
```

**Recommendation**: Centralize to single pool with optimized sizing:
```typescript
min: 5, max: 50  // Single pool for entire application
```

#### 4.2 Redis Connection Management
**Location**: `/src/db/redis.ts:346-365`
```typescript
// GOOD: Singleton pattern implemented correctly
let redisClient: RedisClient | null = null;
export function getRedisClient(): RedisClient {
  if (!redisClient) {
    redisClient = new RedisClient(config);
  }
  return redisClient;
}
```

**Impact**: **LOW** - Redis connection management is well implemented
**Status**: ✅ **No issues found**

#### 4.3 File System Resource Leaks
**Location**: `/src/storage/index.ts:228-235`
```typescript
// RISK: Stream error handling might not close file descriptors
const writeStream = createWriteStream(filePath);
return new Promise((resolve, reject) => {
  data.pipe(writeStream);
  writeStream.on('finish', resolve);
  writeStream.on('error', reject); // May not close stream properly
});
```

**Impact**: **MEDIUM** - File descriptor leaks on stream errors
**Recommendation**: Add explicit cleanup in error handlers

## 5. Caching Strategies and Effectiveness

### Current Implementation Analysis

#### 5.1 Cache-Aside Pattern Implementation
**Location**: `/src/db/hybrid.ts:38-59`
```typescript
// GOOD: Proper cache-aside implementation
private async getFromCacheOrDb<T>(
  cacheKey: string,
  dbQuery: () => Promise<T>,
  ttlSeconds: number,
): Promise<T> {
  const cached = await this.redis.get<T>(cacheKey);
  if (cached !== null) return cached;

  const data = await dbQuery();
  if (data !== null && data !== undefined) {
    await this.redis.set(cacheKey, data, ttlSeconds);
  }
  return data;
}
```

**Impact**: **POSITIVE** - Well-implemented caching pattern
**Status**: ✅ **Good implementation**

#### 5.2 Cache TTL Configuration
**Location**: `/src/db/redis.ts:268-294`
```typescript
// Current TTL settings (seconds)
assets: 300,     // 5 minutes - GOOD
listings: 180,   // 3 minutes - GOOD
lineage: 120,    // 2 minutes - TOO SHORT
sessions: 1800,  // 30 minutes - GOOD
policies: 600,   // 10 minutes - GOOD
prices: 120      // 2 minutes - TOO SHORT
```

**Issues**:
- Lineage queries are expensive but cached for only 2 minutes
- Price data changes infrequently but has short TTL

**Recommendations**:
```typescript
lineage: 600,    // 10 minutes (lineage rarely changes)
prices: 300,     // 5 minutes (prices are semi-static)
```

#### 5.3 Missing Cache Invalidation Strategy
**Location**: `/src/cache/brc-cache.ts`

**Problems**:
- No selective cache invalidation (uses pattern deletion)
- Missing cache warming strategies
- No cache hit/miss metrics

**Recommendation**: Implement tag-based invalidation system

#### 5.4 BRC Method Caching Analysis
**Location**: `/src/cache/brc-cache.ts:66-118`
```typescript
// GOOD: TTL-based expiration with automatic cleanup
if (cached && cached.expiresAt > Date.now()) {
  return cached;
}
// Remove expired entry
if (cached) {
  await redis.del(key);
}
```

**Status**: ✅ **Good implementation with automatic cleanup**

## 6. Horizontal Scaling Readiness

### Critical Scalability Issues

#### 6.1 Shared State in Memory
**Location**: `/src/middleware/limits.ts:37-57`
```typescript
// NOT SCALABLE: In-memory rate limiting state
const buckets = new Map<string, Bucket>();

function takeToken(key: string, capacity: number): boolean {
  let b = buckets.get(key);
  // State lost on restart, not shared across instances
}
```

**Impact**: **HIGH** - Rate limiting doesn't work across multiple instances
**Recommendation**: Move rate limiting to Redis with sliding window algorithm

#### 6.2 Session Affinity Requirements
**Analysis**: Current implementation has several components that would require session affinity:
- In-memory rate limiting (limits.ts)
- File system storage (if not using S3)
- Local worker state (agents/worker.ts)

**Impact**: **HIGH** - Cannot scale horizontally without sticky sessions
**Recommendation**: Eliminate all local state dependencies

#### 6.3 Database Connection Scaling
**Current Configuration Analysis**:
```typescript
// Per instance: 2-20 connections
// With 10 instances: 20-200 total connections
// PostgreSQL default max_connections: 100 ❌
```

**Impact**: **HIGH** - Cannot scale beyond 5 instances without hitting connection limits
**Recommendation**:
- Implement connection pooling proxy (PgBouncer)
- Reduce per-instance connection limits
- Optimize query efficiency to reduce connection hold time

#### 6.4 File System Dependencies
**Location**: Multiple locations using local file system
```typescript
// NOT SCALABLE: Local file system usage
const DATA_ROOT = process.env.DATA_ROOT || path.resolve(process.cwd(), 'data', 'blobs');
```

**Impact**: **HIGH** - Cannot scale horizontally with local file storage
**Status**: ✅ **Mitigated by S3 storage backend implementation**

### Scaling Architecture Recommendations

#### Load Balancer Configuration
```yaml
# Recommended setup
Load Balancer (NGINX/HAProxy)
├── App Instance 1 (connections: 5-15)
├── App Instance 2 (connections: 5-15)
├── App Instance N (connections: 5-15)
├── Redis Cluster (3 masters, 3 replicas)
└── PostgreSQL Primary + Read Replicas
```

#### Environment Variables for Scaling
```bash
# Connection limits per instance
PG_POOL_MIN=5
PG_POOL_MAX=15

# Redis cluster mode
REDIS_CLUSTER_NODES=redis1:6379,redis2:6379,redis3:6379

# Distributed rate limiting
RATE_LIMIT_BACKEND=redis
RATE_LIMIT_KEY_PREFIX=app_instance_${HOSTNAME}

# Storage backend
STORAGE_BACKEND=s3
```

## Implementation Plan

### Phase 1: Critical Performance Issues (Week 1)
**Priority**: Immediate

1. **Database Query Optimization**
   - [ ] Fix N+1 queries in streaming routes
   - [ ] Implement proper JOIN queries in hybrid database
   - [ ] Add missing composite indexes
   - [ ] Centralize connection pool management

2. **Memory Leak Prevention**
   - [ ] Fix buffer accumulation in streaming uploads
   - [ ] Implement proper stream cleanup
   - [ ] Add TTL to lineage cache entries

### Phase 2: Scalability Preparation (Week 2)
**Priority**: High

3. **Remove Scaling Blockers**
   - [ ] Move rate limiting to Redis
   - [ ] Eliminate in-memory shared state
   - [ ] Optimize connection pool sizing
   - [ ] Implement Redis-based session storage

4. **API Response Optimization**
   - [ ] Add response compression middleware
   - [ ] Parallelize independent async operations
   - [ ] Implement quota status caching
   - [ ] Optimize streaming data path

### Phase 3: Advanced Optimizations (Week 3)
**Priority**: Medium

5. **Caching Strategy Enhancement**
   - [ ] Implement tag-based cache invalidation
   - [ ] Optimize TTL settings based on data access patterns
   - [ ] Add cache warming for critical data
   - [ ] Implement cache hit/miss metrics

6. **Monitoring and Observability**
   - [ ] Add database query performance metrics
   - [ ] Implement connection pool monitoring
   - [ ] Add Redis cache performance metrics
   - [ ] Create scaling readiness dashboard

## Acceptance Criteria

### Performance Targets
- [ ] API response times <200ms (95th percentile)
- [ ] Database query response times <50ms (95th percentile)
- [ ] Memory usage <500MB per instance under normal load
- [ ] Cache hit ratio >80% for frequently accessed data

### Scalability Targets
- [ ] Support 10+ concurrent instances without session affinity
- [ ] Handle 1000+ concurrent streaming connections
- [ ] Database connection efficiency >95% (minimal idle connections)
- [ ] Redis memory usage <2GB for caching layer

### Reliability Targets
- [ ] Zero memory leaks under sustained load
- [ ] Graceful degradation when cache is unavailable
- [ ] Connection pool exhaustion protection
- [ ] Automatic cleanup of expired resources

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|------------|
| Database connection exhaustion | HIGH | HIGH | Connection pooling proxy, query optimization |
| Memory leaks in production | MEDIUM | HIGH | Thorough testing, monitoring, automatic restart |
| Cache stampede on popular content | MEDIUM | MEDIUM | Cache warming, distributed locking |
| File descriptor exhaustion | LOW | HIGH | Proper stream cleanup, monitoring |

## Resource Requirements

**Development Time**: 2-3 weeks (1 senior developer)
**Testing Requirements**: Load testing with 1000+ concurrent users
**Infrastructure**: Development/staging environment matching production scale
**Dependencies**: None (all fixes within existing codebase)

---

**Next Steps**: Prioritize Phase 1 critical performance issues for immediate implementation. Database query optimization and memory leak prevention should be addressed before production deployment.