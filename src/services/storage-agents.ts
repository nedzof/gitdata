/**
 * D22 - BSV Overlay Network Storage Backend
 * Storage Agent Coordination System
 * Manages automated replication and verification agents
 */

import { createHash, randomBytes } from 'crypto';

import type { WalletClient } from '@bsv/sdk';
import type { Pool } from 'pg';
import { D22StorageSchema } from '../db/schema-d22-overlay-storage.js';

import type {
  StorageLocation,
  IntegrityVerification,
  LocationVerification,
} from './uhrp-storage.js';

export interface ReplicationJob {
  id: string;
  contentHash: string;
  sourceLocation: StorageLocation;
  targetLocation: StorageLocation;
  priority: number;
  retryCount: number;
  maxRetries: number;
  estimatedSizeBytes: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface ReplicationResult {
  jobId: string;
  success: boolean;
  bytesReplicated: number;
  duration: number;
  verificationHash?: string;
  error?: string;
}

export interface VerificationJob {
  id: string;
  contentHash: string;
  verificationType: 'hash' | 'availability' | 'integrity' | 'full';
  locations: StorageLocation[];
  scheduleInterval: number; // hours
  lastRun?: Date;
  nextRun: Date;
}

export interface AgentCapability {
  agentId: string;
  agentType: 'replication' | 'verification' | 'monitoring';
  capabilities: string[];
  maxConcurrentJobs: number;
  currentJobs: number;
  reliability: number; // 0-1 score
  averageJobTime: number; // minutes
  geographicRegions: string[];
  costPerJob: number; // satoshis
  lastSeen: Date;
}

export interface NetworkVerification {
  contentHash: string;
  totalLocations: number;
  healthyLocations: number;
  corruptedLocations: number;
  missingLocations: number;
  integrityScore: number;
  recommendedActions: string[];
  verifiedAt: Date;
}

export class StorageReplicationAgent {
  private pool: Pool;
  private walletClient: WalletClient;
  private agentId: string;
  private isActive: boolean = false;
  private currentJobs: Map<string, ReplicationJob> = new Map();

  constructor(pool: Pool, walletClient: WalletClient, agentId?: string) {
    this.pool = pool;
    this.walletClient = walletClient;
    this.agentId = agentId || `repl_agent_${randomBytes(8).toString('hex')}`;
  }

  async start(): Promise<void> {
    console.log(`🤖 Starting replication agent: ${this.agentId}`);
    this.isActive = true;

    // Register agent capabilities
    await this.registerAgent();

    // Start job processing loop
    this.processJobs();
  }

  async stop(): Promise<void> {
    console.log(`🛑 Stopping replication agent: ${this.agentId}`);
    this.isActive = false;

    // Complete current jobs
    await this.completeCurrentJobs();

    // Unregister agent
    await this.unregisterAgent();
  }

  private async registerAgent(): Promise<void> {
    const capability: AgentCapability = {
      agentId: this.agentId,
      agentType: 'replication',
      capabilities: ['local-to-s3', 'local-to-cdn', 'overlay-sync', 'integrity-check'],
      maxConcurrentJobs: 5,
      currentJobs: 0,
      reliability: 0.95,
      averageJobTime: 10, // 10 minutes average
      geographicRegions: ['US', 'EU'],
      costPerJob: 1000, // 1000 satoshis per job
      lastSeen: new Date(),
    };

    // In real implementation, this would register with the agent marketplace
    console.log(`📋 Registered agent capabilities:`, capability);
  }

  private async processJobs(): Promise<void> {
    while (this.isActive) {
      try {
        // Get pending replication jobs
        const pendingJobs = await this.getPendingJobs();

        // Process jobs concurrently up to max capacity
        const availableSlots = Math.max(0, 5 - this.currentJobs.size);
        const jobsToProcess = pendingJobs.slice(0, availableSlots);

        for (const job of jobsToProcess) {
          this.currentJobs.set(job.id, job);
          this.executeReplicationJob(job).catch((error) => {
            console.error(`❌ Job ${job.id} failed:`, error);
            this.currentJobs.delete(job.id);
          });
        }

        // Wait before next iteration
        await this.sleep(30000); // 30 seconds
      } catch (error) {
        console.error(`❌ Job processing error:`, error);
        await this.sleep(60000); // 1 minute on error
      }
    }
  }

  private async getPendingJobs(): Promise<ReplicationJob[]> {
    const result = await this.pool.query(
      `
      SELECT
        sr.id,
        sr.content_hash,
        sr.source_location,
        sr.target_location,
        sr.started_at,
        osi.file_size
      FROM storage_replications sr
      JOIN overlay_storage_index osi ON sr.content_hash = osi.content_hash
      WHERE sr.status = 'pending'
        AND (sr.replication_agent IS NULL OR sr.replication_agent = $1)
      ORDER BY sr.started_at ASC
      LIMIT 10
    `,
      [this.agentId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      contentHash: row.content_hash,
      sourceLocation: { type: row.source_location } as StorageLocation,
      targetLocation: { type: row.target_location } as StorageLocation,
      priority: 1,
      retryCount: 0,
      maxRetries: 3,
      estimatedSizeBytes: row.file_size || 0,
      createdAt: row.started_at || new Date(),
    }));
  }

  async executeReplicationJob(job: ReplicationJob): Promise<ReplicationResult> {
    const startTime = Date.now();
    console.log(`🔄 Starting replication job ${job.id}: ${job.contentHash.slice(0, 10)}...`);

    try {
      // Update job status to in_progress
      await this.pool.query(
        `
        UPDATE storage_replications
        SET status = 'in_progress', replication_agent = $1, started_at = NOW()
        WHERE id = $2
      `,
        [this.agentId, job.id],
      );

      // Perform replication based on source and target types
      const result = await this.performReplication(job);

      // Update job status to completed
      await this.pool.query(
        `
        UPDATE storage_replications
        SET status = 'completed', bytes_replicated = $1, completed_at = NOW(),
            progress_percentage = 100
        WHERE id = $2
      `,
        [result.bytesReplicated, job.id],
      );

      // Update storage index with new location
      await this.updateStorageIndex(job.contentHash, job.targetLocation, result);

      console.log(`✅ Replication job ${job.id} completed: ${result.bytesReplicated} bytes`);
      return result;
    } catch (error) {
      console.error(`❌ Replication job ${job.id} failed:`, error);

      // Update job status to failed
      await this.pool.query(
        `
        UPDATE storage_replications
        SET status = 'failed', error_message = $1
        WHERE id = $2
      `,
        [error.message, job.id],
      );

      return {
        jobId: job.id,
        success: false,
        bytesReplicated: 0,
        duration: Date.now() - startTime,
        error: error.message,
      };
    } finally {
      this.currentJobs.delete(job.id);
    }
  }

  private async performReplication(job: ReplicationJob): Promise<ReplicationResult> {
    const startTime = Date.now();

    // Get source content
    const sourceContent = await this.getContentFromLocation(job.contentHash, job.sourceLocation);

    // Verify source integrity
    const sourceHash = this.calculateHash(sourceContent);
    const expectedHash = job.contentHash.replace('sha256:', '');

    if (sourceHash !== expectedHash) {
      throw new Error(`Source content integrity check failed: ${sourceHash} !== ${expectedHash}`);
    }

    // Store at target location
    await this.storeContentAtLocation(sourceContent, job.targetLocation);

    // Verify target integrity
    const targetContent = await this.getContentFromLocation(job.contentHash, job.targetLocation);
    const targetHash = this.calculateHash(targetContent);

    if (targetHash !== expectedHash) {
      throw new Error(`Target content integrity check failed: ${targetHash} !== ${expectedHash}`);
    }

    return {
      jobId: job.id,
      success: true,
      bytesReplicated: sourceContent.length,
      duration: Date.now() - startTime,
      verificationHash: targetHash,
    };
  }

  private async getContentFromLocation(
    contentHash: string,
    location: StorageLocation,
  ): Promise<Buffer> {
    // Simulate content retrieval based on location type
    switch (location.type) {
      case 'local': {
        // Read from local filesystem
        const fs = await import('fs/promises');
        const path = await import('path');
        const fileName = `${contentHash.replace('sha256:', '')}.bin`;
        const localPath = path.join('/tmp/overlay-storage', fileName);
        return fs.readFile(localPath);
      }

      case 's3':
        // Simulate S3 download
        console.log(`📥 Downloading from S3: ${contentHash.slice(0, 10)}...`);
        return Buffer.from(`simulated-s3-content-${contentHash}`);

      case 'cdn':
        // Simulate CDN download
        console.log(`📥 Downloading from CDN: ${contentHash.slice(0, 10)}...`);
        return Buffer.from(`simulated-cdn-content-${contentHash}`);

      default:
        throw new Error(`Unsupported source location type: ${location.type}`);
    }
  }

  private async storeContentAtLocation(content: Buffer, location: StorageLocation): Promise<void> {
    switch (location.type) {
      case 's3':
        // Simulate S3 upload
        console.log(`📤 Uploading to S3: ${content.length} bytes`);
        break;

      case 'cdn':
        // Simulate CDN upload
        console.log(`📤 Uploading to CDN: ${content.length} bytes`);
        break;

      default:
        throw new Error(`Unsupported target location type: ${location.type}`);
    }
  }

  private async updateStorageIndex(
    contentHash: string,
    targetLocation: StorageLocation,
    result: ReplicationResult,
  ): Promise<void> {
    const updateField = targetLocation.type === 's3' ? 's3_key' : 'cdn_url';
    const updateValue = `${targetLocation.type}://${contentHash}`;

    await this.pool.query(
      `
      UPDATE overlay_storage_index
      SET ${updateField} = $1, updated_at = NOW()
      WHERE content_hash = $2
    `,
      [updateValue, contentHash],
    );
  }

  private calculateHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private async completeCurrentJobs(): Promise<void> {
    console.log(`⏳ Waiting for ${this.currentJobs.size} jobs to complete...`);

    while (this.currentJobs.size > 0) {
      await this.sleep(1000);
    }
  }

  private async unregisterAgent(): Promise<void> {
    // In real implementation, this would unregister from the agent marketplace
    console.log(`📋 Unregistered agent: ${this.agentId}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class StorageVerificationAgent {
  private pool: Pool;
  private walletClient: WalletClient;
  private agentId: string;
  private isActive: boolean = false;

  constructor(pool: Pool, walletClient: WalletClient, agentId?: string) {
    this.pool = pool;
    this.walletClient = walletClient;
    this.agentId = agentId || `verify_agent_${randomBytes(8).toString('hex')}`;
  }

  async start(): Promise<void> {
    console.log(`🔍 Starting verification agent: ${this.agentId}`);
    this.isActive = true;

    await this.registerAgent();
    this.processVerifications();
  }

  async stop(): Promise<void> {
    console.log(`🛑 Stopping verification agent: ${this.agentId}`);
    this.isActive = false;
  }

  private async registerAgent(): Promise<void> {
    const capability: AgentCapability = {
      agentId: this.agentId,
      agentType: 'verification',
      capabilities: [
        'hash-verification',
        'availability-check',
        'integrity-scan',
        'consensus-validation',
      ],
      maxConcurrentJobs: 10,
      currentJobs: 0,
      reliability: 0.98,
      averageJobTime: 2, // 2 minutes average
      geographicRegions: ['US', 'EU'],
      costPerJob: 500, // 500 satoshis per verification
      lastSeen: new Date(),
    };

    console.log(`📋 Registered verification agent:`, capability);
  }

  private async processVerifications(): Promise<void> {
    while (this.isActive) {
      try {
        // Find content that needs verification
        const contentToVerify = await this.getContentNeedingVerification();

        for (const contentHash of contentToVerify) {
          await this.performIntegrityCheck(contentHash);
        }

        // Wait before next verification cycle
        await this.sleep(300000); // 5 minutes
      } catch (error) {
        console.error(`❌ Verification processing error:`, error);
        await this.sleep(60000);
      }
    }
  }

  private async getContentNeedingVerification(): Promise<string[]> {
    const result = await this.pool.query(`
      SELECT content_hash
      FROM overlay_storage_index
      WHERE last_verified_at IS NULL
         OR last_verified_at < NOW() - INTERVAL '6 hours'
      ORDER BY last_verified_at ASC NULLS FIRST
      LIMIT 20
    `);

    return result.rows.map((row) => row.content_hash);
  }

  async performIntegrityCheck(contentHash: string): Promise<IntegrityVerification> {
    console.log(`🔒 Verifying integrity: ${contentHash.slice(0, 10)}...`);

    try {
      // Get all storage locations for this content
      const locations = await this.getStorageLocations(contentHash);

      if (locations.length === 0) {
        throw new Error(`No storage locations found for content: ${contentHash}`);
      }

      // Verify integrity at each location
      const verificationPromises = locations.map((location) =>
        this.verifyLocationIntegrity(contentHash, location),
      );

      const results = await Promise.allSettled(verificationPromises);
      const verificationResults: LocationVerification[] = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<LocationVerification>).value);

      // Calculate consensus
      const successfulVerifications = verificationResults.filter((v) => v.hashMatch);
      const agreementRatio = successfulVerifications.length / verificationResults.length;
      const consensusAchieved = agreementRatio >= 0.67; // 2/3 consensus

      // Store verification results
      for (const result of verificationResults) {
        await this.pool.query(
          `
          INSERT INTO storage_verifications (
            content_hash, verification_type, storage_location,
            verification_agent, verification_result, response_time_ms, error_details
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
          [
            contentHash,
            'integrity',
            result.location.type,
            this.agentId,
            result.hashMatch,
            result.responseTime,
            result.error ? JSON.stringify({ error: result.error }) : null,
          ],
        );
      }

      // Update last verified timestamp
      await this.pool.query(
        `
        UPDATE overlay_storage_index
        SET last_verified_at = NOW()
        WHERE content_hash = $1
      `,
        [contentHash],
      );

      const verification: IntegrityVerification = {
        contentHash,
        verificationResults,
        consensusAchieved,
        agreementRatio,
        verifiedAt: new Date(),
      };

      console.log(`✅ Integrity verification completed: ${agreementRatio * 100}% agreement`);
      return verification;
    } catch (error) {
      console.error(`❌ Integrity verification failed for ${contentHash}:`, error);
      throw error;
    }
  }

  private async getStorageLocations(contentHash: string): Promise<StorageLocation[]> {
    const result = await this.pool.query(
      `
      SELECT local_path, overlay_uhrp_url, s3_key, cdn_url
      FROM overlay_storage_index
      WHERE content_hash = $1
    `,
      [contentHash],
    );

    if (result.rows.length === 0) {
      return [];
    }

    const row = result.rows[0];
    const locations: StorageLocation[] = [];

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

    if (row.s3_key) {
      locations.push({
        type: 's3',
        url: row.s3_key,
        availability: 0.995,
        latency: 100,
        bandwidth: 200,
        cost: 5,
        geographicRegion: ['US'],
        verifiedAt: new Date().toISOString(),
      });
    }

    if (row.cdn_url) {
      locations.push({
        type: 'cdn',
        url: row.cdn_url,
        availability: 0.999,
        latency: 50,
        bandwidth: 500,
        cost: 2,
        geographicRegion: ['US', 'EU'],
        verifiedAt: new Date().toISOString(),
      });
    }

    return locations;
  }

  private async verifyLocationIntegrity(
    contentHash: string,
    location: StorageLocation,
  ): Promise<LocationVerification> {
    const startTime = Date.now();

    try {
      // Download content from location
      const content = await this.downloadContentFromLocation(contentHash, location);

      // Calculate hash
      const actualHash = 'sha256:' + createHash('sha256').update(content).digest('hex');
      const hashMatch = actualHash === contentHash;

      return {
        location,
        hashMatch,
        responseTime: Date.now() - startTime,
        contentSize: content.length,
        error: null,
      };
    } catch (error) {
      return {
        location,
        hashMatch: false,
        responseTime: Date.now() - startTime,
        contentSize: 0,
        error: error.message,
      };
    }
  }

  private async downloadContentFromLocation(
    contentHash: string,
    location: StorageLocation,
  ): Promise<Buffer> {
    // Simulate content download and verification
    switch (location.type) {
      case 'local': {
        const fs = await import('fs/promises');
        return fs.readFile(location.url.replace('file://', ''));
      }

      case 's3':
        // Simulate S3 download
        await this.sleep(100); // Simulate network latency
        return Buffer.from(`verified-s3-content-${contentHash}`);

      case 'cdn':
        // Simulate CDN download
        await this.sleep(50); // Simulate CDN speed
        return Buffer.from(`verified-cdn-content-${contentHash}`);

      default:
        throw new Error(`Unsupported location type: ${location.type}`);
    }
  }

  async verifyStorageNetwork(): Promise<NetworkVerification> {
    console.log(`🌐 Performing network-wide storage verification...`);

    const result = await this.pool.query(`
      SELECT
        content_hash,
        CASE
          WHEN local_path IS NOT NULL THEN 1 ELSE 0
        END +
        CASE
          WHEN s3_key IS NOT NULL THEN 1 ELSE 0
        END +
        CASE
          WHEN cdn_url IS NOT NULL THEN 1 ELSE 0
        END as location_count
      FROM overlay_storage_index
    `);

    const totalContent = result.rows.length;
    const wellReplicated = result.rows.filter((row) => row.location_count >= 2).length;
    const integrityScore = totalContent > 0 ? wellReplicated / totalContent : 1;

    const verification: NetworkVerification = {
      contentHash: 'network-wide',
      totalLocations: totalContent,
      healthyLocations: wellReplicated,
      corruptedLocations: 0,
      missingLocations: totalContent - wellReplicated,
      integrityScore,
      recommendedActions: this.generateRecommendations(integrityScore),
      verifiedAt: new Date(),
    };

    console.log(`✅ Network verification completed: ${integrityScore * 100}% integrity`);
    return verification;
  }

  private generateRecommendations(integrityScore: number): string[] {
    const recommendations: string[] = [];

    if (integrityScore < 0.8) {
      recommendations.push('Increase replication factor');
      recommendations.push('Add more storage agents');
    }

    if (integrityScore < 0.9) {
      recommendations.push('Enable more frequent verification');
      recommendations.push('Add geographic redundancy');
    }

    return recommendations;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class StorageAgentCoordinator {
  private pool: Pool;
  private walletClient: WalletClient;
  private replicationAgents: StorageReplicationAgent[] = [];
  private verificationAgents: StorageVerificationAgent[] = [];

  constructor(pool: Pool, walletClient: WalletClient) {
    this.pool = pool;
    this.walletClient = walletClient;
  }

  async startAgents(
    replicationAgentCount: number = 2,
    verificationAgentCount: number = 1,
  ): Promise<void> {
    console.log(`🚀 Starting storage agent coordination system...`);

    // Start replication agents
    for (let i = 0; i < replicationAgentCount; i++) {
      const agent = new StorageReplicationAgent(this.pool, this.walletClient);
      this.replicationAgents.push(agent);
      await agent.start();
    }

    // Start verification agents
    for (let i = 0; i < verificationAgentCount; i++) {
      const agent = new StorageVerificationAgent(this.pool, this.walletClient);
      this.verificationAgents.push(agent);
      await agent.start();
    }

    console.log(
      `✅ Started ${replicationAgentCount} replication and ${verificationAgentCount} verification agents`,
    );
  }

  async stopAgents(): Promise<void> {
    console.log(`🛑 Stopping all storage agents...`);

    // Stop all agents
    const stopPromises = [
      ...this.replicationAgents.map((agent) => agent.stop()),
      ...this.verificationAgents.map((agent) => agent.stop()),
    ];

    await Promise.all(stopPromises);

    this.replicationAgents = [];
    this.verificationAgents = [];

    console.log(`✅ All storage agents stopped`);
  }

  async getAgentStatus(): Promise<{
    replicationAgents: number;
    verificationAgents: number;
    activeJobs: number;
  }> {
    return {
      replicationAgents: this.replicationAgents.length,
      verificationAgents: this.verificationAgents.length,
      activeJobs: 0, // Would track actual active jobs in real implementation
    };
  }
}

export default StorageAgentCoordinator;
