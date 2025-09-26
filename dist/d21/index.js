"use strict";
/**
 * D21 BSV Native Payment Extensions
 *
 * Main export file for D21 extensions to BRC-41 PacketPay system.
 * Provides native BSV infrastructure capabilities that complement HTTP micropayments.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrateBRC41Payments = exports.createD21Routes = exports.D21ARCBroadcastServiceImpl = exports.D21PaymentTemplateServiceImpl = exports.DEFAULT_ARC_PROVIDERS = exports.DEFAULT_ARC_CONFIG = exports.DEFAULT_SPLIT_RULES = exports.WORKFLOW_DEFAULT_TIMEOUT_MS = exports.SETTLEMENT_TIMEOUT_MS = exports.TEMPLATE_EXPIRY_MS = exports.D21_VERSION = exports.D21WorkflowError = exports.D21SettlementError = exports.D21ARCError = exports.D21TemplateError = exports.D21Error = void 0;
exports.initializeD21System = initializeD21System;
exports.createD21Middleware = createD21Middleware;
exports.checkD21Health = checkD21Health;
exports.getD21Stats = getD21Stats;
exports.createCompletePaymentWorkflow = createCompletePaymentWorkflow;
// Error types
var types_js_1 = require("./types.js");
Object.defineProperty(exports, "D21Error", { enumerable: true, get: function () { return types_js_1.D21Error; } });
Object.defineProperty(exports, "D21TemplateError", { enumerable: true, get: function () { return types_js_1.D21TemplateError; } });
Object.defineProperty(exports, "D21ARCError", { enumerable: true, get: function () { return types_js_1.D21ARCError; } });
Object.defineProperty(exports, "D21SettlementError", { enumerable: true, get: function () { return types_js_1.D21SettlementError; } });
Object.defineProperty(exports, "D21WorkflowError", { enumerable: true, get: function () { return types_js_1.D21WorkflowError; } });
// Constants and defaults
var types_js_2 = require("./types.js");
Object.defineProperty(exports, "D21_VERSION", { enumerable: true, get: function () { return types_js_2.D21_VERSION; } });
Object.defineProperty(exports, "TEMPLATE_EXPIRY_MS", { enumerable: true, get: function () { return types_js_2.TEMPLATE_EXPIRY_MS; } });
Object.defineProperty(exports, "SETTLEMENT_TIMEOUT_MS", { enumerable: true, get: function () { return types_js_2.SETTLEMENT_TIMEOUT_MS; } });
Object.defineProperty(exports, "WORKFLOW_DEFAULT_TIMEOUT_MS", { enumerable: true, get: function () { return types_js_2.WORKFLOW_DEFAULT_TIMEOUT_MS; } });
Object.defineProperty(exports, "DEFAULT_SPLIT_RULES", { enumerable: true, get: function () { return types_js_2.DEFAULT_SPLIT_RULES; } });
Object.defineProperty(exports, "DEFAULT_ARC_CONFIG", { enumerable: true, get: function () { return types_js_2.DEFAULT_ARC_CONFIG; } });
Object.defineProperty(exports, "DEFAULT_ARC_PROVIDERS", { enumerable: true, get: function () { return types_js_2.DEFAULT_ARC_PROVIDERS; } });
// Service implementations
var template_service_js_1 = require("./template-service.js");
Object.defineProperty(exports, "D21PaymentTemplateServiceImpl", { enumerable: true, get: function () { return __importDefault(template_service_js_1).default; } });
var arc_service_js_1 = require("./arc-service.js");
Object.defineProperty(exports, "D21ARCBroadcastServiceImpl", { enumerable: true, get: function () { return __importDefault(arc_service_js_1).default; } });
// Express routes
var routes_js_1 = require("./routes.js");
Object.defineProperty(exports, "createD21Routes", { enumerable: true, get: function () { return __importDefault(routes_js_1).default; } });
Object.defineProperty(exports, "integrateBRC41Payments", { enumerable: true, get: function () { return routes_js_1.integrateBRC41Payments; } });
// ==================== Convenience Exports ====================
/**
 * Initialize complete D21 system with all services
 */
async function initializeD21System(database, callbackBaseUrl) {
    // Import services dynamically to avoid circular dependencies
    const { default: D21PaymentTemplateServiceImpl } = await Promise.resolve().then(() => __importStar(require('./template-service.js')));
    const { default: D21ARCBroadcastServiceImpl } = await Promise.resolve().then(() => __importStar(require('./arc-service.js')));
    const { default: createD21Routes } = await Promise.resolve().then(() => __importStar(require('./routes.js')));
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
function createD21Middleware(database, callbackBaseUrl, options) {
    return async function d21Middleware(req, res, next) {
        try {
            // Initialize D21 system if not already done
            if (!req.app.locals.d21System) {
                req.app.locals.d21System = await initializeD21System(database, callbackBaseUrl);
            }
            // Add D21 services to request
            req.d21 = req.app.locals.d21System;
            next();
        }
        catch (error) {
            console.error('D21 middleware initialization failed:', error);
            next(error);
        }
    };
}
/**
 * Health check for D21 services
 */
async function checkD21Health(templateService, arcService) {
    const health = {
        status: 'healthy',
        services: {
            templates: { status: 'unknown' },
            arc: { status: 'unknown', providers: 0 },
        },
    };
    try {
        // Check template service
        await templateService.verifyTemplate('test');
        health.services.templates.status = 'healthy';
    }
    catch (error) {
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
    }
    catch (error) {
        health.services.arc.status = 'unhealthy';
        health.services.arc.error = error.message;
        health.status = 'unhealthy';
    }
    return health;
}
/**
 * Get D21 system statistics
 */
async function getD21Stats(templateService, arcService) {
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
    }
    catch (error) {
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
async function createCompletePaymentWorkflow(brc41Service, d21TemplateService, d21ArcService, params) {
    try {
        // Step 1: Create BRC-41 payment request
        const brc41Payment = await brc41Service.createPaymentRequest({
            service: params.service,
            satoshis: params.satoshis,
            description: `Payment for ${params.service}`,
            identityKey: params.identityKey,
        });
        let d21Template;
        let workflow = 'http_micropayment';
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
    }
    catch (error) {
        console.error('Failed to create complete payment workflow:', error);
        throw error;
    }
}
exports.default = {
    initializeD21System,
    createD21Middleware,
    checkD21Health,
    getD21Stats,
    createCompletePaymentWorkflow,
};
//# sourceMappingURL=index.js.map