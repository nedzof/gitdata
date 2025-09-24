/**
 * Real-time Overlay Packet Streaming Service
 *
 * Handles real-time data packet streaming with BSV confirmation tracking,
 * webhook delivery, and WebSocket broadcasting.
 */
export interface RealtimePacket {
    id: string;
    version_id: string;
    packet_sequence: number;
    packet_timestamp: Date;
    txid: string;
    overlay_data: Buffer;
    data_hash: string;
    confirmation_status: 'pending' | 'confirmed' | 'failed';
    confirmations: number;
    block_height?: number;
    confirmed_at?: Date;
    data_payload: any;
    data_size_bytes: number;
    producer_public_key: string;
    created_at: Date;
}
export interface StreamWebhook {
    id: string;
    version_id: string;
    webhook_url: string;
    webhook_secret?: string;
    subscriber_id: string;
    delivery_mode: 'confirmed' | 'immediate' | 'both';
    min_confirmations: number;
    batch_size: number;
    status: 'active' | 'paused' | 'failed';
    last_delivery?: Date;
    total_deliveries: number;
    failed_deliveries: number;
}
export interface StreamWebsocket {
    id: string;
    connection_id: string;
    version_id: string;
    subscriber_id?: string;
    delivery_mode: 'confirmed' | 'immediate' | 'both';
    last_packet_sent: number;
    connected_at: Date;
    last_ping: Date;
    packets_sent: number;
    status: 'active' | 'disconnected';
}
export declare class RealtimeStreamingService {
    private db;
    /**
     * Ingest a new data packet from a producer
     */
    ingestPacket(data: {
        version_id: string;
        packet_sequence: number;
        txid: string;
        overlay_data: Buffer;
        data_payload: any;
        producer_public_key: string;
    }): Promise<RealtimePacket>;
    /**
     * Update packet confirmation status
     */
    updatePacketConfirmation(txid: string, confirmations: number, block_height?: number): Promise<void>;
    /**
     * Deliver packet to subscribers based on delivery mode
     */
    private deliverPacket;
    /**
     * Get webhooks that should receive this delivery
     */
    private getWebhooksForDelivery;
    /**
     * Get WebSocket connections that should receive this delivery
     */
    private getWebsocketsForDelivery;
    /**
     * Deliver packet to webhook using existing streaming delivery
     */
    private deliverToWebhook;
    /**
     * Deliver packet to WebSocket connection (placeholder for overlay-based WSS)
     */
    private deliverToWebsocket;
    /**
     * Deliver packet to agent subscriptions
     */
    private deliverToAgents;
    /**
     * Check if packet should trigger agent processing
     */
    private shouldTriggerAgent;
    /**
     * Notify agent of new packet using existing streaming delivery
     */
    private notifyAgent;
    /**
     * Subscribe webhook to stream
     */
    subscribeWebhook(data: {
        version_id: string;
        webhook_url: string;
        webhook_secret?: string;
        subscriber_id: string;
        delivery_mode?: 'confirmed' | 'immediate' | 'both';
        min_confirmations?: number;
        batch_size?: number;
    }): Promise<StreamWebhook>;
    /**
     * Register WebSocket connection
     */
    registerWebsocket(data: {
        connection_id: string;
        version_id: string;
        subscriber_id?: string;
        delivery_mode?: 'confirmed' | 'immediate' | 'both';
    }): Promise<StreamWebsocket>;
    /**
     * Subscribe agent to stream
     */
    subscribeAgent(data: {
        version_id: string;
        agent_id: string;
        processing_mode?: 'realtime' | 'batch';
        trigger_conditions?: any;
        agent_webhook_url?: string;
    }): Promise<any>;
    /**
     * Get stream statistics
     */
    getStreamStats(version_id: string): Promise<any>;
    /**
     * Get recent packets for a stream
     */
    getRecentPackets(version_id: string, limit?: number): Promise<RealtimePacket[]>;
}
export declare const realtimeStreamingService: RealtimeStreamingService;
