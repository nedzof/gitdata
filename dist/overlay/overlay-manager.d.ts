import { EventEmitter } from 'events';
import type { DatabaseAdapter } from './brc26-uhrp';
export interface OverlayManagerConfig {
    environment: 'development' | 'staging' | 'production';
    database: DatabaseAdapter;
    autoConnect: boolean;
    enablePaymentIntegration: boolean;
    enableSearchIntegration: boolean;
}
export interface OverlayDataEvent {
    topic: string;
    data: any;
    sender: string;
    timestamp: number;
    messageId: string;
}
declare class OverlayManager extends EventEmitter {
    private overlayService;
    private subscriptionManager;
    private config;
    private database;
    private isInitialized;
    constructor(config: OverlayManagerConfig);
    /**
     * Initialize overlay manager
     */
    initialize(): Promise<void>;
    /**
     * Set up database tables for overlay data
     */
    private setupDatabaseTables;
    /**
     * Set up overlay service event handlers
     */
    private setupOverlayEventHandlers;
    /**
     * Set up default topic subscriptions based on environment
     */
    private setupDefaultSubscriptions;
    /**
     * Subscribe to a topic
     */
    subscribeToTopic(topic: string, autoSubscribe?: boolean): Promise<void>;
    /**
     * Unsubscribe from a topic
     */
    unsubscribeFromTopic(topic: string): Promise<void>;
    /**
     * Publish D01A asset to overlay network
     */
    publishAsset(asset: any): Promise<string>;
    /**
     * @deprecated Use publishAsset instead
     * Backward compatibility method for publishManifest
     */
    publishManifest(manifest: any): Promise<string>;
    /**
     * Search for data on overlay network
     */
    searchData(query: {
        datasetId?: string;
        classification?: string;
        tags?: string[];
        mediaType?: string;
        limit?: number;
    }): Promise<any[]>;
    /**
     * Handle incoming overlay data
     */
    private handleIncomingData;
    /**
     * Handle data published events
     */
    private handleDataPublished;
    /**
     * Handle data request events
     */
    private handleDataRequest;
    /**
     * Handle search requests from other nodes
     */
    private handleSearchRequest;
    /**
     * Search local database for matching data
     */
    private searchLocalData;
    /**
     * Process data based on topic type
     */
    private processTopicData;
    /**
     * Process incoming asset data
     */
    private processAssetData;
    /**
     * Process search results
     */
    private processSearchResults;
    /**
     * Process agent-related data
     */
    private processAgentData;
    /**
     * Process payment-related data
     */
    private processPaymentData;
    /**
     * Handle peer connected
     */
    private handlePeerConnected;
    /**
     * Handle peer disconnected
     */
    private handlePeerDisconnected;
    /**
     * Get cached search results
     */
    private getCachedSearchResults;
    /**
     * Generate message ID
     */
    private generateMessageId;
    /**
     * Get overlay statistics
     */
    getStats(): Promise<{
        overlay: any;
        subscriptions: any;
        messages: {
            total: number;
            recent: number;
        };
        peers: {
            total: number;
            active: number;
        };
    }>;
    /**
     * Check if overlay is connected
     */
    isConnected(): boolean;
    /**
     * Disconnect from overlay
     */
    disconnect(): Promise<void>;
    /**
     * Reconnect to overlay
     */
    reconnect(): Promise<void>;
}
export { OverlayManager };
