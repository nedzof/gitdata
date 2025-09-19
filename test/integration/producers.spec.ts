import assert from 'assert';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initSchema, upsertProducer, upsertManifest } from '../../src/db';
import { producersRouter } from '../../src/routes/producers';

(async function run() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const db = new Database(':memory:');
  initSchema(db);
  app.use(producersRouter(db));

  // Insert a producer
  const producerId = upsertProducer(db, {
    identity_key: '02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    name: 'Acme Data',
    website: 'https://acme.example'
  });

  // Map a manifest to datasetId + producer
  const versionId = 'a'.repeat(64);
  const datasetId = 'open-images-50k';
  upsertManifest(db, {
    version_id: versionId,
    manifest_hash: versionId,
    content_hash: 'c'.repeat(64),
    title: 'Test',
    license: 'cc-by-4.0',
    classification: 'public',
    created_at: '2024-05-01T00:00:00Z',
    manifest_json: JSON.stringify({}),
    dataset_id: datasetId,
    producer_id: producerId
  });

  // Resolve by datasetId
  const r1 = await request(app).get(`/producers?datasetId=${encodeURIComponent(datasetId)}`);
  assert.strictEqual(r1.status, 200);
  assert.strictEqual(r1.body.producerId, producerId);
  assert.strictEqual(r1.body.name, 'Acme Data');

  // Fetch by id
  const r2 = await request(app).get(`/producers/${producerId}`);
  assert.strictEqual(r2.status, 200);
  assert.strictEqual(r2.body.identityKey?.startsWith('02'), true);

  console.log('OK: Producers registry & mapping tests passed.');
})().catch((e) => {
  console.error('producers tests failed:', e);
  process.exit(1);
});