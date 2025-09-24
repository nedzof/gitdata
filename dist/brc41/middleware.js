"use strict";
/**
 * BRC-41 PacketPay Middleware for Express
 *
 * Implements payment walls and micropayment requirements for API endpoints
 * using the BRC-41 PacketPay HTTP payment mechanism.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRC41PaymentMiddleware = void 0;
exports.initializeBRC41PaymentMiddleware = initializeBRC41PaymentMiddleware;
exports.getBRC41PaymentMiddleware = getBRC41PaymentMiddleware;
exports.requireBRC24LookupPayment = requireBRC24LookupPayment;
exports.requireBRC24QueryPayment = requireBRC24QueryPayment;
exports.requireDataSearchPayment = requireDataSearchPayment;
exports.trackAnalyticsUsage = trackAnalyticsUsage;
const middleware_1 = require("../brc31/middleware");
const service_1 = require("./service");
const types_1 = require("./types");
const DEFAULT_CONFIG = {
    enabled: true,
    defaultPricing: types_1.DEFAULT_SERVICE_PRICING,
    freeIdentityLevels: ['certified'], // Certified identities get free access
    requirePaymentForAll: false,
};
// ==================== Main Middleware Class ====================
class BRC41PaymentMiddleware {
    constructor(config) {
        this.initialized = false;
        this.config = { ...DEFAULT_CONFIG, ...config };
        if (!this.config.database) {
            throw new Error('Database adapter is required for BRC-41 middleware');
        }
        this.paymentService = new service_1.BRC41PaymentServiceImpl(this.config.database, this.config.serverPrivateKey);
    }
    async initialize() {
        if (this.initialized)
            return;
        await this.paymentService.initialize();
        this.initialized = true;
    }
    // ==================== Payment Wall Middleware ====================
    /**
     * Creates middleware that requires payment for access
     */
    requirePayment(service, options = {}) {
        return async (req, res, next) => {
            if (!this.config.enabled) {
                return next();
            }
            await this.ensureInitialized();
            try {
                // Check if identity gets free access
                if (options.allowFreeForIdentity !== false && this.hasFreeTierAccess(req)) {
                    console.info(`[BRC-41] Free tier access granted for ${service}`);
                    return next();
                }
                // Calculate usage metrics and pricing
                const usageMetrics = options.calculateUsage
                    ? options.calculateUsage(req)
                    : this.getDefaultUsageMetrics(req);
                const identityLevel = (0, middleware_1.getBRC31Identity)(req)?.level;
                const satoshisRequired = this.paymentService.calculateFee(service, usageMetrics, identityLevel);
                // Check for existing payment
                const paymentHeaders = this.extractPaymentHeaders(req);
                if (paymentHeaders['x-bsv-payment']) {
                    // Process existing payment
                    return await this.processExistingPayment(req, res, next, service, satoshisRequired, paymentHeaders);
                }
                else {
                    // Require new payment
                    return await this.requireNewPayment(req, res, service, satoshisRequired, options.description);
                }
            }
            catch (error) {
                console.error('[BRC-41] Payment middleware error:', error);
                return this.handlePaymentError(res, error);
            }
        };
    }
    /**
     * Creates middleware that tracks usage but doesn't require payment
     */
    trackUsage(service, calculateUsage) {
        return (req, res, next) => {
            if (!this.config.enabled) {
                return next();
            }
            // Attach usage metrics to request for analytics
            req.brc41UsageMetrics = calculateUsage
                ? calculateUsage(req)
                : this.getDefaultUsageMetrics(req);
            // Continue without payment requirement
            next();
        };
    }
    // ==================== Payment Processing ====================
    async processExistingPayment(req, res, next, service, satoshisRequired, paymentHeaders) {
        try {
            // Parse BRC-29 payment from header
            const paymentJson = paymentHeaders['x-bsv-payment'];
            if (!paymentJson) {
                throw new types_1.BRC41PaymentInvalidError('Missing payment data', 'missing_payment');
            }
            const payment = JSON.parse(paymentJson);
            // Create or find payment request
            const identityKey = (0, middleware_1.getBRC31Identity)(req)?.publicKey || 'anonymous';
            const paymentRequest = await this.paymentService.createPaymentRequest({
                service,
                satoshis: satoshisRequired,
                description: `${service} access`,
                identityKey,
            });
            // Process the payment
            const verification = await this.paymentService.processPayment(payment, paymentRequest.paymentId);
            if (!verification.valid) {
                throw new types_1.BRC41PaymentInvalidError(verification.reason || 'Payment verification failed', 'verification_failed');
            }
            // Attach payment info to request
            req.brc41Payment = {
                verified: verification.verified,
                satoshisPaid: verification.satoshisPaid,
                paymentId: paymentRequest.paymentId,
                transactionId: verification.transactionId,
                senderIdentityKey: verification.senderIdentityKey,
            };
            // Add payment confirmation header to response
            res.setHeader('x-bsv-payment-satoshis-paid', verification.satoshisPaid.toString());
            console.info(`[BRC-41] Payment verified: ${verification.satoshisPaid} satoshis for ${service}`);
            return next();
        }
        catch (error) {
            if (error instanceof types_1.BRC41Error) {
                throw error;
            }
            throw new types_1.BRC41PaymentInvalidError('Payment processing failed', 'processing_error');
        }
    }
    async requireNewPayment(req, res, service, satoshisRequired, description) {
        const identityKey = (0, middleware_1.getBRC31Identity)(req)?.publicKey || 'anonymous';
        const paymentRequest = await this.paymentService.createPaymentRequest({
            service,
            satoshis: satoshisRequired,
            description: description || `Payment required for ${service}`,
            identityKey,
        });
        // Set payment required headers
        res.setHeader('x-bsv-payment-satoshis-required', satoshisRequired.toString());
        throw new types_1.BRC41PaymentRequiredError(paymentRequest);
    }
    // ==================== Service-Specific Middleware Factories ====================
    /**
     * Payment middleware for BRC-24 lookup services
     */
    brc24LookupPayment() {
        return this.requirePayment(types_1.SERVICE_TYPES.BRC24_LOOKUP, {
            calculateUsage: (req) => ({
                complexity: 1.0,
                dataSize: this.estimateRequestSize(req),
                computeTime: 100, // 100ms estimated
                cacheable: true,
                priority: 'normal',
            }),
            description: 'BRC-24 Agent Lookup',
        });
    }
    /**
     * Payment middleware for BRC-24 query services
     */
    brc24QueryPayment() {
        return this.requirePayment(types_1.SERVICE_TYPES.BRC24_QUERY, {
            calculateUsage: (req) => ({
                complexity: 1.5,
                dataSize: this.estimateRequestSize(req),
                computeTime: 250, // 250ms estimated for queries
                cacheable: false,
                priority: this.extractPriority(req),
            }),
            description: 'BRC-24 Agent Query',
        });
    }
    /**
     * Payment middleware for data search services
     */
    dataSearchPayment() {
        return this.requirePayment(types_1.SERVICE_TYPES.DATA_SEARCH, {
            calculateUsage: (req) => {
                const query = req.query.q || '';
                const limit = parseInt(req.query.limit || '10');
                return {
                    complexity: Math.max(1.0, query.length / 100),
                    dataSize: limit * 1000, // Estimated 1KB per result
                    computeTime: 500 + limit * 10,
                    cacheable: true,
                    priority: this.extractPriority(req),
                };
            },
            description: 'Data Search Service',
        });
    }
    /**
     * Payment middleware for analytics services
     */
    analyticsPayment() {
        return this.requirePayment(types_1.SERVICE_TYPES.ANALYTICS, {
            calculateUsage: (req) => ({
                complexity: 2.0,
                dataSize: this.estimateRequestSize(req),
                computeTime: 1000, // 1s for analytics
                cacheable: false,
                priority: 'low',
            }),
            description: 'Analytics Service',
            allowFreeForIdentity: false, // Analytics always requires payment
        });
    }
    // ==================== Helper Methods ====================
    hasFreeTierAccess(req) {
        if (!(0, middleware_1.isBRC31Request)(req))
            return false;
        const identity = (0, middleware_1.getBRC31Identity)(req);
        return identity && this.config.freeIdentityLevels.includes(identity.level);
    }
    extractPaymentHeaders(req) {
        return {
            'x-bsv-payment-satoshis-required': req.headers['x-bsv-payment-satoshis-required'],
            'x-bsv-payment': req.headers['x-bsv-payment'],
            'x-bsv-payment-satoshis-paid': req.headers['x-bsv-payment-satoshis-paid'],
        };
    }
    getDefaultUsageMetrics(req) {
        return {
            complexity: 1.0,
            dataSize: this.estimateRequestSize(req),
            computeTime: 100,
            cacheable: req.method === 'GET',
            priority: 'normal',
        };
    }
    estimateRequestSize(req) {
        let size = req.url.length;
        if (req.body) {
            size += JSON.stringify(req.body).length;
        }
        return size;
    }
    extractPriority(req) {
        const priority = req.headers['x-priority'];
        if (priority === 'high' || priority === 'low') {
            return priority;
        }
        return 'normal';
    }
    handlePaymentError(res, error) {
        if (error instanceof types_1.BRC41PaymentRequiredError) {
            return res.status(402).json({
                error: 'payment-required',
                message: 'Payment required to access this resource',
                paymentRequest: error.paymentRequest,
                brc41: {
                    version: '1.0',
                    supported: true,
                },
            });
        }
        if (error instanceof types_1.BRC41Error) {
            return res.status(error.statusCode).json({
                error: error.code,
                message: error.message,
                brc41: {
                    version: '1.0',
                    supported: true,
                },
            });
        }
        console.error('[BRC-41] Unexpected payment error:', error);
        return res.status(500).json({
            error: 'brc41-internal-error',
            message: 'Internal payment processing error',
            brc41: {
                version: '1.0',
                supported: true,
            },
        });
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    // ==================== Analytics and Management ====================
    async getPaymentStats() {
        await this.ensureInitialized();
        return await this.paymentService.getPaymentAnalytics();
    }
    async updateServicePricing(service, pricing) {
        await this.ensureInitialized();
        return await this.paymentService.updateServicePricing(service, pricing);
    }
}
exports.BRC41PaymentMiddleware = BRC41PaymentMiddleware;
// ==================== Factory Functions ====================
let globalBRC41Middleware = null;
/**
 * Initialize the global BRC-41 payment middleware
 */
function initializeBRC41PaymentMiddleware(config) {
    globalBRC41Middleware = new BRC41PaymentMiddleware(config);
    return globalBRC41Middleware;
}
/**
 * Get the global BRC-41 payment middleware
 */
function getBRC41PaymentMiddleware() {
    if (!globalBRC41Middleware) {
        throw new Error('BRC-41 payment middleware not initialized. Call initializeBRC41PaymentMiddleware() first.');
    }
    return globalBRC41Middleware;
}
// ==================== Convenience Middleware Functions ====================
/**
 * Require payment for BRC-24 lookup services
 */
function requireBRC24LookupPayment() {
    return (req, res, next) => {
        const middleware = getBRC41PaymentMiddleware();
        return middleware.brc24LookupPayment()(req, res, next);
    };
}
/**
 * Require payment for BRC-24 query services
 */
function requireBRC24QueryPayment() {
    return (req, res, next) => {
        const middleware = getBRC41PaymentMiddleware();
        return middleware.brc24QueryPayment()(req, res, next);
    };
}
/**
 * Require payment for data search services
 */
function requireDataSearchPayment() {
    return (req, res, next) => {
        const middleware = getBRC41PaymentMiddleware();
        return middleware.dataSearchPayment()(req, res, next);
    };
}
/**
 * Track usage for analytics services
 */
function trackAnalyticsUsage() {
    return (req, res, next) => {
        const middleware = getBRC41PaymentMiddleware();
        return middleware.trackUsage(types_1.SERVICE_TYPES.ANALYTICS)(req, res, next);
    };
}
//# sourceMappingURL=middleware.js.map