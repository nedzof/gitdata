import { describe, test, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { upsertProducer, upsertManifest } from '../../src/db';
import { producersRouter } from '../../src/routes/producers';

describe('Producers Integration Test', () => {
  test('should handle producer registry and mapping', async () => {
  // Configure for PostgreSQL database tests
  console.log('Test environment configured for hybrid database tests');
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(producersRouter());
  
  // Clean up any existing data
  const { getPostgreSQLClient } = await import('../../src/db/postgresql');
  const pgClient = getPostgreSQLClient();
  const identityKey = '02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const versionId = 'a'.repeat(64);
  const datasetId = 'open-images-50k';
  await pgClient.query('DELETE FROM producers WHERE identity_key = $1', [identityKey]);
  await pgClient.query('DELETE FROM assets WHERE version_id = $1', [versionId]);

  // Insert a producer
  const producerId = await upsertProducer({
    identity_key: identityKey,
    name: 'Acme Data',
    website: 'https://acme.example'
  });

  // Map a manifest to datasetId + producer
  await upsertManifest({
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