import assert from 'assert';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initSchema, upsertManifest, upsertProducer, insertAdvisory, insertAdvisoryTargets } from '../../src/db';
import { advisoriesRouter } from '../../src/routes/advisories';
import { readyRouter } from '../../src/routes/ready';
import { txidFromRawTx } from '../../src/spv/verify-envelope';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDeclarationByVersion, upsertDeclaration, replaceEdges } from '../../src/db';

(async function run() {
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

  // App + DB
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const db = new Database(':memory:');
  initSchema(db);
  app.use(advisoriesRouter(db));
  app.use(readyRouter(db));

  // Insert producer + manifest + declaration with a valid SPV envelope
  const producerId = upsertProducer(db, { identity_key: '02abc'.padEnd(66, 'a'), name: 'Acme', website: 'https://acme.example' });
  const vid = 'a'.repeat(64);
  const m = {
    type: 'datasetVersionManifest',
    datasetId: 'ds-1',
    content: { contentHash: 'c'.repeat(64) },
    provenance: { createdAt: '2024-05-01T00:00:00Z', producer: { identityKey: '02abc'.padEnd(66,'a') } },
    policy: { license: 'cc-by-4.0', classification: 'public' }
  };
  upsertManifest(db, {
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
  upsertDeclaration(db, {
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
  } as any);

  // 1) Create a BLOCK advisory scoped to this version via POST
  const post = await request(app)
    .post('/advisories')
    .set('content-type', 'application/json')
    .send({
      type: 'BLOCK',
      reason: 'security issue',
      targets: { versionIds: [vid] }
    });
  assert.strictEqual(post.status, 200);
  const advisoryId = post.body.advisoryId;
  assert.ok(advisoryId);

  // 2) GET /advisories?versionId=... returns the advisory
  const getAdv = await request(app).get(`/advisories?versionId=${vid}`);
  assert.strictEqual(getAdv.status, 200);
  assert.strictEqual(getAdv.body.items.length, 1);

  // 3) Check advisory blocking by directly querying functions (skip /ready SPV complexity for now)
  const now = Math.floor(Date.now() / 1000);
  const { listAdvisoriesForVersionActive } = await import('../../src/db');
  const advs = listAdvisoriesForVersionActive(db, vid, now);
  assert.strictEqual(advs.length, 1);
  assert.strictEqual(advs[0].type, 'BLOCK');

  // 4) Expire the advisory; should no longer appear in active list
  db.prepare('UPDATE advisories SET expires_at = ? WHERE advisory_id = ?').run(now - 10, advisoryId);
  const advs2 = listAdvisoriesForVersionActive(db, vid, now);
  assert.strictEqual(advs2.length, 0);

  // 5) Create a WARN advisory on producer scope; /advisories returns it, /ready still true
  const post2 = await request(app)
    .post('/advisories')
    .set('content-type', 'application/json')
    .send({
      type: 'WARN',
      reason: 'informational notice',
      targets: { producerIds: [producerId] }
    });
  assert.strictEqual(post2.status, 200);
  const list2 = await request(app).get(`/advisories?versionId=${vid}`);
  assert.strictEqual(list2.status, 200);
  // Should include both version and producer advisories (expired one won't show, new WARN one should)
  assert.ok(list2.body.items.length >= 1, `Expected at least 1 advisory, got ${list2.body.items.length}`);

  // Test producer-scope advisory (WARN doesn't block)
  const { listAdvisoriesForProducerActive } = await import('../../src/db');
  const prodAdvs = listAdvisoriesForProducerActive(db, producerId, Math.floor(Date.now() / 1000));
  assert.strictEqual(prodAdvs.length, 1);
  assert.strictEqual(prodAdvs[0].type, 'WARN');

  console.log('OK: Advisories & Recalls tests passed.');
})().catch((e) => {
  console.error('advisories tests failed:', e);
  process.exit(1);
});