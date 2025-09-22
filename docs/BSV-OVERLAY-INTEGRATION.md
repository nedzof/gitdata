# BSV Overlay Network Integration

This document describes how to enable and use the BSV overlay network integration in Gitdata.

## Overview

The BSV overlay integration enables real-time data publishing, discovery, and payment processing over the BSV blockchain overlay network. This provides:

- **Decentralized Data Discovery**: Publish and discover D01A-compliant data manifests
- **Real-time Search**: Search for data across the overlay network
- **Overlay Payments**: Process payments for data access via overlay
- **Agent Marketplace**: Coordinate AI agents and services
- **Lineage Tracking**: Share data provenance information

## Prerequisites

1. **BSV Wallet**: A BRC-100 compatible wallet must be connected
2. **Network Access**: Internet connectivity for overlay peer discovery
3. **Environment Setup**: Proper environment configuration

## Installation

The BSV overlay integration is already included in the codebase. No additional installation is required.

## Configuration

### Environment Variables

Set these environment variables to enable overlay integration:

```bash
# Enable overlay network
OVERLAY_ENABLED=true

# Environment (development, staging, production)
OVERLAY_ENV=development

# Optional: Custom overlay configuration
OVERLAY_PEER_DISCOVERY_URLS=https://overlay.powping.com,https://overlay.bitcoinfiles.org
OVERLAY_NETWORK=testnet
```

### Wallet Requirements

Ensure you have a BRC-100 compatible wallet:
- Panda Wallet
- Yours Wallet
- HandCash
- MoneyButton
- Or any BRC-100 compliant wallet

## API Endpoints

### Status and Health

```http
GET /overlay/status
```
Returns overlay network connection status and statistics.

```http
GET /overlay/health
```
Health check endpoint for monitoring.

### Topic Management

```http
POST /overlay/subscribe
Content-Type: application/json

{
  "topic": "gitdata.dataset.public"
}
```

```http
POST /overlay/unsubscribe
Content-Type: application/json

{
  "topic": "gitdata.dataset.public"
}
```

```http
GET /overlay/topics
```
Lists available topics and subscription information.

### Data Publishing

```http
POST /overlay/publish
Content-Type: application/json

{
  "manifest": {
    "datasetId": "my-dataset",
    "description": "My D01A compliant dataset",
    "provenance": {
      "createdAt": "2025-01-22T10:00:00Z",
      "issuer": "02aabbcc..."
    },
    "policy": {
      "license": "cc-by-4.0",
      "classification": "public"
    },
    "content": {
      "contentHash": "abcd1234...",
      "mediaType": "text/csv",
      "sizeBytes": 1024,
      "url": "https://example.com/data.csv"
    },
    "parents": [],
    "tags": ["demo", "test"]
  }
}
```

### Data Discovery

```http
POST /overlay/search
Content-Type: application/json

{
  "datasetId": "my-dataset",
  "classification": "public",
  "tags": ["demo"],
  "limit": 10
}
```

### Payment Integration

```http
POST /overlay/payments/quote
Content-Type: application/json

{
  "versionId": "version-123",
  "quantity": 1
}
```

```http
POST /overlay/payments/submit
Content-Type: application/json

{
  "quoteId": "quote-456"
}
```

```http
GET /overlay/payments/stats
```

### Network Information

```http
GET /overlay/peers
```
Returns connected peer information.

## Standard Topics

The overlay integration supports these standard D01A topics:

### Data Topics
- `gitdata.d01a.manifest` - D01A manifest publishing
- `gitdata.d01a.content` - Data content distribution
- `gitdata.d01a.metadata` - Data metadata sharing
- `gitdata.dataset.public` - Public datasets
- `gitdata.dataset.commercial` - Commercial datasets
- `gitdata.dataset.research` - Research datasets

### AI Model Topics
- `gitdata.model.weights` - Model weight distribution
- `gitdata.model.inference` - Inference services
- `gitdata.model.training` - Training coordination

### Agent Topics
- `gitdata.agent.registry` - Agent announcements
- `gitdata.agent.capabilities` - Agent capabilities
- `gitdata.agent.jobs` - Job coordination
- `gitdata.agent.results` - Results sharing

### Payment Topics
- `gitdata.payment.quotes` - Payment quotes
- `gitdata.payment.receipts` - Payment receipts
- `gitdata.payment.disputes` - Dispute resolution

### Discovery Topics
- `gitdata.search.queries` - Search requests
- `gitdata.search.results` - Search responses
- `gitdata.lineage.graph` - Data lineage
- `gitdata.provenance.chain` - Provenance tracking

## Dynamic Topics

You can also create dynamic topics for specific entities:

```javascript
// Dataset-specific topic
const datasetTopic = TopicGenerator.datasetTopic('my-dataset', 'public');
// => "gitdata.dataset.public.my-dataset"

// Model-specific topic
const modelTopic = TopicGenerator.modelTopic('my-model', 'inference');
// => "gitdata.model.inference.my-model"

// Agent-specific topic
const agentTopic = TopicGenerator.agentTopic('my-agent', 'jobs');
// => "gitdata.agent.jobs.my-agent"
```

## Event-Driven Architecture

The overlay integration uses an event-driven architecture. You can listen for events:

```javascript
overlayManager.on('data-received', (event) => {
  console.log('Received data:', event.data);
});

overlayManager.on('manifest-received', (event) => {
  console.log('New manifest:', event.manifest);
});

paymentService.on('payment-received', (receipt) => {
  console.log('Payment confirmed:', receipt);
});
```

## Security Considerations

1. **Message Signing**: All overlay messages are signed with wallet private keys
2. **Topic Classification**: Topics are classified by access level (public, commercial, internal, restricted)
3. **Payment Verification**: Payments are verified before processing
4. **Identity Management**: Uses BRC-100 identity for authentication

## Development vs Production

### Development Mode
- Uses testnet
- Connects to test overlay nodes
- Reduced security requirements
- Verbose logging

### Production Mode
- Uses mainnet
- Connects to production overlay network
- Full security validation
- Minimal logging

## Troubleshooting

### Common Issues

1. **Overlay Not Connecting**
   - Check `OVERLAY_ENABLED=true` is set
   - Verify wallet is connected
   - Check network connectivity

2. **Payment Failures**
   - Ensure wallet has sufficient balance
   - Verify payment scripts are valid
   - Check quote expiration times

3. **Topic Subscription Failures**
   - Verify topic names are correct
   - Check network permissions
   - Ensure overlay is connected

### Debug Mode

Enable debug logging:
```bash
DEBUG=overlay:* npm start
```

### Health Checks

Monitor overlay health:
```bash
curl http://localhost:8788/overlay/health
curl http://localhost:8788/overlay/status
```

## Performance Considerations

1. **Connection Pooling**: Overlay maintains persistent connections to peers
2. **Message Batching**: Large data transfers are batched
3. **Caching**: Search results and manifests are cached
4. **Rate Limiting**: API endpoints are rate limited

## Integration Examples

### Frontend Integration

```javascript
// Check overlay status
const status = await fetch('/overlay/status').then(r => r.json());

// Publish data
await fetch('/overlay/publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ manifest: myManifest })
});

// Search for data
await fetch('/overlay/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ classification: 'public', limit: 10 })
});
```

### Backend Integration

```javascript
import { initializeOverlayServices } from './src/overlay';

// Initialize overlay services
const overlayServices = await initializeOverlayServices(database, 'production');

// Publish manifest
await overlayServices.overlayManager.publishManifest(manifest);

// Request payment
await overlayServices.paymentService.requestPaymentQuote(versionId);
```

## Future Enhancements

1. **P2P File Transfer**: Direct file transfer between peers
2. **Smart Contracts**: Integration with BSV smart contracts
3. **Federated Search**: Cross-network search capabilities
4. **Advanced Analytics**: Overlay network analytics and monitoring

## Support

For issues related to BSV overlay integration:

1. Check the logs for error messages
2. Verify wallet connectivity
3. Test with development environment first
4. Check overlay network status

## References

- [BSV Overlay Documentation](https://docs.bsvblockchain.org/overlay/)
- [BRC-100 Wallet Standard](https://brc.dev/100)
- [D01A Data Manifest Specification](./D01A-SPEC.md)
- [Gitdata API Documentation](./API.md)