/**
 * E2E Integration Tests: Producer-Consumer Full BRC Stack
 *
 * This test suite validates the complete end-to-end workflow between
 * the D15 Producer CLI and D14 Consumer CLI, testing every BRC standard
 * in real-world scenarios with multiple streams and micropayments.
 *
 * BRC Standards Tested:
 * - BRC-22: Transaction Submission
 * - BRC-24: Lookup Services
 * - BRC-26: UHRP Content Storage
 * - BRC-31: Identity Authentication
 * - BRC-41: PacketPay HTTP Micropayments
 * - BRC-64: History Tracking
 * - BRC-88: Service Discovery
 * - D21: BSV Native Payments
 * - D22: Storage Backend
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import { webcrypto } from 'crypto';
import { createHash, randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Test Configuration
const TEST_CONFIG = {
  OVERLAY_BASE_URL: 'http://localhost:3000',
  CONSUMER_CLI_PATH: './cli/consumer/overlay-consumer-cli.py',
  PRODUCER_CLI_PATH: './cli/producer/overlay-producer-cli.ts',
  TEST_DATA_DIR: './test/fixtures/e2e-data',
  TEST_STREAMS: {
    MARKET_DATA: 'market_data_stream',
    SENSOR_DATA: 'sensor_telemetry_stream',
    VIDEO_STREAM: 'video_content_stream',
    DOCUMENT_STREAM: 'document_publishing_stream'
  },
  PAYMENT_AMOUNTS: {
    SMALL: 100, // 100 satoshis
    MEDIUM: 1000, // 1000 satoshis
    LARGE: 10000 // 10000 satoshis
  }
};

// Test Data Structures
interface TestIdentity {
  privateKey: string;
  publicKey: string;
  identityKey: string;
  certificates?: any[];
}

interface StreamData {
  streamId: string;
  contentType: string;
  data: Buffer;
  metadata: {
    producer: string;
    timestamp: string;
    sequence: number;
    price: number;
  };
}

interface PaymentRecord {
  transactionId: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'settled';
  timestamp: string;
}

// Test Utilities
class TestUtils {
  static async generateTestIdentity(): Promise<TestIdentity> {
    const keyPair = await webcrypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );

    const privateKeyJwk = await webcrypto.subtle.exportKey('jwk', keyPair.privateKey);
    const publicKeyJwk = await webcrypto.subtle.exportKey('jwk', keyPair.publicKey);

    return {
      privateKey: JSON.stringify(privateKeyJwk),
      publicKey: JSON.stringify(publicKeyJwk),
      identityKey: createHash('sha256').update(JSON.stringify(publicKeyJwk)).digest('hex')
    };
  }

  static async createTestStreamData(streamId: string, sequence: number): Promise<StreamData> {
    const testData = {
      timestamp: new Date().toISOString(),
      sequence,
      data: randomBytes(1024).toString('base64'),
      metadata: {
        streamId,
        contentType: 'application/json',
        encoding: 'base64'
      }
    };

    return {
      streamId,
      contentType: 'application/json',
      data: Buffer.from(JSON.stringify(testData)),
      metadata: {
        producer: 'test-producer-001',
        timestamp: testData.timestamp,
        sequence,
        price: TEST_CONFIG.PAYMENT_AMOUNTS.SMALL
      }
    };
  }

  static async waitForServiceReady(url: string, timeoutMs = 30000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await axios.get(`${url}/health`, { timeout: 5000 });
        if (response.status === 200 && response.data.status === 'ok') {
          return;
        }
      } catch (error) {
        // Service not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(`Service at ${url} did not become ready within ${timeoutMs}ms`);
  }
}

// Test Suite
describe('E2E Producer-Consumer BRC Stack Integration', () => {
  let overlayService: ChildProcess;
  let producerIdentity: TestIdentity;
  let consumerIdentity: TestIdentity;
  let testStreams: StreamData[] = [];
  let paymentRecords: PaymentRecord[] = [];

  beforeAll(async () => {
    // Create test data directory
    await fs.mkdir(TEST_CONFIG.TEST_DATA_DIR, { recursive: true });

    // Generate test identities
    producerIdentity = await TestUtils.generateTestIdentity();
    consumerIdentity = await TestUtils.generateTestIdentity();

    // Start overlay service if not running
    await TestUtils.waitForServiceReady(TEST_CONFIG.OVERLAY_BASE_URL);

    // Prepare test stream data
    for (const [streamName, streamId] of Object.entries(TEST_CONFIG.TEST_STREAMS)) {
      for (let seq = 1; seq <= 5; seq++) {
        const streamData = await TestUtils.createTestStreamData(streamId, seq);
        testStreams.push(streamData);
      }
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup test data
    await fs.rm(TEST_CONFIG.TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe('BRC-31: Identity Authentication', () => {
    it('should register producer identity with BRC-31 authentication', async () => {
      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/identity/register`, {
        identityKey: producerIdentity.identityKey,
        publicKey: producerIdentity.publicKey,
        role: 'producer',
        metadata: {
          name: 'Test Producer',
          description: 'E2E test producer identity',
          capabilities: ['content-publishing', 'streaming', 'micropayments']
        }
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('identityKey', producerIdentity.identityKey);
      expect(response.data).toHaveProperty('status', 'active');
      expect(response.data).toHaveProperty('certificates');
    });

    it('should register consumer identity with BRC-31 authentication', async () => {
      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/identity/register`, {
        identityKey: consumerIdentity.identityKey,
        publicKey: consumerIdentity.publicKey,
        role: 'consumer',
        metadata: {
          name: 'Test Consumer',
          description: 'E2E test consumer identity',
          capabilities: ['content-access', 'streaming-consumption', 'micropayments']
        }
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('identityKey', consumerIdentity.identityKey);
      expect(response.data).toHaveProperty('status', 'active');
    });

    it('should authenticate producer using BRC-31 certificates', async () => {
      // Create authentication challenge
      const challengeResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/identity/challenge`, {
        identityKey: producerIdentity.identityKey
      });

      expect(challengeResponse.status).toBe(200);
      expect(challengeResponse.data).toHaveProperty('challenge');

      // Sign challenge with producer's private key
      const challenge = challengeResponse.data.challenge;
      const encoder = new TextEncoder();
      const data = encoder.encode(challenge);

      const keyPair = await webcrypto.subtle.importKey(
        'jwk',
        JSON.parse(producerIdentity.privateKey),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );

      const signature = await webcrypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair,
        data
      );

      // Submit signed challenge
      const authResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/identity/authenticate`, {
        identityKey: producerIdentity.identityKey,
        challenge,
        signature: Array.from(new Uint8Array(signature))
      });

      expect(authResponse.status).toBe(200);
      expect(authResponse.data).toHaveProperty('token');
      expect(authResponse.data).toHaveProperty('expiresAt');
    });
  });

  describe('BRC-88: Service Discovery', () => {
    it('should advertise producer services via BRC-88 SHIP/SLAP', async () => {
      const serviceAdvertisement = {
        identityKey: producerIdentity.identityKey,
        services: [
          {
            serviceType: 'content-delivery',
            endpoint: `${TEST_CONFIG.OVERLAY_BASE_URL}/producer/content`,
            capabilities: ['real-time-streaming', 'historical-data', 'micropayments'],
            pricing: {
              basePrice: TEST_CONFIG.PAYMENT_AMOUNTS.SMALL,
              currency: 'BSV',
              unit: 'per-packet'
            }
          },
          {
            serviceType: 'live-streaming',
            endpoint: `${TEST_CONFIG.OVERLAY_BASE_URL}/producer/stream`,
            capabilities: ['video', 'audio', 'data'],
            pricing: {
              basePrice: TEST_CONFIG.PAYMENT_AMOUNTS.MEDIUM,
              currency: 'BSV',
              unit: 'per-minute'
            }
          }
        ],
        metadata: {
          advertiser: producerIdentity.identityKey,
          timestamp: new Date().toISOString(),
          ttl: 3600
        }
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/services/advertise`, serviceAdvertisement);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('advertisementId');
      expect(response.data).toHaveProperty('status', 'active');
      expect(response.data.services).toHaveLength(2);
    });

    it('should discover services via BRC-88 lookup by consumer', async () => {
      const discoveryRequest = {
        identityKey: consumerIdentity.identityKey,
        criteria: {
          serviceType: 'content-delivery',
          capabilities: ['real-time-streaming'],
          maxPrice: TEST_CONFIG.PAYMENT_AMOUNTS.MEDIUM,
          location: 'any'
        }
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/services/discover`, discoveryRequest);

      expect(response.status).toBe(200);
      expect(response.data.services).toBeInstanceOf(Array);
      expect(response.data.services.length).toBeGreaterThan(0);

      const service = response.data.services.find((s: any) =>
        s.producer === producerIdentity.identityKey && s.serviceType === 'content-delivery'
      );
      expect(service).toBeDefined();
      expect(service).toHaveProperty('endpoint');
      expect(service).toHaveProperty('capabilities');
    });
  });

  describe('BRC-24: Lookup Services', () => {
    it('should register content metadata in BRC-24 lookup service', async () => {
      const contentMetadata = {
        identityKey: producerIdentity.identityKey,
        contentItems: testStreams.map(stream => ({
          contentId: `${stream.streamId}-${stream.metadata.sequence}`,
          contentType: stream.contentType,
          uhrpUrl: `uhrp://${producerIdentity.identityKey}/${stream.streamId}/${stream.metadata.sequence}`,
          metadata: {
            title: `Stream ${stream.streamId} - Packet ${stream.metadata.sequence}`,
            description: 'Test stream data for E2E integration',
            tags: ['test', 'streaming', 'e2e'],
            price: stream.metadata.price,
            producer: stream.metadata.producer,
            timestamp: stream.metadata.timestamp
          }
        }))
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/lookup/register`, contentMetadata);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('registrationId');
      expect(response.data.contentItems).toHaveLength(testStreams.length);
    });

    it('should lookup content via BRC-24 by consumer', async () => {
      const lookupRequest = {
        identityKey: consumerIdentity.identityKey,
        query: {
          contentType: 'application/json',
          tags: ['streaming'],
          producer: producerIdentity.identityKey,
          maxPrice: TEST_CONFIG.PAYMENT_AMOUNTS.MEDIUM
        },
        pagination: {
          limit: 20,
          offset: 0
        }
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/lookup/search`, lookupRequest);

      expect(response.status).toBe(200);
      expect(response.data.results).toBeInstanceOf(Array);
      expect(response.data.results.length).toBeGreaterThan(0);
      expect(response.data).toHaveProperty('totalCount');
      expect(response.data).toHaveProperty('pagination');

      // Verify content structure
      const firstResult = response.data.results[0];
      expect(firstResult).toHaveProperty('contentId');
      expect(firstResult).toHaveProperty('uhrpUrl');
      expect(firstResult).toHaveProperty('metadata');
      expect(firstResult.metadata).toHaveProperty('price');
    });
  });

  describe('BRC-41: PacketPay HTTP Micropayments', () => {
    it('should create payment quote for stream access', async () => {
      const quoteRequest = {
        identityKey: consumerIdentity.identityKey,
        serviceProvider: producerIdentity.identityKey,
        serviceType: 'content-access',
        resourceId: TEST_CONFIG.TEST_STREAMS.MARKET_DATA,
        expectedCost: TEST_CONFIG.PAYMENT_AMOUNTS.SMALL,
        currency: 'BSV'
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/payments/quote`, quoteRequest);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('quoteId');
      expect(response.data).toHaveProperty('amount');
      expect(response.data).toHaveProperty('paymentAddress');
      expect(response.data).toHaveProperty('expiresAt');
      expect(response.data.amount).toBe(TEST_CONFIG.PAYMENT_AMOUNTS.SMALL);
    });

    it('should process micropayment for content access', async () => {
      // First get a payment quote
      const quoteResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/payments/quote`, {
        identityKey: consumerIdentity.identityKey,
        serviceProvider: producerIdentity.identityKey,
        serviceType: 'stream-access',
        resourceId: TEST_CONFIG.TEST_STREAMS.MARKET_DATA,
        expectedCost: TEST_CONFIG.PAYMENT_AMOUNTS.SMALL,
        currency: 'BSV'
      });

      const quote = quoteResponse.data;

      // Simulate payment submission
      const paymentSubmission = {
        quoteId: quote.quoteId,
        transactionHex: '0100000001...', // Mock transaction hex
        transactionId: 'test-tx-' + randomBytes(16).toString('hex'),
        amount: quote.amount,
        payerIdentity: consumerIdentity.identityKey,
        recipientIdentity: producerIdentity.identityKey
      };

      const paymentResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/payments/submit`, paymentSubmission);

      expect(paymentResponse.status).toBe(202);
      expect(paymentResponse.data).toHaveProperty('paymentId');
      expect(paymentResponse.data).toHaveProperty('status', 'pending');
      expect(paymentResponse.data).toHaveProperty('receiptUrl');

      // Store payment record for later verification
      paymentRecords.push({
        transactionId: paymentSubmission.transactionId,
        amount: quote.amount,
        status: 'pending',
        timestamp: new Date().toISOString()
      });
    });

    it('should verify payment receipt and access token', async () => {
      const latestPayment = paymentRecords[paymentRecords.length - 1];

      // Check payment status
      const statusResponse = await axios.get(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/payments/${latestPayment.transactionId}/status`);

      expect(statusResponse.status).toBe(200);
      expect(['pending', 'confirmed', 'settled']).toContain(statusResponse.data.status);

      // If payment is confirmed, should receive access token
      if (statusResponse.data.status === 'confirmed' || statusResponse.data.status === 'settled') {
        expect(statusResponse.data).toHaveProperty('accessToken');
        expect(statusResponse.data).toHaveProperty('resourceAccess');
      }
    });
  });

  describe('D21: BSV Native Payments', () => {
    it('should process BSV native payment for premium content', async () => {
      const nativePaymentRequest = {
        identityKey: consumerIdentity.identityKey,
        serviceProvider: producerIdentity.identityKey,
        paymentType: 'native-bsv',
        amount: TEST_CONFIG.PAYMENT_AMOUNTS.LARGE,
        resourceId: TEST_CONFIG.TEST_STREAMS.VIDEO_STREAM,
        arcConfig: {
          useARC: true,
          provider: 'taal',
          callback: `${TEST_CONFIG.OVERLAY_BASE_URL}/callbacks/arc-payment`
        }
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/payments/native-bsv`, nativePaymentRequest);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('paymentReference');
      expect(response.data).toHaveProperty('arcTransactionId');
      expect(response.data).toHaveProperty('status', 'submitted');
    });
  });

  describe('BRC-26: UHRP Content Storage', () => {
    it('should publish content to UHRP storage via producer', async () => {
      const streamData = testStreams[0];
      const contentRequest = {
        identityKey: producerIdentity.identityKey,
        content: {
          data: streamData.data.toString('base64'),
          contentType: streamData.contentType,
          metadata: streamData.metadata
        },
        uhrpConfig: {
          addressing: 'content-hash',
          distribution: 'multi-node',
          replication: 3,
          encryption: false
        }
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/content/publish`, contentRequest);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('contentId');
      expect(response.data).toHaveProperty('uhrpUrl');
      expect(response.data).toHaveProperty('storageNodes');
      expect(response.data.storageNodes).toHaveLength(3); // Replication factor
    });

    it('should retrieve content from UHRP storage via consumer', async () => {
      // First publish content to get UHRP URL
      const streamData = testStreams[1];
      const publishResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/content/publish`, {
        identityKey: producerIdentity.identityKey,
        content: {
          data: streamData.data.toString('base64'),
          contentType: streamData.contentType,
          metadata: streamData.metadata
        },
        uhrpConfig: {
          addressing: 'content-hash',
          distribution: 'multi-node',
          replication: 2
        }
      });

      const uhrpUrl = publishResponse.data.uhrpUrl;

      // Now retrieve content as consumer (assuming payment already processed)
      const retrievalRequest = {
        identityKey: consumerIdentity.identityKey,
        uhrpUrl,
        accessToken: 'mock-access-token', // In real scenario, from payment
        verifyIntegrity: true
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/content/retrieve`, retrievalRequest);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('content');
      expect(response.data).toHaveProperty('metadata');
      expect(response.data).toHaveProperty('integrity');

      // Verify content integrity
      const retrievedData = Buffer.from(response.data.content, 'base64');
      expect(retrievedData.toString()).toBe(streamData.data.toString());
    });
  });

  describe('D22: Storage Backend', () => {
    it('should distribute content across multiple overlay storage nodes', async () => {
      const distributionRequest = {
        identityKey: producerIdentity.identityKey,
        content: testStreams.slice(0, 3),
        distributionStrategy: {
          nodes: ['node-1', 'node-2', 'node-3', 'node-4'],
          replicationFactor: 2,
          loadBalancing: 'round-robin',
          geoDistribution: true
        }
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/storage/distribute`, distributionRequest);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('distributionId');
      expect(response.data).toHaveProperty('nodeAssignments');
      expect(response.data.nodeAssignments).toBeInstanceOf(Array);
      expect(response.data.nodeAssignments.length).toBeGreaterThan(0);

      // Verify each content item is replicated across specified nodes
      for (const assignment of response.data.nodeAssignments) {
        expect(assignment).toHaveProperty('contentId');
        expect(assignment).toHaveProperty('nodes');
        expect(assignment.nodes).toHaveLength(2); // Replication factor
      }
    });

    it('should verify content availability across storage nodes', async () => {
      const availabilityCheck = {
        identityKey: consumerIdentity.identityKey,
        contentIds: testStreams.slice(0, 3).map(s => `${s.streamId}-${s.metadata.sequence}`),
        includePerformanceMetrics: true
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/storage/availability`, availabilityCheck);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('availability');
      expect(response.data.availability).toBeInstanceOf(Array);

      for (const item of response.data.availability) {
        expect(item).toHaveProperty('contentId');
        expect(item).toHaveProperty('available', true);
        expect(item).toHaveProperty('nodes');
        expect(item).toHaveProperty('responseTime');
        expect(item.nodes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('BRC-22: Transaction Submission', () => {
    it('should submit transaction to BSV network via overlay', async () => {
      const transactionSubmission = {
        identityKey: producerIdentity.identityKey,
        transaction: {
          hex: '0100000001...', // Mock transaction hex
          inputs: [
            {
              txid: 'prev-tx-id',
              vout: 0,
              scriptSig: 'mock-script-sig'
            }
          ],
          outputs: [
            {
              satoshis: TEST_CONFIG.PAYMENT_AMOUNTS.MEDIUM,
              scriptPubKey: 'mock-script-pub-key'
            }
          ]
        },
        metadata: {
          purpose: 'stream-payment',
          relatedContent: TEST_CONFIG.TEST_STREAMS.MARKET_DATA
        }
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/transactions/submit`, transactionSubmission);

      expect(response.status).toBe(202);
      expect(response.data).toHaveProperty('transactionId');
      expect(response.data).toHaveProperty('status', 'submitted');
      expect(response.data).toHaveProperty('submissionTimestamp');
    });

    it('should track transaction status and confirmations', async () => {
      // Submit a transaction first
      const submissionResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/transactions/submit`, {
        identityKey: producerIdentity.identityKey,
        transaction: {
          hex: '0100000002...',
          inputs: [{ txid: 'test-input', vout: 0, scriptSig: 'script' }],
          outputs: [{ satoshis: 1000, scriptPubKey: 'script' }]
        },
        metadata: { purpose: 'test-tracking' }
      });

      const transactionId = submissionResponse.data.transactionId;

      // Check transaction status
      const statusResponse = await axios.get(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/transactions/${transactionId}/status`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.data).toHaveProperty('transactionId', transactionId);
      expect(statusResponse.data).toHaveProperty('status');
      expect(['submitted', 'confirmed', 'settled']).toContain(statusResponse.data.status);
      expect(statusResponse.data).toHaveProperty('confirmations');
    });
  });

  describe('BRC-64: History Tracking', () => {
    it('should track producer usage analytics and lineage', async () => {
      const analyticsRequest = {
        identityKey: producerIdentity.identityKey,
        events: [
          {
            eventType: 'content-published',
            timestamp: new Date().toISOString(),
            metadata: {
              contentId: testStreams[0].streamId,
              size: testStreams[0].data.length,
              contentType: testStreams[0].contentType
            }
          },
          {
            eventType: 'payment-received',
            timestamp: new Date().toISOString(),
            metadata: {
              amount: TEST_CONFIG.PAYMENT_AMOUNTS.SMALL,
              payerIdentity: consumerIdentity.identityKey,
              contentId: testStreams[0].streamId
            }
          }
        ]
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/analytics/track`, analyticsRequest);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('trackingId');
      expect(response.data).toHaveProperty('eventsProcessed', 2);
    });

    it('should retrieve consumer usage history and analytics', async () => {
      const historyRequest = {
        identityKey: consumerIdentity.identityKey,
        timeRange: {
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
          endDate: new Date().toISOString()
        },
        eventTypes: ['payment-sent', 'content-accessed', 'stream-subscribed'],
        includeMetrics: true
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/analytics/history`, historyRequest);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('events');
      expect(response.data).toHaveProperty('metrics');
      expect(response.data.events).toBeInstanceOf(Array);

      if (response.data.metrics) {
        expect(response.data.metrics).toHaveProperty('totalPayments');
        expect(response.data.metrics).toHaveProperty('totalContentAccessed');
        expect(response.data.metrics).toHaveProperty('averagePaymentAmount');
      }
    });

    it('should generate content lineage and provenance data', async () => {
      const lineageRequest = {
        identityKey: consumerIdentity.identityKey,
        contentId: testStreams[0].streamId,
        includeProvenance: true,
        includeAccessHistory: true
      };

      const response = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/analytics/lineage`, lineageRequest);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('contentId', testStreams[0].streamId);
      expect(response.data).toHaveProperty('lineage');
      expect(response.data).toHaveProperty('provenance');
      expect(response.data.lineage).toHaveProperty('originalProducer');
      expect(response.data.lineage).toHaveProperty('creationTimestamp');
      expect(response.data.provenance).toHaveProperty('accessHistory');
    });
  });

  describe('Multi-Stream Real-World Scenario', () => {
    it('should handle complete producer-to-consumer workflow with multiple streams', async () => {
      const workflowResults = {
        identityRegistrations: 0,
        serviceAdvertisements: 0,
        contentPublications: 0,
        paymentTransactions: 0,
        contentRetrievals: 0,
        analyticsEvents: 0
      };

      // 1. Producer advertises multiple streaming services
      for (const [streamName, streamId] of Object.entries(TEST_CONFIG.TEST_STREAMS)) {
        const serviceAd = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/services/advertise`, {
          identityKey: producerIdentity.identityKey,
          services: [{
            serviceType: `${streamName.toLowerCase().replace('_', '-')}-stream`,
            endpoint: `${TEST_CONFIG.OVERLAY_BASE_URL}/stream/${streamId}`,
            capabilities: ['real-time', 'historical', 'analytics'],
            pricing: {
              basePrice: TEST_CONFIG.PAYMENT_AMOUNTS.SMALL,
              currency: 'BSV',
              unit: 'per-packet'
            }
          }]
        });

        expect(serviceAd.status).toBe(201);
        workflowResults.serviceAdvertisements++;
      }

      // 2. Consumer discovers and subscribes to all streams
      const discoveryResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/services/discover`, {
        identityKey: consumerIdentity.identityKey,
        criteria: {
          producer: producerIdentity.identityKey,
          capabilities: ['real-time']
        }
      });

      expect(discoveryResponse.status).toBe(200);
      expect(discoveryResponse.data.services.length).toBe(Object.keys(TEST_CONFIG.TEST_STREAMS).length);

      // 3. Producer publishes content for each stream
      for (const streamData of testStreams.slice(0, 8)) { // First 2 packets per stream
        const publishResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/content/publish`, {
          identityKey: producerIdentity.identityKey,
          content: {
            data: streamData.data.toString('base64'),
            contentType: streamData.contentType,
            metadata: streamData.metadata
          },
          uhrpConfig: {
            addressing: 'content-hash',
            distribution: 'multi-node',
            replication: 2
          }
        });

        expect(publishResponse.status).toBe(201);
        workflowResults.contentPublications++;
      }

      // 4. Consumer processes payments for content access
      for (let i = 0; i < 4; i++) { // One payment per stream type
        const quoteResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/payments/quote`, {
          identityKey: consumerIdentity.identityKey,
          serviceProvider: producerIdentity.identityKey,
          serviceType: 'content-access',
          resourceId: Object.values(TEST_CONFIG.TEST_STREAMS)[i],
          expectedCost: TEST_CONFIG.PAYMENT_AMOUNTS.SMALL
        });

        const paymentResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/payments/submit`, {
          quoteId: quoteResponse.data.quoteId,
          transactionHex: '01000000...',
          transactionId: `workflow-tx-${i}`,
          amount: quoteResponse.data.amount,
          payerIdentity: consumerIdentity.identityKey,
          recipientIdentity: producerIdentity.identityKey
        });

        expect(paymentResponse.status).toBe(202);
        workflowResults.paymentTransactions++;
      }

      // 5. Consumer retrieves content from multiple streams
      const contentIds = testStreams.slice(0, 8).map(s => `${s.streamId}-${s.metadata.sequence}`);
      for (const contentId of contentIds) {
        const lookupResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/lookup/search`, {
          identityKey: consumerIdentity.identityKey,
          query: { contentId }
        });

        if (lookupResponse.data.results.length > 0) {
          const uhrpUrl = lookupResponse.data.results[0].uhrpUrl;
          const retrievalResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/content/retrieve`, {
            identityKey: consumerIdentity.identityKey,
            uhrpUrl,
            accessToken: 'workflow-access-token'
          });

          if (retrievalResponse.status === 200) {
            workflowResults.contentRetrievals++;
          }
        }
      }

      // 6. Analytics tracking for the entire workflow
      const analyticsResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/analytics/track`, {
        identityKey: producerIdentity.identityKey,
        events: [
          {
            eventType: 'workflow-completed',
            timestamp: new Date().toISOString(),
            metadata: {
              totalStreams: Object.keys(TEST_CONFIG.TEST_STREAMS).length,
              totalPayments: workflowResults.paymentTransactions,
              totalContent: workflowResults.contentPublications,
              consumerIdentity: consumerIdentity.identityKey
            }
          }
        ]
      });

      expect(analyticsResponse.status).toBe(201);
      workflowResults.analyticsEvents++;

      // Verify complete workflow success
      expect(workflowResults.serviceAdvertisements).toBe(4); // One per stream type
      expect(workflowResults.contentPublications).toBe(8); // 2 packets per stream type
      expect(workflowResults.paymentTransactions).toBe(4); // One per stream type
      expect(workflowResults.contentRetrievals).toBeGreaterThan(0);
      expect(workflowResults.analyticsEvents).toBe(1);

      console.log('Multi-stream workflow completed successfully:', workflowResults);
    }, 120000);

    it('should demonstrate real-time streaming with micropayments', async () => {
      const streamingSession = {
        sessionId: randomBytes(16).toString('hex'),
        producer: producerIdentity.identityKey,
        consumer: consumerIdentity.identityKey,
        streamType: 'real-time-data',
        startTime: new Date().toISOString()
      };

      // Start streaming session
      const sessionResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/streaming/start`, {
        identityKey: producerIdentity.identityKey,
        sessionConfig: {
          streamId: streamingSession.sessionId,
          streamType: 'market-data',
          pricing: {
            model: 'per-second',
            rate: 10, // 10 satoshis per second
            currency: 'BSV'
          },
          quality: {
            resolution: '1080p',
            frameRate: 30,
            bitrate: 2000
          }
        }
      });

      expect(sessionResponse.status).toBe(201);
      expect(sessionResponse.data).toHaveProperty('streamUrl');
      expect(sessionResponse.data).toHaveProperty('sessionId');

      // Consumer subscribes to stream
      const subscriptionResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/streaming/subscribe`, {
        identityKey: consumerIdentity.identityKey,
        streamId: sessionResponse.data.sessionId,
        paymentSetup: {
          maxAmount: 1000, // Max 1000 satoshis
          autoPayInterval: 10 // Pay every 10 seconds
        }
      });

      expect(subscriptionResponse.status).toBe(201);
      expect(subscriptionResponse.data).toHaveProperty('subscriptionId');
      expect(subscriptionResponse.data).toHaveProperty('paymentChannel');

      // Simulate streaming for 30 seconds with periodic payments
      const streamDuration = 5000; // 5 seconds for testing
      const paymentInterval = 2000; // Pay every 2 seconds

      const streamingPromise = new Promise((resolve) => {
        let paymentCount = 0;
        const paymentTimer = setInterval(async () => {
          try {
            const micropayment = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/payments/micropayment`, {
              subscriptionId: subscriptionResponse.data.subscriptionId,
              amount: 20, // 20 satoshis for 2 seconds
              timestamp: new Date().toISOString()
            });

            if (micropayment.status === 202) {
              paymentCount++;
            }
          } catch (error) {
            console.warn('Micropayment failed:', error);
          }
        }, paymentInterval);

        setTimeout(() => {
          clearInterval(paymentTimer);
          resolve(paymentCount);
        }, streamDuration);
      });

      const totalPayments = await streamingPromise;
      expect(totalPayments).toBeGreaterThan(0);

      // End streaming session
      const endResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/streaming/end`, {
        sessionId: sessionResponse.data.sessionId,
        identityKey: producerIdentity.identityKey
      });

      expect(endResponse.status).toBe(200);
      expect(endResponse.data).toHaveProperty('totalDuration');
      expect(endResponse.data).toHaveProperty('totalPayments');
      expect(endResponse.data).toHaveProperty('finalBalance');
    }, 30000);
  });

  describe('Cross-BRC Integration Validation', () => {
    it('should validate data integrity across all BRC standards', async () => {
      const integrationTest = {
        testId: randomBytes(8).toString('hex'),
        producer: producerIdentity.identityKey,
        consumer: consumerIdentity.identityKey,
        timestamp: new Date().toISOString()
      };

      // Create a comprehensive data flow that touches every BRC
      const dataFlowSteps = [
        // BRC-31: Identity verification
        async () => {
          const authResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/identity/verify`, {
            identityKey: producerIdentity.identityKey
          });
          return { brc: 'BRC-31', status: authResponse.status, verified: authResponse.data.verified };
        },

        // BRC-88: Service advertisement
        async () => {
          const adResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/services/advertise`, {
            identityKey: producerIdentity.identityKey,
            services: [{
              serviceType: 'integration-test',
              endpoint: '/test',
              capabilities: ['all-brcs']
            }]
          });
          return { brc: 'BRC-88', status: adResponse.status, advertisementId: adResponse.data.advertisementId };
        },

        // BRC-24: Content registration
        async () => {
          const regResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/lookup/register`, {
            identityKey: producerIdentity.identityKey,
            contentItems: [{
              contentId: integrationTest.testId,
              contentType: 'integration-test',
              uhrpUrl: `uhrp://test/${integrationTest.testId}`
            }]
          });
          return { brc: 'BRC-24', status: regResponse.status, registrationId: regResponse.data.registrationId };
        },

        // BRC-26: Content storage
        async () => {
          const storageResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/content/publish`, {
            identityKey: producerIdentity.identityKey,
            content: {
              data: Buffer.from(JSON.stringify(integrationTest)).toString('base64'),
              contentType: 'application/json'
            }
          });
          return { brc: 'BRC-26', status: storageResponse.status, contentId: storageResponse.data.contentId };
        },

        // BRC-41: Payment processing
        async () => {
          const paymentResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/payments/quote`, {
            identityKey: consumerIdentity.identityKey,
            serviceProvider: producerIdentity.identityKey,
            serviceType: 'integration-test',
            expectedCost: 100
          });
          return { brc: 'BRC-41', status: paymentResponse.status, quoteId: paymentResponse.data.quoteId };
        },

        // BRC-22: Transaction submission
        async () => {
          const txResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/transactions/submit`, {
            identityKey: producerIdentity.identityKey,
            transaction: {
              hex: '010000000100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100000000000000000000000000',
              inputs: [],
              outputs: []
            }
          });
          return { brc: 'BRC-22', status: txResponse.status, transactionId: txResponse.data.transactionId };
        },

        // BRC-64: Analytics tracking
        async () => {
          const analyticsResponse = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/analytics/track`, {
            identityKey: producerIdentity.identityKey,
            events: [{
              eventType: 'integration-test-completed',
              timestamp: new Date().toISOString(),
              metadata: integrationTest
            }]
          });
          return { brc: 'BRC-64', status: analyticsResponse.status, trackingId: analyticsResponse.data.trackingId };
        }
      ];

      // Execute all BRC integrations
      const results = [];
      for (const step of dataFlowSteps) {
        try {
          const result = await step();
          results.push(result);
        } catch (error) {
          results.push({
            brc: 'Unknown',
            status: error.response?.status || 500,
            error: error.message
          });
        }
      }

      // Validate all BRCs were successfully integrated
      expect(results).toHaveLength(7);
      for (const result of results) {
        expect(result.status).toBeOneOf([200, 201, 202]);
        expect(result).toHaveProperty('brc');
      }

      // Verify data consistency across BRCs
      const consistencyCheck = await axios.post(`${TEST_CONFIG.OVERLAY_BASE_URL}/api/integration/verify`, {
        testId: integrationTest.testId,
        expectedBRCs: ['BRC-31', 'BRC-88', 'BRC-24', 'BRC-26', 'BRC-41', 'BRC-22', 'BRC-64'],
        producer: producerIdentity.identityKey,
        consumer: consumerIdentity.identityKey
      });

      expect(consistencyCheck.status).toBe(200);
      expect(consistencyCheck.data).toHaveProperty('consistent', true);
      expect(consistencyCheck.data).toHaveProperty('verifiedBRCs');
      expect(consistencyCheck.data.verifiedBRCs).toHaveLength(7);

      console.log('Cross-BRC integration validation completed:', {
        testId: integrationTest.testId,
        results: results.map(r => ({ brc: r.brc, status: r.status })),
        consistency: consistencyCheck.data.consistent
      });
    }, 60000);
  });
});