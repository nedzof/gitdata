"use strict";
/**
 * D22 - BSV Overlay Network Storage Backend
 * UHRP (Universal Hash Resolution Protocol) Storage Service
 * Provides BRC-26 compliant distributed storage with multi-location support
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UHRPStorageService = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path = __importStar(require("path"));
class UHRPStorageService {
    constructor(pool, walletClient, config) {
        this.pool = pool;
        this.walletClient = walletClient;
        this.config = config;
        this.storageBasePath = config.storageBasePath || '/tmp/overlay-storage';
        this.overlayTopics = config.overlayTopics || ['gitdata.storage.content', 'gitdata.brc26.uhrp'];
        this.initializeStorage();
    }
    async initializeStorage() {
        // Ensure storage directory exists
        await fs_1.promises.mkdir(this.storageBasePath, { recursive: true });
        // Initialize overlay network topics
        console.log('🔗 Initializing UHRP storage service...');
        console.log(`📁 Storage path: ${this.storageBasePath}`);
        console.log(`🌐 Overlay topics: ${this.overlayTopics.join(', ')}`);
    }
    /**
     * Store content with UHRP addressing and multi-location replication
     */
    async storeContent(content, metadata, versionId) {
        const startTime = Date.now();
        // Calculate content hash
        const contentHash = this.calculateContentHash(content);
        console.log(`📦 Storing content: ${contentHash.slice(0, 10)}... (${content.length} bytes)`);
        try {
            // 1. Store locally first
            const localPath = await this.storeLocally(contentHash, content);
            console.log(`💾 Stored locally: ${localPath}`);
            // 2. Create database record
            await this.createStorageRecord(contentHash, versionId, localPath, content.length, metadata);
            // 3. Generate UHRP URL
            const uhrpUrl = this.generateUHRPUrl(contentHash);
            // 4. Publish to overlay network
            const overlayAdvertisements = await this.publishToOverlay(contentHash, metadata);
            console.log(`📡 Published ${overlayAdvertisements.length} overlay advertisements`);
            // 5. Initialize replication jobs
            const replicationJobs = await this.initializeReplication(contentHash);
            console.log(`🔄 Started ${replicationJobs.length} replication jobs`);
            // 6. Get storage locations
            const storageLocations = await this.getStorageLocations(contentHash);
            // 7. Assign verification agents
            const verificationAgents = await this.assignVerificationAgents(contentHash);
            const result = {
                contentHash,
                uhrpUrl,
                localPath,
                overlayAdvertisements,
                storageLocations,
                verificationAgents,
            };
            console.log(`✅ Storage completed in ${Date.now() - startTime}ms`);
            return result;
        }
        catch (error) {
            console.error(`❌ Storage failed for ${contentHash}:`, error);
            throw new Error(`Storage failed: ${error.message}`);
        }
    }
    /**
     * Resolve content via UHRP with intelligent location selection
     */
    async resolveContent(contentHash, options = {}) {
        const startTime = Date.now();
        console.log(`🔍 Resolving content: ${contentHash.slice(0, 10)}...`);
        try {
            // 1. Get all available storage locations
            const availableLocations = await this.getAvailableLocations(contentHash);
            if (availableLocations.length === 0) {
                throw new Error(`No storage locations found for content: ${contentHash}`);
            }
            // 2. Select optimal location based on options
            const preferredLocation = await this.selectOptimalLocation(availableLocations, options);
            // 3. Verify content integrity if requested
            let integrityVerified = false;
            if (options.includeVerification) {
                const verification = await this.verifyContentIntegrity(contentHash);
                integrityVerified = verification.consensusAchieved;
            }
            // 4. Get overlay routing information
            const overlayRoute = await this.getOverlayRoute(contentHash, preferredLocation);
            // 5. Log access if requested
            if (options.trackAccess) {
                await this.logAccess(contentHash, preferredLocation, startTime);
            }
            const resolution = {
                contentHash,
                availableLocations,
                preferredLocation,
                integrityVerified,
                resolutionTime: Date.now() - startTime,
                overlayRoute,
            };
            console.log(`✅ Resolved in ${resolution.resolutionTime}ms via ${preferredLocation.type}`);
            return resolution;
        }
        catch (error) {
            console.error(`❌ Resolution failed for ${contentHash}:`, error);
            throw new Error(`Resolution failed: ${error.message}`);
        }
    }
    /**
     * Advertise content availability via BRC-88 SHIP/SLAP
     */
    async advertiseContent(contentHash, storageCapability) {
        console.log(`📢 Advertising content: ${contentHash.slice(0, 10)}...`);
        try {
            const advertisementId = this.generateAdvertisementId();
            const storageProvider = await this.getStorageProviderIdentity();
            // Create BRC-88 advertisement data
            const advertisementData = {
                protocolID: [2, 'gitdata-storage'],
                contentHash,
                storageCapability,
                endpoints: this.getStorageEndpoints(),
                geographicRegions: this.config.geographicRegions || ['US'],
                publishedAt: new Date().toISOString(),
                ttlHours: this.config.advertisementTTLHours || 24,
            };
            // Sign advertisement with wallet
            const signature = await this.walletClient.createSignature({
                data: Array.from(Buffer.from(JSON.stringify(advertisementData))),
                protocolID: [2, 'gitdata-storage-advertisement'],
                keyID: 'identity',
                privilegedReason: 'Advertise storage capability for content',
            });
            // Store advertisement in database
            await this.pool.query(`
        INSERT INTO uhrp_advertisements (
          content_hash, advertisement_id, storage_provider, storage_capability,
          advertisement_data, resolution_endpoints, geographic_regions,
          bandwidth_mbps, cost_per_gb_satoshis, ttl_hours
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
                contentHash,
                advertisementId,
                storageProvider,
                JSON.stringify(storageCapability),
                JSON.stringify({ ...advertisementData, signature: signature.signature }),
                this.getStorageEndpoints(),
                this.config.geographicRegions || ['US'],
                storageCapability.bandwidthMbps,
                storageCapability.costPerGBSatoshis,
                this.config.advertisementTTLHours || 24,
            ]);
            // Publish to overlay network
            await this.publishAdvertisementToOverlay(advertisementData, signature);
            const advertisement = {
                advertisementId,
                contentHash,
                storageProvider,
                capability: storageCapability,
                endpoints: this.getStorageEndpoints(),
                geographicRegions: this.config.geographicRegions || ['US'],
                ttlHours: this.config.advertisementTTLHours || 24,
                publishedAt: new Date(),
            };
            console.log(`✅ Advertisement published: ${advertisementId}`);
            return advertisement;
        }
        catch (error) {
            console.error(`❌ Advertisement failed for ${contentHash}:`, error);
            throw new Error(`Advertisement failed: ${error.message}`);
        }
    }
    /**
     * Verify content integrity across all storage locations
     */
    async verifyContentIntegrity(contentHash) {
        console.log(`🔒 Verifying integrity: ${contentHash.slice(0, 10)}...`);
        try {
            const locations = await this.getAvailableLocations(contentHash);
            const verificationPromises = locations.map((location) => this.verifyLocationIntegrity(contentHash, location));
            const results = await Promise.allSettled(verificationPromises);
            const verificationResults = results
                .filter((result) => result.status === 'fulfilled')
                .map((result) => result.value);
            // Calculate consensus
            const successfulVerifications = verificationResults.filter((v) => v.hashMatch);
            const agreementRatio = successfulVerifications.length / verificationResults.length;
            const consensusAchieved = agreementRatio >= (this.config?.consensusThreshold ?? 0.6);
            // Store verification results
            for (const result of verificationResults) {
                await this.pool.query(`
          INSERT INTO storage_verifications (
            content_hash, verification_type, storage_location, verification_result,
            response_time_ms, error_details
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
                    contentHash,
                    'integrity',
                    result.location.type,
                    result.hashMatch,
                    result.responseTime,
                    result.error ? JSON.stringify({ error: result.error }) : null,
                ]);
            }
            const verification = {
                contentHash,
                verificationResults,
                consensusAchieved,
                agreementRatio,
                verifiedAt: new Date(),
            };
            console.log(`✅ Integrity verification: ${agreementRatio * 100}% agreement`);
            return verification;
        }
        catch (error) {
            console.error(`❌ Integrity verification failed for ${contentHash}:`, error);
            throw new Error(`Integrity verification failed: ${error.message}`);
        }
    }
    // Private helper methods
    async storeLocally(contentHash, content) {
        const fileName = `${contentHash}.bin`;
        const localPath = path.join(this.storageBasePath, fileName);
        await fs_1.promises.writeFile(localPath, content);
        return localPath;
    }
    async createStorageRecord(contentHash, versionId, localPath, fileSize, metadata) {
        await this.pool.query(`
      INSERT INTO overlay_storage_index (
        content_hash, version_id, local_path, file_size, mime_type,
        storage_tier, access_statistics
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (content_hash) DO UPDATE SET
        local_path = EXCLUDED.local_path,
        updated_at = NOW()
    `, [
            contentHash,
            versionId,
            localPath,
            fileSize,
            metadata.mimeType,
            'hot', // Default to hot tier for new content
            JSON.stringify({
                accessFrequency: metadata.accessFrequency || 0,
                updateFrequency: metadata.updateFrequency || 0,
            }),
        ]);
    }
    generateUHRPUrl(contentHash) {
        return `uhrp://${contentHash}/content`;
    }
    async publishToOverlay(contentHash, metadata) {
        // Simulate overlay network publishing
        // In real implementation, this would use BSV overlay network protocols
        const advertisements = [];
        for (const topic of this.overlayTopics) {
            const adId = `ship_ad_${(0, crypto_1.randomBytes)(8).toString('hex')}`;
            advertisements.push(adId);
            // Simulate publishing advertisement
            console.log(`📡 Publishing to topic ${topic}: ${adId}`);
        }
        // Update database with advertisements
        await this.pool.query(`
      UPDATE overlay_storage_index
      SET overlay_advertisements = $1
      WHERE content_hash = $2
    `, [advertisements, contentHash]);
        return advertisements;
    }
    async initializeReplication(contentHash) {
        const replicationTargets = ['s3', 'cdn'];
        const jobIds = [];
        for (const target of replicationTargets) {
            const jobId = `repl_job_${(0, crypto_1.randomBytes)(8).toString('hex')}`;
            jobIds.push(jobId);
            await this.pool.query(`
        INSERT INTO storage_replications (
          content_hash, source_location, target_location, replication_job_id, status
        ) VALUES ($1, $2, $3, $4, $5)
      `, [contentHash, 'local', target, jobId, 'pending']);
        }
        return jobIds;
    }
    async getStorageLocations(contentHash) {
        const result = await this.pool.query(`
      SELECT local_path, overlay_uhrp_url, s3_key, cdn_url
      FROM overlay_storage_index
      WHERE content_hash = $1
    `, [contentHash]);
        if (result.rows.length === 0) {
            return [];
        }
        const row = result.rows[0];
        const locations = [];
        if (row.local_path) {
            locations.push({
                type: 'local',
                url: `file://${row.local_path}`,
                availability: 0.99,
                latency: 5,
                bandwidth: 1000,
                cost: 0,
                geographicRegion: ['local'],
                verifiedAt: new Date().toISOString(),
            });
        }
        if (row.overlay_uhrp_url) {
            locations.push({
                type: 'uhrp',
                url: row.overlay_uhrp_url,
                availability: 0.95,
                latency: 100,
                bandwidth: 100,
                cost: 10,
                geographicRegion: this.config.geographicRegions || ['US'],
                verifiedAt: new Date().toISOString(),
            });
        }
        return locations;
    }
    async getAvailableLocations(contentHash) {
        return this.getStorageLocations(contentHash);
    }
    async selectOptimalLocation(locations, options) {
        if (options.preferredMethod && options.preferredMethod !== 'auto') {
            const preferred = locations.find((loc) => loc.type === options.preferredMethod);
            if (preferred)
                return preferred;
        }
        // Score locations based on multiple factors
        const scoredLocations = locations.map((location) => ({
            location,
            score: this.calculateLocationScore(location, options),
        }));
        scoredLocations.sort((a, b) => b.score - a.score);
        return scoredLocations[0].location;
    }
    calculateLocationScore(location, options) {
        let score = 0;
        // Latency score (lower is better)
        const maxLatency = options.maxLatency || 1000;
        if (location.latency <= maxLatency) {
            score += ((maxLatency - location.latency) / maxLatency) * 30;
        }
        // Availability score
        score += location.availability * 25;
        // Geographic preference
        if (options.geographicPreference) {
            const hasPreferredRegion = location.geographicRegion.some((region) => options.geographicPreference.includes(region));
            if (hasPreferredRegion) {
                score += 20;
            }
        }
        // Cost efficiency (lower cost is better)
        score += ((100 - location.cost) / 100) * 15;
        // Bandwidth capacity
        score += Math.min(location.bandwidth / 100, 1) * 10;
        return score;
    }
    async verifyLocationIntegrity(contentHash, location) {
        const startTime = Date.now();
        try {
            // Simulate content verification
            // In real implementation, this would download and verify the content
            const responseTime = Date.now() - startTime;
            return {
                location,
                hashMatch: true, // Simulated success
                responseTime,
                contentSize: 1024, // Simulated size
                error: null,
            };
        }
        catch (error) {
            return {
                location,
                hashMatch: false,
                responseTime: Date.now() - startTime,
                contentSize: 0,
                error: error.message,
            };
        }
    }
    async assignVerificationAgents(contentHash) {
        // Simulate agent assignment
        const agents = [`agent_verify_${(0, crypto_1.randomBytes)(4).toString('hex')}`];
        await this.pool.query(`
      UPDATE overlay_storage_index
      SET verification_agents = $1
      WHERE content_hash = $2
    `, [agents, contentHash]);
        return agents;
    }
    async getOverlayRoute(contentHash, location) {
        // Simulate overlay routing
        if (location.type === 'uhrp' || location.type === 'overlay') {
            return [
                {
                    nodeId: `node_${(0, crypto_1.randomBytes)(4).toString('hex')}`,
                    location: 'US-East',
                    latency: 50,
                    hops: 1,
                },
            ];
        }
        return [];
    }
    async logAccess(contentHash, location, startTime) {
        await this.pool.query(`
      INSERT INTO storage_access_logs (
        content_hash, access_method, response_time_ms, success
      ) VALUES ($1, $2, $3, $4)
    `, [contentHash, location.type, Date.now() - startTime, true]);
    }
    calculateContentHash(content) {
        return 'sha256:' + (0, crypto_1.createHash)('sha256').update(content).digest('hex');
    }
    generateAdvertisementId() {
        return `ship_ad_${(0, crypto_1.randomBytes)(12).toString('hex')}`;
    }
    async getStorageProviderIdentity() {
        // Get identity from wallet
        try {
            const publicKey = await this.walletClient.getPublicKey({ identityKey: true });
            return publicKey.publicKey.slice(0, 16);
        }
        catch {
            return 'local_provider';
        }
    }
    getStorageEndpoints() {
        return [`${this.config.baseUrl}/overlay/data`, `${this.config.baseUrl}/storage/uhrp`];
    }
    async publishAdvertisementToOverlay(advertisementData, signature) {
        // Simulate publishing to overlay network
        console.log('📡 Publishing advertisement to overlay network');
    }
}
exports.UHRPStorageService = UHRPStorageService;
exports.default = UHRPStorageService;
//# sourceMappingURL=uhrp-storage.js.map