# BRC-31: Authentication (Authrite)

**Purpose**: Mutual authentication protocol using Bitcoin identities and cryptographic proofs

**Status**: ✅ Fully Implemented
**Compliance Level**: 97%
**Endpoint**: `POST /overlay/brc31/authenticate`

## 🎯 Overview

BRC-31 implements the Authrite protocol for mutual authentication between clients and overlay networks. It uses Bitcoin key pairs for identity verification, providing secure, decentralized authentication without relying on traditional PKI infrastructure.

## 🔧 How It Works

### 1. Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant O as Overlay Network

    C->>O: 1. Request authentication challenge
    O->>C: 2. Server nonce + requirements
    C->>C: 3. Generate client nonce + sign request
    C->>O: 4. Submit identity proof + signatures
    O->>O: 5. Verify signatures & identity
    O->>C: 6. Return JWT token + capabilities
    C->>O: 7. Use JWT for authenticated requests
```

### 2. Identity Key Generation

```javascript
const { PrivateKey } = require('@bsv/sdk');

// Generate or load identity key
const identityKey = PrivateKey.fromRandom();
const publicKey = identityKey.toPublicKey();

console.log('Identity Private Key:', identityKey.toString());
console.log('Identity Public Key:', publicKey.toString());
```

### 3. Authentication Request

```bash
curl -X POST "http://localhost:8788/overlay/brc31/authenticate" \
  -H "Content-Type: application/json" \
  -H "X-Authrite: 1.0" \
  -H "X-Authrite-Identity-Key: 0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" \
  -H "X-Authrite-Nonce: a1b2c3d4e5f6789012345678abcdef01" \
  -d '{
    "identityKey": "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    "nonce": "a1b2c3d4e5f6789012345678abcdef01",
    "certificates": [],
    "requestedCapabilities": ["read", "write", "admin"]
  }'
```

## 📝 Request Format

### Authentication Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Authrite` | ✅ | Protocol version (currently "1.0") |
| `X-Authrite-Identity-Key` | ✅ | Client public key hex |
| `X-Authrite-Nonce` | ✅ | Client-generated nonce (32 hex chars) |
| `X-Authrite-Signature` | ✅ | Request body signature |

### Request Body

```typescript
interface AuthenticationRequest {
  identityKey: string;           // Public key hex (66 chars)
  nonce: string;                // Client nonce (32 hex chars)
  certificates: Certificate[];   // Identity certificates (optional)
  requestedCapabilities?: string[]; // Requested permissions
  metadata?: Record<string, any>;   // Additional context
}

interface Certificate {
  type: string;                 // Certificate type
  issuer: string;              // Issuer public key
  subject: string;             // Subject public key
  validFrom: string;           // ISO 8601 date
  validTo: string;             // ISO 8601 date
  signature: string;           // Certificate signature
  claims: Record<string, any>; // Certificate claims
}
```

### Signature Generation

```javascript
const crypto = require('crypto');

function signAuthRequest(requestBody, privateKey, nonce) {
  // Create message to sign
  const message = nonce + JSON.stringify(requestBody);

  // Sign with ECDSA
  const signature = privateKey.sign(Buffer.from(message, 'utf8'));

  return signature.toString('hex');
}

// Usage
const requestBody = {
  identityKey: publicKey.toString(),
  nonce: clientNonce,
  certificates: []
};

const signature = signAuthRequest(requestBody, identityKey, clientNonce);
```

## ✅ Success Response

```json
{
  "success": true,
  "token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMjc5YmU2NjdlZjlkY2JiYWM1NWEwNjI5NWNlODcwYjA3MDI5YmZjZGIyZGNlMjhkOTU5ZjI4MTViMTZmODE3OTgiLCJpYXQiOjE2NDM3MzYwMDAsImV4cCI6MTY0MzczNjkwMCwiYXVkIjoib3ZlcmxheSIsImlzcyI6ImJzdm92ZXJsYXkiLCJjYXAiOlsicmVhZCIsIndyaXRlIl19.signature-here",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "expiresAt": "2024-01-15T11:30:00Z",
  "identity": {
    "publicKey": "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    "verified": true,
    "reputation": 85,
    "firstSeen": "2023-06-15T14:22:00Z",
    "lastActivity": "2024-01-15T10:25:00Z"
  },
  "capabilities": [
    "read",
    "write",
    "file-upload",
    "lookup-query"
  ],
  "serverInfo": {
    "version": "1.0.0",
    "supportedStandards": ["BRC-22", "BRC-24", "BRC-26", "BRC-31", "BRC-41"],
    "rateLimit": {
      "requests": 1000,
      "window": 3600
    }
  },
  "challenge": {
    "serverNonce": "b2c3d4e5f6789012345678abcdef012",
    "timestamp": "2024-01-15T10:30:00Z",
    "verified": true
  }
}
```

## ❌ Error Responses

### Invalid Signature (401)

```json
{
  "error": "invalid-signature",
  "message": "Request signature verification failed",
  "code": 401,
  "details": {
    "expectedSigner": "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    "signatureValid": false,
    "messageHash": "a1b2c3d4e5f6789..."
  }
}
```

### Expired Nonce (401)

```json
{
  "error": "expired-nonce",
  "message": "Client nonce is too old or has been used",
  "code": 401,
  "details": {
    "nonceAge": 900,
    "maxAge": 300,
    "nonce": "a1b2c3d4e5f6789012345678abcdef01"
  }
}
```

### Identity Blocked (403)

```json
{
  "error": "identity-blocked",
  "message": "Identity is blocked due to policy violations",
  "code": 403,
  "details": {
    "reason": "rate-limit-violations",
    "blockedUntil": "2024-01-16T10:30:00Z",
    "appealUrl": "/overlay/auth/appeal"
  }
}
```

### Insufficient Reputation (403)

```json
{
  "error": "insufficient-reputation",
  "message": "Identity reputation below minimum threshold",
  "code": 403,
  "details": {
    "currentReputation": 25,
    "requiredReputation": 50,
    "improvementTips": [
      "Complete identity verification",
      "Maintain good API usage patterns",
      "Participate in network governance"
    ]
  }
}
```

## 🔐 Token Usage

### Using JWT Tokens

```javascript
// Add token to request headers
const headers = {
  'Authorization': `Bearer ${jwtToken}`,
  'Content-Type': 'application/json'
};

// Make authenticated API call
const response = await axios.post('/overlay/submit', transactionData, { headers });
```

### Token Refresh

```javascript
async function refreshToken(currentToken) {
  // Extract expiration from token
  const payload = JSON.parse(atob(currentToken.split('.')[1]));
  const expiresAt = new Date(payload.exp * 1000);
  const now = new Date();

  // Refresh if token expires within 5 minutes
  if (expiresAt.getTime() - now.getTime() < 300000) {
    return await authenticate();
  }

  return currentToken;
}
```

## 🏆 Reputation System

### Reputation Factors

```typescript
interface ReputationMetrics {
  successfulTransactions: number;    // BRC-22 submissions
  apiUsagePattern: number;          // Consistent, non-abusive usage
  identityVerification: number;     // Verified certificates
  networkParticipation: number;     // Contributing to network health
  paymentHistory: number;           // BRC-41 payment reliability
  uptime: number;                   // Service availability (for providers)
}
```

### Reputation Calculation

```javascript
function calculateReputation(metrics) {
  const weights = {
    successfulTransactions: 0.25,
    apiUsagePattern: 0.20,
    identityVerification: 0.15,
    networkParticipation: 0.15,
    paymentHistory: 0.15,
    uptime: 0.10
  };

  let reputation = 0;
  for (const [metric, value] of Object.entries(metrics)) {
    reputation += (value / 100) * weights[metric] * 100;
  }

  return Math.min(100, Math.max(0, reputation));
}
```

## 📜 Identity Certificates

### Certificate Types

- **Domain Verification**: Prove control over a domain
- **Social Media**: Link to verified social accounts
- **Organization**: Business or institutional identity
- **Skill**: Technical or professional certifications
- **Custom**: Application-specific certificates

### Certificate Structure

```json
{
  "type": "domain-verification",
  "issuer": "02d0d0f1c2e3f4567890abcdef0123456789abcdef0123456789abcdef012345678",
  "subject": "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  "validFrom": "2024-01-01T00:00:00Z",
  "validTo": "2024-12-31T23:59:59Z",
  "claims": {
    "domain": "example.com",
    "verified": true,
    "method": "dns-txt-record"
  },
  "signature": "3044022012345678901234567890123456789012345678901234567890123456789012340220abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef"
}
```

### Creating Certificates

```javascript
function createDomainCertificate(issuerKey, subjectKey, domain) {
  const certificate = {
    type: 'domain-verification',
    issuer: issuerKey.toPublicKey().toString(),
    subject: subjectKey,
    validFrom: new Date().toISOString(),
    validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    claims: {
      domain: domain,
      verified: true,
      method: 'dns-txt-record'
    }
  };

  // Sign certificate
  const message = JSON.stringify(certificate);
  certificate.signature = issuerKey.sign(Buffer.from(message)).toString('hex');

  return certificate;
}
```

## 🧪 Testing Examples

### JavaScript/Node.js

```javascript
const { PrivateKey } = require('@bsv/sdk');
const axios = require('axios');
const crypto = require('crypto');

class AuthriteClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.identityKey = null;
    this.jwtToken = null;
    this.tokenExpiration = null;
  }

  generateIdentity() {
    this.identityKey = PrivateKey.fromRandom();
    return this.identityKey.toPublicKey().toString();
  }

  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  signMessage(message) {
    const messageBuffer = Buffer.from(message, 'utf8');
    return this.identityKey.sign(messageBuffer).toString('hex');
  }

  async authenticate(requestedCapabilities = ['read', 'write']) {
    const nonce = this.generateNonce();
    const publicKey = this.identityKey.toPublicKey().toString();

    const requestBody = {
      identityKey: publicKey,
      nonce,
      certificates: [],
      requestedCapabilities
    };

    const message = nonce + JSON.stringify(requestBody);
    const signature = this.signMessage(message);

    const response = await axios.post(`${this.baseUrl}/overlay/brc31/authenticate`, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'X-Authrite': '1.0',
        'X-Authrite-Identity-Key': publicKey,
        'X-Authrite-Nonce': nonce,
        'X-Authrite-Signature': signature
      }
    });

    const { token, expiresAt } = response.data;
    this.jwtToken = token;
    this.tokenExpiration = new Date(expiresAt);

    return response.data;
  }

  async authenticatedRequest(method, endpoint, data = null) {
    // Check if token needs refresh
    if (!this.jwtToken || new Date() >= this.tokenExpiration) {
      await this.authenticate();
    }

    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.jwtToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    return axios(config);
  }

  isAuthenticated() {
    return this.jwtToken && new Date() < this.tokenExpiration;
  }
}

// Usage example
async function demonstrateAuthentication() {
  const client = new AuthriteClient('http://localhost:8788');

  // Generate identity
  const publicKey = client.generateIdentity();
  console.log('Generated identity:', publicKey);

  // Authenticate
  const authResult = await client.authenticate(['read', 'write', 'file-upload']);
  console.log('Authentication successful:', authResult.success);
  console.log('Granted capabilities:', authResult.capabilities);

  // Make authenticated API calls
  const statusResponse = await client.authenticatedRequest('GET', '/overlay/status');
  console.log('Overlay status:', statusResponse.data);

  // Upload a file (requires authentication)
  const uploadResponse = await client.authenticatedRequest('POST', '/overlay/files/upload', {
    /* file data */
  });
}
```

### Python

```python
import requests
import json
import hashlib
import secrets
import time
from datetime import datetime, timedelta
from bsv import PrivateKey

class AuthriteClient:
    def __init__(self, base_url):
        self.base_url = base_url
        self.identity_key = None
        self.jwt_token = None
        self.token_expiration = None

    def generate_identity(self):
        self.identity_key = PrivateKey.from_random()
        return self.identity_key.public_key().hex()

    def generate_nonce(self):
        return secrets.token_hex(16)

    def sign_message(self, message):
        return self.identity_key.sign(message.encode()).hex()

    def authenticate(self, requested_capabilities=['read', 'write']):
        nonce = self.generate_nonce()
        public_key = self.identity_key.public_key().hex()

        request_body = {
            'identityKey': public_key,
            'nonce': nonce,
            'certificates': [],
            'requestedCapabilities': requested_capabilities
        }

        message = nonce + json.dumps(request_body, separators=(',', ':'))
        signature = self.sign_message(message)

        headers = {
            'Content-Type': 'application/json',
            'X-Authrite': '1.0',
            'X-Authrite-Identity-Key': public_key,
            'X-Authrite-Nonce': nonce,
            'X-Authrite-Signature': signature
        }

        response = requests.post(
            f"{self.base_url}/overlay/brc31/authenticate",
            json=request_body,
            headers=headers
        )

        result = response.json()
        self.jwt_token = result['token']
        self.token_expiration = datetime.fromisoformat(
            result['expiresAt'].replace('Z', '+00:00')
        )

        return result

    def authenticated_request(self, method, endpoint, data=None):
        # Check if token needs refresh
        if not self.jwt_token or datetime.now() >= self.token_expiration:
            self.authenticate()

        headers = {
            'Authorization': f'Bearer {self.jwt_token}',
            'Content-Type': 'application/json'
        }

        return requests.request(
            method,
            f"{self.base_url}{endpoint}",
            json=data,
            headers=headers
        )

    def is_authenticated(self):
        return self.jwt_token and datetime.now() < self.token_expiration

# Usage
client = AuthriteClient("http://localhost:8788")

# Generate identity
public_key = client.generate_identity()
print(f"Generated identity: {public_key}")

# Authenticate
auth_result = client.authenticate(['read', 'write', 'admin'])
print(f"Authentication successful: {auth_result['success']}")
print(f"Granted capabilities: {auth_result['capabilities']}")

# Make authenticated requests
status_response = client.authenticated_request('GET', '/overlay/status')
print(f"Overlay status: {status_response.json()}")
```

## 🚀 Best Practices

### 1. Key Management

- Store private keys securely (hardware wallets, encrypted storage)
- Use different keys for different applications
- Implement key rotation policies
- Never log or transmit private keys

### 2. Authentication Flow

- Always verify server certificates in production
- Implement proper nonce generation and tracking
- Use secure random number generators
- Validate token expiration before requests

### 3. Error Handling

- Implement exponential backoff for authentication failures
- Handle network timeouts gracefully
- Retry authentication on token expiration
- Log authentication events for monitoring

### 4. Security

- Use HTTPS in production environments
- Validate all incoming tokens and signatures
- Implement rate limiting on authentication endpoints
- Monitor for suspicious authentication patterns

## 🔗 Related Standards

- **BRC-22**: Authenticated transaction submission
- **BRC-24**: Authenticated lookup queries
- **BRC-26**: Authenticated file operations
- **BRC-41**: Payment authentication
- **BRC-88**: Service authentication

## 📚 Additional Resources

- [Authrite Specification](../protocols/authrite.md)
- [Bitcoin Key Management](../security/key-management.md)
- [JWT Best Practices](../security/jwt-security.md)
- [Identity Certificates Guide](../certificates/)

---

**Next**: Learn about [BRC-41 Payment Processing](./BRC-41-Payment-Processing.md) for HTTP micropayments.