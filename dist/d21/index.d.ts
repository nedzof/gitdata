/**
 * D21 BSV Native Payment Extensions
 *
 * Main export file for D21 extensions to BRC-41 PacketPay system.
 * Provides native BSV infrastructure capabilities that complement HTTP micropayments.
 */
export type { D21PaymentTemplate, PaymentSplitRules, PaymentOutput, D21ARCProvider, D21ARCBroadcastRequest, D21ARCBroadcastResult, ARCTxStatus, ARCSubmitTxResponse, ARCFeeQuote, ARCPolicyQuote, D21CrossNetworkSettlement, D21AgentPaymentWorkflow, AgentWorkflowType, AgentPaymentStep, D21PaymentTemplateService, D21ARCBroadcastService, D21CrossNetworkSettlementService, D21AgentPaymentWorkflowService, } from './types.js';
export { D21Error, D21TemplateError, D21ARCError, D21SettlementError, D21WorkflowError, } from './types.js';
export { D21_VERSION, TEMPLATE_EXPIRY_MS, SETTLEMENT_TIMEOUT_MS, WORKFLOW_DEFAULT_TIMEOUT_MS, DEFAULT_SPLIT_RULES, DEFAULT_ARC_CONFIG, DEFAULT_ARC_PROVIDERS, } from './types.js';
export { default as D21PaymentTemplateServiceImpl } from './template-service.js';
export { default as D21ARCBroadcastServiceImpl } from './arc-service.js';
export { default as createD21Routes, integrateBRC41Payments } from './routes.js';
export type { D21Request } from './routes.js';
/**
 * Initialize complete D21 system with all services
 */
export declare function initializeD21System(database: any, callbackBaseUrl?: string): Promise<{
    templateService: import('./template-service.js').default;
    arcService: import('./arc-service.js').default;
    routes: import('express').Router;
}>;
/**
 * Create D21 middleware for Express applications
 */
export declare function createD21Middleware(database: any, callbackBaseUrl?: string, options?: {
    enableTemplates?: boolean;
    enableARC?: boolean;
    enableSettlement?: boolean;
    enableAgentWorkflows?: boolean;
}): (req: any, res: any, next: any) => Promise<void>;
/**
 * Health check for D21 services
 */
export declare function checkD21Health(templateService: import('./template-service.js').default, arcService: import('./arc-service.js').default): Promise<{
    status: 'healthy' | 'unhealthy';
    services: {
        templates: {
            status: string;
            error?: string;
        };
        arc: {
            status: string;
            providers: number;
            error?: string;
        };
    };
}>;
/**
 * Get D21 system statistics
 */
export declare function getD21Stats(templateService: import('./template-service.js').default, arcService: import('./arc-service.js').default): Promise<{
    templates: {
        total: number;
    };
    arc: {
        providers: number;
        transactions: number;
        averageResponseTime: number;
    };
}>;
/**
 * Create complete payment workflow combining BRC-41 and D21
 */
export declare function createCompletePaymentWorkflow(brc41Service: any, d21TemplateService: import('./template-service.js').default, d21ArcService: import('./arc-service.js').default, params: {
    service: string;
    satoshis: number;
    splitRules: import('./types.js').PaymentSplitRules;
    identityKey: string;
    enableARC?: boolean;
}): Promise<{
    brc41Payment: any;
    d21Template?: import('./types.js').D21PaymentTemplate;
    workflow: 'http_micropayment' | 'native_broadcast' | 'hybrid';
}>;
declare const _default: {
    initializeD21System: typeof initializeD21System;
    createD21Middleware: typeof createD21Middleware;
    checkD21Health: typeof checkD21Health;
    getD21Stats: typeof getD21Stats;
    createCompletePaymentWorkflow: typeof createCompletePaymentWorkflow;
};
export default _default;
