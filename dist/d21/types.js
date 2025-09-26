"use strict";
/**
 * D21 BSV Native Payment Extensions Types
 *
 * Extends BRC-41 PacketPay with native BSV infrastructure capabilities:
 * - Payment templates with deterministic revenue splits
 * - mAPI broadcasting with multi-provider failover
 * - Cross-network settlement coordination
 * - AI agent complex payment workflows
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ARC_PROVIDERS = exports.DEFAULT_ARC_CONFIG = exports.DEFAULT_SPLIT_RULES = exports.WORKFLOW_DEFAULT_TIMEOUT_MS = exports.SETTLEMENT_TIMEOUT_MS = exports.TEMPLATE_EXPIRY_MS = exports.D21_VERSION = exports.D21WorkflowError = exports.D21SettlementError = exports.D21ARCError = exports.D21TemplateError = exports.D21Error = void 0;
// ==================== Error Types ====================
class D21Error extends Error {
    constructor(message, code, statusCode = 500) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'D21Error';
    }
}
exports.D21Error = D21Error;
class D21TemplateError extends D21Error {
    constructor(message, templateHash) {
        super(message, 'D21_TEMPLATE_ERROR', 400);
        this.templateHash = templateHash;
    }
}
exports.D21TemplateError = D21TemplateError;
class D21ARCError extends D21Error {
    constructor(message, provider, txid) {
        super(message, 'D21_ARC_ERROR', 502);
        this.provider = provider;
        this.txid = txid;
    }
}
exports.D21ARCError = D21ARCError;
class D21SettlementError extends D21Error {
    constructor(message, settlementId) {
        super(message, 'D21_SETTLEMENT_ERROR', 500);
        this.settlementId = settlementId;
    }
}
exports.D21SettlementError = D21SettlementError;
class D21WorkflowError extends D21Error {
    constructor(message, workflowId) {
        super(message, 'D21_WORKFLOW_ERROR', 500);
        this.workflowId = workflowId;
    }
}
exports.D21WorkflowError = D21WorkflowError;
// ==================== Constants ====================
exports.D21_VERSION = '1.0';
exports.TEMPLATE_EXPIRY_MS = 3600000; // 1 hour
exports.SETTLEMENT_TIMEOUT_MS = 1800000; // 30 minutes
exports.WORKFLOW_DEFAULT_TIMEOUT_MS = 86400000; // 24 hours
/**
 * Default split rules for payment templates
 */
exports.DEFAULT_SPLIT_RULES = {
    overlay: 0.05, // 5% platform fee
    producer: 0.90, // 90% to producer
    agent: 0.05, // 5% agent commission
};
/**
 * ARC provider defaults
 */
exports.DEFAULT_ARC_CONFIG = {
    timeoutSeconds: 30,
    retryAttempts: 3,
    healthCheckInterval: 60000, // 1 minute
    rateLimitPerMinute: 100,
    waitForStatusTimeout: 60000, // 1 minute wait for SEEN_ON_NETWORK
    batchSize: 100, // Maximum transactions per batch
};
/**
 * Default ARC providers (GorillaPool and others)
 */
exports.DEFAULT_ARC_PROVIDERS = [
    {
        providerName: 'GorillaPool ARC',
        apiUrl: 'https://arc.gorillapool.io',
        timeoutSeconds: 30,
        isActive: true,
        priorityOrder: 1,
        supportsCallbacks: true,
        successRate: 1.0,
        averageResponseTimeMs: 500,
        totalBroadcasts: 0,
        successfulBroadcasts: 0,
        failedBroadcasts: 0,
        authenticationMethod: 'bearer_token',
        rateLimitPerMinute: 1000,
        supportedEndpoints: ['submit_tx', 'get_tx_status', 'batch_submit', 'policy_quote', 'fee_quote'],
        minFeeRate: 1, // 1 sat/byte minimum
        maxTxSize: 1000000, // 1MB max
    },
    {
        providerName: 'TAAL ARC',
        apiUrl: 'https://arc.taal.com',
        timeoutSeconds: 30,
        isActive: true,
        priorityOrder: 2,
        supportsCallbacks: true,
        successRate: 1.0,
        averageResponseTimeMs: 600,
        totalBroadcasts: 0,
        successfulBroadcasts: 0,
        failedBroadcasts: 0,
        authenticationMethod: 'api_key',
        rateLimitPerMinute: 500,
        supportedEndpoints: ['submit_tx', 'get_tx_status', 'policy_quote', 'fee_quote'],
        minFeeRate: 1,
        maxTxSize: 1000000,
    },
];
//# sourceMappingURL=types.js.map