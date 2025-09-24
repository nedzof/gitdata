"use strict";
/**
 * P2P Distribution Network for Streaming Content
 *
 * Implements decentralized content distribution as specified in D43 Phase 3:
 * - Host availability advertisement via BRC-26 UHRP
 * - Content discovery across multiple hosts
 * - Load balancing and failover mechanisms
 * - Bandwidth optimization and intelligent caching
 * - Network topology management and peer scoring
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.P2P_EVENTS = exports.P2PDistributionNetwork = void 0;
const crypto_1 = require("crypto");
const events_1 = require("events");
const axios_1 = __importDefault(require("axios"));
// ==================== P2P Distribution Manager ====================
class P2PDistributionNetwork extends events_1.EventEmitter {
    constructor(database, myHostId, myEndpoint, options = {}) {
        super();
        this.database = database;
        this.myHostId = myHostId;
        this.myEndpoint = myEndpoint;
        this.ADVERTISEMENT_TTL = 3600000; // 1 hour
        this.HOST_HEARTBEAT_INTERVAL = 30000; // 30 seconds
        this.REQUEST_TIMEOUT = 30000; // 30 seconds
        this.MAX_CONCURRENT_REQUESTS = 10;
        this.hosts = new Map();
        this.contentAdvertisements = new Map();
        this.activeRequests = new Map();
        this.bandwidthAllocations = new Map();
        this.loadBalancer = options.loadBalancingStrategy || {
            type: 'weighted',
            options: {},
        };
        // Start periodic cleanup
        this.startMaintenanceLoop();
    }
    // ==================== Host Management ====================
    async registerHost(host) {
        const hostId = this.generateHostId();
        const now = new Date();
        const p2pHost = {
            ...host,
            hostId,
            announcedAt: now,
            expiresAt: new Date(now.getTime() + this.ADVERTISEMENT_TTL),
        };
        this.hosts.set(hostId, p2pHost);
        // Store in database via BRC-26 UHRP advertisement
        await this.advertiseHostToBRC26(p2pHost);
        this.emit('hostRegistered', { hostId, endpoint: host.endpoint });
        return hostId;
    }
    async updateHostMetrics(hostId, metrics) {
        const host = this.hosts.get(hostId);
        if (!host) {
            throw new Error(`Host not found: ${hostId}`);
        }
        host.metrics = { ...host.metrics, ...metrics };
        host.metrics.lastSeen = new Date();
        // Update reputation based on metrics
        this.updateHostReputation(host);
        this.emit('hostMetricsUpdated', { hostId, metrics: host.metrics });
    }
    async removeHost(hostId) {
        const host = this.hosts.get(hostId);
        if (!host)
            return;
        // Cancel any active requests assigned to this host
        for (const [requestId, request] of this.activeRequests) {
            if (request.assignedHosts.includes(hostId)) {
                await this.reassignFailedChunks(requestId, hostId);
            }
        }
        this.hosts.delete(hostId);
        this.bandwidthAllocations.delete(hostId);
        // Remove from BRC-26 advertisements
        await this.removeHostFromBRC26(hostId);
        this.emit('hostRemoved', { hostId });
    }
    updateHostReputation(host) {
        const totalTransfers = host.reputation.successfulTransfers + host.reputation.failedTransfers;
        if (totalTransfers === 0) {
            host.reputation.score = 50; // Default score
            return;
        }
        const successRate = host.reputation.successfulTransfers / totalTransfers;
        const uptimeBonus = host.metrics.uptime * 0.3;
        const latencyPenalty = Math.max(0, (host.metrics.averageLatency - 100) * 0.001);
        host.reputation.score = Math.max(0, Math.min(100, successRate * 70 + uptimeBonus - latencyPenalty));
    }
    // ==================== Content Advertisement ====================
    async advertiseContent(contentHash, chunks, totalChunks, metadata, options = {}) {
        const now = new Date();
        const myHost = this.hosts.get(this.myHostId);
        if (!myHost) {
            throw new Error('Local host not registered');
        }
        const advertisement = {
            contentHash,
            hostId: this.myHostId,
            availability: {
                chunks,
                totalChunks,
                completeness: chunks.length / totalChunks,
            },
            access: {
                endpoint: `${this.myEndpoint}/streaming/content/${contentHash}`,
                requiresAuth: options.requiresAuth || false,
                requiresPayment: options.requiresPayment || false,
                price: options.price,
            },
            metadata,
            quality: {
                bandwidth: options.bandwidth || myHost.capabilities.maxBandwidth,
                latency: myHost.metrics.averageLatency,
                priority: options.priority || 'normal',
            },
            advertisedAt: now,
            expiresAt: new Date(now.getTime() + this.ADVERTISEMENT_TTL),
        };
        // Store advertisement
        const existing = this.contentAdvertisements.get(contentHash) || [];
        const hostIndex = existing.findIndex((ad) => ad.hostId === this.myHostId);
        if (hostIndex >= 0) {
            existing[hostIndex] = advertisement;
        }
        else {
            existing.push(advertisement);
        }
        this.contentAdvertisements.set(contentHash, existing);
        // Advertise via BRC-26 UHRP
        await this.advertiseContentToBRC26(advertisement);
        this.emit('contentAdvertised', { contentHash, chunks: chunks.length });
    }
    async discoverContent(contentHash, chunkIndices) {
        // First check local cache
        let advertisements = this.contentAdvertisements.get(contentHash) || [];
        // Query BRC-26 UHRP for additional hosts
        const brc26Advertisements = await this.queryBRC26ForContent(contentHash);
        // Merge and deduplicate
        const allAdvertisements = new Map();
        for (const ad of [...advertisements, ...brc26Advertisements]) {
            if (ad.expiresAt > new Date()) {
                allAdvertisements.set(ad.hostId, ad);
            }
        }
        const result = Array.from(allAdvertisements.values());
        // Filter by chunk availability if specified
        if (chunkIndices) {
            return result.filter((ad) => chunkIndices.every((index) => ad.availability.chunks.includes(index)));
        }
        return result;
    }
    // ==================== Load Balancing and Request Routing ====================
    async requestContent(contentHash, chunkIndices, options = {}) {
        const requestId = this.generateRequestId();
        const request = {
            requestId,
            contentHash,
            chunkIndices: [...chunkIndices],
            requesterHost: this.myHostId,
            priority: options.priority || 'normal',
            timeout: options.timeout || this.REQUEST_TIMEOUT,
            createdAt: new Date(),
            status: 'pending',
            assignedHosts: [],
            completedChunks: [],
            failedChunks: [],
        };
        this.activeRequests.set(requestId, request);
        // Discover available hosts for this content
        const advertisements = await this.discoverContent(contentHash, chunkIndices);
        if (advertisements.length === 0) {
            request.status = 'failed';
            this.emit('requestFailed', { requestId, reason: 'No hosts available' });
            return request;
        }
        // Apply load balancing strategy to select hosts
        const selectedHosts = await this.selectOptimalHosts(advertisements, chunkIndices);
        // Assign chunks to hosts
        await this.assignChunksToHosts(request, selectedHosts);
        this.emit('requestCreated', { requestId, contentHash, chunks: chunkIndices.length });
        return request;
    }
    async selectOptimalHosts(advertisements, chunkIndices) {
        // Filter hosts based on chunk availability
        const availableHosts = advertisements.filter((ad) => chunkIndices.some((index) => ad.availability.chunks.includes(index)));
        // Apply load balancing strategy
        switch (this.loadBalancer.type) {
            case 'round_robin':
                return this.selectRoundRobin(availableHosts);
            case 'weighted':
                return this.selectWeighted(availableHosts);
            case 'latency_based':
                return this.selectLatencyBased(availableHosts);
            case 'geographic':
                return this.selectGeographic(availableHosts);
            default:
                return availableHosts;
        }
    }
    selectRoundRobin(hosts) {
        // Simple round-robin selection
        return hosts.sort(() => Math.random() - 0.5);
    }
    selectWeighted(hosts) {
        return hosts.sort((a, b) => {
            const hostA = this.hosts.get(a.hostId);
            const hostB = this.hosts.get(b.hostId);
            if (!hostA || !hostB)
                return 0;
            const scoreA = hostA.reputation.score * hostA.metrics.reliability;
            const scoreB = hostB.reputation.score * hostB.metrics.reliability;
            return scoreB - scoreA; // Higher scores first
        });
    }
    selectLatencyBased(hosts) {
        const maxLatency = this.loadBalancer.options.maxLatency || 1000;
        return hosts
            .filter((ad) => ad.quality.latency <= maxLatency)
            .sort((a, b) => a.quality.latency - b.quality.latency);
    }
    selectGeographic(hosts) {
        const preferredRegions = this.loadBalancer.options.preferredRegions || [];
        if (preferredRegions.length === 0)
            return hosts;
        return hosts.sort((a, b) => {
            const hostA = this.hosts.get(a.hostId);
            const hostB = this.hosts.get(b.hostId);
            if (!hostA || !hostB)
                return 0;
            const aPreferred = preferredRegions.includes(hostA.geolocation.region);
            const bPreferred = preferredRegions.includes(hostB.geolocation.region);
            if (aPreferred && !bPreferred)
                return -1;
            if (!aPreferred && bPreferred)
                return 1;
            return 0;
        });
    }
    // ==================== Chunk Assignment and Download ====================
    async assignChunksToHosts(request, selectedHosts) {
        request.status = 'assigned';
        const chunkAssignments = new Map();
        // Distribute chunks across available hosts
        for (const chunkIndex of request.chunkIndices) {
            const availableHosts = selectedHosts.filter((ad) => ad.availability.chunks.includes(chunkIndex));
            if (availableHosts.length === 0) {
                request.failedChunks.push(chunkIndex);
                continue;
            }
            // Select best host for this chunk
            const selectedHost = availableHosts[0]; // Already sorted by strategy
            const hostChunks = chunkAssignments.get(selectedHost.hostId) || [];
            hostChunks.push(chunkIndex);
            chunkAssignments.set(selectedHost.hostId, hostChunks);
            if (!request.assignedHosts.includes(selectedHost.hostId)) {
                request.assignedHosts.push(selectedHost.hostId);
            }
        }
        // Start downloads from assigned hosts
        for (const [hostId, chunks] of chunkAssignments) {
            this.downloadChunksFromHost(request, hostId, chunks);
        }
    }
    async downloadChunksFromHost(request, hostId, chunkIndices) {
        const host = this.hosts.get(hostId);
        if (!host) {
            request.failedChunks.push(...chunkIndices);
            return;
        }
        try {
            request.status = 'downloading';
            for (const chunkIndex of chunkIndices) {
                const chunkUrl = `${host.endpoint}/streaming/content/${request.contentHash}/chunk/${chunkIndex}`;
                const response = await axios_1.default.get(chunkUrl, {
                    responseType: 'arraybuffer',
                    timeout: request.timeout,
                });
                if (response.status === 200) {
                    request.completedChunks.push(chunkIndex);
                    // Update host metrics
                    await this.updateHostMetrics(hostId, {
                        totalServed: host.metrics.totalServed + response.data.byteLength,
                    });
                    this.emit('chunkDownloaded', {
                        requestId: request.requestId,
                        chunkIndex,
                        hostId,
                        size: response.data.byteLength,
                    });
                }
                else {
                    throw new Error(`HTTP ${response.status}`);
                }
            }
            // Update host reputation for successful transfers
            host.reputation.successfulTransfers += chunkIndices.length;
        }
        catch (error) {
            request.failedChunks.push(...chunkIndices);
            // Update host reputation for failed transfers
            host.reputation.failedTransfers += chunkIndices.length;
            this.emit('chunkDownloadFailed', {
                requestId: request.requestId,
                chunkIndices,
                hostId,
                error: error instanceof Error ? error.message : String(error),
            });
            // Attempt to reassign failed chunks
            await this.reassignFailedChunks(request.requestId, hostId);
        }
        // Check if request is complete
        if (request.completedChunks.length + request.failedChunks.length ===
            request.chunkIndices.length) {
            request.status = request.failedChunks.length === 0 ? 'completed' : 'failed';
            this.emit(request.status === 'completed' ? 'requestCompleted' : 'requestFailed', {
                requestId: request.requestId,
                completedChunks: request.completedChunks.length,
                failedChunks: request.failedChunks.length,
            });
        }
    }
    async reassignFailedChunks(requestId, failedHostId) {
        const request = this.activeRequests.get(requestId);
        if (!request || request.status === 'completed' || request.status === 'failed') {
            return;
        }
        // Find chunks that were assigned to the failed host
        const failedChunks = request.failedChunks.filter((chunkIndex) => !request.completedChunks.includes(chunkIndex));
        if (failedChunks.length === 0)
            return;
        // Discover alternative hosts
        const advertisements = await this.discoverContent(request.contentHash, failedChunks);
        const alternativeHosts = advertisements.filter((ad) => ad.hostId !== failedHostId);
        if (alternativeHosts.length === 0) {
            this.emit('reassignmentFailed', { requestId, failedChunks });
            return;
        }
        // Reassign failed chunks to alternative hosts
        const selectedHosts = await this.selectOptimalHosts(alternativeHosts, failedChunks);
        // Remove failed chunks from failed list and retry
        request.failedChunks = request.failedChunks.filter((chunk) => !failedChunks.includes(chunk));
        // Assign to new hosts
        for (const chunkIndex of failedChunks) {
            const availableHosts = selectedHosts.filter((ad) => ad.availability.chunks.includes(chunkIndex));
            if (availableHosts.length > 0) {
                const hostId = availableHosts[0].hostId;
                await this.downloadChunksFromHost(request, hostId, [chunkIndex]);
            }
            else {
                request.failedChunks.push(chunkIndex);
            }
        }
        this.emit('chunksReassigned', { requestId, reassignedChunks: failedChunks.length });
    }
    // ==================== BRC-26 UHRP Integration ====================
    async advertiseHostToBRC26(host) {
        const advertisement = {
            type: 'p2p-host',
            hostId: host.hostId,
            endpoint: host.endpoint,
            capabilities: host.capabilities,
            geolocation: host.geolocation,
            reputation: host.reputation,
            expiresAt: host.expiresAt,
        };
        await this.database.execute(`
      INSERT INTO brc26_advertisements (hash, content_type, metadata, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (hash) DO UPDATE SET
        metadata = $3,
        expires_at = $5
    `, [
            host.hostId,
            'application/json',
            JSON.stringify(advertisement),
            host.announcedAt,
            host.expiresAt,
        ]);
    }
    async advertiseContentToBRC26(advertisement) {
        const adData = {
            type: 'content-advertisement',
            contentHash: advertisement.contentHash,
            hostId: advertisement.hostId,
            availability: advertisement.availability,
            access: advertisement.access,
            metadata: advertisement.metadata,
            quality: advertisement.quality,
            expiresAt: advertisement.expiresAt,
        };
        await this.database.execute(`
      INSERT INTO brc26_content_ads (content_hash, host_id, advertisement_data, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (content_hash, host_id) DO UPDATE SET
        advertisement_data = $3,
        expires_at = $5
    `, [
            advertisement.contentHash,
            advertisement.hostId,
            JSON.stringify(adData),
            advertisement.advertisedAt,
            advertisement.expiresAt,
        ]);
    }
    async queryBRC26ForContent(contentHash) {
        const results = await this.database.query(`
      SELECT advertisement_data
      FROM brc26_content_ads
      WHERE content_hash = $1 AND expires_at > NOW()
      ORDER BY created_at DESC
    `, [contentHash]);
        return results.map((row) => {
            const data = JSON.parse(row.advertisement_data);
            return {
                contentHash: data.contentHash,
                hostId: data.hostId,
                availability: data.availability,
                access: data.access,
                metadata: data.metadata,
                quality: data.quality,
                advertisedAt: new Date(data.advertisedAt || Date.now()),
                expiresAt: new Date(data.expiresAt),
            };
        });
    }
    async removeHostFromBRC26(hostId) {
        await this.database.execute(`
      DELETE FROM brc26_advertisements WHERE hash = $1
    `, [hostId]);
        await this.database.execute(`
      DELETE FROM brc26_content_ads WHERE host_id = $1
    `, [hostId]);
    }
    // ==================== Maintenance and Cleanup ====================
    startMaintenanceLoop() {
        setInterval(() => {
            this.cleanupExpiredAdvertisements();
            this.cleanupExpiredRequests();
            this.updateNetworkTopology();
        }, 60000); // Every minute
        setInterval(() => {
            this.sendHeartbeat();
        }, this.HOST_HEARTBEAT_INTERVAL);
    }
    async cleanupExpiredAdvertisements() {
        const now = new Date();
        let cleanedCount = 0;
        // Clean expired hosts
        for (const [hostId, host] of this.hosts) {
            if (host.expiresAt < now) {
                await this.removeHost(hostId);
                cleanedCount++;
            }
        }
        // Clean expired content advertisements
        for (const [contentHash, advertisements] of this.contentAdvertisements) {
            const validAds = advertisements.filter((ad) => ad.expiresAt > now);
            if (validAds.length !== advertisements.length) {
                this.contentAdvertisements.set(contentHash, validAds);
                cleanedCount += advertisements.length - validAds.length;
            }
            if (validAds.length === 0) {
                this.contentAdvertisements.delete(contentHash);
            }
        }
        if (cleanedCount > 0) {
            this.emit('maintenanceCleanup', { expiredItems: cleanedCount });
        }
    }
    cleanupExpiredRequests() {
        const now = new Date();
        const expiredRequests = [];
        for (const [requestId, request] of this.activeRequests) {
            const requestAge = now.getTime() - request.createdAt.getTime();
            if (requestAge > request.timeout ||
                request.status === 'completed' ||
                request.status === 'failed') {
                expiredRequests.push(requestId);
            }
        }
        for (const requestId of expiredRequests) {
            this.activeRequests.delete(requestId);
        }
    }
    updateNetworkTopology() {
        const networkStats = {
            totalHosts: this.hosts.size,
            onlineHosts: Array.from(this.hosts.values()).filter((h) => h.status === 'online').length,
            totalContent: this.contentAdvertisements.size,
            activeRequests: this.activeRequests.size,
        };
        this.emit('networkTopologyUpdated', networkStats);
    }
    async sendHeartbeat() {
        const myHost = this.hosts.get(this.myHostId);
        if (!myHost)
            return;
        myHost.metrics.lastSeen = new Date();
        await this.advertiseHostToBRC26(myHost);
        this.emit('heartbeatSent', { hostId: this.myHostId, timestamp: new Date() });
    }
    // ==================== Utility Methods ====================
    generateHostId() {
        return `host_${Date.now()}_${(0, crypto_1.randomBytes)(4).toString('hex')}`;
    }
    generateRequestId() {
        return `req_${Date.now()}_${(0, crypto_1.randomBytes)(4).toString('hex')}`;
    }
    // ==================== Public API ====================
    getNetworkStats() {
        const hosts = Array.from(this.hosts.values());
        const onlineHosts = hosts.filter((h) => h.status === 'online');
        const totalBandwidth = onlineHosts.reduce((sum, h) => sum + h.capabilities.maxBandwidth, 0);
        return {
            hosts: this.hosts.size,
            onlineHosts: onlineHosts.length,
            contentItems: this.contentAdvertisements.size,
            activeRequests: this.activeRequests.size,
            totalBandwidth,
        };
    }
    getHostById(hostId) {
        return this.hosts.get(hostId) || null;
    }
    getRequestById(requestId) {
        return this.activeRequests.get(requestId) || null;
    }
    async setLoadBalancingStrategy(strategy) {
        this.loadBalancer = strategy;
        this.emit('loadBalancingStrategyChanged', strategy);
    }
    getLoadBalancingStrategy() {
        return { ...this.loadBalancer };
    }
}
exports.P2PDistributionNetwork = P2PDistributionNetwork;
// ==================== Export Types and Constants ====================
exports.P2P_EVENTS = {
    HOST_REGISTERED: 'hostRegistered',
    HOST_REMOVED: 'hostRemoved',
    HOST_METRICS_UPDATED: 'hostMetricsUpdated',
    CONTENT_ADVERTISED: 'contentAdvertised',
    REQUEST_CREATED: 'requestCreated',
    REQUEST_COMPLETED: 'requestCompleted',
    REQUEST_FAILED: 'requestFailed',
    CHUNK_DOWNLOADED: 'chunkDownloaded',
    CHUNK_DOWNLOAD_FAILED: 'chunkDownloadFailed',
    CHUNKS_REASSIGNED: 'chunksReassigned',
    REASSIGNMENT_FAILED: 'reassignmentFailed',
    NETWORK_TOPOLOGY_UPDATED: 'networkTopologyUpdated',
    MAINTENANCE_CLEANUP: 'maintenanceCleanup',
    HEARTBEAT_SENT: 'heartbeatSent',
    LOAD_BALANCING_STRATEGY_CHANGED: 'loadBalancingStrategyChanged',
};
//# sourceMappingURL=p2p-distribution.js.map