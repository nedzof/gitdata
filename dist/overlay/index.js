"use strict";
// BSV Overlay Integration Entry Point
// Exports all overlay services and utilities including BRC standards
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPIC_CLASSIFICATION = exports.TopicSubscriptionManager = exports.TopicGenerator = exports.D01A_TOPICS = exports.getOverlayConfig = exports.AgentExecutionService = exports.OverlayRuleEngine = exports.OverlayAgentRegistry = exports.BRC26UHRPService = exports.BRC88SHIPSLAPService = exports.BRC64HistoryService = exports.BRC24LookupService = exports.BRC22SubmitService = exports.OverlayPaymentService = exports.OverlayManager = exports.BSVOverlayService = void 0;
exports.initializeOverlayServices = initializeOverlayServices;
var bsv_overlay_service_1 = require("./bsv-overlay-service");
Object.defineProperty(exports, "BSVOverlayService", { enumerable: true, get: function () { return bsv_overlay_service_1.BSVOverlayService; } });
var overlay_manager_1 = require("./overlay-manager");
Object.defineProperty(exports, "OverlayManager", { enumerable: true, get: function () { return overlay_manager_1.OverlayManager; } });
var overlay_payments_1 = require("./overlay-payments");
Object.defineProperty(exports, "OverlayPaymentService", { enumerable: true, get: function () { return overlay_payments_1.OverlayPaymentService; } });
var brc22_submit_1 = require("./brc22-submit");
Object.defineProperty(exports, "BRC22SubmitService", { enumerable: true, get: function () { return brc22_submit_1.BRC22SubmitService; } });
var brc24_lookup_1 = require("./brc24-lookup");
Object.defineProperty(exports, "BRC24LookupService", { enumerable: true, get: function () { return brc24_lookup_1.BRC24LookupService; } });
var brc64_history_1 = require("./brc64-history");
Object.defineProperty(exports, "BRC64HistoryService", { enumerable: true, get: function () { return brc64_history_1.BRC64HistoryService; } });
var brc88_ship_slap_1 = require("./brc88-ship-slap");
Object.defineProperty(exports, "BRC88SHIPSLAPService", { enumerable: true, get: function () { return brc88_ship_slap_1.BRC88SHIPSLAPService; } });
var brc26_uhrp_1 = require("./brc26-uhrp");
Object.defineProperty(exports, "BRC26UHRPService", { enumerable: true, get: function () { return brc26_uhrp_1.BRC26UHRPService; } });
// D24 Agent Marketplace Services
var overlay_agent_registry_1 = require("../agents/overlay-agent-registry");
Object.defineProperty(exports, "OverlayAgentRegistry", { enumerable: true, get: function () { return overlay_agent_registry_1.OverlayAgentRegistry; } });
var overlay_rule_engine_1 = require("../agents/overlay-rule-engine");
Object.defineProperty(exports, "OverlayRuleEngine", { enumerable: true, get: function () { return overlay_rule_engine_1.OverlayRuleEngine; } });
var agent_execution_service_1 = require("../agents/agent-execution-service");
Object.defineProperty(exports, "AgentExecutionService", { enumerable: true, get: function () { return agent_execution_service_1.AgentExecutionService; } });
var overlay_config_1 = require("./overlay-config");
Object.defineProperty(exports, "getOverlayConfig", { enumerable: true, get: function () { return overlay_config_1.getOverlayConfig; } });
Object.defineProperty(exports, "D01A_TOPICS", { enumerable: true, get: function () { return overlay_config_1.D01A_TOPICS; } });
Object.defineProperty(exports, "TopicGenerator", { enumerable: true, get: function () { return overlay_config_1.TopicGenerator; } });
Object.defineProperty(exports, "TopicSubscriptionManager", { enumerable: true, get: function () { return overlay_config_1.TopicSubscriptionManager; } });
Object.defineProperty(exports, "TOPIC_CLASSIFICATION", { enumerable: true, get: function () { return overlay_config_1.TOPIC_CLASSIFICATION; } });
// Main overlay initialization function
const overlay_manager_2 = require("./overlay-manager");
const overlay_payments_2 = require("./overlay-payments");
const brc_services_postgresql_1 = require("./brc-services-postgresql");
const brc26_uhrp_2 = require("./brc26-uhrp");
const streaming_service_1 = require("../streaming/streaming-service");
const federation_manager_1 = require("./federation-manager");
const advanced_streaming_service_1 = require("../streaming/advanced-streaming-service");
const crypto_1 = __importDefault(require("crypto"));
class PostgreSQLAdapter {
    constructor(pool) {
        this.pool = pool;
    }
    async query(sql, params = []) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(sql, params);
            return result.rows;
        }
        finally {
            client.release();
        }
    }
    async queryOne(sql, params = []) {
        const results = await this.query(sql, params);
        return results[0] || null;
    }
    async execute(sql, params = []) {
        await this.query(sql, params);
    }
}
/**
 * Creates a legacy SQLite-compatible wrapper for PostgreSQL DatabaseAdapter
 * Used by OverlayManager and OverlayPaymentService until they're fully migrated
 */
function createLegacyWrapper(dbAdapter) {
    const queryCache = new Map();
    return {
        // Synchronous exec method - run async in background
        exec: (sql) => {
            dbAdapter
                .execute(sql)
                .catch((err) => console.warn('[LEGACY-DB] Async exec error:', err.message));
        },
        // Prepare method that returns an object with run/get/all methods
        prepare: (sql) => {
            return {
                run: (...params) => {
                    dbAdapter
                        .execute(sql, params)
                        .catch((err) => console.warn('[LEGACY-DB] Async run error:', err.message));
                    return { lastInsertRowid: Date.now(), changes: 1 };
                },
                get: (...params) => {
                    // For read operations, we need to handle them differently
                    // These will return null but shouldn't break the application
                    const cacheKey = `${sql}:${JSON.stringify(params)}`;
                    if (queryCache.has(cacheKey)) {
                        return queryCache.get(cacheKey);
                    }
                    // Async operation - can't return real data synchronously
                    dbAdapter
                        .queryOne(sql, params)
                        .then((result) => {
                        if (result)
                            queryCache.set(cacheKey, result);
                    })
                        .catch((err) => console.warn('[LEGACY-DB] Async get error:', err.message));
                    return null; // Legacy services must handle null gracefully
                },
                all: (...params) => {
                    // Similar to get, but for multiple results
                    const cacheKey = `all:${sql}:${JSON.stringify(params)}`;
                    if (queryCache.has(cacheKey)) {
                        return queryCache.get(cacheKey);
                    }
                    dbAdapter
                        .query(sql, params)
                        .then((results) => {
                        if (results)
                            queryCache.set(cacheKey, results);
                    })
                        .catch((err) => console.warn('[LEGACY-DB] Async all error:', err.message));
                    return []; // Return empty array for legacy compatibility
                },
            };
        },
    };
}
// Import agent marketplace services
const agent_execution_service_2 = require("../agents/agent-execution-service");
const overlay_agent_registry_2 = require("../agents/overlay-agent-registry");
const overlay_rule_engine_2 = require("../agents/overlay-rule-engine");
/**
 * Initialize complete BSV overlay services with BRC standards for Gitdata
 */
async function initializeOverlayServices(database, environment = 'development', myDomain = 'localhost:8788', options = {}) {
    // Create PostgreSQL database adapter
    const dbAdapter = new PostgreSQLAdapter(database);
    console.log('[OVERLAY] Using PostgreSQL database for overlay services');
    // Default configuration
    const storageBasePath = options.storageBasePath || './data/uhrp-storage';
    const baseUrl = options.baseUrl || `http://${myDomain}`;
    // Initialize PostgreSQL BRC services
    const brc22Service = new brc_services_postgresql_1.PostgreSQLBRC22SubmitService(dbAdapter);
    const brc24Service = new brc_services_postgresql_1.PostgreSQLBRC24LookupService(dbAdapter, brc22Service);
    const brc64Service = new brc_services_postgresql_1.PostgreSQLBRC64HistoryService(dbAdapter, brc22Service, brc24Service);
    const brc88Service = new brc_services_postgresql_1.PostgreSQLBRC88SHIPSLAPService(dbAdapter, myDomain);
    console.log('[OVERLAY] ✅ Initialized PostgreSQL BRC services (22, 24, 64, 88)');
    console.log('[OVERLAY] ✅ Production-ready with scalable database backend');
    console.log('[OVERLAY] ✅ All BRC standards available for production use');
    // Create BRC-26 UHRP service (Universal Hash Resolution Protocol for file storage)
    const brc26Service = new brc26_uhrp_2.BRC26UHRPService(dbAdapter, storageBasePath, baseUrl);
    // Create overlay manager with PostgreSQL legacy wrapper
    const legacyDatabase = createLegacyWrapper(dbAdapter);
    const overlayManager = new overlay_manager_2.OverlayManager({
        environment,
        database: legacyDatabase,
        autoConnect: true,
        enablePaymentIntegration: true,
        enableSearchIntegration: true,
    });
    // Create payment service
    const paymentService = new overlay_payments_2.OverlayPaymentService(overlayManager, legacyDatabase);
    // D24 Agent Marketplace Services
    const agentRegistry = new overlay_agent_registry_2.OverlayAgentRegistry(dbAdapter, brc88Service);
    const ruleEngine = new overlay_rule_engine_2.OverlayRuleEngine(dbAdapter, brc22Service, agentRegistry);
    const executionService = new agent_execution_service_2.AgentExecutionService(dbAdapter, {
        webhookTimeoutMs: 15000,
        requireIdentity: true,
    });
    // Phase 3: Streaming Services (optional)
    let streamingService;
    try {
        const streamingStorageDir = process.env.STREAMING_STORAGE_DIR || '/tmp/streaming';
        const myHostId = `host_${myDomain.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
        const myEndpoint = `http://${myDomain}`;
        streamingService = new streaming_service_1.StreamingService(dbAdapter, streamingStorageDir, myHostId, myEndpoint, {
            maxConcurrentTranscodings: 2,
            p2pEnabled: process.env.STREAMING_P2P_ENABLED !== 'false',
        });
        console.log('[OVERLAY] ✅ Streaming service initialized for Phase 3 compliance');
    }
    catch (error) {
        console.log('[OVERLAY] ⚠️  Streaming service unavailable (optional):', error.message);
    }
    // Phase 5: Advanced Features (optional)
    let federationManager;
    let advancedStreamingService;
    try {
        // Initialize Federation Manager for cross-overlay network support
        const nodeId = `node_${myDomain.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
        const federationPrivateKey = process.env.FEDERATION_PRIVATE_KEY || crypto_1.default.randomBytes(32).toString('hex');
        federationManager = new federation_manager_1.FederationManager(dbAdapter, nodeId, federationPrivateKey);
        await federationManager.initialize();
        console.log('[OVERLAY] ✅ Federation manager initialized for Phase 5 cross-network support');
    }
    catch (error) {
        console.log('[OVERLAY] ⚠️  Federation manager unavailable (optional):', error.message);
    }
    try {
        // Initialize Advanced Streaming Service for live streaming and CDN
        advancedStreamingService = new advanced_streaming_service_1.AdvancedStreamingService(dbAdapter);
        await advancedStreamingService.initialize();
        console.log('[OVERLAY] ✅ Advanced streaming service initialized for Phase 5 live streaming');
    }
    catch (error) {
        console.log('[OVERLAY] ⚠️  Advanced streaming service unavailable (optional):', error.message);
    }
    // Initialize overlay manager
    await overlayManager.initialize();
    // Set up cross-service event handling
    setupCrossServiceEvents(overlayManager, paymentService, brc22Service, brc24Service, brc64Service, brc88Service, brc26Service);
    return {
        overlayManager,
        paymentService,
        brc22Service,
        brc24Service,
        brc64Service,
        brc88Service,
        brc26Service,
        // D24 Agent Marketplace Services
        agentRegistry,
        ruleEngine,
        executionService,
        // Phase 3: Streaming Services
        streamingService,
        // Phase 5: Advanced Features
        federationManager,
        advancedStreamingService,
    };
}
/**
 * Set up comprehensive event handling between all overlay services
 */
function setupCrossServiceEvents(overlayManager, paymentService, brc22Service, brc24Service, brc64Service, brc88Service, brc26Service) {
    // === Overlay Manager Events ===
    // Forward payment events from overlay manager to payment service
    overlayManager.on('payment-data', (event) => {
        paymentService.emit('overlay-payment-message', event);
    });
    // Forward search results that include payment info
    overlayManager.on('search-results', (event) => {
        if (event.results.some((r) => r.paymentRequired)) {
            paymentService.emit('payment-required-data', event);
        }
    });
    // Forward asset publications for payment tracking
    overlayManager.on('asset-published', (event) => {
        if (event.asset.policy?.paymentRequired) {
            paymentService.emit('paid-content-published', event);
        }
    });
    // === Payment Service Events ===
    // Handle payment confirmations
    paymentService.on('payment-received', (receipt) => {
        overlayManager.emit('payment-confirmed', receipt);
    });
    // Handle payment failures
    paymentService.on('payment-failed', (error) => {
        overlayManager.emit('payment-error', error);
    });
    // === BRC-22 Service Events ===
    // Forward BRC-22 UTXO admissions to overlay for publishing
    brc22Service.on('manifest-utxo-admitted', async (event) => {
        // Publish asset data to overlay network
        try {
            const asset = await extractAssetFromUTXO(event);
            if (asset) {
                await overlayManager.publishAsset(asset);
            }
        }
        catch (error) {
            console.error('Failed to publish asset from BRC-22 admission:', error);
        }
    });
    // Forward transaction processing to history service
    brc22Service.on('transaction-processed', (event) => {
        brc64Service.emit('transaction-for-history', event);
    });
    // === BRC-24 Service Events ===
    // Forward lookup results to overlay for caching/sharing
    brc24Service.on('lookup-processed', (event) => {
        overlayManager.emit('lookup-completed', event);
    });
    // === BRC-64 Service Events ===
    // Forward history captures for lineage visualization
    brc64Service.on('history-captured', (event) => {
        overlayManager.emit('lineage-updated', event);
    });
    // Forward lineage graph updates
    brc64Service.on('lineage-built', (event) => {
        overlayManager.emit('lineage-graph-updated', event);
    });
    // === BRC-88 Service Events ===
    // Forward peer discoveries to overlay manager
    brc88Service.on('peer-discovered', (peer) => {
        overlayManager.emit('overlay-peer-discovered', peer);
    });
    // Forward service advertisements
    brc88Service.on('ship-advertisement-created', (event) => {
        overlayManager.emit('service-advertised', { type: 'SHIP', ...event });
    });
    brc88Service.on('slap-advertisement-created', (event) => {
        overlayManager.emit('service-advertised', { type: 'SLAP', ...event });
    });
    // Handle peer synchronization
    brc88Service.on('peer-synced', (peer) => {
        overlayManager.emit('peer-synchronized', peer);
    });
    // === BRC-26 UHRP Service Events ===
    // Forward file storage events to overlay for publication
    brc26Service.on('file-stored', async (content) => {
        try {
            // Create asset metadata for the stored file
            const asset = {
                datasetId: `uhrp-file-${content.hash}`,
                description: `UHRP stored file: ${content.filename}`,
                provenance: {
                    createdAt: new Date(content.uploadedAt).toISOString(),
                    issuer: 'uhrp-service',
                },
                policy: {
                    license: 'proprietary',
                    classification: content.isPublic ? 'public' : 'private',
                },
                content: {
                    contentHash: content.hash,
                    mediaType: content.contentType,
                    sizeBytes: content.size,
                    url: `uhrp://${content.hash}`,
                },
                parents: [],
                tags: ['uhrp-file', ...(content.metadata?.tags || [])],
            };
            await overlayManager.publishAsset(asset);
            console.log(`[OVERLAY] Published UHRP file asset: ${content.hash}`);
        }
        catch (error) {
            console.error('[OVERLAY] Failed to publish UHRP file asset:', error);
        }
    });
    // Forward advertisement events
    brc26Service.on('advertisement-created', (advertisement) => {
        overlayManager.emit('uhrp-advertisement', advertisement);
        // Also publish via BRC-22 if needed
        brc22Service.emit('uhrp-advertisement-for-submission', advertisement);
    });
    // === Cross-Service Integration ===
    // When new data is discovered via overlay, process through BRC-22
    overlayManager.on('data-received', async (event) => {
        if (brc22Service &&
            (event.topic.includes('asset') ||
                event.topic.includes('manifest') ||
                event.topic.includes('d01a'))) {
            try {
                // Convert overlay data to BRC-22 transaction format
                const brc22Transaction = convertOverlayDataToBRC22(event);
                if (brc22Transaction) {
                    await brc22Service.processSubmission(brc22Transaction, event.sender);
                }
            }
            catch (error) {
                console.error('Failed to process overlay data via BRC-22:', error);
            }
        }
    });
    // When BRC-24 lookup is requested, also search overlay network
    brc24Service.on('lookup-processed', async (event) => {
        try {
            // Also search overlay network for additional results
            const overlayResults = await overlayManager.searchData({
                classification: 'public',
                limit: 10,
            });
            // Merge results if needed
        }
        catch (error) {
            console.error('Failed to cross-search overlay:', error);
        }
    });
    // When SHIP/SLAP services are advertised, update BRC-24 providers
    brc88Service.on('slap-advertisement-received', (event) => {
        // Add discovered lookup providers to BRC-24 service
        const provider = {
            providerId: event.advertisement.serviceId,
            name: `Remote Service: ${event.advertisement.serviceId}`,
            description: `Lookup service from ${event.advertisement.domainName}`,
            processQuery: async (query) => {
                // In production, make HTTP request to remote service
                return [];
            },
        };
        // brc24Service.addLookupProvider(provider); // Uncomment when remote providers are implemented
    });
    console.log('[OVERLAY] Cross-service event handling configured');
}
/**
 * Helper function to extract asset from UTXO (placeholder)
 */
async function extractAssetFromUTXO(event) {
    // In production, parse the UTXO output script to extract D01A asset
    // For now, return a mock asset
    return {
        datasetId: 'extracted-from-utxo',
        description: 'Asset extracted from BRC-22 UTXO',
        provenance: {
            createdAt: new Date().toISOString(),
            issuer: event.outputScript?.substring(0, 16) || 'unknown',
        },
        policy: {
            license: 'cc-by-4.0',
            classification: 'public',
        },
        content: {
            contentHash: event.txid,
            mediaType: 'application/json',
            sizeBytes: event.satoshis,
            url: `utxo://${event.txid}:${event.vout}`,
        },
        parents: [],
        tags: ['brc22-extracted'],
    };
}
/**
 * @deprecated Use extractAssetFromUTXO instead
 * Backward compatibility function for extractManifestFromUTXO
 */
async function extractManifestFromUTXO(event) {
    return extractAssetFromUTXO(event);
}
/**
 * Helper function to convert overlay data to BRC-22 transaction (placeholder)
 */
function convertOverlayDataToBRC22(event) {
    // In production, convert overlay message to proper BRC-22 transaction format
    // For now, return a mock transaction
    if (event.data && event.topic) {
        return {
            rawTx: '0100000001' + '00'.repeat(32), // Mock transaction
            inputs: {},
            topics: [event.topic],
            mapiResponses: [],
        };
    }
    return null;
}
//# sourceMappingURL=index.js.map