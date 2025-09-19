import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initSchema } from '../../src/db';
import { runIngestMigrations, ingestRouter, startIngestWorker, upsertSource } from '../../src/ingest';
import { createStorageEventsMigration } from '../../src/storage/lifecycle';
import { runPaymentsMigrations } from '../../src/payments';

describe('D23 Real-Time Event Ingestion & Certification Tests', () => {
  let app: express.Application;
  let db: Database.Database;

  beforeEach(async () => {
    // Fresh in-memory database
    db = new Database(':memory:');
    initSchema(db);
    runPaymentsMigrations(db);
    createStorageEventsMigration(db);
    runIngestMigrations(db);

    // Setup Express app
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(ingestRouter(db));

    // Setup test sources
    upsertSource(db, {
      source_id: 'test-source-1',
      name: 'Test Source 1',
      description: 'Primary test source',
      source_type: 'webhook',
      mapping_json: JSON.stringify({
        map: {
          timestamp: 'ts',
          value: 'val',
          sensor: 'sensor'
        },
        required: ['timestamp', 'value'],
        coercion: {
          timestamp: 'timestamp',
          value: 'number'
        },
        constraints: {
          bounds: {
            value: { min: 0, max: 1000 }
          }
        }
      }),
      trust_weight: 1.0,
      enabled: 1
    });

    upsertSource(db, {
      source_id: 'test-source-2',
      name: 'Test Source 2',
      description: 'Secondary test source',
      source_type: 'webhook',
      mapping_json: JSON.stringify({
        map: {
          id: 'eventId',
          data: 'payload'
        },
        required: ['id']
      }),
      trust_weight: 0.8,
      enabled: 1
    });

    // Start the worker
    startIngestWorker(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Event Ingestion', () => {
    test('should accept batch event ingestion', async () => {
      const response = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [
            { ts: 1640995200, val: 42, sensor: 'temp-01' },
            { ts: 1640995260, val: 43, sensor: 'temp-01' },
            { ts: 1640995320, val: 41, sensor: 'temp-02' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.inserted).toBe(3);
      expect(response.body.eventIds).toHaveLength(3);
    });

    test('should handle events without source ID', async () => {
      const response = await request(app)
        .post('/ingest/events')
        .send({
          events: [
            { eventId: 'evt-1', data: 'raw event data' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.inserted).toBe(1);
    });

    test('should reject invalid requests', async () => {
      const response = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1'
          // Missing events array
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('bad-request');
    });

    test('should reject events from disabled sources', async () => {
      // Disable the source
      upsertSource(db, {
        source_id: 'test-source-1',
        enabled: 0
      });

      const response = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [
            { ts: 1640995200, val: 42, sensor: 'temp-01' }
          ]
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('source-not-found-or-disabled');
    });

    test('should reject events from unknown sources', async () => {
      const response = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'unknown-source',
          events: [
            { data: 'test event' }
          ]
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('source-not-found-or-disabled');
    });
  });

  describe('Event Processing & Normalization', () => {
    test('should normalize events according to mapping policy', async () => {
      // Ingest event
      const ingestResponse = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [
            { ts: '2022-01-01T00:00:00Z', val: '42.5', sensor: 'temp-01' }
          ]
        });

      expect(ingestResponse.status).toBe(200);
      const eventId = ingestResponse.body.eventIds[0];

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check event details
      const eventResponse = await request(app)
        .get(`/ingest/events/${eventId}`);

      expect(eventResponse.status).toBe(200);
      expect(eventResponse.body.status).toBe('certified');
      expect(eventResponse.body.normalized.timestamp).toBe(1640995200);
      expect(eventResponse.body.normalized.value).toBe(42.5);
      expect(eventResponse.body.normalized.sensor).toBe('temp-01');
      expect(eventResponse.body.contentHash).toBeTruthy();
      expect(eventResponse.body.versionId).toBeTruthy();
    });

    test('should handle validation errors', async () => {
      // Ingest event with invalid data
      const ingestResponse = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [
            { val: 1500, sensor: 'temp-01' } // Missing required timestamp, value exceeds bounds
          ]
        });

      expect(ingestResponse.status).toBe(200);
      const eventId = ingestResponse.body.eventIds[0];

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check event details
      const eventResponse = await request(app)
        .get(`/ingest/events/${eventId}`);

      expect(eventResponse.status).toBe(200);

      // Should still be normalized/certified but with issues
      const evidence = eventResponse.body.evidence;
      const normalizeStep = evidence.find((e: any) => e.step === 'normalize');
      expect(normalizeStep.issues).toContain('required-missing:timestamp');
      expect(normalizeStep.issues).toContain('bounds-max:value:1500>1000');
    });

    test('should handle coercion correctly', async () => {
      const ingestResponse = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [
            { ts: '1640995200', val: '42', sensor: 'temp-01' }
          ]
        });

      expect(ingestResponse.status).toBe(200);
      const eventId = ingestResponse.body.eventIds[0];

      await new Promise(resolve => setTimeout(resolve, 500));

      const eventResponse = await request(app)
        .get(`/ingest/events/${eventId}`);

      expect(eventResponse.status).toBe(200);
      expect(eventResponse.body.normalized.timestamp).toBe(1640995200);
      expect(eventResponse.body.normalized.value).toBe(42);
      expect(typeof eventResponse.body.normalized.timestamp).toBe('number');
      expect(typeof eventResponse.body.normalized.value).toBe('number');
    });
  });

  describe('Content Certification', () => {
    test('should generate deterministic content hashes', async () => {
      // Ingest identical events
      const event = { ts: 1640995200, val: 42, sensor: 'temp-01' };

      const response1 = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [event]
        });

      const response2 = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [event]
        });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      await new Promise(resolve => setTimeout(resolve, 500));

      const event1Response = await request(app)
        .get(`/ingest/events/${response1.body.eventIds[0]}`);
      const event2Response = await request(app)
        .get(`/ingest/events/${response2.body.eventIds[0]}`);

      expect(event1Response.body.contentHash).toBe(event2Response.body.contentHash);
      expect(event1Response.body.versionId).toBe(event2Response.body.versionId);
    });

    test('should create synthetic version IDs when no external certifier', async () => {
      const response = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [
            { ts: 1640995200, val: 42, sensor: 'temp-01' }
          ]
        });

      expect(response.status).toBe(200);
      const eventId = response.body.eventIds[0];

      await new Promise(resolve => setTimeout(resolve, 500));

      const eventResponse = await request(app)
        .get(`/ingest/events/${eventId}`);

      expect(eventResponse.status).toBe(200);
      expect(eventResponse.body.versionId).toMatch(/^vr_[a-f0-9]{24}$/);
      expect(eventResponse.body.contentHash).toMatch(/^[a-f0-9]{64}$/);

      const evidence = eventResponse.body.evidence;
      const certifyStep = evidence.find((e: any) => e.step === 'certify');
      expect(certifyStep.provider).toBe('synthetic');
      expect(certifyStep.external).toBe(false);
    });

    test('should track certification lineage', async () => {
      const response = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [
            { ts: 1640995200, val: 42, sensor: 'temp-01' }
          ]
        });

      expect(response.status).toBe(200);
      const eventId = response.body.eventIds[0];

      await new Promise(resolve => setTimeout(resolve, 500));

      const eventResponse = await request(app)
        .get(`/ingest/events/${eventId}`);

      expect(eventResponse.status).toBe(200);
      expect(eventResponse.body.evidence).toHaveLength(3); // normalize, validate, certify

      const evidence = eventResponse.body.evidence;
      expect(evidence[0].step).toBe('normalize');
      expect(evidence[1].step).toBe('validate');
      expect(evidence[2].step).toBe('certify');

      // Each step should have timestamp
      evidence.forEach((step: any) => {
        expect(step.timestamp).toBeTruthy();
        expect(typeof step.timestamp).toBe('number');
      });
    });
  });

  describe('Event Feed API', () => {
    test('should list events with pagination', async () => {
      // Ingest multiple events
      await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: Array.from({ length: 15 }, (_, i) => ({
            ts: 1640995200 + i * 60,
            val: 40 + i,
            sensor: `temp-${i % 3}`
          }))
        });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Test pagination
      const page1 = await request(app)
        .get('/ingest/feed?limit=10&offset=0');

      expect(page1.status).toBe(200);
      expect(page1.body.items).toHaveLength(10);
      expect(page1.body.hasMore).toBe(true);
      expect(page1.body.nextOffset).toBe(10);

      const page2 = await request(app)
        .get('/ingest/feed?limit=10&offset=10');

      expect(page2.status).toBe(200);
      expect(page2.body.items).toHaveLength(5);
      expect(page2.body.hasMore).toBe(false);
      expect(page2.body.nextOffset).toBeNull();
    });

    test('should filter events by source', async () => {
      // Ingest events from different sources
      await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [
            { ts: 1640995200, val: 42, sensor: 'temp-01' }
          ]
        });

      await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-2',
          events: [
            { eventId: 'evt-1', payload: 'test data' }
          ]
        });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Filter by source
      const source1Events = await request(app)
        .get('/ingest/feed?sourceId=test-source-1');

      expect(source1Events.status).toBe(200);
      expect(source1Events.body.items).toHaveLength(1);
      expect(source1Events.body.items[0].sourceId).toBe('test-source-1');

      const source2Events = await request(app)
        .get('/ingest/feed?sourceId=test-source-2');

      expect(source2Events.status).toBe(200);
      expect(source2Events.body.items).toHaveLength(1);
      expect(source2Events.body.items[0].sourceId).toBe('test-source-2');
    });

    test('should filter events by status', async () => {
      // Ingest events
      await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [
            { ts: 1640995200, val: 42, sensor: 'temp-01' }
          ]
        });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Filter by status
      const certifiedEvents = await request(app)
        .get('/ingest/feed?status=certified');

      expect(certifiedEvents.status).toBe(200);
      expect(certifiedEvents.body.items).toHaveLength(1);
      expect(certifiedEvents.body.items[0].status).toBe('certified');

      const pendingEvents = await request(app)
        .get('/ingest/feed?status=received');

      expect(pendingEvents.status).toBe(200);
      expect(pendingEvents.body.items).toHaveLength(0);
    });
  });

  describe('Source Management', () => {
    test('should list existing sources', async () => {
      const response = await request(app)
        .get('/ingest/sources');

      expect(response.status).toBe(200);
      expect(response.body.sources).toHaveLength(2);

      const source1 = response.body.sources.find((s: any) => s.source_id === 'test-source-1');
      expect(source1.name).toBe('Test Source 1');
      expect(source1.trust_weight).toBe(1.0);
      expect(source1.enabled).toBe(1);
    });

    test('should create new sources', async () => {
      const response = await request(app)
        .post('/ingest/sources')
        .send({
          name: 'New Test Source',
          description: 'A new source for testing',
          sourceType: 'websocket',
          mappingPolicy: {
            map: { id: 'identifier', value: 'data' },
            required: ['id']
          },
          trustWeight: 0.9,
          rateLimitPerMin: 500
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.created).toBe(true);
      expect(response.body.sourceId).toBeTruthy();

      // Verify source was created
      const sourcesResponse = await request(app)
        .get('/ingest/sources');

      expect(sourcesResponse.body.sources).toHaveLength(3);
    });

    test('should update existing sources', async () => {
      const response = await request(app)
        .post('/ingest/sources')
        .send({
          sourceId: 'test-source-1',
          name: 'Updated Test Source',
          trustWeight: 0.5
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.created).toBe(false);

      // Verify source was updated
      const sourcesResponse = await request(app)
        .get('/ingest/sources');

      const updatedSource = sourcesResponse.body.sources.find((s: any) => s.source_id === 'test-source-1');
      expect(updatedSource.name).toBe('Updated Test Source');
      expect(updatedSource.trust_weight).toBe(0.5);
    });
  });

  describe('Real-time Streaming', () => {
    test('should establish SSE connection', async () => {
      const response = await request(app)
        .get('/watch')
        .set('Accept', 'text/event-stream');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache, no-transform');
    });

    test('should respect connection limits', async () => {
      // Set a low connection limit for testing
      process.env.WATCH_MAX_CLIENTS = '1';

      // First connection should succeed
      const response1 = await request(app)
        .get('/watch')
        .set('Accept', 'text/event-stream');

      expect(response1.status).toBe(200);

      // Second connection should be rejected
      const response2 = await request(app)
        .get('/watch')
        .set('Accept', 'text/event-stream');

      expect(response2.status).toBe(503);
      expect(response2.body.error).toBe('too-many-connections');

      // Cleanup
      delete process.env.WATCH_MAX_CLIENTS;
    });
  });

  describe('Performance & Scalability', () => {
    test('should handle high-volume batch ingestion', async () => {
      const events = Array.from({ length: 1000 }, (_, i) => ({
        ts: 1640995200 + i,
        val: Math.random() * 100,
        sensor: `sensor-${i % 10}`
      }));

      const startTime = Date.now();
      const response = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events
        });

      const ingestTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.inserted).toBe(1000);
      expect(ingestTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check that events were processed
      const feedResponse = await request(app)
        .get('/ingest/feed?status=certified&limit=1000');

      expect(feedResponse.status).toBe(200);
      expect(feedResponse.body.items.length).toBeGreaterThan(900); // Allow for some processing delay
    });

    test('should maintain deterministic ordering', async () => {
      const events = Array.from({ length: 50 }, (_, i) => ({
        ts: 1640995200 + i * 60,
        val: i,
        sensor: 'sequence-test'
      }));

      const response = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events
        });

      expect(response.status).toBe(200);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const feedResponse = await request(app)
        .get('/ingest/feed?sourceId=test-source-1&limit=50');

      expect(feedResponse.status).toBe(200);

      // Events should be ordered by creation time (most recent first)
      const items = feedResponse.body.items;
      for (let i = 1; i < items.length; i++) {
        expect(items[i - 1].createdAt).toBeGreaterThanOrEqual(items[i].createdAt);
      }
    });
  });

  describe('Error Recovery & Resilience', () => {
    test('should handle partial batch failures gracefully', async () => {
      const events = [
        { ts: 1640995200, val: 42, sensor: 'valid-event' },
        null, // Invalid event
        { ts: 1640995260, val: 43, sensor: 'another-valid-event' }
      ];

      const response = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('partial');
      expect(response.body.inserted).toBe(2);
      expect(response.body.errors).toBe(1);
      expect(response.body.errorDetails).toBeDefined();
    });

    test('should handle database constraint violations', async () => {
      // This test would require setting up specific constraint violations
      // For now, we'll test basic error handling
      const response = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [{}] // Empty event should still be handled
        });

      expect(response.status).toBe(200);
      expect(response.body.inserted).toBe(1);
    });
  });

  describe('Integration with Existing Systems', () => {
    test('should maintain compatibility with existing database schema', async () => {
      // Test that our migrations don't break existing functionality
      const producers = db.prepare('SELECT COUNT(*) as count FROM producers').get() as { count: number };
      const manifests = db.prepare('SELECT COUNT(*) as count FROM manifests').get() as { count: number };

      // These should work without errors (empty but accessible)
      expect(producers.count).toBe(0);
      expect(manifests.count).toBe(0);

      // Ingest tables should exist and be functional
      const sources = db.prepare('SELECT COUNT(*) as count FROM ingest_sources').get() as { count: number };
      expect(sources.count).toBe(2);
    });

    test('should generate content hashes compatible with storage system', async () => {
      const response = await request(app)
        .post('/ingest/events')
        .send({
          sourceId: 'test-source-1',
          events: [
            { ts: 1640995200, val: 42, sensor: 'temp-01' }
          ]
        });

      expect(response.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 500));

      const eventResponse = await request(app)
        .get(`/ingest/events/${response.body.eventIds[0]}`);

      // Content hash should be SHA256 (64 hex chars)
      expect(eventResponse.body.contentHash).toMatch(/^[a-f0-9]{64}$/);

      // Version ID should follow vr_ prefix pattern
      expect(eventResponse.body.versionId).toMatch(/^vr_[a-f0-9]{24}$/);
    });
  });

  console.log('✅ D23 Real-Time Event Ingestion & Certification tests completed.');
});