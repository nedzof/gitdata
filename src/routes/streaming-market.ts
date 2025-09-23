/**
 * Streaming Market API routes for marketplace integration
 */

import { Router } from 'express';
import { getHybridDatabase } from '../db/hybrid';
import { realtimeStreamingService } from '../services/realtime-streaming';

const router = Router();

/**
 * GET /streaming-market/streams
 * Get list of available streaming packages
 */
router.get('/streams', async (req, res) => {
  try {
    const { category, priceRange, isActive, search, limit = 20, offset = 0 } = req.query;
    const db = getHybridDatabase();

    let whereClause = 'WHERE m.is_streaming = true';
    const params: any[] = [];
    let paramIndex = 1;

    // Add filters
    if (category) {
      whereClause += ` AND m.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (m.title ILIKE $${paramIndex} OR m.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (isActive === 'true') {
      whereClause += ` AND sm.status = $${paramIndex}`;
      params.push('active');
      paramIndex++;
    }

    const query = `
      SELECT
        m.*,
        sm.status as stream_status,
        sm.tags,
        sm.price_per_packet,
        sm.last_packet_at,
        COUNT(rp.version_id) as total_packets,
        COUNT(rp.version_id) FILTER (WHERE rp.packet_timestamp >= NOW() - INTERVAL '24 hours') as packets_today,
        COUNT(sw.version_id) as active_subscribers,
        MAX(rp.packet_sequence) as latest_sequence,
        AVG(rp.data_size_bytes) as avg_packet_size
      FROM manifests m
      LEFT JOIN stream_metadata sm ON m.version_id = sm.version_id
      LEFT JOIN realtime_packets rp ON m.version_id = rp.version_id
      LEFT JOIN stream_webhooks sw ON m.version_id = sw.version_id AND sw.status = 'active'
      ${whereClause}
      GROUP BY m.version_id, sm.status, sm.tags, sm.price_per_packet, sm.last_packet_at
      ORDER BY sm.last_packet_at DESC NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await db.pg.query(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT m.version_id) as total
      FROM manifests m
      LEFT JOIN stream_metadata sm ON m.version_id = sm.version_id
      ${whereClause}
    `;

    const countResult = await db.pg.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: {
        streams: result.rows,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: parseInt(offset as string) + parseInt(limit as string) < total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching streaming market:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /streaming-market/streams/:streamId
 * Get detailed stream information
 */
router.get('/streams/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    const db = getHybridDatabase();

    const streamQuery = `
      SELECT
        m.*,
        sm.status as stream_status,
        sm.tags,
        sm.price_per_packet,
        sm.last_packet_at,
        COUNT(rp.version_id) as total_packets,
        COUNT(rp.version_id) FILTER (WHERE rp.packet_timestamp >= NOW() - INTERVAL '24 hours') as packets_today,
        COUNT(rp.version_id) FILTER (WHERE rp.packet_timestamp >= NOW() - INTERVAL '1 hour') as packets_hour,
        COUNT(sw.version_id) as active_subscribers,
        MAX(rp.packet_sequence) as latest_sequence,
        AVG(rp.data_size_bytes) as avg_packet_size,
        MIN(rp.packet_timestamp) as first_packet_at,
        MAX(rp.packet_timestamp) as last_packet_at_precise
      FROM manifests m
      LEFT JOIN stream_metadata sm ON m.version_id = sm.version_id
      LEFT JOIN realtime_packets rp ON m.version_id = rp.version_id
      LEFT JOIN stream_webhooks sw ON m.version_id = sw.version_id AND sw.status = 'active'
      WHERE m.version_id = $1 AND m.is_streaming = true
      GROUP BY m.version_id, sm.status, sm.tags, sm.price_per_packet, sm.last_packet_at
    `;

    const streamResult = await db.pg.query(streamQuery, [streamId]);

    if (streamResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    const stream = streamResult.rows[0];

    // Get recent packets sample
    const recentPackets = await realtimeStreamingService.getRecentPackets(streamId, 5);

    // Get stream statistics
    const stats = await realtimeStreamingService.getStreamStats(streamId);

    res.json({
      success: true,
      data: {
        stream,
        stats,
        recentPackets: recentPackets.map(p => ({
          sequence: p.packet_sequence,
          timestamp: p.packet_timestamp,
          confirmations: p.confirmations,
          status: p.confirmation_status,
          size: p.data_size_bytes
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching stream details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /streaming-market/streams/:streamId/subscribe
 * Subscribe to a stream via webhook
 */
router.post('/streams/:streamId/subscribe', async (req, res) => {
  try {
    const { streamId } = req.params;
    const { webhookUrl, subscriberId, deliveryMode = 'confirmed', minConfirmations = 1 } = req.body;

    if (!webhookUrl || !subscriberId) {
      return res.status(400).json({
        success: false,
        error: 'Webhook URL and subscriber ID are required'
      });
    }

    const webhook = await realtimeStreamingService.subscribeWebhook({
      version_id: streamId,
      webhook_url: webhookUrl,
      subscriber_id: subscriberId,
      delivery_mode: deliveryMode,
      min_confirmations: minConfirmations
    });

    res.json({
      success: true,
      data: {
        webhookId: webhook.id,
        message: 'Successfully subscribed to stream'
      }
    });
  } catch (error) {
    console.error('Error subscribing to stream:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /streaming-market/streams/:streamId/subscribe-agent
 * Subscribe an AI agent to a stream
 */
router.post('/streams/:streamId/subscribe-agent', async (req, res) => {
  try {
    const { streamId } = req.params;
    const { agentId, agentWebhookUrl, processingMode = 'realtime', triggerConditions } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required'
      });
    }

    const subscription = await realtimeStreamingService.subscribeAgent({
      version_id: streamId,
      agent_id: agentId,
      processing_mode: processingMode,
      trigger_conditions: triggerConditions,
      agent_webhook_url: agentWebhookUrl
    });

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        message: 'AI agent successfully subscribed to stream'
      }
    });
  } catch (error) {
    console.error('Error subscribing agent to stream:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /streaming-market/stats
 * Get overall marketplace statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const db = getHybridDatabase();

    const query = `
      SELECT
        COUNT(DISTINCT m.version_id) as total_streams,
        COUNT(DISTINCT m.version_id) FILTER (WHERE sm.status = 'active') as active_streams,
        COUNT(rp.version_id) as total_packets,
        COUNT(rp.version_id) FILTER (WHERE rp.packet_timestamp >= NOW() - INTERVAL '24 hours') as packets_today,
        COUNT(DISTINCT sw.subscriber_id) as total_subscribers,
        0 as total_revenue
      FROM manifests m
      LEFT JOIN stream_metadata sm ON m.version_id = sm.version_id
      LEFT JOIN realtime_packets rp ON m.version_id = rp.version_id
      LEFT JOIN stream_webhooks sw ON m.version_id = sw.version_id AND sw.status = 'active'
      WHERE m.is_streaming = true
    `;

    const result = await db.pg.query(query);
    const stats = result.rows[0];

    // Get top categories
    const categoryQuery = `
      SELECT
        m.category,
        COUNT(DISTINCT m.version_id) as stream_count,
        COUNT(rp.version_id) as total_packets
      FROM manifests m
      LEFT JOIN realtime_packets rp ON m.version_id = rp.version_id
      WHERE m.is_streaming = true
      GROUP BY m.category
      ORDER BY stream_count DESC
      LIMIT 10
    `;

    const categoryResult = await db.pg.query(categoryQuery);

    res.json({
      success: true,
      data: {
        overview: {
          totalStreams: parseInt(stats.total_streams) || 0,
          activeStreams: parseInt(stats.active_streams) || 0,
          totalPackets: parseInt(stats.total_packets) || 0,
          packetsToday: parseInt(stats.packets_today) || 0,
          totalSubscribers: parseInt(stats.total_subscribers) || 0,
          totalRevenue: parseFloat(stats.total_revenue) || 0
        },
        categories: categoryResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching marketplace stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /streaming-market/streams/:streamId/live-stats
 * Get real-time stream statistics (for live updates)
 */
router.get('/streams/:streamId/live-stats', async (req, res) => {
  try {
    const { streamId } = req.params;

    const stats = await realtimeStreamingService.getStreamStats(streamId);
    const recentPackets = await realtimeStreamingService.getRecentPackets(streamId, 1);

    const liveStats = {
      totalPackets: parseInt(stats.total_packets) || 0,
      confirmedPackets: parseInt(stats.confirmed_packets) || 0,
      pendingPackets: parseInt(stats.pending_packets) || 0,
      latestSequence: parseInt(stats.latest_sequence) || 0,
      avgPacketSize: parseFloat(stats.avg_packet_size) || 0,
      lastPacketAt: recentPackets[0]?.packet_timestamp || null,
      isActive: recentPackets.length > 0 &&
                new Date().getTime() - new Date(recentPackets[0].packet_timestamp).getTime() < 300000 // 5 minutes
    };

    res.json({
      success: true,
      data: liveStats
    });
  } catch (error) {
    console.error('Error fetching live stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

// Named export for server.ts compatibility
export const streamingMarketRouter = () => router;