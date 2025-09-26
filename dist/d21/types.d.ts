/**
 * D21 BSV Native Payment Extensions Types
 *
 * Extends BRC-41 PacketPay with native BSV infrastructure capabilities:
 * - Payment templates with deterministic revenue splits
 * - mAPI broadcasting with multi-provider failover
 * - Cross-network settlement coordination
 * - AI agent complex payment workflows
 */
/**
 * Deterministic payment template for reproducible revenue splits
 */
export interface D21PaymentTemplate {
    templateId: string;
    templateHash: string;
    brc41PaymentId?: string;
    splitRules: PaymentSplitRules;
    outputScripts: PaymentOutput[];
    totalAmountSatoshis: number;
    deterministicInputs: Record<string, any>;
    templateVersion: string;
    createdBy: string;
    createdAt: Date;
    expiresAt: Date;
    isUsed: boolean;
}
/**
 * Payment split rules configuration
 */
export interface PaymentSplitRules {
    overlay: number;
    producer: number;
    agent?: number;
    custom?: Record<string, number>;
}
/**
 * Individual payment output
 */
export interface PaymentOutput {
    scriptHex: string;
    satoshis: number;
    recipient: string;
    description?: string;
}
/**
 * ARC provider configuration (GorillaPool transaction processor)
 */
export interface D21ARCProvider {
    providerId: string;
    providerName: string;
    apiUrl: string;
    timeoutSeconds: number;
    isActive: boolean;
    priorityOrder: number;
    supportsCallbacks: boolean;
    successRate: number;
    averageResponseTimeMs: number;
    totalBroadcasts: number;
    successfulBroadcasts: number;
    failedBroadcasts: number;
    apiKeyEncrypted?: string;
    authenticationMethod: 'none' | 'api_key' | 'bearer_token';
    rateLimitPerMinute: number;
    supportedEndpoints: ARCEndpoint[];
    minFeeRate: number;
    maxTxSize: number;
}
/**
 * ARC API endpoints
 */
export type ARCEndpoint = 'submit_tx' | 'get_tx_status' | 'batch_submit' | 'policy_quote' | 'fee_quote';
/**
 * ARC transaction broadcast request
 */
export interface D21ARCBroadcastRequest {
    rawTx: string;
    templateId?: string;
    preferredProvider?: string;
    enableCallbacks?: boolean;
    callbackUrl?: string;
    waitForStatus?: ARCTxStatus;
    maxTimeout?: number;
}
/**
 * ARC transaction broadcast result
 */
export interface D21ARCBroadcastResult {
    txid: string;
    broadcastProvider: string;
    status: ARCTxStatus;
    broadcastResponse: ARCSubmitTxResponse;
    timestamp: Date;
    announceTime?: Date;
    seenOnNetworkTime?: Date;
    minedTime?: Date;
    rejectedTime?: Date;
}
/**
 * ARC transaction status (based on ARC documentation)
 */
export type ARCTxStatus = 'UNKNOWN' | 'QUEUED' | 'RECEIVED' | 'STORED' | 'ANNOUNCED_TO_NETWORK' | 'SENT_TO_NETWORK' | 'SEEN_ON_NETWORK' | 'MINED' | 'REJECTED' | 'DOUBLE_SPEND_ATTEMPTED';
/**
 * ARC submit transaction response (from ARC API docs)
 */
export interface ARCSubmitTxResponse {
    txid: string;
    status: ARCTxStatus;
    blockHash?: string;
    blockHeight?: number;
    timestamp: string;
    txStatus?: string;
    extraInfo?: string;
}
/**
 * ARC fee quote response
 */
export interface ARCFeeQuote {
    feeType: string;
    miningFee: {
        satoshis: number;
        bytes: number;
    };
    relayFee: {
        satoshis: number;
        bytes: number;
    };
    timestamp: string;
    expiryTime: string;
    minFeeRequired: boolean;
}
/**
 * ARC policy quote response
 */
export interface ARCPolicyQuote {
    policy: {
        maxscriptsizepolicy: number;
        maxstdtxvalidationduration: number;
        maxtxsizepolicy: number;
        datacarriersize: number;
        maxscriptnumlengthpolicy: number;
        maxstackmemoryusagepolicy: number;
        limitancestorcount: number;
        limitcpfpgroupmemberscount: number;
        acceptnonstdoutputs: boolean;
        datacarrier: boolean;
        dustrelayfee: number;
        maxstdtxvalidationduration: number;
        maxstdtxvalidationduration: number;
        minminingtxfee: number;
        minrelaytxfee: number;
        opreturnrelay: boolean;
        utxocommitment: boolean;
    };
    timestamp: string;
}
/**
 * Cross-network settlement configuration
 */
export interface D21CrossNetworkSettlement {
    settlementId: string;
    primaryNetwork: string;
    secondaryNetworks: string[];
    brc41PaymentIds: string[];
    d21TemplateIds: string[];
    totalSettlementSatoshis: number;
    networkFees: Record<string, number>;
    settlementStatus: SettlementStatus;
    coordinationProof?: any;
    rollbackTransactions: any[];
    settlementStartedAt: Date;
    settlementCompletedAt?: Date;
    expiresAt: Date;
}
export type SettlementStatus = 'pending' | 'coordinated' | 'settled' | 'failed' | 'rolled_back';
/**
 * AI agent payment workflow configuration
 */
export interface D21AgentPaymentWorkflow {
    workflowId: string;
    agentId: string;
    agentIdentityKey?: string;
    workflowType: AgentWorkflowType;
    paymentSteps: AgentPaymentStep[];
    totalEstimatedCostSatoshis: number;
    currentStep: number;
    stepsCompleted: number;
    stepsFailed: number;
    workflowStatus: AgentWorkflowStatus;
    authorizedBy: string;
    authorizationSignature: string;
    maxSpendLimitSatoshis: number;
    brc41PaymentIds: string[];
    d21SettlementIds: string[];
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
}
export type AgentWorkflowType = 'batch_payment' | 'conditional_payment' | 'multi_party' | 'recurring' | 'escrow';
export type AgentWorkflowStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'paused' | 'cancelled';
/**
 * Individual payment step in agent workflow
 */
export interface AgentPaymentStep {
    stepId: string;
    stepOrder: number;
    stepType: 'brc41_payment' | 'mapi_broadcast' | 'settlement' | 'condition_check';
    stepConfig: Record<string, any>;
    expectedCostSatoshis: number;
    stepStatus: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
    startedAt?: Date;
    completedAt?: Date;
    errorMessage?: string;
    dependsOn?: string[];
    conditions?: AgentPaymentCondition[];
}
/**
 * Conditions for agent payment step execution
 */
export interface AgentPaymentCondition {
    conditionType: 'balance_check' | 'time_window' | 'external_trigger' | 'approval_required';
    conditionConfig: Record<string, any>;
    isMet: boolean;
    lastChecked?: Date;
}
/**
 * D21 Payment Template Service
 */
export interface D21PaymentTemplateService {
    generateTemplate(params: {
        brc41PaymentId?: string;
        splitRules: PaymentSplitRules;
        totalSatoshis: number;
        createdBy: string;
        metadata?: Record<string, any>;
    }): Promise<D21PaymentTemplate>;
    getTemplate(templateHash: string): Promise<D21PaymentTemplate | null>;
    verifyTemplate(templateHash: string): Promise<boolean>;
    getTemplateUsage(templateHash: string): Promise<{
        totalUses: number;
        totalVolumeSatoshis: number;
        averageTransactionSize: number;
    }>;
}
/**
 * D21 ARC Broadcasting Service
 */
export interface D21ARCBroadcastService {
    broadcastTransaction(request: D21ARCBroadcastRequest): Promise<D21ARCBroadcastResult>;
    getTransactionStatus(txid: string, providerId?: string): Promise<ARCSubmitTxResponse>;
    waitForTransactionStatus(txid: string, targetStatus: ARCTxStatus, timeout?: number): Promise<ARCSubmitTxResponse>;
    batchBroadcast(requests: D21ARCBroadcastRequest[]): Promise<D21ARCBroadcastResult[]>;
    getProviders(): Promise<D21ARCProvider[]>;
    getProviderHealth(providerId: string): Promise<{
        isHealthy: boolean;
        responseTime: number;
        successRate: number;
        lastChecked: Date;
        currentFeeQuote?: ARCFeeQuote;
    }>;
    selectOptimalProvider(criteria?: {
        maxLatency?: number;
        minSuccessRate?: number;
        preferredProviders?: string[];
        minFeeRate?: number;
        maxTxSize?: number;
    }): Promise<D21ARCProvider>;
    getPolicyQuote(providerId: string): Promise<ARCPolicyQuote>;
    getFeeQuote(providerId: string): Promise<ARCFeeQuote>;
}
/**
 * D21 Cross-Network Settlement Service
 */
export interface D21CrossNetworkSettlementService {
    initiateSettlement(params: {
        primaryNetwork: string;
        secondaryNetworks: string[];
        brc41PaymentIds: string[];
        templateIds?: string[];
    }): Promise<D21CrossNetworkSettlement>;
    getSettlementStatus(settlementId: string): Promise<D21CrossNetworkSettlement>;
    coordinateNetworks(settlementId: string): Promise<boolean>;
    rollbackSettlement(settlementId: string): Promise<boolean>;
}
/**
 * D21 Agent Payment Workflow Service
 */
export interface D21AgentPaymentWorkflowService {
    createWorkflow(params: {
        agentId: string;
        workflowType: AgentWorkflowType;
        paymentSteps: Omit<AgentPaymentStep, 'stepId'>[];
        authorization: {
            authorizedBy: string;
            signature: string;
            spendLimit: number;
        };
    }): Promise<D21AgentPaymentWorkflow>;
    executeWorkflowStep(workflowId: string, stepId: string): Promise<boolean>;
    getWorkflowStatus(workflowId: string): Promise<D21AgentPaymentWorkflow>;
    pauseWorkflow(workflowId: string): Promise<boolean>;
    cancelWorkflow(workflowId: string): Promise<boolean>;
    getAgentWorkflowHistory(agentId: string): Promise<D21AgentPaymentWorkflow[]>;
}
export declare class D21Error extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode?: number);
}
export declare class D21TemplateError extends D21Error {
    templateHash: string;
    constructor(message: string, templateHash: string);
}
export declare class D21ARCError extends D21Error {
    provider: string;
    txid?: string | undefined;
    constructor(message: string, provider: string, txid?: string | undefined);
}
export declare class D21SettlementError extends D21Error {
    settlementId: string;
    constructor(message: string, settlementId: string);
}
export declare class D21WorkflowError extends D21Error {
    workflowId: string;
    constructor(message: string, workflowId: string);
}
export declare const D21_VERSION = "1.0";
export declare const TEMPLATE_EXPIRY_MS = 3600000;
export declare const SETTLEMENT_TIMEOUT_MS = 1800000;
export declare const WORKFLOW_DEFAULT_TIMEOUT_MS = 86400000;
/**
 * Default split rules for payment templates
 */
export declare const DEFAULT_SPLIT_RULES: PaymentSplitRules;
/**
 * ARC provider defaults
 */
export declare const DEFAULT_ARC_CONFIG: {
    readonly timeoutSeconds: 30;
    readonly retryAttempts: 3;
    readonly healthCheckInterval: 60000;
    readonly rateLimitPerMinute: 100;
    readonly waitForStatusTimeout: 60000;
    readonly batchSize: 100;
};
/**
 * Default ARC providers (GorillaPool and others)
 */
export declare const DEFAULT_ARC_PROVIDERS: Omit<D21ARCProvider, 'providerId'>[];
