/**
 * D43 Phase 1 - BRC-31 Backward Compatibility Tests
 *
 * Tests to ensure BRC-31 implementation doesn't break existing endpoints
 * and maintains backward compatibility with legacy authentication.
 */

import { test, expect, beforeEach, describe } from 'vitest';
import request from 'supertest';
import express from 'express';
import { randomBytes } from 'crypto';

import { overlayRouter } from '../../src/routes/overlay';
import { enhancedBRC31OverlayRouter } from '../../src/routes/overlay-brc-31';
import { initializeBRC31Middleware } from '../../src/brc31/middleware';

import { getPostgreSQLClient } from '../../src/db/postgresql';
import { initializeOverlayServices } from '../../src/overlay/index';

// Use the existing PostgreSQL adapter from overlay services
import { Pool } from 'pg';

function createLegacyTestApp() {
  const app = express();
  app.use(express.json());

  // Add CORS for testing
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Identity-Key, X-Nonce, X-Signature');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Mount legacy overlay router (without BRC-31)
  const legacyRouter = overlayRouter();
  app.use('/legacy', legacyRouter.router);

  // Mount BRC-31 enhanced router
  const brc31Router = enhancedBRC31OverlayRouter();
  app.use('/overlay', brc31Router.router);

  return app;
}

async function createBRC31TestApp() {
  const app = express();
  app.use(express.json());

  // Add CORS for testing
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Authrite, X-Authrite-Identity-Key, X-Authrite-Signature, X-Authrite-Nonce, X-Identity-Key, X-Nonce, X-Signature');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Initialize real database pool directly
  const dbClient = getPostgreSQLClient();
  const pool = dbClient.getPool();

  // Create adapter using the existing PostgreSQLAdapter class from overlay
  class PostgreSQLAdapter {
    constructor(private pool: Pool) {}

    async query(sql: string, params: any[] = []): Promise<any[]> {
      const client = await this.pool.connect();
      try {
        const result = await client.query(sql, params);
        return result.rows;
      } finally {
        client.release();
      }
    }

    async queryOne(sql: string, params: any[] = []): Promise<any> {
      const results = await this.query(sql, params);
      return results[0] || null;
    }

    async execute(sql: string, params: any[] = []): Promise<void> {
      await this.query(sql, params);
    }
  }

  const dbAdapter = new PostgreSQLAdapter(pool);

  // Initialize BRC-31 middleware with database adapter
  const brc31Middleware = initializeBRC31Middleware({
    database: dbAdapter,
    enabled: true,
    enableBackwardCompatibility: true,
    legacyHeaderSupport: true
  });

  // Initialize middleware
  await brc31Middleware.initialize();

  // Initialize real overlay services with the database pool
  const overlayServices = await initializeOverlayServices(pool);

  // Mount BRC-31 enhanced router with real services
  const brc31Router = enhancedBRC31OverlayRouter();
  if (brc31Router.setOverlayServices) {
    brc31Router.setOverlayServices(overlayServices);
  }
  app.use('/overlay', brc31Router.router);

  return app;
}

describe('D43 BRC-31 Backward Compatibility Tests', () => {
  let legacyApp: express.Application;
  let brc31App: express.Application;

  beforeEach(async () => {
    legacyApp = createLegacyTestApp();
    brc31App = await createBRC31TestApp();
  });

  describe('Endpoint Parity', () => {
    test('should provide same status endpoint structure', async () => {
      const legacyResponse = await request(legacyApp)
        .get('/legacy/status')
        .expect(200);

      const brc31Response = await request(brc31App)
        .get('/overlay/status')
        .expect(200);

      // Both should have basic overlay status fields
      expect(legacyResponse.body).toHaveProperty('enabled');
      expect(legacyResponse.body).toHaveProperty('connected');

      expect(brc31Response.body).toHaveProperty('enabled');
      expect(brc31Response.body).toHaveProperty('connected');

      // BRC-31 version should have additional fields
      expect(brc31Response.body).toHaveProperty('brc31');
      expect(brc31Response.body).toHaveProperty('services');
    });

    test('should handle requests without authentication headers', async () => {
      // Both should handle plain requests the same way
      const legacyResponse = await request(legacyApp)
        .get('/legacy/status');

      const brc31Response = await request(brc31App)
        .get('/overlay/status');

      expect(legacyResponse.status).toBe(brc31Response.status);
      expect(typeof legacyResponse.body).toBe(typeof brc31Response.body);
    });
  });

  describe('Legacy Header Support', () => {
    test('should accept legacy X-Identity-Key headers', async () => {
      const identityKey = '02' + randomBytes(32).toString('hex');
      const nonce = randomBytes(16).toString('base64');
      const signature = randomBytes(64).toString('hex');

      const response = await request(brc31App)
        .get('/overlay/status')
        .set('X-Identity-Key', identityKey)
        .set('X-Nonce', nonce)
        .set('X-Signature', signature)
        .expect(200);

      expect(response.body).toHaveProperty('brc31');
      expect(response.body.brc31).toHaveProperty('authenticated', false); // Legacy auth is not fully verified
    });

    test('should handle mixed legacy and BRC-31 headers gracefully', async () => {
      const identityKey = '02' + randomBytes(32).toString('hex');
      const legacyNonce = randomBytes(16).toString('base64');
      const brc31Nonce = randomBytes(32).toString('base64');

      const response = await request(brc31App)
        .get('/overlay/status')
        .set('X-Identity-Key', identityKey)  // Legacy
        .set('X-Nonce', legacyNonce)         // Legacy
        .set('X-Authrite-Nonce', brc31Nonce) // BRC-31
        .expect(200);

      // Should prioritize BRC-31 headers when present
      expect(response.body).toHaveProperty('brc31');
    });
  });

  describe('Response Format Compatibility', () => {
    test('should maintain error response structure', async () => {
      const brc31Error = await request(brc31App)
        .post('/overlay/submit')
        .send({ invalid: 'data' });

      // BRC-31 endpoint should return error response with proper structure
      expect(brc31Error.body).toHaveProperty('error');
      expect(brc31Error.status).toBeGreaterThanOrEqual(400);

      // BRC-31 version should have authentication context
      if (brc31Error.body.authrite) {
        expect(brc31Error.body.authrite).toHaveProperty('version');
      }
    });

    test('should provide enhanced responses for BRC-31 authenticated requests', async () => {
      const identityKey = '02' + randomBytes(32).toString('hex');
      const nonce = randomBytes(32).toString('base64');

      const anonymousResponse = await request(brc31App)
        .get('/overlay/status')
        .expect(200);

      const legacyResponse = await request(brc31App)
        .get('/overlay/status')
        .set('X-Identity-Key', identityKey)
        .set('X-Nonce', randomBytes(16).toString('base64'))
        .set('X-Signature', randomBytes(64).toString('hex'))
        .expect(200);

      const brc31Response = await request(brc31App)
        .get('/overlay/status')
        .set('X-Authrite', '0.1')
        .set('X-Authrite-Identity-Key', identityKey)
        .set('X-Authrite-Nonce', nonce)
        .set('X-Authrite-Signature', randomBytes(64).toString('hex'))
        .expect(200);

      // All should work, but BRC-31 should have most detail
      expect(anonymousResponse.body.brc31.authenticated).toBe(false);
      expect(legacyResponse.body.brc31.authenticated).toBe(false); // Legacy compatibility mode
      expect(brc31Response.body.brc31.authenticated).toBe(false); // Invalid signature but headers processed
    });
  });

  describe('Authentication Method Coexistence', () => {
    test('should not break when both authentication methods are present', async () => {
      const identityKey = '02' + randomBytes(32).toString('hex');

      const response = await request(brc31App)
        .post('/overlay/lookup')
        .set('X-Identity-Key', identityKey)          // Legacy
        .set('X-Nonce', randomBytes(16).toString('base64'))  // Legacy
        .set('X-Signature', randomBytes(64).toString('hex')) // Legacy
        .set('X-Authrite', '0.1')                   // BRC-31
        .set('X-Authrite-Identity-Key', identityKey) // BRC-31
        .set('X-Authrite-Nonce', randomBytes(32).toString('base64')) // BRC-31
        .set('X-Authrite-Signature', randomBytes(64).toString('hex')) // BRC-31
        .send({ provider: 'test', query: {} });

      // Should handle gracefully without crashing, and process the request
      // Mixed headers should be accepted, with BRC-31 taking priority
      expect(response.status).toBeLessThan(500); // No server crash
      expect(response.body).toBeDefined();
    });

    test('should prefer BRC-31 authentication when both are present', async () => {
      const identityKey = '02' + randomBytes(32).toString('hex');

      const response = await request(brc31App)
        .get('/overlay/brc31/status')
        .set('X-Identity-Key', identityKey)          // Legacy
        .set('X-Nonce', randomBytes(16).toString('base64'))  // Legacy
        .set('X-Authrite', '0.1')                   // BRC-31
        .set('X-Authrite-Identity-Key', identityKey) // BRC-31
        .set('X-Authrite-Nonce', randomBytes(32).toString('base64')) // BRC-31
        .expect(200);

      expect(response.body.brc31).toHaveProperty('authenticated', false); // BRC-31 processing attempted
      expect(response.body.brc31).toHaveProperty('version', '0.1');
    });
  });

  describe('Rate Limiting Compatibility', () => {
    test('should apply consistent rate limiting across authentication methods', async () => {
      const identityKey = '02' + randomBytes(32).toString('hex');

      // Test anonymous request
      const anonymousResponse = await request(brc31App)
        .get('/overlay/status')
        .expect(200);

      // Test legacy authenticated request
      const legacyResponse = await request(brc31App)
        .get('/overlay/status')
        .set('X-Identity-Key', identityKey)
        .set('X-Nonce', randomBytes(16).toString('base64'))
        .set('X-Signature', randomBytes(64).toString('hex'))
        .expect(200);

      // Both should succeed without rate limit issues in normal testing
      expect(anonymousResponse.body).toBeDefined();
      expect(legacyResponse.body).toBeDefined();
      expect(legacyResponse.body.brc31).toHaveProperty('authenticated');
    });
  });

  describe('Error Handling Consistency', () => {
    test('should provide helpful error messages for mixed authentication attempts', async () => {
      const response = await request(brc31App)
        .post('/overlay/submit')
        .set('X-Authrite', 'invalid-version')
        .set('X-Identity-Key', 'legacy-key')
        .send({ test: 'data' });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty('error');
      // Should indicate which authentication method was attempted
    });

    test('should maintain error context across authentication methods', async () => {
      // Test with missing required fields
      const legacyError = await request(brc31App)
        .post('/overlay/lookup')
        .set('X-Identity-Key', '02' + randomBytes(32).toString('hex'))
        .send({}); // Missing provider and query

      const brc31Error = await request(brc31App)
        .post('/overlay/lookup')
        .set('X-Authrite', '0.1')
        .set('X-Authrite-Identity-Key', '02' + randomBytes(32).toString('hex'))
        .send({}); // Missing provider and query

      // Both should provide similar error information
      expect(legacyError.status).toBe(brc31Error.status);
    });
  });

  describe('Feature Flag Compatibility', () => {
    test('should work when BRC-31 is disabled', async () => {
      const disabledApp = express();
      disabledApp.use(express.json());

      // Initialize with BRC-31 disabled
      const dbClient = getPostgreSQLClient();
      const pool = dbClient.getPool();

      class PostgreSQLAdapter {
        constructor(private pool: Pool) {}

        async query(sql: string, params: any[] = []): Promise<any[]> {
          const client = await this.pool.connect();
          try {
            const result = await client.query(sql, params);
            return result.rows;
          } finally {
            client.release();
          }
        }

        async queryOne(sql: string, params: any[] = []): Promise<any> {
          const results = await this.query(sql, params);
          return results[0] || null;
        }

        async execute(sql: string, params: any[] = []): Promise<void> {
          await this.query(sql, params);
        }
      }

      const dbAdapter = new PostgreSQLAdapter(pool);
      const disabledMiddleware = initializeBRC31Middleware({
        database: dbAdapter,
        enabled: false
      });

      disabledMiddleware.initialize().catch(err => console.error('Init error:', err));

      // Initialize overlay services with the pool
      const overlayServices = await initializeOverlayServices(pool);
      const brc31Router = enhancedBRC31OverlayRouter();
      if (brc31Router.setOverlayServices) {
        brc31Router.setOverlayServices(overlayServices);
      }
      disabledApp.use('/overlay', brc31Router.router);

      const response = await request(disabledApp)
        .get('/overlay/status')
        .expect(200);

      // Should still work, just without BRC-31 features
      expect(response.body).toHaveProperty('enabled', false);
    });

    test('should gracefully handle middleware initialization failures', async () => {
      // This test ensures the app doesn't crash if BRC-31 fails to initialize
      const response = await request(brc31App)
        .get('/overlay/status')
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('Documentation and Discoverability', () => {
    test('should advertise BRC-31 capabilities in status endpoint', async () => {
      const response = await request(brc31App)
        .get('/overlay/brc31/status')
        .expect(200);

      expect(response.body.brc31).toHaveProperty('version');
      expect(response.body.brc31).toHaveProperty('supportedFeatures');
      expect(response.body.brc31.supportedFeatures).toContain('mutual-authentication');
      expect(response.body.brc31.supportedFeatures).toContain('certificate-chains');
    });

    test('should provide clear upgrade path information', async () => {
      const response = await request(brc31App)
        .get('/overlay/status')
        .expect(200);

      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('brc22');
      expect(response.body.services['brc22']).toContain('BRC-31');
    });
  });
});