import { describe, test, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initSchema } from '../../src/db';
import { opsRouter } from '../../src/routes/metrics';
import { metricsRoute } from '../../src/middleware/metrics';
import { incRequest, incAdmissions, cacheHit, cacheMiss, observeProofLatency } from '../../src/metrics/registry';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('Metrics Integration Test', () => {
  test('should provide metrics and health endpoints', async () => {
  // Prepare headers snapshot
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-'));
  const headersPath = path.join(tmp, 'headers.json');
  process.env.HEADERS_FILE = headersPath;

  // Create simple headers file
  fs.writeFileSync(headersPath, JSON.stringify({
    bestHeight: 100,
    tipHash: 'f'.repeat(64),
    byHash: {
      ['f'.repeat(64)]: {
        prevHash: '0'.repeat(64),
        merkleRoot: 'a'.repeat(64),
        height: 100
      }
    }
  }, null, 2));

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const db = new Database(':memory:');
  initSchema(db);

  // Add metrics middleware to test route
  app.use('/test', metricsRoute('bundle'));
  app.get('/test', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(opsRouter(db));

  // Generate some test metrics
  incAdmissions(3);
  cacheHit();
  cacheMiss();
  observeProofLatency(150);
  observeProofLatency(250);

  // Hit test endpoint to generate request metrics
  const t1 = await request(app).get('/test');
  expect(t1.status).toBe(200);
  const t2 = await request(app).get('/test');
  expect(t2.status).toBe(200);

  // /metrics snapshot should show our test data
  const m = await request(app).get('/metrics');
  expect(m.status).toBe(200);
  expect(m.body.requestsTotal).toBeGreaterThanOrEqual(2);
  expect(m.body.admissionsTotal).toBeGreaterThanOrEqual(3);
  expect(m.body.bundlesCache.hits).toBeGreaterThanOrEqual(1);
  expect(m.body.bundlesCache.misses).toBeGreaterThanOrEqual(1);
  expect(m.body.proofLatencyMs.count).toBeGreaterThanOrEqual(2);
  expect(m.body.uptimeSec).toBeGreaterThanOrEqual(0);
  expect(m.body.requestsByRoute.bundle).toBeGreaterThanOrEqual(2);
  expect(m.body.requestsByClass['2xx']).toBeGreaterThanOrEqual(2);

  console.log('✓ Metrics data verified:', {
    requests: m.body.requestsTotal,
    admissions: m.body.admissionsTotal,
    cacheHits: m.body.bundlesCache.hits,
    cacheMisses: m.body.bundlesCache.misses,
    proofSamples: m.body.proofLatencyMs.count
  });

  // /health should be ok:true
  const h = await request(app).get('/health');
  expect(h.status).toBe(200);
  expect(h.body.ok).toBe(true);

  });
});