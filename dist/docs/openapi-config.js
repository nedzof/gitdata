"use strict";
/**
 * D20 Phase 1: OpenAPI 3.0 Configuration for BSV Overlay Network
 * Auto-generates comprehensive API documentation from Express routes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = exports.openAPIOptions = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const package_json_1 = require("../../package.json");
exports.openAPIOptions = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'BSV Overlay Network API',
            version: package_json_1.version,
            description: `
# BSV Overlay Network API Documentation

Complete API documentation for the BSV overlay network infrastructure with full BRC standards compliance.

## Features

- **🔗 BRC Standards Compliance**: Full support for BRC-22, BRC-24, BRC-26, BRC-31, BRC-41, BRC-64, BRC-88
- **🎬 Advanced Streaming**: Live streaming, transcoding, P2P distribution, CDN integration
- **🌐 Federation Network**: Cross-network content synchronization and discovery
- **💰 Payment Processing**: Native BSV payments with BRC-41 PacketPay integration
- **🔐 Authentication**: BRC-31 identity verification and certificate chain validation
- **📊 Analytics**: Comprehensive metrics, monitoring, and performance tracking

## Quick Start

1. Set up your overlay network connection
2. Authenticate using BRC-31 headers
3. Submit transactions via BRC-22 endpoints
4. Upload and stream content via BRC-26 UHRP
5. Process payments via BRC-41 PacketPay

## BRC Standards Overview

| Standard | Purpose | Endpoints |
|----------|---------|-----------|
| **BRC-22** | Transaction Submission | \`/overlay/submit\` |
| **BRC-24** | Lookup Services | \`/overlay/lookup\` |
| **BRC-26** | File Storage (UHRP) | \`/overlay/files/*\` |
| **BRC-31** | Authentication | \`/overlay/brc31/*\` |
| **BRC-41** | Payment Processing | \`/overlay/brc41/*\` |
| **BRC-64** | History Tracking | \`/overlay/history/*\` |
| **BRC-88** | Service Discovery | \`/overlay/services/*\` |

## Authentication

All API endpoints require proper authentication headers:

\`\`\`javascript
{
  "X-BSV-Identity": "your-identity-key",
  "X-BSV-Signature": "request-signature",
  "Authorization": "Bearer your-jwt-token"
}
\`\`\`

For BRC-31 authentication, include additional headers:

\`\`\`javascript
{
  "X-Authrite": "1.0",
  "X-Authrite-Identity-Key": "your-public-key",
  "X-Authrite-Signature": "request-signature",
  "X-Authrite-Nonce": "client-nonce",
  "X-Authrite-Certificates": "certificate-chain"
}
\`\`\`

## Payment Integration

For monetized endpoints, include BRC-41 payment headers:

\`\`\`javascript
{
  "X-BSV-Payment-Output": "payment-output-script",
  "X-BSV-Payment-Amount": "satoshis-amount",
  "X-BSV-Payment-Signature": "payment-signature"
}
\`\`\`
      `,
            contact: {
                name: 'BSV Overlay Network Support',
                url: 'https://github.com/your-org/bsv-overlay-network',
                email: 'support@youroverlay.com',
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT',
            },
            termsOfService: 'https://youroverlay.com/terms',
        },
        servers: [
            {
                url: 'http://localhost:8788',
                description: 'Development server',
            },
            {
                url: 'https://api.youroverlay.com',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                BSVIdentity: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-BSV-Identity',
                    description: 'BSV identity key for basic authentication',
                },
                BRC31Auth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'BRC-31 Authrite mutual authentication',
                },
                BRC41Payment: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-BSV-Payment-Output',
                    description: 'BRC-41 PacketPay payment output for monetized endpoints',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error code',
                            example: 'invalid-request',
                        },
                        message: {
                            type: 'string',
                            description: 'Human-readable error message',
                            example: 'Invalid request parameters provided',
                        },
                        code: {
                            type: 'integer',
                            description: 'HTTP status code',
                            example: 400,
                        },
                    },
                    required: ['error', 'message'],
                },
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true,
                        },
                        message: {
                            type: 'string',
                            example: 'Operation completed successfully',
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            example: '2024-09-24T12:45:00.000Z',
                        },
                    },
                    required: ['success'],
                },
                BRC22Transaction: {
                    type: 'object',
                    properties: {
                        rawTx: {
                            type: 'string',
                            description: 'Raw transaction hex',
                            example: '0100000001...',
                        },
                        inputs: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    txid: { type: 'string' },
                                    vout: { type: 'integer' },
                                    scriptSig: { type: 'string' },
                                },
                            },
                        },
                        topics: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'BRC-22 overlay topics',
                            example: ['gitdata.manifest', 'gitdata.agent.capabilities'],
                        },
                        mapiResponses: {
                            type: 'array',
                            items: { type: 'object' },
                            description: 'mAPI broadcast responses',
                        },
                    },
                    required: ['rawTx', 'inputs', 'topics'],
                },
                BRC24LookupQuery: {
                    type: 'object',
                    properties: {
                        provider: {
                            type: 'string',
                            description: 'Lookup service provider',
                            example: 'utxo-tracker',
                        },
                        query: {
                            type: 'object',
                            description: 'Provider-specific query parameters',
                            additionalProperties: true,
                        },
                    },
                    required: ['provider', 'query'],
                },
                BRC26FileUpload: {
                    type: 'object',
                    properties: {
                        contentHash: {
                            type: 'string',
                            description: 'SHA-256 hash of file content',
                            pattern: '^[a-f0-9]{64}$',
                            example: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
                        },
                        contentType: {
                            type: 'string',
                            description: 'MIME type of the content',
                            example: 'application/json',
                        },
                        size: {
                            type: 'integer',
                            description: 'File size in bytes',
                            example: 1024,
                        },
                        metadata: {
                            type: 'object',
                            description: 'Additional file metadata',
                            additionalProperties: true,
                        },
                    },
                    required: ['contentHash', 'contentType', 'size'],
                },
                BRC31AuthRequest: {
                    type: 'object',
                    properties: {
                        identityKey: {
                            type: 'string',
                            description: 'Client public key (33-byte compressed, hex encoded)',
                            pattern: '^[0-9a-f]{66}$',
                            example: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
                        },
                        nonce: {
                            type: 'string',
                            description: 'Client-generated nonce',
                            example: 'abc123def456',
                        },
                        certificates: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'BRC-31 certificate chain',
                        },
                    },
                    required: ['identityKey', 'nonce'],
                },
                BRC41PaymentRequest: {
                    type: 'object',
                    properties: {
                        service: {
                            type: 'string',
                            description: 'Service being paid for',
                            example: 'overlay-lookup',
                        },
                        satoshis: {
                            type: 'integer',
                            description: 'Payment amount in satoshis',
                            minimum: 1,
                            example: 5000,
                        },
                        description: {
                            type: 'string',
                            description: 'Payment description',
                            example: 'BRC-24 lookup service payment',
                        },
                    },
                    required: ['service', 'satoshis', 'description'],
                },
                LiveStream: {
                    type: 'object',
                    properties: {
                        streamId: {
                            type: 'string',
                            description: 'Unique stream identifier',
                            example: 'stream_abc123',
                        },
                        title: {
                            type: 'string',
                            description: 'Stream title',
                            example: 'Live Demo Stream',
                        },
                        status: {
                            type: 'string',
                            enum: ['created', 'live', 'stopped', 'error'],
                            example: 'live',
                        },
                        rtmpUrl: {
                            type: 'string',
                            description: 'RTMP ingest URL',
                            example: 'rtmp://ingest.youroverlay.com/live/abc123',
                        },
                        hlsUrl: {
                            type: 'string',
                            description: 'HLS playback URL',
                            example: 'https://cdn.youroverlay.com/hls/abc123/playlist.m3u8',
                        },
                        quality: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    resolution: { type: 'string', example: '1920x1080' },
                                    bitrate: { type: 'integer', example: 5000000 },
                                    fps: { type: 'integer', example: 30 },
                                },
                            },
                        },
                    },
                    required: ['streamId', 'title', 'status'],
                },
            },
        },
        tags: [
            {
                name: 'System',
                description: 'System status and health endpoints',
            },
            {
                name: 'BRC-22',
                description: 'Transaction submission with topic-based UTXO tracking',
            },
            {
                name: 'BRC-24',
                description: 'Lookup services for overlay state querying',
            },
            {
                name: 'BRC-26',
                description: 'Universal Hash Resolution Protocol (UHRP) file storage',
            },
            {
                name: 'BRC-31',
                description: 'Authrite mutual authentication protocol',
            },
            {
                name: 'BRC-41',
                description: 'PacketPay HTTP payment processing',
            },
            {
                name: 'BRC-64',
                description: 'Transaction history tracking and lineage graphs',
            },
            {
                name: 'BRC-88',
                description: 'SHIP/SLAP service discovery and synchronization',
            },
            {
                name: 'Streaming',
                description: 'Advanced streaming, transcoding, and content delivery',
            },
            {
                name: 'Federation',
                description: 'Cross-network content synchronization and discovery',
            },
            {
                name: 'CDN',
                description: 'Content delivery network integration',
            },
        ],
    },
    apis: [
        './src/routes/overlay-*.ts',
        './src/routes/streaming*.ts',
        './src/routes/d*-*.ts',
        './src/docs/api-examples.ts',
    ],
};
exports.swaggerSpec = (0, swagger_jsdoc_1.default)(exports.openAPIOptions);
//# sourceMappingURL=openapi-config.js.map