import assert from 'assert';
import express from 'express';
import request from 'supertest';
import { auditLogger } from '../../src/middleware/audit';
import { rateLimit } from '../../src/middleware/limits';

(async function run() {
  // Test rate limiting with custom limits
  process.env.RATE_LIMITS_JSON = JSON.stringify({ test: 3 }); // 3 req/min for testing
  process.env.BODY_SIZE_LIMIT = '100b'; // 100 bytes for body size test

  const app = express();
  app.use(express.json({ limit: process.env.BODY_SIZE_LIMIT }));
  app.use(auditLogger());

  // Test route with rate limiting
  app.get('/test', rateLimit('test'), (req, res) => {
    res.json({ ok: true });
  });

  // Test route without rate limiting for comparison
  app.get('/unlimited', (req, res) => {
    res.json({ ok: true });
  });

  // Test route for body size limits
  app.post('/body-test', rateLimit('test'), (req, res) => {
    res.json({ received: req.body });
  });

  // 1) Test rate limiting - first 3 requests should succeed
  console.log('Testing rate limiting...');
  for (let i = 0; i < 3; i++) {
    const res = await request(app).get('/test');
    assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
    assert.strictEqual(res.body.ok, true);
  }

  // 2) 4th request should be rate limited
  const rateLimitedRes = await request(app).get('/test');
  assert.strictEqual(rateLimitedRes.status, 429);
  assert.strictEqual(rateLimitedRes.body.error, 'rate-limited');
  assert.ok(rateLimitedRes.body.hint.includes('limit=3/min'));
  assert.strictEqual(rateLimitedRes.headers['retry-after'], '60');

  // 3) Unlimited route should still work
  const unlimitedRes = await request(app).get('/unlimited');
  assert.strictEqual(unlimitedRes.status, 200);

  // 4) Test different IP gets fresh bucket (simulate via different header)
  const diffIpRes = await request(app)
    .get('/test')
    .set('x-forwarded-for', '192.168.1.100');
  assert.strictEqual(diffIpRes.status, 200, 'Different IP should get fresh rate limit bucket');

  // 5) Test body size limits
  console.log('Testing body size limits...');

  // Small body should work
  const smallBodyRes = await request(app)
    .post('/body-test')
    .set('x-forwarded-for', '192.168.1.101') // Fresh IP for rate limiting
    .send({ test: 'ok' });
  assert.strictEqual(smallBodyRes.status, 200);
  assert.strictEqual(smallBodyRes.body.received.test, 'ok');

  // Large body should be rejected (supertest handles the error differently)
  const largeBody = { data: 'x'.repeat(200) }; // > 100 bytes
  const largeBodyRes = await request(app)
    .post('/body-test')
    .set('x-forwarded-for', '192.168.1.102') // Fresh IP for rate limiting
    .send(largeBody)
    .expect(413); // Should get 413 Payload Too Large

  // 6) Test audit logging (we can't easily test console output, but ensure no errors)
  console.log('Testing audit logging middleware...');
  const auditTestRes = await request(app)
    .get('/unlimited')
    .set('user-agent', 'test-agent');
  assert.strictEqual(auditTestRes.status, 200);

  // 7) Test rate limit error handling with invalid configuration
  const badLimitsApp = express();
  process.env.RATE_LIMITS_JSON = 'invalid-json';

  // Clear module cache to pick up the bad config
  delete require.cache[require.resolve('../../src/middleware/limits')];
  const { rateLimit: badRateLimit } = require('../../src/middleware/limits');
  badLimitsApp.get('/bad-config', badRateLimit('newroute'), (req, res) => {
    res.json({ ok: true });
  });

  // Should fallback to defaults even with bad config (fresh route, fresh IP)
  const badConfigRes = await request(badLimitsApp)
    .get('/bad-config')
    .set('x-forwarded-for', '192.168.1.200');
  assert.strictEqual(badConfigRes.status, 200, 'Should fallback to default limits with bad config');

  console.log('OK: All rate limiting and anti-abuse tests passed.');
})().catch((e) => {
  console.error('Rate limiting tests failed:', e);
  process.exit(1);
});