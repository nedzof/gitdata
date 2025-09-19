// Force deterministic defaults in test
process.env.PRICE_DEFAULT_SATS = '1234';
process.env.RECEIPT_TTL_SEC = '120';

import { describe, test, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initSchema, upsertManifest, setPrice } from '../../src/db';
import { payRouter } from '../../src/routes/pay';
import { initReceiptValidator, validateReceipt } from '../../src/validators/receipt';

describe('Pay Integration Test', () => {
  test('should handle payment receipts', async () => {
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
    }),
    dataset_id: 'ds-test',
    producer_id: null
  });

  // 1) /pay happy path with default price (1000 * 2 = 2000)
  const t0 = Math.floor(Date.now() / 1000);
  const r1 = await request(app)
    .post('/pay')
    .set('content-type', 'application/json')
    .send({ versionId, quantity: 2 });
  expect(r1.status).toBe(200);
  const rec = r1.body;
  expect(rec.versionId).toBe(versionId);
  expect(rec.contentHash).toBe(contentHash);
  expect(rec.quantity).toBe(2);
  expect(rec.amountSat).toBe(2468);
  expect(rec.expiresAt).toBeGreaterThanOrEqual(t0);
  expect(rec.expiresAt).toBeLessThanOrEqual(t0 + 120 + 2);

  // Schema-check
  const schemaRes = validateReceipt(rec);
  expect(schemaRes.ok).toBe(true);

  // 2) Override price and pay again (price 2500 * 1 = 2500)
  setPrice(db, versionId, 2500);
  const r2 = await request(app)
    .post('/pay')
    .set('content-type', 'application/json')
    .send({ versionId, quantity: 1 });
  expect(r2.status).toBe(200);
  expect(r2.body.amountSat).toBe(2500);

  // 3) GET /receipt should return the last receipt by id
  const r3 = await request(app).get(`/receipt?receiptId=${r2.body.receiptId}`);
  expect(r3.status).toBe(200);
  expect(r3.body.amountSat).toBe(2500);

  // 4) Negative: unknown versionId
  const bad1 = await request(app).post('/pay').send({ versionId: 'b'.repeat(64), quantity: 1 }).set('content-type','application/json');
  expect(bad1.status).toBe(404);

  // 5) Negative: invalid quantity
  const bad2 = await request(app).post('/pay').send({ versionId, quantity: 0 }).set('content-type','application/json');
  expect(bad2.status).toBe(400);

  });
});