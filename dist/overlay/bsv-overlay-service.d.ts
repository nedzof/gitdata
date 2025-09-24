import { EventEmitter } from 'events';
export interface OverlayConfig {
    topics: string[];
    advertiseTopics: string[];
    peerDiscovery: {
        lookupServices: string[];
        timeout: number;
    };
    nodeIdentity?: {
        privateKey?: string;
        publicKey?: string;
    };
    network: 'mainnet' | 'testnet' | 'regtest';
}
export interface D01AData {
    asset: {
        datasetId: string;
        description: string;
        provenance: {
            createdAt: string;
            issuer: string;
        };
        policy: {
            license: string;
            classification: string;
        };
        content: {
            contentHash: string;
            mediaType: string;
            sizeBytes: number;
            url: string;
        };
        parents: string[];
        tags: string[];
    };
    manifest?: {
        datasetId: string;
        description: string;
        provenance: {
            createdAt: string;
            issuer: string;
        };
        policy: {
            license: string;
            classification: string;
        };
        content: {
            contentHash: string;
            mediaType: string;
            sizeBytes: number;
            url: string;
        };
        parents: string[];
        tags: string[];
    };
}
export interface OverlayMessage {
    type: 'publish' | 'subscribe' | 'data' | 'request';
    topic: string;
    data: any;
    timestamp: number;
    signature?: string;
    publicKey?: string;
}
declare class BSVOverlayService extends EventEmitter {
    private overlay;
    private config;
    private isConnected;
    private subscribedTopics;
    private publishedTopics;
    constructor(config: OverlayConfig);
    /**
     * Initialize the overlay connection
     */
    initialize(): Promise<void>;
    /**
     * Set up overlay event handlers
     */
    private setupEventHandlers;
    /**
     * Handle incoming overlay messages
     */
    private handleIncomingMessage;
    /**
     * Subscribe to a topic for receiving data
     */
    subscribeToTopic(topic: string): Promise<void>;
    /**
     * Unsubscribe from a topic
     */
    unsubscribeFromTopic(topic: string): Promise<void>;
    /**
     * Publish D01A-compliant data to the overlay
     */
    publishD01AData(topic: string, data: D01AData): Promise<string>;
    /**
     * Request specific data from the overlay network
     */
    requestData(topic: string, query: any): Promise<void>;
    /**
     * Send data in response to a request
     */
    sendData(topic: string, data: any, recipient?: string): Promise<void>;
    /**
     * Publish a message to the overlay network
     */
    private publishMessage;
    /**
     * Generate a unique message ID
     */
    private generateMessageId;
    /**
     * Get connected peers
     */
    getConnectedPeers(): string[];
    /**
     * Get subscribed topics
     */
    getSubscribedTopics(): string[];
    /**
     * Get published topics
     */
    getPublishedTopics(): string[];
    /**
     * Check if overlay is connected
     */
    isOverlayConnected(): boolean;
    /**
     * Get overlay statistics
     */
    getStats(): {
        connected: boolean;
        peers: number;
        subscribedTopics: number;
        publishedTopics: number;
        messagesSent: number;
        messagesReceived: number;
    };
    /**
     * Disconnect from overlay network
     */
    disconnect(): Promise<void>;
    /**
     * Reconnect to overlay network
     */
    reconnect(): Promise<void>;
}
export { BSVOverlayService };
