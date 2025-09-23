/**
 * D08 Real-time Streaming Test Data Integration Tests
 * Tests the streaming data population and verification functionality
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { getHybridDatabase } from '../../src/db/hybrid.js';
import { populateStreamingTestData } from '../../scripts/populate-streaming-test-data.js';
import { setupD08Schema } from '../../scripts/setup-d08-schema.js';

const BASE_URL = 'http://localhost:8788';

describe('D08 Streaming Test Data Integration', () => {
  let db: any;

  beforeAll(async () => {
    db = getHybridDatabase();

    // Ensure D08 schema is set up
    await setupD08Schema();
  });

  afterAll(async () => {
    // Clean up test data - order matters due to foreign keys
    await db.pg.query('DELETE FROM webhook_deliveries WHERE webhook_id IN (SELECT id FROM stream_webhooks WHERE version_id LIKE $1)', ['stream-%']);
    await db.pg.query('DELETE FROM stream_webhooks WHERE version_id LIKE $1', ['stream-%']);
    await db.pg.query('DELETE FROM realtime_packets WHERE version_id LIKE $1', ['stream-%']);
    await db.pg.query('DELETE FROM stream_metadata WHERE version_id LIKE $1', ['stream-%']);
    await db.pg.query('DELETE FROM manifests WHERE version_id LIKE $1', ['stream-%']);
  });

  test('should setup D08 streaming schema successfully', async () => {
    // Check that streaming tables exist
    const streamMetadataTable = await db.pg.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'stream_metadata' AND table_schema = 'public'
    `);
    expect(streamMetadataTable.rows).toHaveLength(1);

    const realtimePacketsTable = await db.pg.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'realtime_packets' AND table_schema = 'public'
    `);
    expect(realtimePacketsTable.rows).toHaveLength(1);

    const streamWebhooksTable = await db.pg.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'stream_webhooks' AND table_schema = 'public'
    `);
    expect(streamWebhooksTable.rows).toHaveLength(1);

    // Check that manifests table has streaming columns
    const manifestColumns = await db.pg.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'manifests' AND column_name IN ('is_streaming', 'stream_config')
    `);
    expect(manifestColumns.rows).toHaveLength(2);
  });

  test('should populate streaming test data successfully', async () => {
    await populateStreamingTestData();

    // Verify streaming manifests were created
    const manifests = await db.pg.query(`
      SELECT version_id, title, is_streaming, stream_config
      FROM manifests WHERE is_streaming = true
    `);
    expect(manifests.rows.length).toBeGreaterThanOrEqual(4);

    // Check specific test data
    const weatherStream = manifests.rows.find(m => m.version_id === 'stream-001-weather-sensors');
    expect(weatherStream).toBeDefined();
    expect(weatherStream.title).toBe('Live Weather Sensor Network');
    expect(weatherStream.is_streaming).toBe(true);

    const streamConfig = typeof weatherStream.stream_config === 'string'
      ? JSON.parse(weatherStream.stream_config)
      : weatherStream.stream_config;
    expect(streamConfig.packet_frequency).toBe(30000);
    expect(streamConfig.price_per_packet).toBe(0.001);
  });

  test('should create stream metadata with proper statuses', async () => {
    const metadata = await db.pg.query(`
      SELECT version_id, producer_id, status, tags, price_per_packet
      FROM stream_metadata
    `);
    expect(metadata.rows.length).toBeGreaterThanOrEqual(4);

    // Check for active and paused streams
    const activeStreams = metadata.rows.filter(m => m.status === 'active');
    const pausedStreams = metadata.rows.filter(m => m.status === 'paused');
    expect(activeStreams.length).toBeGreaterThanOrEqual(3);
    expect(pausedStreams.length).toBeGreaterThanOrEqual(1);

    // Verify tags are properly formatted JSON arrays
    metadata.rows.forEach(row => {
      const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThan(0);
    });
  });

  test('should create realtime packets with proper structure', async () => {
    // Only check packets we created in this test (with known version_ids)
    const packets = await db.pg.query(`
      SELECT version_id, packet_sequence, packet_timestamp, confirmation_status,
             data_payload, data_size_bytes
      FROM realtime_packets
      WHERE version_id IN (
        'stream-weather-001', 'stream-001-weather-sensors',
        'stream-002-crypto-prices', 'stream-003-social-sentiment',
        'stream-004-traffic-data'
      )
      ORDER BY packet_timestamp DESC
    `);
    expect(packets.rows.length).toBeGreaterThanOrEqual(5);

    packets.rows.forEach(packet => {
      expect(packet.version_id).toMatch(/^stream-/);
      expect(parseInt(packet.packet_sequence)).toBeGreaterThan(0);
      expect(packet.confirmation_status).toBe('confirmed');
      expect(parseInt(packet.data_size_bytes)).toBeGreaterThan(1024);
      expect(parseInt(packet.data_size_bytes)).toBeLessThan(4096);

      const payload = typeof packet.data_payload === 'string'
        ? JSON.parse(packet.data_payload)
        : packet.data_payload;
      expect(payload.timestamp).toBeDefined();
      expect(payload.value).toBeGreaterThanOrEqual(0);
      expect(payload.metadata.packets_today).toBeGreaterThan(0);
    });
  });

  test('should create webhook subscribers', async () => {
    const webhooks = await db.pg.query(`
      SELECT version_id, webhook_url, subscriber_id, status, delivery_mode
      FROM stream_webhooks
      WHERE version_id IN (
        'stream-weather-001', 'stream-001-weather-sensors',
        'stream-002-crypto-prices', 'stream-003-social-sentiment'
      )
    `);
    expect(webhooks.rows.length).toBeGreaterThanOrEqual(4);

    webhooks.rows.forEach(webhook => {
      expect(webhook.status).toBe('active');
      // Note: delivery_mode may vary based on schema defaults
      expect(webhook.webhook_url).toMatch(/^https?:\/\//);
      expect(webhook.subscriber_id).toBeDefined();
    });
  });

  test.skip('should serve streaming market API endpoints', async () => {
    // Skip this test as it requires the server to be running
    // Test streaming market list endpoint
    const streamsResponse = await fetch(`${BASE_URL}/v1/streaming-market/streams`);
    expect(streamsResponse.ok).toBe(true);

    const streamsData = await streamsResponse.json();
    expect(streamsData.success).toBe(true);
    expect(streamsData.data.streams).toBeDefined();
    expect(streamsData.data.streams.length).toBeGreaterThanOrEqual(4);

    // Test individual stream endpoint
    const streamId = 'stream-001-weather-sensors';
    const streamResponse = await fetch(`${BASE_URL}/v1/streaming-market/streams/${streamId}`);
    expect(streamResponse.ok).toBe(true);

    const streamData = await streamResponse.json();
    expect(streamData.success).toBe(true);
    expect(streamData.data.stream).toBeDefined();
    expect(streamData.data.stream.version_id).toBe(streamId);
    expect(streamData.data.stream.stream_status).toBe('active');

    // Test marketplace stats endpoint
    const statsResponse = await fetch(`${BASE_URL}/v1/streaming-market/stats`);
    expect(statsResponse.ok).toBe(true);

    const statsData = await statsResponse.json();
    expect(statsData.success).toBe(true);
    expect(statsData.data.overview.totalStreams).toBeGreaterThanOrEqual(4);
    expect(statsData.data.overview.activeStreams).toBeGreaterThanOrEqual(3);
  });

  test('should have proper data relationships', async () => {
    // Test that all streaming manifests have corresponding metadata
    const orphanedManifests = await db.pg.query(`
      SELECT m.version_id
      FROM manifests m
      LEFT JOIN stream_metadata sm ON m.version_id = sm.version_id
      WHERE m.is_streaming = true AND sm.version_id IS NULL
    `);
    expect(orphanedManifests.rows).toHaveLength(0);

    // Test that all our test packets reference valid streaming manifests
    const orphanedPackets = await db.pg.query(`
      SELECT rp.version_id
      FROM realtime_packets rp
      LEFT JOIN manifests m ON rp.version_id = m.version_id
      WHERE (m.version_id IS NULL OR m.is_streaming = false)
        AND rp.version_id LIKE 'stream-%'
    `);
    expect(orphanedPackets.rows).toHaveLength(0);

    // Test that our test webhooks reference valid streaming manifests
    const orphanedWebhooks = await db.pg.query(`
      SELECT sw.version_id
      FROM stream_webhooks sw
      LEFT JOIN manifests m ON sw.version_id = m.version_id
      WHERE (m.version_id IS NULL OR m.is_streaming = false)
        AND sw.version_id LIKE 'stream-%'
    `);
    expect(orphanedWebhooks.rows).toHaveLength(0);
  });
});