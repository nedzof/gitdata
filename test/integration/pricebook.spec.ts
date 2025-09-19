import assert from 'assert';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initSchema, upsertManifest, upsertProducer } from '../../src/db';
import { priceRouter } from '../../src/routes/price';
import { upsertPriceRule, setPrice } from '../../src/db';

(async function run() {
  process.env.PRICE_DEFAULT_SATS = '5000';
  process.env.PRICE_QUOTE_TTL_SEC = '60';

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const db = new Database(':memory:');
  initSchema(db);
  app.use(priceRouter(db));

  // Prepare producer and manifests mapping
  const producerId = upsertProducer(db, { identity_key: '02abc'.padEnd(66,'a'), name: 'Acme', website: 'https://acme.example' });
  const vid = 'a'.repeat(64);
  const contentHash = 'c'.repeat(64);
  upsertManifest(db, {
    version_id: vid, manifest_hash: vid, content_hash: contentHash,
    title: 'Test', license: 'cc-by-4.0', classification: 'public',
    created_at: '2024-05-01T00:00:00Z',
    manifest_json: JSON.stringify({}),
    dataset_id: 'ds-1', producer_id: producerId
  });

  // Baseline: default price (5000)
  let r = await request(app).get(`/price?versionId=${vid}&quantity=1`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.unitSatoshis, 5000);
  assert.strictEqual(r.body.ruleSource, 'default');

  // Producer rule: tier_from=1 => 3000
  upsertPriceRule(db, { producer_id: producerId, tier_from: 1, satoshis: 3000 });
  r = await request(app).get(`/price?versionId=${vid}&quantity=1`);
  assert.strictEqual(r.body.unitSatoshis, 3000);
  assert.strictEqual(r.body.ruleSource, 'producer-rule');

  // Producer tier: tier_from=10 => 2500; for quantity=12 pick 2500
  upsertPriceRule(db, { producer_id: producerId, tier_from: 10, satoshis: 2500 });
  r = await request(app).get(`/price?versionId=${vid}&quantity=12`);
  assert.strictEqual(r.body.unitSatoshis, 2500);
  assert.strictEqual(r.body.tierFrom, 10);

  // Version override (prices table): 2800 beats producer rule
  setPrice(db, vid, 2800);
  r = await request(app).get(`/price?versionId=${vid}&quantity=5`);
  assert.strictEqual(r.body.unitSatoshis, 2800);
  assert.strictEqual(r.body.ruleSource, 'version-override');

  // Version rule: tier_from=1 => 2000 beats version override
  upsertPriceRule(db, { version_id: vid, tier_from: 1, satoshis: 2000 });
  r = await request(app).get(`/price?versionId=${vid}&quantity=3`);
  assert.strictEqual(r.body.unitSatoshis, 2000);
  assert.strictEqual(r.body.ruleSource, 'version-rule');

  // Version tier: tier_from=20 => 1500 picked for quantity=25
  upsertPriceRule(db, { version_id: vid, tier_from: 20, satoshis: 1500 });
  r = await request(app).get(`/price?versionId=${vid}&quantity=25`);
  assert.strictEqual(r.body.unitSatoshis, 1500);
  assert.strictEqual(r.body.tierFrom, 20);

  // Admin APIs: POST/DELETE rules
  let a = await request(app).post('/price/rules').send({ producerId, tierFrom: 50, satoshis: 2200 }).set('content-type','application/json');
  assert.strictEqual(a.status, 200);
  a = await request(app).delete('/price/rules').query({ producerId, tierFrom: 50 });
  assert.strictEqual(a.status, 200);

  console.log('OK: Pricebook per producer (tiers & cascade) tests passed.');
})().catch((e) => {
  console.error('pricebook tests failed:', e);
  process.exit(1);
});