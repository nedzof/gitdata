"use strict";
/**
 * Producer API routes for streaming data management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.producerRouter = void 0;
const express_1 = require("express");
const producer_auth_1 = require("../middleware/producer-auth");
const streaming_producer_1 = require("../producer/streaming-producer");
const router = (0, express_1.Router)();
/**
 * POST /producer/streams
 * Create a new streaming data stream
 */
router.post('/streams', producer_auth_1.authenticateProducer, async (req, res) => {
    try {
        const { title, description, category, pricePerPacket, maxPacketsPerMinute, retentionHours, isPublic, tags, } = req.body;
        const producer = (0, streaming_producer_1.createStreamingProducer)(req.producer);
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
    }
    catch (error) {
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
router.get('/streams', producer_auth_1.authenticateProducer, async (req, res) => {
    try {
        const producer = (0, streaming_producer_1.createStreamingProducer)(req.producer);
        const streams = await producer.getStreams();
        res.json({
            success: true,
            data: streams,
        });
    }
    catch (error) {
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
router.post('/streams/:streamId/packets', producer_auth_1.authenticateProducer, producer_auth_1.validateStreamPermissions, async (req, res) => {
    try {
        const { streamId } = req.params;
        const { data, metadata } = req.body;
        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'Packet data is required',
            });
        }
        const producer = (0, streaming_producer_1.createStreamingProducer)(req.producer);
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
    }
    catch (error) {
        console.error('Error submitting packet:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * GET /producer/stats
 * Get producer statistics
 */
router.get('/stats', producer_auth_1.authenticateProducer, async (req, res) => {
    try {
        const { streamId } = req.query;
        const producer = (0, streaming_producer_1.createStreamingProducer)(req.producer);
        const stats = await producer.getProducerStats(streamId);
        res.json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
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
router.put('/streams/:streamId/config', producer_auth_1.authenticateProducer, producer_auth_1.validateStreamPermissions, async (req, res) => {
    try {
        const { streamId } = req.params;
        const updates = req.body;
        const producer = (0, streaming_producer_1.createStreamingProducer)(req.producer);
        await producer.updateStreamConfig(streamId, updates);
        res.json({
            success: true,
            message: 'Stream configuration updated',
        });
    }
    catch (error) {
        console.error('Error updating stream config:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * PUT /producer/streams/:streamId/status
 * Update stream status (pause/resume/stop)
 */
router.put('/streams/:streamId/status', producer_auth_1.authenticateProducer, producer_auth_1.validateStreamPermissions, async (req, res) => {
    try {
        const { streamId } = req.params;
        const { status } = req.body;
        if (!['active', 'paused', 'stopped'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be active, paused, or stopped',
            });
        }
        const producer = (0, streaming_producer_1.createStreamingProducer)(req.producer);
        await producer.setStreamStatus(streamId, status);
        res.json({
            success: true,
            message: `Stream status set to ${status}`,
        });
    }
    catch (error) {
        console.error('Error updating stream status:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
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
        const credentials = (0, streaming_producer_1.generateProducerCredentials)(producerId);
        res.json({
            success: true,
            data: credentials,
        });
    }
    catch (error) {
        console.error('Error generating credentials:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
exports.default = router;
// Named export for server.ts compatibility
const producerRouter = () => router;
exports.producerRouter = producerRouter;
//# sourceMappingURL=producer.js.map