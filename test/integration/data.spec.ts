import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';

import { initSchema, upsertManifest } from '../../src/db';
import { payRouter } from '../../src/routes/pay';

(async function run() {
  // Test config - set environment before importing dataRouter
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'data-'));
  process.env.DATA_ROOT = tmpRoot;
  process.env.BYTES_MAX_PER_RECEIPT = '1024'; // 1KB cap for test
  process.env.SINGLE_USE_RECEIPTS = 'false';
  process.env.PRICE_DEFAULT_SATS = '100';
  process.env.RECEIPT_TTL_SEC = '300';

  // Import dataRouter after setting env vars
  const { dataRouter } = await import('../../src/routes/data');

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const db = new Database(':memory:');
  initSchema(db);
  app.use(payRouter(db));
  app.use(dataRouter(db));

  // Prepare a fake blob file
  const contentHash = 'a'.repeat(64);
  const dataBytes = Buffer.from('hello world'); // 11 bytes
  fs.writeFileSync(path.join(tmpRoot, contentHash.toLowerCase()), dataBytes);

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
    })
  });

  // Create receipt
  const payRes = await request(app)
    .post('/pay')
    .set('content-type', 'application/json')
    .send({ versionId, quantity: 1 });
  assert.strictEqual(payRes.status, 200);
  const receiptId = payRes.body.receiptId;

  // 1) Positive: within limit -> 200 + bytes
  const r1 = await request(app).get(`/v1/data?contentHash=${contentHash}&receiptId=${receiptId}`);
  assert.strictEqual(r1.status, 200);
  assert.strictEqual(Buffer.compare(r1.body as any, dataBytes), 0, 'returned bytes must match stored blob');

  // 2) Negative: wrong contentHash -> 409
  const bad1 = await request(app).get(`/v1/data?contentHash=${'c'.repeat(64)}&receiptId=${receiptId}`);
  assert.strictEqual(bad1.status, 409);
  assert.strictEqual(bad1.body.error, 'content-mismatch');

  // 3) Test quota by directly updating receipt bytes_used to near limit
  // Update bytes_used to be close to the 1024 limit
  db.prepare('UPDATE receipts SET bytes_used = ? WHERE receipt_id = ?').run(1020, receiptId); // 1020 + 11 = 1031 > 1024
  const r2 = await request(app).get(`/v1/data?contentHash=${contentHash}&receiptId=${receiptId}`);
  assert.strictEqual(r2.status, 409);
  assert.strictEqual(r2.body.error, 'quota-exceeded');

  // 4) Negative: expired receipt
  // Manually expire by decreasing expires_at
  db.prepare('UPDATE receipts SET expires_at = ? WHERE receipt_id = ?').run(Math.floor(Date.now()/1000) - 10, receiptId);
  const r3 = await request(app).get(`/v1/data?contentHash=${contentHash}&receiptId=${receiptId}`);
  assert.strictEqual(r3.status, 403);
  assert.strictEqual(r3.body.error, 'expired');

  console.log('OK: /v1/data (streaming & quotas) tests passed.');
})().catch((e) => {
  console.error('data tests failed:', e);
  process.exit(1);
});