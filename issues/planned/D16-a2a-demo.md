# D16 — BSV Overlay Network Agent-to-Agent (A2A) Value Chain Demonstration

**Labels:** demo, e2e, autonomy, audit-trail, overlay, brc-standards
**Assignee:** TBA
**Estimate:** 2 PT

## 1) Purpose

This demonstration showcases a complete, end-to-end value chain orchestrated by autonomous AI agents on the BSV overlay network. The system leverages BRC standards for distributed agent coordination and creates a cryptographically secured audit trail.

**Key Objectives:**
- Agents make autonomous decisions via overlay network coordination
- Complete audit trail secured by BRC standards and overlay network
- Generic framework applicable across domains
- Production-ready PostgreSQL backend with overlay integration

## 2) Component Overview

### BSV Overlay Network Integration (D24)
- **Agent Registry**: `/overlay/agents/register`, `/overlay/agents/search`, `/overlay/agents/:id/status`
- **Rule Engine**: `/overlay/rules` CRUD + `/overlay/rules/:id/execute`
- **Job Coordination**: `/overlay/jobs` (distributed job orchestration)
- **Network Status**: `/overlay/network/status`, `/overlay/marketplace/offers`
- **Agent Coordination**: `/overlay/agents/coordinate` (multi-agent workflows)

### BRC Standards Implementation
- **BRC-22**: Job orchestration and task distribution
- **BRC-24**: Agent discovery and lookup services
- **BRC-64**: Transaction verification for payments
- **BRC-88**: SHIP/SLAP advertising and service discovery
- **BRC-26**: Universal Hash Resolution Protocol for file storage
- **BRC-31**: Identity verification and message signing

### Database Architecture
- **PostgreSQL**: Production-ready database with overlay integration
- **Hybrid Support**: Falls back to SQLite for development
- **Connection Pooling**: Optimized for high-throughput operations
- **Event Storage**: Comprehensive audit trail with BRC evidence

### Security & Compliance
- **BRC-31 Signatures**: All webhook calls signed with secp256k1
- **Overlay Identity**: Agents verified through overlay network identity
- **Evidence Chain**: Complete cryptographic audit trail
- **Multi-signature Support**: Enhanced security for critical operations

## 3) Prerequisites

- Overlay network enabled: `OVERLAY_ENABLED=true`
- PostgreSQL running: `PG_HOST=localhost PG_PORT=5432 PG_DATABASE=overlay`
- Redis for caching: `REDIS_URL=redis://localhost:6379`
- Example agent running: `npm run agent:example` (listens on http://localhost:9099/webhook)
- Environment variables:
  ```bash
  OVERLAY_ENABLED=true
  PG_HOST=localhost
  PG_PORT=5432
  PG_DATABASE=overlay
  PG_USER=postgres
  PG_PASSWORD=password
  REDIS_URL=redis://localhost:6379
  OVERLAY_PORT=8788
  ```

## 4) Actors (Abstract)

- **Agent A (Producer)**: Creates initial artifact using BRC-88 service advertisement
- **Agent B (Processor)**: Discovers A via BRC-24 lookup, processes and enhances data
- **Agent C (Analyst)**: Discovers B, creates final report with complete lineage
- **Overlay Network**: Provides distributed coordination via BRC standards
- **Operator (Human)**: Initiates demo, monitors overlay network status, verifies audit trail

## 5) Data Flow Variants

### Standard Flow (Overlay Network)
- Events orchestrated through overlay network using BRC-22 job coordination
- Agents communicate via BRC-31 signed webhooks
- Files stored using BRC-26 Universal Hash Resolution Protocol
- Service discovery through BRC-88 SHIP/SLAP advertisements

### Enhanced Flow (Full BSV Integration)
- Agents publish artifacts to overlay network with BSV transaction anchoring
- Payments processed through BRC-64 transaction verification
- Complete audit trail with SPV proofs and overlay evidence
- Multi-agent coordination with distributed consensus

## 6) Step-by-Step Runbook

### 6.1 Setup and Agent Registration

**Register Agent A:**
```bash
curl -X POST "{{BASE}}/overlay/agents/register" -H "content-type: application/json" -d '{
  "name": "OverlayAgent-A",
  "capabilities": [
    {
      "name": "data-processing",
      "inputs": ["raw-data"],
      "outputs": ["processed-data"]
    }
  ],
  "webhookUrl": "http://localhost:9099/webhook",
  "geographicRegion": "US",
  "overlayTopics": ["gitdata.agent.capabilities", "gitdata.d01a.manifest"]
}'
```

**Response contains:** `agentId`, `shipAdvertisementId`, `overlayTopics`

**Verify Registration:**
```bash
curl -X GET "{{BASE}}/overlay/agents/search?capability=data-processing&region=US"
```

### 6.2 Create Overlay Rule for Agent A

**Create Rule R_A:**
```bash
curl -X POST "{{BASE}}/overlay/rules" -H "content-type: application/json" -d '{
  "name": "R_A_DataProcessor",
  "overlayTopics": ["gitdata.d01a.manifest"],
  "whenCondition": {
    "type": "overlay-event",
    "topic": "gitdata.d01a.manifest",
    "predicate": {
      "and": [
        {"includes": {"tags": "raw-data"}},
        {"eq": {"classification": "public"}}
      ]
    }
  },
  "findStrategy": {
    "source": "agent-registry",
    "query": {"capability": "data-processing"},
    "limit": 3
  },
  "actions": [
    {
      "action": "overlay.notify",
      "capability": "data-processing",
      "payload": {"type": "data-processing-request"}
    }
  ]
}'
```

**Response:** `ruleId`, `overlaySubscriptions`, `brc22JobTemplate`

### 6.3 Trigger Rule Execution

**Execute Rule:**
```bash
curl -X POST "{{BASE}}/overlay/rules/{ruleId}/execute"
```

**Response:** `jobsCreated`, `overlayEventsPublished`, `agentsNotified`

### 6.4 Monitor Jobs and Overlay Network

**List Active Jobs:**
```bash
curl -X GET "{{BASE}}/overlay/jobs"
```

**Check Network Status:**
```bash
curl -X GET "{{BASE}}/overlay/network/status"
```

**Expected Evidence:**
- Jobs transition: `queued` → `running` → `completed`
- BRC-31 signature verification in `evidence_json`
- Overlay network propagation logs
- Agent response with `ok: true` and BRC-31 signature

### 6.5 Agent B - Processing Chain

**Register Agent B:**
```bash
curl -X POST "{{BASE}}/overlay/agents/register" -H "content-type: application/json" -d '{
  "name": "OverlayAgent-B",
  "capabilities": [
    {
      "name": "data-enhancement",
      "inputs": ["processed-data"],
      "outputs": ["enhanced-data"]
    }
  ],
  "webhookUrl": "http://localhost:9099/webhook",
  "overlayTopics": ["gitdata.agent.capabilities"]
}'
```

**Create Chain Rule R_B:**
```bash
curl -X POST "{{BASE}}/overlay/rules" -H "content-type: application/json" -d '{
  "name": "R_B_DataEnhancer",
  "overlayTopics": ["gitdata.agent.results"],
  "whenCondition": {
    "type": "overlay-event",
    "topic": "gitdata.agent.results",
    "predicate": {
      "and": [
        {"eq": {"sourceAgent": "OverlayAgent-A"}},
        {"eq": {"status": "completed"}}
      ]
    }
  },
  "findStrategy": {
    "source": "agent-registry",
    "query": {"capability": "data-enhancement"},
    "limit": 1
  },
  "actions": [
    {
      "action": "overlay.notify",
      "capability": "data-enhancement",
      "payload": {"type": "enhancement-request", "parentResult": "{eventData.resultId}"}
    }
  ]
}'
```

### 6.6 Multi-Agent Coordination

**Coordinate Agents A and B:**
```bash
curl -X POST "{{BASE}}/overlay/agents/coordinate" -H "content-type: application/json" -d '{
  "agentIds": ["{agentIdA}", "{agentIdB}"],
  "workflow": "sequential",
  "coordination": {
    "task": "data-processing-pipeline",
    "parameters": {
      "inputData": "sample-dataset-001",
      "outputFormat": "enhanced-json"
    }
  },
  "timeout": 30000
}'
```

**Response:** `coordinationId`, `workflowState`, `agentAssignments`

### 6.7 Complete Audit Trail

**Retrieve Job Evidence:**
```bash
curl -X GET "{{BASE}}/overlay/jobs/{jobId}/evidence"
```

**Get Network Activity:**
```bash
curl -X GET "{{BASE}}/overlay/network/activity?timeRange=1h"
```

**Verify BRC-31 Signatures:**
```bash
curl -X GET "{{BASE}}/overlay/agents/{agentId}/signatures"
```

**Expected Audit Trail:**
- Complete BRC-22 job orchestration logs
- BRC-24 agent discovery and selection records
- BRC-31 identity verification for all communications
- BRC-88 service advertisement and discovery logs
- Overlay network propagation and consensus evidence

## 7) BRC Standards Integration Verification

### BRC-22 Job Orchestration
- Verify job creation, distribution, and completion tracking
- Check task dependency resolution and workflow coordination
- Validate retry mechanisms and failure handling

### BRC-24 Agent Discovery
- Test agent search and filtering capabilities
- Verify service capability matching
- Validate geographic and topic-based routing

### BRC-31 Identity Verification
- Confirm all webhook calls are properly signed
- Verify signature validation on agent responses
- Check identity key distribution and management

### BRC-88 Service Advertisement
- Validate SHIP advertisement creation and propagation
- Test SLAP service lookup and discovery
- Verify service availability and health monitoring

## 8) Definition of Done (DoD)

### Overlay Network Integration
- [ ] All agents registered with BRC-88 SHIP advertisements
- [ ] Agent discovery working via BRC-24 lookup services
- [ ] Rules executing with overlay event subscriptions
- [ ] Jobs completing with BRC-22 orchestration evidence
- [ ] Multi-agent coordination functioning correctly

### Evidence and Compliance
- [ ] All webhook calls signed with BRC-31 and verified
- [ ] Complete audit trail stored in PostgreSQL
- [ ] Overlay network activity properly logged
- [ ] Evidence includes BRC standard compliance proofs

### Performance and Reliability
- [ ] PostgreSQL connection pooling working efficiently
- [ ] Redis caching improving response times
- [ ] Overlay network health monitoring active
- [ ] Graceful handling of agent failures and network partitions

## 9) Advanced Features

### File Storage with BRC-26
- Static file storage (PDF, TXT) via Universal Hash Resolution Protocol
- Content addressing with cryptographic hash verification
- Distributed file availability across overlay network nodes

### Economic Integration
- Optional BSV micropayments for agent services
- Revenue tracking and agent reputation scoring
- Market-based pricing for computational resources

### Governance and Policies
- Agent behavior policies enforced via overlay network
- Resource limits and rate limiting per agent
- Compliance monitoring and automated reporting

## 10) Testing and Validation

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
NODE_ENV=test VITEST=true npx vitest run --config vitest.integration.config.ts test/integration/d24-agent-marketplace-basic.spec.ts
```

### Full Overlay Tests
```bash
NODE_ENV=test VITEST=true timeout 60 npx vitest run --config vitest.integration.config.ts test/integration/d24-marketplace.spec.ts
```

## 11) Environment Configuration

### Development
```bash
OVERLAY_ENABLED=true
OVERLAY_ENV=development
NODE_ENV=development
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=overlay
REDIS_URL=redis://localhost:6379
```

### Production
```bash
OVERLAY_ENABLED=true
OVERLAY_ENV=production
NODE_ENV=production
PG_HOST=production-db-host
PG_PORT=5432
PG_DATABASE=overlay_prod
REDIS_URL=redis://production-redis:6379
```

## 12) Migration from Legacy A2A

The previous SQLite-based A2A implementation has been completely replaced with this overlay network approach. Key improvements:

- **Distributed Architecture**: No single point of failure
- **BRC Standards Compliance**: Industry-standard protocols
- **PostgreSQL Scale**: Production-ready database backend
- **Enhanced Security**: BRC-31 identity verification
- **Network Effects**: Benefits from BSV overlay network participation

This implementation provides a robust foundation for autonomous agent coordination while maintaining full compatibility with BSV overlay network standards and protocols.