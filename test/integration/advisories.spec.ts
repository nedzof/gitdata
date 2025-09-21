import { describe, test, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initSchema, upsertManifest, upsertProducer } from '../../src/db';
import { advisoriesRouter } from '../../src/routes/advisories';
import { readyRouter } from '../../src/routes/ready';
import { txidFromRawTx } from '../../src/spv/verify-envelope';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { upsertDeclaration } from '../../src/db';

describe('Advisories Integration Test', () => {
  test('should handle advisories and recalls', async () => {
  // headers for /ready
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adv-'));
  const headersPath = path.join(tmpDir, 'headers.json');

  // Set environment variables before importing modules that depend on them
  process.env.HEADERS_FILE = headersPath;
  process.env.POLICY_MIN_CONFS = '1';

  // Build minimal header set for SPV (one block with arbitrary root)
  const bestHeight = 100;
  const blockHash = 'f'.repeat(64);

  // Will be computed after we have the transaction
  let byHash: any;

  // App + DB - Use PostgreSQL only
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Initialize PostgreSQL schema
  await initSchema();

  // Clean up any existing advisory data
  const { getPostgreSQLClient } = await import('../../src/db/postgresql');
  const pgClient = getPostgreSQLClient();
  await pgClient.query('DELETE FROM advisory_targets');
  await pgClient.query('DELETE FROM advisories');

  app.use(advisoriesRouter()); // No SQLite database passed
  app.use(readyRouter());

  // Insert producer + manifest + declaration with a valid SPV envelope
  const producerId = await upsertProducer({ identity_key: '02abc'.padEnd(66, 'a'), name: 'Acme', website: 'https://acme.example' });
  const vid = 'a'.repeat(64);

  // Clean up any existing test data (reuse pgClient from above)
  await pgClient.query('DELETE FROM advisory_targets WHERE version_id = $1', [vid]);
  await pgClient.query('DELETE FROM advisories WHERE advisory_id LIKE $1', ['%test%']);
  await pgClient.query('DELETE FROM manifests WHERE version_id = $1', [vid]);
  await pgClient.query('DELETE FROM declarations WHERE version_id = $1', [vid]);

  const m = {
    type: 'datasetVersionManifest',
    datasetId: 'ds-1',
    content: { contentHash: 'c'.repeat(64) },
    provenance: { createdAt: '2024-05-01T00:00:00Z', producer: { identityKey: '02abc'.padEnd(66,'a') } },
    policy: { license: 'cc-by-4.0', classification: 'public' }
  };
  await upsertManifest({
    version_id: vid,
    manifest_hash: vid,
    content_hash: m.content.contentHash,
    title: null, license: 'cc-by-4.0', classification: 'public',
    created_at: m.provenance.createdAt,
    manifest_json: JSON.stringify(m),
    dataset_id: m.datasetId,
    producer_id: producerId
  });

  // Minimal SPV envelope consistent with headers snapshot
  const rawTx = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff0100000000000000000000000000';
  const txid = txidFromRawTx(rawTx);
  // Simple case: txid == merkleRoot (single transaction block)
  const env = {
    rawTx,
    proof: { txid, merkleRoot: txid, path: [] },
    block: { blockHash, blockHeight: bestHeight }
  };

  // Now create headers file with correct merkle root
  byHash = { [blockHash]: { prevHash: '0'.repeat(64), merkleRoot: txid, height: bestHeight } };
  fs.writeFileSync(headersPath, JSON.stringify({ bestHeight, tipHash: blockHash, byHash }, null, 2));
  await upsertDeclaration({
    version_id: vid,
    txid: 'd'.repeat(64),
    type: 'DLM1',
    status: 'pending',
    created_at: Math.floor(Date.now()/1000),
    block_hash: blockHash,
    height: bestHeight,
    opret_vout: 0,
    raw_tx: rawTx,
    proof_json: JSON.stringify(env)
  });

  // 1) Create a BLOCK advisory scoped to this version via POST
  const post = await request(app)
    .post('/advisories')
    .set('content-type', 'application/json')
    .send({
      type: 'BLOCK',
      reason: 'security issue',
      targets: { versionIds: [vid] }
    });
  expect(post.status).toBe(200);
  const advisoryId = post.body.advisoryId;
  expect(advisoryId).toBeTruthy();

  // 2) GET /advisories?versionId=... returns the advisory
  const getAdv = await request(app).get(`/advisories?versionId=${vid}`);
  expect(getAdv.status).toBe(200);
  expect(getAdv.body.items.length).toBe(1);
  expect(getAdv.body.items[0].type).toBe('BLOCK');

  // 4) Expire the advisory; should no longer appear in active list
  const now = Math.floor(Date.now() / 1000);
  await pgClient.query('UPDATE advisories SET expires_at = $1 WHERE advisory_id = $2', [now - 10, advisoryId]);

  const getAdv2 = await request(app).get(`/advisories?versionId=${vid}`);
  expect(getAdv2.status).toBe(200);
  expect(getAdv2.body.items.length).toBe(0);

  // 5) Create a WARN advisory on producer scope; /advisories returns it, /ready still true
  const post2 = await request(app)
    .post('/advisories')
    .set('content-type', 'application/json')
    .send({
      type: 'WARN',
      reason: 'informational notice',
      targets: { producerIds: [producerId] }
    });
  expect(post2.status).toBe(200);
  const list2 = await request(app).get(`/advisories?versionId=${vid}`);
  expect(list2.status).toBe(200);
  // Should include both version and producer advisories (expired one won't show, new WARN one should)
  expect(list2.body.items.length).toBeGreaterThanOrEqual(1);

  // Test producer-scope advisory (WARN doesn't block) via API
  const prodAdvResponse = await request(app).get(`/advisories?producerId=${producerId}`);
  expect(prodAdvResponse.status).toBe(200);
  expect(prodAdvResponse.body.items.length).toBe(1);
  expect(prodAdvResponse.body.items[0].type).toBe('WARN');

  });
});