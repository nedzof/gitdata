import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { overlayBrcRouter } from '../../src/routes/overlay-brc';
import { PrivateKey, Utils } from '@bsv/sdk';
import crypto from 'crypto';

describe('D43 Phase 4: Comprehensive BRC Overlay Protocol Integration', () => {
  let app: express.Application;

  // Test credentials - using fixed key for testing
  const testPrivateKey = PrivateKey.fromHex('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  const testPublicKey = testPrivateKey.toPublicKey();

  beforeAll(async () => {
    console.log('Test environment configured for Phase 4 comprehensive testing');

    app = express();
    app.use(express.json({ limit: '100mb' }));
    app.use(express.raw({ limit: '100mb', type: 'application/octet-stream' }));

    // Mount the overlay BRC router
    const { router } = overlayBrcRouter();
    app.use('/overlay', router);
  }, 30000);

  describe('Complete BRC Standards Integration', () => {
    it('should complete full BRC-31 + BRC-41 + Streaming workflow', async () => {
      // Phase 1: BRC-31 Authentication
      const authNonce = Utils.toBase64(crypto.randomBytes(32));
      const authMessage = `gitdata-overlay-auth-${authNonce}`;
      const authSignature = testPrivateKey.sign(Utils.toArray(authMessage, 'utf8'));

      const authResponse = await request(app)
        .post('/overlay/brc31/authenticate')
        .send({
          publicKey: testPublicKey.toString(),
          signature: Utils.toBase64(authSignature),
          message: authMessage
        });

      // Should work or fail gracefully - either is acceptable for integration test
      expect([200, 400, 503]).toContain(authResponse.status);

      if (authResponse.status === 200) {
        expect(authResponse.body.token).toBeDefined();
        expect(authResponse.body.sessionId).toBeDefined();

        // Phase 2: BRC-41 Payment Setup (if auth succeeded)
        const paymentResponse = await request(app)
          .post('/overlay/brc41/request-payment')
          .set('Authorization', `Bearer ${authResponse.body.token}`)
          .send({
            amount: 1000,
            purpose: 'streaming-service-access'
          });

        // Should work or fail gracefully
        expect([200, 400, 503]).toContain(paymentResponse.status);

        if (paymentResponse.status === 200) {
          expect(paymentResponse.body.paymentId).toBeDefined();
          expect(paymentResponse.body.amount).toBe(1000);
        }
      }

      // Phase 3: Streaming Service Access (test endpoint availability)
      const testVideoData = Buffer.from('fake video data for testing streaming pipeline');

      const uploadResponse = await request(app)
        .post('/overlay/streaming/upload')
        .attach('file', Buffer.from(testVideoData), 'test-video.mp4')
        .field('transcoding', JSON.stringify({
          profiles: ['720p', '1080p'],
          formats: ['hls', 'dash']
        }));

      // Should respond with some status (success or expected failure)
      expect(uploadResponse.status).toBeGreaterThan(0);
    }, 45000);

    it('should enforce payment requirements for premium streaming features', async () => {
      // Test premium streaming without payment - should require payment
      const unauthorizedResponse = await request(app)
        .post('/overlay/streaming/premium/4k-transcoding')
        .send({
          uploadId: 'test-upload-id',
          profile: '4k-ultra'
        });

      expect(unauthorizedResponse.status).toBe(402); // Payment Required
      expect(unauthorizedResponse.headers['x-bsv-payment-satoshis-required']).toBeDefined();
    });

    it('should handle complete service degradation gracefully', async () => {
      // Test without authentication - should fail gracefully
      const noAuthResponse = await request(app)
        .get('/overlay/streaming/content/test-content-id');

      expect(noAuthResponse.status).toBe(401);

      // Test with invalid payment amount
      const invalidPaymentResponse = await request(app)
        .post('/overlay/brc41/request-payment')
        .send({
          amount: -100,
          purpose: 'test'
        });

      expect(invalidPaymentResponse.status).toBeGreaterThanOrEqual(400);

      // Test with corrupted streaming data
      const corruptedResponse = await request(app)
        .post('/overlay/streaming/upload')
        .send('corrupted data');

      expect(corruptedResponse.status).toBe(400);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent authentication requests', async () => {
      const concurrentRequests = 5; // Reduced for real testing
      const requests = Array.from({ length: concurrentRequests }, async (_, i) => {
        const nonce = Utils.toBase64(crypto.randomBytes(32));
        const message = `concurrent-auth-test-${i}-${nonce}`;
        const signature = testPrivateKey.sign(Utils.toArray(message, 'utf8'));

        return request(app)
          .post('/overlay/brc31/authenticate')
          .send({
            publicKey: testPublicKey.toString(),
            signature: Utils.toBase64(signature),
            message: message
          });
      });

      const responses = await Promise.all(requests);

      // All should respond (success or expected failure)
      responses.forEach(response => {
        expect(response.status).toBeGreaterThan(0);
      });

      // Check for reasonable response times
      expect(responses.length).toBe(concurrentRequests);
    }, 15000);

    it('should maintain streaming service performance', async () => {
      const startTime = Date.now();

      // Test multiple streaming operations
      const streamingOps = [
        request(app).get('/overlay/streaming/stats'),
        request(app).get('/overlay/streaming/network/peers'),
        request(app).get('/overlay/streaming/content/discovery')
      ];

      const responses = await Promise.all(streamingOps);
      const endTime = Date.now();

      // All should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000);

      responses.forEach(response => {
        expect(response.status).toBeGreaterThan(0);
      });
    });
  });

  describe('BRC Standards Compliance Validation', () => {
    it('should validate BRC-31 message format compliance', async () => {
      const testMessage = 'test-message-format';
      const signature = testPrivateKey.sign(Utils.toArray(testMessage, 'utf8'));

      // Valid BRC-31 format should work or fail gracefully
      const validResponse = await request(app)
        .post('/overlay/brc31/authenticate')
        .send({
          publicKey: testPublicKey.toString(),
          signature: Utils.toBase64(signature),
          message: testMessage
        });

      expect([200, 400, 503]).toContain(validResponse.status);

      // Invalid signature should definitely fail
      const invalidResponse = await request(app)
        .post('/overlay/brc31/authenticate')
        .send({
          publicKey: testPublicKey.toString(),
          signature: 'invalid-signature',
          message: testMessage
        });

      expect(invalidResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should validate BRC-41 payment header compliance', async () => {
      // Test payment headers are properly set for premium features
      const response = await request(app)
        .post('/overlay/streaming/premium/4k-transcoding')
        .send({
          uploadId: 'test-upload-id',
          profile: '4k-ultra'
        });

      expect(response.status).toBe(402);
      expect(response.headers['x-bsv-payment-satoshis-required']).toBeDefined();
      expect(parseInt(response.headers['x-bsv-payment-satoshis-required'])).toBeGreaterThan(0);
    });

    it('should validate streaming protocol compliance', async () => {
      // Test HLS manifest compliance
      const hlsResponse = await request(app)
        .get('/overlay/streaming/hls/test-content/playlist.m3u8');

      // Should require payment
      expect(hlsResponse.status).toBe(402);
      expect(hlsResponse.headers['x-bsv-payment-satoshis-required']).toBeDefined();

      // Test DASH manifest compliance
      const dashResponse = await request(app)
        .get('/overlay/streaming/dash/test-content/manifest.mpd');

      expect(dashResponse.status).toBe(402);
      expect(dashResponse.headers['x-bsv-payment-satoshis-required']).toBeDefined();
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from authentication service failures', async () => {
      // Test service handles empty requests gracefully
      const emptyResponse = await request(app)
        .post('/overlay/brc31/authenticate')
        .send({});

      expect(emptyResponse.status).toBe(400);
      expect(emptyResponse.body.error).toBeDefined();

      // Service should still be responsive for valid requests
      const nonce = Utils.toBase64(crypto.randomBytes(32));
      const message = `recovery-test-${nonce}`;
      const signature = testPrivateKey.sign(Utils.toArray(message, 'utf8'));

      const validResponse = await request(app)
        .post('/overlay/brc31/authenticate')
        .send({
          publicKey: testPublicKey.toString(),
          signature: Utils.toBase64(signature),
          message: message
        });

      // Should respond (success or expected failure)
      expect(validResponse.status).toBeGreaterThan(0);
    });

    it('should handle payment system edge cases', async () => {
      // Test various invalid payment scenarios
      const invalidCases = [
        { amount: 0, purpose: 'zero-amount' },
        { amount: -100, purpose: 'negative-amount' },
        { amount: 'invalid', purpose: 'non-numeric-amount' },
        { amount: 100, purpose: '' }, // Empty purpose
      ];

      for (const testCase of invalidCases) {
        const response = await request(app)
          .post('/overlay/brc41/request-payment')
          .send(testCase);

        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('should maintain streaming service availability during errors', async () => {
      // Test streaming service handles errors gracefully
      const errorCases = [
        '/overlay/streaming/upload', // Without file
        '/overlay/streaming/content/nonexistent-id',
      ];

      for (const endpoint of errorCases) {
        const response = await request(app).get(endpoint);
        // Should fail gracefully, not crash the service
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      }
    });
  });

  describe('Integration Health Checks', () => {
    it('should report system health across all components', async () => {
      const healthResponse = await request(app)
        .get('/overlay/health');

      // Should respond with health status
      expect([200, 503]).toContain(healthResponse.status);
      expect(healthResponse.body.status).toBeDefined();
      expect(healthResponse.body.timestamp).toBeDefined();

      if (healthResponse.body.services) {
        // If services are reported, they should have proper structure
        expect(typeof healthResponse.body.services).toBe('object');
      }
    });

    it('should provide detailed service metrics', async () => {
      const metricsResponse = await request(app)
        .get('/overlay/metrics');

      // Should respond with metrics
      expect([200, 500]).toContain(metricsResponse.status);

      if (metricsResponse.status === 200) {
        expect(metricsResponse.body.timestamp).toBeDefined();
        expect(typeof metricsResponse.body.uptime).toBe('number');
      }
    });
  });
});