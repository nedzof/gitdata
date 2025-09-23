# Real-time Overlay Data Streaming Implementation Plan

## Overview
Implement real-time data streaming system where producers can stream data packets directly to consumers through the BSV Overlay Network, with each packet confirmed on-chain via microtransactions and delivered through webhooks or AI agent attachments.

## Adjusted Architecture (Based on Existing Code)

### Current Status
- ✅ D07 streaming quotas schema exists with comprehensive streaming infrastructure
- ✅ Existing agent streaming sessions and webhook delivery systems
- ✅ UHRP host performance tracking and delivery optimization
- ✅ Quota policies and usage windows already implemented

### New Extensions Needed

#### 1. Real-time Packet Schema (D08)
**File**: `src/db/schema-d08-realtime-packets.sql`

**Key Tables**:
- `realtime_packets` - Individual overlay packets with confirmation tracking
- `stream_webhooks` - Webhook subscriptions for confirmed packets
- `stream_websockets` - WebSocket connections for real-time delivery
- `stream_agent_subscriptions` - AI agent attachments to streams
- `webhook_deliveries` - Delivery attempt logging

**Extensions to existing tables**:
- `manifests.is_streaming` - Mark packages as streaming
- `manifests.stream_config` - Stream configuration (frequency, pricing)

#### 2. Real-time Streaming Service
**File**: `src/services/realtime-streaming.ts`

**Core Functions**:
- Packet ingestion and BSV transaction monitoring
- Confirmation tracking (block height, confirmation depth)
- WebSocket broadcast to subscribers
- Webhook delivery with retry logic
- Agent notification system

#### 3. WebSocket Server Integration
**File**: `src/websockets/streaming-server.ts`

**Features**:
- Unidirectional streaming (server → client)
- Connection management per stream
- Real-time packet delivery on confirmation
- Subscriber authentication and authorization

#### 4. Webhook Delivery System
**File**: `src/webhooks/delivery-system.ts`

**Features**:
- HTTP POST delivery with HMAC signatures
- Retry logic with exponential backoff
- Batch delivery support
- Status tracking and error handling

#### 5. BSV Transaction Monitoring
**File**: `src/blockchain/confirmation-monitor.ts`

**Features**:
- Monitor pending transactions for confirmations
- Update packet status in real-time
- Trigger delivery when confirmation depth reached
- Handle failed/dropped transactions

## Implementation Phases

### Phase 1: Core Infrastructure ✅ (Already exists)
- [x] Database schema for streaming (D07)
- [x] Agent streaming sessions
- [x] Quota management
- [x] Basic webhook infrastructure

### Phase 2: Real-time Packet Extensions (Next)
- [ ] Create D08 schema for packet-level tracking
- [ ] Implement packet confirmation monitoring
- [ ] Build webhook delivery system for confirmed packets
- [ ] Set up WebSocket server for real-time streaming

### Phase 3: Producer Integration (Later)
- [ ] Create producer SDK for packet submission
- [ ] Implement microtransaction creation
- [ ] Add packet validation and signing
- [ ] Producer authentication and rate limiting

### Phase 4: Marketplace Integration
- [ ] Extend marketplace UI for streaming packages
- [ ] Add real-time package updates (packet counts, status)
- [ ] Stream discovery and subscription interface
- [ ] Real-time analytics dashboard

### Phase 5: AI Agent Features
- [ ] Agent attachment API
- [ ] Stream processing triggers
- [ ] Custom webhook formats for agents
- [ ] Event-driven processing capabilities

## Key Technical Concepts

### Overlay Packet Flow
1. **Producer** creates data packet + BSV microtransaction
2. **Transaction** submitted to BSV network
3. **Monitor** watches for confirmations
4. **Confirmed packets** trigger delivery to:
   - WebSocket subscribers (real-time)
   - Webhook endpoints (HTTP POST)
   - AI agents (custom processing)

### Data Structure
```json
{
  "packet_sequence": 12345,
  "txid": "abc123...",
  "data_payload": { /* any JSON data */ },
  "confirmation_status": "confirmed",
  "confirmations": 3,
  "block_height": 850000
}
```

### Webhook Delivery Format
```json
{
  "stream_id": "weather-001",
  "packet": { /* packet data */ },
  "delivery_timestamp": "2024-01-01T12:00:00Z",
  "signature": "hmac-sha256-signature"
}
```

### WebSocket Message Format
```json
{
  "type": "packet",
  "stream_id": "weather-001",
  "packet": { /* packet data */ }
}
```

## Current Todo List
1. ✅ Extend existing streaming schema for real-time overlay packets
2. ⏳ Add real-time packet tracking with BSV confirmation
3. ⏳ Implement webhook system for confirmed overlay packets
4. ⏳ Set up unidirectional WebSocket server for packet streams
5. ⏳ Create overlay packet confirmation monitoring
6. ⏳ Extend marketplace for streaming data packages
7. ⏳ Build AI agent attachment API for streams

## Files to Create/Modify

### New Files
- `src/db/schema-d08-realtime-packets.sql`
- `src/services/realtime-streaming.ts`
- `src/websockets/streaming-server.ts`
- `src/webhooks/delivery-system.ts`
- `src/blockchain/confirmation-monitor.ts`

### Existing Files to Extend
- `src/db/hybrid.ts` - Add new table access methods
- `server.ts` - Integrate WebSocket server
- `ui/src/routes/market/+page.svelte` - Add streaming package support

## Integration Points

### With Existing D07 System
- Leverage existing `streaming_usage` for analytics
- Use `quota_policies` for rate limiting
- Extend `agent_streaming_sessions` for packet-level tracking

### With Marketplace
- Streaming packages appear as constantly updating datasets
- Real-time packet count and status updates
- Subscription-based access model

### With AI Agents
- Real-time data processing triggers
- Custom webhook formats
- Event-driven automation

## Success Criteria
1. ✅ Data packets confirmed on-chain cannot be tampered with
2. ✅ Real-time delivery via WebSockets and webhooks
3. ✅ AI agents can subscribe and process streams
4. ✅ Marketplace integration for stream discovery
5. ✅ Scalable to thousands of concurrent streams
6. ✅ Comprehensive monitoring and analytics

## Next Steps
1. Create D08 schema extension
2. Implement packet confirmation monitoring
3. Build webhook delivery system
4. Set up WebSocket streaming server
5. Test end-to-end packet flow