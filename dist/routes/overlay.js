"use strict";
// BSV Overlay API Routes
// Provides HTTP endpoints for overlay network interaction
Object.defineProperty(exports, "__esModule", { value: true });
exports.overlayRouter = overlayRouter;
const express_1 = require("express");
const overlay_config_1 = require("../overlay/overlay-config");
function overlayRouter() {
    const router = (0, express_1.Router)();
    let overlayManager = null;
    let paymentService = null;
    // Set overlay services (called after initialization)
    function setOverlayServices(manager, payment) {
        overlayManager = manager;
        paymentService = payment;
    }
    // Middleware to check if overlay is available
    function requireOverlay(req, res, next) {
        if (!overlayManager || !overlayManager.isConnected()) {
            return res.status(503).json({
                error: 'overlay-unavailable',
                message: 'BSV overlay network is not available. Set OVERLAY_ENABLED=true and ensure wallet is connected.',
            });
        }
        next();
    }
    // Get overlay network status
    router.get('/status', (req, res) => {
        if (!overlayManager) {
            return res.json({
                enabled: false,
                connected: false,
                message: 'BSV overlay integration is disabled',
            });
        }
        const stats = overlayManager.getStats();
        res.json({
            enabled: true,
            connected: overlayManager.isConnected(),
            stats,
            environment: process.env.OVERLAY_ENV || 'development',
        });
    });
    // Subscribe to a topic
    router.post('/subscribe', requireOverlay, async (req, res) => {
        try {
            const { topic } = req.body;
            if (!topic || typeof topic !== 'string') {
                return res.status(400).json({
                    error: 'invalid-topic',
                    message: 'Topic must be a non-empty string',
                });
            }
            await overlayManager.subscribeToTopic(topic);
            res.json({
                success: true,
                topic,
                message: `Subscribed to topic: ${topic}`,
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'subscription-failed',
                message: error.message,
            });
        }
    });
    // Unsubscribe from a topic
    router.post('/unsubscribe', requireOverlay, async (req, res) => {
        try {
            const { topic } = req.body;
            if (!topic || typeof topic !== 'string') {
                return res.status(400).json({
                    error: 'invalid-topic',
                    message: 'Topic must be a non-empty string',
                });
            }
            await overlayManager.unsubscribeFromTopic(topic);
            res.json({
                success: true,
                topic,
                message: `Unsubscribed from topic: ${topic}`,
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'unsubscription-failed',
                message: error.message,
            });
        }
    });
    // Publish a D01A manifest to the overlay
    router.post('/publish', requireOverlay, async (req, res) => {
        try {
            const { manifest } = req.body;
            if (!manifest || !manifest.datasetId) {
                return res.status(400).json({
                    error: 'invalid-manifest',
                    message: 'Valid D01A manifest with datasetId is required',
                });
            }
            const messageId = await overlayManager.publishManifest(manifest);
            res.json({
                success: true,
                messageId,
                manifest: {
                    datasetId: manifest.datasetId,
                    description: manifest.description,
                },
                message: 'Manifest published to overlay network',
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'publish-failed',
                message: error.message,
            });
        }
    });
    // Search for data on the overlay network
    router.post('/search', requireOverlay, async (req, res) => {
        try {
            const query = req.body;
            if (!query || typeof query !== 'object') {
                return res.status(400).json({
                    error: 'invalid-query',
                    message: 'Search query object is required',
                });
            }
            // Initiate search (results come via events)
            await overlayManager.searchData(query);
            // Return immediate response - results will be available via events
            res.json({
                success: true,
                query,
                message: 'Search request sent to overlay network. Results will be available via events or cached responses.',
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'search-failed',
                message: error.message,
            });
        }
    });
    // Get available topics
    router.get('/topics', (req, res) => {
        const standardTopics = Object.entries(overlay_config_1.D01A_TOPICS).map(([key, value]) => ({
            name: key,
            topic: value,
            description: getTopicDescription(key),
        }));
        res.json({
            standardTopics,
            subscribedTopics: overlayManager ? overlayManager.getStats().subscriptions : {},
            dynamicTopics: {
                dataset: 'Use TopicGenerator.datasetTopic(datasetId, classification)',
                model: 'Use TopicGenerator.modelTopic(modelId, purpose)',
                agent: 'Use TopicGenerator.agentTopic(agentId, purpose)',
                payment: 'Use TopicGenerator.paymentTopic(receiptId)',
            },
        });
    });
    // Payment Routes (if payment service is available)
    // Request a payment quote
    router.post('/payments/quote', requireOverlay, async (req, res) => {
        try {
            if (!paymentService) {
                return res.status(503).json({
                    error: 'payment-service-unavailable',
                    message: 'Payment service is not available',
                });
            }
            const { versionId, quantity = 1 } = req.body;
            if (!versionId) {
                return res.status(400).json({
                    error: 'invalid-request',
                    message: 'versionId is required',
                });
            }
            await paymentService.requestPaymentQuote(versionId, quantity);
            res.json({
                success: true,
                message: 'Payment quote requested. Monitor overlay events for response.',
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'quote-request-failed',
                message: error.message,
            });
        }
    });
    // Submit a payment
    router.post('/payments/submit', requireOverlay, async (req, res) => {
        try {
            if (!paymentService) {
                return res.status(503).json({
                    error: 'payment-service-unavailable',
                    message: 'Payment service is not available',
                });
            }
            const { quoteId } = req.body;
            if (!quoteId) {
                return res.status(400).json({
                    error: 'invalid-request',
                    message: 'quoteId is required',
                });
            }
            const receipt = await paymentService.submitPayment(quoteId);
            res.json({
                success: true,
                receipt,
                message: 'Payment submitted successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'payment-submit-failed',
                message: error.message,
            });
        }
    });
    // Get payment statistics
    router.get('/payments/stats', requireOverlay, async (req, res) => {
        try {
            if (!paymentService) {
                return res.status(503).json({
                    error: 'payment-service-unavailable',
                    message: 'Payment service is not available',
                });
            }
            const stats = paymentService.getPaymentStats();
            res.json({
                success: true,
                stats,
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'stats-failed',
                message: error.message,
            });
        }
    });
    // Get overlay peers
    router.get('/peers', requireOverlay, (req, res) => {
        try {
            const peers = overlayManager.getStats().peers;
            res.json({
                success: true,
                peers,
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'peers-failed',
                message: error.message,
            });
        }
    });
    // Health check endpoint
    router.get('/health', (req, res) => {
        const isHealthy = overlayManager ? overlayManager.isConnected() : false;
        res.status(isHealthy ? 200 : 503).json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            enabled: !!overlayManager,
            connected: isHealthy,
            timestamp: Date.now(),
        });
    });
    return {
        router,
        setOverlayServices,
    };
}
/**
 * Get human-readable description for a topic
 */
function getTopicDescription(topicKey) {
    const descriptions = {
        DATA_MANIFEST: 'D01A manifest publishing and discovery',
        DATA_CONTENT: 'Data content distribution (restricted)',
        DATA_METADATA: 'Data metadata and descriptions',
        DATASET_PUBLIC: 'Public dataset announcements',
        DATASET_COMMERCIAL: 'Commercial dataset offerings',
        DATASET_RESEARCH: 'Research dataset sharing',
        DATASET_INTERNAL: 'Internal dataset management',
        MODEL_WEIGHTS: 'AI model weight distribution',
        MODEL_INFERENCE: 'AI model inference services',
        MODEL_TRAINING: 'AI model training coordination',
        AGENT_REGISTRY: 'Agent capability announcements',
        AGENT_CAPABILITIES: 'Agent capability descriptions',
        AGENT_JOBS: 'Agent job coordination',
        AGENT_RESULTS: 'Agent execution results',
        PAYMENT_QUOTES: 'Payment quote requests and responses',
        PAYMENT_RECEIPTS: 'Payment receipt confirmations',
        PAYMENT_DISPUTES: 'Payment dispute resolution',
        LINEAGE_GRAPH: 'Data lineage graph updates',
        LINEAGE_EVENTS: 'Lineage tracking events',
        PROVENANCE_CHAIN: 'Data provenance chain',
        SEARCH_QUERIES: 'Data discovery search queries',
        SEARCH_RESULTS: 'Search result responses',
        SEARCH_INDEX: 'Search index management',
        ALERT_POLICY: 'Policy violation alerts',
        ALERT_QUALITY: 'Data quality alerts',
        ALERT_SECURITY: 'Security incident alerts',
        POLICY_UPDATES: 'Policy governance updates',
        GOVERNANCE_VOTES: 'Governance voting activities',
        COMPLIANCE_REPORTS: 'Compliance status reports',
    };
    return descriptions[topicKey] || 'Custom overlay topic';
}
//# sourceMappingURL=overlay.js.map