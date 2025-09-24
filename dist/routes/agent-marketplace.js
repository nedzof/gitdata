"use strict";
// D24 Agent Marketplace API Routes
// Complete overlay-based agent marketplace with BRC standards integration
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentMarketplaceRouter = agentMarketplaceRouter;
const express_1 = require("express");
const limits_1 = require("../middleware/limits");
const streaming_delivery_1 = require("../services/streaming-delivery");
function agentMarketplaceRouter() {
    const router = (0, express_1.Router)();
    let services = null;
    // Set services (called after initialization)
    function setServices(newServices) {
        services = newServices;
    }
    // Middleware to check if services are available
    function requireServices(req, res, next) {
        if (!services) {
            return res.status(503).json({
                error: 'agent-marketplace-unavailable',
                message: 'Agent marketplace services are not available. Ensure overlay network is enabled.',
            });
        }
        next();
    }
    // ==================== Agent Registration & Discovery ====================
    /**
     * POST /overlay/agents/register
     * Register agent with BRC-88 SHIP advertisement
     */
    router.post('/agents/register', requireServices, (0, limits_1.rateLimit)('agent-register'), async (req, res) => {
        try {
            const { name, capabilities, overlayTopics, webhookUrl, geographicRegion, identityKey, overlayNodeId, } = req.body;
            // Validate required fields
            if (!name || !capabilities || !Array.isArray(capabilities) || !webhookUrl) {
                return res.status(400).json({
                    error: 'invalid-request',
                    message: 'name, capabilities (array), and webhookUrl are required',
                });
            }
            // Validate capabilities format
            for (const cap of capabilities) {
                if (!cap.name || !Array.isArray(cap.inputs) || !Array.isArray(cap.outputs)) {
                    return res.status(400).json({
                        error: 'invalid-capabilities',
                        message: 'Each capability must have name, inputs (array), and outputs (array)',
                    });
                }
            }
            // Validate webhook URL
            try {
                new URL(webhookUrl);
            }
            catch {
                return res.status(400).json({
                    error: 'invalid-webhook-url',
                    message: 'webhookUrl must be a valid HTTP/HTTPS URL',
                });
            }
            const agent = await services.agentRegistry.registerAgent({
                name,
                capabilities,
                overlayTopics: overlayTopics || [],
                webhookUrl,
                geographicRegion,
                identityKey,
                overlayNodeId,
            });
            res.json({
                success: true,
                agent: {
                    agentId: agent.agentId,
                    name: agent.name,
                    capabilities: agent.capabilities,
                    overlayTopics: agent.overlayTopics,
                    geographicRegion: agent.geographicRegion,
                    reputationScore: agent.reputationScore,
                    status: agent.status,
                    createdAt: agent.createdAt,
                },
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Agent registration failed:', error);
            res.status(500).json({
                error: 'registration-failed',
                message: error.message,
            });
        }
    });
    /**
     * GET /overlay/agents/search
     * Search agents by capability, region, reputation, etc. via BRC-24 lookup
     */
    router.get('/agents/search', requireServices, (0, limits_1.rateLimit)('agent-search'), async (req, res) => {
        try {
            const query = {
                capability: req.query.capability,
                region: req.query.region,
                minReputation: req.query.minReputation
                    ? parseFloat(req.query.minReputation)
                    : undefined,
                maxExecutionTime: req.query.maxExecutionTime
                    ? parseInt(req.query.maxExecutionTime)
                    : undefined,
                overlayTopic: req.query.overlayTopic,
                limit: req.query.limit ? parseInt(req.query.limit) : 20,
                offset: req.query.offset ? parseInt(req.query.offset) : 0,
            };
            const agents = await services.agentRegistry.searchAgents(query);
            res.json({
                success: true,
                query,
                agents: agents.map((agent) => ({
                    agentId: agent.agentId,
                    name: agent.name,
                    capabilities: agent.capabilities,
                    geographicRegion: agent.geographicRegion,
                    reputationScore: agent.reputationScore,
                    performanceStats: agent.performanceStats,
                    status: agent.status,
                    lastPingAt: agent.lastPingAt,
                })),
                count: agents.length,
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Agent search failed:', error);
            res.status(500).json({
                error: 'search-failed',
                message: error.message,
            });
        }
    });
    /**
     * POST /overlay/agents/:id/ping
     * Health check with overlay confirmation
     */
    router.post('/agents/:id/ping', requireServices, (0, limits_1.rateLimit)('agent-ping'), async (req, res) => {
        try {
            const agentId = req.params.id;
            const { status = true } = req.body;
            await services.agentRegistry.updateAgentPing(agentId, status);
            res.json({
                success: true,
                agentId,
                status: status ? 'up' : 'down',
                timestamp: Date.now(),
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Agent ping failed:', error);
            res.status(500).json({
                error: 'ping-failed',
                message: error.message,
            });
        }
    });
    /**
     * GET /overlay/agents/:id/reputation
     * Get performance metrics and ratings
     */
    router.get('/agents/:id/reputation', requireServices, async (req, res) => {
        try {
            const agentId = req.params.id;
            const [agent, performanceHistory, brc31Stats] = await Promise.all([
                services.agentRegistry.getAgent(agentId),
                services.agentRegistry.getAgentPerformanceHistory(agentId, 100),
                services.executionService.getBRC31Stats(agentId),
            ]);
            if (!agent) {
                return res.status(404).json({
                    error: 'agent-not-found',
                    message: 'Agent not found',
                });
            }
            res.json({
                success: true,
                agent: {
                    agentId: agent.agentId,
                    name: agent.name,
                    reputationScore: agent.reputationScore,
                    performanceStats: agent.performanceStats,
                },
                performanceHistory: performanceHistory.slice(0, 20), // Last 20 jobs
                identityVerification: brc31Stats,
                trends: {
                    recentSuccessRate: performanceHistory.slice(0, 10).filter((p) => p.success).length /
                        Math.min(10, performanceHistory.length),
                    avgRecentExecutionTime: performanceHistory.slice(0, 10).reduce((sum, p) => sum + p.executionTimeMs, 0) /
                        Math.min(10, performanceHistory.length),
                },
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Reputation query failed:', error);
            res.status(500).json({
                error: 'reputation-query-failed',
                message: error.message,
            });
        }
    });
    /**
     * PUT /overlay/agents/:id/capabilities
     * Update capabilities and re-advertise
     */
    router.put('/agents/:id/capabilities', requireServices, (0, limits_1.rateLimit)('agent-update'), async (req, res) => {
        try {
            const agentId = req.params.id;
            const { capabilities, overlayTopics } = req.body;
            if (!capabilities || !Array.isArray(capabilities)) {
                return res.status(400).json({
                    error: 'invalid-capabilities',
                    message: 'capabilities array is required',
                });
            }
            await services.agentRegistry.updateAgentCapabilities(agentId, capabilities, overlayTopics);
            res.json({
                success: true,
                agentId,
                message: 'Capabilities updated and re-advertised on overlay network',
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Capability update failed:', error);
            res.status(500).json({
                error: 'update-failed',
                message: error.message,
            });
        }
    });
    // ==================== Rule Management ====================
    /**
     * POST /overlay/rules
     * Create rule with overlay event subscriptions
     */
    router.post('/rules', requireServices, (0, limits_1.rateLimit)('rule-create'), async (req, res) => {
        try {
            const { name, overlayTopics, whenCondition, findStrategy, actions, ownerProducerId } = req.body;
            if (!name || !whenCondition || !findStrategy || !actions || !Array.isArray(actions)) {
                return res.status(400).json({
                    error: 'invalid-rule',
                    message: 'name, whenCondition, findStrategy, and actions (array) are required',
                });
            }
            const rule = await services.ruleEngine.createRule({
                name,
                overlayTopics,
                whenCondition,
                findStrategy,
                actions,
                ownerProducerId,
            });
            res.json({
                success: true,
                rule: {
                    ruleId: rule.ruleId,
                    name: rule.name,
                    enabled: rule.enabled,
                    overlayTopics: rule.overlayTopics,
                    whenCondition: rule.whenCondition,
                    findStrategy: rule.findStrategy,
                    actions: rule.actions,
                    createdAt: rule.createdAt,
                },
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Rule creation failed:', error);
            res.status(500).json({
                error: 'rule-creation-failed',
                message: error.message,
            });
        }
    });
    /**
     * GET /overlay/rules
     * List rules by overlay topic
     */
    router.get('/rules', requireServices, async (req, res) => {
        try {
            const enabledOnly = req.query.enabled === 'true';
            const rules = await services.ruleEngine.listRules(enabledOnly);
            res.json({
                success: true,
                rules: rules.map((rule) => ({
                    ruleId: rule.ruleId,
                    name: rule.name,
                    enabled: rule.enabled,
                    overlayTopics: rule.overlayTopics,
                    executionStats: rule.executionStats,
                    lastTriggeredAt: rule.lastTriggeredAt,
                    updatedAt: rule.updatedAt,
                })),
                count: rules.length,
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Rule listing failed:', error);
            res.status(500).json({
                error: 'rule-listing-failed',
                message: error.message,
            });
        }
    });
    /**
     * POST /overlay/rules/:id/trigger
     * Manual trigger with overlay transaction
     */
    router.post('/rules/:id/trigger', requireServices, (0, limits_1.rateLimit)('rule-trigger'), async (req, res) => {
        try {
            const ruleId = req.params.id;
            const triggerEvent = req.body.triggerEvent || { type: 'manual', timestamp: Date.now() };
            const jobIds = await services.ruleEngine.triggerRule(ruleId, triggerEvent);
            res.json({
                success: true,
                ruleId,
                triggerEvent,
                createdJobs: jobIds,
                message: `Rule triggered successfully, created ${jobIds.length} jobs`,
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Rule trigger failed:', error);
            res.status(500).json({
                error: 'rule-trigger-failed',
                message: error.message,
            });
        }
    });
    // ==================== Job Coordination ====================
    /**
     * GET /overlay/jobs
     * List jobs with overlay coordination state
     */
    router.get('/jobs', requireServices, async (req, res) => {
        try {
            const filters = {
                state: req.query.state,
                ruleId: req.query.ruleId,
                agentId: req.query.agentId,
            };
            const jobs = await services.ruleEngine.listJobs(filters);
            res.json({
                success: true,
                filters,
                jobs: jobs.map((job) => ({
                    jobId: job.jobId,
                    ruleId: job.ruleId,
                    targetId: job.targetId,
                    state: job.state,
                    assignedAgents: job.assignedAgents,
                    attempts: job.attempts,
                    coordinationData: job.coordinationData,
                    createdAt: job.createdAt,
                    updatedAt: job.updatedAt,
                })),
                count: jobs.length,
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Job listing failed:', error);
            res.status(500).json({
                error: 'job-listing-failed',
                message: error.message,
            });
        }
    });
    /**
     * GET /overlay/jobs/:id/lineage
     * Get BRC-64 lineage information
     */
    router.get('/jobs/:id/lineage', requireServices, async (req, res) => {
        try {
            const jobId = req.params.id;
            const [job, executions] = await Promise.all([
                services.ruleEngine.getJob(jobId),
                services.executionService.getJobExecution(jobId),
            ]);
            if (!job) {
                return res.status(404).json({
                    error: 'job-not-found',
                    message: 'Job not found',
                });
            }
            res.json({
                success: true,
                job: {
                    jobId: job.jobId,
                    ruleId: job.ruleId,
                    state: job.state,
                    lineageData: job.lineageData,
                },
                executions: executions.map((exec) => ({
                    agentId: exec.agentId,
                    executionTime: exec.executionTime,
                    success: exec.success,
                    artifacts: exec.artifacts,
                })),
                lineageGraph: {
                    // In production, this would call BRC-64 service to get full lineage
                    nodes: [{ id: jobId, type: 'job', data: { ruleId: job.ruleId, state: job.state } }],
                    edges: executions.map((exec, i) => ({
                        from: jobId,
                        to: exec.agentId,
                        type: 'execution',
                        data: { success: exec.success, artifacts: exec.artifacts.length },
                    })),
                },
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Lineage query failed:', error);
            res.status(500).json({
                error: 'lineage-query-failed',
                message: error.message,
            });
        }
    });
    /**
     * POST /overlay/jobs/:id/evidence
     * Store evidence via BRC-26
     */
    router.post('/jobs/:id/evidence', requireServices, (0, limits_1.rateLimit)('evidence-store'), async (req, res) => {
        try {
            const jobId = req.params.id;
            const { agentId, artifacts, executionTime, success, signature, nonce, clientFeedback } = req.body;
            if (!agentId || !Array.isArray(artifacts)) {
                return res.status(400).json({
                    error: 'invalid-evidence',
                    message: 'agentId and artifacts (array) are required',
                });
            }
            await services.executionService.processExecutionResult(jobId, agentId, {
                signature: signature || '',
                nonce: nonce || '',
                artifacts,
                success: success !== false,
                executionTime,
                clientFeedback,
            });
            res.json({
                success: true,
                jobId,
                agentId,
                message: 'Evidence stored successfully',
                artifactCount: artifacts.length,
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Evidence storage failed:', error);
            res.status(500).json({
                error: 'evidence-storage-failed',
                message: error.message,
            });
        }
    });
    // ==================== Overlay Integration ====================
    /**
     * GET /overlay/network/status
     * Overlay network health and connectivity
     */
    router.get('/network/status', requireServices, async (req, res) => {
        try {
            const [registryStats, brc31Stats] = await Promise.all([
                services.agentRegistry.getRegistryStats(),
                services.executionService.getBRC31Stats(),
            ]);
            res.json({
                success: true,
                overlayNetwork: {
                    status: 'connected',
                    nodeId: 'overlay-node-' + Date.now().toString(16),
                },
                agentRegistry: registryStats,
                identityVerification: brc31Stats,
                services: {
                    brc22: 'Transaction Submission - Active',
                    brc24: 'Lookup Services - Active',
                    brc64: 'History Tracking - Active',
                    brc88: 'Service Discovery - Active',
                    brc26: 'File Storage (UHRP) - Active',
                },
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Network status query failed:', error);
            res.status(500).json({
                error: 'network-status-failed',
                message: error.message,
            });
        }
    });
    /**
     * POST /overlay/agents/coordinate
     * Initiate multi-agent workflow
     */
    router.post('/agents/coordinate', requireServices, (0, limits_1.rateLimit)('agent-coordinate'), async (req, res) => {
        try {
            const { agentIds, workflow, coordination, timeout = 60000 } = req.body;
            if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
                return res.status(400).json({
                    error: 'invalid-coordination',
                    message: 'agentIds array is required and must not be empty',
                });
            }
            // Create coordination rule
            const rule = await services.ruleEngine.createRule({
                name: `Coordination-${Date.now()}`,
                whenCondition: { type: 'manual' },
                findStrategy: {
                    source: 'agent-registry',
                    query: { agentIds },
                },
                actions: [
                    {
                        action: 'overlay.coordinate',
                        workflow: workflow || 'parallel',
                        agentIds,
                        coordination,
                        timeout,
                    },
                ],
            });
            // Trigger immediately
            const jobIds = await services.ruleEngine.triggerRule(rule.ruleId, {
                type: 'coordination',
                agentIds,
                workflow,
                timestamp: Date.now(),
            });
            res.json({
                success: true,
                coordinationId: rule.ruleId,
                agentIds,
                workflow: workflow || 'parallel',
                createdJobs: jobIds,
                message: 'Multi-agent coordination initiated',
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Agent coordination failed:', error);
            res.status(500).json({
                error: 'coordination-failed',
                message: error.message,
            });
        }
    });
    /**
     * GET /overlay/marketplace/offers
     * Browse automated marketplace offers
     */
    router.get('/marketplace/offers', requireServices, async (req, res) => {
        try {
            // In production, this would query BRC-22 transactions with marketplace topics
            // For now, return mock offers
            const offers = [
                {
                    offerId: 'offer_' + Date.now().toString(16),
                    type: 'data-processing',
                    description: 'High-volume data processing service',
                    agentId: 'agent_example',
                    pricing: { satoshis: 1000, currency: 'BSV' },
                    capabilities: ['data-analysis', 'report-generation'],
                    region: 'US',
                    reputation: 0.95,
                    availability: 'immediate',
                },
            ];
            res.json({
                success: true,
                offers,
                count: offers.length,
                message: 'Marketplace offers retrieved from overlay network',
            });
        }
        catch (error) {
            console.error('[AGENT-MARKETPLACE] Marketplace offers query failed:', error);
            res.status(500).json({
                error: 'offers-query-failed',
                message: error.message,
            });
        }
    });
    // ==================== Marketplace Purchase & Streaming ====================
    /**
     * POST /overlay/marketplace/purchase
     * Purchase content from marketplace with webhook streaming delivery
     */
    router.post('/marketplace/purchase', requireServices, (0, limits_1.rateLimit)('marketplace-purchase'), async (req, res) => {
        try {
            const { offerId, versionId, contentHash, agentId, webhookUrl, paymentProof, streamingOptions = {}, } = req.body;
            // Validate required fields
            if (!offerId || !versionId || !agentId) {
                return res.status(400).json({
                    error: 'invalid-purchase-request',
                    message: 'offerId, versionId, and agentId are required',
                });
            }
            // Validate webhook URL if streaming is requested
            if (webhookUrl) {
                try {
                    new URL(webhookUrl);
                }
                catch {
                    return res.status(400).json({
                        error: 'invalid-webhook-url',
                        message: 'webhookUrl must be a valid HTTP/HTTPS URL',
                    });
                }
            }
            // Generate receipt ID for the purchase
            const receiptId = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.log(`🛒 [MARKETPLACE] Processing purchase: ${offerId} for agent ${agentId}`);
            // If webhook URL provided, set up streaming delivery
            if (webhookUrl) {
                console.log(`📡 [MARKETPLACE] Setting up streaming delivery to ${webhookUrl}`);
                try {
                    await (0, streaming_delivery_1.handleMarketPurchaseWithStreaming)(receiptId, versionId, webhookUrl, agentId);
                    res.json({
                        success: true,
                        receiptId,
                        offerId,
                        versionId,
                        agentId,
                        streamingEnabled: true,
                        webhookUrl,
                        message: 'Purchase completed with streaming delivery initiated',
                        deliveryMethod: 'webhook-streaming',
                    });
                }
                catch (streamingError) {
                    console.error('[MARKETPLACE] Streaming setup failed:', streamingError);
                    // Return success but note streaming failure
                    res.json({
                        success: true,
                        receiptId,
                        offerId,
                        versionId,
                        agentId,
                        streamingEnabled: false,
                        streamingError: streamingError.message,
                        message: 'Purchase completed but streaming delivery failed',
                        deliveryMethod: 'direct-download',
                    });
                }
            }
            else {
                // Regular purchase without streaming
                res.json({
                    success: true,
                    receiptId,
                    offerId,
                    versionId,
                    agentId,
                    streamingEnabled: false,
                    message: 'Purchase completed - content available for direct download',
                    deliveryMethod: 'direct-download',
                });
            }
        }
        catch (error) {
            console.error('[MARKETPLACE] Purchase failed:', error);
            res.status(500).json({
                error: 'purchase-failed',
                message: error.message,
            });
        }
    });
    /**
     * POST /overlay/marketplace/streaming/setup
     * Set up streaming subscription for purchased content
     */
    router.post('/marketplace/streaming/setup', requireServices, (0, limits_1.rateLimit)('streaming-setup'), async (req, res) => {
        try {
            const { receiptId, webhookUrl, contentHash, agentId, deliveryConfig = {} } = req.body;
            if (!receiptId || !webhookUrl || !contentHash || !agentId) {
                return res.status(400).json({
                    error: 'invalid-streaming-request',
                    message: 'receiptId, webhookUrl, contentHash, and agentId are required',
                });
            }
            // Validate webhook URL
            try {
                new URL(webhookUrl);
            }
            catch {
                return res.status(400).json({
                    error: 'invalid-webhook-url',
                    message: 'webhookUrl must be a valid HTTP/HTTPS URL',
                });
            }
            console.log(`📡 [MARKETPLACE] Setting up streaming subscription for receipt ${receiptId}`);
            const sessionId = await (0, streaming_delivery_1.createStreamingSubscription)(receiptId, webhookUrl, contentHash, agentId);
            res.json({
                success: true,
                receiptId,
                sessionId,
                agentId,
                webhookUrl,
                contentHash,
                deliveryConfig,
                message: 'Streaming subscription created successfully',
            });
        }
        catch (error) {
            console.error('[MARKETPLACE] Streaming setup failed:', error);
            res.status(500).json({
                error: 'streaming-setup-failed',
                message: error.message,
            });
        }
    });
    /**
     * POST /overlay/marketplace/content/deliver
     * Manually trigger content delivery via webhook
     */
    router.post('/marketplace/content/deliver', requireServices, (0, limits_1.rateLimit)('content-delivery'), async (req, res) => {
        try {
            const { receiptId, webhookUrl, contentHash, agentId, contentData, deliveryConfig = {}, } = req.body;
            if (!receiptId || !webhookUrl || !contentHash || !agentId || !contentData) {
                return res.status(400).json({
                    error: 'invalid-delivery-request',
                    message: 'receiptId, webhookUrl, contentHash, agentId, and contentData are required',
                });
            }
            console.log(`🚚 [MARKETPLACE] Delivering content to ${webhookUrl} for receipt ${receiptId}`);
            const subscription = {
                receiptId,
                webhookUrl,
                agentId,
                contentHash,
                deliveryConfig,
            };
            const deliveryResult = await (0, streaming_delivery_1.deliverContentToWebhook)(subscription, contentData);
            res.json({
                success: deliveryResult.success,
                receiptId,
                agentId,
                webhookUrl,
                bytesDelivered: deliveryResult.bytesDelivered,
                deliveryTime: deliveryResult.deliveryTime,
                hostUsed: deliveryResult.hostUsed,
                error: deliveryResult.error,
                message: deliveryResult.success
                    ? 'Content delivered successfully via webhook'
                    : 'Content delivery failed',
            });
        }
        catch (error) {
            console.error('[MARKETPLACE] Content delivery failed:', error);
            res.status(500).json({
                error: 'content-delivery-failed',
                message: error.message,
            });
        }
    });
    return {
        router,
        setServices,
    };
}
// Rate limiting configurations for different endpoints
const rateLimitConfigs = {
    'agent-register': { maxRequests: 5, windowMs: 60000 }, // 5 registrations per minute
    'agent-search': { maxRequests: 50, windowMs: 60000 }, // 50 searches per minute
    'agent-ping': { maxRequests: 100, windowMs: 60000 }, // 100 pings per minute
    'agent-update': { maxRequests: 10, windowMs: 60000 }, // 10 updates per minute
    'rule-create': { maxRequests: 10, windowMs: 60000 }, // 10 rule creations per minute
    'rule-trigger': { maxRequests: 20, windowMs: 60000 }, // 20 rule triggers per minute
    'evidence-store': { maxRequests: 100, windowMs: 60000 }, // 100 evidence submissions per minute
    'agent-coordinate': { maxRequests: 5, windowMs: 60000 }, // 5 coordinations per minute
    'marketplace-purchase': { maxRequests: 20, windowMs: 60000 }, // 20 purchases per minute
    'streaming-setup': { maxRequests: 10, windowMs: 60000 }, // 10 streaming setups per minute
    'content-delivery': { maxRequests: 50, windowMs: 60000 }, // 50 content deliveries per minute
};
//# sourceMappingURL=agent-marketplace.js.map