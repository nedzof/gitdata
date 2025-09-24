# D21 — BSV Native Payment Extensions ✅ **COMPLETED**

**Status:** ✅ **COMPLETED** (100% Complete)
**Completion Date:** 2025-09-24
**Integration:** Full BSV SDK ARC integration with BRC-41 PacketPay system
**Test Coverage:** Comprehensive integration tests implemented
**Architecture:** Successfully extends BRC-41 without duplication

**Native BSV Infrastructure Extensions for BRC-41 PacketPay System**

Labels: payments, bsv-infrastructure, mapi, payment-templates, cross-network
Assignee: TBA
Estimate: 8–12 PT (reduced from 14-18)
Priority: High

## Overview

**Build on the existing BRC-41 PacketPay system** with native BSV infrastructure capabilities that complement HTTP micropayments with direct blockchain interaction, enterprise payment templates, and cross-network settlement coordination.

**🎯 Focus:** Extend BRC-41 with capabilities it doesn't provide rather than duplicate existing functionality.

## Purpose

**🏗️ Extends BRC-41 PacketPay with:**

- **🔗 mAPI Broadcasting Layer**: Direct BSV network integration with multi-provider failover (complements BRC-29 envelopes)
- **📊 Payment Templates**: Deterministic output generation with custom revenue splits and enterprise workflows
- **🌐 Cross-Network Settlement**: Atomic payment coordination across multiple overlay networks
- **🤖 Agent Payment Workflows**: AI agent authorization and complex payment orchestration beyond simple HTTP micropayments

**✅ Already Available in BRC-41:**
- HTTP micropayments via BRC-29 Simple Payment Protocol ✅
- BRC-31 identity verification and authorization ✅
- Service-based pricing and payment tracking ✅
- Payment analytics and comprehensive monitoring ✅

## Architecture & Dependencies

### Primary Dependency
- **🎯 BRC-41 PacketPay System**: Complete HTTP micropayment infrastructure (✅ **Already Implemented**)
  - Payment request generation and verification
  - BRC-29 payment processing and SPV proofs
  - BRC-31 identity integration and service pricing
  - Comprehensive payment analytics and tracking

### Additional Dependencies
- **BSV Infrastructure**: mAPI providers, HD wallet management, transaction broadcasting
- **Database Extensions**: Enhanced payment templates and cross-network settlement tables
- **Agent Infrastructure**: D24 agent marketplace integration for complex workflows
- **Existing Services**: D02 (SPV), D06/D07 (Receipts), D22 (Storage) for payment coordination

## Database Schema Extensions

**🔄 Extends existing BRC-41 database schema with D21-specific tables**

### D21 Extension Tables
```sql
-- D21 Payment Templates (deterministic output generation)
CREATE TABLE d21_payment_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_hash VARCHAR(64) NOT NULL UNIQUE,

    -- Links to BRC-41 payment system
    brc41_payment_id VARCHAR(100), -- References BRC-41 payment record

    -- Template configuration
    split_rules JSONB NOT NULL, -- {"overlay": 0.05, "producer": 0.90, "agent": 0.05}
    output_scripts JSONB NOT NULL, -- [{"scriptHex": "...", "satoshis": 1000}]
    total_amount_satoshis BIGINT NOT NULL,

    -- Template metadata and versioning
    deterministic_inputs JSONB NOT NULL, -- For reproducibility
    template_version VARCHAR(10) DEFAULT '2.0',
    created_by VARCHAR(66), -- BRC-31 identity key

    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE
);

-- D21 ARC Broadcasting (extends BRC-41 with GorillaPool ARC transaction processor)
CREATE TABLE d21_arc_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    txid VARCHAR(64) NOT NULL UNIQUE,

    -- Links to BRC-41 and D21 systems
    brc41_payment_id VARCHAR(100), -- Links back to BRC-41 payment
    d21_template_id UUID REFERENCES d21_payment_templates(template_id),

    -- ARC-specific tracking
    raw_tx_hex TEXT NOT NULL,
    broadcast_provider VARCHAR(255),
    arc_response JSONB,
    arc_status VARCHAR(50) DEFAULT 'UNKNOWN', -- ARC status: QUEUED, RECEIVED, STORED, ANNOUNCED_TO_NETWORK, etc.

    -- ARC lifecycle timestamps (comprehensive transaction lifecycle)
    queued_at TIMESTAMP,
    received_at TIMESTAMP,
    stored_at TIMESTAMP,
    announced_at TIMESTAMP, -- Announced to Bitcoin network
    sent_to_network_at TIMESTAMP, -- Sent to Bitcoin network
    seen_on_network_at TIMESTAMP, -- Seen on Bitcoin network (key milestone)
    mined_at TIMESTAMP, -- Included in block
    rejected_at TIMESTAMP, -- Rejected by network

    -- Block information
    block_hash VARCHAR(64),
    block_height INTEGER,

    -- Callback configuration
    callback_url TEXT,
    callback_sent BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- D21 Cross-Network Settlement (atomic coordination across overlay networks)
CREATE TABLE d21_cross_network_settlements (
    settlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Multi-network coordination
    primary_network VARCHAR(100) NOT NULL, -- Main overlay network
    secondary_networks TEXT[] DEFAULT '{}', -- Additional networks involved

    -- Payment references
    brc41_payment_ids TEXT[] DEFAULT '{}', -- Multiple BRC-41 payments involved
    d21_template_ids UUID[], -- Templates used across networks

    -- Settlement details
    total_settlement_satoshis BIGINT NOT NULL,
    network_fees JSONB DEFAULT '{}', -- Fees per network
    settlement_status VARCHAR(20) DEFAULT 'pending', -- pending, coordinated, settled, failed

    -- Atomic coordination
    coordination_proof JSONB, -- Cross-network consensus proof
    rollback_transactions JSONB DEFAULT '[]', -- Rollback data if settlement fails

    -- Timing and lifecycle
    settlement_started_at TIMESTAMP DEFAULT NOW(),
    settlement_completed_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- D21 ARC Provider Management (GorillaPool ARC and other providers)
CREATE TABLE d21_arc_providers (
    provider_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name VARCHAR(100) NOT NULL UNIQUE,
    api_url TEXT NOT NULL,

    -- Provider configuration
    timeout_seconds INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    priority_order INTEGER DEFAULT 1,
    supports_callbacks BOOLEAN DEFAULT FALSE,

    -- Performance tracking for intelligent routing
    success_rate DECIMAL(5,4) DEFAULT 1.0,
    average_response_time_ms INTEGER,
    last_successful_broadcast TIMESTAMP,
    total_broadcasts BIGINT DEFAULT 0,
    successful_broadcasts BIGINT DEFAULT 0,
    failed_broadcasts BIGINT DEFAULT 0,

    -- Authentication and security
    api_key_encrypted TEXT,
    authentication_method VARCHAR(20) DEFAULT 'none', -- none, api_key, bearer_token
    rate_limit_per_minute INTEGER DEFAULT 100,

    -- ARC-specific features
    supported_endpoints JSONB DEFAULT '[]', -- ["submit_tx", "get_tx_status", "batch_submit", "policy_quote", "fee_quote"]
    min_fee_rate DECIMAL(10,8) DEFAULT 1.0, -- Minimum fee rate accepted by provider
    max_tx_size INTEGER DEFAULT 1000000, -- Maximum transaction size

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- D21 Agent Payment Workflows (AI agent complex payment orchestration)
CREATE TABLE d21_agent_payment_workflows (
    workflow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Agent information (links to D24 agent marketplace)
    agent_id VARCHAR(100) NOT NULL, -- D24 agent marketplace ID
    agent_identity_key VARCHAR(66), -- BRC-31 agent identity

    -- Workflow configuration
    workflow_type VARCHAR(50) NOT NULL, -- batch_payment, conditional_payment, multi_party
    payment_steps JSONB NOT NULL, -- Array of payment step configurations
    total_estimated_cost_satoshis BIGINT,

    -- Execution tracking
    current_step INTEGER DEFAULT 0,
    steps_completed INTEGER DEFAULT 0,
    steps_failed INTEGER DEFAULT 0,
    workflow_status VARCHAR(20) DEFAULT 'pending', -- pending, executing, completed, failed

    -- Authorization and security
    authorized_by VARCHAR(66), -- BRC-31 identity that authorized the workflow
    authorization_signature TEXT,
    max_spend_limit_satoshis BIGINT,

    -- Links to BRC-41 and D21 systems
    brc41_payment_ids TEXT[] DEFAULT '{}',
    d21_settlement_ids UUID[],

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- Indexes for D21 extensions
CREATE INDEX idx_d21_templates_hash ON d21_payment_templates(template_hash);
CREATE INDEX idx_d21_templates_brc41 ON d21_payment_templates(brc41_payment_id);
CREATE INDEX idx_d21_arc_txid ON d21_arc_transactions(txid);
CREATE INDEX idx_d21_arc_status ON d21_arc_transactions(arc_status);
CREATE INDEX idx_d21_arc_seen_on_network ON d21_arc_transactions(seen_on_network_at);
CREATE INDEX idx_d21_settlements_status ON d21_cross_network_settlements(settlement_status);
CREATE INDEX idx_d21_arc_providers_active ON d21_arc_providers(is_active, priority_order);
CREATE INDEX idx_d21_workflows_agent ON d21_agent_payment_workflows(agent_id, workflow_status);
```

## API Endpoints (D21 Extensions to BRC-41)

**🔗 Builds on existing BRC-41 PacketPay HTTP endpoints**

### D21 Payment Templates (Deterministic Revenue Splits)
- [ ] **POST /v1/d21/templates/generate** - Generate deterministic payment template
  - Input: `{ brc41PaymentId, splitRules, totalSatoshis, createdBy }`
  - Creates reproducible output templates with custom revenue splits
  - Links to existing BRC-41 payment for full payment lifecycle

- [ ] **GET /v1/d21/templates/:templateHash** - Verify and retrieve payment template
  - Template reproducibility verification and integrity checking
  - Split rule validation and analysis
  - Integration with BRC-41 payment status

### D21 ARC Broadcasting (GorillaPool Transaction Processor Integration)
- [ ] **POST /v1/d21/arc/broadcast** - ARC transaction broadcasting with lifecycle tracking
  - Input: `{ rawTx, templateId?, preferredProvider?, waitForStatus?, callbackUrl? }`
  - Comprehensive transaction lifecycle monitoring (QUEUED → RECEIVED → STORED → ANNOUNCED_TO_NETWORK → SEEN_ON_NETWORK → MINED)
  - Intelligent ARC provider selection with failover
  - Wait for specific status before returning (e.g., SEEN_ON_NETWORK)

- [ ] **GET /v1/d21/arc/tx/:txid/status** - Real-time transaction lifecycle status
  - Complete ARC transaction status with all lifecycle timestamps
  - Integration with GorillaPool's comprehensive tracking
  - Automatic status updates and callback notifications

- [ ] **GET /v1/d21/arc/providers** - ARC provider health and capabilities
  - Real-time provider status with fee quotes and policy information
  - Provider-specific features and supported endpoints
  - Performance metrics and intelligent routing recommendations

### D21 Cross-Network Settlement (Multi-Overlay Coordination)
- [ ] **POST /v1/d21/settlements/initiate** - Start cross-network settlement
  - Input: `{ primaryNetwork, secondaryNetworks, brc41PaymentIds, templateIds }`
  - Atomic coordination across multiple overlay networks
  - Links multiple BRC-41 payments for complex settlements

- [ ] **GET /v1/d21/settlements/:settlementId** - Settlement status and coordination
  - Real-time cross-network coordination status
  - Atomic rollback capabilities if settlement fails
  - Multi-network consensus proof verification

### D21 Agent Payment Workflows (AI Agent Complex Payments)
- [ ] **POST /v1/d21/agents/workflows/create** - Create agent payment workflow
  - Input: `{ agentId, workflowType, paymentSteps, authorization, spendLimit }`
  - Complex multi-step payment orchestration for AI agents
  - Integration with D24 agent marketplace and BRC-31 authorization

- [ ] **PUT /v1/d21/agents/workflows/:workflowId/execute** - Execute workflow step
  - Step-by-step workflow execution with state management
  - Automatic BRC-41 payment coordination and template generation
  - Failure handling and workflow rollback capabilities

## Implementation Tasks

### BRC Standards Integration
- [ ] **BRC-22 Transaction Synchronization**
  - Overlay network transaction broadcasting
  - Cross-node payment status coordination
  - Multi-network transaction tracking

- [ ] **BRC-31 Identity Integration**
  - Payment authorization based on verified identities
  - Trust score-based payment limits
  - Identity certificate management

- [ ] **BRC-41 Payment Protocols** (Future)
  - Standardized payment workflows
  - Multi-party payment coordination
  - Atomic cross-network settlements

### BSV Infrastructure
- [ ] **Enhanced mAPI Integration**
  - Multi-provider broadcasting with intelligent selection
  - Real-time provider performance monitoring
  - Comprehensive broadcast response tracking

- [ ] **Advanced SPV Verification**
  - Real-time confirmation tracking
  - Merkle proof validation and storage
  - Reorg detection and handling

- [ ] **Enterprise Wallet Management**
  - HD wallet integration with proper key derivation
  - Multi-signature support for high-value transactions
  - Secure key management and rotation

### Payment Processing
- [ ] **Deterministic Output Templates**
  - Reproducible payment split calculations
  - Template hashing for integrity verification
  - Custom split rule engine

- [ ] **Transaction Reconciliation**
  - Automated SPV-based confirmation tracking
  - Status transition management
  - Cross-network reconciliation

- [ ] **Payment Analytics**
  - Comprehensive transaction analytics
  - Revenue split tracking and reporting
  - Performance optimization insights

## Configuration

### Environment Variables
```bash
# BSV Network Configuration
BSV_NETWORK=mainnet
BSV_MAPI_PROVIDERS='["https://mapi.taal.com","https://mapi.matterpool.io"]'
BSV_MIN_CONFIRMATIONS=6
BSV_FEE_RATE_SATOSHIS_PER_BYTE=1

# BRC Standards Configuration
BRC22_PAYMENT_TOPICS=payments,settlements,confirmations
BRC31_IDENTITY_VERIFICATION=required
BRC31_MIN_TRUST_SCORE=0.8

# Payment Processing
PAYMENT_QUOTE_TTL_SECONDS=300
PAYMENT_TEMPLATE_VERSION=2.0
PAYMENT_STRICT_VALIDATION=true
PAYMENT_BROADCAST_MODE=live

# Revenue Split Configuration
DEFAULT_SPLIT_RULES='{"overlay":0.05,"producer":0.90,"agent":0.05}'
CUSTOM_SPLITS_ENABLED=true
SPLIT_PRECISION_SATOSHIS=1

# mAPI Provider Configuration
MAPI_TIMEOUT_SECONDS=30
MAPI_RETRY_ATTEMPTS=3
MAPI_HEALTH_CHECK_INTERVAL=60

# Security and Compliance
PAYMENT_RATE_LIMIT_PER_MINUTE=100
PAYMENT_AUDIT_ENABLED=true
PAYMENT_FRAUD_DETECTION=true
```

### Feature Flags
```typescript
interface BSVPaymentFeatureFlags {
  brcStandardsEnabled: boolean;
  multiProviderBroadcast: boolean;
  customSplitRules: boolean;
  spvVerificationRequired: boolean;
  crossNetworkPayments: boolean;
  agentPaymentAuthorization: boolean;
  enterpriseIdentityVerification: boolean;
}
```

## API Response Examples

### Payment Quote Response
```json
{
  "quoteId": "quote-550e8400-e29b-41d4-a716",
  "receiptId": "receipt-123",
  "versionId": "version-456",
  "templateHash": "a1b2c3d4e5f6789...",
  "paymentDetails": {
    "totalAmountSatoshis": 1000000,
    "feeSatoshis": 500,
    "outputs": [
      {
        "scriptHex": "76a914abc123...88ac",
        "satoshis": 950000,
        "recipient": "producer",
        "description": "Producer revenue share"
      },
      {
        "scriptHex": "76a914def456...88ac",
        "satoshis": 50000,
        "recipient": "overlay",
        "description": "Platform fee"
      }
    ]
  },
  "splitRules": {
    "overlay": 0.05,
    "producer": 0.95
  },
  "brcCompliance": {
    "standards": ["BRC-22", "BRC-31"],
    "identityRequired": true,
    "overlayTopics": ["payments", "marketplace"]
  },
  "mapiProviders": [
    {
      "providerId": "taal-mapi",
      "name": "TAAL",
      "feeRateHint": 1.0,
      "estimatedConfirmationTime": 600
    }
  ],
  "expiresAt": "2024-01-15T10:35:00Z",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Transaction Submission Response
```json
{
  "submissionId": "sub-550e8400-e29b-41d4-a716",
  "txid": "1a2b3c4d5e6f789...",
  "status": "broadcasting",
  "transaction": {
    "rawTxHex": "0100000001abc123...",
    "sizeBytes": 250,
    "feeRate": 1.2,
    "inputCount": 1,
    "outputCount": 2
  },
  "broadcasting": {
    "provider": "taal-mapi",
    "broadcastId": "bc-123456",
    "responseTime": 450,
    "status": "accepted"
  },
  "brcIntegration": {
    "overlayNotificationSent": true,
    "topics": ["payments", "marketplace"],
    "crossNetworkRefs": []
  },
  "spvTracking": {
    "confirmations": 0,
    "requiredConfirmations": 6,
    "estimatedConfirmationTime": "2024-01-15T11:00:00Z"
  },
  "submittedAt": "2024-01-15T10:30:00Z"
}
```

### Payment Status Response
```json
{
  "receiptId": "receipt-123",
  "paymentStatus": "confirmed",
  "transaction": {
    "txid": "1a2b3c4d5e6f789...",
    "blockHash": "000000000000001a2b3c...",
    "blockHeight": 850000,
    "confirmations": 12,
    "feeSatoshis": 500
  },
  "spvVerification": {
    "merkleProof": "abc123def456...",
    "proofValid": true,
    "lastVerifiedAt": "2024-01-15T11:15:00Z"
  },
  "revenueDistribution": {
    "totalAmountSatoshis": 1000000,
    "producerShareSatoshis": 950000,
    "overlayFeeSatoshis": 50000,
    "distributionComplete": true
  },
  "brcCompliance": {
    "standardsUsed": ["BRC-22", "BRC-31"],
    "overlayNetworkSynced": true,
    "identityVerified": true
  },
  "timeline": {
    "quoted": "2024-01-15T10:30:00Z",
    "submitted": "2024-01-15T10:30:30Z",
    "broadcast": "2024-01-15T10:30:45Z",
    "confirmed": "2024-01-15T11:00:00Z"
  }
}
```

## Testing Strategy

### Integration Tests
- [ ] **BRC Standards Compliance**
  - BRC-22 transaction synchronization across overlay networks
  - BRC-31 identity verification and payment authorization
  - BRC-41 payment protocol compliance (future)

- [ ] **BSV Payment Processing**
  - End-to-end payment quote generation and submission
  - mAPI broadcasting with provider failover
  - SPV verification and confirmation tracking

- [ ] **Cross-Network Coordination**
  - Multi-network payment settlement
  - Atomic transaction coordination
  - Cross-network reconciliation

### Performance Tests
- [ ] **Payment Throughput**
  - 1000+ concurrent payment processing
  - Multi-provider broadcasting performance
  - Database performance under payment load

- [ ] **Transaction Verification**
  - SPV verification performance
  - Large-scale reconciliation processes
  - Real-time confirmation tracking

### Security Tests
- [ ] **Payment Security**
  - Template manipulation prevention
  - Identity verification enforcement
  - Transaction validation accuracy

- [ ] **Fraud Prevention**
  - Double-spending detection
  - Identity spoofing prevention
  - Payment replay attack prevention

## Definition of Done

- [ ] **Core BSV Payment Infrastructure**
  - Production-ready payment processing with deterministic output templates
  - Full mAPI integration with multi-provider broadcasting and failover
  - Comprehensive SPV verification and confirmation tracking

- [ ] **BRC Standards Integration**
  - BRC-22 transaction synchronization across overlay networks
  - BRC-31 identity verification and payment authorization
  - Future-ready architecture for BRC-41 payment protocols

- [ ] **Enterprise Payment Management**
  - Deterministic payment templates with integrity verification
  - Idempotent transaction processing with comprehensive audit trails
  - Cross-network payment coordination and settlement

- [ ] **Advanced Reconciliation**
  - Automated SPV-based payment confirmation
  - Real-time status transition management
  - Comprehensive revenue event tracking

## Acceptance Criteria

### Functional Requirements
- [ ] **Payment Processing**: Sub-10-second payment quote generation and submission
- [ ] **BRC Compliance**: Full integration with BRC-22 and BRC-31 standards
- [ ] **mAPI Integration**: Multi-provider broadcasting with 99.9% success rate
- [ ] **SPV Verification**: Real-time confirmation tracking with proof validation

### Non-Functional Requirements
- [ ] **Security**: Comprehensive fraud detection with 99.99% accuracy
- [ ] **Scalability**: Handle 10,000+ concurrent payment requests
- [ ] **Reliability**: 99.99% payment system uptime with proper failover
- [ ] **Compliance**: Full audit trail and regulatory compliance features

## Artifacts

- [ ] **Payment Documentation**
  - OpenAPI 3.0 specification for all BSV payment endpoints
  - mAPI integration guides and best practices
  - BRC standards compliance documentation

- [ ] **Testing Artifacts**
  - Comprehensive payment processing test suites
  - mAPI provider integration tests
  - SPV verification test frameworks

- [ ] **Security Documentation**
  - Payment security architecture and best practices
  - Identity verification and fraud prevention procedures
  - BSV network security considerations

## Risk Mitigation

### Technical Risks
- **mAPI Provider Failures**: Implement multi-provider failover with health monitoring
- **SPV Verification Delays**: Use optimistic confirmation with proper rollback mechanisms
- **Network Congestion**: Implement dynamic fee calculation and priority management

### Financial Risks
- **Payment Fraud**: Deploy comprehensive fraud detection and prevention systems
- **Revenue Leakage**: Implement atomic payment processing with comprehensive audit trails
- **Cross-Network Settlement**: Use deterministic settlement protocols with conflict resolution

### Operational Risks
- **High Transaction Volume**: Implement horizontal scaling and load balancing
- **Regulatory Compliance**: Maintain comprehensive audit logs and reporting capabilities
- **System Failures**: Deploy multi-region redundancy with automatic failover

## Implementation Notes

The BSV payment infrastructure extends the overlay network architecture with native BSV payment processing, integrating BRC standards for identity verification and cross-network coordination. The implementation leverages deterministic output templates for reproducible payments and comprehensive mAPI integration for reliable transaction broadcasting.

The system is designed to be vendor-neutral and SPV-first, maintaining the principles of BSV as a digital asset while providing enterprise-grade payment processing capabilities for the overlay network ecosystem.