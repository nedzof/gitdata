"use strict";
/**
 * BSV Overlay Network Streaming Producer SDK
 *
 * Provides functionality for producers to create and submit streaming data packets
 * with BSV microtransaction support, validation, and rate limiting.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamingProducer = void 0;
exports.createStreamingProducer = createStreamingProducer;
exports.generateProducerCredentials = generateProducerCredentials;
const crypto_1 = __importDefault(require("crypto"));
const sdk_1 = require("@bsv/sdk");
const hybrid_1 = require("../db/hybrid");
const realtime_streaming_1 = require("../services/realtime-streaming");
class StreamingProducer {
    constructor(credentials) {
        this.db = (0, hybrid_1.getHybridDatabase)();
        this.rateLimiter = new Map();
        this.credentials = credentials;
    }
    /**
     * Create a new streaming data stream
     */
    async createStream(config) {
        // Validate producer authorization
        await this.validateProducer();
        // Create manifest entry for the stream
        const manifest = await this.db.pg.query(`
      INSERT INTO manifests (
        title, description, category, version_id, dataset_id,
        is_streaming, stream_config, producer_public_key, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
            config.title,
            config.description,
            config.category,
            config.streamId,
            `stream-${config.streamId}`,
            true,
            JSON.stringify({
                pricePerPacket: config.pricePerPacket,
                maxPacketsPerMinute: config.maxPacketsPerMinute,
                retentionHours: config.retentionHours,
                isPublic: config.isPublic,
            }),
            this.credentials.publicKey,
            this.credentials.producerId,
        ]);
        // Create stream metadata
        await this.db.pg.query(`
      INSERT INTO stream_metadata (
        version_id, producer_id, status, tags, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [config.streamId, this.credentials.producerId, 'active', JSON.stringify(config.tags)]);
        console.log(`📡 Created streaming data stream: ${config.streamId}`);
        return manifest.rows[0];
    }
    /**
     * Submit a data packet to the stream
     */
    async submitPacket(submission) {
        // Rate limiting check
        await this.checkRateLimit(submission.streamId);
        // Get stream configuration
        const stream = await this.getStreamConfig(submission.streamId);
        if (!stream) {
            throw new Error(`Stream ${submission.streamId} not found`);
        }
        // Validate packet data
        this.validatePacketData(submission.data);
        // Get next sequence number
        const sequenceNumber = await this.getNextSequenceNumber(submission.streamId);
        // Create BSV microtransaction
        const txid = await this.createMicrotransaction(submission.streamId, sequenceNumber, stream.stream_config.pricePerPacket);
        // Prepare packet data
        const packetData = {
            ...submission.data,
            metadata: {
                timestamp: submission.metadata?.timestamp || new Date(),
                priority: submission.metadata?.priority || 'normal',
                tags: submission.metadata?.tags || [],
                producerId: this.credentials.producerId,
                streamId: submission.streamId,
            },
        };
        // Submit packet to realtime streaming service
        const packet = await realtime_streaming_1.realtimeStreamingService.ingestPacket({
            version_id: submission.streamId,
            packet_sequence: sequenceNumber,
            txid: txid,
            overlay_data: Buffer.from(JSON.stringify(packetData)),
            data_payload: packetData,
            producer_public_key: this.credentials.publicKey,
        });
        // Update producer statistics
        await this.updateProducerStats(submission.streamId, packet);
        console.log(`📊 Submitted packet ${sequenceNumber} to stream ${submission.streamId}`);
        return packet;
    }
    /**
     * Get producer statistics
     */
    async getProducerStats(streamId) {
        const whereClause = streamId
            ? 'WHERE rp.version_id = $2 AND rp.producer_public_key = $1'
            : 'WHERE rp.producer_public_key = $1';
        const params = streamId ? [this.credentials.publicKey, streamId] : [this.credentials.publicKey];
        const result = await this.db.pg.query(`
      SELECT
        COUNT(*) as total_packets,
        COUNT(*) FILTER (WHERE DATE(rp.created_at) = CURRENT_DATE) as packets_today,
        AVG(rp.data_size_bytes) as avg_packet_size,
        MAX(rp.created_at) as last_packet_at,
        SUM(COALESCE(sm.price_per_packet, 0)) as total_revenue
      FROM realtime_packets rp
      LEFT JOIN stream_metadata sm ON rp.version_id = sm.version_id
      ${whereClause}
    `, params);
        const subscribers = await this.db.pg.query(`
      SELECT COUNT(DISTINCT subscriber_id) as active_subscribers
      FROM stream_webhooks sw
      JOIN manifests m ON sw.version_id = m.version_id
      WHERE m.producer_public_key = $1 AND sw.status = 'active'
    `, [this.credentials.publicKey]);
        const stats = result.rows[0];
        return {
            totalPackets: parseInt(stats.total_packets) || 0,
            packetsToday: parseInt(stats.packets_today) || 0,
            totalRevenue: parseFloat(stats.total_revenue) || 0,
            activeSubscribers: parseInt(subscribers.rows[0]?.active_subscribers) || 0,
            avgPacketSize: parseFloat(stats.avg_packet_size) || 0,
            lastPacketAt: stats.last_packet_at,
        };
    }
    /**
     * Get list of producer's streams
     */
    async getStreams() {
        const result = await this.db.pg.query(`
      SELECT
        m.*,
        sm.status as stream_status,
        sm.tags,
        COUNT(rp.id) as total_packets,
        MAX(rp.created_at) as last_packet_at
      FROM assets m
      LEFT JOIN stream_metadata sm ON m.version_id = sm.version_id
      LEFT JOIN realtime_packets rp ON m.version_id = rp.version_id
      WHERE m.producer_public_key = $1 AND m.is_streaming = true
      GROUP BY m.id, sm.status, sm.tags
      ORDER BY m.created_at DESC
    `, [this.credentials.publicKey]);
        return result.rows;
    }
    /**
     * Update stream configuration
     */
    async updateStreamConfig(streamId, updates) {
        const stream = await this.getStreamConfig(streamId);
        if (!stream) {
            throw new Error(`Stream ${streamId} not found`);
        }
        if (stream.producer_public_key !== this.credentials.publicKey) {
            throw new Error('Unauthorized to update this stream');
        }
        const newConfig = {
            ...JSON.parse(stream.stream_config),
            ...updates,
        };
        await this.db.pg.query(`
      UPDATE manifests
      SET stream_config = $1, title = COALESCE($2, title), description = COALESCE($3, description)
      WHERE version_id = $4
    `, [JSON.stringify(newConfig), updates.title, updates.description, streamId]);
        console.log(`⚙️ Updated stream configuration for ${streamId}`);
    }
    /**
     * Pause or resume stream
     */
    async setStreamStatus(streamId, status) {
        await this.db.pg.query(`
      UPDATE stream_metadata
      SET status = $1
      WHERE version_id = $2 AND producer_id = $3
    `, [status, streamId, this.credentials.producerId]);
        console.log(`🔄 Set stream ${streamId} status to ${status}`);
    }
    // Private helper methods
    async validateProducer() {
        // Check if producer exists and is authorized
        const result = await this.db.pg.query(`
      SELECT id FROM producers WHERE public_key = $1 AND status = 'active'
    `, [this.credentials.publicKey]);
        if (result.rows.length === 0) {
            throw new Error('Producer not found or not authorized');
        }
    }
    async checkRateLimit(streamId) {
        const stream = await this.getStreamConfig(streamId);
        if (!stream)
            return;
        const config = JSON.parse(stream.stream_config);
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute
        const key = `${streamId}:${this.credentials.producerId}`;
        const timestamps = this.rateLimiter.get(key) || [];
        // Remove old timestamps
        const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);
        if (validTimestamps.length >= config.maxPacketsPerMinute) {
            throw new Error(`Rate limit exceeded: ${config.maxPacketsPerMinute} packets per minute`);
        }
        validTimestamps.push(now);
        this.rateLimiter.set(key, validTimestamps);
    }
    validatePacketData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Packet data must be a valid object');
        }
        const serialized = JSON.stringify(data);
        if (serialized.length > 1024 * 1024) {
            // 1MB limit
            throw new Error('Packet data exceeds 1MB limit');
        }
    }
    async getStreamConfig(streamId) {
        const result = await this.db.pg.query(`
      SELECT * FROM assets WHERE version_id = $1 AND is_streaming = true
    `, [streamId]);
        return result.rows[0];
    }
    async getNextSequenceNumber(streamId) {
        const result = await this.db.pg.query(`
      SELECT COALESCE(MAX(packet_sequence), 0) + 1 as next_seq
      FROM realtime_packets WHERE version_id = $1
    `, [streamId]);
        return result.rows[0].next_seq;
    }
    async createMicrotransaction(streamId, sequenceNumber, pricePerPacket) {
        // For now, return a mock transaction ID
        // In production, this would create actual BSV microtransactions
        const txData = `${streamId}-${sequenceNumber}-${Date.now()}`;
        const txid = crypto_1.default.createHash('sha256').update(txData).digest('hex');
        console.log(`💰 Created microtransaction ${txid} for ${pricePerPacket} satoshis`);
        return txid;
    }
    async updateProducerStats(streamId, packet) {
        // Update stream metadata with latest stats
        await this.db.pg.query(`
      INSERT INTO stream_metadata (version_id, producer_id, last_packet_sequence, last_packet_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (version_id, producer_id)
      DO UPDATE SET
        last_packet_sequence = EXCLUDED.last_packet_sequence,
        last_packet_at = EXCLUDED.last_packet_at
    `, [streamId, this.credentials.producerId, packet.packet_sequence]);
    }
}
exports.StreamingProducer = StreamingProducer;
/**
 * Factory function to create a streaming producer instance
 */
function createStreamingProducer(credentials) {
    return new StreamingProducer(credentials);
}
/**
 * Generate producer credentials (for development/testing)
 */
function generateProducerCredentials(producerId) {
    const privateKey = sdk_1.BSV.PrivateKey.fromRandom();
    const publicKey = privateKey.toPublicKey();
    return {
        privateKey: privateKey.toString(),
        publicKey: publicKey.toString(),
        producerId: producerId,
    };
}
//# sourceMappingURL=streaming-producer.js.map