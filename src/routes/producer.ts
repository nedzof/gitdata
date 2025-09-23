/**
 * Producer API routes for streaming data management
 */

import { Router } from 'express';

import { authenticateProducer, validateStreamPermissions } from '../middleware/producer-auth';
import {
  createStreamingProducer,
  generateProducerCredentials,
} from '../producer/streaming-producer';

const router = Router();

/**
 * POST /producer/streams
 * Create a new streaming data stream
 */
router.post('/streams', authenticateProducer, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      pricePerPacket,
      maxPacketsPerMinute,
      retentionHours,
      isPublic,
      tags,
    } = req.body;

    const producer = createStreamingProducer(req.producer);
    const streamId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const stream = await producer.createStream({
      streamId,
      title,
      description,
      category,
      pricePerPacket: pricePerPacket || 1,
      maxPacketsPerMinute: maxPacketsPerMinute || 60,
      retentionHours: retentionHours || 24,
      isPublic: isPublic !== false,
      tags: tags || [],
    });

    res.json({
      success: true,
      data: {
        streamId: stream.version_id,
        stream,
      },
    });
  } catch (error) {
    console.error('Error creating stream:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /producer/streams
 * Get list of producer's streams
 */
router.get('/streams', authenticateProducer, async (req, res) => {
  try {
    const producer = createStreamingProducer(req.producer);
    const streams = await producer.getStreams();

    res.json({
      success: true,
      data: streams,
    });
  } catch (error) {
    console.error('Error fetching streams:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /producer/streams/:streamId/packets
 * Submit a data packet to a stream
 */
router.post(
  '/streams/:streamId/packets',
  authenticateProducer,
  validateStreamPermissions,
  async (req, res) => {
    try {
      const { streamId } = req.params;
      const { data, metadata } = req.body;

      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Packet data is required',
        });
      }

      const producer = createStreamingProducer(req.producer);
      const packet = await producer.submitPacket({
        streamId,
        data,
        metadata,
      });

      res.json({
        success: true,
        data: {
          packetId: packet.id,
          sequence: packet.packet_sequence,
          txid: packet.txid,
          status: packet.confirmation_status,
        },
      });
    } catch (error) {
      console.error('Error submitting packet:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * GET /producer/stats
 * Get producer statistics
 */
router.get('/stats', authenticateProducer, async (req, res) => {
  try {
    const { streamId } = req.query;
    const producer = createStreamingProducer(req.producer);
    const stats = await producer.getProducerStats(streamId as string);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /producer/streams/:streamId/config
 * Update stream configuration
 */
router.put(
  '/streams/:streamId/config',
  authenticateProducer,
  validateStreamPermissions,
  async (req, res) => {
    try {
      const { streamId } = req.params;
      const updates = req.body;

      const producer = createStreamingProducer(req.producer);
      await producer.updateStreamConfig(streamId, updates);

      res.json({
        success: true,
        message: 'Stream configuration updated',
      });
    } catch (error) {
      console.error('Error updating stream config:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * PUT /producer/streams/:streamId/status
 * Update stream status (pause/resume/stop)
 */
router.put(
  '/streams/:streamId/status',
  authenticateProducer,
  validateStreamPermissions,
  async (req, res) => {
    try {
      const { streamId } = req.params;
      const { status } = req.body;

      if (!['active', 'paused', 'stopped'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be active, paused, or stopped',
        });
      }

      const producer = createStreamingProducer(req.producer);
      await producer.setStreamStatus(streamId, status);

      res.json({
        success: true,
        message: `Stream status set to ${status}`,
      });
    } catch (error) {
      console.error('Error updating stream status:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * POST /producer/credentials
 * Generate new producer credentials (for development)
 */
router.post('/credentials', async (req, res) => {
  try {
    const { producerId } = req.body;

    if (!producerId) {
      return res.status(400).json({
        success: false,
        error: 'Producer ID is required',
      });
    }

    const credentials = generateProducerCredentials(producerId);

    res.json({
      success: true,
      data: credentials,
    });
  } catch (error) {
    console.error('Error generating credentials:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

// Named export for server.ts compatibility
export const producerRouter = () => router;
