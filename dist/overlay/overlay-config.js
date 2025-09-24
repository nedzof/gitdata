"use strict";
// BSV Overlay Configuration
// Manages overlay topics, subscriptions, and network configuration
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopicSubscriptionManager = exports.TopicGenerator = exports.TOPIC_CLASSIFICATION = exports.D01A_TOPICS = void 0;
exports.getOverlayConfig = getOverlayConfig;
/**
 * Standard D01A topics for data discovery and publishing
 */
exports.D01A_TOPICS = {
    // Data publishing and discovery
    DATA_ASSET: 'gitdata.d01a.asset',
    DATA_MANIFEST: 'gitdata.d01a.manifest', // Deprecated: use DATA_ASSET
    DATA_CONTENT: 'gitdata.d01a.content',
    DATA_METADATA: 'gitdata.d01a.metadata',
    // Dataset-specific topics
    DATASET_PUBLIC: 'gitdata.dataset.public',
    DATASET_COMMERCIAL: 'gitdata.dataset.commercial',
    DATASET_RESEARCH: 'gitdata.dataset.research',
    DATASET_INTERNAL: 'gitdata.dataset.internal',
    // AI Model topics
    MODEL_WEIGHTS: 'gitdata.model.weights',
    MODEL_INFERENCE: 'gitdata.model.inference',
    MODEL_TRAINING: 'gitdata.model.training',
    // Agent marketplace topics
    AGENT_REGISTRY: 'gitdata.agent.registry',
    AGENT_CAPABILITIES: 'gitdata.agent.capabilities',
    AGENT_JOBS: 'gitdata.agent.jobs',
    AGENT_RESULTS: 'gitdata.agent.results',
    // Payment and transaction topics
    PAYMENT_QUOTES: 'gitdata.payment.quotes',
    PAYMENT_RECEIPTS: 'gitdata.payment.receipts',
    PAYMENT_DISPUTES: 'gitdata.payment.disputes',
    // Lineage and provenance
    LINEAGE_GRAPH: 'gitdata.lineage.graph',
    LINEAGE_EVENTS: 'gitdata.lineage.events',
    PROVENANCE_CHAIN: 'gitdata.provenance.chain',
    // Content discovery
    SEARCH_QUERIES: 'gitdata.search.queries',
    SEARCH_RESULTS: 'gitdata.search.results',
    SEARCH_INDEX: 'gitdata.search.index',
    // Notifications and alerts
    ALERT_POLICY: 'gitdata.alert.policy',
    ALERT_QUALITY: 'gitdata.alert.quality',
    ALERT_SECURITY: 'gitdata.alert.security',
    // Governance and policies
    POLICY_UPDATES: 'gitdata.policy.updates',
    GOVERNANCE_VOTES: 'gitdata.governance.votes',
    COMPLIANCE_REPORTS: 'gitdata.compliance.reports',
};
/**
 * Topic classification and access control
 */
exports.TOPIC_CLASSIFICATION = {
    [exports.D01A_TOPICS.DATA_ASSET]: 'public',
    [exports.D01A_TOPICS.DATA_MANIFEST]: 'public', // Deprecated: keep for backward compatibility
    [exports.D01A_TOPICS.DATA_CONTENT]: 'restricted',
    [exports.D01A_TOPICS.DATA_METADATA]: 'public',
    [exports.D01A_TOPICS.DATASET_PUBLIC]: 'public',
    [exports.D01A_TOPICS.DATASET_COMMERCIAL]: 'commercial',
    [exports.D01A_TOPICS.DATASET_RESEARCH]: 'research',
    [exports.D01A_TOPICS.DATASET_INTERNAL]: 'internal',
    [exports.D01A_TOPICS.MODEL_WEIGHTS]: 'restricted',
    [exports.D01A_TOPICS.MODEL_INFERENCE]: 'commercial',
    [exports.D01A_TOPICS.MODEL_TRAINING]: 'research',
    [exports.D01A_TOPICS.AGENT_REGISTRY]: 'public',
    [exports.D01A_TOPICS.AGENT_CAPABILITIES]: 'public',
    [exports.D01A_TOPICS.AGENT_JOBS]: 'commercial',
    [exports.D01A_TOPICS.AGENT_RESULTS]: 'restricted',
    [exports.D01A_TOPICS.PAYMENT_QUOTES]: 'commercial',
    [exports.D01A_TOPICS.PAYMENT_RECEIPTS]: 'restricted',
    [exports.D01A_TOPICS.PAYMENT_DISPUTES]: 'restricted',
    [exports.D01A_TOPICS.LINEAGE_GRAPH]: 'public',
    [exports.D01A_TOPICS.LINEAGE_EVENTS]: 'public',
    [exports.D01A_TOPICS.PROVENANCE_CHAIN]: 'public',
    [exports.D01A_TOPICS.SEARCH_QUERIES]: 'public',
    [exports.D01A_TOPICS.SEARCH_RESULTS]: 'public',
    [exports.D01A_TOPICS.SEARCH_INDEX]: 'internal',
    [exports.D01A_TOPICS.ALERT_POLICY]: 'internal',
    [exports.D01A_TOPICS.ALERT_QUALITY]: 'internal',
    [exports.D01A_TOPICS.ALERT_SECURITY]: 'restricted',
    [exports.D01A_TOPICS.POLICY_UPDATES]: 'public',
    [exports.D01A_TOPICS.GOVERNANCE_VOTES]: 'public',
    [exports.D01A_TOPICS.COMPLIANCE_REPORTS]: 'internal',
};
/**
 * Generate dynamic topics based on dataset/model/agent IDs
 */
class TopicGenerator {
    static datasetTopic(datasetId, classification = 'public') {
        return `gitdata.dataset.${classification}.${datasetId}`;
    }
    static modelTopic(modelId, purpose = 'inference') {
        return `gitdata.model.${purpose}.${modelId}`;
    }
    static agentTopic(agentId, purpose = 'jobs') {
        return `gitdata.agent.${purpose}.${agentId}`;
    }
    static paymentTopic(receiptId) {
        return `gitdata.payment.receipt.${receiptId}`;
    }
    static lineageTopic(versionId) {
        return `gitdata.lineage.version.${versionId}`;
    }
    static producerTopic(producerId) {
        return `gitdata.producer.${producerId}`;
    }
    static jobTopic(jobId) {
        return `gitdata.job.${jobId}`;
    }
}
exports.TopicGenerator = TopicGenerator;
/**
 * Default overlay configuration for different environments
 */
function getOverlayConfig(env = 'development') {
    const baseConfig = {
        peerDiscovery: {
            lookupServices: [
                'https://overlay.powping.com',
                'https://overlay.bitcoinfiles.org',
                'https://overlay.preev.com',
            ],
            timeout: 30000,
        },
        network: 'mainnet',
    };
    switch (env) {
        case 'development':
            return {
                ...baseConfig,
                network: 'testnet',
                topics: [
                    exports.D01A_TOPICS.DATA_ASSET,
                    exports.D01A_TOPICS.DATA_METADATA,
                    exports.D01A_TOPICS.DATASET_PUBLIC,
                    exports.D01A_TOPICS.AGENT_REGISTRY,
                    exports.D01A_TOPICS.SEARCH_QUERIES,
                    exports.D01A_TOPICS.SEARCH_RESULTS,
                    exports.D01A_TOPICS.LINEAGE_GRAPH,
                    exports.D01A_TOPICS.POLICY_UPDATES,
                ],
                advertiseTopics: [
                    exports.D01A_TOPICS.DATA_ASSET,
                    exports.D01A_TOPICS.DATASET_PUBLIC,
                    exports.D01A_TOPICS.AGENT_REGISTRY,
                ],
                peerDiscovery: {
                    ...baseConfig.peerDiscovery,
                    lookupServices: [
                        'https://testnet-overlay.powping.com',
                        'http://localhost:8080', // Local overlay node for development
                    ],
                },
            };
        case 'staging':
            return {
                ...baseConfig,
                network: 'testnet',
                topics: [
                    exports.D01A_TOPICS.DATA_ASSET,
                    exports.D01A_TOPICS.DATA_METADATA,
                    exports.D01A_TOPICS.DATASET_PUBLIC,
                    exports.D01A_TOPICS.DATASET_COMMERCIAL,
                    exports.D01A_TOPICS.MODEL_INFERENCE,
                    exports.D01A_TOPICS.AGENT_REGISTRY,
                    exports.D01A_TOPICS.AGENT_CAPABILITIES,
                    exports.D01A_TOPICS.AGENT_JOBS,
                    exports.D01A_TOPICS.PAYMENT_QUOTES,
                    exports.D01A_TOPICS.SEARCH_QUERIES,
                    exports.D01A_TOPICS.SEARCH_RESULTS,
                    exports.D01A_TOPICS.LINEAGE_GRAPH,
                    exports.D01A_TOPICS.LINEAGE_EVENTS,
                    exports.D01A_TOPICS.POLICY_UPDATES,
                ],
                advertiseTopics: [
                    exports.D01A_TOPICS.DATA_ASSET,
                    exports.D01A_TOPICS.DATASET_PUBLIC,
                    exports.D01A_TOPICS.DATASET_COMMERCIAL,
                    exports.D01A_TOPICS.AGENT_REGISTRY,
                    exports.D01A_TOPICS.AGENT_CAPABILITIES,
                ],
            };
        case 'production':
            return {
                ...baseConfig,
                topics: [
                    // All public topics
                    exports.D01A_TOPICS.DATA_ASSET,
                    exports.D01A_TOPICS.DATA_METADATA,
                    exports.D01A_TOPICS.DATASET_PUBLIC,
                    exports.D01A_TOPICS.DATASET_COMMERCIAL,
                    exports.D01A_TOPICS.DATASET_RESEARCH,
                    exports.D01A_TOPICS.MODEL_INFERENCE,
                    exports.D01A_TOPICS.MODEL_TRAINING,
                    exports.D01A_TOPICS.AGENT_REGISTRY,
                    exports.D01A_TOPICS.AGENT_CAPABILITIES,
                    exports.D01A_TOPICS.AGENT_JOBS,
                    exports.D01A_TOPICS.PAYMENT_QUOTES,
                    exports.D01A_TOPICS.LINEAGE_GRAPH,
                    exports.D01A_TOPICS.LINEAGE_EVENTS,
                    exports.D01A_TOPICS.PROVENANCE_CHAIN,
                    exports.D01A_TOPICS.SEARCH_QUERIES,
                    exports.D01A_TOPICS.SEARCH_RESULTS,
                    exports.D01A_TOPICS.POLICY_UPDATES,
                    exports.D01A_TOPICS.GOVERNANCE_VOTES,
                ],
                advertiseTopics: [
                    exports.D01A_TOPICS.DATA_ASSET,
                    exports.D01A_TOPICS.DATASET_PUBLIC,
                    exports.D01A_TOPICS.DATASET_COMMERCIAL,
                    exports.D01A_TOPICS.AGENT_REGISTRY,
                    exports.D01A_TOPICS.AGENT_CAPABILITIES,
                    exports.D01A_TOPICS.SEARCH_RESULTS,
                    exports.D01A_TOPICS.LINEAGE_GRAPH,
                ],
            };
        case 'test':
            return {
                topics: [
                    exports.D01A_TOPICS.DATA_ASSET,
                    exports.D01A_TOPICS.PAYMENT_RECEIPTS,
                    exports.D01A_TOPICS.LINEAGE_GRAPH,
                ],
                advertiseTopics: [
                    exports.D01A_TOPICS.DATA_ASSET,
                ],
                peerDiscovery: {
                    lookupServices: ['https://overlay.powping.com'],
                    timeout: 30000,
                },
                network: 'testnet',
            };
        default:
            throw new Error(`Unknown environment: ${env}`);
    }
}
/**
 * Topic subscription manager for handling dynamic subscriptions
 */
class TopicSubscriptionManager {
    constructor() {
        this.activeSubscriptions = new Map();
    }
    /**
     * Add a subscription with metadata
     */
    addSubscription(topic, classification = 'public') {
        this.activeSubscriptions.set(topic, {
            topic,
            classification,
            subscribedAt: Date.now(),
            lastActivity: Date.now(),
            messageCount: 0,
        });
    }
    /**
     * Remove a subscription
     */
    removeSubscription(topic) {
        this.activeSubscriptions.delete(topic);
    }
    /**
     * Update activity for a topic
     */
    updateActivity(topic) {
        const subscription = this.activeSubscriptions.get(topic);
        if (subscription) {
            subscription.lastActivity = Date.now();
            subscription.messageCount++;
        }
    }
    /**
     * Get all active subscriptions
     */
    getActiveSubscriptions() {
        return Array.from(this.activeSubscriptions.values());
    }
    /**
     * Get subscriptions by classification
     */
    getSubscriptionsByClassification(classification) {
        return Array.from(this.activeSubscriptions.values())
            .filter((sub) => sub.classification === classification)
            .map((sub) => sub.topic);
    }
    /**
     * Clean up inactive subscriptions
     */
    cleanupInactiveSubscriptions(maxAgeMs = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        const removed = [];
        for (const [topic, subscription] of Array.from(this.activeSubscriptions.entries())) {
            if (now - subscription.lastActivity > maxAgeMs) {
                this.activeSubscriptions.delete(topic);
                removed.push(topic);
            }
        }
        return removed;
    }
    /**
     * Get subscription statistics
     */
    getStats() {
        const subscriptions = Array.from(this.activeSubscriptions.values());
        const byClassification = {};
        let totalMessages = 0;
        let oldestTime = Date.now();
        for (const sub of subscriptions) {
            byClassification[sub.classification] = (byClassification[sub.classification] || 0) + 1;
            totalMessages += sub.messageCount;
            if (sub.subscribedAt < oldestTime) {
                oldestTime = sub.subscribedAt;
            }
        }
        return {
            totalSubscriptions: subscriptions.length,
            byClassification,
            averageMessageCount: subscriptions.length > 0 ? totalMessages / subscriptions.length : 0,
            oldestSubscription: oldestTime,
        };
    }
}
exports.TopicSubscriptionManager = TopicSubscriptionManager;
//# sourceMappingURL=overlay-config.js.map