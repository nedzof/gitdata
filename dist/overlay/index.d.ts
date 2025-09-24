export { BSVOverlayService } from './bsv-overlay-service';
export { OverlayManager } from './overlay-manager';
export { OverlayPaymentService } from './overlay-payments';
export { BRC22SubmitService } from './brc22-submit';
export { BRC24LookupService } from './brc24-lookup';
export { BRC64HistoryService } from './brc64-history';
export { BRC88SHIPSLAPService } from './brc88-ship-slap';
export { BRC26UHRPService } from './brc26-uhrp';
export { OverlayAgentRegistry } from '../agents/overlay-agent-registry';
export { OverlayRuleEngine } from '../agents/overlay-rule-engine';
export { AgentExecutionService } from '../agents/agent-execution-service';
export { getOverlayConfig, D01A_TOPICS, TopicGenerator, TopicSubscriptionManager, TOPIC_CLASSIFICATION, } from './overlay-config';
export type { OverlayConfig, D01AData, OverlayMessage } from './bsv-overlay-service';
export type { OverlayManagerConfig, OverlayDataEvent } from './overlay-manager';
export type { PaymentQuote, PaymentRequest, PaymentReceipt } from './overlay-payments';
export type { BRC22Transaction, BRC22Response, TopicManager } from './brc22-submit';
export type { BRC24Query, BRC24Response, BRC36UTXO, LookupProvider } from './brc24-lookup';
export type { HistoricalUTXO, HistoryQuery, LineageGraph } from './brc64-history';
export type { SHIPAdvertisement, SLAPAdvertisement, ServiceNode } from './brc88-ship-slap';
export type { UHRPAdvertisement, UHRPContent, UHRPQuery, UHRPHost } from './brc26-uhrp';
import { OverlayManager } from './overlay-manager';
import { OverlayPaymentService } from './overlay-payments';
import { PostgreSQLBRC22SubmitService, PostgreSQLBRC24LookupService, PostgreSQLBRC64HistoryService, PostgreSQLBRC88SHIPSLAPService } from './brc-services-postgresql';
import { BRC26UHRPService } from './brc26-uhrp';
import { StreamingService } from '../streaming/streaming-service';
import { FederationManager } from './federation-manager';
import { AdvancedStreamingService } from '../streaming/advanced-streaming-service';
import type { Pool } from 'pg';
import { AgentExecutionService } from '../agents/agent-execution-service';
import { OverlayAgentRegistry } from '../agents/overlay-agent-registry';
import { OverlayRuleEngine } from '../agents/overlay-rule-engine';
export interface GitdataOverlayServices {
    overlayManager: OverlayManager;
    paymentService: OverlayPaymentService;
    brc22Service: PostgreSQLBRC22SubmitService;
    brc24Service: PostgreSQLBRC24LookupService;
    brc64Service: PostgreSQLBRC64HistoryService;
    brc88Service: PostgreSQLBRC88SHIPSLAPService;
    brc26Service: BRC26UHRPService;
    agentRegistry: OverlayAgentRegistry;
    ruleEngine: OverlayRuleEngine;
    executionService: AgentExecutionService;
    streamingService?: StreamingService;
    federationManager?: FederationManager;
    advancedStreamingService?: AdvancedStreamingService;
}
/**
 * Initialize complete BSV overlay services with BRC standards for Gitdata
 */
export declare function initializeOverlayServices(database: Pool, environment?: 'development' | 'staging' | 'production', myDomain?: string, options?: {
    storageBasePath?: string;
    baseUrl?: string;
}): Promise<GitdataOverlayServices>;
