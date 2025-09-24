# D17 — BSV Overlay Network Metrics & Health Monitoring

**Labels:** ops, monitoring, overlay, observability, performance
**Assignee:** TBA
**Estimate:** 3-4 PT

## Purpose

Implement comprehensive monitoring and observability for BSV overlay network operations with detailed metrics on BRC standards compliance, agent marketplace performance, and distributed system health. This provides real-time insights into overlay network performance and automated alerting for operational issues.

## Dependencies

- **BSV Overlay Services**: Initialized overlay network with full BRC standards support
- **PostgreSQL Database**: Metrics storage and historical analysis tables
- **Agent Marketplace**: Agent performance and coordination metrics
- **Storage System**: BRC-26 UHRP performance and availability metrics
- **Event Ingestion**: Real-time event processing and certification metrics

## Architecture Overview

### Comprehensive Monitoring Architecture
1. **Overlay Network Health**: BRC standards compliance and network connectivity
2. **Agent Performance**: Agent marketplace metrics and coordination effectiveness
3. **Storage Analytics**: BRC-26 UHRP performance and content availability
4. **Event Processing**: Real-time ingestion and certification pipeline health
5. **System Resources**: Infrastructure and application performance metrics

### Monitoring Stack
```
Applications → Metrics Collection → Storage → Visualization → Alerting
     ↓              ↓                 ↓           ↓           ↓
  BRC APIs      PostgreSQL        Time Series   Dashboard   Notifications
```

## Database Schema for Metrics

```sql
-- Comprehensive metrics storage with overlay network integration
CREATE TABLE IF NOT EXISTS overlay_metrics (
    id SERIAL PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_type TEXT NOT NULL, -- 'counter', 'gauge', 'histogram', 'summary'
    metric_value DECIMAL NOT NULL,
    labels JSONB DEFAULT '{}'::jsonb,
    overlay_context JSONB DEFAULT '{}'::jsonb, -- Overlay network specific context
    recorded_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_overlay_metrics_name (metric_name, recorded_at),
    INDEX idx_overlay_metrics_type (metric_type, recorded_at),
    INDEX idx_overlay_metrics_labels USING GIN(labels)
);

-- System health status tracking
CREATE TABLE IF NOT EXISTS overlay_health_status (
    component TEXT PRIMARY KEY,
    status TEXT NOT NULL, -- 'healthy', 'degraded', 'unhealthy', 'unknown'
    last_check_at TIMESTAMP DEFAULT NOW(),
    check_details JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    uptime_percentage DECIMAL DEFAULT 100.0,
    last_incident_at TIMESTAMP,
    recovery_time_seconds INTEGER,
    INDEX idx_overlay_health_status (status, last_check_at)
);

-- BRC standards compliance metrics
CREATE TABLE IF NOT EXISTS brc_compliance_metrics (
    id SERIAL PRIMARY KEY,
    brc_standard TEXT NOT NULL, -- 'BRC-22', 'BRC-24', 'BRC-26', 'BRC-31', 'BRC-88'
    operation_type TEXT NOT NULL,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    average_latency_ms DECIMAL,
    compliance_score DECIMAL, -- 0-100 compliance percentage
    compliance_details JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_brc_compliance_standard (brc_standard, recorded_at),
    INDEX idx_brc_compliance_operation (operation_type, recorded_at)
);

-- Agent marketplace performance metrics
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
    id SERIAL PRIMARY KEY,
    agent_id TEXT NOT NULL,
    metric_type TEXT NOT NULL, -- 'execution_time', 'success_rate', 'reputation', 'availability'
    metric_value DECIMAL NOT NULL,
    job_type TEXT,
    overlay_evidence JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_agent_metrics_agent (agent_id, recorded_at),
    INDEX idx_agent_metrics_type (metric_type, recorded_at)
);

-- Storage and content metrics
CREATE TABLE IF NOT EXISTS storage_performance_metrics (
    id SERIAL PRIMARY KEY,
    content_hash TEXT,
    storage_location TEXT NOT NULL, -- 'local', 'overlay', 'uhrp', 's3', 'cdn'
    operation_type TEXT NOT NULL, -- 'upload', 'download', 'verify', 'replicate'
    response_time_ms INTEGER,
    bytes_transferred BIGINT,
    success BOOLEAN NOT NULL,
    error_details JSONB,
    recorded_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_storage_metrics_location (storage_location, recorded_at),
    INDEX idx_storage_metrics_operation (operation_type, recorded_at)
);
```

## Health Check Endpoints

### 1. Comprehensive Health Check API

**Endpoint:** `GET /overlay/health`

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "components": {
    "database": {
      "status": "healthy",
      "responseTime": 5,
      "details": {
        "postgresql": {
          "status": "healthy",
          "connections": 12,
          "maxConnections": 100,
          "queryLatency": 2.5
        },
        "redis": {
          "status": "healthy",
          "memory": "45MB",
          "connections": 8
        }
      }
    },
    "overlayNetwork": {
      "status": "healthy",
      "details": {
        "connectivity": {
          "status": "healthy",
          "connectedNodes": 25,
          "networkLatency": 120,
          "lastSync": "2024-01-15T10:29:45Z"
        },
        "brcStandards": {
          "brc22": {
            "status": "healthy",
            "jobsActive": 15,
            "successRate": 0.98,
            "avgProcessingTime": 450
          },
          "brc24": {
            "status": "healthy",
            "discoveryServices": 8,
            "lookupLatency": 80,
            "successRate": 0.99
          },
          "brc26": {
            "status": "healthy",
            "contentResolutions": 156,
            "resolutionLatency": 200,
            "availabilityScore": 0.97
          },
          "brc31": {
            "status": "healthy",
            "signatureVerifications": 89,
            "verificationLatency": 15,
            "successRate": 1.0
          },
          "brc88": {
            "status": "healthy",
            "activeAdvertisements": 42,
            "discoveryLatency": 95,
            "serviceAvailability": 0.98
          }
        }
      }
    },
    "agentMarketplace": {
      "status": "healthy",
      "details": {
        "registeredAgents": 23,
        "activeAgents": 18,
        "averageReputation": 87.5,
        "jobsInProgress": 6,
        "jobSuccessRate": 0.94,
        "averageExecutionTime": 850
      }
    },
    "storage": {
      "status": "healthy",
      "details": {
        "local": {
          "status": "healthy",
          "freeSpace": "750GB",
          "totalSpace": "1TB",
          "iops": 1250
        },
        "overlay": {
          "status": "healthy",
          "uhrpAvailability": 0.98,
          "averageLatency": 180,
          "replicationFactor": 3.2
        },
        "s3": {
          "status": "healthy",
          "responseTime": 95,
          "errorRate": 0.001
        }
      }
    },
    "eventProcessing": {
      "status": "healthy",
      "details": {
        "ingestionRate": 1250,
        "processingLatency": 340,
        "certificationRate": 0.97,
        "backlogSize": 45
      }
    }
  },
  "alerts": [
    {
      "level": "warning",
      "component": "storage.overlay",
      "message": "UHRP availability below threshold",
      "value": 0.98,
      "threshold": 0.99,
      "timestamp": "2024-01-15T10:25:00Z"
    }
  ]
}
```

### 2. Component-Specific Health Checks

**Endpoint:** `GET /overlay/health/{component}`

```bash
# Database health
curl "{{BASE}}/overlay/health/database"

# Overlay network health
curl "{{BASE}}/overlay/health/overlay"

# Agent marketplace health
curl "{{BASE}}/overlay/health/agents"

# Storage health
curl "{{BASE}}/overlay/health/storage"
```

## Metrics Endpoints

### 1. Comprehensive Metrics API

**Endpoint:** `GET /overlay/metrics`

**Prometheus Format Output:**
```
# HELP overlay_brc22_jobs_total Total BRC-22 jobs processed
# TYPE overlay_brc22_jobs_total counter
overlay_brc22_jobs_total{status="completed"} 1543
overlay_brc22_jobs_total{status="failed"} 23
overlay_brc22_jobs_total{status="in_progress"} 15

# HELP overlay_brc24_lookups_duration_seconds BRC-24 service discovery latency
# TYPE overlay_brc24_lookups_duration_seconds histogram
overlay_brc24_lookups_duration_seconds_bucket{le="0.1"} 145
overlay_brc24_lookups_duration_seconds_bucket{le="0.5"} 892
overlay_brc24_lookups_duration_seconds_bucket{le="1.0"} 1205
overlay_brc24_lookups_duration_seconds_bucket{le="+Inf"} 1234
overlay_brc24_lookups_duration_seconds_sum 456.78
overlay_brc24_lookups_duration_seconds_count 1234

# HELP overlay_brc26_content_resolutions_total BRC-26 UHRP content resolutions
# TYPE overlay_brc26_content_resolutions_total counter
overlay_brc26_content_resolutions_total{method="local"} 2345
overlay_brc26_content_resolutions_total{method="uhrp"} 1876
overlay_brc26_content_resolutions_total{method="s3"} 567

# HELP overlay_brc31_signatures_verified_total BRC-31 signature verifications
# TYPE overlay_brc31_signatures_verified_total counter
overlay_brc31_signatures_verified_total{result="valid"} 4567
overlay_brc31_signatures_verified_total{result="invalid"} 12

# HELP overlay_brc88_advertisements_active Active BRC-88 SHIP/SLAP advertisements
# TYPE overlay_brc88_advertisements_active gauge
overlay_brc88_advertisements_active{type="ship"} 42
overlay_brc88_advertisements_active{type="slap"} 38

# HELP overlay_agent_executions_total Agent job executions
# TYPE overlay_agent_executions_total counter
overlay_agent_executions_total{agent_type="normalization",status="success"} 3456
overlay_agent_executions_total{agent_type="certification",status="success"} 2890
overlay_agent_executions_total{agent_type="storage",status="success"} 1234

# HELP overlay_agent_reputation_score Agent reputation scores
# TYPE overlay_agent_reputation_score gauge
overlay_agent_reputation_score{agent_id="agent_normalize_001"} 95.5
overlay_agent_reputation_score{agent_id="agent_cert_001"} 98.2
overlay_agent_reputation_score{agent_id="agent_storage_001"} 87.8

# HELP overlay_storage_operations_duration_seconds Storage operation latency
# TYPE overlay_storage_operations_duration_seconds histogram
overlay_storage_operations_duration_seconds_bucket{operation="upload",location="local",le="0.1"} 234
overlay_storage_operations_duration_seconds_bucket{operation="download",location="uhrp",le="0.5"} 567

# HELP overlay_network_latency_ms Overlay network communication latency
# TYPE overlay_network_latency_ms gauge
overlay_network_latency_ms{target="consensus_node_1"} 125.5
overlay_network_latency_ms{target="discovery_service"} 89.2

# HELP overlay_event_processing_rate Events processed per second
# TYPE overlay_event_processing_rate gauge
overlay_event_processing_rate{stage="ingestion"} 1250.5
overlay_event_processing_rate{stage="normalization"} 1180.2
overlay_event_processing_rate{stage="certification"} 1156.8

# HELP overlay_compliance_score BRC standards compliance score
# TYPE overlay_compliance_score gauge
overlay_compliance_score{standard="brc22"} 98.5
overlay_compliance_score{standard="brc24"} 99.1
overlay_compliance_score{standard="brc26"} 97.8
overlay_compliance_score{standard="brc31"} 99.9
overlay_compliance_score{standard="brc88"} 96.7
```

### 2. Custom Metrics Formats

**Endpoint:** `GET /overlay/metrics?format=json`

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "metrics": {
    "overlay": {
      "network": {
        "connectedNodes": 25,
        "averageLatency": 120,
        "messagesPerSecond": 450,
        "consensusTime": 2.5
      },
      "brcStandards": {
        "brc22": {
          "jobsTotal": 1543,
          "jobsActive": 15,
          "averageExecutionTime": 450,
          "successRate": 0.985
        },
        "brc24": {
          "lookupsTotal": 1234,
          "averageLatency": 80,
          "cacheHitRate": 0.78,
          "activeServices": 8
        },
        "brc26": {
          "resolutionsTotal": 4788,
          "averageLatency": 200,
          "availabilityScore": 0.97,
          "replicationFactor": 3.2
        },
        "brc31": {
          "verificationsTotal": 4579,
          "averageLatency": 15,
          "successRate": 0.997,
          "activeIdentities": 156
        },
        "brc88": {
          "activeAdvertisements": 80,
          "discoveryLatency": 95,
          "serviceAvailability": 0.98,
          "advertisementTtl": 86400
        }
      }
    },
    "agents": {
      "marketplace": {
        "totalAgents": 23,
        "activeAgents": 18,
        "averageReputation": 87.5,
        "jobsInProgress": 6,
        "totalExecutions": 12345
      },
      "performance": {
        "averageExecutionTime": 850,
        "successRate": 0.94,
        "timeoutRate": 0.02,
        "errorRate": 0.04
      }
    },
    "storage": {
      "operations": {
        "uploadsPerSecond": 45.5,
        "downloadsPerSecond": 123.8,
        "verificationsPerSecond": 67.2
      },
      "performance": {
        "averageUploadTime": 245,
        "averageDownloadTime": 180,
        "cacheHitRate": 0.85,
        "replicationSuccessRate": 0.99
      }
    },
    "events": {
      "ingestion": {
        "eventsPerSecond": 1250,
        "averageLatency": 340,
        "certificationRate": 0.97,
        "backlogSize": 45
      },
      "processing": {
        "normalizationLatency": 120,
        "validationLatency": 80,
        "certificationLatency": 140,
        "consensusLatency": 95
      }
    }
  }
}
```

## Alerting and Monitoring Implementation

### Alert Definitions

```typescript
interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  component: string;
  description: string;
}

const OVERLAY_ALERT_RULES: AlertRule[] = [
  {
    name: 'OverlayNetworkConnectivity',
    condition: 'overlay_network_connected_nodes < 10',
    threshold: 10,
    severity: 'critical',
    component: 'overlay.network',
    description: 'Overlay network has insufficient connected nodes'
  },
  {
    name: 'BRC22JobFailureRate',
    condition: 'overlay_brc22_job_failure_rate > 0.05',
    threshold: 0.05,
    severity: 'warning',
    component: 'overlay.brc22',
    description: 'BRC-22 job failure rate exceeds threshold'
  },
  {
    name: 'BRC26ContentAvailability',
    condition: 'overlay_brc26_availability_score < 0.95',
    threshold: 0.95,
    severity: 'warning',
    component: 'overlay.brc26',
    description: 'BRC-26 UHRP content availability below threshold'
  },
  {
    name: 'AgentMarketplaceHealth',
    condition: 'overlay_agent_active_count < 5',
    threshold: 5,
    severity: 'critical',
    component: 'agents.marketplace',
    description: 'Insufficient active agents in marketplace'
  },
  {
    name: 'EventProcessingBacklog',
    condition: 'overlay_event_backlog_size > 1000',
    threshold: 1000,
    severity: 'warning',
    component: 'events.processing',
    description: 'Event processing backlog is too large'
  },
  {
    name: 'StorageReplicationFailure',
    condition: 'overlay_storage_replication_rate < 0.98',
    threshold: 0.98,
    severity: 'warning',
    component: 'storage.replication',
    description: 'Storage replication success rate below threshold'
  }
];
```

### Monitoring Dashboard Configuration

```typescript
interface DashboardConfig {
  title: string;
  panels: DashboardPanel[];
  refreshInterval: number;
  timeRange: string;
}

const OVERLAY_DASHBOARD: DashboardConfig = {
  title: 'BSV Overlay Network Operations',
  refreshInterval: 30,
  timeRange: '24h',
  panels: [
    {
      title: 'Overlay Network Health',
      type: 'stat',
      metrics: [
        'overlay_network_connected_nodes',
        'overlay_network_latency_avg',
        'overlay_network_consensus_time'
      ]
    },
    {
      title: 'BRC Standards Compliance',
      type: 'gauge',
      metrics: [
        'overlay_compliance_score{standard="brc22"}',
        'overlay_compliance_score{standard="brc24"}',
        'overlay_compliance_score{standard="brc26"}',
        'overlay_compliance_score{standard="brc31"}',
        'overlay_compliance_score{standard="brc88"}'
      ]
    },
    {
      title: 'Agent Marketplace Performance',
      type: 'graph',
      metrics: [
        'overlay_agent_executions_rate',
        'overlay_agent_success_rate',
        'overlay_agent_average_reputation'
      ]
    },
    {
      title: 'Storage Performance',
      type: 'graph',
      metrics: [
        'overlay_storage_operations_rate',
        'overlay_storage_latency_p95',
        'overlay_storage_availability'
      ]
    },
    {
      title: 'Event Processing Pipeline',
      type: 'graph',
      metrics: [
        'overlay_event_ingestion_rate',
        'overlay_event_processing_latency',
        'overlay_event_certification_rate'
      ]
    }
  ]
};
```

## Configuration

### Environment Variables

```bash
# Metrics collection settings
METRICS_ENABLED=true
METRICS_COLLECTION_INTERVAL_SECONDS=30
METRICS_RETENTION_DAYS=30
METRICS_EXPORT_FORMAT="prometheus" # prometheus, json, both

# Health check configuration
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL_SECONDS=60
HEALTH_CHECK_TIMEOUT_SECONDS=10
HEALTH_CHECK_DETAILED=true

# Overlay network monitoring
OVERLAY_METRICS_ENABLED=true
OVERLAY_HEALTH_MONITORING=true
BRC_COMPLIANCE_MONITORING=true
OVERLAY_NETWORK_MONITORING_INTERVAL=30

# Agent performance monitoring
AGENT_PERFORMANCE_TRACKING=true
AGENT_REPUTATION_MONITORING=true
AGENT_EXECUTION_METRICS=true

# Storage monitoring
STORAGE_PERFORMANCE_MONITORING=true
STORAGE_AVAILABILITY_MONITORING=true
UHRP_RESOLUTION_MONITORING=true

# Event processing monitoring
EVENT_PROCESSING_METRICS=true
EVENT_INGESTION_MONITORING=true
EVENT_CERTIFICATION_TRACKING=true

# Alerting configuration
ALERTING_ENABLED=true
ALERT_WEBHOOK_URL=""
ALERT_EMAIL_ENABLED=false
ALERT_SLACK_WEBHOOK=""
```

## Testing Strategy

### Health Check Tests
```bash
# Test basic health endpoint
curl "{{BASE}}/overlay/health"

# Test component-specific health
curl "{{BASE}}/overlay/health/overlay"
curl "{{BASE}}/overlay/health/agents"
curl "{{BASE}}/overlay/health/storage"
```

### Metrics Validation Tests
```bash
# Test Prometheus format
curl "{{BASE}}/overlay/metrics"

# Test JSON format
curl "{{BASE}}/overlay/metrics?format=json"

# Test specific metric queries
curl "{{BASE}}/overlay/metrics?filter=brc22"
```

## Definition of Done (DoD)

### Core Functionality
- [ ] **Comprehensive Health Checks**: All system components monitored with detailed status
- [ ] **BRC Standards Monitoring**: Complete compliance tracking for all BRC standards
- [ ] **Agent Performance Metrics**: Detailed agent marketplace and execution monitoring
- [ ] **Storage Analytics**: Complete storage performance and availability tracking
- [ ] **Event Processing Metrics**: Real-time event ingestion and certification monitoring

### Operational Requirements
- [ ] **Real-time Monitoring**: Sub-minute metric collection and alerting
- [ ] **Historical Analysis**: 30+ days of metrics retention for trend analysis
- [ ] **Automated Alerting**: Proactive alerts for system health issues
- [ ] **Dashboard Integration**: Grafana/Prometheus compatible metrics export

### Quality Assurance
- [ ] **Performance Impact**: <1% overhead on system performance
- [ ] **Reliability**: 99.9% uptime for monitoring infrastructure
- [ ] **Accuracy**: Precise metrics with <1% measurement error
- [ ] **Scalability**: Support for high-volume metric collection

This implementation provides enterprise-grade monitoring and observability for the BSV overlay network infrastructure, ensuring optimal performance and proactive issue detection across all system components.