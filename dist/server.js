"use strict";
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
exports.server = exports.app = void 0;
/**
 * Main server entry point for the Gitdata overlay application
 */
const express_1 = __importDefault(require("express"));
const swagger_setup_1 = require("./docs/swagger-setup");
const audit_1 = require("./middleware/audit");
const limits_1 = require("./middleware/limits");
const metrics_1 = require("./middleware/metrics");
const advisories_1 = require("./routes/advisories");
const agent_marketplace_1 = require("./routes/agent-marketplace");
const agents_1 = require("./routes/agents");
const artifacts_1 = require("./routes/artifacts");
const bundle_1 = require("./routes/bundle");
const catalog_1 = require("./routes/catalog");
const d06_agent_payments_1 = require("./routes/d06-agent-payments");
const d06_payment_processing_1 = require("./routes/d06-payment-processing");
const d06_revenue_management_1 = require("./routes/d06-revenue-management");
const d07_streaming_quotas_1 = __importDefault(require("./routes/d07-streaming-quotas"));
const d22_overlay_storage_1 = require("./routes/d22-overlay-storage");
const data_1 = require("./routes/data");
const health_1 = require("./routes/health");
const jobs_1 = require("./routes/jobs");
const listings_1 = require("./routes/listings");
const metrics_2 = require("./routes/metrics");
const openlineage_1 = require("./routes/openlineage");
const overlay_1 = require("./routes/overlay");
const overlay_brc_1 = require("./routes/overlay-brc");
const overlay_brc_31_1 = require("./routes/overlay-brc-31");
const pay_1 = require("./routes/pay");
const payments_1 = require("./routes/payments");
const price_1 = require("./routes/price");
const producer_1 = require("./routes/producer");
const producers_1 = require("./routes/producers");
const producers_register_1 = require("./routes/producers-register");
const ready_1 = require("./routes/ready");
const rules_1 = require("./routes/rules");
const storage_1 = require("./routes/storage");
const streaming_market_1 = require("./routes/streaming-market");
const submit_builder_1 = require("./routes/submit-builder");
const submit_receiver_1 = require("./routes/submit-receiver");
const templates_1 = require("./routes/templates");
const wallet_1 = require("./routes/wallet");
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT || 8788;
// Basic CORS configuration
app.use((req, res, next) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:5173',
    ];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
});
// Global middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static files from UI build directory
app.use(express_1.default.static('./ui/build'));
// Request logging and metrics
app.use((0, audit_1.auditLogger)());
app.use((0, metrics_1.metricsMiddleware)());
app.use((0, limits_1.limitsMiddleware)());
// D20 Phase 1: Setup API documentation
(0, swagger_setup_1.setupSwaggerUI)(app);
// Health and readiness checks
app.use((0, health_1.healthRouter)());
app.use((0, ready_1.readyRouter)());
// Core data routes
app.use('/v1', (0, data_1.dataRouter)());
app.use('/v1', (0, bundle_1.bundleRouter)());
app.use('/v1', (0, price_1.priceRouter)());
app.use('/v1', (0, pay_1.payRouter)());
app.use('/v1', (0, advisories_1.advisoriesRouter)());
app.use('/v1', (0, catalog_1.catalogRouter)());
app.use('/v1', (0, metrics_2.metricsRouter)());
// Producer and identity management
app.use('/v1', (0, producers_1.producersRouter)());
app.use('/v1', (0, producers_register_1.producersRegisterRouter)());
// app.use('/v1', identityRouter()); // Temporarily disabled
// Payment processing
app.use('/v1', (0, payments_1.paymentsRouter)());
app.use('/v1', (0, d06_payment_processing_1.d06PaymentProcessingRouter)());
app.use('/v1', (0, d06_agent_payments_1.d06AgentPaymentsRouter)());
app.use('/v1', (0, d06_revenue_management_1.d06RevenueManagementRouter)());
// Storage and file management
app.use('/v1', (0, storage_1.storageRouter)());
app.use('/v1', (0, d22_overlay_storage_1.d22OverlayStorageRouter)());
app.use('/v1', (0, artifacts_1.artifactsRouter)());
// Templating and workflow
app.use('/v1', (0, templates_1.templatesRouter)());
app.use('/v1', (0, wallet_1.walletRouter)());
// Overlay network integration
app.use('/v1', (0, overlay_1.overlayRouter)().router);
app.use('/v1', (0, overlay_brc_1.overlayBrcRouter)().router);
// BRC-31 Enhanced Overlay Integration (initialize after database setup)
let brc31Router = null;
app.use('/v1', (0, submit_builder_1.submitBuilderRouter)());
app.use('/v1', (0, submit_receiver_1.submitReceiverRouterWrapper)());
// Data lineage and provenance
app.use('/v1', (0, openlineage_1.openlineageRouter)());
app.use('/v1', (0, listings_1.listingsRouter)());
// Streaming and real-time data
app.use('/v1/streaming', (0, limits_1.rateLimit)('streaming'), d07_streaming_quotas_1.default);
try {
    console.log('🔄 Loading streaming market router...');
    const smRouter = (0, streaming_market_1.streamingMarketRouter)();
    console.log('✅ Streaming market router loaded:', typeof smRouter);
    console.log('🔗 Mounting streaming market at /v1/streaming-market');
    app.use('/v1/streaming-market', smRouter);
    console.log('✅ Streaming market router mounted');
}
catch (error) {
    console.error('❌ Error loading streaming market router:', error);
}
app.use('/v1/producer', (0, producer_1.producerRouter)());
// Agent marketplace
app.use('/v1/agent-marketplace', (0, agent_marketplace_1.agentMarketplaceRouter)().router);
// D24 BSV Overlay Network Agent Management
app.use('/agents', (0, agents_1.agentsRouter)());
app.use('/rules', (0, rules_1.rulesRouter)());
app.use('/jobs', (0, jobs_1.jobsRouter)());
app.use('/templates', (0, templates_1.templatesRouter)());
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            error: 'Request entity too large',
            message: 'The request payload exceeds the maximum allowed size',
        });
    }
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    });
});
// Catch-all handler - serve index.html for SPA routes
app.get('*', (req, res) => {
    // If it's an API route that doesn't exist, return 404 JSON
    if (req.path.startsWith('/api') || req.path.startsWith('/v1')) {
        return res.status(404).json({
            success: false,
            error: 'Not found',
            message: `Route ${req.method} ${req.originalUrl} not found`,
        });
    }
    // For all other routes, serve the SPA
    res.sendFile('./ui/build/index.html', { root: '.' });
});
// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
// Initialize BRC-31 services
async function initializeBRC31Services() {
    try {
        // Import BRC-31 and BRC-41 services
        const { initializeBRC31Middleware } = await Promise.resolve().then(() => __importStar(require('./brc31/middleware')));
        const { initializeBRC41PaymentMiddleware } = await Promise.resolve().then(() => __importStar(require('./brc41/middleware')));
        const { Pool } = await Promise.resolve().then(() => __importStar(require('pg')));
        const { initializeOverlayServices } = await Promise.resolve().then(() => __importStar(require('./overlay/index')));
        // Create PostgreSQL pool
        const dbPool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'gitdata',
            user: process.env.DB_USER || 'gitdata',
            password: process.env.DB_PASSWORD || 'gitdata',
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        });
        // Initialize overlay services (includes database adapter)
        const overlayServices = await initializeOverlayServices(dbPool, process.env.NODE_ENV || 'development', process.env.DOMAIN_NAME || 'localhost:8788');
        // Initialize BRC-31 middleware
        const brc31Middleware = initializeBRC31Middleware({
            database: {
                query: async (sql, params = []) => {
                    const client = await dbPool.connect();
                    try {
                        const result = await client.query(sql, params);
                        return result.rows;
                    }
                    finally {
                        client.release();
                    }
                },
                queryOne: async (sql, params = []) => {
                    const client = await dbPool.connect();
                    try {
                        const result = await client.query(sql, params);
                        return result.rows[0] || null;
                    }
                    finally {
                        client.release();
                    }
                },
                execute: async (sql, params = []) => {
                    const client = await dbPool.connect();
                    try {
                        await client.query(sql, params);
                    }
                    finally {
                        client.release();
                    }
                },
            },
            enabled: process.env.BRC31_ENABLED !== 'false',
            serverPrivateKey: process.env.BRC31_SERVER_PRIVATE_KEY,
        });
        await brc31Middleware.initialize();
        // Initialize BRC-41 payment middleware
        const brc41PaymentMiddleware = initializeBRC41PaymentMiddleware({
            database: {
                query: async (sql, params = []) => {
                    const client = await dbPool.connect();
                    try {
                        const result = await client.query(sql, params);
                        return result.rows;
                    }
                    finally {
                        client.release();
                    }
                },
                queryOne: async (sql, params = []) => {
                    const client = await dbPool.connect();
                    try {
                        const result = await client.query(sql, params);
                        return result.rows[0] || null;
                    }
                    finally {
                        client.release();
                    }
                },
                execute: async (sql, params = []) => {
                    const client = await dbPool.connect();
                    try {
                        await client.query(sql, params);
                    }
                    finally {
                        client.release();
                    }
                },
            },
            serverPrivateKey: process.env.BRC41_SERVER_PRIVATE_KEY || process.env.BRC31_SERVER_PRIVATE_KEY,
            enabled: process.env.BRC41_ENABLED !== 'false',
        });
        await brc41PaymentMiddleware.initialize();
        // Create BRC-31 enhanced router
        const brc31RouterInstance = (0, overlay_brc_31_1.enhancedBRC31OverlayRouter)();
        brc31RouterInstance.setOverlayServices?.(overlayServices);
        // Mount BRC-31 router
        app.use('/overlay', brc31RouterInstance.router);
        console.log('✅ BRC-31 authentication services initialized');
        console.log('✅ BRC-41 payment services initialized');
        console.log('✅ Enhanced BRC-31 overlay endpoints available at /overlay');
        console.log(`✅ Database schema initialized for identity tracking`);
        console.log(`✅ Database schema initialized for payment tracking`);
        return { overlayServices, brc31Middleware, brc41PaymentMiddleware };
    }
    catch (error) {
        console.error('❌ Failed to initialize BRC-31/BRC-41 services:', error);
        console.log('⚠️  Continuing without BRC-31 authentication');
        return null;
    }
}
// Start server with BRC-31 initialization
const server = app.listen(PORT, async () => {
    console.log(`🚀 Gitdata overlay server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔍 API docs: http://localhost:${PORT}/v1/docs`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    // Initialize BRC-31 services asynchronously
    const brc31Services = await initializeBRC31Services();
    if (brc31Services) {
        console.log('🔐 BRC-31 Authrite authentication enabled');
        console.log('💰 BRC-41 PacketPay payments enabled');
    }
});
exports.server = server;
//# sourceMappingURL=server.js.map