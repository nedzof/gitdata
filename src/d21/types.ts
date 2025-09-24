/**
 * D21 BSV Native Payment Extensions Types
 *
 * Extends BRC-41 PacketPay with native BSV infrastructure capabilities:
 * - Payment templates with deterministic revenue splits
 * - mAPI broadcasting with multi-provider failover
 * - Cross-network settlement coordination
 * - AI agent complex payment workflows
 */

import type { BRC41PaymentRequest, BRC29Payment, PaymentRecord } from '../brc41/types.js';

// ==================== Payment Template Types ====================

/**
 * Deterministic payment template for reproducible revenue splits
 */
export interface D21PaymentTemplate {
  templateId: string;
  templateHash: string; // Deterministic hash for reproducibility

  // Links to BRC-41 system
  brc41PaymentId?: string; // References BRC-41 payment record

  // Template configuration
  splitRules: PaymentSplitRules;
  outputScripts: PaymentOutput[];
  totalAmountSatoshis: number;

  // Template metadata
  deterministicInputs: Record<string, any>; // For reproducibility
  templateVersion: string;
  createdBy: string; // BRC-31 identity key

  // Lifecycle
  createdAt: Date;
  expiresAt: Date;
  isUsed: boolean;
}

/**
 * Payment split rules configuration
 */
export interface PaymentSplitRules {
  overlay: number; // Platform fee percentage (0-1)
  producer: number; // Producer revenue percentage (0-1)
  agent?: number; // Agent commission percentage (0-1)
  custom?: Record<string, number>; // Custom recipient percentages
}

/**
 * Individual payment output
 */
export interface PaymentOutput {
  scriptHex: string; // BSV locking script
  satoshis: number; // Output value
  recipient: string; // Recipient identifier
  description?: string; // Human readable description
}

// ==================== ARC Broadcasting Types ====================

/**
 * ARC provider configuration (GorillaPool transaction processor)
 */
export interface D21ARCProvider {
  providerId: string;
  providerName: string;
  apiUrl: string;

  // Configuration
  timeoutSeconds: number;
  isActive: boolean;
  priorityOrder: number;
  supportsCallbacks: boolean;

  // Performance metrics
  successRate: number; // 0-1
  averageResponseTimeMs: number;
  totalBroadcasts: number;
  successfulBroadcasts: number;
  failedBroadcasts: number;

  // Authentication
  apiKeyEncrypted?: string;
  authenticationMethod: 'none' | 'api_key' | 'bearer_token';
  rateLimitPerMinute: number;

  // ARC-specific features
  supportedEndpoints: ARCEndpoint[];
  minFeeRate: number; // Minimum fee rate accepted
  maxTxSize: number; // Maximum transaction size
}

/**
 * ARC API endpoints
 */
export type ARCEndpoint =
  | 'submit_tx'      // POST /v1/tx
  | 'get_tx_status'  // GET /v1/tx/{txid}
  | 'batch_submit'   // POST /v1/tx/batch
  | 'policy_quote'   // GET /v1/policy
  | 'fee_quote';     // GET /v1/feeQuote

/**
 * ARC transaction broadcast request
 */
export interface D21ARCBroadcastRequest {
  rawTx: string; // Raw transaction hex (ARC uses rawTx not rawTxHex)
  templateId?: string; // Optional link to payment template
  preferredProvider?: string; // Preferred ARC provider
  enableCallbacks?: boolean; // Enable callback notifications
  callbackUrl?: string; // Callback URL for status updates

  // ARC-specific options
  waitForStatus?: ARCTxStatus; // Wait for specific status before returning
  maxTimeout?: number; // Maximum time to wait for status
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

  // ARC lifecycle tracking
  announceTime?: Date; // When tx was announced to network
  seenOnNetworkTime?: Date; // When tx was seen on network
  minedTime?: Date; // When tx was mined
  rejectedTime?: Date; // When tx was rejected
}

/**
 * ARC transaction status (based on ARC documentation)
 */
export type ARCTxStatus =
  | 'UNKNOWN'              // Status unknown
  | 'QUEUED'               // Queued for processing
  | 'RECEIVED'             // Received by ARC
  | 'STORED'               // Stored in ARC database
  | 'ANNOUNCED_TO_NETWORK' // Announced to Bitcoin network
  | 'SENT_TO_NETWORK'      // Sent to Bitcoin network
  | 'SEEN_ON_NETWORK'      // Seen on Bitcoin network
  | 'MINED'                // Included in block
  | 'REJECTED'             // Rejected by network
  | 'DOUBLE_SPEND_ATTEMPTED'; // Double spend attempt detected

/**
 * ARC submit transaction response (from ARC API docs)
 */
export interface ARCSubmitTxResponse {
  txid: string;
  status: ARCTxStatus;
  blockHash?: string;
  blockHeight?: number;
  timestamp: string; // ISO 8601 timestamp
  txStatus?: string; // Additional status info
  extraInfo?: string; // Extra information about the transaction
}

/**
 * ARC fee quote response
 */
export interface ARCFeeQuote {
  feeType: string; // "standard" or "data"
  miningFee: {
    satoshis: number;
    bytes: number;
  };
  relayFee: {
    satoshis: number;
    bytes: number;
  };
  timestamp: string; // ISO 8601 timestamp
  expiryTime: string; // ISO 8601 timestamp
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
  timestamp: string; // ISO 8601 timestamp
}

// ==================== Cross-Network Settlement Types ====================

/**
 * Cross-network settlement configuration
 */
export interface D21CrossNetworkSettlement {
  settlementId: string;

  // Multi-network coordination
  primaryNetwork: string; // Main overlay network
  secondaryNetworks: string[]; // Additional networks involved

  // Payment references
  brc41PaymentIds: string[]; // Multiple BRC-41 payments involved
  d21TemplateIds: string[]; // Templates used across networks

  // Settlement details
  totalSettlementSatoshis: number;
  networkFees: Record<string, number>; // Fees per network
  settlementStatus: SettlementStatus;

  // Atomic coordination
  coordinationProof?: any; // Cross-network consensus proof
  rollbackTransactions: any[]; // Rollback data if settlement fails

  // Timing
  settlementStartedAt: Date;
  settlementCompletedAt?: Date;
  expiresAt: Date;
}

export type SettlementStatus =
  | 'pending'     // Settlement initiated but not coordinated
  | 'coordinated' // All networks have agreed to settlement
  | 'settled'     // Settlement completed successfully
  | 'failed'      // Settlement failed, rollback initiated
  | 'rolled_back'; // Settlement rolled back successfully

// ==================== Agent Payment Workflow Types ====================

/**
 * AI agent payment workflow configuration
 */
export interface D21AgentPaymentWorkflow {
  workflowId: string;

  // Agent information (links to D24 agent marketplace)
  agentId: string; // D24 agent marketplace ID
  agentIdentityKey?: string; // BRC-31 agent identity

  // Workflow configuration
  workflowType: AgentWorkflowType;
  paymentSteps: AgentPaymentStep[];
  totalEstimatedCostSatoshis: number;

  // Execution tracking
  currentStep: number;
  stepsCompleted: number;
  stepsFailed: number;
  workflowStatus: AgentWorkflowStatus;

  // Authorization and security
  authorizedBy: string; // BRC-31 identity that authorized the workflow
  authorizationSignature: string;
  maxSpendLimitSatoshis: number;

  // Links to BRC-41 and D21 systems
  brc41PaymentIds: string[];
  d21SettlementIds: string[];

  // Lifecycle
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export type AgentWorkflowType =
  | 'batch_payment'      // Multiple payments in sequence
  | 'conditional_payment' // Payments based on conditions
  | 'multi_party'        // Complex multi-party settlements
  | 'recurring'          // Recurring payment schedules
  | 'escrow';            // Escrow-based payments

export type AgentWorkflowStatus =
  | 'pending'    // Workflow created but not started
  | 'executing'  // Workflow currently executing
  | 'completed'  // All steps completed successfully
  | 'failed'     // Workflow failed
  | 'paused'     // Workflow paused by agent or operator
  | 'cancelled'; // Workflow cancelled

/**
 * Individual payment step in agent workflow
 */
export interface AgentPaymentStep {
  stepId: string;
  stepOrder: number;
  stepType: 'brc41_payment' | 'mapi_broadcast' | 'settlement' | 'condition_check';

  // Step configuration
  stepConfig: Record<string, any>;
  expectedCostSatoshis: number;

  // Execution tracking
  stepStatus: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;

  // Dependencies
  dependsOn?: string[]; // Other step IDs this step depends on
  conditions?: AgentPaymentCondition[]; // Conditions for step execution
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

// ==================== Service Interfaces ====================

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

  // Template analytics
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

  // Transaction lifecycle management
  getTransactionStatus(txid: string, providerId?: string): Promise<ARCSubmitTxResponse>;
  waitForTransactionStatus(txid: string, targetStatus: ARCTxStatus, timeout?: number): Promise<ARCSubmitTxResponse>;

  // Batch operations
  batchBroadcast(requests: D21ARCBroadcastRequest[]): Promise<D21ARCBroadcastResult[]>;

  // Provider management
  getProviders(): Promise<D21ARCProvider[]>;
  getProviderHealth(providerId: string): Promise<{
    isHealthy: boolean;
    responseTime: number;
    successRate: number;
    lastChecked: Date;
    currentFeeQuote?: ARCFeeQuote;
  }>;

  // Provider selection with ARC-specific criteria
  selectOptimalProvider(criteria?: {
    maxLatency?: number;
    minSuccessRate?: number;
    preferredProviders?: string[];
    minFeeRate?: number;
    maxTxSize?: number;
  }): Promise<D21ARCProvider>;

  // ARC-specific features
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

  // Settlement coordination
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

  // Workflow management
  pauseWorkflow(workflowId: string): Promise<boolean>;
  cancelWorkflow(workflowId: string): Promise<boolean>;

  // Agent workflow analytics
  getAgentWorkflowHistory(agentId: string): Promise<D21AgentPaymentWorkflow[]>;
}

// ==================== Error Types ====================

export class D21Error extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'D21Error';
  }
}

export class D21TemplateError extends D21Error {
  constructor(
    message: string,
    public templateHash: string,
  ) {
    super(message, 'D21_TEMPLATE_ERROR', 400);
  }
}

export class D21ARCError extends D21Error {
  constructor(
    message: string,
    public provider: string,
    public txid?: string,
  ) {
    super(message, 'D21_ARC_ERROR', 502);
  }
}

export class D21SettlementError extends D21Error {
  constructor(
    message: string,
    public settlementId: string,
  ) {
    super(message, 'D21_SETTLEMENT_ERROR', 500);
  }
}

export class D21WorkflowError extends D21Error {
  constructor(
    message: string,
    public workflowId: string,
  ) {
    super(message, 'D21_WORKFLOW_ERROR', 500);
  }
}

// ==================== Constants ====================

export const D21_VERSION = '1.0';
export const TEMPLATE_EXPIRY_MS = 3600000; // 1 hour
export const SETTLEMENT_TIMEOUT_MS = 1800000; // 30 minutes
export const WORKFLOW_DEFAULT_TIMEOUT_MS = 86400000; // 24 hours

/**
 * Default split rules for payment templates
 */
export const DEFAULT_SPLIT_RULES: PaymentSplitRules = {
  overlay: 0.05,   // 5% platform fee
  producer: 0.90,  // 90% to producer
  agent: 0.05,     // 5% agent commission
};

/**
 * ARC provider defaults
 */
export const DEFAULT_ARC_CONFIG = {
  timeoutSeconds: 30,
  retryAttempts: 3,
  healthCheckInterval: 60000, // 1 minute
  rateLimitPerMinute: 100,
  waitForStatusTimeout: 60000, // 1 minute wait for SEEN_ON_NETWORK
  batchSize: 100, // Maximum transactions per batch
} as const;

/**
 * Default ARC providers (GorillaPool and others)
 */
export const DEFAULT_ARC_PROVIDERS: Omit<D21ARCProvider, 'providerId'>[] = [
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