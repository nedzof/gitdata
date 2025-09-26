"use strict";
/**
 * D21 BSV Native Payment Extensions Routes
 *
 * Express routes that extend BRC-41 with native BSV infrastructure:
 * - Payment templates with deterministic revenue splits
 * - ARC broadcasting with comprehensive lifecycle tracking
 * - Cross-network settlement coordination
 * - AI agent payment workflows
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createD21Routes;
exports.integrateBRC41Payments = integrateBRC41Payments;
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const template_service_js_1 = __importDefault(require("./template-service.js"));
const arc_service_js_1 = __importDefault(require("./arc-service.js"));
const types_js_1 = require("./types.js");
// ==================== Route Factory ====================
function createD21Routes(database, callbackBaseUrl) {
    const router = (0, express_1.Router)();
    // Initialize D21 services
    const templateService = new template_service_js_1.default(database);
    const arcService = new arc_service_js_1.default(database, callbackBaseUrl);
    // Middleware to add D21 services to request
    router.use((req, res, next) => {
        req.d21 = {
            templateService,
            arcService,
        };
        next();
    });
    // ==================== Payment Template Routes ====================
    /**
     * Generate deterministic payment template
     * POST /d21/templates/generate
     */
    router.post('/templates/generate', 
    // Validation
    (0, express_validator_1.body)('splitRules').isObject().withMessage('Split rules must be an object'), (0, express_validator_1.body)('totalSatoshis').isInt({ min: 1 }).withMessage('Total satoshis must be positive'), (0, express_validator_1.body)('createdBy').isString().isLength({ min: 66, max: 66 }).withMessage('Invalid BRC-31 identity key'), (0, express_validator_1.body)('brc41PaymentId').optional().isString().withMessage('BRC-41 payment ID must be string'), async (req, res, next) => {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }
            const { splitRules, totalSatoshis, createdBy, brc41PaymentId, metadata } = req.body;
            // Validate BRC-31 identity if available
            if (req.brc31Identity && req.brc31Identity.identityKey !== createdBy) {
                return res.status(403).json({
                    error: 'Identity mismatch',
                    message: 'createdBy must match authenticated BRC-31 identity'
                });
            }
            console.log(`🎯 Generating payment template for ${totalSatoshis} satoshis`);
            const template = await req.d21.templateService.generateTemplate({
                brc41PaymentId,
                splitRules: splitRules,
                totalSatoshis,
                createdBy,
                metadata,
            });
            res.json({
                success: true,
                template: {
                    templateId: template.templateId,
                    templateHash: template.templateHash,
                    brc41PaymentId: template.brc41PaymentId,
                    splitRules: template.splitRules,
                    outputScripts: template.outputScripts,
                    totalAmountSatoshis: template.totalAmountSatoshis,
                    expiresAt: template.expiresAt,
                }
            });
        }
        catch (error) {
            console.error('Template generation failed:', error);
            if (error instanceof types_js_1.D21TemplateError) {
                return res.status(400).json({ error: error.message, code: error.code });
            }
            next(error);
        }
    });
    /**
     * Get payment template by hash
     * GET /d21/templates/:templateHash
     */
    router.get('/templates/:templateHash', (0, express_validator_1.param)('templateHash').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid template hash'), async (req, res, next) => {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }
            const { templateHash } = req.params;
            const template = await req.d21.templateService.getTemplate(templateHash);
            if (!template) {
                return res.status(404).json({
                    error: 'Template not found',
                    templateHash
                });
            }
            // Verify template integrity
            const isValid = await req.d21.templateService.verifyTemplate(templateHash);
            // Get usage analytics
            const usage = await req.d21.templateService.getTemplateUsage(templateHash);
            res.json({
                success: true,
                template,
                verification: {
                    isValid,
                    verified: isValid
                },
                usage
            });
        }
        catch (error) {
            console.error('Template retrieval failed:', error);
            next(error);
        }
    });
    // ==================== ARC Broadcasting Routes ====================
    /**
     * Broadcast transaction via ARC with lifecycle tracking
     * POST /d21/arc/broadcast
     */
    router.post('/arc/broadcast', 
    // Validation
    (0, express_validator_1.body)('rawTx').isHexadecimal().withMessage('Raw transaction must be valid hex'), (0, express_validator_1.body)('templateId').optional().isString().withMessage('Template ID must be string'), (0, express_validator_1.body)('preferredProvider').optional().isString().withMessage('Preferred provider must be string'), (0, express_validator_1.body)('waitForStatus').optional().isIn([
        'RECEIVED', 'STORED', 'ANNOUNCED_TO_NETWORK', 'SENT_TO_NETWORK', 'SEEN_ON_NETWORK', 'MINED'
    ]).withMessage('Invalid wait status'), (0, express_validator_1.body)('callbackUrl').optional().isURL().withMessage('Callback URL must be valid'), async (req, res, next) => {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }
            const broadcastRequest = {
                rawTx: req.body.rawTx,
                templateId: req.body.templateId,
                preferredProvider: req.body.preferredProvider,
                enableCallbacks: !!req.body.callbackUrl,
                callbackUrl: req.body.callbackUrl,
                waitForStatus: req.body.waitForStatus,
                maxTimeout: req.body.maxTimeout,
            };
            console.log(`🚀 Broadcasting transaction via ARC${broadcastRequest.preferredProvider ? ` (${broadcastRequest.preferredProvider})` : ''}`);
            const result = await req.d21.arcService.broadcastTransaction(broadcastRequest);
            res.json({
                success: true,
                txid: result.txid,
                status: result.status,
                provider: result.broadcastProvider,
                timestamp: result.timestamp,
                lifecycle: {
                    announceTime: result.announceTime,
                    seenOnNetworkTime: result.seenOnNetworkTime,
                    minedTime: result.minedTime,
                },
                arcResponse: result.broadcastResponse
            });
        }
        catch (error) {
            console.error('ARC broadcast failed:', error);
            if (error instanceof types_js_1.D21ARCError) {
                return res.status(502).json({ error: error.message, code: error.code, provider: error.provider });
            }
            next(error);
        }
    });
    /**
     * Get transaction status with full lifecycle
     * GET /d21/arc/tx/:txid/status
     */
    router.get('/arc/tx/:txid/status', (0, express_validator_1.param)('txid').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid transaction ID'), (0, express_validator_1.query)('providerId').optional().isString().withMessage('Provider ID must be string'), async (req, res, next) => {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }
            const { txid } = req.params;
            const { providerId } = req.query;
            const status = await req.d21.arcService.getTransactionStatus(txid, providerId);
            res.json({
                success: true,
                txid,
                status: status.status,
                blockHash: status.blockHash,
                blockHeight: status.blockHeight,
                timestamp: status.timestamp,
                txStatus: status.txStatus,
                extraInfo: status.extraInfo
            });
        }
        catch (error) {
            console.error('Transaction status check failed:', error);
            if (error instanceof types_js_1.D21ARCError) {
                return res.status(502).json({ error: error.message, code: error.code });
            }
            next(error);
        }
    });
    /**
     * Get ARC provider health and capabilities
     * GET /d21/arc/providers
     */
    router.get('/arc/providers', async (req, res, next) => {
        try {
            const providers = await req.d21.arcService.getProviders();
            // Get health status for each provider
            const providersWithHealth = await Promise.all(providers.map(async (provider) => {
                try {
                    const health = await req.d21.arcService.getProviderHealth(provider.providerId);
                    return {
                        ...provider,
                        health: {
                            isHealthy: health.isHealthy,
                            responseTime: health.responseTime,
                            lastChecked: health.lastChecked,
                            currentFeeQuote: health.currentFeeQuote
                        }
                    };
                }
                catch (error) {
                    return {
                        ...provider,
                        health: {
                            isHealthy: false,
                            responseTime: 0,
                            lastChecked: new Date(),
                            error: error.message
                        }
                    };
                }
            }));
            res.json({
                success: true,
                providers: providersWithHealth
            });
        }
        catch (error) {
            console.error('Provider listing failed:', error);
            next(error);
        }
    });
    /**
     * ARC callback endpoint for merkle proofs
     * POST /d21/arc/callback/:providerId
     */
    router.post('/arc/callback/:providerId', (0, express_validator_1.param)('providerId').isString().withMessage('Provider ID is required'), (0, express_validator_1.body)('txid').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid transaction ID'), (0, express_validator_1.body)('merklePath').isHexadecimal().withMessage('Merkle path must be hex'), (0, express_validator_1.body)('blockHeight').isInt({ min: 0 }).withMessage('Block height must be positive integer'), async (req, res, next) => {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }
            const { providerId } = req.params;
            const { txid, merklePath, blockHeight } = req.body;
            console.log(`📨 Received ARC callback from ${providerId} for ${txid.slice(0, 10)}...`);
            await req.d21.arcService.handleARCCallback(providerId, {
                txid,
                merklePath,
                blockHeight
            });
            res.json({ status: 'success' });
        }
        catch (error) {
            console.error('ARC callback processing failed:', error);
            if (error instanceof types_js_1.D21ARCError) {
                return res.status(400).json({ error: error.message, code: error.code });
            }
            next(error);
        }
    });
    // ==================== Error Handler ====================
    router.use((error, req, res, next) => {
        console.error('D21 route error:', error);
        if (error instanceof types_js_1.D21Error) {
            return res.status(error.statusCode).json({
                error: error.message,
                code: error.code
            });
        }
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    });
    return router;
}
// ==================== Route Integration Helpers ====================
/**
 * Integration with BRC-41 payment system
 */
function integrateBRC41Payments(d21Router, brc41PaymentService) {
    // Add middleware to cross-reference BRC-41 payments with D21 templates
    d21Router.use('/templates', async (req, res, next) => {
        if (req.body.brc41PaymentId && brc41PaymentService) {
            try {
                // Verify BRC-41 payment exists
                const payment = await brc41PaymentService.getPaymentRecord(req.body.brc41PaymentId);
                if (!payment) {
                    return res.status(400).json({
                        error: 'BRC-41 payment not found',
                        brc41PaymentId: req.body.brc41PaymentId
                    });
                }
                req.brc41Payment = payment;
            }
            catch (error) {
                console.warn('BRC-41 payment verification failed:', error);
            }
        }
        next();
    });
}
//# sourceMappingURL=routes.js.map