# D21 — BSV Native Payments 🔄 **IN PROGRESS**

**Status:** 🔄 **IN PROGRESS** (60% Complete)
**Current Phase:** Overlay network integration and cross-network settlement
**Test Coverage:** Partial testing completed, integration tests needed
**Next Steps:** See implementation tasks below


**Enterprise BSV Payment Processing with BRC Standards Integration**

Labels: payments, backend, bsv, security, overlay-network, brc-standards
Assignee: TBA
Estimate: 14–18 PT
Priority: High

## Overview

Transform basic BSV payment processing into a comprehensive overlay network payment infrastructure that integrates BRC-22 transaction synchronization, BRC-31 identity verification, BRC-41 payment protocols, enterprise-grade transaction management, and sophisticated payment coordination across multiple overlay networks.

## Purpose

- **Native BSV Payment Infrastructure**: Production-ready on-chain payments with mAPI-compatible broadcasting and SPV verification
- **BRC Standards Integration**: Full compliance with BRC-22, BRC-31, BRC-41 for overlay network payment coordination
- **Enterprise Payment Management**: Deterministic output templates, idempotent transactions, and comprehensive reconciliation
- **Cross-Network Settlement**: Support for payments across multiple overlay networks with atomic coordination
- **Agent Marketplace Payments**: Enable AI agents to execute complex payment workflows with proper authorization

## Architecture & Dependencies

### Core Dependencies
- **Database**: Full PostgreSQL production schema with comprehensive payment tracking
- **BRC Standards**: BRC-22 (transaction sync), BRC-31 (identity), BRC-41 (payment protocols)
- **BSV Infrastructure**: mAPI broadcasting, SPV verification, HD wallet management
- **Existing Services**: D01 (Submit), D02 (SPV), D05/D09 (Pricing), D06/D07 (Receipts), D08 (Producers)
- **Agent Infrastructure**: D24 agent marketplace integration

## PostgreSQL Database Schema

### Enhanced Payment Tables
```sql
-- Extended receipts table for BSV payment processing (builds on D06)
ALTER TABLE overlay_receipts ADD COLUMN IF NOT EXISTS payment_template_hash VARCHAR(64);
ALTER TABLE overlay_receipts ADD COLUMN IF NOT EXISTS payment_quote_expires_at TIMESTAMP;
ALTER TABLE overlay_receipts ADD COLUMN IF NOT EXISTS payment_outputs_json JSONB;
ALTER TABLE overlay_receipts ADD COLUMN IF NOT EXISTS bsv_fee_satoshis BIGINT DEFAULT 0;
ALTER TABLE overlay_receipts ADD COLUMN IF NOT EXISTS mapi_responses JSONB DEFAULT '[]';

-- Extended producers table for payout configuration
ALTER TABLE producers ADD COLUMN IF NOT EXISTS payout_script_hex TEXT;
ALTER TABLE producers ADD COLUMN IF NOT EXISTS payout_address VARCHAR(50);
ALTER TABLE producers ADD COLUMN IF NOT EXISTS revenue_split_config JSONB DEFAULT '{}';

-- BSV transaction tracking
CREATE TABLE bsv_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    txid VARCHAR(64) NOT NULL UNIQUE,
    raw_tx_hex TEXT NOT NULL,

    -- Transaction metadata
    size_bytes INTEGER,
    input_count INTEGER,
    output_count INTEGER,
    total_input_satoshis BIGINT,
    total_output_satoshis BIGINT,
    fee_satoshis BIGINT,

    -- SPV and confirmation tracking
    block_hash VARCHAR(64),
    block_height INTEGER,
    confirmation_count INTEGER DEFAULT 0,
    spv_proof BYTEA,
    merkle_path JSONB,

    -- mAPI broadcast tracking
    broadcast_provider VARCHAR(255),
    broadcast_response JSONB,
    broadcast_status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected

    -- BRC-22 overlay network integration
    overlay_topics TEXT[] DEFAULT '{}',
    cross_network_refs UUID[],

    -- Status and lifecycle
    status VARCHAR(20) DEFAULT 'created', -- created, broadcasting, confirmed, failed
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Payment output templates (deterministic splits)
CREATE TABLE payment_output_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_hash VARCHAR(64) NOT NULL UNIQUE,
    version_id UUID,

    -- Template configuration
    split_rules JSONB NOT NULL, -- {"overlay": 0.05, "producer": 0.95}
    output_scripts JSONB NOT NULL, -- [{"scriptHex": "...", "satoshis": 1000}]
    total_amount_satoshis BIGINT NOT NULL,

    -- Template metadata
    deterministic_inputs JSONB NOT NULL, -- For reproducibility
    template_version VARCHAR(10) DEFAULT '1.0',

    -- Lifecycle
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE
);

-- mAPI provider configuration and performance
CREATE TABLE mapi_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name VARCHAR(100) NOT NULL UNIQUE,
    api_url TEXT NOT NULL,

    -- Configuration
    timeout_seconds INTEGER DEFAULT 30,
    fee_rate_hint DECIMAL(10,8), -- BSV per byte
    is_active BOOLEAN DEFAULT TRUE,
    priority_order INTEGER DEFAULT 1,

    -- Performance tracking
    success_rate DECIMAL(5,4) DEFAULT 1.0,
    average_response_time_ms INTEGER,
    last_successful_broadcast TIMESTAMP,
    total_broadcasts BIGINT DEFAULT 0,
    successful_broadcasts BIGINT DEFAULT 0,
    failed_broadcasts BIGINT DEFAULT 0,

    -- Authentication (if required)
    api_key_encrypted TEXT,
    authentication_method VARCHAR(20) DEFAULT 'none', -- none, api_key, signature

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Payment reconciliation and status tracking
CREATE TABLE payment_reconciliation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES overlay_receipts(receipt_id),
    txid VARCHAR(64) REFERENCES bsv_transactions(txid),

    -- Reconciliation process
    reconciliation_type VARCHAR(20) NOT NULL, -- spv_verification, mapi_status, block_confirmation
    expected_confirmations INTEGER DEFAULT 6,
    actual_confirmations INTEGER DEFAULT 0,

    -- Status transitions
    previous_status VARCHAR(20),
    current_status VARCHAR(20),
    status_reason TEXT,

    -- BRC-22 overlay network sync
    overlay_notification_sent BOOLEAN DEFAULT FALSE,
    cross_network_reconciled BOOLEAN DEFAULT FALSE,

    -- Timing
    reconciliation_started_at TIMESTAMP DEFAULT NOW(),
    reconciliation_completed_at TIMESTAMP,
    next_check_at TIMESTAMP
);

-- Revenue events with BSV transaction details
CREATE TABLE bsv_revenue_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(30) NOT NULL, -- payment_quoted, payment_submitted, payment_confirmed, payout_processed
    receipt_id UUID REFERENCES overlay_receipts(receipt_id),
    txid VARCHAR(64),

    -- Event details
    amount_satoshis BIGINT,
    fee_satoshis BIGINT,
    producer_share_satoshis BIGINT,
    platform_share_satoshis BIGINT,
    agent_commission_satoshis BIGINT,

    -- BRC integration
    brc_standards_used TEXT[], -- ["BRC-22", "BRC-31", "BRC-41"]
    overlay_network_id VARCHAR(100),
    cross_network_settlement_id UUID,

    -- Event metadata
    event_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- BRC-31 identity verification for payments
CREATE TABLE bsv_payment_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_key VARCHAR(66) NOT NULL UNIQUE, -- BRC-31 public key
    identity_certificate TEXT, -- BRC-31 certificate chain

    -- Identity verification
    verification_level VARCHAR(20) DEFAULT 'basic', -- basic, verified, premium, enterprise
    trust_score DECIMAL(3,2) DEFAULT 1.0,
    verification_provider VARCHAR(100),

    -- Payment history and reputation
    total_payment_volume_satoshis BIGINT DEFAULT 0,
    payment_count INTEGER DEFAULT 0,
    successful_payments INTEGER DEFAULT 0,
    failed_payments INTEGER DEFAULT 0,
    dispute_count INTEGER DEFAULT 0,

    -- Status and lifecycle
    is_active BOOLEAN DEFAULT TRUE,
    last_payment_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bsv_transactions_txid ON bsv_transactions(txid);
CREATE INDEX idx_bsv_transactions_status ON bsv_transactions(status);
CREATE INDEX idx_bsv_transactions_block_height ON bsv_transactions(block_height);
CREATE INDEX idx_payment_templates_hash ON payment_output_templates(template_hash);
CREATE INDEX idx_payment_templates_version ON payment_output_templates(version_id);
CREATE INDEX idx_mapi_providers_active ON mapi_providers(is_active, priority_order);
CREATE INDEX idx_reconciliation_receipt ON payment_reconciliation(receipt_id);
CREATE INDEX idx_reconciliation_status ON payment_reconciliation(current_status);
CREATE INDEX idx_revenue_events_type_date ON bsv_revenue_events(event_type, created_at);
CREATE INDEX idx_payment_identities_key ON bsv_payment_identities(identity_key);
```

## API Endpoints Implementation

### Core Payment Processing
- [ ] **POST /v1/payments/bsv/quote** - Enhanced payment quote generation
  - Input: `{ receiptId, agentId?, identityProof?, customSplits? }`
  - Deterministic output template generation with BRC standards integration
  - Cross-network payment coordination support
  - Enterprise-grade quote management with expiration handling

- [ ] **POST /v1/payments/bsv/submit** - BSV transaction submission and broadcasting
  - Input: `{ receiptId, rawTxHex, mapiProviderId?, brcCompliance? }`
  - Multi-provider mAPI broadcasting with intelligent failover
  - Comprehensive transaction validation and SPV integration
  - BRC-22 overlay network notification

- [ ] **GET /v1/payments/bsv/:receiptId** - Payment status and details
  - Comprehensive payment information with transaction details
  - Real-time SPV verification status and confirmation tracking
  - mAPI provider response history and performance metrics
  - Cross-network settlement status

### BRC Standards Integration
- [ ] **POST /v1/payments/bsv/brc31/verify** - BRC-31 identity verification for payments
  - Identity certificate validation and trust scoring
  - Payment authorization based on verified identities
  - Enterprise-grade identity management

- [ ] **POST /v1/payments/bsv/brc22/sync** - BRC-22 transaction synchronization
  - Cross-network transaction status synchronization
  - Overlay network payment event broadcasting
  - Multi-node coordination and consistency

### mAPI Provider Management
- [ ] **GET /v1/payments/bsv/providers** - mAPI provider status and performance
  - Real-time provider health and performance metrics
  - Fee rate recommendations and network status
  - Provider selection optimization

- [ ] **POST /v1/payments/bsv/providers/health** - Provider health checks
  - Automated provider monitoring and failover
  - Performance benchmarking and optimization
  - Network topology analysis

### Payment Templates and Output Management
- [ ] **POST /v1/payments/bsv/templates** - Payment template generation
  - Deterministic output template creation
  - Custom split rule configuration
  - Template validation and optimization

- [ ] **GET /v1/payments/bsv/templates/:templateHash** - Template details and verification
  - Template reproducibility verification
  - Split rule analysis and validation
  - Template usage tracking and analytics

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