# D19 — BSV Overlay Identity-Signed Producer Registration

**Labels:** backend, security, identity, overlay, brc-31
**Assignee:** TBA
**Estimate:** 3 PT

## Purpose

Secure producer endpoints with BRC-31 identity signatures integrated with BSV overlay network identity management. This provides cryptographic proof of producer identity and prevents unauthorized submissions while leveraging overlay network trust infrastructure.

## Dependencies

- **BSV Overlay Services**: Initialized overlay network with BRC-31 support
- **PostgreSQL Database**: `producers`, `overlay_identities`, `signature_verifications` tables
- **BRC Standards**: BRC-31 identity verification, BRC-88 SHIP/SLAP for producer discovery
- **Agent Execution Service**: `src/agents/agent-execution-service.ts` (BRC-31 verification)
- **Overlay Config**: `src/overlay/overlay-config.ts` (identity topics)

## Architecture Overview

### Identity Management Flow
1. **Producer Registration**: Registers identity key with overlay network via BRC-88 SHIP advertisement
2. **Signature Generation**: All requests signed with BRC-31 format (secp256k1)
3. **Verification**: Middleware validates signatures against overlay network identity registry
4. **Audit Trail**: Complete signature verification logged to PostgreSQL with overlay evidence

### BRC-31 Integration
- **Identity Headers**: `X-Identity-Key`, `X-Nonce`, `X-Signature`
- **Message Format**: `{method}:{path}:{body}:{nonce}:{timestamp}`
- **Signature Algorithm**: secp256k1 with deterministic nonce generation
- **Replay Protection**: Nonce tracking with TTL and overlay network consensus

## Tasks

### Core Implementation
- [x] **BRC-31 Verifier Middleware**: Enhanced signature verification with overlay integration
  - Location: `src/agents/agent-execution-service.ts:verifyBRC31Signature()`
  - Features: Message construction, signature validation, nonce replay protection
  - Integration: Overlay network identity lookup via BRC-24 services

- [ ] **Producer Identity Registration**: Overlay network identity management
  - Endpoint: `POST /overlay/producers/register-identity`
  - Features: BRC-88 SHIP advertisement for producer identity
  - Database: PostgreSQL `overlay_identities` table with identity key management

- [ ] **Identity-Required Middleware**: Route protection with overlay verification
  - Middleware: `requireOverlayIdentity(required: boolean = true)`
  - Integration: Agent execution service for BRC-31 verification
  - Fallback: Graceful degradation when overlay services unavailable

- [ ] **Enhanced Producer Routes**: Update existing producer endpoints
  - Routes: `/producers/submit`, `/producers/price`, `/producers/metadata`
  - Security: Optional BRC-31 signature requirement via environment flag
  - Evidence: Complete audit trail with overlay network verification

### Database Schema Updates

```sql
-- Enhanced producer identity tracking
CREATE TABLE IF NOT EXISTS overlay_identities (
    identity_key TEXT PRIMARY KEY,
    producer_id TEXT NOT NULL,
    ship_advertisement_id TEXT,
    overlay_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
    verification_status TEXT DEFAULT 'pending',
    reputation_score INTEGER DEFAULT 0,
    registered_at TIMESTAMP DEFAULT NOW(),
    last_verified_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    FOREIGN KEY (producer_id) REFERENCES producers(id)
);

-- Signature verification audit trail
CREATE TABLE IF NOT EXISTS signature_verifications (
    id SERIAL PRIMARY KEY,
    identity_key TEXT NOT NULL,
    request_path TEXT NOT NULL,
    request_method TEXT NOT NULL,
    nonce TEXT NOT NULL,
    signature TEXT NOT NULL,
    verification_result BOOLEAN NOT NULL,
    overlay_evidence JSONB,
    verified_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    INDEX idx_signature_nonce (nonce, verified_at),
    INDEX idx_signature_identity (identity_key, verified_at)
);
```

### Overlay Network Integration

```typescript
// Producer identity registration with BRC-88 SHIP
interface ProducerIdentityRegistration {
  identityKey: string;
  producerCapabilities: string[];
  overlayTopics: string[];
  geographicRegion?: string;
  serviceEndpoints: {
    submit: string;
    pricing: string;
    metadata: string;
  };
}

// Enhanced signature verification with overlay lookup
interface OverlayBRC31Verification {
  identityKey: string;
  signature: string;
  nonce: string;
  message: string;
  overlayEvidence?: {
    shipAdvertisementId: string;
    reputationScore: number;
    lastActivity: string;
  };
}
```

## Implementation Details

### 1. Producer Identity Registration

**Endpoint:** `POST /overlay/producers/register-identity`

```bash
curl -X POST "{{BASE}}/overlay/producers/register-identity" \
  -H "Content-Type: application/json" \
  -H "X-Identity-Key: 03abc123..." \
  -H "X-Nonce: 1234567890" \
  -H "X-Signature: 304502...def" \
  -d '{
    "producerCapabilities": ["data-publishing", "model-training"],
    "overlayTopics": ["gitdata.producer.submissions", "gitdata.model.weights"],
    "geographicRegion": "US",
    "serviceEndpoints": {
      "submit": "/producers/submit",
      "pricing": "/producers/price",
      "metadata": "/producers/metadata"
    }
  }'
```

**Response:**
```json
{
  "identityKey": "03abc123...",
  "producerId": "prod_xyz789",
  "shipAdvertisementId": "ship_ad_456",
  "overlayTopics": ["gitdata.producer.submissions"],
  "verificationStatus": "verified",
  "reputationScore": 100
}
```

### 2. Identity-Protected Producer Submission

**Endpoint:** `POST /producers/submit` (with BRC-31 signature)

```bash
curl -X POST "{{BASE}}/producers/submit" \
  -H "Content-Type: application/json" \
  -H "X-Identity-Key: 03abc123..." \
  -H "X-Nonce: $(date +%s%N)" \
  -H "X-Signature: $(sign_message "$body" "$nonce")" \
  -d '{
    "contentHash": "abc123def456...",
    "manifest": {
      "title": "Premium Dataset v2.1",
      "classification": "commercial",
      "tags": ["machine-learning", "verified-producer"]
    }
  }'
```

### 3. Signature Verification Process

```typescript
// Enhanced BRC-31 verification with overlay integration
async function verifyProducerIdentity(
  identityKey: string,
  message: string,
  signature: string,
  nonce: string
): Promise<{
  verified: boolean;
  overlayEvidence?: OverlayEvidence;
  reputationScore?: number;
}> {
  // 1. Basic BRC-31 signature verification
  const signatureValid = await verifyBRC31Signature(identityKey, message, signature);

  // 2. Overlay network identity lookup
  const overlayIdentity = await lookupProducerIdentity(identityKey);

  // 3. Reputation and activity checks
  const reputationScore = await calculateReputationScore(identityKey);

  // 4. Nonce replay protection with overlay consensus
  const nonceValid = await validateNonceWithOverlay(nonce, identityKey);

  return {
    verified: signatureValid && nonceValid && overlayIdentity.verified,
    overlayEvidence: overlayIdentity.evidence,
    reputationScore
  };
}
```

## Configuration

### Environment Variables

```bash
# Identity verification settings
IDENTITY_REQUIRED=true                    # Require BRC-31 signatures
IDENTITY_OVERLAY_ENABLED=true             # Use overlay network for identity lookup
IDENTITY_REPUTATION_THRESHOLD=50          # Minimum reputation score
SIGNATURE_TTL_SECONDS=300                 # Signature validity window
NONCE_REPLAY_WINDOW_SECONDS=600          # Nonce replay protection window

# Overlay network settings for identity
OVERLAY_IDENTITY_TOPICS="gitdata.producer.identity,gitdata.brc31.verification"
OVERLAY_REPUTATION_ENABLED=true          # Enable reputation scoring
OVERLAY_IDENTITY_CACHE_TTL=3600          # Identity cache TTL in seconds
```

### Producer Routes with Identity Protection

```typescript
// Apply identity verification to producer routes
app.use('/producers/submit',
  requireOverlayIdentity(process.env.IDENTITY_REQUIRED === 'true'),
  rateLimit('submit'),
  producersRouter()
);

app.use('/producers/price',
  requireOverlayIdentity(process.env.IDENTITY_REQUIRED === 'true'),
  rateLimit('pricing'),
  producersRouter()
);

app.use('/producers/metadata',
  requireOverlayIdentity(false), // Optional for metadata
  producersRouter()
);
```

## Testing Strategy

### Unit Tests
```bash
# Test BRC-31 signature verification
npm run test:unit -- --grep "BRC-31 signature"

# Test overlay identity lookup
npm run test:unit -- --grep "overlay identity"
```

### Integration Tests
```bash
# Test producer identity registration flow
NODE_ENV=test npx vitest run test/integration/producer-identity.spec.ts

# Test signature verification with overlay
NODE_ENV=test npx vitest run test/integration/brc31-overlay.spec.ts
```

### End-to-End Tests
```bash
# Complete producer workflow with identity verification
NODE_ENV=test npx vitest run test/integration/d19-identity-producer.spec.ts
```

## Definition of Done (DoD)

### Core Functionality
- [ ] **Identity Registration**: Producers can register BRC-31 identity with overlay network
- [ ] **Signature Verification**: All producer requests verified with BRC-31 signatures
- [ ] **Overlay Integration**: Identity lookup uses BSV overlay network services
- [ ] **Audit Trail**: Complete verification history stored in PostgreSQL
- [ ] **Reputation System**: Producer reputation scoring based on overlay network activity

### Security Requirements
- [ ] **Request Authentication**: Requests without valid signatures return 401
- [ ] **Replay Protection**: Nonce-based replay attack prevention
- [ ] **Key Validation**: Invalid identity keys rejected with proper error messages
- [ ] **Rate Limiting**: Enhanced rate limiting based on producer reputation

### Performance and Reliability
- [ ] **Caching**: Identity verification results cached for performance
- [ ] **Graceful Degradation**: Fallback when overlay services unavailable
- [ ] **Error Handling**: Comprehensive error handling and logging
- [ ] **Monitoring**: Metrics for signature verification success/failure rates

## Acceptance Criteria (Tests)

### Positive Cases
- [ ] **Valid Signature**: Producer with valid BRC-31 signature can submit content
- [ ] **Overlay Verification**: Identity verified through overlay network lookup
- [ ] **Reputation Boost**: High-reputation producers get enhanced rate limits
- [ ] **Multi-submission**: Multiple submissions with different nonces work correctly

### Security Cases
- [ ] **Invalid Signature**: Requests with invalid signatures rejected (401)
- [ ] **Replay Attack**: Duplicate nonce usage blocked
- [ ] **Wrong Identity**: Signature with incorrect identity key rejected
- [ ] **Expired Signature**: Old signatures beyond TTL rejected
- [ ] **Low Reputation**: Producers below reputation threshold rate-limited

### Edge Cases
- [ ] **Overlay Unavailable**: Graceful fallback when overlay network down
- [ ] **Database Error**: Proper error handling for database connectivity issues
- [ ] **Malformed Headers**: Invalid BRC-31 headers handled gracefully
- [ ] **Performance Load**: System handles high-volume signature verification

## Migration and Rollback

### Deployment Strategy
1. **Phase 1**: Deploy with `IDENTITY_REQUIRED=false` (optional signatures)
2. **Phase 2**: Monitor adoption and performance metrics
3. **Phase 3**: Enable `IDENTITY_REQUIRED=true` for enhanced security
4. **Rollback**: Environment flag allows instant rollback to optional mode

### Migration Script
```bash
# Migrate existing producers to overlay identity system
npx tsx scripts/migrate-producer-identities.ts

# Verify migration completeness
npx tsx scripts/verify-identity-migration.ts
```

## Advanced Features

### Reputation-Based Features
- **Dynamic Rate Limits**: Higher reputation = higher rate limits
- **Priority Processing**: High-reputation producers get processing priority
- **Enhanced Discovery**: Better visibility in producer search results

### Compliance and Auditing
- **Regulatory Compliance**: Full audit trail for regulatory requirements
- **Forensic Analysis**: Detailed signature verification logs for security analysis
- **Automated Monitoring**: Alert system for suspicious signature patterns

### Integration with Agent Marketplace
- **Agent Identity**: Agents can also register BRC-31 identities
- **Cross-verification**: Producers and agents can verify each other's identities
- **Trust Networks**: Build trust relationships based on successful interactions

This implementation provides enterprise-grade identity verification for producers while leveraging the BSV overlay network's distributed trust infrastructure and maintaining compatibility with existing systems.