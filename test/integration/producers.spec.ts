import { describe, test, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
 //import { initSchema, upsertProducer, upsertManifest } from '../../src/db';
import { producersRouter } from '../../src/routes/producers';

describe('Producers Integration Test', () => {
  test('should handle producer registry and mapping', async () => {
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
  expect(r1.status).toBe(200);
  expect(r1.body.producerId).toBe(producerId);
  expect(r1.body.name).toBe('Acme Data');

  // Fetch by id
  const r2 = await request(app).get(`/producers/${producerId}`);
  expect(r2.status).toBe(200);
  expect(r2.body.identityKey?.startsWith('02')).toBe(true);

  });
});