// BSV Overlay Configuration
// Manages overlay topics, subscriptions, and network configuration

import type { OverlayConfig } from './bsv-overlay-service';

/**
 * Standard D01A topics for data discovery and publishing
 */
export const D01A_TOPICS = {
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
} as const;

/**
 * Topic classification and access control
 */
export const TOPIC_CLASSIFICATION = {
  [D01A_TOPICS.DATA_ASSET]: 'public',
  [D01A_TOPICS.DATA_MANIFEST]: 'public', // Deprecated: keep for backward compatibility
  [D01A_TOPICS.DATA_CONTENT]: 'restricted',
  [D01A_TOPICS.DATA_METADATA]: 'public',
  [D01A_TOPICS.DATASET_PUBLIC]: 'public',
  [D01A_TOPICS.DATASET_COMMERCIAL]: 'commercial',
  [D01A_TOPICS.DATASET_RESEARCH]: 'research',
  [D01A_TOPICS.DATASET_INTERNAL]: 'internal',
  [D01A_TOPICS.MODEL_WEIGHTS]: 'restricted',
  [D01A_TOPICS.MODEL_INFERENCE]: 'commercial',
  [D01A_TOPICS.MODEL_TRAINING]: 'research',
  [D01A_TOPICS.AGENT_REGISTRY]: 'public',
  [D01A_TOPICS.AGENT_CAPABILITIES]: 'public',
  [D01A_TOPICS.AGENT_JOBS]: 'commercial',
  [D01A_TOPICS.AGENT_RESULTS]: 'restricted',
  [D01A_TOPICS.PAYMENT_QUOTES]: 'commercial',
  [D01A_TOPICS.PAYMENT_RECEIPTS]: 'restricted',
  [D01A_TOPICS.PAYMENT_DISPUTES]: 'restricted',
  [D01A_TOPICS.LINEAGE_GRAPH]: 'public',
  [D01A_TOPICS.LINEAGE_EVENTS]: 'public',
  [D01A_TOPICS.PROVENANCE_CHAIN]: 'public',
  [D01A_TOPICS.SEARCH_QUERIES]: 'public',
  [D01A_TOPICS.SEARCH_RESULTS]: 'public',
  [D01A_TOPICS.SEARCH_INDEX]: 'internal',
  [D01A_TOPICS.ALERT_POLICY]: 'internal',
  [D01A_TOPICS.ALERT_QUALITY]: 'internal',
  [D01A_TOPICS.ALERT_SECURITY]: 'restricted',
  [D01A_TOPICS.POLICY_UPDATES]: 'public',
  [D01A_TOPICS.GOVERNANCE_VOTES]: 'public',
  [D01A_TOPICS.COMPLIANCE_REPORTS]: 'internal',
} as const;

/**
 * Generate dynamic topics based on dataset/model/agent IDs
 */
export class TopicGenerator {
  static datasetTopic(datasetId: string, classification: string = 'public'): string {
    return `gitdata.dataset.${classification}.${datasetId}`;
  }

  static modelTopic(modelId: string, purpose: string = 'inference'): string {
    return `gitdata.model.${purpose}.${modelId}`;
  }

  static agentTopic(agentId: string, purpose: string = 'jobs'): string {
    return `gitdata.agent.${purpose}.${agentId}`;
  }

  static paymentTopic(receiptId: string): string {
    return `gitdata.payment.receipt.${receiptId}`;
  }

  static lineageTopic(versionId: string): string {
    return `gitdata.lineage.version.${versionId}`;
  }

  static producerTopic(producerId: string): string {
    return `gitdata.producer.${producerId}`;
  }

  static jobTopic(jobId: string): string {
    return `gitdata.job.${jobId}`;
  }
}

/**
 * Default overlay configuration for different environments
 */
export function getOverlayConfig(
  env: 'development' | 'staging' | 'production' | 'test' = 'development',
): OverlayConfig {
  const baseConfig = {
    peerDiscovery: {
      lookupServices: [
        'https://overlay.powping.com',
        'https://overlay.bitcoinfiles.org',
        'https://overlay.preev.com',
      ],
      timeout: 30000,
    },
    network: 'mainnet' as const,
  };

  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        network: 'testnet',
        topics: [
          D01A_TOPICS.DATA_ASSET,
          D01A_TOPICS.DATA_METADATA,
          D01A_TOPICS.DATASET_PUBLIC,
          D01A_TOPICS.AGENT_REGISTRY,
          D01A_TOPICS.SEARCH_QUERIES,
          D01A_TOPICS.SEARCH_RESULTS,
          D01A_TOPICS.LINEAGE_GRAPH,
          D01A_TOPICS.POLICY_UPDATES,
        ],
        advertiseTopics: [
          D01A_TOPICS.DATA_ASSET,
          D01A_TOPICS.DATASET_PUBLIC,
          D01A_TOPICS.AGENT_REGISTRY,
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
          D01A_TOPICS.DATA_ASSET,
          D01A_TOPICS.DATA_METADATA,
          D01A_TOPICS.DATASET_PUBLIC,
          D01A_TOPICS.DATASET_COMMERCIAL,
          D01A_TOPICS.MODEL_INFERENCE,
          D01A_TOPICS.AGENT_REGISTRY,
          D01A_TOPICS.AGENT_CAPABILITIES,
          D01A_TOPICS.AGENT_JOBS,
          D01A_TOPICS.PAYMENT_QUOTES,
          D01A_TOPICS.SEARCH_QUERIES,
          D01A_TOPICS.SEARCH_RESULTS,
          D01A_TOPICS.LINEAGE_GRAPH,
          D01A_TOPICS.LINEAGE_EVENTS,
          D01A_TOPICS.POLICY_UPDATES,
        ],
        advertiseTopics: [
          D01A_TOPICS.DATA_ASSET,
          D01A_TOPICS.DATASET_PUBLIC,
          D01A_TOPICS.DATASET_COMMERCIAL,
          D01A_TOPICS.AGENT_REGISTRY,
          D01A_TOPICS.AGENT_CAPABILITIES,
        ],
      };

    case 'production':
      return {
        ...baseConfig,
        topics: [
          // All public topics
          D01A_TOPICS.DATA_ASSET,
          D01A_TOPICS.DATA_METADATA,
          D01A_TOPICS.DATASET_PUBLIC,
          D01A_TOPICS.DATASET_COMMERCIAL,
          D01A_TOPICS.DATASET_RESEARCH,
          D01A_TOPICS.MODEL_INFERENCE,
          D01A_TOPICS.MODEL_TRAINING,
          D01A_TOPICS.AGENT_REGISTRY,
          D01A_TOPICS.AGENT_CAPABILITIES,
          D01A_TOPICS.AGENT_JOBS,
          D01A_TOPICS.PAYMENT_QUOTES,
          D01A_TOPICS.LINEAGE_GRAPH,
          D01A_TOPICS.LINEAGE_EVENTS,
          D01A_TOPICS.PROVENANCE_CHAIN,
          D01A_TOPICS.SEARCH_QUERIES,
          D01A_TOPICS.SEARCH_RESULTS,
          D01A_TOPICS.POLICY_UPDATES,
          D01A_TOPICS.GOVERNANCE_VOTES,
        ],
        advertiseTopics: [
          D01A_TOPICS.DATA_ASSET,
          D01A_TOPICS.DATASET_PUBLIC,
          D01A_TOPICS.DATASET_COMMERCIAL,
          D01A_TOPICS.AGENT_REGISTRY,
          D01A_TOPICS.AGENT_CAPABILITIES,
          D01A_TOPICS.SEARCH_RESULTS,
          D01A_TOPICS.LINEAGE_GRAPH,
        ],
      };

    case 'test':
      return {
        topics: [D01A_TOPICS.DATA_ASSET, D01A_TOPICS.PAYMENT_RECEIPTS, D01A_TOPICS.LINEAGE_GRAPH],
        advertiseTopics: [D01A_TOPICS.DATA_ASSET],
        peerDiscovery: {
          lookupServices: ['https://overlay.powping.com'],
          timeout: 30000,
        },
        network: 'testnet' as const,
      };

    default:
      throw new Error(`Unknown environment: ${env}`);
  }
}

/**
 * Topic subscription manager for handling dynamic subscriptions
 */
export class TopicSubscriptionManager {
  private activeSubscriptions = new Map<
    string,
    {
      topic: string;
      classification: string;
      subscribedAt: number;
      lastActivity: number;
      messageCount: number;
    }
  >();

  /**
   * Add a subscription with metadata
   */
  addSubscription(topic: string, classification: string = 'public'): void {
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
  removeSubscription(topic: string): void {
    this.activeSubscriptions.delete(topic);
  }

  /**
   * Update activity for a topic
   */
  updateActivity(topic: string): void {
    const subscription = this.activeSubscriptions.get(topic);
    if (subscription) {
      subscription.lastActivity = Date.now();
      subscription.messageCount++;
    }
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): Array<{
    topic: string;
    classification: string;
    subscribedAt: number;
    lastActivity: number;
    messageCount: number;
  }> {
    return Array.from(this.activeSubscriptions.values());
  }

  /**
   * Get subscriptions by classification
   */
  getSubscriptionsByClassification(classification: string): string[] {
    return Array.from(this.activeSubscriptions.values())
      .filter((sub) => sub.classification === classification)
      .map((sub) => sub.topic);
  }

  /**
   * Clean up inactive subscriptions
   */
  cleanupInactiveSubscriptions(maxAgeMs: number = 24 * 60 * 60 * 1000): string[] {
    const now = Date.now();
    const removed: string[] = [];

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
  getStats(): {
    totalSubscriptions: number;
    byClassification: Record<string, number>;
    averageMessageCount: number;
    oldestSubscription: number;
  } {
    const subscriptions = Array.from(this.activeSubscriptions.values());

    const byClassification: Record<string, number> = {};
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

export { OverlayConfig };
