# D24 — BSV Overlay Agent Marketplace & Automation

Labels: agents, automation, marketplace, overlay, brc-standards
Assignee: TBA
Estimate: 6–8 PT

## Purpose
- Build a distributed agent ecosystem using BSV overlay network: registration via BRC-88 (SHIP/SLAP), capability discovery through BRC-24 lookups, declarative rules/workflows with BRC-22 transaction submission, and secure execution with BRC-31 identity verification.
- Example use cases: "Find resources/events/data matching criteria X → create offer/contract → execute follow-up actions (price setting, payment, notification, publishing via overlay network)".
- Network effect: More agents → more automation → enhanced platform value through overlay network distribution.

## Dependencies
- BSV Overlay Network Integration (implemented)
- BRC-22: Transaction Submission (implemented)
- BRC-24: Lookup Services (implemented)
- BRC-64: History Tracking (implemented)
- BRC-88: Service Discovery (SHIP/SLAP) (implemented)
- BRC-26: Universal Hash Resolution Protocol for file storage (implemented)
- PostgreSQL production database (implemented)
- D01 (DLM1 Submit), D05/D09 (Price/Pricebook), D06/D07 (Pay/Data), D19 (Identity), D21 (BSV Payments)

## Technical Architecture (Overlay-Based)

### Core Components
- **BRC-88 Agent Registry**: Agents advertise capabilities via SHIP advertisements on overlay network
- **BRC-24 Discovery Engine**: Query agents by capability, location, or specialization through lookup providers
- **BRC-22 Rule Execution**: Submit rule executions as overlay transactions with topic-based routing
- **BRC-26 Artifact Storage**: Store contracts, evidence, and outputs via UHRP with overlay distribution
- **BRC-64 Lineage Tracking**: Maintain complete audit trail of agent interactions and data flow
- **Overlay Event Bus**: Real-time agent coordination via overlay network messaging

### Rule DSL (Enhanced for Overlay)
```json
{
  "name": "premium-data-automation",
  "when": {
    "type": "overlay-event",
    "topic": "gitdata.d01a.manifest",
    "predicate": {
      "and": [
        {"lt": {"price": 1000}},
        {"includes": {"tags": "premium"}},
        {"eq": {"classification": "public"}}
      ]
    }
  },
  "find": {
    "source": "overlay-search",
    "topics": ["gitdata.agent.capabilities"],
    "query": {"capability": "contract-generation", "location": "any"},
    "limit": 5
  },
  "then": [
    {
      "action": "overlay.notify",
      "topic": "gitdata.agent.jobs",
      "agentId": "discovered-via-brc24",
      "payload": {"type": "contract-request", "data": "manifest-hash"}
    },
    {
      "action": "brc26.store",
      "type": "contract-template",
      "templateId": "premium-data-agreement",
      "variables": {"datasetId": "${manifest.datasetId}", "price": "${manifest.pricing.satoshis}"}
    },
    {
      "action": "brc22.submit",
      "topic": "gitdata.payment.receipts",
      "transaction": {"type": "payment-escrow", "amount": "${calculated.total}"}
    },
    {
      "action": "overlay.publish",
      "topic": "gitdata.marketplace.offers",
      "manifest": {"type": "automated-offer", "expires": 3600}
    }
  ]
}
```

### Identity & Security (BRC-31 Enhanced)
- All agent communications signed with BRC-31 identity headers
- Overlay network provides additional identity verification layer
- Multi-signature coordination for high-value transactions
- Capability-based access control through BRC-88 advertisements

## Implementation Tasks

### BRC-88 Agent Registry & Discovery
- [x] Basic SHIP/SLAP advertisement infrastructure (implemented)
- [ ] Agent capability registration via BRC-88 SHIP advertisements
- [ ] Enhanced agent profiles with skill ratings, geographic distribution
- [ ] Real-time agent health monitoring through overlay network pings
- [ ] Agent reputation system based on BRC-64 historical performance

### Enhanced BRC-24 Lookup Services
- [x] Basic lookup provider framework (implemented)
- [ ] Agent capability lookup provider
- [ ] Geographic/jurisdiction-aware agent discovery
- [ ] Skill-based routing and load balancing
- [ ] Cross-overlay network agent federation

### Overlay-Aware Rule Engine
- [ ] Rule DSL parser with overlay-specific actions
- [ ] Event subscription via overlay network topics
- [ ] Real-time rule triggering from overlay events
- [ ] Cross-agent workflow coordination
- [ ] Policy enforcement with overlay consensus

### BRC-22 Job Orchestration
- [x] Basic PostgreSQL job queue (via BRC services)
- [ ] Overlay network job distribution
- [ ] Cross-agent job handoffs and coordination
- [ ] Fault tolerance with overlay network redundancy
- [ ] Job lineage tracking via BRC-64

### BRC-26 Artifact Management
- [x] File storage infrastructure (implemented)
- [ ] Contract template storage and versioning
- [ ] Evidence package generation and distribution
- [ ] Cross-overlay artifact synchronization
- [ ] Automated artifact publication via overlay network

### Advanced Features
- [ ] Multi-agent workflows with overlay coordination
- [ ] Real-time agent collaboration via overlay messaging
- [ ] Cross-jurisdiction compliance automation
- [ ] Agent marketplace with overlay-based reputation
- [ ] Automated contract negotiation between agents

## Database Schema (PostgreSQL Enhanced)

```sql
-- Enhanced agent registry with overlay integration
CREATE TABLE IF NOT EXISTS overlay_agents (
  agent_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  overlay_topics TEXT[], -- Topics this agent subscribes to
  ship_advertisement_id TEXT, -- Reference to BRC-88 SHIP ad
  slap_advertisement_id TEXT, -- Reference to BRC-88 SLAP ad
  geographic_region TEXT,
  reputation_score DECIMAL(3,2) DEFAULT 0.0,
  performance_stats JSONB,
  identity_key TEXT,
  webhook_url TEXT,
  status TEXT DEFAULT 'unknown',
  last_ping_at BIGINT,
  overlay_node_id TEXT, -- Overlay network node identifier
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced rules with overlay integration
CREATE TABLE IF NOT EXISTS overlay_rules (
  rule_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  overlay_topics TEXT[], -- Topics to subscribe to
  when_condition JSONB NOT NULL,
  find_strategy JSONB NOT NULL,
  actions JSONB NOT NULL,
  owner_producer_id TEXT,
  execution_stats JSONB,
  last_triggered_at BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced jobs with overlay coordination
CREATE TABLE IF NOT EXISTS overlay_jobs (
  job_id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  target_id TEXT,
  overlay_transaction_id TEXT, -- BRC-22 transaction reference
  state TEXT NOT NULL DEFAULT 'queued',
  assigned_agents TEXT[], -- Array of agent IDs
  coordination_data JSONB, -- Inter-agent coordination state
  attempts INTEGER DEFAULT 0,
  next_run_at BIGINT NOT NULL,
  last_error TEXT,
  evidence_package JSONB, -- BRC-26 stored evidence
  lineage_data JSONB, -- BRC-64 lineage information
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent performance tracking
CREATE TABLE IF NOT EXISTS agent_performance (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  execution_time_ms INTEGER,
  success BOOLEAN,
  quality_score DECIMAL(3,2),
  client_feedback JSONB,
  overlay_confirmation TEXT, -- BRC-22 confirmation
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_overlay_agents_topics ON overlay_agents USING GIN(overlay_topics);
CREATE INDEX IF NOT EXISTS idx_overlay_agents_region ON overlay_agents(geographic_region);
CREATE INDEX IF NOT EXISTS idx_overlay_agents_reputation ON overlay_agents(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_overlay_rules_topics ON overlay_rules USING GIN(overlay_topics);
CREATE INDEX IF NOT EXISTS idx_overlay_jobs_state ON overlay_jobs(state, next_run_at);
CREATE INDEX IF NOT EXISTS idx_overlay_jobs_agents ON overlay_jobs USING GIN(assigned_agents);
CREATE INDEX IF NOT EXISTS idx_agent_performance_agent ON agent_performance(agent_id, recorded_at);
```

## API Endpoints (Enhanced)

### Agent Registration & Discovery
```
POST /overlay/agents/register - Register agent with BRC-88 SHIP advertisement
GET /overlay/agents/search?capability&region&minReputation - BRC-24 lookup
POST /overlay/agents/:id/ping - Health check with overlay confirmation
GET /overlay/agents/:id/reputation - Performance metrics and ratings
PUT /overlay/agents/:id/capabilities - Update capabilities and re-advertise
```

### Rule Management
```
POST /overlay/rules - Create rule with overlay event subscriptions
GET /overlay/rules?topic&enabled - List rules by overlay topic
POST /overlay/rules/:id/trigger - Manual trigger with overlay transaction
PUT /overlay/rules/:id/subscribe - Subscribe rule to additional overlay topics
DELETE /overlay/rules/:id - Disable and unsubscribe from overlay
```

### Job Coordination
```
GET /overlay/jobs?state&agent - List jobs with overlay coordination state
POST /overlay/jobs/:id/assign - Assign job to specific agents
PUT /overlay/jobs/:id/coordinate - Update inter-agent coordination
GET /overlay/jobs/:id/lineage - Get BRC-64 lineage information
POST /overlay/jobs/:id/evidence - Store evidence via BRC-26
```

### Overlay Integration
```
GET /overlay/network/status - Overlay network health and connectivity
POST /overlay/network/broadcast - Broadcast message to agent network
GET /overlay/network/topics - List active overlay topics for agents
POST /overlay/agents/coordinate - Initiate multi-agent workflow
GET /overlay/marketplace/offers - Browse automated marketplace offers
```

## Definition of Done (DoD)
- [ ] Agents register capabilities via BRC-88 SHIP advertisements visible across overlay network
- [ ] Rules automatically trigger from overlay network events and coordinate multi-agent workflows
- [ ] Jobs distribute across overlay network with fault tolerance and evidence tracking via BRC-26/BRC-64
- [ ] All communications authenticated with BRC-31 identity and recorded in overlay transactions
- [ ] Complete audit trail available through BRC-64 lineage tracking and BRC-26 evidence storage
- [ ] Agent reputation system operational with overlay network consensus

## Acceptance Criteria (Tests)

### Happy Path Integration Test
```typescript
describe('Overlay Agent Marketplace E2E', () => {
  test('should complete full agent workflow via overlay network', async () => {
    // 1. Register agent with BRC-88 SHIP advertisement
    const agent = await registerAgentWithOverlay({
      name: 'ContractBot',
      capabilities: ['contract-generation', 'legal-review'],
      region: 'EU',
      overlayTopics: ['gitdata.agent.capabilities', 'gitdata.agent.jobs']
    });

    // 2. Create rule that subscribes to overlay events
    const rule = await createOverlayRule({
      name: 'auto-contract-generation',
      overlayTrigger: {
        topic: 'gitdata.d01a.manifest',
        predicate: { includes: { tags: 'premium' } }
      },
      actions: [
        { action: 'overlay.discover', capability: 'contract-generation' },
        { action: 'brc26.store', type: 'contract-template' },
        { action: 'brc22.submit', topic: 'gitdata.marketplace.offers' }
      ]
    });

    // 3. Publish manifest that triggers rule via overlay
    const manifest = await publishManifestToOverlay({
      datasetId: 'premium-data-001',
      tags: ['premium', 'financial'],
      classification: 'public'
    });

    // 4. Wait for overlay network propagation and rule triggering
    await waitForOverlayPropagation(1000);

    // 5. Verify agent discovered via BRC-24 lookup
    const discoveredAgents = await queryOverlayAgents({
      capability: 'contract-generation',
      region: 'EU'
    });
    expect(discoveredAgents).toContain(agent.id);

    // 6. Verify job created and distributed via overlay
    const jobs = await getOverlayJobs({ state: 'queued', agentId: agent.id });
    expect(jobs.length).toBeGreaterThan(0);

    // 7. Simulate agent execution with BRC-31 signature
    const execution = await executeAgentJob(jobs[0].id, {
      agentId: agent.id,
      signature: await signWithBRC31(jobs[0]),
      artifacts: [
        { type: 'contract/pdf', hash: 'brc26-stored-hash' }
      ]
    });

    // 8. Verify evidence stored via BRC-26 and lineage via BRC-64
    const evidence = await getJobEvidence(jobs[0].id);
    expect(evidence.brc26Artifacts).toBeDefined();
    expect(evidence.brc64Lineage).toBeDefined();

    // 9. Verify final transaction submitted via BRC-22
    const overlayTx = await getOverlayTransaction(execution.txId);
    expect(overlayTx.topics).toContain('gitdata.marketplace.offers');
  });
});
```

### Fault Tolerance Test
```typescript
test('should handle agent failures with overlay redundancy', async () => {
  // Register multiple agents with same capability
  const agents = await Promise.all([
    registerAgentWithOverlay({ name: 'Agent1', capabilities: ['data-processing'] }),
    registerAgentWithOverlay({ name: 'Agent2', capabilities: ['data-processing'] }),
    registerAgentWithOverlay({ name: 'Agent3', capabilities: ['data-processing'] })
  ]);

  // Create job requiring data-processing capability
  const job = await createOverlayJob({
    capability: 'data-processing',
    redundancy: 2, // Require 2 successful executions
    timeout: 30000
  });

  // Simulate first agent failure
  await simulateAgentFailure(agents[0].id);

  // Verify job automatically redistributed to other agents
  await waitForJobRedistribution(5000);

  const updatedJob = await getOverlayJob(job.id);
  expect(updatedJob.assignedAgents).not.toContain(agents[0].id);
  expect(updatedJob.assignedAgents).toHaveLength(2);

  // Verify successful completion despite failure
  await waitForJobCompletion(job.id, 30000);
  const finalJob = await getOverlayJob(job.id);
  expect(finalJob.state).toBe('done');
  expect(finalJob.evidencePackage.successfulExecutions).toBe(2);
});
```

### Performance & Scalability Test
```typescript
test('should handle high-volume agent coordination', async () => {
  // Register 100 agents across different regions
  const agents = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      registerAgentWithOverlay({
        name: `Agent${i}`,
        capabilities: ['batch-processing'],
        region: i % 5 === 0 ? 'US' : i % 5 === 1 ? 'EU' : i % 5 === 2 ? 'APAC' : i % 5 === 3 ? 'LATAM' : 'MEA'
      })
    )
  );

  // Create rule that generates 1000 parallel jobs
  const rule = await createOverlayRule({
    name: 'mass-batch-processing',
    batchSize: 1000,
    parallelism: 50,
    actions: [
      { action: 'overlay.distribute', capability: 'batch-processing' },
      { action: 'brc22.submit', topic: 'gitdata.batch.results' }
    ]
  });

  const startTime = Date.now();

  // Trigger mass job creation
  await triggerOverlayRule(rule.id);

  // Wait for all jobs to complete
  await waitForBatchCompletion(rule.id, 120000);

  const duration = Date.now() - startTime;
  const completedJobs = await getCompletedJobs(rule.id);

  expect(completedJobs).toHaveLength(1000);
  expect(duration).toBeLessThan(120000); // Complete within 2 minutes

  // Verify overlay network handled the load
  const overlayStats = await getOverlayNetworkStats();
  expect(overlayStats.transactionThroughput).toBeGreaterThan(8.33); // >8.33 tx/sec
  expect(overlayStats.errorRate).toBeLessThan(0.01); // <1% error rate
});
```

## Environment Configuration

```bash
# Overlay Network Configuration
OVERLAY_ENABLED=true
OVERLAY_ENV=production
OVERLAY_DOMAIN=gitdata.example.com
OVERLAY_STORAGE_PATH=/data/overlay/uhrp-storage
OVERLAY_BASE_URL=https://gitdata.example.com

# PostgreSQL Configuration (Required for Production)
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=overlay
PG_USER=postgres
PG_PASSWORD=secret
PG_POOL_MIN=5
PG_POOL_MAX=50

# Agent System Configuration
AGENT_IDENTITY_REQUIRED=true
AGENT_CALL_PRIVKEY=0123456789abcdef... # BRC-31 signing key
RULES_MAX_CONCURRENCY=100
JOB_RETRY_MAX=5
JOB_BACKOFF_BASE_MS=1000
JOB_BACKOFF_FACTOR=2
JOB_BACKOFF_MAX_MS=30000
CALLBACK_TIMEOUT_MS=15000

# BRC Standards Configuration
BRC22_TOPIC_PREFIXES=gitdata.agent,gitdata.marketplace
BRC24_LOOKUP_PROVIDERS=agent-discovery,capability-search
BRC26_STORAGE_ENCRYPTION=true
BRC64_LINEAGE_DEPTH=10
BRC88_ADVERTISEMENT_TTL=86400

# Performance & Security
AGENT_REPUTATION_DECAY_RATE=0.95
AGENT_MAX_CONCURRENT_JOBS=10
OVERLAY_NETWORK_TIMEOUT_MS=5000
EVIDENCE_RETENTION_DAYS=365
AUDIT_LOG_LEVEL=info
```

## Risks & Mitigation

### Overlay Network Dependencies
- **Risk**: Overlay network connectivity issues could disrupt agent coordination
- **Mitigation**: Local fallback queues, offline capability detection, graceful degradation

### Agent Trust & Reputation
- **Risk**: Malicious or unreliable agents could corrupt workflows
- **Mitigation**: Multi-signature requirements, reputation scoring, capability bonds

### Cross-Jurisdiction Compliance
- **Risk**: Agents operating across jurisdictions may violate regulations
- **Mitigation**: Geographic capability constraints, jurisdiction-aware routing, compliance agents

### Performance at Scale
- **Risk**: High-volume coordination could overwhelm overlay network
- **Mitigation**: Job batching, regional distribution, overlay network sharding

## Implementation Priority

1. **Phase 1**: Basic overlay agent registration and discovery via BRC-88/BRC-24
2. **Phase 2**: Rule engine with overlay event subscription and BRC-22 job submission
3. **Phase 3**: Multi-agent coordination and BRC-26 evidence management
4. **Phase 4**: Advanced features (reputation, cross-jurisdiction, real-time collaboration)

This enhanced specification leverages the complete BSV overlay infrastructure with all BRC standards to create a truly distributed, scalable, and secure agent marketplace that can operate across the global overlay network.