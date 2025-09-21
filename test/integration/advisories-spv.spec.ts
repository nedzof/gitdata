import { describe, test, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
 //import { initSchema, upsertManifest, upsertProducer } from '../../src/db';
import { advisoriesRouter } from '../../src/routes/advisories';
import { readyRouter } from '../../src/routes/ready';
import { txidFromRawTx } from '../../src/spv/verify-envelope';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { upsertDeclaration } from '../../src/db';

describe('Advisories SPV Integration Test', () => {
  test('should handle advisories with SPV verification', async () => {
  // Create temporary headers file
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adv-spv-'));
  const headersPath = path.join(tmpDir, 'headers.json');

  // Set environment variables before importing anything
  process.env.HEADERS_FILE = headersPath;
  process.env.POLICY_MIN_CONFS = '1';

  // App + DB
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const db = new Database(':memory:');
  initSchema(db);
  app.use(advisoriesRouter(db));
  app.use(readyRouter(db));

  // Insert producer + manifest
  const producerId = upsertProducer(db, { identity_key: '02abc'.padEnd(66, 'a'), name: 'Acme', website: 'https://acme.example' });
  const vid = 'a'.repeat(64);
  const contentHash = 'c'.repeat(64);
  upsertManifest(db, {
    version_id: vid,
    manifest_hash: vid,
    content_hash: contentHash,
    title: 'Test Dataset',
    license: 'cc-by-4.0',
    classification: 'public',
    created_at: '2024-05-01T00:00:00Z',
    manifest_json: JSON.stringify({
      type: 'datasetVersionManifest',
      datasetId: 'ds-1',
      content: { contentHash },
      provenance: { createdAt: '2024-05-01T00:00:00Z', producer: { identityKey: '02abc'.padEnd(66,'a') } },
      policy: { license: 'cc-by-4.0', classification: 'public' }
    }),
    dataset_id: 'ds-1',
    producer_id: producerId
  });

  // Create a valid SPV envelope
  const bestHeight = 100;
  const blockHash = 'f'.repeat(64);
  const rawTx = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff0100000000000000000000000000';
  const txid = txidFromRawTx(rawTx);

  // Create headers file with correct merkle root (single tx block)
  const byHash = { [blockHash]: { prevHash: '0'.repeat(64), merkleRoot: txid, height: bestHeight } };
  fs.writeFileSync(headersPath, JSON.stringify({ bestHeight, tipHash: blockHash, byHash }, null, 2));

  const env = {
    rawTx,
    proof: { txid, merkleRoot: txid, path: [] },
    block: { blockHash, blockHeight: bestHeight }
  };

  upsertDeclaration(db, {
    version_id: vid,
    txid: txid,
    type: 'DLM1',
    status: 'pending',
    created_at: Math.floor(Date.now()/1000),
    block_hash: blockHash,
    height: bestHeight,
    opret_vout: 0,
    raw_tx: rawTx,
    proof_json: JSON.stringify(env)
  });

  // Test 1: Ready should work without advisories
  console.log('Testing /ready without advisories...');
  const rdy1 = await request(app).get(`/ready?versionId=${vid}`);
  expect(rdy1.status).toBe(200);
  expect(rdy1.body.ready).toBe(true);

  // Test 2: Create BLOCK advisory, ready should fail
  console.log('Creating BLOCK advisory...');
  const post = await request(app)
    .post('/advisories')
    .set('content-type', 'application/json')
    .send({
      type: 'BLOCK',
      reason: 'security issue',
      targets: { versionIds: [vid] }
    });
  expect(post.status).toBe(200);

  const rdy2 = await request(app).get(`/ready?versionId=${vid}`);
  expect(rdy2.status).toBe(200);
  expect(rdy2.body.ready).toBe(false);
  expect(rdy2.body.reason).toBe('advisory-blocked');

  // Test 3: Expire advisory, ready should work again
  console.log('Expiring advisory...');
  const now = Math.floor(Date.now() / 1000);
  const { getPostgreSQLClient } = await import('../../src/db/postgresql');
  const pgClient = getPostgreSQLClient();
  await pgClient.query('UPDATE advisories SET expires_at = $1 WHERE advisory_id = $2', [now - 10, post.body.advisoryId]);

  const rdy3 = await request(app).get(`/ready?versionId=${vid}`);
  expect(rdy3.status).toBe(200);
  expect(rdy3.body.ready).toBe(true);

  // Test 4: Create producer-scoped BLOCK advisory
  console.log('Creating producer-scoped BLOCK advisory...');
  const post2 = await request(app)
    .post('/advisories')
    .set('content-type', 'application/json')
    .send({
      type: 'BLOCK',
      reason: 'producer security issue',
      targets: { producerIds: [producerId] }
    });
  expect(post2.status).toBe(200);

  const rdy4 = await request(app).get(`/ready?versionId=${vid}`);
  expect(rdy4.status).toBe(200);
  expect(rdy4.body.ready).toBe(false);
  expect(rdy4.body.reason).toBe('advisory-blocked');

  // Test 5: WARN advisory should not block
  console.log('Testing WARN advisory...');
  await pgClient.query('UPDATE advisories SET type = $1 WHERE advisory_id = $2', ['WARN', post2.body.advisoryId]);

  const rdy5 = await request(app).get(`/ready?versionId=${vid}`);
  expect(rdy5.status).toBe(200);
  expect(rdy5.body.ready).toBe(true);

  });
});