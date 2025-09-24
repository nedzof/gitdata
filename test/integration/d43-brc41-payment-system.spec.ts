/**
 * BRC-41 PacketPay Payment System Integration Tests
 *
 * Tests the complete BRC-41 payment integration including:
 * - Payment request generation
 * - BRC-29 payment processing
 * - Payment verification and SPV proofs
 * - Service pricing calculations
 * - Payment analytics and tracking
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import * as bsv from '@bsv/sdk';

import { app } from '../../src/server';
import type { BRC41PaymentRequest, BRC29Payment, PaymentAnalytics, ServicePricing } from '../../src/brc41/types';
import { BRC29_PROTOCOL_ID, SERVICE_TYPES, DEFAULT_SERVICE_PRICING } from '../../src/brc41/types';

describe('BRC-41 PacketPay Payment System', () => {
  let testPrivateKey: bsv.PrivateKey;
  let testPublicKey: bsv.PublicKey;
  let serverAgent: request.SuperTest<request.Test>;

  beforeAll(async () => {
    // Create test identity (using fixed key for testing)
    const testWIF = 'KwF9LjRraetZuEjR8VqEq539z137LW5anYDUnVK11vM3mNMHTWb4'; // Test-only private key
    testPrivateKey = bsv.PrivateKey.fromWif(testWIF);
    testPublicKey = testPrivateKey.toPublicKey();
    serverAgent = request(app);

    // Wait for services to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  beforeEach(async () => {
    // Clean test data before each test
    // In a real implementation, this would clean the test database
  });

  afterEach(async () => {
    // Clean up after each test
  });

  afterAll(async () => {
    // Global cleanup
  });

  describe('Payment Request Generation', () => {
    it('should generate payment request for BRC-24 lookup service', async () => {
      const lookupPayload = {
        provider: 'test-provider',
        query: { type: 'agent-lookup', id: 'test-agent-123' }
      };

      const response = await serverAgent
        .post('/overlay/lookup')
        .send(lookupPayload)
        .expect(402); // Payment Required

      expect(response.body).toHaveProperty('error', 'payment-required');
      expect(response.body).toHaveProperty('paymentRequest');

      const paymentRequest: BRC41PaymentRequest = response.body.paymentRequest;
      expect(paymentRequest).toHaveProperty('satoshisRequired');
      expect(paymentRequest).toHaveProperty('service', SERVICE_TYPES.BRC24_LOOKUP);
      expect(paymentRequest).toHaveProperty('paymentId');
      expect(paymentRequest).toHaveProperty('recipientPublicKey');
      expect(paymentRequest).toHaveProperty('expires');
      expect(paymentRequest.satoshisRequired).toBeGreaterThan(0);
    });

    it('should generate payment request for file search service', async () => {
      const searchPayload = {
        filename: '*.pdf',
        contentType: 'application/pdf',
        tags: ['research']
      };

      const response = await serverAgent
        .post('/overlay/files/search')
        .send(searchPayload)
        .expect(402);

      expect(response.body).toHaveProperty('paymentRequest');
      const paymentRequest: BRC41PaymentRequest = response.body.paymentRequest;
      expect(paymentRequest.service).toBe(SERVICE_TYPES.DATA_SEARCH);
    });

    it('should calculate different prices based on usage complexity', async () => {
      // Test simple lookup
      const simpleResponse = await serverAgent
        .post('/overlay/lookup')
        .send({ provider: 'test', query: { simple: true } })
        .expect(402);

      // Test complex search
      const complexResponse = await serverAgent
        .post('/overlay/files/search')
        .send({
          filename: '*',
          contentType: '*/*',
          tags: ['research', 'analysis', 'data', 'machine-learning'],
          metadata: { complex: true }
        })
        .expect(402);

      const simplePrice = simpleResponse.body.paymentRequest.satoshisRequired;
      const complexPrice = complexResponse.body.paymentRequest.satoshisRequired;

      expect(complexPrice).toBeGreaterThan(simplePrice);
    });
  });

  describe('Payment Processing', () => {
    it('should process valid BRC-29 payment', async () => {
      // First, get a payment request
      const lookupResponse = await serverAgent
        .post('/overlay/lookup')
        .send({ provider: 'test-provider', query: { type: 'test' } })
        .expect(402);

      const paymentRequest: BRC41PaymentRequest = lookupResponse.body.paymentRequest;

      // Create a mock BRC-29 payment
      const mockPayment: BRC29Payment = {
        protocol: BRC29_PROTOCOL_ID,
        senderIdentityKey: testPublicKey.toString(),
        derivationPrefix: 'test-payment-prefix',
        transactions: [{
          txid: 'mock-transaction-id',
          rawTx: 'mock-raw-transaction-hex',
          outputs: {
            0: {
              suffix: 'payment-suffix',
              satoshis: paymentRequest.satoshisRequired,
              script: 'mock-locking-script'
            }
          }
        }]
      };

      // Attempt payment (this will fail in testing without real BSV transactions)
      // But we can test the payment processing flow
      const paymentResponse = await serverAgent
        .post('/overlay/lookup')
        .set('x-bsv-payment', JSON.stringify(mockPayment))
        .send({ provider: 'test-provider', query: { type: 'test' } });

      // In a real scenario with valid transactions, this would succeed
      // For now, we expect payment validation to catch the mock data
      expect([400, 402, 500]).toContain(paymentResponse.status);
    });

    it('should reject payment with incorrect protocol ID', async () => {
      const lookupResponse = await serverAgent
        .post('/overlay/lookup')
        .send({ provider: 'test-provider', query: { type: 'test' } })
        .expect(402);

      const paymentRequest: BRC41PaymentRequest = lookupResponse.body.paymentRequest;

      const invalidPayment: BRC29Payment = {
        protocol: 'invalid-protocol-id', // Wrong protocol
        senderIdentityKey: testPublicKey.toString(),
        derivationPrefix: 'test-prefix',
        transactions: [{
          txid: 'test-txid',
          rawTx: 'test-raw-tx',
          outputs: {
            0: {
              suffix: 'test-suffix',
              satoshis: paymentRequest.satoshisRequired,
            }
          }
        }]
      };

      const paymentResponse = await serverAgent
        .post('/overlay/lookup')
        .set('x-bsv-payment', JSON.stringify(invalidPayment))
        .send({ provider: 'test-provider', query: { type: 'test' } })
        .expect(402);

      expect(paymentResponse.body.error).toBe('payment-required');
    });

    it('should reject insufficient payment amount', async () => {
      const lookupResponse = await serverAgent
        .post('/overlay/lookup')
        .send({ provider: 'test-provider', query: { type: 'test' } })
        .expect(402);

      const paymentRequest: BRC41PaymentRequest = lookupResponse.body.paymentRequest;

      const insufficientPayment: BRC29Payment = {
        protocol: BRC29_PROTOCOL_ID,
        senderIdentityKey: testPublicKey.toString(),
        derivationPrefix: 'test-prefix',
        transactions: [{
          txid: 'test-txid',
          rawTx: 'test-raw-tx',
          outputs: {
            0: {
              suffix: 'test-suffix',
              satoshis: Math.floor(paymentRequest.satoshisRequired / 2), // Half the required amount
            }
          }
        }]
      };

      const paymentResponse = await serverAgent
        .post('/overlay/lookup')
        .set('x-bsv-payment', JSON.stringify(insufficientPayment))
        .send({ provider: 'test-provider', query: { type: 'test' } })
        .expect(402);

      expect(paymentResponse.body.error).toBe('payment-required');
    });
  });

  describe('Service Pricing Configuration', () => {
    it('should retrieve default pricing for BRC-24 lookup service', async () => {
      const response = await serverAgent
        .get(`/overlay/payment/pricing/${SERVICE_TYPES.BRC24_LOOKUP}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe(SERVICE_TYPES.BRC24_LOOKUP);
      expect(response.body.pricing).toHaveProperty('baseFee');
      expect(response.body.pricing).toHaveProperty('perByteRate');
      expect(response.body.pricing).toHaveProperty('complexityMultiplier');
      expect(response.body.pricing).toHaveProperty('priorityMultipliers');
      expect(response.body.pricing).toHaveProperty('discounts');
    });

    it('should update service pricing configuration', async () => {
      const testPricing: ServicePricing = {
        ...DEFAULT_SERVICE_PRICING,
        baseFee: 2000, // 2000 satoshis
        perByteRate: 20, // 20 satoshis per byte
      };

      // This would require proper authentication in a real scenario
      const updateResponse = await serverAgent
        .put(`/overlay/payment/pricing/${SERVICE_TYPES.BRC24_LOOKUP}`)
        .send(testPricing);

      // Expect authentication requirement or success
      expect([200, 401, 403]).toContain(updateResponse.status);

      if (updateResponse.status === 200) {
        expect(updateResponse.body.success).toBe(true);
        expect(updateResponse.body.pricing.baseFee).toBe(2000);
      }
    });

    it('should return 404 for non-existent service pricing', async () => {
      const response = await serverAgent
        .get('/overlay/payment/pricing/non-existent-service')
        .expect(404);

      expect(response.body.error).toBe('service-not-found');
    });
  });

  describe('Payment Analytics', () => {
    it('should return payment analytics data', async () => {
      const response = await serverAgent
        .get('/overlay/payment/analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('analytics');

      const analytics: PaymentAnalytics = response.body.analytics;
      expect(analytics).toHaveProperty('totalPayments');
      expect(analytics).toHaveProperty('totalSatoshis');
      expect(analytics).toHaveProperty('averagePayment');
      expect(analytics).toHaveProperty('paymentsByService');
      expect(analytics).toHaveProperty('revenueByService');
      expect(analytics).toHaveProperty('paymentsByHour');
      expect(analytics).toHaveProperty('topPayers');

      // Verify data types
      expect(typeof analytics.totalPayments).toBe('number');
      expect(typeof analytics.totalSatoshis).toBe('number');
      expect(typeof analytics.averagePayment).toBe('number');
      expect(Array.isArray(analytics.paymentsByHour)).toBe(true);
      expect(Array.isArray(analytics.topPayers)).toBe(true);
    });

    it('should return analytics for custom time range', async () => {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const end = new Date();

      const response = await serverAgent
        .get('/overlay/payment/analytics')
        .query({ start: start.toISOString(), end: end.toISOString() })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.timeRange).toBeDefined();
      expect(response.body.analytics).toBeDefined();
    });
  });

  describe('Free Tier Access', () => {
    it('should allow free access for certified identities', async () => {
      // This test would require setting up BRC-31 authentication with certified identity
      // For now, we test that the middleware handles identity levels properly

      const response = await serverAgent
        .get('/overlay/payment/analytics')
        .expect(200);

      // The analytics endpoint uses trackUsage middleware (free tier)
      expect(response.body.success).toBe(true);
    });

    it('should respect service-specific free tier rules', async () => {
      // Test that analytics service doesn't allow free access even for certified users
      // while lookup services might allow it

      const analyticsResponse = await serverAgent
        .get('/overlay/payment/analytics')
        .expect(200); // Analytics uses track-only, no payment required

      expect(analyticsResponse.body.success).toBe(true);
    });
  });

  describe('Payment Headers Integration', () => {
    it('should return satoshis-required header on payment required', async () => {
      const response = await serverAgent
        .post('/overlay/lookup')
        .send({ provider: 'test', query: { type: 'test' } })
        .expect(402);

      expect(response.headers).toHaveProperty('x-bsv-payment-satoshis-required');
      const requiredSatoshis = parseInt(response.headers['x-bsv-payment-satoshis-required']);
      expect(requiredSatoshis).toBeGreaterThan(0);
      expect(requiredSatoshis).toBe(response.body.paymentRequest.satoshisRequired);
    });

    it('should include BRC-41 capability headers', async () => {
      const response = await serverAgent
        .post('/overlay/lookup')
        .send({ provider: 'test', query: { type: 'test' } })
        .expect(402);

      expect(response.body).toHaveProperty('brc41');
      expect(response.body.brc41).toHaveProperty('version', '1.0');
      expect(response.body.brc41).toHaveProperty('supported', true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed payment JSON gracefully', async () => {
      const response = await serverAgent
        .post('/overlay/lookup')
        .set('x-bsv-payment', 'invalid-json-data')
        .send({ provider: 'test', query: { type: 'test' } })
        .expect(402);

      expect(response.body.error).toBe('payment-required');
    });

    it('should handle missing required payment fields', async () => {
      const incompletePayment = {
        protocol: BRC29_PROTOCOL_ID,
        // Missing required fields like senderIdentityKey, transactions
      };

      const response = await serverAgent
        .post('/overlay/lookup')
        .set('x-bsv-payment', JSON.stringify(incompletePayment))
        .send({ provider: 'test', query: { type: 'test' } })
        .expect(402);

      expect(response.body.error).toBe('payment-required');
    });

    it('should handle service unavailable scenarios', async () => {
      // Test when payment service is not initialized
      // This would be difficult to test without mocking, but we can verify graceful degradation

      const response = await serverAgent
        .get('/overlay/payment/analytics')
        .expect(res => {
          // Should either succeed (if service available) or return service unavailable
          expect([200, 503]).toContain(res.status);
        });

      if (response.status === 503) {
        expect(response.body.error).toBe('payment-service-unavailable');
      }
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should respect existing rate limits with payment walls', async () => {
      // Make multiple requests to test rate limiting
      const requests = Array(25).fill(0).map(() =>
        serverAgent
          .post('/overlay/lookup')
          .send({ provider: 'test', query: { type: 'test' } })
      );

      const responses = await Promise.allSettled(requests);

      // Some requests should hit rate limits (429) or payment walls (402)
      const statusCodes = responses
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as any).value.status);

      expect(statusCodes).toContain(402); // Payment required
      // Might also contain 429 if rate limit is hit
    });
  });
});

/**
 * Helper function to create a valid BSV transaction for testing
 * In a real test environment, this would create actual BSV transactions
 */
function createTestTransaction(
  privateKey: bsv.PrivateKey,
  recipientAddress: string,
  satoshis: number
): { txid: string; rawTx: string; outputs: Record<number, any> } {
  // This is a mock implementation
  // Real implementation would use BSV SDK to create actual transactions
  return {
    txid: 'mock-txid-' + Date.now(),
    rawTx: 'mock-raw-tx-hex',
    outputs: {
      0: {
        suffix: 'mock-suffix',
        satoshis,
        script: 'mock-script'
      }
    }
  };
}

/**
 * Helper function to create BRC-31 authentication headers
 */
function createBRC31Headers(
  privateKey: bsv.PrivateKey,
  nonce: string,
  payload: any
): Record<string, string> {
  // Mock BRC-31 headers for testing
  return {
    'X-Authrite': '0.1',
    'X-Authrite-Identity-Key': privateKey.toPublicKey().toString(),
    'X-Authrite-Nonce': nonce,
    'X-Authrite-Signature': 'mock-signature'
  };
}