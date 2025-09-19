// Force deterministic defaults in test
process.env.PRICE_DEFAULT_SATS = '1234';
process.env.PRICE_QUOTE_TTL_SEC = '120'; // 2 minutes

import { describe, test, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initSchema, upsertManifest, setPrice } from '../../src/db';
import { priceRouter } from '../../src/routes/price';

describe('Price Integration Test', () => {
  test('should handle pricing with defaults and overrides', async () => {

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
    }),
    dataset_id: 'ds-test',
    producer_id: null
  });

  // 1) GET with no override -> default price
  const t0 = Math.floor(Date.now() / 1000);
  const r1 = await request(app).get(`/price?versionId=${versionId}`);
  expect(r1.status).toBe(200);
  expect(r1.body.versionId).toBe(versionId);
  expect(r1.body.contentHash).toBe(contentHash);
  expect(r1.body.satoshis).toBe(1234);
  expect(r1.body.expiresAt).toBeGreaterThanOrEqual(t0);
  expect(r1.body.expiresAt).toBeLessThanOrEqual(t0 + 120 + 2);

  // 2) POST override -> GET returns override
  const r2 = await request(app)
    .post('/price')
    .set('content-type', 'application/json')
    .send({ versionId, satoshis: 7777 });
  expect(r2.status).toBe(200);
  expect(r2.body.status).toBe('ok');

  const r3 = await request(app).get(`/price?versionId=${versionId}`);
  expect(r3.status).toBe(200);
  expect(r3.body.satoshis).toBe(7777);

  // 3) Invalid versionId (GET) -> 400
  const r4 = await request(app).get('/price?versionId=xyz');
  expect(r4.status).toBe(400);

  // 4) Invalid POST body: bad satoshis
  const r5 = await request(app)
    .post('/price')
    .set('content-type', 'application/json')
    .send({ versionId, satoshis: 0 });
  expect(r5.status).toBe(400);

  // 5) 404 when manifest missing
  const anotherVid = 'b'.repeat(64);
  const r6 = await request(app).get(`/price?versionId=${anotherVid}`);
  expect(r6.status).toBe(404);

  });
});