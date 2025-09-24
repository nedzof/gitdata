#!/usr/bin/env tsx
/**
 * D20 Phase 1: Generate API Documentation and Postman Collections
 * Auto-generates OpenAPI specs and exports Postman collection for testing
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import { swaggerSpec } from '../src/docs/openapi-config';

async function generateDocs() {
  console.log('🔄 Generating BSV Overlay Network API Documentation...');

  try {
    // Ensure docs directory exists
    await fs.mkdir('docs/api', { recursive: true });
    await fs.mkdir('postman', { recursive: true });

    // Generate OpenAPI JSON specification
    const openApiPath = 'docs/api/openapi.json';
    await fs.writeFile(openApiPath, JSON.stringify(swaggerSpec, null, 2));
    console.log(`✅ Generated OpenAPI specification: ${openApiPath}`);

    // Generate basic Postman collection structure
    const postmanCollection = {
      info: {
        name: 'BSV Overlay Network API',
        description: 'Complete API collection for BSV overlay network with BRC standards compliance',
        version: '1.0.0',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{jwt_token}}',
            type: 'string',
          },
        ],
      },
      event: [
        {
          listen: 'prerequest',
          script: {
            type: 'text/javascript',
            exec: [
              '// Auto-generate BRC-31 authentication headers if needed',
              'if (pm.request.headers.has("X-Authrite-Identity-Key")) {',
              '  const identityKey = pm.environment.get("identity_key");',
              '  if (identityKey) {',
              '    pm.request.headers.add({',
              '      key: "X-Authrite-Identity-Key",',
              '      value: identityKey',
              '    });',
              '  }',
              '}',
            ],
          },
        },
      ],
      item: [
        {
          name: '🏠 System Status',
          item: [
            {
              name: 'Get Overlay Status',
              request: {
                method: 'GET',
                header: [
                  {
                    key: 'Accept',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: '{{base_url}}/overlay/status',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'status'],
                },
                description: 'Get comprehensive overlay network status and service availability',
              },
              response: [],
            },
            {
              name: 'Get BRC Statistics',
              request: {
                method: 'GET',
                header: [
                  {
                    key: 'Accept',
                    value: 'application/json',
                  },
                  {
                    key: 'X-BSV-Identity',
                    value: '{{identity_key}}',
                  },
                ],
                url: {
                  raw: '{{base_url}}/overlay/brc-stats',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'brc-stats'],
                },
                description: 'Get detailed BRC standards compliance statistics',
              },
              response: [],
            },
          ],
        },
        {
          name: '🔗 BRC-22 Transaction Submission',
          item: [
            {
              name: 'Submit Transaction',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                  {
                    key: 'X-BSV-Identity',
                    value: '{{identity_key}}',
                  },
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      rawTx: '0100000001...',
                      inputs: [
                        {
                          txid: 'example-txid-hash',
                          vout: 0,
                          scriptSig: 'example-script-sig',
                        },
                      ],
                      topics: ['gitdata.manifest', 'gitdata.agent.capabilities'],
                      mapiResponses: [],
                    },
                    null,
                    2,
                  ),
                },
                url: {
                  raw: '{{base_url}}/overlay/submit',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'submit'],
                },
                description: 'Submit BSV transaction to overlay network with topic-based UTXO tracking',
              },
              response: [],
            },
          ],
        },
        {
          name: '🔍 BRC-24 Lookup Services',
          item: [
            {
              name: 'Lookup Query',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                  {
                    key: 'X-BSV-Payment-Output',
                    value: '{{payment_output}}',
                  },
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      provider: 'utxo-tracker',
                      query: {
                        utxoId: 'example-utxo-id',
                        includeHistory: true,
                      },
                    },
                    null,
                    2,
                  ),
                },
                url: {
                  raw: '{{base_url}}/overlay/lookup',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'lookup'],
                },
                description: 'Query overlay network state via lookup services',
              },
              response: [],
            },
            {
              name: 'Get Lookup Providers',
              request: {
                method: 'GET',
                header: [
                  {
                    key: 'Accept',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: '{{base_url}}/overlay/lookup/providers',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'lookup', 'providers'],
                },
                description: 'Get list of available lookup service providers',
              },
              response: [],
            },
          ],
        },
        {
          name: '📁 BRC-26 File Storage (UHRP)',
          item: [
            {
              name: 'Upload File',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'X-BSV-Identity',
                    value: '{{identity_key}}',
                  },
                ],
                body: {
                  mode: 'formdata',
                  formdata: [
                    {
                      key: 'file',
                      type: 'file',
                      src: '/path/to/test-file.json',
                    },
                    {
                      key: 'metadata',
                      value: '{"description":"Test file upload"}',
                    },
                  ],
                },
                url: {
                  raw: '{{base_url}}/overlay/files/upload',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'files', 'upload'],
                },
                description: 'Upload file to overlay network using UHRP',
              },
              response: [],
            },
            {
              name: 'Download File',
              request: {
                method: 'GET',
                header: [
                  {
                    key: 'Accept',
                    value: 'application/octet-stream',
                  },
                ],
                url: {
                  raw: '{{base_url}}/overlay/files/download/{{content_hash}}',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'files', 'download', '{{content_hash}}'],
                },
                description: 'Download file by content hash',
              },
              response: [],
            },
            {
              name: 'Resolve Content',
              request: {
                method: 'GET',
                header: [
                  {
                    key: 'Accept',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: '{{base_url}}/overlay/files/resolve/{{content_hash}}',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'files', 'resolve', '{{content_hash}}'],
                },
                description: 'Resolve content location using UHRP',
              },
              response: [],
            },
          ],
        },
        {
          name: '🔐 BRC-31 Authentication',
          item: [
            {
              name: 'Authenticate Identity',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                  {
                    key: 'X-Authrite',
                    value: '1.0',
                  },
                  {
                    key: 'X-Authrite-Identity-Key',
                    value: '{{identity_key}}',
                  },
                  {
                    key: 'X-Authrite-Nonce',
                    value: '{{client_nonce}}',
                  },
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      identityKey: '{{identity_key}}',
                      nonce: '{{client_nonce}}',
                      certificates: [],
                    },
                    null,
                    2,
                  ),
                },
                url: {
                  raw: '{{base_url}}/overlay/brc31/authenticate',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'brc31', 'authenticate'],
                },
                description: 'Authenticate identity using BRC-31 Authrite protocol',
              },
              response: [],
            },
          ],
        },
        {
          name: '💰 BRC-41 Payment Processing',
          item: [
            {
              name: 'Request Payment',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      service: 'overlay-lookup',
                      satoshis: 5000,
                      description: 'BRC-24 lookup service payment',
                    },
                    null,
                    2,
                  ),
                },
                url: {
                  raw: '{{base_url}}/overlay/brc41/request-payment',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'brc41', 'request-payment'],
                },
                description: 'Request payment for monetized overlay service',
              },
              response: [],
            },
            {
              name: 'Complete Payment',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                  {
                    key: 'X-BSV-Payment-Output',
                    value: '{{payment_output}}',
                  },
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      rawTx: '0100000001...',
                      merkleProof: [],
                    },
                    null,
                    2,
                  ),
                },
                url: {
                  raw: '{{base_url}}/overlay/brc41/payments/{{payment_id}}/complete',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'brc41', 'payments', '{{payment_id}}', 'complete'],
                },
                description: 'Complete payment with BSV transaction proof',
              },
              response: [],
            },
          ],
        },
        {
          name: '🎬 Advanced Streaming',
          item: [
            {
              name: 'Upload Streaming Content',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'X-BSV-Identity',
                    value: '{{identity_key}}',
                  },
                ],
                body: {
                  mode: 'formdata',
                  formdata: [
                    {
                      key: 'file',
                      type: 'file',
                      src: '/path/to/video.mp4',
                    },
                    {
                      key: 'transcode',
                      value: 'true',
                    },
                    {
                      key: 'qualities',
                      value: '["720p", "1080p"]',
                    },
                  ],
                },
                url: {
                  raw: '{{base_url}}/overlay/streaming/upload',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'streaming', 'upload'],
                },
                description: 'Upload video content for streaming with transcoding',
              },
              response: [],
            },
            {
              name: 'Create Live Stream',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      title: 'Live Demo Stream',
                      description: 'Test live streaming setup',
                      qualities: [
                        { resolution: '1920x1080', bitrate: 5000000, fps: 30 },
                        { resolution: '1280x720', bitrate: 2500000, fps: 30 },
                      ],
                    },
                    null,
                    2,
                  ),
                },
                url: {
                  raw: '{{base_url}}/overlay/streaming/live/create',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'streaming', 'live', 'create'],
                },
                description: 'Create new live stream with adaptive quality',
              },
              response: [],
            },
          ],
        },
        {
          name: '🌐 Federation Network',
          item: [
            {
              name: 'Get Federation Status',
              request: {
                method: 'GET',
                header: [
                  {
                    key: 'Accept',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: '{{base_url}}/overlay/federation/status',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'federation', 'status'],
                },
                description: 'Get federation network status and metrics',
              },
              response: [],
            },
            {
              name: 'Discover Nodes',
              request: {
                method: 'GET',
                header: [
                  {
                    key: 'Accept',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: '{{base_url}}/overlay/federation/nodes?region={{region}}',
                  host: ['{{base_url}}'],
                  path: ['overlay', 'federation', 'nodes'],
                  query: [
                    {
                      key: 'region',
                      value: '{{region}}',
                    },
                  ],
                },
                description: 'Discover federation nodes by region',
              },
              response: [],
            },
          ],
        },
      ],
      variable: [
        {
          key: 'base_url',
          value: 'http://localhost:8788',
          type: 'string',
        },
      ],
    };

    // Save Postman collection
    const postmanPath = 'postman/BSV-Overlay-Network-API.postman_collection.json';
    await fs.writeFile(postmanPath, JSON.stringify(postmanCollection, null, 2));
    console.log(`✅ Generated Postman collection: ${postmanPath}`);

    // Generate environment file
    const environment = {
      id: 'bsv-overlay-env',
      name: 'BSV Overlay Network Environment',
      values: [
        { key: 'base_url', value: 'http://localhost:8788', enabled: true },
        { key: 'identity_key', value: 'your-identity-key-here', enabled: true },
        { key: 'jwt_token', value: 'your-jwt-token-here', enabled: true },
        { key: 'client_nonce', value: 'your-client-nonce-here', enabled: true },
        { key: 'payment_output', value: 'your-payment-output-script-here', enabled: true },
        { key: 'content_hash', value: 'example-content-hash', enabled: true },
        { key: 'payment_id', value: 'example-payment-id', enabled: true },
        { key: 'region', value: 'us-east-1', enabled: true },
      ],
      _postman_variable_scope: 'environment',
    };

    const envPath = 'postman/BSV-Overlay-Network.postman_environment.json';
    await fs.writeFile(envPath, JSON.stringify(environment, null, 2));
    console.log(`✅ Generated Postman environment: ${envPath}`);

    // Add documentation scripts to package.json
    console.log('\n🔄 Adding documentation scripts to package.json...');
    const packageJsonPath = 'package.json';
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    packageJson.scripts = {
      ...packageJson.scripts,
      'docs:generate': 'tsx scripts/generate-docs.ts',
      'docs:serve': 'npm run build && npm run dev & sleep 5 && open http://localhost:8788/docs',
      'test:api': 'newman run postman/BSV-Overlay-Network-API.postman_collection.json -e postman/BSV-Overlay-Network.postman_environment.json --reporters cli,junit --reporter-junit-export test-results/newman.xml',
      'test:api:watch': 'newman run postman/BSV-Overlay-Network-API.postman_collection.json -e postman/BSV-Overlay-Network.postman_environment.json --delay-request 1000',
    };

    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`✅ Updated package.json with documentation scripts`);

    console.log('\n🎉 Documentation generation complete!');
    console.log('\n📖 Next steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. View API docs: http://localhost:8788/docs');
    console.log('3. Test with Postman: Import the generated collection and environment');
    console.log('4. Run API tests: npm run test:api');
    console.log('\n✨ D20 Phase 1: OpenAPI & Basic Postman Collection - COMPLETE');
  } catch (error) {
    console.error('❌ Documentation generation failed:', error);
    process.exit(1);
  }
}

// Run the documentation generation
if (require.main === module) {
  generateDocs();
}

export { generateDocs };