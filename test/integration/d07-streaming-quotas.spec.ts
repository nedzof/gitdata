/**
 * D07 BSV Overlay Network Data Streaming & Quota Management Integration Tests
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import crypto from 'crypto';
// Use native fetch in Node.js 18+

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'overlay',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'password',
});

const BASE_URL = 'http://localhost:8788';

describe('D07 Streaming & Quota Management', () => {
  let testReceiptId: string;
  let testContentHash: string;
  let testVersionId: string;

  beforeAll(async () => {
    // Create test data
    testReceiptId = crypto.randomUUID();
    testContentHash = 'test-content-hash-d07';
    testVersionId = crypto.randomUUID();

    // Create test manifest (with all required fields)
    await pool.query(`
      INSERT INTO manifests (version_id, manifest_hash, content_hash, title, manifest_json)
      VALUES ($1, $2, $3, 'D07 Test Content', '{"title": "D07 Test Content"}')
      ON CONFLICT (version_id) DO NOTHING
    `, [testVersionId, testContentHash, testContentHash]);

    // Create test receipt with premium quota (with all required fields)
    const expiryDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    await pool.query(`
      INSERT INTO overlay_receipts (
        receipt_id, version_id, content_hash, quota_tier,
        payer_address, unit_price_satoshis, total_satoshis, expires_at
      )
      VALUES ($1, $2, $3, 'premium', 'test-address', 100, 100, $4)
      ON CONFLICT (receipt_id) DO NOTHING
    `, [testReceiptId, testVersionId, testContentHash, expiryDate]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM streaming_usage WHERE receipt_id = $1', [testReceiptId]);
    await pool.query('DELETE FROM quota_usage_windows WHERE receipt_id = $1', [testReceiptId]);
    await pool.query('DELETE FROM agent_streaming_sessions WHERE receipt_id = $1', [testReceiptId]);
    await pool.query('DELETE FROM overlay_receipts WHERE receipt_id = $1', [testReceiptId]);
    await pool.query('DELETE FROM manifests WHERE version_id = $1', [testVersionId]);
    await pool.end();
  });

  test('should enforce quota limits for streaming requests', async () => {
    // Test quota validation endpoint
    const quotaResponse = await fetch(`${BASE_URL}/v1/streaming/quotas/${testReceiptId}`);
    expect(quotaResponse.status).toBe(200);

    const quotaData = await quotaResponse.json();
    expect(quotaData).toHaveProperty('quotaPolicy');
    expect(quotaData).toHaveProperty('windows');
    expect(quotaData.quotaPolicy.policyName).toBe('premium');
  });

  test('should create streaming session with webhook configuration', async () => {
    const sessionData = {
      receiptId: testReceiptId,
      agentId: 'test-agent-d07',
      webhookUrl: 'https://example.com/webhook',
      sessionType: 'webhook',
      estimatedBytes: 1048576 // 1MB
    };

    const response = await fetch(`${BASE_URL}/v1/streaming/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    });

    expect(response.status).toBe(200);
    const session = await response.json();

    expect(session).toHaveProperty('sessionId');
    expect(session).toHaveProperty('agentSessionId');
    expect(session.receiptId).toBe(testReceiptId);
    expect(session.sessionType).toBe('webhook');
    expect(session.qualityRequirements.webhookUrl).toBe('https://example.com/webhook');
  });

  test('should deliver content with quota tracking', async () => {
    const response = await fetch(`${BASE_URL}/v1/streaming/data/${testContentHash}?receiptId=${testReceiptId}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-content-hash')).toBe(testContentHash);
    expect(response.headers.get('x-session-id')).toBeTruthy();

    const content = await response.text();
    expect(content).toContain('Mock content for D07 Test Content');

    // Verify usage was recorded
    const usageResult = await pool.query(`
      SELECT *, bytes_streamed::int as bytes_streamed FROM streaming_usage
      WHERE receipt_id = $1 AND content_hash = $2
    `, [testReceiptId, testContentHash]);

    expect(usageResult.rows.length).toBeGreaterThan(0);
    const usage = usageResult.rows[0];
    expect(usage.bytes_streamed).toBe(content.length);
    expect(usage.delivery_method).toBe('direct');
  });

  test('should track quota usage across time windows', async () => {
    // Check that quota usage windows were updated
    const windowsResult = await pool.query(`
      SELECT * FROM quota_usage_windows
      WHERE receipt_id = $1
    `, [testReceiptId]);

    expect(windowsResult.rows.length).toBeGreaterThan(0);

    // Should have entries for hour, day, and month windows
    const windowTypes = windowsResult.rows.map(row => row.window_type);
    expect(windowTypes).toContain('hour');
    expect(windowTypes).toContain('day');
    expect(windowTypes).toContain('month');
  });

  test('should resolve content hosts using BRC-26 UHRP', async () => {
    const response = await fetch(`${BASE_URL}/v1/streaming/resolve/${testContentHash}`);
    expect(response.status).toBe(200);

    const hostData = await response.json();
    expect(hostData).toHaveProperty('contentHash', testContentHash);
    expect(hostData).toHaveProperty('hosts');
    expect(hostData).toHaveProperty('recommendations');

    expect(Array.isArray(hostData.hosts)).toBe(true);
    expect(hostData.hosts.length).toBeGreaterThan(0);

    const host = hostData.hosts[0];
    expect(host).toHaveProperty('hostUrl');
    expect(host).toHaveProperty('performance');
    expect(host.performance).toHaveProperty('availabilityScore');
    expect(host.performance).toHaveProperty('averageLatencyMs');
  });

  test('should report host performance for optimization', async () => {
    const reportData = {
      contentHash: testContentHash,
      hostUrl: 'https://test-host.overlay.network/content',
      latencyMs: 45,
      bandwidthMbps: 100.0,
      success: true
    };

    const response = await fetch(`${BASE_URL}/v1/streaming/report-host`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData)
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.status).toBe('reported');

    // Verify host performance was recorded
    const hostResult = await pool.query(`
      SELECT * FROM uhrp_host_performance
      WHERE content_hash = $1 AND host_url = $2
    `, [testContentHash, reportData.hostUrl]);

    expect(hostResult.rows.length).toBe(1);
    const hostPerf = hostResult.rows[0];
    expect(hostPerf.average_latency_ms).toBe(45);
    expect(parseFloat(hostPerf.bandwidth_mbps)).toBe(100.0);
  });

  test('should reject requests when quota is exceeded', async () => {
    // First, exhaust the quota by creating a large usage entry
    await pool.query(`
      INSERT INTO quota_usage_windows (
        receipt_id, policy_id, window_type, window_start, window_end,
        bytes_used, requests_used
      )
      SELECT $1, qp.id, 'hour',
        date_trunc('hour', NOW()),
        date_trunc('hour', NOW()) + interval '1 hour',
        qp.bytes_per_hour, qp.requests_per_hour
      FROM quota_policies qp
      WHERE qp.policy_name = 'premium'
      ON CONFLICT (receipt_id, window_type, window_start) DO UPDATE SET
        bytes_used = EXCLUDED.bytes_used,
        requests_used = EXCLUDED.requests_used
    `, [testReceiptId]);

    // Now try to stream content - should be rejected
    const response = await fetch(`${BASE_URL}/v1/streaming/data/${testContentHash}?receiptId=${testReceiptId}`);

    expect(response.status).toBe(429);
    const error = await response.json();
    expect(error.error).toBe('Quota exceeded');
    expect(error.message).toContain('quota exceeded');
  });

  test('should create quota policies dynamically', async () => {
    const policyData = {
      policyName: 'test-policy-d07',
      description: 'Test policy for D07 streaming',
      bytesPerHour: 1073741824, // 1GB
      bytesPerDay: 10737418240, // 10GB
      bytesPerMonth: 107374182400, // 100GB
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      requestsPerMonth: 100000,
      maxConcurrentStreams: 3,
      maxBandwidthMbps: 50.0
    };

    const response = await fetch(`${BASE_URL}/v1/streaming/quotas/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policyData)
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.status).toBe('created');
    expect(result.policy.policy_name).toBe('test-policy-d07');

    // Clean up test policy
    await pool.query('DELETE FROM quota_policies WHERE policy_name = $1', ['test-policy-d07']);
  });

  test('should handle agent streaming session lifecycle', async () => {
    // Create session
    const sessionData = {
      receiptId: testReceiptId,
      agentId: 'test-lifecycle-agent',
      webhookUrl: 'https://example.com/webhook',
      sessionType: 'webhook',
      estimatedBytes: 2097152 // 2MB
    };

    const createResponse = await fetch(`${BASE_URL}/v1/streaming/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    });

    expect(createResponse.status).toBe(200);
    const session = await createResponse.json();
    const agentSessionId = session.agentSessionId;

    // Get session status
    const statusResponse = await fetch(`${BASE_URL}/v1/streaming/sessions/${agentSessionId}`);
    expect(statusResponse.status).toBe(200);

    const status = await statusResponse.json();
    expect(status.agentId).toBe('test-lifecycle-agent');
    expect(status.status).toBe('active');
    expect(status.estimatedCostSatoshis).toBeGreaterThan(0);
  });
});