import { describe, test, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { upsertManifest, upsertProducer, upsertPriceRule, setPrice } from '../../src/db';
import { priceRouter } from '../../src/routes/price';

describe('Pricebook Integration Test', () => {
  test('should handle producer pricing rules and tiers', async () => {
  process.env.PRICE_DEFAULT_SATS = '5000';
  process.env.PRICE_QUOTE_TTL_SEC = '60';

  // Configure for PostgreSQL database tests
  console.log('Test environment configured for hybrid database tests');
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(priceRouter());

  // Clean up any existing data
  const { getPostgreSQLClient } = await import('../../src/db/postgresql');
  const pgClient = getPostgreSQLClient();
  const vid = 'a'.repeat(64);
  const contentHash = 'c'.repeat(64);
  await pgClient.query('DELETE FROM producers WHERE identity_key = $1', ['02abc'.padEnd(66,'a')]);
  await pgClient.query('DELETE FROM manifests WHERE version_id = $1', [vid]);
  await pgClient.query('DELETE FROM prices WHERE version_id = $1', [vid]);

  // Prepare producer and manifests mapping
  const producerId = await upsertProducer({ identity_key: '02abc'.padEnd(66,'a'), name: 'Acme', website: 'https://acme.example' });
  await upsertManifest({
    version_id: vid, manifest_hash: vid, content_hash: contentHash,
    title: 'Test', license: 'cc-by-4.0', classification: 'public',
    created_at: '2024-05-01T00:00:00Z',
    manifest_json: JSON.stringify({}),
    dataset_id: 'ds-1', producer_id: producerId
  });

  // Baseline: default price (1234)
  let r = await request(app).get(`/price?versionId=${vid}&quantity=1`);
  expect(r.status).toBe(200);
  expect(r.body.unitSatoshis).toBe(1234);
  expect(r.body.ruleSource).toBe('default');

  // Producer rule: tier_from=1 => 3000
  await upsertPriceRule({ producer_id: producerId, tier_from: 1, satoshis: 3000 });
  r = await request(app).get(`/price?versionId=${vid}&quantity=1`);
  expect(r.body.unitSatoshis).toBe(3000);
  expect(r.body.ruleSource).toBe('producer-rule');

  // Producer tier: tier_from=10 => 2500; for quantity=12 pick 2500
  await upsertPriceRule({ producer_id: producerId, tier_from: 10, satoshis: 2500 });
  r = await request(app).get(`/price?versionId=${vid}&quantity=12`);
  expect(r.body.unitSatoshis).toBe(2500);
  expect(r.body.tierFrom).toBe(10);

  // Version override (prices table): 2800 beats producer rule
  await setPrice(vid, 2800);
  r = await request(app).get(`/price?versionId=${vid}&quantity=5`);
  expect(r.body.unitSatoshis).toBe(2800);
  expect(r.body.ruleSource).toBe('version-override');

  // Version rule: tier_from=1 => 2000 beats version override
  await upsertPriceRule({ version_id: vid, tier_from: 1, satoshis: 2000 });
  r = await request(app).get(`/price?versionId=${vid}&quantity=3`);
  expect(r.body.unitSatoshis).toBe(2000);
  expect(r.body.ruleSource).toBe('version-rule');

  // Version tier: tier_from=20 => 1500 picked for quantity=25
  await upsertPriceRule({ version_id: vid, tier_from: 20, satoshis: 1500 });
  r = await request(app).get(`/price?versionId=${vid}&quantity=25`);
  expect(r.body.unitSatoshis).toBe(1500);
  expect(r.body.tierFrom).toBe(20);

  // Admin APIs: POST/DELETE rules
  let a = await request(app).post('/price/rules').send({ producerId, tierFrom: 50, satoshis: 2200 }).set('content-type','application/json');
  expect(a.status).toBe(200);
  a = await request(app).delete('/price/rules').query({ producerId, tierFrom: 50 });
  expect(a.status).toBe(200);

  });
});