import { describe, test, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
 //
import { initSchema, upsertManifest } from '../../src/db';
import { payRouter } from '../../src/routes/pay';

describe('Data Integration Test', () => {
  test('should handle data streaming and quotas', async () => {
  // Test config - set environment before importing dataRouter
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'data-'));
  process.env.DATA_ROOT = tmpRoot;
  process.env.BYTES_MAX_PER_RECEIPT = '1024'; // 1KB cap for test
  process.env.SINGLE_USE_RECEIPTS = 'false';
  process.env.PRICE_DEFAULT_SATS = '100';
  process.env.RECEIPT_TTL_SEC = '300';

  // Set storage backend configuration for D22 compatibility
  process.env.STORAGE_BACKEND = 'fs';
  process.env.CDN_MODE = 'off';
  process.env.DATA_DELIVERY_MODE = 'stream'; // Force streaming for binary content test

  // Import dataRouter after setting env vars
  const { dataRouter } = await import('../../src/routes/data');

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const db = new Database(':memory:');
  initSchema(db);
  app.use(payRouter(db));
  app.use(dataRouter(db));

  // Import storage driver and create test content
  const { getStorageDriver } = await import('../../src/storage');
  const storage = getStorageDriver();

  // Prepare a fake blob file using storage driver
  const contentHash = 'a'.repeat(64);
  const dataBytes = Buffer.from('hello world'); // 11 bytes
  await storage.putObject(contentHash, dataBytes, 'hot');

  // Insert manifest with contentHash so /pay will accept
  const versionId = 'b'.repeat(64);
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

  // Create receipt
  const payRes = await request(app)
    .post('/pay')
    .set('content-type', 'application/json')
    .send({ versionId, quantity: 1 });
  expect(payRes.status).toBe(200);
  const receiptId = payRes.body.receiptId;

  // 1) Positive: within limit -> 200 + bytes
  const r1 = await request(app).get(`/v1/data?contentHash=${contentHash}&receiptId=${receiptId}`);
  expect(r1.status).toBe(200);
  expect(Buffer.compare(r1.body, dataBytes)).toBe(0);

  // 2) Negative: wrong contentHash -> 409
  const bad1 = await request(app).get(`/v1/data?contentHash=${'c'.repeat(64)}&receiptId=${receiptId}`);
  expect(bad1.status).toBe(409);
  expect(bad1.body.error).toBe('content-mismatch');

  // 3) Test quota by directly updating receipt bytes_used to near limit
  // Update bytes_used to be close to the 1024 limit
  const { getPostgreSQLClient } = await import('../../src/db/postgresql');
  const pgClient = getPostgreSQLClient();
  await pgClient.query('UPDATE receipts SET bytes_used = $1 WHERE receipt_id = $2', [1020, receiptId]); // 1020 + 11 = 1031 > 1024
  const r2 = await request(app).get(`/v1/data?contentHash=${contentHash}&receiptId=${receiptId}`);
  expect(r2.status).toBe(409);
  expect(r2.body.error).toBe('quota-exceeded');

  // 4) Negative: expired receipt
  // Manually expire by decreasing expires_at
  await pgClient.query('UPDATE receipts SET expires_at = $1 WHERE receipt_id = $2', [Math.floor(Date.now()/1000) - 10, receiptId]);
  const r3 = await request(app).get(`/v1/data?contentHash=${contentHash}&receiptId=${receiptId}`);
  expect(r3.status).toBe(403);
  expect(r3.body.error).toBe('expired');

  });
});