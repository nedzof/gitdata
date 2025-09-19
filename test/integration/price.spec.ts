// Force deterministic defaults in test
process.env.PRICE_DEFAULT_SATS = '1234';
process.env.PRICE_QUOTE_TTL_SEC = '120'; // 2 minutes

import assert from 'assert';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initSchema, upsertManifest, setPrice } from '../../src/db';
import { priceRouter } from '../../src/routes/price';

(async function run() {

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const db = new Database(':memory:');
  initSchema(db);
  app.use(priceRouter(db));

  const versionId = 'a'.repeat(64);
  const contentHash = 'c'.repeat(64);

  // Insert a manifest row for the version
  upsertManifest(db, {
    version_id: versionId,
    manifest_hash: versionId,
    content_hash: contentHash,
    title: 'Test Dataset',
    license: 'cc-by-4.0',
    classification: 'public',
    created_at: '2024-05-01T00:00:00Z',
    manifest_json: JSON.stringify({
      type: 'datasetVersionManifest',
      datasetId: 'ds-test',
      content: { contentHash },
      provenance: { createdAt: '2024-05-01T00:00:00Z' },
      policy: { license: 'cc-by-4.0', classification: 'public' }
    })
  });

  // 1) GET with no override -> default price
  const t0 = Math.floor(Date.now() / 1000);
  const r1 = await request(app).get(`/price?versionId=${versionId}`);
  assert.strictEqual(r1.status, 200);
  assert.strictEqual(r1.body.versionId, versionId);
  assert.strictEqual(r1.body.contentHash, contentHash);
  assert.strictEqual(r1.body.satoshis, 1234);
  assert.ok(r1.body.expiresAt >= t0 && r1.body.expiresAt <= t0 + 120 + 2, 'expiresAt within TTL window');

  // 2) POST override -> GET returns override
  const r2 = await request(app)
    .post('/price')
    .set('content-type', 'application/json')
    .send({ versionId, satoshis: 7777 });
  assert.strictEqual(r2.status, 200);
  assert.strictEqual(r2.body.status, 'ok');

  const r3 = await request(app).get(`/price?versionId=${versionId}`);
  assert.strictEqual(r3.status, 200);
  assert.strictEqual(r3.body.satoshis, 7777);

  // 3) Invalid versionId (GET) -> 400
  const r4 = await request(app).get('/price?versionId=xyz');
  assert.strictEqual(r4.status, 400);

  // 4) Invalid POST body: bad satoshis
  const r5 = await request(app)
    .post('/price')
    .set('content-type', 'application/json')
    .send({ versionId, satoshis: 0 });
  assert.strictEqual(r5.status, 400);

  // 5) 404 when manifest missing
  const anotherVid = 'b'.repeat(64);
  const r6 = await request(app).get(`/price?versionId=${anotherVid}`);
  assert.strictEqual(r6.status, 404);

  console.log('OK: /price tests passed.');
})().catch((e) => {
  console.error('price tests failed:', e);
  process.exit(1);
});