/**
 * D19 Integration Tests: BRC-31 Identity Producer Registration with BRC-100 Wallet Connect
 *
 * Tests the complete identity verification workflow including:
 * - BRC-31 signature verification
 * - Producer identity registration
 * - BRC-100 wallet connection
 * - Reputation management
 * - Identity-protected endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { PostgreSQLClient } from '../../src/db/postgresql';
import { generatePrivateKey, getPublicKey, generateBRC31Headers } from '../../src/brc31/signer';
import crypto from 'crypto';

// Test configuration
const TEST_CONFIG = {
  server: {
    port: 0, // Use random port for testing
    host: 'localhost'
  },
  database: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'overlay',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password'
  }
};

describe('D19 Identity Producer Registration', () => {
  let app: FastifyInstance;
  let db: PostgreSQLClient;
  let testPrivateKey: string;
  let testIdentityKey: string;
  let baseUrl: string;

  beforeAll(async () => {
    // Initialize test database
    db = new PostgreSQLClient(TEST_CONFIG.database);

    // Initialize test identity
    testPrivateKey = generatePrivateKey();
    testIdentityKey = getPublicKey(testPrivateKey);

    // Create test server with Express app directly (not importing server.ts to avoid port conflicts)
    const express = await import('express');
    const { initializeIdentityRoutes } = await import('../../src/routes/identity');
    const { getPostgreSQLClient } = await import('../../src/db/postgresql');

    app = express.default();
    app.use(express.default.json());

    // Add identity routes for testing
    const pgClient = getPostgreSQLClient();
    app.use('/identity', initializeIdentityRoutes(pgClient));

    // Start server
    const port = 8789; // Use different port for testing
    const server = await new Promise((resolve, reject) => {
      const s = app.listen(port, () => {
        baseUrl = `http://localhost:${port}`;
        console.log(`Test server started on ${baseUrl}`);
        resolve(s);
      });
      s.on('error', reject);
    });

    // Store server reference for cleanup
    app.close = () => new Promise((resolve) => {
      server.close(resolve);
    });

    // Setup test database schema
    await setupTestDatabase();

    // Give server a moment to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    try {
      await cleanupTestDatabase();
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }

    try {
      if (app && app.close) {
        await app.close();
      }
    } catch (error) {
      console.warn('Server close failed:', error);
    }
    // PostgreSQL client connections are managed by the pool, no need to manually end
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.query('DELETE FROM signature_verifications WHERE identity_key = $1', [testIdentityKey]);
    await db.query('DELETE FROM producer_capabilities WHERE identity_key = $1', [testIdentityKey]);
    await db.query('DELETE FROM identity_reputation WHERE identity_key = $1', [testIdentityKey]);
    await db.query('DELETE FROM wallet_sessions WHERE identity_key = $1', [testIdentityKey]);
    await db.query('DELETE FROM overlay_identities WHERE identity_key = $1', [testIdentityKey]);
  });

  describe('BRC-31 Signature Verification', () => {
    it('should verify valid BRC-31 signatures', async () => {
      const body = JSON.stringify({ test: 'data' });
      const headers = generateBRC31Headers(testPrivateKey, body);

      const response = await fetch(`${baseUrl}/identity/test-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.verified).toBe(true);
      expect(result.identityKey).toBe(testIdentityKey);
    });

    it('should reject invalid signatures', async () => {
      const body = JSON.stringify({ test: 'data' });
      const headers = generateBRC31Headers(testPrivateKey, body);

      // Corrupt the signature
      headers['X-Signature'] = headers['X-Signature'].replace(/.$/, '0');

      const response = await fetch(`${baseUrl}/identity/test-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body
      });

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result.error).toBe('unauthorized');
    });

    it('should prevent nonce replay attacks', async () => {
      const body = JSON.stringify({ test: 'data' });
      const headers = generateBRC31Headers(testPrivateKey, body);

      // First request should succeed
      const response1 = await fetch(`${baseUrl}/identity/test-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body
      });

      expect(response1.ok).toBe(true);

      // Second request with same nonce should fail
      const response2 = await fetch(`${baseUrl}/identity/test-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body
      });

      expect(response2.status).toBe(401);
      const result = await response2.json();
      expect(result.hint).toBe('nonce-reused');
    });
  });

  describe('Producer Identity Registration', () => {
    it('should register new producer identity', async () => {
      const registrationData = {
        producerCapabilities: ['data-publishing', 'model-training'],
        overlayTopics: ['gitdata.producer.submissions', 'gitdata.model.weights'],
        geographicRegion: 'US',
        serviceEndpoints: {
          submit: '/producers/submit',
          pricing: '/producers/price',
          metadata: '/producers/metadata'
        }
      };

      const body = JSON.stringify(registrationData);
      const headers = generateBRC31Headers(testPrivateKey, body);

      const response = await fetch(`${baseUrl}/identity/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      expect(result.identityKey).toBe(testIdentityKey);
      expect(result.producerId).toMatch(/^prod_[a-f0-9]{32}$/);
      expect(result.verificationStatus).toBe('verified');
      expect(result.reputationScore).toBe(100);
      expect(result.overlayTopics).toEqual(registrationData.overlayTopics);
      expect(result.capabilities).toEqual(registrationData.producerCapabilities);

      // Verify database records
      const identityRecord = await db.query(
        'SELECT * FROM overlay_identities WHERE identity_key = $1',
        [testIdentityKey]
      );
      expect(identityRecord.rows).toHaveLength(1);
      expect(identityRecord.rows[0].verification_status).toBe('verified');

      const capabilityRecords = await db.query(
        'SELECT * FROM producer_capabilities WHERE identity_key = $1',
        [testIdentityKey]
      );
      expect(capabilityRecords.rows).toHaveLength(2);
    });

    it('should update existing producer identity', async () => {
      // First registration
      const initialRegistration = {
        producerCapabilities: ['data-publishing'],
        overlayTopics: ['gitdata.producer.submissions'],
        geographicRegion: 'US',
        serviceEndpoints: { submit: '/producers/submit' }
      };

      let body = JSON.stringify(initialRegistration);
      let headers = generateBRC31Headers(testPrivateKey, body);

      await fetch(`${baseUrl}/identity/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body
      });

      // Update registration
      const updatedRegistration = {
        producerCapabilities: ['data-publishing', 'model-training', 'analysis'],
        overlayTopics: ['gitdata.producer.submissions', 'gitdata.model.weights'],
        geographicRegion: 'EU',
        serviceEndpoints: {
          submit: '/producers/submit',
          pricing: '/producers/price'
        }
      };

      body = JSON.stringify(updatedRegistration);
      headers = generateBRC31Headers(testPrivateKey, body);

      const response = await fetch(`${baseUrl}/identity/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      expect(result.overlayTopics).toEqual(updatedRegistration.overlayTopics);
      expect(result.capabilities).toEqual(updatedRegistration.producerCapabilities);

      // Verify capabilities were updated
      const capabilityRecords = await db.query(
        'SELECT * FROM producer_capabilities WHERE identity_key = $1',
        [testIdentityKey]
      );
      expect(capabilityRecords.rows).toHaveLength(3);
    });

    it('should handle registration without BRC-31 signature', async () => {
      const registrationData = {
        producerCapabilities: ['data-publishing'],
        overlayTopics: ['gitdata.producer.submissions']
      };

      const response = await fetch(`${baseUrl}/identity/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData)
      });

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result.error).toBe('unauthorized');
    });
  });

  describe('BRC-100 Wallet Connection', () => {
    it('should initiate wallet connection session', async () => {
      const connectRequest = {
        walletType: 'handcash',
        capabilities: ['sign', 'pay', 'identity']
      };

      const response = await fetch(`${baseUrl}/identity/wallet/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectRequest)
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      expect(result.sessionId).toMatch(/^wallet_[a-f0-9]{32}$/);
      expect(result.walletType).toBe('handcash');
      expect(result.capabilities).toEqual(['sign', 'pay', 'identity']);
      expect(result.status).toBe('pending_verification');
      expect(new Date(result.expiresAt)).toBeInstanceOf(Date);

      // Verify database record
      const sessionRecord = await db.query(
        'SELECT * FROM wallet_sessions WHERE session_id = $1',
        [result.sessionId]
      );
      expect(sessionRecord.rows).toHaveLength(1);
      expect(sessionRecord.rows[0].is_connected).toBe(false);
    });

    it('should verify wallet connection with BRC-31 signature', async () => {
      // First, create a session
      const connectRequest = {
        walletType: 'handcash',
        capabilities: ['sign', 'pay', 'identity']
      };

      const connectResponse = await fetch(`${baseUrl}/identity/wallet/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectRequest)
      });

      const connectResult = await connectResponse.json();
      const sessionId = connectResult.sessionId;

      // Then verify the connection
      const nonce = crypto.randomBytes(16).toString('hex');
      const message = `wallet_verification:${sessionId}`;
      const headers = generateBRC31Headers(testPrivateKey, message);

      const verifyResponse = await fetch(`${baseUrl}/identity/wallet/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          identityKey: testIdentityKey,
          signature: headers['X-Signature'],
          nonce: headers['X-Nonce']
        })
      });

      expect(verifyResponse.ok).toBe(true);
      const verifyResult = await verifyResponse.json();

      expect(verifyResult.sessionId).toBe(sessionId);
      expect(verifyResult.identityKey).toBe(testIdentityKey);
      expect(verifyResult.status).toBe('connected');
      expect(verifyResult.identity.producerId).toMatch(/^prod_[a-f0-9]{32}$/);

      // Verify database updates
      const sessionRecord = await db.query(
        'SELECT * FROM wallet_sessions WHERE session_id = $1',
        [sessionId]
      );
      expect(sessionRecord.rows[0].is_connected).toBe(true);
      expect(sessionRecord.rows[0].identity_key).toBe(testIdentityKey);

      // Verify identity was created
      const identityRecord = await db.query(
        'SELECT * FROM overlay_identities WHERE identity_key = $1',
        [testIdentityKey]
      );
      expect(identityRecord.rows).toHaveLength(1);
    });

    it('should reject wallet verification with invalid signature', async () => {
      // Create session
      const connectResponse = await fetch(`${baseUrl}/identity/wallet/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletType: 'handcash',
          capabilities: ['sign', 'pay']
        })
      });

      const connectResult = await connectResponse.json();
      const sessionId = connectResult.sessionId;

      // Try to verify with invalid signature
      const verifyResponse = await fetch(`${baseUrl}/identity/wallet/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          identityKey: testIdentityKey,
          signature: 'invalid_signature',
          nonce: 'invalid_nonce'
        })
      });

      expect(verifyResponse.status).toBe(401);
      const result = await verifyResponse.json();
      expect(result.error).toBe('invalid_signature');
    });
  });

  describe('Identity Status and Reputation', () => {
    beforeEach(async () => {
      // Create test identity
      const registrationData = {
        producerCapabilities: ['data-publishing'],
        overlayTopics: ['gitdata.producer.submissions'],
        serviceEndpoints: { submit: '/producers/submit' }
      };

      const body = JSON.stringify(registrationData);
      const headers = generateBRC31Headers(testPrivateKey, body);

      await fetch(`${baseUrl}/identity/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body
      });
    });

    it('should get identity status', async () => {
      const response = await fetch(`${baseUrl}/identity/status/${testIdentityKey}`);

      expect(response.ok).toBe(true);
      const result = await response.json();

      expect(result.identityKey).toBe(testIdentityKey);
      expect(result.verificationStatus).toBe('verified');
      expect(result.reputationScore).toBe(100);
      expect(result.overlayTopics).toEqual(['gitdata.producer.submissions']);
      expect(result.capabilities).toHaveLength(1);
      expect(result.capabilities[0].type).toBe('data-publishing');
      expect(result.isActive).toBe(true);
    });

    it('should update reputation score', async () => {
      const updateData = {
        identityKey: testIdentityKey,
        eventType: 'successful_submission',
        scoreChange: 10,
        reason: 'High-quality data submission'
      };

      const response = await fetch(`${baseUrl}/identity/reputation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      expect(result.newReputationScore).toBe(110);
      expect(result.eventType).toBe('successful_submission');
      expect(result.scoreChange).toBe(10);

      // Verify database update
      const identityRecord = await db.query(
        'SELECT reputation_score FROM overlay_identities WHERE identity_key = $1',
        [testIdentityKey]
      );
      expect(identityRecord.rows[0].reputation_score).toBe(110);
    });

    it('should handle negative reputation changes', async () => {
      const updateData = {
        identityKey: testIdentityKey,
        eventType: 'policy_violation',
        scoreChange: -20,
        reason: 'Submitted invalid data'
      };

      const response = await fetch(`${baseUrl}/identity/reputation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      expect(result.newReputationScore).toBe(80);

      // Verify reputation history
      const reputationHistory = await db.query(
        'SELECT * FROM identity_reputation WHERE identity_key = $1 ORDER BY recorded_at DESC',
        [testIdentityKey]
      );
      expect(reputationHistory.rows).toHaveLength(2); // Registration + penalty
      expect(reputationHistory.rows[0].score_change).toBe(-20);
    });
  });

  describe('Identity-Protected Endpoints', () => {
    it('should protect endpoints requiring identity', async () => {
      // Try to access protected endpoint without identity
      const response = await fetch(`${baseUrl}/producers/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });

      if (process.env.IDENTITY_REQUIRED === 'true') {
        expect(response.status).toBe(401);
      } else {
        // If not required, should pass through
        expect(response.status).not.toBe(401);
      }
    });

    it('should allow access with valid identity', async () => {
      // Register identity first
      const registrationData = {
        producerCapabilities: ['data-publishing'],
        overlayTopics: ['gitdata.producer.submissions'],
        serviceEndpoints: { submit: '/producers/submit' }
      };

      let body = JSON.stringify(registrationData);
      let headers = generateBRC31Headers(testPrivateKey, body);

      await fetch(`${baseUrl}/identity/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body
      });

      // Now try protected endpoint with identity
      const submitData = { contentHash: 'abc123', manifest: { title: 'Test' } };
      body = JSON.stringify(submitData);
      headers = generateBRC31Headers(testPrivateKey, body);

      const response = await fetch(`${baseUrl}/producers/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body
      });

      // Should not be rejected for identity reasons
      expect(response.status).not.toBe(401);
    });
  });

  describe('Wallet Session Management', () => {
    it('should list active wallet sessions', async () => {
      // Register identity and create wallet session
      const registrationData = {
        producerCapabilities: ['data-publishing'],
        overlayTopics: ['gitdata.producer.submissions'],
        serviceEndpoints: { submit: '/producers/submit' }
      };

      let body = JSON.stringify(registrationData);
      let headers = generateBRC31Headers(testPrivateKey, body);

      await fetch(`${baseUrl}/identity/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body
      });

      // Create and verify wallet session
      const connectResponse = await fetch(`${baseUrl}/identity/wallet/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletType: 'handcash',
          capabilities: ['sign', 'pay']
        })
      });

      const connectResult = await connectResponse.json();
      const sessionId = connectResult.sessionId;

      const message = `wallet_verification:${sessionId}`;
      headers = generateBRC31Headers(testPrivateKey, message);

      await fetch(`${baseUrl}/identity/wallet/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          identityKey: testIdentityKey,
          signature: headers['X-Signature'],
          nonce: headers['X-Nonce']
        })
      });

      // Get wallet sessions
      body = '';
      headers = generateBRC31Headers(testPrivateKey, body);

      const sessionsResponse = await fetch(`${baseUrl}/identity/wallet/sessions`, {
        method: 'GET',
        headers: { ...headers }
      });

      expect(sessionsResponse.ok).toBe(true);
      const result = await sessionsResponse.json();

      expect(result.identityKey).toBe(testIdentityKey);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].session_id).toBe(sessionId);
      expect(result.sessions[0].is_connected).toBe(true);
    });
  });

  // Helper functions
  async function setupTestDatabase(): Promise<void> {
    // Clean up any existing test data but don't recreate tables since they already exist
    await cleanupTestDatabase();
  }

  async function cleanupTestDatabase(): Promise<void> {
    // Clean up test tables in reverse dependency order
    const tables = [
      'nonce_tracking',
      'identity_reputation',
      'producer_capabilities',
      'wallet_sessions',
      'signature_verifications',
      'overlay_identities'
    ];

    for (const table of tables) {
      try {
        await db.query(`DELETE FROM ${table} WHERE 1=1`);
      } catch (error) {
        // Table might not exist, ignore
      }
    }
  }
});