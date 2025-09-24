/**
 * D21 BSV Native Payment Extensions
 *
 * Main export file for D21 extensions to BRC-41 PacketPay system.
 * Provides native BSV infrastructure capabilities that complement HTTP micropayments.
 */

// Core types
export type {
  D21PaymentTemplate,
  PaymentSplitRules,
  PaymentOutput,
  D21ARCProvider,
  D21ARCBroadcastRequest,
  D21ARCBroadcastResult,
  ARCTxStatus,
  ARCSubmitTxResponse,
  ARCFeeQuote,
  ARCPolicyQuote,
  D21CrossNetworkSettlement,
  D21AgentPaymentWorkflow,
  AgentWorkflowType,
  AgentPaymentStep,
  D21PaymentTemplateService,
  D21ARCBroadcastService,
  D21CrossNetworkSettlementService,
  D21AgentPaymentWorkflowService,
} from './types.js';

// Error types
export {
  D21Error,
  D21TemplateError,
  D21ARCError,
  D21SettlementError,
  D21WorkflowError,
} from './types.js';

// Constants and defaults
export {
  D21_VERSION,
  TEMPLATE_EXPIRY_MS,
  SETTLEMENT_TIMEOUT_MS,
  WORKFLOW_DEFAULT_TIMEOUT_MS,
  DEFAULT_SPLIT_RULES,
  DEFAULT_ARC_CONFIG,
  DEFAULT_ARC_PROVIDERS,
} from './types.js';

// Service implementations
export { default as D21PaymentTemplateServiceImpl } from './template-service.js';
export { default as D21ARCBroadcastServiceImpl } from './arc-service.js';

// Express routes
export { default as createD21Routes, integrateBRC41Payments } from './routes.js';
export type { D21Request } from './routes.js';

// ==================== Convenience Exports ====================

/**
 * Initialize complete D21 system with all services
 */
export async function initializeD21System(
  database: any,
  callbackBaseUrl?: string
): Promise<{
  templateService: import('./template-service.js').default;
  arcService: import('./arc-service.js').default;
  routes: import('express').Router;
}> {
  // Import services dynamically to avoid circular dependencies
  const { default: D21PaymentTemplateServiceImpl } = await import('./template-service.js');
  const { default: D21ARCBroadcastServiceImpl } = await import('./arc-service.js');
  const { default: createD21Routes } = await import('./routes.js');

  // Initialize services
  const templateService = new D21PaymentTemplateServiceImpl(database);
  const arcService = new D21ARCBroadcastServiceImpl(database, callbackBaseUrl);

  // Initialize services
  await templateService.initialize();
  await arcService.initialize();

  // Create routes
  const routes = createD21Routes(database, callbackBaseUrl);

  console.log('✅ D21 BSV Native Payment Extensions initialized');

  return {
    templateService,
    arcService,
    routes,
  };
}

/**
 * Create D21 middleware for Express applications
 */
export function createD21Middleware(
  database: any,
  callbackBaseUrl?: string,
  options?: {
    enableTemplates?: boolean;
    enableARC?: boolean;
    enableSettlement?: boolean;
    enableAgentWorkflows?: boolean;
  }
) {
  return async function d21Middleware(req: any, res: any, next: any) {
    try {
      // Initialize D21 system if not already done
      if (!req.app.locals.d21System) {
        req.app.locals.d21System = await initializeD21System(database, callbackBaseUrl);
      }

      // Add D21 services to request
      req.d21 = req.app.locals.d21System;

      next();
    } catch (error) {
      console.error('D21 middleware initialization failed:', error);
      next(error);
    }
  };
}

/**
 * Health check for D21 services
 */
export async function checkD21Health(
  templateService: import('./template-service.js').default,
  arcService: import('./arc-service.js').default
): Promise<{
  status: 'healthy' | 'unhealthy';
  services: {
    templates: { status: string; error?: string };
    arc: { status: string; providers: number; error?: string };
  };
}> {
  const health = {
    status: 'healthy' as 'healthy' | 'unhealthy',
    services: {
      templates: { status: 'unknown' as string },
      arc: { status: 'unknown' as string, providers: 0 },
    },
  };

  try {
    // Check template service
    await templateService.verifyTemplate('test');
    health.services.templates.status = 'healthy';
  } catch (error) {
    health.services.templates.status = 'unhealthy';
    health.services.templates.error = error.message;
    health.status = 'unhealthy';
  }

  try {
    // Check ARC service
    const providers = await arcService.getProviders();
    health.services.arc.providers = providers.length;
    health.services.arc.status = providers.length > 0 ? 'healthy' : 'no_providers';

    if (providers.length === 0) {
      health.status = 'unhealthy';
    }
  } catch (error) {
    health.services.arc.status = 'unhealthy';
    health.services.arc.error = error.message;
    health.status = 'unhealthy';
  }

  return health;
}

/**
 * Get D21 system statistics
 */
export async function getD21Stats(
  templateService: import('./template-service.js').default,
  arcService: import('./arc-service.js').default
): Promise<{
  templates: { total: number };
  arc: {
    providers: number;
    transactions: number;
    averageResponseTime: number;
  };
}> {
  try {
    const providers = await arcService.getProviders();

    const stats = {
      templates: { total: 0 }, // Would need database query to get actual count
      arc: {
        providers: providers.length,
        transactions: providers.reduce((sum, p) => sum + p.totalBroadcasts, 0),
        averageResponseTime: providers.length > 0
          ? providers.reduce((sum, p) => sum + p.averageResponseTimeMs, 0) / providers.length
          : 0,
      },
    };

    return stats;
  } catch (error) {
    console.error('Failed to get D21 stats:', error);
    return {
      templates: { total: 0 },
      arc: { providers: 0, transactions: 0, averageResponseTime: 0 },
    };
  }
}

// ==================== Integration Helpers ====================

/**
 * Create complete payment workflow combining BRC-41 and D21
 */
export async function createCompletePaymentWorkflow(
  brc41Service: any,
  d21TemplateService: import('./template-service.js').default,
  d21ArcService: import('./arc-service.js').default,
  params: {
    service: string;
    satoshis: number;
    splitRules: import('./types.js').PaymentSplitRules;
    identityKey: string;
    enableARC?: boolean;
  }
): Promise<{
  brc41Payment: any;
  d21Template?: import('./types.js').D21PaymentTemplate;
  workflow: 'http_micropayment' | 'native_broadcast' | 'hybrid';
}> {
  try {
    // Step 1: Create BRC-41 payment request
    const brc41Payment = await brc41Service.createPaymentRequest({
      service: params.service,
      satoshis: params.satoshis,
      description: `Payment for ${params.service}`,
      identityKey: params.identityKey,
    });

    let d21Template: import('./types.js').D21PaymentTemplate | undefined;
    let workflow: 'http_micropayment' | 'native_broadcast' | 'hybrid' = 'http_micropayment';

    // Step 2: If custom splits are needed, create D21 template
    if (params.splitRules && Object.keys(params.splitRules).length > 1) {
      d21Template = await d21TemplateService.generateTemplate({
        brc41PaymentId: brc41Payment.paymentId,
        splitRules: params.splitRules,
        totalSatoshis: params.satoshis,
        createdBy: params.identityKey,
      });

      workflow = params.enableARC ? 'hybrid' : 'native_broadcast';
    }

    console.log(`✅ Created ${workflow} payment workflow`);

    return {
      brc41Payment,
      d21Template,
      workflow,
    };

  } catch (error) {
    console.error('Failed to create complete payment workflow:', error);
    throw error;
  }
}

export default {
  initializeD21System,
  createD21Middleware,
  checkD21Health,
  getD21Stats,
  createCompletePaymentWorkflow,
};