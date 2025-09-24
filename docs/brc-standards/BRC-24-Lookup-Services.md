# BRC-24: Lookup Services

**Purpose**: Query overlay network state with powerful search and filtering capabilities

**Status**: ✅ Fully Implemented
**Compliance Level**: 98%
**Endpoint**: `POST /overlay/lookup`

## 🎯 Overview

BRC-24 provides flexible query capabilities for the overlay network, allowing applications to search transactions, UTXOs, files, and other overlay data using various providers and query patterns. It serves as the primary interface for retrieving data submitted via BRC-22.

## 🔧 How It Works

### 1. Provider-Based Queries

```javascript
// Available lookup providers
const providers = [
  'utxo-tracker',      // Query UTXOs by topic, address, or script
  'transaction-index', // Search transactions by various criteria
  'content-resolver',  // Resolve content hashes to metadata
  'agent-registry',    // Find registered AI agents
  'identity-verifier', // Look up identity certificates
  'payment-tracker'    // Query payment history and receipts
];
```

### 2. Query Structure

```javascript
const lookupRequest = {
  provider: 'utxo-tracker',
  query: {
    topic: 'myapp.user.profiles',
    limit: 10,
    offset: 0,
    filters: {
      satoshis: { min: 1000, max: 100000 },
      confirmations: { min: 1 }
    }
  }
};
```

### 3. Execute Query

```bash
curl -X POST "http://localhost:8788/overlay/lookup" \
  -H "Content-Type: application/json" \
  -H "X-BSV-Identity: 0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" \
  -d '{
    "provider": "utxo-tracker",
    "query": {
      "topic": "myapp.user.profiles",
      "limit": 5,
      "filters": {
        "satoshis": { "min": 1000 }
      }
    }
  }'
```

## 📝 Request Format

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | Lookup service provider name |
| `query` | object | Provider-specific query parameters |

### Common Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Maximum results to return (default: 20, max: 100) |
| `offset` | number | Number of results to skip (pagination) |
| `sort` | string | Sort field and direction (e.g., "timestamp:desc") |
| `filters` | object | Additional filtering criteria |

## 🔍 Lookup Providers

### UTXO Tracker

Query unspent transaction outputs by topic, address, or other criteria:

```javascript
// Find UTXOs by topic
const utxoQuery = {
  provider: 'utxo-tracker',
  query: {
    topic: 'gitdata.manifest',
    limit: 10,
    filters: {
      satoshis: { min: 546 },      // Minimum value
      confirmations: { min: 1 },   // Only confirmed UTXOs
      spent: false                 // Unspent only
    }
  }
};

// Find UTXOs by address
const addressQuery = {
  provider: 'utxo-tracker',
  query: {
    address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
    limit: 20
  }
};
```

### Transaction Index

Search transaction history and metadata:

```javascript
const txQuery = {
  provider: 'transaction-index',
  query: {
    topic: 'myapp.payments',
    dateRange: {
      from: '2024-01-01T00:00:00Z',
      to: '2024-12-31T23:59:59Z'
    },
    filters: {
      value: { min: 10000 },       // Minimum satoshi value
      status: 'confirmed'          // Only confirmed transactions
    }
  }
};
```

### Content Resolver

Resolve content hashes to metadata and download URLs:

```javascript
const contentQuery = {
  provider: 'content-resolver',
  query: {
    contentHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
    includeMetadata: true,
    includeStats: true
  }
};
```

### Agent Registry

Find registered AI agents by capabilities:

```javascript
const agentQuery = {
  provider: 'agent-registry',
  query: {
    capabilities: ['file-processing', 'data-analysis'],
    status: 'active',
    filters: {
      rating: { min: 4.0 },
      responseTime: { max: 5000 }  // Max 5 second response time
    }
  }
};
```

## ✅ Success Response

### UTXO Tracker Response

```json
{
  "success": true,
  "provider": "utxo-tracker",
  "results": [
    {
      "txid": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
      "vout": 0,
      "satoshis": 100000,
      "scriptPubKey": "76a914abcdef0123456789abcdef0123456789abcdef012388ac",
      "address": "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
      "topic": "myapp.user.profiles",
      "confirmations": 6,
      "blockHeight": 850123,
      "timestamp": "2024-01-15T10:30:00Z",
      "spent": false
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1,
    "hasMore": false
  },
  "executionTime": "45ms"
}
```

### Transaction Index Response

```json
{
  "success": true,
  "provider": "transaction-index",
  "results": [
    {
      "txid": "b123c45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae4",
      "topics": ["myapp.payments", "gitdata.manifest"],
      "inputValue": 150000,
      "outputValue": 149500,
      "fee": 500,
      "confirmations": 12,
      "blockHeight": 850110,
      "timestamp": "2024-01-15T09:15:00Z",
      "status": "confirmed"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 1,
    "hasMore": false
  }
}
```

## ❌ Error Responses

### Invalid Provider (400)

```json
{
  "error": "invalid-provider",
  "message": "Provider 'unknown-service' is not supported",
  "code": 400,
  "supportedProviders": [
    "utxo-tracker",
    "transaction-index",
    "content-resolver",
    "agent-registry",
    "identity-verifier",
    "payment-tracker"
  ]
}
```

### Query Too Broad (400)

```json
{
  "error": "query-too-broad",
  "message": "Query would return too many results. Please add more specific filters.",
  "code": 400,
  "suggestions": [
    "Add topic filter to narrow results",
    "Reduce limit to maximum of 100",
    "Add date range filter"
  ]
}
```

### Authentication Required (401)

```json
{
  "error": "identity-required",
  "message": "X-BSV-Identity header is required for lookup queries",
  "code": 401
}
```

### Rate Limited (429)

```json
{
  "error": "rate-limit-exceeded",
  "message": "Maximum 30 lookup queries per minute exceeded",
  "code": 429,
  "retryAfter": 45
}
```

## 🔧 Advanced Query Features

### Text Search

Search transaction OP_RETURN data and metadata:

```javascript
const textQuery = {
  provider: 'transaction-index',
  query: {
    textSearch: "invoice payment customer-123",
    searchFields: ['opReturn', 'metadata.description'],
    limit: 10
  }
};
```

### Geospatial Queries

Find content by geographic location:

```javascript
const geoQuery = {
  provider: 'content-resolver',
  query: {
    location: {
      lat: 37.7749,
      lng: -122.4194,
      radius: 10000  // 10km radius
    },
    contentType: 'image/*'
  }
};
```

### Time-Series Aggregation

Get aggregated data over time periods:

```javascript
const aggregateQuery = {
  provider: 'transaction-index',
  query: {
    topic: 'myapp.sales',
    aggregation: {
      groupBy: 'hour',
      functions: ['count', 'sum:satoshis', 'avg:fee'],
      dateRange: {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-07T23:59:59Z'
      }
    }
  }
};
```

## 📊 Performance Optimization

### Query Indexing

The overlay network maintains optimized indexes for common query patterns:

- **Topic Index**: Fast lookup by overlay topics
- **Address Index**: Query by Bitcoin addresses
- **Content Hash Index**: Resolve content hashes instantly
- **Time Series Index**: Efficient date range queries
- **Full-Text Index**: Search OP_RETURN and metadata content

### Caching Strategy

```javascript
// Responses are cached based on query parameters
const cachedQuery = {
  provider: 'utxo-tracker',
  query: {
    topic: 'gitdata.manifest',
    cache: {
      maxAge: 300,     // Cache for 5 minutes
      staleWhileRevalidate: 60  // Serve stale for 1 minute while updating
    }
  }
};
```

## 🧪 Testing Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class LookupService {
  constructor(baseUrl, identityKey) {
    this.baseUrl = baseUrl;
    this.identityKey = identityKey;
  }

  async query(provider, query) {
    const response = await axios.post(`${this.baseUrl}/overlay/lookup`, {
      provider,
      query
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-BSV-Identity': this.identityKey
      }
    });

    return response.data;
  }

  async findUTXOs(topic, filters = {}) {
    return this.query('utxo-tracker', {
      topic,
      filters,
      limit: 20
    });
  }

  async searchTransactions(topic, dateRange) {
    return this.query('transaction-index', {
      topic,
      dateRange,
      sort: 'timestamp:desc'
    });
  }

  async resolveContent(contentHash) {
    return this.query('content-resolver', {
      contentHash,
      includeMetadata: true
    });
  }
}

// Usage
const lookup = new LookupService('http://localhost:8788', 'YOUR_IDENTITY_KEY');

// Find recent UTXOs
const utxos = await lookup.findUTXOs('myapp.user.profiles', {
  confirmations: { min: 1 },
  satoshis: { min: 1000 }
});

// Search transaction history
const transactions = await lookup.searchTransactions('myapp.payments', {
  from: '2024-01-01T00:00:00Z',
  to: '2024-01-31T23:59:59Z'
});
```

### Python

```python
import requests
import json
from datetime import datetime, timedelta

class LookupService:
    def __init__(self, base_url, identity_key):
        self.base_url = base_url
        self.identity_key = identity_key

    def query(self, provider, query_params):
        response = requests.post(
            f"{self.base_url}/overlay/lookup",
            json={
                "provider": provider,
                "query": query_params
            },
            headers={
                "Content-Type": "application/json",
                "X-BSV-Identity": self.identity_key
            }
        )
        return response.json()

    def find_utxos(self, topic, filters=None):
        query = {"topic": topic, "limit": 20}
        if filters:
            query["filters"] = filters
        return self.query("utxo-tracker", query)

    def search_transactions(self, topic, days_back=7):
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)

        return self.query("transaction-index", {
            "topic": topic,
            "dateRange": {
                "from": start_date.isoformat() + "Z",
                "to": end_date.isoformat() + "Z"
            },
            "sort": "timestamp:desc"
        })

# Usage
lookup = LookupService("http://localhost:8788", "YOUR_IDENTITY_KEY")

# Find UTXOs with value filter
utxos = lookup.find_utxos("gitdata.manifest", {
    "satoshis": {"min": 546},
    "spent": False
})

# Search recent transactions
transactions = lookup.search_transactions("myapp.sales", days_back=30)
```

## 🚀 Best Practices

### 1. Query Optimization

- Use specific topic filters to reduce result sets
- Implement pagination for large result sets
- Use appropriate limit values (default: 20, max: 100)
- Cache frequent queries client-side

### 2. Error Handling

- Handle rate limits with exponential backoff
- Validate provider names before querying
- Check for pagination in responses
- Log failed queries for debugging

### 3. Security

- Always include identity headers for authentication
- Validate query parameters to prevent injection
- Use HTTPS in production environments
- Implement query result access controls

### 4. Performance

- Use indexes for common query patterns
- Implement query result caching
- Monitor query execution times
- Optimize database queries for scale

## 🔗 Related Standards

- **BRC-22**: Submit data that can be queried via BRC-24
- **BRC-31**: Authenticate lookup requests
- **BRC-41**: Pay for premium lookup services
- **BRC-64**: Query transaction history and lineage
- **BRC-88**: Discover lookup service capabilities

## 📚 Additional Resources

- [Query Performance Guide](../performance/lookup-optimization.md)
- [Provider API Reference](../providers/)
- [Caching Strategies](../caching/)
- [Query Security Best Practices](../security/query-protection.md)

---

**Next**: Learn about [BRC-26 File Storage (UHRP)](./BRC-26-File-Storage.md) for content addressing and file management.