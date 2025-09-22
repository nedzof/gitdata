# D23 — BSV Overlay Network Real-Time Event Ingestion & Certification

**Labels:** ingest, streaming, overlay, brc-22, real-time, certification
**Assignee:** TBA
**Estimate:** 5-6 PT

## Purpose

Implement a production-ready real-time event ingestion and certification system leveraging BSV overlay network infrastructure with BRC-22 job orchestration and BRC-31 identity verification. This provides scalable, distributed event processing with cryptographic certification and audit trails.

## Dependencies

- **BSV Overlay Services**: Initialized overlay network with BRC-22 job orchestration
- **PostgreSQL Database**: Enhanced event storage and job tracking tables
- **BRC Standards**: BRC-22 job coordination, BRC-31 identity verification, BRC-88 SHIP/SLAP for service discovery
- **Agent Marketplace**: Event processing, normalization, and certification agents
- **Storage System**: BRC-26 UHRP for event data storage and retrieval

## Architecture Overview

### Distributed Event Processing Architecture
1. **Event Ingestion**: Multi-source event ingestion with overlay network distribution
2. **Overlay Coordination**: BRC-22 job orchestration for distributed processing
3. **Agent Processing**: Specialized agents for normalization, validation, and certification
4. **Real-time Streaming**: Live event feeds via overlay network subscriptions
5. **Cryptographic Certification**: BRC-31 signed certificates with audit trails

### Event Flow
```
Sources → Ingestion → Overlay Distribution → Agent Processing → Certification → Storage
  ↓          ↓              ↓                    ↓                ↓           ↓
Multi     Validation   BRC-22 Jobs         Processing      BRC-31 Certs   UHRP
```

## Database Schema Updates

```sql
-- Enhanced event ingestion with overlay integration
CREATE TABLE IF NOT EXISTS overlay_event_sources (
    source_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL, -- 'webhook', 'poll', 'mqtt', 'kafka', 'overlay'
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    mapping_policy JSONB DEFAULT '{}'::jsonb,
    validation_rules JSONB DEFAULT '{}'::jsonb,
    overlay_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
    ship_advertisement_id TEXT,
    identity_key TEXT,
    enabled BOOLEAN DEFAULT true,
    trust_score INTEGER DEFAULT 50,
    last_activity_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Real-time event storage with overlay metadata
CREATE TABLE IF NOT EXISTS overlay_events (
    event_id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    external_id TEXT, -- Source-specific event ID
    event_type TEXT NOT NULL,
    raw_data JSONB NOT NULL,
    normalized_data JSONB,
    validation_status TEXT DEFAULT 'pending', -- pending, valid, invalid, certified
    validation_issues JSONB DEFAULT '[]'::jsonb,
    content_hash TEXT,
    version_id TEXT,
    overlay_job_id TEXT,
    processing_agents TEXT[] DEFAULT ARRAY[]::TEXT[],
    certification_evidence JSONB DEFAULT '{}'::jsonb,
    overlay_distribution JSONB DEFAULT '{}'::jsonb,
    ingested_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    certified_at TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES overlay_event_sources(source_id),
    INDEX idx_overlay_events_source (source_id, ingested_at),
    INDEX idx_overlay_events_status (validation_status, ingested_at),
    INDEX idx_overlay_events_type (event_type, ingested_at),
    INDEX idx_overlay_events_hash (content_hash)
);

-- Overlay event processing jobs
CREATE TABLE IF NOT EXISTS overlay_event_jobs (
    job_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    job_type TEXT NOT NULL, -- 'normalize', 'validate', 'certify', 'distribute'
    assigned_agent TEXT,
    overlay_job_template_id TEXT,
    job_status TEXT DEFAULT 'queued', -- queued, running, completed, failed, dead
    input_data JSONB,
    output_data JSONB,
    error_details JSONB,
    processing_evidence JSONB DEFAULT '[]'::jsonb,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_run_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (event_id) REFERENCES overlay_events(event_id),
    INDEX idx_overlay_event_jobs_status (job_status, next_run_at),
    INDEX idx_overlay_event_jobs_agent (assigned_agent, job_status),
    INDEX idx_overlay_event_jobs_type (job_type, job_status)
);

-- Real-time event subscriptions and streaming
CREATE TABLE IF NOT EXISTS overlay_event_subscriptions (
    subscription_id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    subscription_type TEXT NOT NULL, -- 'sse', 'websocket', 'webhook', 'overlay'
    filter_criteria JSONB DEFAULT '{}'::jsonb,
    overlay_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
    callback_url TEXT,
    client_identity_key TEXT,
    subscription_status TEXT DEFAULT 'active', -- active, paused, expired
    last_activity_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_overlay_subscriptions_client (client_id, subscription_status),
    INDEX idx_overlay_subscriptions_status (subscription_status, expires_at)
);

-- Event processing performance metrics
CREATE TABLE IF NOT EXISTS overlay_event_metrics (
    id SERIAL PRIMARY KEY,
    metric_type TEXT NOT NULL, -- 'ingestion', 'processing', 'certification', 'distribution'
    source_id TEXT,
    agent_id TEXT,
    event_count INTEGER DEFAULT 1,
    processing_time_ms INTEGER,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    throughput_events_per_sec DECIMAL,
    overlay_latency_ms INTEGER,
    recorded_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_overlay_metrics_type (metric_type, recorded_at),
    INDEX idx_overlay_metrics_source (source_id, recorded_at),
    INDEX idx_overlay_metrics_agent (agent_id, recorded_at)
);
```

## BRC-22 Job Orchestration Integration

### Event Processing Job Templates

```typescript
interface EventProcessingJobTemplate {
  templateId: string;
  jobType: 'normalize' | 'validate' | 'certify' | 'distribute';
  overlayTopics: string[];
  agentRequirements: {
    capabilities: string[];
    minimumReputation: number;
    geographicRestrictions?: string[];
  };
  processingConstraints: {
    maxProcessingTime: number;
    maxRetries: number;
    requireConsensus: boolean;
  };
  outputRequirements: {
    certificationLevel: 'basic' | 'enhanced' | 'critical';
    auditTrailRequired: boolean;
    consensusThreshold?: number;
  };
}

interface EventProcessingJob {
  jobId: string;
  eventId: string;
  jobType: string;
  assignedAgent: string;
  overlayJobTemplateId: string;
  inputData: any;
  outputData?: any;
  processingEvidence: ProcessingEvidence[];
  overlayCoordination: OverlayJobCoordination;
}

interface ProcessingEvidence {
  step: string;
  agentId: string;
  timestamp: string;
  inputHash: string;
  outputHash: string;
  processingTime: number;
  brc31Signature: string;
  overlayEvidence?: any;
}
```

### Distributed Job Coordination

```typescript
class OverlayEventJobCoordinator {
  async createProcessingJob(
    event: OverlayEvent,
    jobType: string
  ): Promise<EventProcessingJob> {
    // 1. Select appropriate agents via BRC-24 discovery
    const suitableAgents = await this.findProcessingAgents({
      capability: jobType,
      overlayTopics: [`gitdata.events.${jobType}`],
      minimumReputation: 70
    });

    // 2. Create BRC-22 job template
    const jobTemplate = await this.createJobTemplate(jobType, event);

    // 3. Distribute job via overlay network
    const overlayJob = await this.brc22Service.createDistributedJob({
      templateId: jobTemplate.templateId,
      targetAgents: suitableAgents.slice(0, 3), // Process with top 3 agents
      payload: {
        eventId: event.event_id,
        eventData: event.normalized_data || event.raw_data,
        processingRequirements: jobTemplate.processingConstraints
      }
    });

    return {
      jobId: generateJobId(),
      eventId: event.event_id,
      jobType,
      assignedAgent: suitableAgents[0].agentId,
      overlayJobTemplateId: jobTemplate.templateId,
      inputData: event.normalized_data || event.raw_data,
      processingEvidence: [],
      overlayCoordination: overlayJob
    };
  }

  async monitorJobProgress(
    job: EventProcessingJob
  ): Promise<JobProgressUpdate> {
    // Monitor job progress via overlay network
    const progress = await this.brc22Service.getJobProgress(
      job.overlayCoordination.jobId
    );

    // Aggregate evidence from participating agents
    const evidence = await this.aggregateProcessingEvidence(
      job.jobId,
      progress.agentResponses
    );

    return {
      jobId: job.jobId,
      status: progress.status,
      completionPercentage: progress.completionPercentage,
      processingEvidence: evidence,
      consensusAchieved: evidence.length >= 2 // Require 2+ agent consensus
    };
  }
}
```

## API Endpoints

### 1. Enhanced Event Ingestion API

**Endpoint:** `POST /overlay/events/ingest`

**Request:**
```bash
curl -X POST "{{BASE}}/overlay/events/ingest" \
  -H "Content-Type: application/json" \
  -H "X-Identity-Key: 03abc123..." \
  -H "X-Nonce: $(date +%s%N)" \
  -H "X-Signature: $(sign_message "$body" "$nonce")" \
  -d '{
    "sourceId": "iot-sensors-farm-001",
    "events": [
      {
        "externalId": "sensor_001_20240115_103000",
        "eventType": "sensor_reading",
        "timestamp": "2024-01-15T10:30:00Z",
        "data": {
          "sensorId": "temp_001",
          "value": 23.5,
          "unit": "celsius",
          "location": {"lat": 40.7128, "lng": -74.0060}
        }
      }
    ],
    "processingOptions": {
      "requireCertification": true,
      "distributionTopics": ["gitdata.events.iot", "gitdata.sensors.temperature"],
      "consensusLevel": "enhanced"
    }
  }'
```

**Response:**
```json
{
  "ingestionId": "ingest_xyz789",
  "processedEvents": [
    {
      "eventId": "event_abc123",
      "externalId": "sensor_001_20240115_103000",
      "status": "ingested",
      "overlayJobs": [
        {
          "jobId": "job_normalize_456",
          "jobType": "normalize",
          "assignedAgent": "agent_normalize_001",
          "status": "queued"
        }
      ],
      "overlayDistribution": {
        "topics": ["gitdata.events.iot", "gitdata.sensors.temperature"],
        "publishedAt": "2024-01-15T10:30:05Z",
        "consensusNodes": 3
      }
    }
  ],
  "overlayMetadata": {
    "sourceVerified": true,
    "identityScore": 85,
    "processingLatency": 45
  }
}
```

### 2. Real-Time Event Streaming API

**Endpoint:** `GET /overlay/events/stream`

**WebSocket Connection:**
```javascript
const ws = new WebSocket('wss://api.example.com/overlay/events/stream?topics=gitdata.events.iot&minCertificationLevel=enhanced');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time event:', data);
};
```

**SSE Connection:**
```bash
curl -N "{{BASE}}/overlay/events/stream" \
  -H "Accept: text/event-stream" \
  -G \
  -d "topics=gitdata.events.iot,gitdata.sensors.temperature" \
  -d "sourceIds=iot-sensors-farm-001" \
  -d "minCertificationLevel=enhanced" \
  -d "includeProcessingEvidence=true"
```

**Streaming Response:**
```
data: {"type":"event","eventId":"event_abc123","eventType":"sensor_reading","certificationLevel":"enhanced","timestamp":"2024-01-15T10:30:00Z","data":{"sensorId":"temp_001","value":23.5},"certification":{"agentId":"agent_cert_001","signature":"304502...","consensusNodes":3},"overlayMetadata":{"latency":120,"reliability":0.98}}

data: {"type":"heartbeat","timestamp":"2024-01-15T10:30:30Z","activeSubscriptions":1,"eventsProcessed":156}
```

### 3. Event Certification Status API

**Endpoint:** `GET /overlay/events/{eventId}/certification`

```json
{
  "eventId": "event_abc123",
  "certification": {
    "status": "certified",
    "level": "enhanced",
    "contentHash": "sha256:def456...",
    "versionId": "ver_ghi789",
    "certificates": [
      {
        "agentId": "agent_cert_001",
        "agentIdentity": "03abc123...",
        "certificationType": "integrity",
        "signature": "304502...def",
        "issuedAt": "2024-01-15T10:30:15Z",
        "overlayEvidence": {
          "consensusNodes": 3,
          "agreementRatio": 1.0
        }
      }
    ],
    "processingEvidence": [
      {
        "step": "normalization",
        "agentId": "agent_normalize_001",
        "processingTime": 45,
        "inputHash": "sha256:abc123...",
        "outputHash": "sha256:def456...",
        "brc31Signature": "304502...abc"
      },
      {
        "step": "validation",
        "agentId": "agent_validate_001",
        "processingTime": 32,
        "validationRules": ["schema", "bounds", "monotonicity"],
        "validationResult": "passed",
        "brc31Signature": "304502...def"
      }
    ]
  },
  "overlayDistribution": {
    "topics": ["gitdata.events.iot"],
    "publishedNodes": 5,
    "confirmationCount": 5,
    "networkLatency": 120
  }
}
```

## Event Processing Agents

### Normalization Agent

```typescript
class EventNormalizationAgent {
  async normalizeEvent(
    eventData: any,
    normalizationPolicy: NormalizationPolicy
  ): Promise<NormalizationResult> {
    const startTime = Date.now();

    // 1. Apply field mapping
    const mappedData = this.applyFieldMapping(eventData, normalizationPolicy.fieldMapping);

    // 2. Perform data coercion
    const coercedData = this.applyDataCoercion(mappedData, normalizationPolicy.coercionRules);

    // 3. Validate required fields
    const validationResult = this.validateRequiredFields(coercedData, normalizationPolicy.requiredFields);

    // 4. Apply business rules
    const ruleValidation = await this.applyBusinessRules(coercedData, normalizationPolicy.businessRules);

    const processingTime = Date.now() - startTime;
    const outputHash = this.calculateHash(coercedData);

    return {
      normalizedData: coercedData,
      validationIssues: [...validationResult.issues, ...ruleValidation.issues],
      processingEvidence: {
        processingTime,
        inputHash: this.calculateHash(eventData),
        outputHash,
        rulesApplied: Object.keys(normalizationPolicy.businessRules),
        agentId: this.agentId,
        timestamp: new Date().toISOString()
      }
    };
  }
}
```

### Certification Agent

```typescript
class EventCertificationAgent {
  async certifyEvent(
    normalizedEvent: any,
    certificationRequirements: CertificationRequirements
  ): Promise<CertificationResult> {
    // 1. Verify data integrity
    const integrityCheck = await this.verifyDataIntegrity(normalizedEvent);

    // 2. Apply certification rules
    const certificationLevel = this.determineCertificationLevel(
      normalizedEvent,
      certificationRequirements
    );

    // 3. Generate content hash
    const contentHash = this.generateContentHash(normalizedEvent);

    // 4. Create version ID
    const versionId = await this.generateVersionId(contentHash, normalizedEvent);

    // 5. Generate BRC-31 signature
    const signature = await this.signCertification({
      eventData: normalizedEvent,
      contentHash,
      versionId,
      certificationLevel,
      timestamp: new Date().toISOString()
    });

    // 6. Store in overlay network
    await this.publishCertificationToOverlay({
      contentHash,
      versionId,
      certificationLevel,
      signature
    });

    return {
      certified: true,
      certificationLevel,
      contentHash,
      versionId,
      signature,
      integrityVerified: integrityCheck.verified,
      certificationEvidence: {
        certificationAgent: this.agentId,
        rulesApplied: certificationRequirements.rules,
        overlayPublished: true,
        consensusAchieved: true
      }
    };
  }
}
```

## Performance Optimizations

### 1. Parallel Event Processing

```typescript
class ParallelEventProcessor {
  async processEventBatch(
    events: OverlayEvent[],
    processingOptions: ProcessingOptions
  ): Promise<BatchProcessingResult> {
    // Group events by type for optimal processing
    const eventGroups = this.groupEventsByType(events);

    // Process each group in parallel
    const processingPromises = Object.entries(eventGroups).map(
      ([eventType, eventGroup]) =>
        this.processEventGroup(eventType, eventGroup, processingOptions)
    );

    const results = await Promise.allSettled(processingPromises);

    return this.aggregateBatchResults(results);
  }

  private async processEventGroup(
    eventType: string,
    events: OverlayEvent[],
    options: ProcessingOptions
  ): Promise<GroupProcessingResult> {
    // Find optimal agents for this event type
    const agents = await this.findOptimalAgents(eventType, options.processingRequirements);

    // Distribute events across available agents
    const agentAssignments = this.distributeEventsAcrossAgents(events, agents);

    // Process assignments in parallel
    const processingPromises = agentAssignments.map(assignment =>
      this.processAgentAssignment(assignment)
    );

    const results = await Promise.allSettled(processingPromises);
    return this.aggregateGroupResults(eventType, results);
  }
}
```

### 2. Intelligent Caching Strategy

```typescript
class EventProcessingCache {
  async getCachedProcessingResult(
    eventHash: string,
    processingType: string
  ): Promise<CachedResult | null> {
    const cacheKey = `${processingType}:${eventHash}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      await this.updateCacheStatistics(cacheKey, 'hit');
      return cached;
    }

    return null;
  }

  async cacheProcessingResult(
    eventHash: string,
    processingType: string,
    result: any,
    metadata: CacheMetadata
  ): Promise<void> {
    const cacheKey = `${processingType}:${eventHash}`;
    const ttl = this.calculateOptimalTTL(processingType, metadata);

    await this.cache.set(cacheKey, {
      result,
      metadata,
      cachedAt: Date.now(),
      processingType
    }, { ttl });
  }

  private calculateOptimalTTL(
    processingType: string,
    metadata: CacheMetadata
  ): number {
    // Certification results have longer TTL
    if (processingType === 'certification') {
      return 24 * 60 * 60; // 24 hours
    }

    // Normalization results depend on source volatility
    if (processingType === 'normalization') {
      return metadata.sourceVolatility === 'high' ? 5 * 60 : 60 * 60; // 5min or 1hour
    }

    return 30 * 60; // 30 minutes default
  }
}
```

## Configuration

### Environment Variables

```bash
# Event ingestion configuration
EVENT_INGESTION_ENABLED=true
EVENT_BATCH_SIZE=100
EVENT_PROCESSING_TIMEOUT_MS=30000
EVENT_PARALLEL_WORKERS=5

# Overlay network event settings
OVERLAY_EVENT_TOPICS="gitdata.events.ingest,gitdata.events.certified"
OVERLAY_EVENT_DISTRIBUTION_ENABLED=true
EVENT_CONSENSUS_REQUIRED=true
EVENT_CONSENSUS_THRESHOLD=2

# Agent coordination settings
EVENT_PROCESSING_AGENTS_ENABLED=true
EVENT_NORMALIZATION_REQUIRED=true
EVENT_CERTIFICATION_REQUIRED=true
EVENT_AGENT_SELECTION_STRATEGY="reputation" # reputation, latency, cost

# Real-time streaming settings
EVENT_STREAM_SSE_ENABLED=true
EVENT_STREAM_WEBSOCKET_ENABLED=true
EVENT_STREAM_MAX_CLIENTS=1000
EVENT_STREAM_HEARTBEAT_INTERVAL_MS=15000

# Performance optimization
EVENT_PROCESSING_CACHE_ENABLED=true
EVENT_PROCESSING_CACHE_SIZE_MB=256
EVENT_BATCH_PROCESSING_ENABLED=true
EVENT_PARALLEL_PROCESSING_ENABLED=true

# BRC standards integration
BRC22_JOB_ORCHESTRATION_ENABLED=true
BRC31_EVENT_SIGNING_REQUIRED=true
EVENT_IDENTITY_VERIFICATION_REQUIRED=false # Optional for public events
EVENT_SIGNATURE_TTL_SECONDS=300
```

## Testing Strategy

### Unit Tests
```bash
# Test event normalization agents
npm run test:unit -- --grep "event normalization"

# Test BRC-22 job coordination
npm run test:unit -- --grep "event job coordination"
```

### Integration Tests
```bash
# Test real-time event ingestion and processing
NODE_ENV=test npx vitest run test/integration/d23-event-ingestion.spec.ts

# Test event certification with agents
NODE_ENV=test npx vitest run test/integration/event-certification.spec.ts
```

### Performance Tests
```bash
# Load testing for high-volume event ingestion
NODE_ENV=test npx vitest run test/performance/event-ingestion-load.spec.ts
```

## Definition of Done (DoD)

### Core Functionality
- [ ] **Real-time Ingestion**: Multi-source event ingestion with sub-second latency
- [ ] **Overlay Distribution**: Events distributed via BRC-22 job orchestration
- [ ] **Agent Processing**: Automated normalization, validation, and certification via agents
- [ ] **Live Streaming**: Real-time event streams via SSE and WebSocket
- [ ] **Cryptographic Certification**: BRC-31 signed certificates with audit trails

### Performance Requirements
- [ ] **High Throughput**: Process 10,000+ events per second
- [ ] **Low Latency**: End-to-end processing under 5 seconds (P95)
- [ ] **High Availability**: 99.9% uptime with automatic failover
- [ ] **Scalability**: Horizontal scaling via overlay network agents

### Quality Assurance
- [ ] **Data Integrity**: Zero data loss with idempotent processing
- [ ] **Consensus Verification**: Multi-agent consensus for critical events
- [ ] **Error Handling**: Comprehensive error handling and retry mechanisms
- [ ] **Monitoring**: Real-time metrics and alerting for system health

## Migration Strategy

### Phase 1: Basic Event Ingestion
- Deploy PostgreSQL schema for event storage
- Implement basic event ingestion API
- Add real-time streaming capabilities

### Phase 2: Overlay Integration
- Enable BRC-22 job orchestration
- Deploy event processing agents
- Implement overlay network distribution

### Phase 3: Advanced Features
- Enable consensus-based certification
- Deploy performance optimizations
- Complete monitoring and analytics

This implementation provides a robust, scalable real-time event ingestion and certification system that leverages the BSV overlay network's distributed infrastructure while maintaining high performance and data integrity through intelligent agent coordination and cryptographic verification.