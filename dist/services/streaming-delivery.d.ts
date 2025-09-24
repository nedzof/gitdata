/**
 * D07 BSV Overlay Network Streaming Content Delivery Service
 * Handles webhook-based content delivery with quota enforcement
 */
export interface StreamingSubscription {
    receiptId: string;
    webhookUrl: string;
    agentId?: string;
    contentHash: string;
    deliveryConfig: {
        chunkSize?: number;
        compressionEnabled?: boolean;
        maxRetries?: number;
        retryDelayMs?: number;
    };
}
export interface DeliveryResult {
    success: boolean;
    bytesDelivered: number;
    deliveryTime: number;
    error?: string;
    hostUsed?: string;
}
/**
 * Deliver content to a webhook with streaming quota enforcement
 */
export declare function deliverContentToWebhook(subscription: StreamingSubscription, contentData: Buffer | string): Promise<DeliveryResult>;
/**
 * Set up streaming subscription for content purchased in market
 */
export declare function createStreamingSubscription(receiptId: string, webhookUrl: string, contentHash: string, agentId?: string): Promise<string>;
/**
 * Handle market purchase with streaming integration
 */
export declare function handleMarketPurchaseWithStreaming(receiptId: string, versionId: string, webhookUrl?: string, agentId?: string): Promise<void>;
declare const _default: {
    deliverContentToWebhook: typeof deliverContentToWebhook;
    createStreamingSubscription: typeof createStreamingSubscription;
    handleMarketPurchaseWithStreaming: typeof handleMarketPurchaseWithStreaming;
};
export default _default;
