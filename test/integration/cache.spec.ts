import { describe, test, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { upsertManifest, upsertDeclaration, replaceEdges } from '../../src/db';
import { bundleRouter } from '../../src/routes/bundle';
import { txidFromRawTx } from '../../src/spv/verify-envelope';
import { invalidateHeadersSnapshot } from '../../src/spv/headers-cache';
import {
  invalidateAPIClientCache,
  shouldBypassAPICache,
  invalidateBRCCache,
  shouldBypassCache,
  cacheBRCVerification,
  getCachedBRCVerification
} from '../../src/cache/brc-cache';

describe('Cache Integration Test', () => {
  test('should handle bundle caching with TTL', async () => {
  // Configure small bundle TTL to see invalidation easily
  process.env.CACHE_TTLS_JSON = JSON.stringify({ headers: 60000, bundles: 1000 }); // 1s bundles
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-'));
  const headersPath = path.join(tmpDir, 'headers.json');
  process.env.HEADERS_FILE = headersPath;

  // Build a simple headers snapshot
  // Merkle root & tx setup
  const rawTx = '00';
  const txid = txidFromRawTx(rawTx);
  const sibling = '11'.repeat(32);

  // Build a root = sha256d(LE(txid) || LE(sibling)) via helper inline
  const crypto = require('crypto') as typeof import('crypto');
  const rev = (b: Buffer) => { const c = Buffer.from(b); c.reverse(); return c; };
  const sha256d = (b: Buffer) => { const a = crypto.createHash('sha256').update(b).digest(); return crypto.createHash('sha256').update(a).digest(); };
  const root = rev(sha256d(Buffer.concat([rev(Buffer.from(txid,'hex')), rev(Buffer.from(sibling,'hex'))]))).toString('hex');

  const blockHash = 'f'.repeat(64);
  const headers = {
    bestHeight: 100,
    tipHash: blockHash,
    byHash: {
      [blockHash]: { prevHash: '0'.repeat(64), merkleRoot: root, height: 100 }
    }
  };
  fs.writeFileSync(headersPath, JSON.stringify(headers, null, 2));

  // App with PostgreSQL
  console.log('Test environment configured for hybrid database tests');
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(bundleRouter());

  const vid = 'a'.repeat(64);
  const man = {
    type: 'datasetVersionManifest',
    datasetId: 'ds-x',
    content: { contentHash: 'c'.repeat(64) },
    provenance: { createdAt: '2024-05-01T00:00:00Z' },
    policy: { license: 'cc-by-4.0', classification: 'public' }
  };

  // Clean up any existing data for this version
  const { getPostgreSQLClient } = await import('../../src/db/postgresql');
  const pgClient = getPostgreSQLClient();
  await pgClient.query('DELETE FROM manifests WHERE version_id = $1', [vid]);
  await pgClient.query('DELETE FROM declarations WHERE version_id = $1', [vid]);

  await upsertManifest({
    version_id: vid,
    manifest_hash: vid,
    content_hash: man.content.contentHash,
    title: null, license: 'cc-by-4.0', classification: 'public',
    created_at: man.provenance.createdAt, manifest_json: JSON.stringify(man),
    dataset_id: man.datasetId, producer_id: null
  });
  await replaceEdges(vid, []);

  const env = {
    rawTx,
    proof: { txid, merkleRoot: root, path: [{ hash: sibling, position: 'right' }] },
    block: { blockHash, blockHeight: 100 }
  };
  await upsertDeclaration({
    version_id: vid,
    txid: 'd'.repeat(64),
    type: 'DLM1',
    status: 'pending',
    created_at: Math.floor(Date.now()/1000),
    block_hash: blockHash,
    height: 100,
    opret_vout: 0,
    raw_tx: rawTx,
    proof_json: JSON.stringify(env)
  });

  // Ensure headers cache picks up our test file
  invalidateHeadersSnapshot();

  // 1) First bundle -> miss
  const r1 = await request(app).get(`/bundle?versionId=${vid}`);
  expect(r1.status).toBe(200);
  expect(r1.headers['x-cache']).toBe('miss');

  // 2) Second bundle immediately -> hit (confirmations recomputed but equal)
  const r2 = await request(app).get(`/bundle?versionId=${vid}`);
  expect(r2.status).toBe(200);
  expect(r2.headers['x-cache']).toBe('hit');
  const conf1 = r1.body.proofs[0].envelope.confirmations;
  const conf2 = r2.body.proofs[0].envelope.confirmations;
  expect(conf1).toBe(conf2);

  // 3) Increase bestHeight -> hit still returns higher confirmations (recomputed on read)
  const updatedHeaders = {
    bestHeight: 105,
    tipHash: blockHash,
    byHash: { [blockHash]: { prevHash: '0'.repeat(64), merkleRoot: root, height: 100 } }
  };
  fs.writeFileSync(headersPath, JSON.stringify(updatedHeaders, null, 2));
  const r3 = await request(app).get(`/bundle?versionId=${vid}`);
  expect(r3.status).toBe(200);
  expect(r3.headers['x-cache']).toBe('hit');
  expect(r3.body.proofs[0].envelope.confirmations).toBeGreaterThan(conf2);

  // 4) After TTL expiry, cache miss rebuilds structure (we can't inspect internal cache—assert header only)
  await new Promise((r) => setTimeout(r, 1100));
  const r4 = await request(app).get(`/bundle?versionId=${vid}`);
  expect(r4.status).toBe(200);
  expect(r4.headers['x-cache']).toBe('miss');

  });

  test('should handle BRC method cache invalidation', async () => {
    // Configure BRC cache TTLs for testing
    process.env.CACHE_TTLS_JSON = JSON.stringify({
      headers: 30000,
      bundles: 300000,
      brcVerification: 5000, // 5 seconds for quick testing
      brcSignatures: 10000,
      apiClient: 0 // Force no cache for API client
    });

    // Test API client cache bypass
    await invalidateAPIClientCache();
    const shouldBypass = await shouldBypassAPICache();
    expect(shouldBypass).toBe(true);

    // Test method-specific bypass
    const shouldBypassRevenue = await shouldBypassCache('getRevenueSummary');
    expect(shouldBypassRevenue).toBe(true); // Should always bypass for critical methods

    const shouldBypassGeneral = await shouldBypassCache('someOtherMethod');
    expect(shouldBypassGeneral).toBe(true); // Should bypass due to API cache invalidation

    console.log('✅ BRC cache invalidation test passed');
  });

  test('should cache and retrieve BRC verification', async () => {
    // Configure short BRC verification TTL
    process.env.CACHE_TTLS_JSON = JSON.stringify({
      brcVerification: 2000, // 2 seconds
      brcSignatures: 5000
    });

    const method = 'createSignature';
    const hash = 'test_hash_123';
    const publicKey = '0'.repeat(66);

    // Cache a BRC verification
    await cacheBRCVerification(method, hash, true, publicKey);

    // Retrieve cached verification
    const cached = await getCachedBRCVerification(method, hash);
    expect(cached).toBeTruthy();
    expect(cached?.verified).toBe(true);
    expect(cached?.publicKey).toBe(publicKey);

    // Wait for cache expiry
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Should return null after expiry
    const expired = await getCachedBRCVerification(method, hash);
    expect(expired).toBeNull();

    console.log('✅ BRC verification cache test passed');
  });

  test('should invalidate BRC cache on wallet disconnect', async () => {
    const method = 'verifySignature';
    const hash = 'test_hash_456';
    const publicKey = '1'.repeat(66);

    // Cache a BRC verification
    await cacheBRCVerification(method, hash, true, publicKey);

    // Verify it's cached
    let cached = await getCachedBRCVerification(method, hash);
    expect(cached).toBeTruthy();

    // Invalidate BRC cache
    await invalidateBRCCache(publicKey);

    // Should return null after invalidation
    cached = await getCachedBRCVerification(method, hash);
    expect(cached).toBeNull();

    console.log('✅ BRC cache invalidation on disconnect test passed');
  });

  test('should override cache behavior for D06 API methods', async () => {
    // Test that D06 critical methods bypass cache
    const criticalMethods = [
      'getRevenueSummary',
      'getAgentSummary',
      'processPayment',
      'verifyPayment'
    ];

    for (const method of criticalMethods) {
      const shouldBypass = await shouldBypassCache(method);
      expect(shouldBypass).toBe(true);
    }

    // Force API cache invalidation to ensure fresh D06 data
    await invalidateAPIClientCache();
    const bypassed = await shouldBypassAPICache();
    expect(bypassed).toBe(true);

    console.log('✅ D06 API method cache override test passed');
  });
});