/**
 * BSV Overlay Network Streaming Producer SDK
 *
 * Provides functionality for producers to create and submit streaming data packets
 * with BSV microtransaction support, validation, and rate limiting.
 */
export interface StreamConfig {
    streamId: string;
    title: string;
    description: string;
    category: string;
    pricePerPacket: number;
    maxPacketsPerMinute: number;
    retentionHours: number;
    isPublic: boolean;
    tags: string[];
}
export interface ProducerCredentials {
    privateKey: string;
    publicKey: string;
    producerId: string;
}
export interface PacketSubmission {
    streamId: string;
    data: any;
    metadata?: {
        timestamp?: Date;
        priority?: 'low' | 'normal' | 'high';
        tags?: string[];
    };
}
export interface ProducerStats {
    totalPackets: number;
    packetsToday: number;
    totalRevenue: number;
    activeSubscribers: number;
    avgPacketSize: number;
    lastPacketAt?: Date;
}
export declare class StreamingProducer {
    private db;
    private credentials;
    private rateLimiter;
    constructor(credentials: ProducerCredentials);
    /**
     * Create a new streaming data stream
     */
    createStream(config: StreamConfig): Promise<any>;
    /**
     * Submit a data packet to the stream
     */
    submitPacket(submission: PacketSubmission): Promise<any>;
    /**
     * Get producer statistics
     */
    getProducerStats(streamId?: string): Promise<ProducerStats>;
    /**
     * Get list of producer's streams
     */
    getStreams(): Promise<any[]>;
    /**
     * Update stream configuration
     */
    updateStreamConfig(streamId: string, updates: Partial<StreamConfig>): Promise<void>;
    /**
     * Pause or resume stream
     */
    setStreamStatus(streamId: string, status: 'active' | 'paused' | 'stopped'): Promise<void>;
    private validateProducer;
    private checkRateLimit;
    private validatePacketData;
    private getStreamConfig;
    private getNextSequenceNumber;
    private createMicrotransaction;
    private updateProducerStats;
}
/**
 * Factory function to create a streaming producer instance
 */
export declare function createStreamingProducer(credentials: ProducerCredentials): StreamingProducer;
/**
 * Generate producer credentials (for development/testing)
 */
export declare function generateProducerCredentials(producerId: string): ProducerCredentials;
