// D07 Streaming & Quota Management Routes
import { Router } from 'express';

import { getHybridDatabase } from '../db/hybrid.js';

export function streamingRouter() {
  const router = Router();
  const db = getHybridDatabase();

  // GET /v1/streaming/quotas/:receiptId - Get quota information for a receipt
  router.get('/quotas/:receiptId', async (req, res) => {
    try {
      const { receiptId } = req.params;

      // Get receipt and its quota tier
      const receipt = await db.pg.queryOne(
        `
        SELECT or_table.*, qp.*
        FROM overlay_receipts or_table
        LEFT JOIN quota_policies qp ON qp.policy_name = or_table.quota_tier
        WHERE or_table.receipt_id = $1
      `,
        [receiptId],
      );

      if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' });
      }

      // Get current usage windows
      const windows = await db.pg.query(
        `
        SELECT * FROM quota_usage_windows
        WHERE receipt_id = $1
        ORDER BY window_start DESC
      `,
        [receiptId],
      );

      res.json({
        receiptId,
        quotaPolicy: {
          policyName: receipt.quota_tier,
          bytesPerHour: receipt.bytes_per_hour,
          bytesPerDay: receipt.bytes_per_day,
          maxConcurrentStreams: receipt.max_concurrent_streams,
        },
        windows: windows.rows,
      });
    } catch (error) {
      console.error('Error getting quota:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /v1/streaming/sessions - Create a streaming session
  router.post('/sessions', async (req, res) => {
    try {
      const { receiptId, webhookUrl, qualityRequirements } = req.body;

      if (!receiptId) {
        return res.status(400).json({ error: 'receiptId is required' });
      }

      // Create streaming session
      const sessionResult = await db.pg.queryOne(
        `
        INSERT INTO agent_streaming_sessions (
          receipt_id, session_type, quality_requirements,
          total_content_bytes, estimated_cost_satoshis
        )
        VALUES ($1, 'standard', $2, 1048576, 1000)
        RETURNING *
      `,
        [receiptId, JSON.stringify(qualityRequirements || {})],
      );

      res.json({
        sessionId: sessionResult.id,
        status: sessionResult.session_status,
        estimatedCost: sessionResult.estimated_cost_satoshis,
      });
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /v1/streaming/data/:contentHash - Stream data with quota tracking
  router.get('/data/:contentHash', async (req, res) => {
    try {
      const { contentHash } = req.params;

      // Find receipt for this content
      const receipt = await db.pg.queryOne(
        `
        SELECT * FROM overlay_receipts
        WHERE content_hash = $1 AND status = 'confirmed'
        ORDER BY created_at DESC
        LIMIT 1
      `,
        [contentHash],
      );

      if (!receipt) {
        return res.status(404).json({ error: 'Content not found or not paid for' });
      }

      // Create usage record
      const sessionId = require('crypto').randomUUID();
      await db.pg.query(
        `
        INSERT INTO streaming_usage (
          receipt_id, content_hash, session_id, bytes_streamed
        )
        VALUES ($1, $2, $3, 1024)
      `,
        [receipt.receipt_id, contentHash, sessionId],
      );

      res.set({
        'x-content-hash': contentHash,
        'x-session-id': sessionId,
        'x-quota-tier': receipt.quota_tier,
      });

      res.json({
        contentHash,
        data: 'Sample streaming data content',
        sessionId,
        bytesDelivered: 1024,
      });
    } catch (error) {
      console.error('Error streaming data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /v1/streaming/resolve/:contentHash - Resolve content hosts using BRC-26 UHRP
  router.get('/resolve/:contentHash', async (req, res) => {
    try {
      const { contentHash } = req.params;

      res.json({
        contentHash,
        hosts: [
          {
            url: 'https://host1.example.com',
            publicKey: '02abc123...',
            latency: 50,
            bandwidth: 100,
            region: 'us-east',
          },
          {
            url: 'https://host2.example.com',
            publicKey: '02def456...',
            latency: 75,
            bandwidth: 80,
            region: 'eu-west',
          },
        ],
        recommendedHost: 'https://host1.example.com',
      });
    } catch (error) {
      console.error('Error resolving hosts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /v1/streaming/performance - Report host performance
  router.post('/performance', async (req, res) => {
    try {
      const { contentHash, hostUrl, latency, bandwidth, success } = req.body;

      // This would normally update host performance metrics
      res.json({
        status: 'reported',
        contentHash,
        hostUrl,
        metrics: { latency, bandwidth, success },
      });
    } catch (error) {
      console.error('Error reporting performance:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /v1/streaming/policies - Create quota policies dynamically
  router.post('/policies', async (req, res) => {
    try {
      const { policyName, bytesPerHour, maxConcurrentStreams } = req.body;

      if (!policyName) {
        return res.status(400).json({ error: 'policyName is required' });
      }

      const policyResult = await db.pg.queryOne(
        `
        INSERT INTO quota_policies (
          policy_name, bytes_per_hour, max_concurrent_streams
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (policy_name) DO UPDATE SET
          bytes_per_hour = EXCLUDED.bytes_per_hour,
          max_concurrent_streams = EXCLUDED.max_concurrent_streams
        RETURNING *
      `,
        [policyName, bytesPerHour || 1073741824, maxConcurrentStreams || 1],
      );

      res.json({
        status: 'created',
        policy: {
          id: policyResult.id,
          name: policyResult.policy_name,
          bytesPerHour: policyResult.bytes_per_hour,
          maxConcurrentStreams: policyResult.max_concurrent_streams,
        },
      });
    } catch (error) {
      console.error('Error creating policy:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
