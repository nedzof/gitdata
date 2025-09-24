"use strict";
/**
 * Streaming Market API routes for marketplace integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamingMarketRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const hybrid_1 = require("../db/hybrid");
const realtime_streaming_1 = require("../services/realtime-streaming");
const router = (0, express_1.Router)();
/**
 * GET /streaming-market/streams
 * Get list of available streaming packages
 */
router.get('/streams', async (req, res) => {
    try {
        const { category, priceRange, isActive, search, limit = 20, offset = 0 } = req.query;
        // Use the searchManifests function for basic asset search
        const searchQuery = search;
        const assets = await (0, db_1.searchManifests)(searchQuery, parseInt(limit), parseInt(offset));
        // For now, return basic asset data - streaming metadata would need specific functions
        // TODO: Add streaming-specific search functions to database layer
        const streams = assets.map((asset) => ({
            ...asset,
            stream_status: 'active', // Default for now
            total_packets: 0,
            packets_today: 0,
            active_subscribers: 0,
            latest_sequence: 0,
            avg_packet_size: 0,
        }));
        res.json({
            success: true,
            data: {
                streams,
                pagination: {
                    total: streams.length,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: false, // TODO: Implement proper pagination
                },
            },
        });
    }
    catch (error) {
        console.error('Error fetching streaming market:', error);
        res.status(500).json({
            success: false,
            error: error.message,
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
        const db = (0, hybrid_1.getHybridDatabase)();
        // Get basic asset info using database abstraction
        const stream = await db.getAsset(streamId);
        if (!stream) {
            return res.status(404).json({
                success: false,
                error: 'Stream not found',
            });
        }
        // Get recent packets and stats using the streaming service
        const recentPackets = await realtime_streaming_1.realtimeStreamingService.getRecentPackets(streamId, 5);
        const stats = await realtime_streaming_1.realtimeStreamingService.getStreamStats(streamId);
        res.json({
            success: true,
            data: {
                stream: {
                    ...stream,
                    stream_status: 'active', // Default for now
                    total_packets: parseInt(stats.total_packets) || 0,
                    packets_today: 0, // TODO: Calculate from recent packets
                    active_subscribers: 0, // TODO: Get from database
                },
                stats,
                recentPackets: recentPackets.map((p) => ({
                    sequence: p.packet_sequence,
                    timestamp: p.packet_timestamp,
                    confirmations: p.confirmations,
                    status: p.confirmation_status,
                    size: p.data_size_bytes,
                })),
            },
        });
    }
    catch (error) {
        console.error('Error fetching stream details:', error);
        res.status(500).json({
            success: false,
            error: error.message,
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
                error: 'Webhook URL and subscriber ID are required',
            });
        }
        const webhook = await realtime_streaming_1.realtimeStreamingService.subscribeWebhook({
            version_id: streamId,
            webhook_url: webhookUrl,
            subscriber_id: subscriberId,
            delivery_mode: deliveryMode,
            min_confirmations: minConfirmations,
        });
        res.json({
            success: true,
            data: {
                webhookId: webhook.id,
                message: 'Successfully subscribed to stream',
            },
        });
    }
    catch (error) {
        console.error('Error subscribing to stream:', error);
        res.status(500).json({
            success: false,
            error: error.message,
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
                error: 'Agent ID is required',
            });
        }
        const subscription = await realtime_streaming_1.realtimeStreamingService.subscribeAgent({
            version_id: streamId,
            agent_id: agentId,
            processing_mode: processingMode,
            trigger_conditions: triggerConditions,
            agent_webhook_url: agentWebhookUrl,
        });
        res.json({
            success: true,
            data: {
                subscriptionId: subscription.id,
                message: 'AI agent successfully subscribed to stream',
            },
        });
    }
    catch (error) {
        console.error('Error subscribing agent to stream:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * GET /streaming-market/stats
 * Get overall marketplace statistics
 */
router.get('/stats', async (req, res) => {
    try {
        // Get basic stats using available database functions
        const allAssets = await (0, db_1.searchManifests)(undefined, 1000, 0); // Get a large sample
        // Basic stats calculation
        const totalStreams = allAssets.length;
        const activeStreams = totalStreams; // Assume all are active for now
        res.json({
            success: true,
            data: {
                overview: {
                    totalStreams,
                    activeStreams,
                    totalPackets: 0, // TODO: Aggregate from streaming service
                    packetsToday: 0, // TODO: Calculate from recent data
                    totalSubscribers: 0, // TODO: Get from database
                    totalRevenue: 0, // TODO: Calculate from revenue events
                },
                categories: [], // TODO: Add category aggregation
            },
        });
    }
    catch (error) {
        console.error('Error fetching marketplace stats:', error);
        res.status(500).json({
            success: false,
            error: error.message,
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
        const stats = await realtime_streaming_1.realtimeStreamingService.getStreamStats(streamId);
        const recentPackets = await realtime_streaming_1.realtimeStreamingService.getRecentPackets(streamId, 1);
        const liveStats = {
            totalPackets: parseInt(stats.total_packets) || 0,
            confirmedPackets: parseInt(stats.confirmed_packets) || 0,
            pendingPackets: parseInt(stats.pending_packets) || 0,
            latestSequence: parseInt(stats.latest_sequence) || 0,
            avgPacketSize: parseFloat(stats.avg_packet_size) || 0,
            lastPacketAt: recentPackets[0]?.packet_timestamp || null,
            isActive: recentPackets.length > 0 &&
                new Date().getTime() - new Date(recentPackets[0].packet_timestamp).getTime() < 300000, // 5 minutes
        };
        res.json({
            success: true,
            data: liveStats,
        });
    }
    catch (error) {
        console.error('Error fetching live stats:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
exports.default = router;
// Named export for server.ts compatibility
const streamingMarketRouter = () => router;
exports.streamingMarketRouter = streamingMarketRouter;
//# sourceMappingURL=streaming-market.js.map