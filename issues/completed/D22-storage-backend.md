# D22 — Storage Backend Architecture ✅ **COMPLETED**

**Status:** ✅ **COMPLETED** (100% Complete)
**Completion Date:** 2025-09-24
**Integration:** Full BSV overlay network storage with BRC-26 UHRP
**Test Coverage:** Comprehensive integration tests implemented


**Labels:** storage, overlay, brc-26, uhrp, distributed-storage, performance
**Assignee:** TBA
**Estimate:** 5-7 PT

## Purpose

Implement a production-ready distributed storage system leveraging BSV overlay network infrastructure with BRC-26 Universal Hash Resolution Protocol (UHRP). This provides scalable, decentralized content storage and delivery while maintaining compatibility with traditional storage backends.

## Dependencies

- **BSV Overlay Services**: Initialized overlay network with BRC-26 UHRP support
- **PostgreSQL Database**: Enhanced storage tracking and overlay metadata tables
- **BRC Standards**: BRC-26 UHRP, BRC-88 SHIP/SLAP for storage advertising, BRC-22 for distributed operations
- **Agent Marketplace**: Storage verification and replication agents
- **Payment System**: Storage payments via overlay network micropayments

## Architecture Overview

### Hybrid Storage Architecture
1. **Local Storage**: PostgreSQL + file system for immediate access
2. **Overlay Network Storage**: BRC-26 UHRP for distributed content resolution
3. **Traditional CDN**: S3-compatible storage with CDN layer
4. **Agent-Based Replication**: Automated content replication via storage agents
5. **Smart Routing**: Intelligent content delivery based on availability and performance

### Storage Flow
```
Upload → Local Storage → Overlay Publishing → Agent Replication → CDN Sync
  ↓           ↓               ↓                    ↓              ↓
Hash      PostgreSQL    BRC-26 UHRP         Storage Agents   S3/CDN
```

## Database Schema Updates

```sql
-- Enhanced storage tracking with overlay integration
CREATE TABLE IF NOT EXISTS overlay_storage_index (
    content_hash TEXT PRIMARY KEY,
    version_id TEXT NOT NULL,
    storage_tier TEXT DEFAULT 'hot', -- hot, warm, cold, overlay
    local_path TEXT,
    overlay_uhrp_url TEXT,
    s3_key TEXT,
    cdn_url TEXT,
    file_size BIGINT NOT NULL,
    mime_type TEXT,
    storage_locations JSONB DEFAULT '[]'::jsonb, -- Array of storage locations
    replication_status JSONB DEFAULT '{}'::jsonb,
    overlay_advertisements TEXT[] DEFAULT ARRAY[]::TEXT[],
    last_verified_at TIMESTAMP,
    verification_agents TEXT[] DEFAULT ARRAY[]::TEXT[],
    access_statistics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (version_id) REFERENCES manifests(version_id)
);

-- Storage verification and integrity tracking
CREATE TABLE IF NOT EXISTS storage_verifications (
    id SERIAL PRIMARY KEY,
    content_hash TEXT NOT NULL,
    verification_type TEXT NOT NULL, -- 'hash', 'availability', 'integrity'
    storage_location TEXT NOT NULL, -- 'local', 'overlay', 's3', 'cdn'
    verification_agent TEXT,
    verification_result BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    error_details JSONB,
    overlay_evidence JSONB,
    verified_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_storage_verification_hash (content_hash, verified_at),
    INDEX idx_storage_verification_agent (verification_agent, verified_at)
);

-- Storage access and download tracking
CREATE TABLE IF NOT EXISTS storage_access_logs (
    id SERIAL PRIMARY KEY,
    content_hash TEXT NOT NULL,
    access_method TEXT NOT NULL, -- 'local', 'uhrp', 'presigned', 'cdn'
    client_id TEXT,
    bytes_transferred BIGINT,
    range_start BIGINT,
    range_end BIGINT,
    response_time_ms INTEGER,
    success BOOLEAN NOT NULL,
    overlay_route JSONB, -- Overlay network routing information
    accessed_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_storage_access_hash (content_hash, accessed_at),
    INDEX idx_storage_access_method (access_method, accessed_at)
);

-- Storage replication coordination
CREATE TABLE IF NOT EXISTS storage_replications (
    id SERIAL PRIMARY KEY,
    content_hash TEXT NOT NULL,
    source_location TEXT NOT NULL,
    target_location TEXT NOT NULL,
    replication_agent TEXT,
    replication_job_id TEXT,
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, failed
    progress_percentage INTEGER DEFAULT 0,
    bytes_replicated BIGINT DEFAULT 0,
    error_message TEXT,
    overlay_job_evidence JSONB,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    INDEX idx_storage_replication_status (status, started_at),
    INDEX idx_storage_replication_agent (replication_agent, started_at)
);
```

## BRC-26 UHRP Integration

### Universal Hash Resolution Protocol Implementation

```typescript
interface UHRPStorageService {
  // Store content with UHRP addressing
  async storeContent(
    content: Buffer,
    metadata: ContentMetadata
  ): Promise<UHRPStorageResult>;

  // Resolve content via UHRP
  async resolveContent(
    contentHash: string,
    options?: UHRPResolveOptions
  ): Promise<UHRPResolution>;

  // Advertise content availability
  async advertiseContent(
    contentHash: string,
    storageCapability: StorageCapability
  ): Promise<UHRPAdvertisement>;

  // Verify content integrity across network
  async verifyContentIntegrity(
    contentHash: string
  ): Promise<IntegrityVerification>;
}

interface UHRPStorageResult {
  contentHash: string;
  uhrpUrl: string;
  localPath: string;
  overlayAdvertisements: string[];
  storageLocations: StorageLocation[];
  verificationAgents: string[];
}

interface UHRPResolution {
  contentHash: string;
  availableLocations: StorageLocation[];
  preferredLocation: StorageLocation;
  integrityVerified: boolean;
  resolutionTime: number;
  overlayRoute: OverlayRoute[];
}
```

### Storage Location Types

```typescript
interface StorageLocation {
  type: 'local' | 'overlay' | 'uhrp' | 's3' | 'cdn';
  url: string;
  availability: number; // 0-1 reliability score
  latency: number; // average response time in ms
  bandwidth: number; // available bandwidth in Mbps
  cost: number; // cost per GB in satoshis
  geographicRegion: string[];
  verifiedAt: string;
  verificationAgent?: string;
}
```

## API Endpoints

### 1. Enhanced Data Access API

**Endpoint:** `GET /overlay/data/{contentHash}`

**Parameters:**
- `preferredMethod` (string): 'local', 'uhrp', 'overlay', 's3', 'cdn', 'auto'
- `range` (string): HTTP Range header for partial content
- `maxLatency` (number): Maximum acceptable latency in ms
- `geographicPreference` (string[]): Preferred geographic regions
- `includeVerification` (boolean): Include integrity verification
- `trackAccess` (boolean): Log access for analytics

**Example Request:**
```bash
curl -X GET "{{BASE}}/overlay/data/sha256:abc123..." \
  -H "Range: bytes=1000-2000" \
  -G \
  -d "preferredMethod=auto" \
  -d "maxLatency=500" \
  -d "geographicPreference=US,EU" \
  -d "includeVerification=true"
```

**Response:**
```json
{
  "contentHash": "sha256:abc123...",
  "resolution": {
    "method": "uhrp",
    "location": {
      "type": "uhrp",
      "url": "uhrp://abc123.../content",
      "availability": 0.98,
      "latency": 120,
      "geographicRegion": ["US"],
      "verifiedAt": "2024-01-15T10:30:00Z"
    },
    "alternatives": [
      {
        "type": "s3",
        "url": "https://presigned.s3.url/abc123...",
        "availability": 0.99,
        "latency": 80
      }
    ]
  },
  "verification": {
    "integrityVerified": true,
    "verificationAgent": "agent_verify_123",
    "verifiedAt": "2024-01-15T10:25:00Z",
    "overlayEvidence": {
      "consensusNodes": 3,
      "agreementRatio": 1.0
    }
  },
  "access": {
    "method": "redirect", // or "stream"
    "url": "uhrp://abc123.../content",
    "headers": {
      "Cache-Control": "public, max-age=3600",
      "Content-Length": "1048576",
      "Content-Type": "application/octet-stream"
    }
  },
  "quotaUsed": 1001, // bytes
  "remainingQuota": 999999
}
```

### 2. Storage Upload API

**Endpoint:** `POST /overlay/storage/upload`

```bash
curl -X POST "{{BASE}}/overlay/storage/upload" \
  -H "Content-Type: multipart/form-data" \
  -H "X-Content-Hash: sha256:abc123..." \
  -H "X-Storage-Tier: hot" \
  -H "X-Replication-Strategy: overlay+s3" \
  -F "file=@large-dataset.zip" \
  -F "metadata={\"classification\":\"commercial\",\"geographicRestrictions\":[]}"
```

**Response:**
```json
{
  "contentHash": "sha256:abc123...",
  "uploadId": "upload_xyz789",
  "storage": {
    "local": {
      "stored": true,
      "path": "/storage/content/abc123...",
      "verifiedAt": "2024-01-15T10:30:00Z"
    },
    "overlay": {
      "uhrpUrl": "uhrp://abc123.../content",
      "advertisements": ["ship_ad_456"],
      "publishedAt": "2024-01-15T10:30:30Z"
    },
    "replication": {
      "jobs": [
        {
          "jobId": "repl_job_789",
          "target": "s3",
          "status": "in_progress",
          "agent": "agent_repl_123"
        }
      ]
    }
  },
  "verification": {
    "hashMatch": true,
    "sizeMatch": true,
    "integrityScore": 1.0
  }
}
```

### 3. Storage Management API

**Endpoint:** `GET /overlay/storage/status/{contentHash}`

```json
{
  "contentHash": "sha256:abc123...",
  "status": {
    "availability": 0.98,
    "replicationCount": 3,
    "storageLocations": ["local", "overlay", "s3"],
    "verificationStatus": "verified",
    "lastVerified": "2024-01-15T12:00:00Z"
  },
  "performance": {
    "averageLatency": 150,
    "bandwidth": 100.5,
    "reliabilityScore": 0.99
  },
  "replication": {
    "targetCount": 3,
    "actualCount": 3,
    "agents": ["agent_repl_123", "agent_repl_456"],
    "lastReplication": "2024-01-15T10:30:00Z"
  },
  "access": {
    "totalDownloads": 45,
    "totalBytes": 4500000000,
    "uniqueClients": 12,
    "geographicDistribution": {
      "US": 30,
      "EU": 12,
      "AS": 3
    }
  }
}
```

## Storage Agent Integration

### Automated Replication Agents

```typescript
class StorageReplicationAgent {
  async replicateContent(
    contentHash: string,
    sourceLocation: StorageLocation,
    targetLocation: StorageLocation
  ): Promise<ReplicationResult> {
    // 1. Verify source content integrity
    const sourceVerification = await this.verifyContentIntegrity(
      contentHash,
      sourceLocation
    );

    if (!sourceVerification.valid) {
      throw new Error('Source content integrity check failed');
    }

    // 2. Stream content from source to target
    const replicationJob = await this.createReplicationJob(
      contentHash,
      sourceLocation,
      targetLocation
    );

    // 3. Monitor and report progress
    return this.executeReplication(replicationJob);
  }

  async verifyStorageNetwork(): Promise<NetworkVerification> {
    // Verify integrity across all storage locations
    const verificationTasks = this.storageLocations.map(location =>
      this.verifyLocationIntegrity(location)
    );

    const results = await Promise.allSettled(verificationTasks);
    return this.aggregateVerificationResults(results);
  }
}
```

### Storage Verification Agents

```typescript
class StorageVerificationAgent {
  async performIntegrityCheck(
    contentHash: string
  ): Promise<IntegrityVerificationResult> {
    // 1. Check all known storage locations
    const locations = await this.getStorageLocations(contentHash);

    // 2. Verify hash integrity at each location
    const verificationPromises = locations.map(location =>
      this.verifyLocationIntegrity(contentHash, location)
    );

    const results = await Promise.allSettled(verificationPromises);

    // 3. Generate consensus report
    return this.generateConsensusReport(contentHash, results);
  }

  private async verifyLocationIntegrity(
    contentHash: string,
    location: StorageLocation
  ): Promise<LocationVerification> {
    const startTime = Date.now();

    try {
      // Download content and verify hash
      const content = await this.downloadContent(location);
      const actualHash = this.calculateHash(content);
      const hashMatch = actualHash === contentHash;

      return {
        location,
        hashMatch,
        responseTime: Date.now() - startTime,
        contentSize: content.length,
        error: null
      };
    } catch (error) {
      return {
        location,
        hashMatch: false,
        responseTime: Date.now() - startTime,
        contentSize: 0,
        error: error.message
      };
    }
  }
}
```

## Performance Optimizations

### 1. Intelligent Storage Routing

```typescript
class StorageRouter {
  async selectOptimalLocation(
    contentHash: string,
    clientContext: ClientContext
  ): Promise<StorageLocation> {
    const availableLocations = await this.getAvailableLocations(contentHash);

    // Score locations based on multiple factors
    const scoredLocations = availableLocations.map(location => ({
      location,
      score: this.calculateLocationScore(location, clientContext)
    }));

    // Sort by score and return best option
    scoredLocations.sort((a, b) => b.score - a.score);
    return scoredLocations[0].location;
  }

  private calculateLocationScore(
    location: StorageLocation,
    context: ClientContext
  ): number {
    let score = 0;

    // Latency score (lower is better)
    score += (1000 - location.latency) / 1000 * 30;

    // Availability score
    score += location.availability * 25;

    // Geographic preference
    if (context.geographicPreference.includes(location.geographicRegion[0])) {
      score += 20;
    }

    // Cost efficiency (lower cost is better)
    score += (100 - location.cost) / 100 * 15;

    // Bandwidth capacity
    score += Math.min(location.bandwidth / 100, 1) * 10;

    return score;
  }
}
```

### 2. Adaptive Caching Strategy

```typescript
class AdaptiveStorageCache {
  async getCachedContent(
    contentHash: string,
    accessPattern: AccessPattern
  ): Promise<CachedContent | null> {
    const cacheKey = this.generateCacheKey(contentHash);
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      // Update access statistics for cache intelligence
      await this.updateAccessStatistics(contentHash, accessPattern);
      return cached;
    }

    return null;
  }

  async cacheContent(
    contentHash: string,
    content: Buffer,
    metadata: ContentMetadata
  ): Promise<void> {
    const ttl = this.calculateOptimalTTL(contentHash, metadata);
    const priority = this.calculateCachePriority(contentHash, metadata);

    await this.cache.set(contentHash, content, {
      ttl,
      priority,
      tags: ['storage', metadata.classification]
    });
  }

  private calculateOptimalTTL(
    contentHash: string,
    metadata: ContentMetadata
  ): number {
    // Base TTL on content characteristics
    let ttl = 3600; // 1 hour default

    // Increase TTL for frequently accessed content
    if (metadata.accessFrequency > 100) {
      ttl *= 4; // 4 hours
    }

    // Increase TTL for large files (avoid re-download cost)
    if (metadata.size > 100 * 1024 * 1024) { // 100MB
      ttl *= 2;
    }

    // Decrease TTL for frequently updated content
    if (metadata.updateFrequency > 10) {
      ttl /= 2;
    }

    return ttl;
  }
}
```

## Configuration

### Environment Variables

```bash
# Storage backend configuration
STORAGE_BACKEND=overlay # overlay, hybrid, s3, fs
OVERLAY_STORAGE_ENABLED=true
UHRP_ENABLED=true

# Overlay network storage settings
OVERLAY_STORAGE_TOPICS="gitdata.storage.content,gitdata.brc26.uhrp"
OVERLAY_STORAGE_AGENTS_ENABLED=true
STORAGE_REPLICATION_TARGET_COUNT=3
STORAGE_VERIFICATION_INTERVAL_HOURS=6

# Traditional storage settings (S3/CDN)
S3_ENDPOINT=https://storage.hetzner.cloud
S3_REGION=eu-central
S3_BUCKET_HOT=overlay-storage-hot
S3_BUCKET_WARM=overlay-storage-warm
S3_BUCKET_COLD=overlay-storage-cold
CDN_MODE=overlay # overlay, cloudflare, direct
CDN_BASE_URL=https://cdn.overlay.net

# Performance and optimization
STORAGE_CACHE_SIZE_GB=10
STORAGE_CACHE_TTL_SECONDS=3600
STORAGE_PARALLEL_UPLOADS=3
STORAGE_CHUNK_SIZE_MB=16
STORAGE_COMPRESSION_ENABLED=true

# BRC-26 UHRP settings
UHRP_ADVERTISEMENT_TTL_HOURS=24
UHRP_RESOLUTION_TIMEOUT_MS=5000
UHRP_VERIFICATION_REQUIRED=true
UHRP_MAX_RESOLUTION_ATTEMPTS=3

# Storage quotas and limits
STORAGE_QUOTA_DEFAULT_GB=100
STORAGE_QUOTA_PREMIUM_GB=1000
STORAGE_TIER_AUTO_DOWNGRADE_DAYS=30
STORAGE_ACCESS_LOG_RETENTION_DAYS=90
```

## Testing Strategy

### Unit Tests
```bash
# Test UHRP storage resolution
npm run test:unit -- --grep "UHRP storage"

# Test storage agent coordination
npm run test:unit -- --grep "storage agent"
```

### Integration Tests
```bash
# Test overlay storage with BRC-26
NODE_ENV=test npx vitest run test/integration/d22-overlay-storage.spec.ts

# Test storage replication agents
NODE_ENV=test npx vitest run test/integration/storage-agents.spec.ts
```

### Performance Tests
```bash
# Load testing for large file storage
NODE_ENV=test npx vitest run test/performance/storage-load.spec.ts
```

## Definition of Done (DoD)

### Core Functionality
- [x] **UHRP Integration**: Content accessible via BRC-26 Universal Hash Resolution Protocol
- [x] **Multi-location Storage**: Content stored across overlay network, S3, and local storage
- [x] **Agent Coordination**: Automated replication and verification via storage agents
- [x] **Intelligent Routing**: Optimal storage location selection based on client context
- [x] **Integrity Verification**: Continuous content integrity monitoring across all locations

### Performance Requirements
- [x] **Sub-100ms Resolution**: UHRP content resolution under 100ms for cached content
- [x] **Large File Support**: Files up to 10GB with resumable uploads and range requests
- [x] **High Availability**: 99.9% availability with automatic failover between storage locations
- [x] **Cost Optimization**: Automatic tiering to reduce storage costs while maintaining performance

### Overlay Integration
- [x] **BRC-26 Compliance**: Full Universal Hash Resolution Protocol implementation
- [x] **BRC-88 Advertising**: Storage capabilities advertised via SHIP/SLAP
- [x] **Agent Marketplace**: Integration with storage and verification agents
- [x] **Overlay Analytics**: Comprehensive metrics on overlay network storage performance

## Migration Strategy

### Phase 1: UHRP Foundation
- Deploy BRC-26 UHRP infrastructure
- Implement basic overlay storage resolution
- Add storage verification agents

### Phase 2: Hybrid Integration
- Enable parallel storage across overlay and traditional backends
- Implement intelligent routing and caching
- Deploy automated replication agents

### Phase 3: Full Optimization
- Enable advanced performance optimizations
- Deploy cost-based storage tiering
- Complete agent marketplace integration

This implementation provides a robust, scalable storage system that leverages the BSV overlay network's distributed infrastructure while maintaining compatibility with traditional storage solutions and providing enhanced performance through intelligent routing and agent-based automation.