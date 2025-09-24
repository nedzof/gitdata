import type { OverlayConfig } from './bsv-overlay-service';
/**
 * Standard D01A topics for data discovery and publishing
 */
export declare const D01A_TOPICS: {
    readonly DATA_ASSET: "gitdata.d01a.asset";
    readonly DATA_MANIFEST: "gitdata.d01a.manifest";
    readonly DATA_CONTENT: "gitdata.d01a.content";
    readonly DATA_METADATA: "gitdata.d01a.metadata";
    readonly DATASET_PUBLIC: "gitdata.dataset.public";
    readonly DATASET_COMMERCIAL: "gitdata.dataset.commercial";
    readonly DATASET_RESEARCH: "gitdata.dataset.research";
    readonly DATASET_INTERNAL: "gitdata.dataset.internal";
    readonly MODEL_WEIGHTS: "gitdata.model.weights";
    readonly MODEL_INFERENCE: "gitdata.model.inference";
    readonly MODEL_TRAINING: "gitdata.model.training";
    readonly AGENT_REGISTRY: "gitdata.agent.registry";
    readonly AGENT_CAPABILITIES: "gitdata.agent.capabilities";
    readonly AGENT_JOBS: "gitdata.agent.jobs";
    readonly AGENT_RESULTS: "gitdata.agent.results";
    readonly PAYMENT_QUOTES: "gitdata.payment.quotes";
    readonly PAYMENT_RECEIPTS: "gitdata.payment.receipts";
    readonly PAYMENT_DISPUTES: "gitdata.payment.disputes";
    readonly LINEAGE_GRAPH: "gitdata.lineage.graph";
    readonly LINEAGE_EVENTS: "gitdata.lineage.events";
    readonly PROVENANCE_CHAIN: "gitdata.provenance.chain";
    readonly SEARCH_QUERIES: "gitdata.search.queries";
    readonly SEARCH_RESULTS: "gitdata.search.results";
    readonly SEARCH_INDEX: "gitdata.search.index";
    readonly ALERT_POLICY: "gitdata.alert.policy";
    readonly ALERT_QUALITY: "gitdata.alert.quality";
    readonly ALERT_SECURITY: "gitdata.alert.security";
    readonly POLICY_UPDATES: "gitdata.policy.updates";
    readonly GOVERNANCE_VOTES: "gitdata.governance.votes";
    readonly COMPLIANCE_REPORTS: "gitdata.compliance.reports";
};
/**
 * Topic classification and access control
 */
export declare const TOPIC_CLASSIFICATION: {
    readonly "gitdata.d01a.asset": "public";
    readonly "gitdata.d01a.manifest": "public";
    readonly "gitdata.d01a.content": "restricted";
    readonly "gitdata.d01a.metadata": "public";
    readonly "gitdata.dataset.public": "public";
    readonly "gitdata.dataset.commercial": "commercial";
    readonly "gitdata.dataset.research": "research";
    readonly "gitdata.dataset.internal": "internal";
    readonly "gitdata.model.weights": "restricted";
    readonly "gitdata.model.inference": "commercial";
    readonly "gitdata.model.training": "research";
    readonly "gitdata.agent.registry": "public";
    readonly "gitdata.agent.capabilities": "public";
    readonly "gitdata.agent.jobs": "commercial";
    readonly "gitdata.agent.results": "restricted";
    readonly "gitdata.payment.quotes": "commercial";
    readonly "gitdata.payment.receipts": "restricted";
    readonly "gitdata.payment.disputes": "restricted";
    readonly "gitdata.lineage.graph": "public";
    readonly "gitdata.lineage.events": "public";
    readonly "gitdata.provenance.chain": "public";
    readonly "gitdata.search.queries": "public";
    readonly "gitdata.search.results": "public";
    readonly "gitdata.search.index": "internal";
    readonly "gitdata.alert.policy": "internal";
    readonly "gitdata.alert.quality": "internal";
    readonly "gitdata.alert.security": "restricted";
    readonly "gitdata.policy.updates": "public";
    readonly "gitdata.governance.votes": "public";
    readonly "gitdata.compliance.reports": "internal";
};
/**
 * Generate dynamic topics based on dataset/model/agent IDs
 */
export declare class TopicGenerator {
    static datasetTopic(datasetId: string, classification?: string): string;
    static modelTopic(modelId: string, purpose?: string): string;
    static agentTopic(agentId: string, purpose?: string): string;
    static paymentTopic(receiptId: string): string;
    static lineageTopic(versionId: string): string;
    static producerTopic(producerId: string): string;
    static jobTopic(jobId: string): string;
}
/**
 * Default overlay configuration for different environments
 */
export declare function getOverlayConfig(env?: 'development' | 'staging' | 'production' | 'test'): OverlayConfig;
/**
 * Topic subscription manager for handling dynamic subscriptions
 */
export declare class TopicSubscriptionManager {
    private activeSubscriptions;
    /**
     * Add a subscription with metadata
     */
    addSubscription(topic: string, classification?: string): void;
    /**
     * Remove a subscription
     */
    removeSubscription(topic: string): void;
    /**
     * Update activity for a topic
     */
    updateActivity(topic: string): void;
    /**
     * Get all active subscriptions
     */
    getActiveSubscriptions(): Array<{
        topic: string;
        classification: string;
        subscribedAt: number;
        lastActivity: number;
        messageCount: number;
    }>;
    /**
     * Get subscriptions by classification
     */
    getSubscriptionsByClassification(classification: string): string[];
    /**
     * Clean up inactive subscriptions
     */
    cleanupInactiveSubscriptions(maxAgeMs?: number): string[];
    /**
     * Get subscription statistics
     */
    getStats(): {
        totalSubscriptions: number;
        byClassification: Record<string, number>;
        averageMessageCount: number;
        oldestSubscription: number;
    };
}
export { OverlayConfig };
