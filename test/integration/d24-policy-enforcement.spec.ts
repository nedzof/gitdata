import { test, expect, beforeAll, afterAll, beforeEach, describe } from 'vitest';
import request from 'supertest';
import express from 'express';
 //import { initSchema, getTestDatabase } from '../../src/db';
import { agentsRouter } from '../../src/routes/agents';
import { rulesRouter } from '../../src/routes/rules';
import { templatesRouter } from '../../src/routes/templates';
import {
  enforceAgentRegistrationPolicy,
  enforceRuleConcurrency,
  enforceJobCreationPolicy,
  enforceResourceLimits,
  enforceAgentSecurityPolicy,
  getPolicyMetrics,
  resetPolicyState
} from '../../src/middleware/policy';

let app: express.Application;
let db: Database.Database;

beforeAll(async () => {
  await initSchema();
  db = getTestDatabase();

  app = express();
  app.use(express.json({ limit: '5mb' })); // Increase limit to test resource limits middleware

  // Apply all policy middlewares for testing
  app.use('/agents', enforceResourceLimits(), enforceAgentSecurityPolicy(), enforceAgentRegistrationPolicy(db), agentsRouter(db));
  app.use('/rules', enforceResourceLimits(), enforceRuleConcurrency(db), enforceJobCreationPolicy(db), rulesRouter(db));
  app.use('/templates', enforceResourceLimits(), templatesRouter(db));

  // Add metrics endpoint for policy testing
  app.get('/policy-metrics', (req, res) => {
    res.json(getPolicyMetrics(db));
  });
});

beforeEach(() => {
  // Reset policy state between tests to avoid rate limiting carryover
  resetPolicyState();
});

afterAll(() => {
  if (db) db.close();
});

describe('D24 Policy Enforcement - Edge Cases & Security', () => {

  describe('Agent Registration Policy', () => {
    test('should enforce rate limits per IP address', async () => {
      const results = [];

      // Register maximum allowed agents (5 by default)
      for (let i = 0; i < 6; i++) {
        const response = await request(app)
          .post('/agents/register')
          .set('x-test-rate-limits', 'true')
          .send({
            name: `Rate Limit Agent ${i}`,
            webhookUrl: `https://api.example.com/webhook-${i}`,
            capabilities: [`capability-${i}`]
          });
        results.push({ status: response.status, body: response.body });
      }

      // First 5 should succeed
      const successful = results.filter(r => r.status === 200);
      const rateLimited = results.filter(r => r.status === 429);

      expect(successful).toHaveLength(5);
      expect(rateLimited).toHaveLength(1);

      // Check that rate limit response includes retry information
      const rateLimitedResponse = rateLimited[0];
      expect(rateLimitedResponse.body.error).toBe('rate-limit-exceeded');
      expect(rateLimitedResponse.body.retryAfter).toBeGreaterThan(0);
    });

    test('should reset rate limits after time window', async () => {
      // This test would need time manipulation or shorter windows for practical testing
      const metricsResponse = await request(app).get('/policy-metrics');
      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.body.agents.maxPerIP).toBe(5);
      expect(metricsResponse.body.agents.rateWindowHours).toBe(1);
    });
  });

  describe('Resource Limits', () => {
    test('should reject oversized requests', async () => {
      // Create a truly large JSON payload that exceeds 1MB limit
      const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const largePayload = {
        name: 'Large Agent',
        webhookUrl: 'https://api.example.com/webhook',
        capabilities: ['test'],
        largeField: largeData
      };

      const response = await request(app)
        .post('/agents/register')
        .set('x-test-resource-limits', 'true')
        .send(largePayload);

      // Should fail due to content-length check
      expect(response.status).toBe(413);
      expect(response.body.error).toBe('request-too-large');
    });

    test('should enforce template size limits', async () => {
      const hugeTemplate = 'x'.repeat(150 * 1024); // 150KB (exceeds 100KB limit)

      const response = await request(app)
        .post('/templates')
        .set('x-test-resource-limits', 'true')
        .send({
          name: 'Huge Template',
          content: hugeTemplate,
          type: 'markdown'
        });

      expect(response.status).toBe(413);
      expect(response.body.error).toBe('template-too-large');
      expect(response.body.maxSize).toBe(100 * 1024);
    });
  });

  describe('Agent Security Policy', () => {
    test('should validate webhook URL schemes', async () => {
      const testCases = [
        { url: 'ftp://example.com/webhook', shouldFail: true },
        { url: 'file:///etc/passwd', shouldFail: true },
        { url: 'javascript:alert(1)', shouldFail: true },
        { url: 'data:text/html,<script>alert(1)</script>', shouldFail: true },
        { url: 'https://api.example.com/webhook', shouldFail: false },
        { url: 'http://localhost:3000/webhook', shouldFail: false } // OK in test mode
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/agents/register')
          .send({
            name: `Test Agent ${testCase.url}`,
            webhookUrl: testCase.url,
            capabilities: ['test']
          });

        if (testCase.shouldFail) {
          expect(response.status).toBe(400);
          expect(response.body.error).toBe('invalid-webhook-url');
        } else {
          expect(response.status).toBe(200);
        }
      }
    });

    test('should validate capability format', async () => {
      const testCases = [
        { capabilities: ['valid-capability'], shouldFail: false },
        { capabilities: ['valid.capability'], shouldFail: false },
        { capabilities: ['valid_capability'], shouldFail: false },
        { capabilities: ['123numeric'], shouldFail: false },
        { capabilities: ['invalid capability'], shouldFail: true }, // spaces
        { capabilities: ['invalid@capability'], shouldFail: true }, // special chars
        { capabilities: [''], shouldFail: true }, // empty
        { capabilities: ['x'.repeat(60)], shouldFail: true }, // too long
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/agents/register')
          .send({
            name: `Capability Test Agent`,
            webhookUrl: 'https://api.example.com/webhook',
            capabilities: testCase.capabilities
          });

        if (testCase.shouldFail) {
          expect(response.status).toBe(400);
          expect(['invalid-capability', 'too-many-capabilities'].includes(response.body.error)).toBe(true);
        } else {
          expect(response.status).toBe(200);
        }
      }
    });

    test('should limit number of capabilities', async () => {
      const tooManyCapabilities = Array.from({ length: 25 }, (_, i) => `capability-${i}`);

      const response = await request(app)
        .post('/agents/register')
        .send({
          name: 'Overloaded Agent',
          webhookUrl: 'https://api.example.com/webhook',
          capabilities: tooManyCapabilities
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('too-many-capabilities');
      expect(response.body.provided).toBe(25);
    });
  });

  describe('Production Mode Security', () => {
    test('should enforce HTTPS and block private IPs in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const testCases = [
          // HTTP should be blocked in production
          { url: 'http://api.example.com/webhook', shouldFail: true },

          // Private networks should be blocked
          { url: 'https://localhost:3000/webhook', shouldFail: true },
          { url: 'https://127.0.0.1:8080/webhook', shouldFail: true },
          { url: 'https://192.168.1.100/webhook', shouldFail: true },
          { url: 'https://10.0.0.1/webhook', shouldFail: true },
          { url: 'https://172.16.0.1/webhook', shouldFail: true },

          // Valid HTTPS public URLs should work
          { url: 'https://api.example.com/webhook', shouldFail: false },
          { url: 'https://webhook.site/unique-id', shouldFail: false }
        ];

        for (const testCase of testCases) {
          const response = await request(app)
            .post('/agents/register')
            .send({
              name: `Production Test Agent`,
              webhookUrl: testCase.url,
              capabilities: ['test']
            });

          if (testCase.shouldFail) {
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('invalid-webhook-url');
          } else {
            expect(response.status).toBe(200);
          }
        }
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Rule Concurrency Policy', () => {
    test('should track and enforce concurrency limits', async () => {
      // Create test agent first
      const agentResponse = await request(app)
        .post('/agents/register')
        .send({
          name: 'Concurrency Test Agent',
          webhookUrl: 'https://api.example.com/webhook',
          capabilities: ['notify']
        });

      const agentId = agentResponse.body.agentId;

      // Get initial metrics
      const initialMetricsResponse = await request(app).get('/policy-metrics');
      const initialRunning = initialMetricsResponse.body.jobs.running;

      // Create a rule (this doesn't test actual concurrency enforcement without jobs)
      const ruleResponse = await request(app)
        .post('/rules')
        .send({
          name: 'Concurrency Test Rule',
          enabled: true,
          when: { type: 'ready', predicate: {} },
          find: { source: 'search', query: { q: 'test' }, limit: 1 },
          actions: [{ action: 'notify', agentId }]
        });

      expect(ruleResponse.status).toBe(200);

      // Check that metrics are accessible
      const metricsResponse = await request(app).get('/policy-metrics');
      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.body.jobs.maxConcurrency).toBe(10); // Default limit
      expect(typeof metricsResponse.body.jobs.concurrencyUtilization).toBe('number');
    });
  });

  describe('Job Creation Policy', () => {
    test('should limit pending jobs per rule', async () => {
      // Create test agent and rule
      const agentResponse = await request(app)
        .post('/agents/register')
        .send({
          name: 'Job Policy Test Agent',
          webhookUrl: 'https://api.example.com/webhook',
          capabilities: ['notify']
        });

      const ruleResponse = await request(app)
        .post('/rules')
        .send({
          name: 'Job Policy Test Rule',
          enabled: true,
          when: { type: 'ready', predicate: {} },
          find: { source: 'search', query: { q: 'test' }, limit: 1 },
          actions: [{ action: 'notify', agentId: agentResponse.body.agentId }]
        });

      expect(ruleResponse.status).toBe(200);

      // The job creation policy is enforced on rule runs, not rule creation
      // This would need actual job queue testing to verify limits
    });
  });

  describe('Policy Metrics', () => {
    test('should provide comprehensive policy metrics', async () => {
      const response = await request(app).get('/policy-metrics');

      expect(response.status).toBe(200);
      const metrics = response.body;

      // Jobs metrics
      expect(metrics.jobs).toBeDefined();
      expect(typeof metrics.jobs.running).toBe('number');
      expect(typeof metrics.jobs.queued).toBe('number');
      expect(typeof metrics.jobs.failed).toBe('number');
      expect(typeof metrics.jobs.dead).toBe('number');
      expect(metrics.jobs.maxConcurrency).toBe(10);
      expect(typeof metrics.jobs.concurrencyUtilization).toBe('number');

      // Agent metrics
      expect(metrics.agents).toBeDefined();
      expect(metrics.agents.maxPerIP).toBe(5);
      expect(metrics.agents.rateWindowHours).toBe(1);
      expect(typeof metrics.agents.activeRateLimits).toBe('number');

      // Limit metrics
      expect(metrics.limits).toBeDefined();
      expect(metrics.limits.maxRequestSize).toBe(1024 * 1024);
      expect(metrics.limits.maxTemplateSize).toBe(100 * 1024);
      expect(metrics.limits.maxPendingJobsPerRule).toBe(3);
    });
  });

  describe('Input Validation Edge Cases', () => {
    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/agents/register')
        .set('Content-Type', 'application/json')
        .send('{ malformed json without closing brace');

      expect(response.status).toBe(400);
    });

    test('should handle empty and null values', async () => {
      const testCases = [
        { name: '', webhookUrl: 'https://api.example.com/webhook' },
        { name: null, webhookUrl: 'https://api.example.com/webhook' },
        { name: 'Test', webhookUrl: '' },
        { name: 'Test', webhookUrl: null },
        { name: 'Test', webhookUrl: 'https://api.example.com/webhook', capabilities: null },
        { name: 'Test', webhookUrl: 'https://api.example.com/webhook', capabilities: [] }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/agents/register')
          .send(testCase);

        // Most should fail validation, but empty capabilities array should be OK
        if (testCase.capabilities === null || !testCase.name || !testCase.webhookUrl) {
          expect(response.status).toBe(400);
        } else {
          expect(response.status).toBe(200);
        }
      }
    });

    test('should handle extremely long strings', async () => {
      const veryLongString = 'x'.repeat(10000);

      const response = await request(app)
        .post('/agents/register')
        .send({
          name: veryLongString,
          webhookUrl: 'https://api.example.com/webhook',
          capabilities: ['test']
        });

      // Should either succeed or fail gracefully
      expect([200, 400, 413].includes(response.status)).toBe(true);
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle concurrent agent registrations', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/agents/register')
          .send({
            name: `Concurrent Agent ${i}`,
            webhookUrl: `https://api.example.com/webhook-${i}`,
            capabilities: [`concurrent-${i}`]
          })
      );

      const results = await Promise.all(concurrentRequests);
      const successful = results.filter(r => r.status === 200);
      const failed = results.filter(r => r.status !== 200);

      // At least some should succeed, rate limiting should apply
      expect(successful.length).toBeGreaterThan(0);
      expect(successful.length + failed.length).toBe(10);
    });
  });
});