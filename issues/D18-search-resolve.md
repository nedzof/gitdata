# D18 — BSV Overlay Network Search & Resolve Catalog

**Labels:** backend, catalog, overlay, brc-24, distributed-search
**Assignee:** TBA
**Estimate:** 3 PT

## Purpose

Implement distributed search and resolution capabilities using BSV overlay network infrastructure with BRC-24 service discovery. This provides scalable, decentralized content discovery across the overlay network while maintaining local PostgreSQL indexing for performance.

## Dependencies

- **BSV Overlay Services**: Initialized overlay network with BRC-24 lookup services
- **PostgreSQL Database**: Enhanced `manifests`, `overlay_content_index`, `search_cache` tables
- **BRC Standards**: BRC-24 lookup/discovery, BRC-88 SHIP/SLAP for content advertising
- **Agent Marketplace**: Integration with agent-based content discovery services
- **File Storage**: BRC-26 Universal Hash Resolution Protocol for content resolution

## Architecture Overview

### Distributed Search Architecture
1. **Local Index**: PostgreSQL full-text search for immediate results
2. **Overlay Discovery**: BRC-24 service discovery across overlay network
3. **Content Resolution**: BRC-26 hash resolution for distributed content access
4. **Cache Layer**: Redis caching for frequently accessed content metadata
5. **Agent Integration**: Agent-based intelligent search and recommendation

### Search Flow
```
Query → Local Index → Overlay Discovery → Content Resolution → Response
  ↓         ↓              ↓                ↓              ↓
Cache   PostgreSQL   BRC-24 Network   BRC-26 UHRP   Aggregated Results
```

## Database Schema Updates

```sql
-- Enhanced manifest search index with overlay integration
CREATE TABLE IF NOT EXISTS overlay_content_index (
    content_hash TEXT PRIMARY KEY,
    version_id TEXT NOT NULL,
    manifest_data JSONB NOT NULL,
    overlay_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
    ship_advertisements TEXT[] DEFAULT ARRAY[]::TEXT[],
    content_classification TEXT DEFAULT 'public',
    geographic_availability TEXT[] DEFAULT ARRAY[]::TEXT[],
    search_vector tsvector,
    indexed_at TIMESTAMP DEFAULT NOW(),
    last_discovered_at TIMESTAMP DEFAULT NOW(),
    discovery_sources JSONB DEFAULT '[]'::jsonb,
    reputation_score INTEGER DEFAULT 0,
    FOREIGN KEY (version_id) REFERENCES manifests(version_id)
);

-- Create full-text search index
CREATE INDEX idx_overlay_content_search ON overlay_content_index USING GIN(search_vector);
CREATE INDEX idx_overlay_content_topics ON overlay_content_index USING GIN(overlay_topics);
CREATE INDEX idx_overlay_content_classification ON overlay_content_index(content_classification);
CREATE INDEX idx_overlay_content_geo ON overlay_content_index USING GIN(geographic_availability);

-- Search result caching
CREATE TABLE IF NOT EXISTS search_cache (
    query_hash TEXT PRIMARY KEY,
    query_params JSONB NOT NULL,
    results JSONB NOT NULL,
    overlay_sources TEXT[] DEFAULT ARRAY[]::TEXT[],
    cached_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour',
    hit_count INTEGER DEFAULT 1,
    INDEX idx_search_cache_expires (expires_at),
    INDEX idx_search_cache_params USING GIN(query_params)
);

-- Content resolution tracking
CREATE TABLE IF NOT EXISTS content_resolutions (
    id SERIAL PRIMARY KEY,
    content_hash TEXT NOT NULL,
    resolver_type TEXT NOT NULL, -- 'local', 'overlay', 'brc26'
    resolution_time_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    resolved_at TIMESTAMP DEFAULT NOW(),
    client_ip INET,
    user_agent TEXT,
    INDEX idx_content_resolution_hash (content_hash, resolved_at),
    INDEX idx_content_resolution_performance (resolver_type, resolution_time_ms)
);
```

## API Endpoints

### 1. Enhanced Search API

**Endpoint:** `GET /overlay/search`

**Parameters:**
- `q` (string): Full-text search query
- `datasetId` (string): Filter by dataset ID
- `tags` (array): Filter by content tags
- `classification` (string): Content classification (public, commercial, research)
- `geographicRegion` (string): Geographic availability filter
- `overlayTopics` (array): Overlay network topics to search
- `includeOverlay` (boolean): Include overlay network results (default: true)
- `limit` (number): Maximum results (default: 20, max: 100)
- `offset` (number): Pagination offset
- `sortBy` (string): Sort criteria (relevance, date, reputation)
- `minReputation` (number): Minimum reputation score filter

**Example Request:**
```bash
curl -X GET "{{BASE}}/overlay/search" \
  -G \
  -d "q=machine learning datasets" \
  -d "classification=commercial" \
  -d "geographicRegion=US" \
  -d "overlayTopics[]=gitdata.model.training" \
  -d "minReputation=50" \
  -d "limit=10" \
  -d "includeOverlay=true"
```

**Response:**
```json
{
  "query": {
    "text": "machine learning datasets",
    "filters": {
      "classification": "commercial",
      "geographicRegion": "US",
      "overlayTopics": ["gitdata.model.training"],
      "minReputation": 50
    }
  },
  "results": [
    {
      "versionId": "ver_abc123",
      "contentHash": "sha256:def456...",
      "manifest": {
        "title": "Premium ML Training Dataset",
        "description": "High-quality labeled dataset for supervised learning",
        "tags": ["machine-learning", "supervised", "labeled"],
        "classification": "commercial",
        "size": 1024000000
      },
      "overlayMetadata": {
        "shipAdvertisements": ["ship_ad_789"],
        "overlayTopics": ["gitdata.model.training"],
        "reputationScore": 95,
        "lastActivity": "2024-01-15T10:30:00Z"
      },
      "availability": {
        "local": true,
        "overlay": true,
        "brc26Urls": ["uhrp://def456.../content"]
      },
      "producer": {
        "id": "prod_xyz",
        "name": "ML Data Corp",
        "reputationScore": 85,
        "identityVerified": true
      }
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  },
  "sources": {
    "local": 1,
    "overlay": 0,
    "cached": false
  },
  "queryTime": 45
}
```

### 2. Enhanced Resolve API

**Endpoint:** `GET /overlay/resolve`

**Parameters:**
- `versionId` (string): Specific version to resolve
- `datasetId` (string): Dataset ID to get all versions
- `contentHash` (string): Direct content hash resolution
- `includeLineage` (boolean): Include parent/child relationships
- `includeOverlay` (boolean): Include overlay network metadata
- `resolveContent` (boolean): Resolve actual content URLs via BRC-26
- `depth` (number): Lineage depth (default: 1, max: 10)

**Example Request:**
```bash
curl -X GET "{{BASE}}/overlay/resolve" \
  -G \
  -d "versionId=ver_abc123" \
  -d "includeLineage=true" \
  -d "includeOverlay=true" \
  -d "resolveContent=true" \
  -d "depth=3"
```

**Response:**
```json
{
  "resolution": {
    "versionId": "ver_abc123",
    "datasetId": "ds_xyz789",
    "contentHash": "sha256:def456...",
    "manifest": {
      "title": "ML Training Dataset v2.1",
      "description": "Enhanced dataset with additional labels",
      "classification": "commercial",
      "tags": ["machine-learning", "enhanced", "v2.1"],
      "size": 1536000000,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "overlayMetadata": {
      "shipAdvertisements": ["ship_ad_789", "ship_ad_890"],
      "overlayTopics": ["gitdata.model.training", "gitdata.dataset.commercial"],
      "reputationScore": 95,
      "geographicAvailability": ["US", "EU", "CA"],
      "lastVerified": "2024-01-15T12:00:00Z"
    },
    "contentResolution": {
      "local": {
        "available": true,
        "path": "/storage/content/def456...",
        "verifiedAt": "2024-01-15T12:00:00Z"
      },
      "brc26": {
        "uhrpUrl": "uhrp://def456.../content",
        "mirrors": [
          "https://node1.overlay.net/uhrp/def456...",
          "https://node2.overlay.net/uhrp/def456..."
        ],
        "verificationHash": "sha256:def456..."
      },
      "overlay": {
        "discoveredNodes": 5,
        "averageLatency": 120,
        "reliability": 0.98
      }
    },
    "lineage": {
      "parents": [
        {
          "versionId": "ver_abc122",
          "relationship": "derived_from",
          "contentHash": "sha256:abc123...",
          "title": "ML Training Dataset v2.0"
        }
      ],
      "children": [
        {
          "versionId": "ver_abc124",
          "relationship": "enhanced_by",
          "contentHash": "sha256:ghi789...",
          "title": "ML Training Dataset v2.2"
        }
      ],
      "depth": 3,
      "totalAncestors": 2,
      "totalDescendants": 1
    },
    "producer": {
      "id": "prod_xyz",
      "name": "ML Data Corp",
      "identityKey": "03abc123...",
      "reputationScore": 85,
      "identityVerified": true,
      "lastActivity": "2024-01-15T11:45:00Z"
    }
  },
  "resolvedAt": "2024-01-15T14:30:00Z",
  "resolutionTime": 78,
  "sources": ["local", "overlay", "brc26"]
}
```

### 3. Advanced Search Features

**Endpoint:** `POST /overlay/search/advanced`

```json
{
  "query": {
    "text": "neural networks",
    "semantic": true,
    "includeRelated": true
  },
  "filters": {
    "classification": ["public", "research"],
    "tags": {
      "required": ["machine-learning"],
      "preferred": ["neural-networks", "deep-learning"],
      "excluded": ["deprecated"]
    },
    "dateRange": {
      "from": "2024-01-01T00:00:00Z",
      "to": "2024-12-31T23:59:59Z"
    },
    "sizeRange": {
      "min": 1000000,
      "max": 10000000000
    },
    "reputationThreshold": 70
  },
  "overlay": {
    "topics": ["gitdata.model.training", "gitdata.dataset.research"],
    "geographicPreference": ["US", "EU"],
    "includeAgentRecommendations": true,
    "maxNetworkLatency": 500
  },
  "pagination": {
    "limit": 25,
    "offset": 0
  },
  "sorting": {
    "primary": "relevance",
    "secondary": "reputation",
    "tertiary": "date"
  }
}
```

## Implementation Features

### 1. Intelligent Caching Strategy

```typescript
class OverlaySearchCache {
  async search(queryParams: SearchParams): Promise<SearchResults> {
    const cacheKey = this.generateCacheKey(queryParams);

    // Check local cache
    const cached = await this.getFromCache(cacheKey);
    if (cached && !this.isExpired(cached)) {
      await this.updateHitCount(cacheKey);
      return cached.results;
    }

    // Perform fresh search
    const results = await this.performSearch(queryParams);

    // Cache results with intelligent TTL
    const ttl = this.calculateTTL(queryParams, results);
    await this.cacheResults(cacheKey, results, ttl);

    return results;
  }

  private calculateTTL(params: SearchParams, results: SearchResults): number {
    // Dynamic TTL based on query type and result volatility
    if (params.includeOverlay) {
      return 5 * 60; // 5 minutes for overlay queries
    }
    if (results.sources.local > results.sources.overlay) {
      return 30 * 60; // 30 minutes for primarily local results
    }
    return 15 * 60; // 15 minutes default
  }
}
```

### 2. Overlay Network Integration

```typescript
class OverlayContentDiscovery {
  async discoverContent(query: SearchQuery): Promise<OverlaySearchResults> {
    // 1. Use BRC-24 service discovery
    const discoveryServices = await this.brc24Service.findServices({
      capability: 'content-search',
      topics: query.overlayTopics,
      geographicRegion: query.geographicRegion
    });

    // 2. Query multiple overlay nodes in parallel
    const searchPromises = discoveryServices.map(service =>
      this.queryOverlayNode(service, query)
    );

    const results = await Promise.allSettled(searchPromises);

    // 3. Aggregate and rank results
    return this.aggregateOverlayResults(results, query);
  }

  async resolveContent(contentHash: string): Promise<ContentResolution> {
    // 1. Check local availability
    const localResult = await this.checkLocalContent(contentHash);

    // 2. Use BRC-26 UHRP for distributed resolution
    const uhrpResult = await this.brc26Service.resolveContent(contentHash);

    // 3. Fallback to overlay network discovery
    const overlayResult = await this.discoverContentOnOverlay(contentHash);

    return {
      local: localResult,
      brc26: uhrpResult,
      overlay: overlayResult,
      preferredSource: this.selectBestSource([localResult, uhrpResult, overlayResult])
    };
  }
}
```

### 3. Agent-Enhanced Search

```typescript
class AgentSearchEnhancer {
  async enhanceSearch(query: SearchQuery): Promise<EnhancedSearchResults> {
    // Find search enhancement agents
    const searchAgents = await this.agentRegistry.findAgents({
      capability: 'search-enhancement',
      overlayTopics: query.overlayTopics
    });

    // Get recommendations from multiple agents
    const recommendations = await Promise.all(
      searchAgents.map(agent => this.getAgentRecommendations(agent, query))
    );

    // Combine agent insights with search results
    return this.combineAgentInsights(query, recommendations);
  }

  private async getAgentRecommendations(
    agent: OverlayAgent,
    query: SearchQuery
  ): Promise<AgentRecommendations> {
    const payload = {
      query: query.text,
      context: query.filters,
      requestId: generateRequestId()
    };

    const execution = await this.agentExecutionService.executeAgentJob(
      { type: 'search-enhancement', payload },
      agent,
      payload
    );

    return execution.result;
  }
}
```

## Performance Optimizations

### 1. Multi-Source Search Strategy
- **Parallel Execution**: Local and overlay searches run concurrently
- **Early Termination**: Return local results immediately if sufficient
- **Progressive Enhancement**: Add overlay results as they arrive
- **Adaptive Timeouts**: Dynamic timeouts based on network conditions

### 2. Intelligent Indexing
- **Real-time Updates**: PostgreSQL triggers update search vectors
- **Overlay Sync**: Background sync with overlay network discoveries
- **Reputation Weighting**: Search rankings include reputation scores
- **Geographic Optimization**: Prioritize geographically relevant content

### 3. Caching Strategies
- **Query Result Caching**: Cache complete search results
- **Content Metadata Caching**: Cache resolved content metadata
- **Overlay Discovery Caching**: Cache BRC-24 service discoveries
- **Negative Caching**: Cache failed resolution attempts

## Configuration

### Environment Variables
```bash
# Search configuration
SEARCH_DEFAULT_LIMIT=20
SEARCH_MAX_LIMIT=100
SEARCH_OVERLAY_TIMEOUT_MS=5000
SEARCH_CACHE_TTL_SECONDS=900

# Overlay integration
OVERLAY_SEARCH_ENABLED=true
OVERLAY_CONTENT_DISCOVERY_TIMEOUT_MS=10000
OVERLAY_MAX_CONCURRENT_QUERIES=5
OVERLAY_REPUTATION_WEIGHT=0.3

# Performance tuning
SEARCH_ENABLE_PARALLEL=true
SEARCH_LOCAL_FIRST=true
SEARCH_PROGRESSIVE_ENHANCEMENT=true
POSTGRES_SEARCH_WORK_MEM=256MB
```

## Testing Strategy

### Unit Tests
```bash
# Test search functionality
npm run test:unit -- --grep "overlay search"

# Test content resolution
npm run test:unit -- --grep "content resolution"
```

### Integration Tests
```bash
# Test search with overlay integration
NODE_ENV=test npx vitest run test/integration/d18-search.spec.ts

# Test resolve with BRC-26 integration
NODE_ENV=test npx vitest run test/integration/d18-resolve.spec.ts
```

### Performance Tests
```bash
# Load testing for search endpoints
NODE_ENV=test npx vitest run test/performance/search-load.spec.ts
```

## Definition of Done (DoD)

### Core Functionality
- [ ] **Search API**: Multi-source search with local and overlay results
- [ ] **Resolve API**: Content resolution via local, overlay, and BRC-26
- [ ] **Caching**: Intelligent caching with dynamic TTL
- [ ] **Pagination**: Efficient pagination for large result sets
- [ ] **Performance**: Sub-200ms response time for cached queries

### Overlay Integration
- [ ] **BRC-24 Discovery**: Service discovery for content search
- [ ] **BRC-26 Resolution**: Content resolution via UHRP
- [ ] **Agent Enhancement**: AI agent-based search recommendations
- [ ] **Reputation Scoring**: Search ranking includes reputation metrics
- [ ] **Geographic Optimization**: Geographic preference handling

### Quality Assurance
- [ ] **Error Handling**: Graceful degradation when overlay unavailable
- [ ] **Input Validation**: Comprehensive query parameter validation
- [ ] **Security**: Rate limiting and abuse prevention
- [ ] **Monitoring**: Search performance and usage metrics
- [ ] **Documentation**: Complete API documentation with examples

## Migration Strategy

### Phase 1: Local Enhancement
- Deploy enhanced PostgreSQL schema
- Implement local search improvements
- Add basic caching layer

### Phase 2: Overlay Integration
- Enable BRC-24 service discovery
- Implement overlay search federation
- Add BRC-26 content resolution

### Phase 3: Agent Enhancement
- Integrate agent-based recommendations
- Enable advanced search features
- Deploy performance optimizations

This implementation provides a robust, scalable search and resolution system that leverages the BSV overlay network while maintaining high performance through intelligent caching and local indexing.