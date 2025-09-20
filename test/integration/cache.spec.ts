import { describe, test, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';

import { initSchema, upsertManifest, upsertDeclaration, replaceEdges } from '../../src/db';
import { bundleRouter } from '../../src/routes/bundle';
import { txidFromRawTx } from '../../src/spv/verify-envelope';
import { invalidateHeadersSnapshot } from '../../src/spv/headers-cache';

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

  // App + DB
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const db = new Database(':memory:');
  initSchema(db);
  app.use(bundleRouter(db));

  const vid = 'a'.repeat(64);
  const man = {
    type: 'datasetVersionManifest',
    datasetId: 'ds-x',
    content: { contentHash: 'c'.repeat(64) },
    provenance: { createdAt: '2024-05-01T00:00:00Z' },
    policy: { license: 'cc-by-4.0', classification: 'public' }
  };

  upsertManifest(db, {
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
  upsertDeclaration(db, {
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
});