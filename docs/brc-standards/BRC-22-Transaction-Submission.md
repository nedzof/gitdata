# BRC-22: Transaction Submission

**Purpose**: Submit Bitcoin transactions to overlay network with topic-based UTXO tracking

**Status**: ✅ Fully Implemented
**Compliance Level**: 95%
**Endpoint**: `POST /overlay/submit`

## 🎯 Overview

BRC-22 enables applications to submit Bitcoin transactions to overlay networks with automatic topic-based organization and UTXO tracking. Each transaction can target multiple overlay topics, enabling efficient data organization and retrieval.

## 🔧 How It Works

### 1. Topic-Based Organization

```javascript
// Define overlay topics for your application
const topics = [
  'myapp.user.profiles',        // User profile data
  'myapp.content.metadata',     // Content metadata
  'gitdata.manifest',          // File manifest (standard topic)
  'gitdata.agent.capabilities' // AI agent capabilities
];
```

### 2. Transaction Structure

```javascript
const transaction = {
  rawTx: '0100000001a2b3c4d5e6f7...', // Complete raw transaction hex
  inputs: [
    {
      txid: 'input-transaction-id',
      vout: 0,
      scriptSig: 'input-script-signature'
    }
  ],
  topics: topics,
  mapiResponses: [] // Optional mAPI broadcast responses
};
```

### 3. Submit to Overlay Network

```bash
curl -X POST "http://localhost:8788/overlay/submit" \
  -H "Content-Type: application/json" \
  -H "X-BSV-Identity: 0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" \
  -d '{
    "rawTx": "0100000001a2b3c4d5e6f7890123456789abcdef0123456789abcdef0123456789abcdef01000000006a4730440220123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012034567890abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123012103456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567ffffffff0200e1f505000000001976a914abcdef0123456789abcdef0123456789abcdef012388ac00286bee0000000017a914abcdef0123456789abcdef0123456789abcdef01238700000000",
    "inputs": [
      {
        "txid": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789ab",
        "vout": 0,
        "scriptSig": "47304402201234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef0102201234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef01"
      }
    ],
    "topics": [
      "myapp.user.profiles",
      "gitdata.manifest"
    ]
  }'
```

## 📝 Request Format

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `rawTx` | string | Complete raw transaction in hex format |
| `inputs` | array | Array of input objects with txid, vout, scriptSig |
| `topics` | array | Array of overlay topic strings |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `mapiResponses` | array | mAPI broadcast responses for verification |

### Input Object Structure

```typescript
interface TransactionInput {
  txid: string;      // Input transaction ID (64 hex chars)
  vout: number;      // Output index
  scriptSig: string; // Script signature hex
}
```

## 🔐 Authentication

BRC-22 submission requires identity authentication:

```http
X-BSV-Identity: YOUR_PUBLIC_KEY_HEX
X-BSV-Signature: SIGNATURE_OF_REQUEST_BODY
```

For enhanced security, use BRC-31 Authrite authentication:

```http
X-Authrite: 1.0
X-Authrite-Identity-Key: YOUR_PUBLIC_KEY
X-Authrite-Signature: REQUEST_SIGNATURE
X-Authrite-Nonce: CLIENT_NONCE
```

## ✅ Success Response

```json
{
  "success": true,
  "result": {
    "txid": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
    "admittedToTopics": [
      "myapp.user.profiles",
      "gitdata.manifest"
    ],
    "outputsTracked": [
      {
        "vout": 0,
        "topic": "myapp.user.profiles",
        "satoshis": 100000000
      }
    ],
    "blockHeight": null,
    "confirmations": 0
  },
  "message": "Transaction submitted successfully"
}
```

## ❌ Error Responses

### Invalid Transaction Format (400)
```json
{
  "error": "invalid-transaction",
  "message": "rawTx, inputs, and topics are required",
  "code": 400
}
```

### Authentication Required (401)
```json
{
  "error": "identity-required",
  "message": "X-BSV-Identity header is required for transaction submission",
  "code": 401
}
```

### Rate Limited (429)
```json
{
  "error": "rate-limit-exceeded",
  "message": "Maximum 10 submissions per minute exceeded",
  "code": 429
}
```

### Overlay Unavailable (503)
```json
{
  "error": "overlay-unavailable",
  "message": "BSV overlay network is not available",
  "code": 503
}
```

## 🏷️ Topic Conventions

### Standard Topics

- `gitdata.manifest` - File and data manifests
- `gitdata.agent.capabilities` - AI agent capabilities
- `gitdata.identity.certificates` - Identity certificates
- `gitdata.payment.receipts` - Payment receipts

### Custom Topics

Use reverse domain notation:
- `com.yourcompany.app.users`
- `org.yourorg.project.data`
- `myapp.content.metadata`

### Topic Rules

1. **Lowercase only**: Use lowercase letters, numbers, dots
2. **Max length**: 100 characters
3. **No reserved prefixes**: Avoid `brc.`, `bitcoin.`, `system.`
4. **Meaningful names**: Use descriptive, hierarchical names

## 🔄 UTXO Tracking

The overlay network automatically tracks UTXOs for submitted transactions:

### Output Admission Logic

```javascript
// Outputs are admitted to topics based on:
1. Output script pattern matching
2. OP_RETURN data content
3. Topic manager rules
4. Identity verification results
```

### Query Tracked UTXOs

Use BRC-24 lookup services to query tracked UTXOs:

```bash
curl -X POST "http://localhost:8788/overlay/lookup" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "utxo-tracker",
    "query": {
      "topic": "myapp.user.profiles",
      "limit": 10
    }
  }'
```

## 📊 Monitoring & Analytics

### Submission Metrics

Track your submission success rate:

```bash
curl -X GET "http://localhost:8788/overlay/brc-stats" \
  -H "X-BSV-Identity: YOUR_PUBLIC_KEY"
```

Response includes BRC-22 statistics:
```json
{
  "brc22": {
    "totalSubmissions": 1523,
    "successfulSubmissions": 1498,
    "failedSubmissions": 25,
    "averageResponseTime": "145ms",
    "topicsActive": 12
  }
}
```

## 🧪 Testing Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');
const crypto = require('crypto');

async function submitTransaction(rawTx, inputs, topics, identityKey) {
  const requestBody = {
    rawTx,
    inputs,
    topics
  };

  // Sign request for authentication
  const signature = signRequest(JSON.stringify(requestBody), identityKey);

  const response = await axios.post('http://localhost:8788/overlay/submit', requestBody, {
    headers: {
      'Content-Type': 'application/json',
      'X-BSV-Identity': identityKey.toPublicKey().toString(),
      'X-BSV-Signature': signature
    }
  });

  return response.data;
}
```

### Python

```python
import requests
import json
from bsv import PrivateKey

def submit_transaction(raw_tx, inputs, topics, identity_key):
    request_body = {
        'rawTx': raw_tx,
        'inputs': inputs,
        'topics': topics
    }

    # Sign request for authentication
    signature = sign_request(json.dumps(request_body), identity_key)

    headers = {
        'Content-Type': 'application/json',
        'X-BSV-Identity': identity_key.public_key().hex(),
        'X-BSV-Signature': signature
    }

    response = requests.post(
        'http://localhost:8788/overlay/submit',
        json=request_body,
        headers=headers
    )

    return response.json()
```

## 🚀 Best Practices

### 1. Transaction Validation
- Always validate transactions before submission
- Include proper SPV proofs when possible
- Use appropriate fee rates for timely confirmation

### 2. Topic Management
- Use consistent topic naming conventions
- Avoid too many topics per transaction (max 10 recommended)
- Consider topic hierarchy for data organization

### 3. Error Handling
- Implement exponential backoff for rate limits
- Handle network timeouts gracefully
- Log failed submissions for retry

### 4. Performance
- Batch submissions when possible
- Use connection pooling for high-volume applications
- Monitor submission latency and success rates

## 🔗 Related Standards

- **BRC-24**: Query submitted transaction data
- **BRC-31**: Enhanced authentication for submissions
- **BRC-64**: Track transaction history and lineage
- **BRC-88**: Discover overlay services for submission

## 📚 Additional Resources

- [Transaction Format Specification](https://docs.bitcoinsv.io/protocol/transaction-format)
- [SPV Verification Guide](../spv-verification/)
- [Topic Manager Documentation](../topic-management/)
- [Rate Limiting Policies](../rate-limits/)

---

**Next**: Learn about [BRC-24 Lookup Services](./BRC-24-Lookup-Services.md) to query your submitted data.