# D26 — BSV Overlay Network Data Discovery & Marketplace Listings

**Enterprise Data Discovery Platform with BRC Standards Integration**

Labels: discovery, listings, search, marketplace, overlay-network, brc-standards
Assignee: TBA
Estimate: 8–12 PT
Priority: High

## Overview

Transform basic data discovery into a comprehensive BSV overlay network marketplace platform that integrates BRC-22 job orchestration, BRC-24 lookup services, BRC-26 Universal Hash Resolution Protocol (UHRP), and enterprise-grade data discovery with agent marketplace coordination.

## Purpose

- **Overlay Network Integration**: Implement BRC-22 data synchronization for distributed marketplace discovery across overlay nodes
- **Universal Content Resolution**: Leverage BRC-26 UHRP for content-addressed data discovery and multi-host availability
- **Agent Marketplace**: Enable AI agents to discover, evaluate, and procure datasets through standardized marketplace APIs
- **Enterprise Discovery**: Provide scalable, production-ready data discovery with full PostgreSQL backing and advanced filtering
- **Cross-Network Search**: Implement BRC-24 lookup services for federated search across multiple overlay networks

## Non-Goals

- Complex vector search or AI-powered recommendations (future phase)
- Real-time collaboration features
- Built-in data processing pipelines
- Custom CMS interfaces beyond API

## Architecture & Dependencies

### Core Dependencies
- **Database**: Full PostgreSQL production schema with overlay network tables
- **BRC Standards**: BRC-22, BRC-24, BRC-26 integration
- **Existing Services**: D01 (Submit), D05/D09 (Pricing), D07 (Streaming), D11 (Caching), D12 (Rate Limits)
- **Agent Infrastructure**: D24 agent marketplace integration

## PostgreSQL Database Schema

### Core Discovery Tables
```sql
-- Enhanced manifests table for overlay network discovery
CREATE TABLE overlay_manifests (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id TEXT NOT NULL,
    producer_id UUID REFERENCES producers(id),
    manifest_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 for BRC-26 UHRP
    name TEXT,
    description TEXT,
    tags TEXT[], -- PostgreSQL array for advanced filtering
    content_type VARCHAR(100),
    content_length BIGINT,
    overlay_topics TEXT[] DEFAULT '{}', -- BRC-22 topics
    uhrp_urls TEXT[], -- BRC-26 UHRP availability URLs
    availability_score DECIMAL(3,2) DEFAULT 1.0, -- Multi-host availability
    quality_score DECIMAL(3,2), -- Agent-assessed quality
    pricing_tier VARCHAR(20) DEFAULT 'standard',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);

-- BRC-24 lookup service index
CREATE TABLE lookup_service_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_provider VARCHAR(100) NOT NULL,
    lookup_key VARCHAR(255) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    version_id UUID REFERENCES overlay_manifests(version_id),
    overlay_topic VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    ttl_seconds INTEGER DEFAULT 3600
);

-- BRC-26 UHRP advertisement tracking
CREATE TABLE uhrp_advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash VARCHAR(64) NOT NULL,
    host_public_key VARCHAR(66) NOT NULL,
    host_address VARCHAR(50) NOT NULL,
    availability_url TEXT NOT NULL,
    expiry_time BIGINT NOT NULL,
    content_length BIGINT NOT NULL,
    utxo_txid VARCHAR(64),
    utxo_vout INTEGER,
    signature TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Agent marketplace discovery tracking
CREATE TABLE agent_discovery_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id),
    search_query JSONB,
    results_count INTEGER,
    quality_threshold DECIMAL(3,2),
    price_limit DECIMAL(15,8),
    selected_datasets UUID[],
    session_status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Discovery performance metrics
CREATE TABLE discovery_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint VARCHAR(100) NOT NULL,
    query_params JSONB,
    response_time_ms INTEGER,
    results_count INTEGER,
    cache_hit BOOLEAN DEFAULT FALSE,
    overlay_nodes_queried INTEGER DEFAULT 1,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_manifests_dataset_id ON overlay_manifests(dataset_id);
CREATE INDEX idx_manifests_producer_id ON overlay_manifests(producer_id);
CREATE INDEX idx_manifests_tags ON overlay_manifests USING GIN(tags);
CREATE INDEX idx_manifests_content_hash ON overlay_manifests(manifest_hash);
CREATE INDEX idx_manifests_overlay_topics ON overlay_manifests USING GIN(overlay_topics);
CREATE INDEX idx_lookup_service_content_hash ON lookup_service_index(content_hash);
CREATE INDEX idx_uhrp_content_hash ON uhrp_advertisements(content_hash);
CREATE INDEX idx_uhrp_status_expiry ON uhrp_advertisements(status, expiry_time);
CREATE INDEX idx_agent_sessions_agent_id ON agent_discovery_sessions(agent_id);
CREATE INDEX idx_discovery_metrics_timestamp ON discovery_metrics(timestamp);
```

## API Endpoints Implementation

### Core Discovery Endpoints
- [ ] **GET /v1/discovery/listings** - Enhanced marketplace discovery
  - Query parameters: `q`, `datasetId`, `producerId`, `tags[]`, `contentType`, `priceRange`, `qualityMin`, `limit`, `offset`, `sortBy`
  - BRC-24 lookup service integration for federated search
  - Real-time pricing via D05/D09 integration
  - Agent marketplace compatibility

- [ ] **GET /v1/discovery/listings/:versionId** - Detailed manifest with overlay data
  - Full manifest details with BRC-26 UHRP availability
  - Multi-host download options
  - Real-time pricing and availability scores
  - Agent evaluation metrics

- [ ] **POST /v1/discovery/search** - Advanced search with BRC standards
  - Complex query DSL with filtering, sorting, aggregations
  - BRC-22 topic-based federated search
  - Agent preference learning integration

### BRC-26 UHRP Integration
- [ ] **GET /v1/discovery/resolve/:contentHash** - Universal content resolution
  - Multi-host availability via BRC-26 UHRP
  - Automatic failover and load balancing
  - Download URL optimization based on geography/performance

- [ ] **POST /v1/discovery/advertise** - Content availability advertisement
  - BRC-26 UHRP advertisement creation
  - UTXO-based commitment tracking
  - Host reputation scoring

### Agent Marketplace Integration
- [ ] **POST /v1/discovery/agents/search** - AI agent discovery sessions
  - Quality-based filtering and ranking
  - Budget-aware recommendations
  - Automated dataset evaluation

- [ ] **GET /v1/discovery/agents/sessions/:sessionId** - Discovery session tracking
  - Agent decision audit trails
  - Performance analytics
  - Result set management

## Implementation Tasks

### BRC Standards Integration
- [ ] **BRC-22 Data Synchronization**
  - Implement overlay network topic management for marketplace data
  - Cross-node manifest synchronization
  - Topic-specific admission rules for marketplace content

- [ ] **BRC-24 Lookup Services**
  - Federated search across multiple overlay networks
  - Service discovery for marketplace participants
  - Cross-network content resolution

- [ ] **BRC-26 Universal Hash Resolution**
  - Content-addressed discovery and availability
  - Multi-host redundancy and failover
  - UTXO-based availability commitments

### Data Layer Enhancements
- [ ] **PostgreSQL Production Schema**
  - Comprehensive indexing for sub-100ms query performance
  - Full-text search with PostgreSQL's built-in capabilities
  - JSONB support for flexible metadata storage

- [ ] **Advanced Caching Strategy**
  - Redis-backed distributed caching
  - Intelligent cache invalidation
  - BRC-22 event-driven cache updates

### Agent Marketplace Features
- [ ] **Quality Scoring System**
  - Agent-based dataset quality assessment
  - Community reputation scoring
  - Automated quality verification

- [ ] **Discovery Session Management**
  - Agent preference learning
  - Budget optimization
  - Result set persistence and sharing

## Testing Strategy

### Integration Tests
- [ ] **BRC Standards Compliance**
  - BRC-22 topic submission and synchronization
  - BRC-24 lookup service federation
  - BRC-26 UHRP content resolution and failover

- [ ] **Performance Benchmarks**
  - Sub-100ms response times for discovery queries
  - 10k+ manifest search performance
  - Concurrent agent discovery sessions

- [ ] **Agent Marketplace Scenarios**
  - Agent discovery session lifecycle
  - Quality scoring accuracy
  - Budget optimization algorithms

### Unit Tests
- [ ] **Discovery Engine**
  - Advanced filtering and sorting
  - Pagination stability
  - Cache invalidation logic

- [ ] **BRC Integration**
  - UHRP advertisement validation
  - Overlay network synchronization
  - Cross-network lookup resolution

## Configuration

### Environment Variables
```bash
# BRC Standards Configuration
BRC22_OVERLAY_TOPICS=marketplace,discovery,uhrp
BRC24_LOOKUP_SERVICES=primary,secondary,fallback
BRC26_UHRP_ENABLED=true
BRC26_MAX_HOSTS=10

# Discovery Performance
DISCOVERY_CACHE_TTL=300
DISCOVERY_MAX_RESULTS=1000
DISCOVERY_QUALITY_THRESHOLD=0.7

# Agent Marketplace
AGENT_DISCOVERY_ENABLED=true
AGENT_SESSION_TTL=3600
AGENT_QUALITY_SCORING=true
```

### Feature Flags
```typescript
interface DiscoveryFeatureFlags {
  brcStandardsEnabled: boolean;
  uhrpIntegration: boolean;
  agentMarketplace: boolean;
  qualityScoring: boolean;
  federatedSearch: boolean;
  realTimePricing: boolean;
}
```

## API Response Examples

### Enhanced Listings Response
```json
{
  "items": [
    {
      "versionId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Global Weather Dataset 2024",
      "description": "Comprehensive meteorological data",
      "datasetId": "weather-global-2024",
      "producerId": "weather-corp",
      "tags": ["weather", "global", "realtime"],
      "contentType": "application/json",
      "contentLength": 15728640,
      "manifestHash": "a1b2c3d4e5f6...",
      "overlayTopics": ["weather-data", "marketplace"],
      "uhrpUrls": [
        "https://host1.example.com/content/a1b2c3d4e5f6",
        "https://host2.example.com/data/a1b2c3d4e5f6"
      ],
      "availabilityScore": 0.95,
      "qualityScore": 0.88,
      "pricing": {
        "satoshis": 1000000,
        "currency": "BSV",
        "tier": "premium"
      },
      "updatedAt": "2024-01-15T10:30:00Z",
      "expiresAt": "2024-12-31T23:59:59Z"
    }
  ],
  "pagination": {
    "total": 1247,
    "limit": 20,
    "offset": 0,
    "hasNext": true
  },
  "metadata": {
    "queryTime": 45,
    "overlayNodesQueried": 3,
    "cacheHit": false,
    "brcStandards": ["BRC-22", "BRC-24", "BRC-26"]
  }
}
```

### Agent Discovery Session Response
```json
{
  "sessionId": "agent-session-123",
  "agentId": "ai-agent-456",
  "searchQuery": {
    "keywords": ["financial", "market", "realtime"],
    "qualityThreshold": 0.8,
    "priceLimit": 5000000,
    "contentTypes": ["application/json", "text/csv"]
  },
  "recommendations": [
    {
      "versionId": "550e8400-e29b-41d4-a716-446655440001",
      "relevanceScore": 0.92,
      "qualityScore": 0.85,
      "priceValue": 0.78,
      "reasoning": "High-quality financial data with real-time updates"
    }
  ],
  "sessionStatus": "active",
  "resultsCount": 47,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Definition of Done

- [ ] **Core Discovery Platform**
  - Enterprise-grade discovery API with sub-100ms performance
  - Full PostgreSQL integration with comprehensive indexing
  - Advanced filtering, sorting, and pagination

- [ ] **BRC Standards Integration**
  - BRC-22 overlay network synchronization
  - BRC-24 federated lookup services
  - BRC-26 UHRP content resolution with multi-host availability

- [ ] **Agent Marketplace Features**
  - AI agent discovery sessions with quality scoring
  - Budget optimization and recommendation algorithms
  - Discovery session tracking and analytics

- [ ] **Production Readiness**
  - Comprehensive test coverage (unit, integration, performance)
  - Monitoring and observability integration
  - Security and rate limiting implementation

## Acceptance Criteria

### Functional Requirements
- [ ] **Discovery Performance**: P95 response time < 100ms for 10k+ manifest searches
- [ ] **BRC Compliance**: Full integration with BRC-22, BRC-24, and BRC-26 standards
- [ ] **Agent Integration**: Support for concurrent agent discovery sessions with quality assessment
- [ ] **Multi-Host Availability**: Automatic failover via BRC-26 UHRP with 99.9% uptime

### Non-Functional Requirements
- [ ] **Scalability**: Handle 1000+ concurrent discovery requests
- [ ] **Reliability**: 99.9% API availability with graceful degradation
- [ ] **Security**: Rate limiting, input validation, and BSV identity verification
- [ ] **Observability**: Comprehensive metrics, logging, and distributed tracing

## Artifacts

- [ ] **API Documentation**
  - OpenAPI 3.0 specification
  - Interactive developer documentation
  - SDK examples for multiple languages

- [ ] **Testing Artifacts**
  - Postman collections for all endpoints
  - Newman CI/CD integration
  - Performance test suites

- [ ] **Deployment Resources**
  - Docker containerization
  - Kubernetes manifests
  - Production deployment guides

## Risk Mitigation

### Technical Risks
- **BRC Integration Complexity**: Implement progressive rollout with feature flags
- **Performance Degradation**: Implement aggressive caching and query optimization
- **Cross-Network Synchronization**: Use eventual consistency with conflict resolution

### Operational Risks
- **High Query Load**: Implement rate limiting and query complexity analysis
- **Data Inconsistency**: Use PostgreSQL transactions and event sourcing
- **Service Dependencies**: Implement circuit breakers and graceful degradation

## Implementation Notes

The discovery platform leverages existing `searchManifests(db, ...)` functionality while extending it with overlay network capabilities. The implementation follows the established pattern in `server.ts` where listings routes are already referenced, providing a foundation for comprehensive marketplace discovery with BRC standards integration.