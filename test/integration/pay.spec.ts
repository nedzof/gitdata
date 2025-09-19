// Force deterministic defaults in test
process.env.PRICE_DEFAULT_SATS = '1000';
process.env.RECEIPT_TTL_SEC = '120';

import assert from 'assert';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initSchema, upsertManifest, setPrice } from '../../src/db';
import { payRouter } from '../../src/routes/pay';
import { initReceiptValidator, validateReceipt } from '../../src/validators/receipt';

(async function run() {
  initReceiptValidator(); // compile schema for validation

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const db = new Database(':memory:');
  initSchema(db);
  app.use(payRouter(db));

  const versionId = 'a'.repeat(64);
  const contentHash = 'c'.repeat(64);

  // Insert manifest row (required)
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

  // 1) /pay happy path with default price (1000 * 2 = 2000)
  const t0 = Math.floor(Date.now() / 1000);
  const r1 = await request(app)
    .post('/pay')
    .set('content-type', 'application/json')
    .send({ versionId, quantity: 2 });
  assert.strictEqual(r1.status, 200);
  const rec = r1.body;
  assert.strictEqual(rec.versionId, versionId);
  assert.strictEqual(rec.contentHash, contentHash);
  assert.strictEqual(rec.quantity, 2);
  assert.strictEqual(rec.amountSat, 2000);
  assert.ok(rec.expiresAt >= t0 && rec.expiresAt <= t0 + 120 + 2);

  // Schema-check
  const schemaRes = validateReceipt(rec);
  assert.strictEqual(schemaRes.ok, true, `receipt schema errors: ${JSON.stringify(schemaRes.errors)}`);

  // 2) Override price and pay again (price 2500 * 1 = 2500)
  setPrice(db, versionId, 2500);
  const r2 = await request(app)
    .post('/pay')
    .set('content-type', 'application/json')
    .send({ versionId, quantity: 1 });
  assert.strictEqual(r2.status, 200);
  assert.strictEqual(r2.body.amountSat, 2500);

  // 3) GET /receipt should return the last receipt by id
  const r3 = await request(app).get(`/receipt?receiptId=${r2.body.receiptId}`);
  assert.strictEqual(r3.status, 200);
  assert.strictEqual(r3.body.amountSat, 2500);

  // 4) Negative: unknown versionId
  const bad1 = await request(app).post('/pay').send({ versionId: 'b'.repeat(64), quantity: 1 }).set('content-type','application/json');
  assert.strictEqual(bad1.status, 404);

  // 5) Negative: invalid quantity
  const bad2 = await request(app).post('/pay').send({ versionId, quantity: 0 }).set('content-type','application/json');
  assert.strictEqual(bad2.status, 400);

  console.log('OK: /pay & /receipt tests passed.');
})().catch((e) => {
  console.error('pay tests failed:', e);
  process.exit(1);
});