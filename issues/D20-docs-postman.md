# D20 — BSV Overlay Network API Documentation & Testing

**Labels:** docs, api, qa, overlay, brc-standards, developer-experience
**Assignee:** TBA
**Estimate:** 4-5 PT

## Purpose

Create comprehensive developer documentation and automated testing infrastructure for the BSV overlay network API ecosystem. This includes detailed guides for all BRC standards, complete Postman collections with overlay integration, and automated validation pipelines for the distributed agent marketplace.

## Dependencies

- **BSV Overlay Services**: Complete overlay network with all BRC standards implemented
- **Agent Marketplace**: Full D24 agent marketplace implementation with overlay integration
- **PostgreSQL Backend**: Production database with all overlay and BRC tables
- **Storage System**: BRC-26 UHRP implementation with multi-location storage
- **Event Processing**: Real-time event ingestion and certification system

## Architecture Overview

### Documentation & Testing Architecture
1. **API Documentation**: Complete OpenAPI 3.0 specifications for all overlay endpoints
2. **Developer Guides**: Step-by-step tutorials for BSV overlay network integration
3. **Postman Collections**: Comprehensive test suites for all BRC standards and workflows
4. **Automated Testing**: CI/CD pipeline with Newman for continuous API validation
5. **SDK Examples**: Code samples in multiple languages for overlay network integration

### Documentation Stack
```
OpenAPI Specs → Interactive Docs → Postman Collections → Newman Tests → CI/CD
     ↓              ↓                    ↓               ↓           ↓
   Swagger UI    Developer Portal    Test Automation   Validation   Quality Gate
```

## Documentation Structure

### 1. BSV Overlay Network Developer Portal

**Main Documentation Sections:**

#### Getting Started Guide
```markdown
# BSV Overlay Network Developer Guide

## Quick Start (15-minute setup)

### 1. Environment Setup
```bash
# Clone and configure overlay network
git clone https://github.com/your-org/bsv-overlay-network.git
cd bsv-overlay-network

# Configure environment
cp .env.example .env
# Edit .env with your settings:
# OVERLAY_ENABLED=true
# PG_HOST=localhost
# PG_DATABASE=overlay
# REDIS_URL=redis://localhost:6379
```

### 2. Start Overlay Services
```bash
# Start database and redis
docker-compose up -d postgres redis

# Initialize database
npm run setup:database

# Start overlay network
npm run dev
```

### 3. Register Your First Agent
```bash
curl -X POST "http://localhost:8788/overlay/agents/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "HelloWorldAgent",
    "capabilities": [
      {
        "name": "data-processing",
        "inputs": ["raw-data"],
        "outputs": ["processed-data"]
      }
    ],
    "webhookUrl": "http://localhost:9099/webhook",
    "overlayTopics": ["gitdata.agent.capabilities"]
  }'
```

### 4. Create Your First Overlay Rule
```bash
curl -X POST "http://localhost:8788/overlay/rules" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "HelloWorldRule",
    "overlayTopics": ["gitdata.d01a.manifest"],
    "whenCondition": {
      "type": "overlay-event",
      "topic": "gitdata.d01a.manifest"
    },
    "findStrategy": {
      "source": "agent-registry",
      "query": {"capability": "data-processing"}
    },
    "actions": [
      {
        "action": "overlay.notify",
        "capability": "data-processing"
      }
    ]
  }'
```
```

#### BRC Standards Integration Guide
```markdown
# BRC Standards Implementation Guide

## BRC-22: Job Orchestration
Learn how to create and manage distributed jobs across the overlay network.

### Basic Job Creation
```javascript
const job = await overlay.brc22.createJob({
  jobType: 'data-processing',
  targetAgents: ['agent_001', 'agent_002'],
  payload: { inputData: 'sample-data' },
  consensus: { required: true, threshold: 2 }
});
```

## BRC-24: Service Discovery
Discover and connect to services across the overlay network.

### Service Lookup
```javascript
const services = await overlay.brc24.findServices({
  capability: 'data-processing',
  geographicRegion: 'US',
  minimumReputation: 80
});
```

## BRC-26: Universal Hash Resolution Protocol
Store and retrieve content using distributed hash resolution.

### Content Storage and Retrieval
```javascript
// Store content
const result = await overlay.brc26.storeContent(buffer, {
  classification: 'public',
  replicationFactor: 3
});

// Retrieve content
const content = await overlay.brc26.resolveContent(contentHash);
```

## BRC-31: Identity Verification
Implement cryptographic identity verification for secure communications.

### Message Signing and Verification
```javascript
// Sign message
const signature = await overlay.brc31.signMessage(message, privateKey);

// Verify signature
const isValid = await overlay.brc31.verifySignature(
  message,
  signature,
  publicKey
);
```

## BRC-88: Service Advertisement
Advertise and discover services using SHIP/SLAP protocols.

### Service Advertisement
```javascript
// Create SHIP advertisement
const advertisement = await overlay.brc88.createSHIPAdvertisement({
  serviceType: 'data-processing',
  capabilities: ['normalization', 'validation'],
  endpoint: 'https://api.example.com/process'
});
```
```

### 2. API Reference Documentation

**OpenAPI 3.0 Specification (Excerpt):**

```yaml
openapi: 3.0.3
info:
  title: BSV Overlay Network API
  description: Complete API for BSV overlay network with BRC standards integration
  version: 1.0.0
  contact:
    name: BSV Overlay Network Support
    url: https://docs.overlay-network.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.overlay-network.com
    description: Production server
  - url: https://staging-api.overlay-network.com
    description: Staging server
  - url: http://localhost:8788
    description: Local development server

tags:
  - name: Agent Marketplace
    description: D24 agent marketplace operations
  - name: BRC-22
    description: Job orchestration and distributed task management
  - name: BRC-24
    description: Service discovery and lookup operations
  - name: BRC-26
    description: Universal Hash Resolution Protocol (UHRP)
  - name: BRC-31
    description: Identity verification and message signing
  - name: BRC-88
    description: Service advertisement (SHIP/SLAP)
  - name: Storage
    description: Distributed storage operations
  - name: Events
    description: Real-time event ingestion and processing
  - name: Search
    description: Content discovery and resolution
  - name: Monitoring
    description: Health checks and metrics

paths:
  /overlay/agents/register:
    post:
      tags: [Agent Marketplace]
      summary: Register a new agent in the marketplace
      description: Register an agent with capabilities and overlay network integration
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AgentRegistration'
            example:
              name: "DataProcessingAgent"
              capabilities:
                - name: "data-normalization"
                  inputs: ["raw-data"]
                  outputs: ["normalized-data"]
              webhookUrl: "https://agent.example.com/webhook"
              overlayTopics: ["gitdata.agent.capabilities"]
              geographicRegion: "US"
      responses:
        '200':
          description: Agent registered successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AgentRegistrationResponse'

  /overlay/storage/upload:
    post:
      tags: [Storage, BRC-26]
      summary: Upload content with UHRP integration
      description: Store content across overlay network with BRC-26 UHRP addressing
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                metadata:
                  $ref: '#/components/schemas/ContentMetadata'
      responses:
        '200':
          description: Content uploaded successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/StorageUploadResponse'

components:
  schemas:
    AgentRegistration:
      type: object
      required: [name, capabilities, webhookUrl]
      properties:
        name:
          type: string
          description: Agent name
        capabilities:
          type: array
          items:
            $ref: '#/components/schemas/AgentCapability'
        webhookUrl:
          type: string
          format: uri
          description: Webhook endpoint for agent communication
        overlayTopics:
          type: array
          items:
            type: string
          description: Overlay network topics the agent subscribes to
        geographicRegion:
          type: string
          description: Geographic region for agent operation

    AgentCapability:
      type: object
      required: [name, inputs, outputs]
      properties:
        name:
          type: string
          description: Capability identifier
        inputs:
          type: array
          items:
            type: string
          description: Input data types
        outputs:
          type: array
          items:
            type: string
          description: Output data types

  securitySchemes:
    BRC31Signature:
      type: apiKey
      in: header
      name: X-Signature
      description: BRC-31 cryptographic signature
```

## Postman Collections

### 1. Main Collection: BSV Overlay Network API

**Collection Structure:**
```
BSV Overlay Network API/
├── 🚀 Quick Start/
│   ├── Health Check
│   ├── Agent Registration
│   ├── Simple Rule Creation
│   └── Content Upload
├── 🤖 Agent Marketplace (D24)/
│   ├── Agent Registration
│   ├── Agent Search
│   ├── Agent Coordination
│   ├── Rule Management
│   └── Job Monitoring
├── 📋 BRC-22 Job Orchestration/
│   ├── Create Distributed Job
│   ├── Monitor Job Progress
│   ├── Agent Assignment
│   └── Consensus Management
├── 🔍 BRC-24 Service Discovery/
│   ├── Service Lookup
│   ├── Capability Search
│   ├── Geographic Filtering
│   └── Service Health Check
├── 📦 BRC-26 UHRP Storage/
│   ├── Content Upload
│   ├── Content Resolution
│   ├── Multi-location Storage
│   └── Replication Status
├── 🔐 BRC-31 Identity/
│   ├── Identity Registration
│   ├── Message Signing
│   ├── Signature Verification
│   └── Key Management
├── 📡 BRC-88 Service Advertisement/
│   ├── SHIP Advertisement
│   ├── SLAP Discovery
│   ├── Service Availability
│   └── Advertisement Management
├── 🗂️ Search & Discovery/
│   ├── Content Search
│   ├── Agent Discovery
│   ├── Service Resolution
│   └── Advanced Filtering
├── ⚡ Real-time Events/
│   ├── Event Ingestion
│   ├── Stream Subscription
│   ├── Event Certification
│   └── Processing Pipeline
├── 📊 Monitoring & Health/
│   ├── System Health
│   ├── Component Status
│   ├── Performance Metrics
│   └── Alert Management
└── 🧪 End-to-End Workflows/
    ├── Complete Agent Workflow
    ├── Data Processing Pipeline
    ├── Content Distribution
    └── Multi-Agent Coordination
```

### 2. Environment Configuration

**Production Environment:**
```json
{
  "id": "prod-env",
  "name": "BSV Overlay Network - Production",
  "values": [
    {
      "key": "BASE_URL",
      "value": "https://api.overlay-network.com",
      "enabled": true
    },
    {
      "key": "OVERLAY_ENABLED",
      "value": "true",
      "enabled": true
    },
    {
      "key": "API_VERSION",
      "value": "v1",
      "enabled": true
    },
    {
      "key": "IDENTITY_KEY",
      "value": "{{$randomAlphaNumeric}}",
      "enabled": true
    },
    {
      "key": "WEBHOOK_URL",
      "value": "https://webhook.site/unique-id",
      "enabled": true
    }
  ]
}
```

**Local Development Environment:**
```json
{
  "id": "local-env",
  "name": "BSV Overlay Network - Local",
  "values": [
    {
      "key": "BASE_URL",
      "value": "http://localhost:8788",
      "enabled": true
    },
    {
      "key": "OVERLAY_ENABLED",
      "value": "true",
      "enabled": true
    },
    {
      "key": "PG_HOST",
      "value": "localhost",
      "enabled": true
    },
    {
      "key": "REDIS_URL",
      "value": "redis://localhost:6379",
      "enabled": true
    },
    {
      "key": "WEBHOOK_URL",
      "value": "http://localhost:9099/webhook",
      "enabled": true
    }
  ]
}
```

### 3. Example Requests with Tests

**Agent Registration Request:**
```javascript
// Pre-request Script
const agentName = `TestAgent_${Date.now()}`;
pm.environment.set("agentName", agentName);

// Request Body
{
  "name": "{{agentName}}",
  "capabilities": [
    {
      "name": "data-processing",
      "inputs": ["raw-data"],
      "outputs": ["processed-data"]
    }
  ],
  "webhookUrl": "{{WEBHOOK_URL}}",
  "overlayTopics": ["gitdata.agent.capabilities"],
  "geographicRegion": "US"
}

// Tests
pm.test("Agent registration successful", function () {
    pm.response.to.have.status(200);
});

pm.test("Response contains agent ID", function () {
    const response = pm.response.json();
    pm.expect(response.agentId).to.be.a('string');
    pm.environment.set("agentId", response.agentId);
});

pm.test("SHIP advertisement created", function () {
    const response = pm.response.json();
    pm.expect(response.shipAdvertisementId).to.be.a('string');
});

pm.test("Overlay topics configured", function () {
    const response = pm.response.json();
    pm.expect(response.overlayTopics).to.include("gitdata.agent.capabilities");
});
```

**BRC-26 Content Upload Request:**
```javascript
// Pre-request Script
const contentHash = CryptoJS.SHA256("test content").toString();
pm.environment.set("contentHash", contentHash);

// Tests
pm.test("Content upload successful", function () {
    pm.response.to.have.status(200);
});

pm.test("UHRP URL generated", function () {
    const response = pm.response.json();
    pm.expect(response.storage.overlay.uhrpUrl).to.match(/^uhrp:\/\//);
});

pm.test("Multiple storage locations", function () {
    const response = pm.response.json();
    pm.expect(response.storage).to.have.property('local');
    pm.expect(response.storage).to.have.property('overlay');
});

pm.test("Content hash matches", function () {
    const response = pm.response.json();
    pm.expect(response.contentHash).to.equal(pm.environment.get("contentHash"));
});
```

## Automated Testing Pipeline

### 1. Newman CI/CD Integration

**GitHub Actions Workflow:**
```yaml
name: API Testing with Newman

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 */6 * * *'  # Run every 6 hours

jobs:
  api-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: overlay_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Setup test database
      run: |
        npm run setup:database
      env:
        PG_HOST: localhost
        PG_PORT: 5432
        PG_DATABASE: overlay_test
        PG_USER: postgres
        PG_PASSWORD: password
        REDIS_URL: redis://localhost:6379

    - name: Start overlay network
      run: |
        npm run dev &
        sleep 30  # Wait for server to start
      env:
        OVERLAY_ENABLED: true
        NODE_ENV: test
        PG_HOST: localhost
        PG_DATABASE: overlay_test
        REDIS_URL: redis://localhost:6379

    - name: Run Newman tests
      run: |
        npx newman run postman/BSV-Overlay-Network-API.postman_collection.json \
          -e postman/environments/test.postman_environment.json \
          --reporters cli,junit,htmlextra \
          --reporter-junit-export test-results/newman-results.xml \
          --reporter-htmlextra-export test-results/newman-report.html \
          --delay-request 250 \
          --timeout-request 30000 \
          --bail

    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: newman-test-results
        path: test-results/

    - name: Publish test results
      uses: dorny/test-reporter@v1
      if: always()
      with:
        name: Newman API Tests
        path: test-results/newman-results.xml
        reporter: java-junit
```

### 2. Test Data Management

**Golden Vectors for Testing:**
```json
{
  "testVectors": {
    "agents": [
      {
        "name": "TestNormalizationAgent",
        "capabilities": [
          {
            "name": "data-normalization",
            "inputs": ["raw-json", "csv"],
            "outputs": ["normalized-json"]
          }
        ],
        "expectedResponseFields": ["agentId", "shipAdvertisementId", "overlayTopics"]
      }
    ],
    "content": [
      {
        "description": "Small text file",
        "data": "Hello, BSV Overlay Network!",
        "expectedContentHash": "sha256:a1b2c3d4...",
        "expectedStorageLocations": ["local", "overlay"]
      }
    ],
    "brcStandards": {
      "brc31": {
        "validSignature": {
          "message": "test message",
          "privateKey": "L1...private-key...",
          "expectedSignature": "304502...signature..."
        }
      }
    }
  }
}
```

## Code Examples and SDKs

### 1. JavaScript/TypeScript SDK Example

```typescript
import { OverlayNetworkClient } from '@bsv/overlay-network-sdk';

// Initialize client
const client = new OverlayNetworkClient({
  baseUrl: 'https://api.overlay-network.com',
  identityKey: 'your-brc31-identity-key',
  overlayEnabled: true
});

// Register agent
const agent = await client.agents.register({
  name: 'MyProcessingAgent',
  capabilities: [
    {
      name: 'data-processing',
      inputs: ['raw-data'],
      outputs: ['processed-data']
    }
  ],
  webhookUrl: 'https://my-agent.com/webhook',
  overlayTopics: ['gitdata.agent.capabilities']
});

// Create overlay rule
const rule = await client.rules.create({
  name: 'ProcessingRule',
  overlayTopics: ['gitdata.d01a.manifest'],
  whenCondition: {
    type: 'overlay-event',
    topic: 'gitdata.d01a.manifest'
  },
  findStrategy: {
    source: 'agent-registry',
    query: { capability: 'data-processing' }
  },
  actions: [
    {
      action: 'overlay.notify',
      capability: 'data-processing'
    }
  ]
});

// Upload content with UHRP
const content = Buffer.from('Hello, World!');
const uploadResult = await client.storage.upload(content, {
  classification: 'public',
  replicationStrategy: 'overlay+s3'
});
```

### 2. Python SDK Example

```python
from bsv_overlay import OverlayNetworkClient

# Initialize client
client = OverlayNetworkClient(
    base_url='https://api.overlay-network.com',
    identity_key='your-brc31-identity-key',
    overlay_enabled=True
)

# Register agent
agent = client.agents.register({
    'name': 'PythonProcessingAgent',
    'capabilities': [
        {
            'name': 'ml-inference',
            'inputs': ['model-data', 'input-features'],
            'outputs': ['predictions']
        }
    ],
    'webhookUrl': 'https://my-python-agent.com/webhook',
    'overlayTopics': ['gitdata.ml.inference']
})

# Search for agents
agents = client.agents.search(
    capability='data-processing',
    geographic_region='US',
    min_reputation=80
)

# Store content
with open('dataset.csv', 'rb') as f:
    result = client.storage.upload(
        f.read(),
        metadata={
            'classification': 'research',
            'content_type': 'text/csv'
        }
    )
```

## Configuration

### Environment Variables for Documentation

```bash
# Documentation generation
DOCS_ENABLED=true
DOCS_OPENAPI_GENERATION=true
DOCS_SWAGGER_UI_ENABLED=true
DOCS_REDOC_ENABLED=true

# Postman collection settings
POSTMAN_COLLECTION_AUTO_UPDATE=true
POSTMAN_ENVIRONMENT_SYNC=true
POSTMAN_WEBHOOK_ENABLED=true

# Testing configuration
NEWMAN_AUTO_TESTS=true
NEWMAN_REPORT_FORMAT="cli,junit,htmlextra"
NEWMAN_DELAY_REQUEST=250
NEWMAN_TIMEOUT_REQUEST=30000

# API documentation hosting
DOCS_HOST=localhost
DOCS_PORT=3001
DOCS_BASE_PATH="/docs"
```

## Testing Strategy

### Unit Tests for Documentation
```bash
# Test OpenAPI specification validity
npm run test:openapi

# Test Postman collection structure
npm run test:postman-collection

# Test code examples compilation
npm run test:code-examples
```

### Integration Tests
```bash
# Run complete Newman test suite
npm run test:newman

# Test specific workflows
npm run test:newman -- --folder "Agent Marketplace"
npm run test:newman -- --folder "BRC Standards"
```

## Definition of Done (DoD)

### Documentation Requirements
- [ ] **Complete API Documentation**: OpenAPI 3.0 specs for all overlay endpoints
- [ ] **Developer Guides**: Step-by-step tutorials for all BRC standards
- [ ] **Code Examples**: Working examples in JavaScript, Python, and curl
- [ ] **Interactive Documentation**: Swagger UI with try-it-now functionality

### Testing Requirements
- [ ] **Comprehensive Postman Collection**: 100+ requests covering all workflows
- [ ] **Automated Testing**: Newman CI/CD pipeline with 95%+ test coverage
- [ ] **Golden Vectors**: Complete test data sets for reproducible testing
- [ ] **Performance Testing**: Load tests for high-volume scenarios

### Developer Experience
- [ ] **15-Minute Setup**: New developers can get started in under 15 minutes
- [ ] **Clear Error Messages**: Comprehensive error documentation with solutions
- [ ] **Multi-language Support**: SDKs and examples in popular languages
- [ ] **Version Compatibility**: Backward compatibility documentation and migration guides

### Quality Assurance
- [ ] **Accuracy Validation**: All examples tested and verified
- [ ] **Regular Updates**: Automated documentation updates with code changes
- [ ] **Community Feedback**: Developer feedback collection and incorporation
- [ ] **Accessibility**: Documentation meets accessibility standards

This comprehensive documentation and testing infrastructure ensures developers can quickly and successfully integrate with the BSV overlay network while maintaining high quality and reliability standards.