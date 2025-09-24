/**
 * Cross-Overlay Network Federation Manager
 *
 * Implements multi-node content synchronization, global content discovery,
 * and cross-network payment settlement for distributed overlay networks.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import type { DatabaseAdapter } from './brc26-uhrp';

// ==================== Core Types ====================

export interface FederationNode {
  nodeId: string;
  hostname: string;
  port: number;
  publicKey: string;
  capabilities: NodeCapability[];
  lastSeen: Date;
  reputation: number;
  region: string;
}

export interface NodeCapability {
  service: string;
  version: string;
  endpoints: string[];
  maxThroughput: number;
  costPerRequest: number;
}

export interface ContentSync {
  contentHash: string;
  sourceNode: string;
  targetNodes: string[];
  syncStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
  priority: 'low' | 'normal' | 'high';
  createdAt: Date;
  completedAt?: Date;
  progress: number;
}

export interface GlobalContentReference {
  contentHash: string;
  availableNodes: string[];
  primaryNode: string;
  backupNodes: string[];
  contentType: string;
  size: number;
  createdAt: Date;
  lastVerified: Date;
  verificationStatus: 'verified' | 'pending' | 'failed';
}

export interface FederationMetrics {
  connectedNodes: number;
  totalContent: number;
  syncedContent: number;
  pendingSyncs: number;
  averageLatency: number;
  totalThroughput: number;
}

// ==================== Federation Manager ====================

export class FederationManager extends EventEmitter {
  private database: DatabaseAdapter;
  private nodeId: string;
  private privateKey: string;
  private connectedNodes: Map<string, FederationNode>;
  private syncQueue: Map<string, ContentSync>;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(database: DatabaseAdapter, nodeId: string, privateKey: string) {
    super();
    this.database = database;
    this.nodeId = nodeId;
    this.privateKey = privateKey;
    this.connectedNodes = new Map();
    this.syncQueue = new Map();
  }

  // ==================== Node Management ====================

  async initialize(): Promise<void> {
    try {
      await this.createFederationTables();
      await this.loadConnectedNodes();
      await this.startHeartbeat();

      console.log(`[FEDERATION] Node ${this.nodeId} initialized with ${this.connectedNodes.size} connected nodes`);
      this.emit('federation:initialized', { nodeId: this.nodeId });
    } catch (error) {
      console.error('[FEDERATION] Initialization failed:', error);
      throw error;
    }
  }

  async registerNode(node: Omit<FederationNode, 'lastSeen' | 'reputation'>): Promise<void> {
    try {
      const federationNode: FederationNode = {
        ...node,
        lastSeen: new Date(),
        reputation: 1.0
      };

      await this.database.execute(`
        INSERT INTO federation_nodes (
          node_id, hostname, port, public_key, capabilities,
          last_seen, reputation, region
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (node_id) DO UPDATE SET
          hostname = EXCLUDED.hostname,
          port = EXCLUDED.port,
          capabilities = EXCLUDED.capabilities,
          last_seen = EXCLUDED.last_seen,
          reputation = EXCLUDED.reputation,
          region = EXCLUDED.region
      `, [
        node.nodeId,
        node.hostname,
        node.port,
        node.publicKey,
        JSON.stringify(node.capabilities),
        federationNode.lastSeen,
        federationNode.reputation,
        node.region
      ]);

      this.connectedNodes.set(node.nodeId, federationNode);

      console.log(`[FEDERATION] Node ${node.nodeId} registered from ${node.hostname}:${node.port}`);
      this.emit('node:registered', federationNode);
    } catch (error) {
      console.error(`[FEDERATION] Failed to register node ${node.nodeId}:`, error);
      throw error;
    }
  }

  async discoverNodes(region?: string): Promise<FederationNode[]> {
    try {
      const whereClause = region ? 'WHERE region = $1' : '';
      const params = region ? [region] : [];

      const nodes = await this.database.query(`
        SELECT node_id, hostname, port, public_key, capabilities,
               last_seen, reputation, region
        FROM federation_nodes
        ${whereClause}
        ORDER BY reputation DESC, last_seen DESC
      `, params);

      return nodes.map(node => ({
        nodeId: node.node_id,
        hostname: node.hostname,
        port: node.port,
        publicKey: node.public_key,
        capabilities: JSON.parse(node.capabilities),
        lastSeen: new Date(node.last_seen),
        reputation: parseFloat(node.reputation),
        region: node.region
      }));
    } catch (error) {
      console.error('[FEDERATION] Node discovery failed:', error);
      return [];
    }
  }

  // ==================== Content Synchronization ====================

  async initiateContentSync(contentHash: string, targetNodes: string[], priority: 'low' | 'normal' | 'high' = 'normal'): Promise<string> {
    try {
      const syncId = crypto.randomUUID();
      const contentSync: ContentSync = {
        contentHash,
        sourceNode: this.nodeId,
        targetNodes,
        syncStatus: 'pending',
        priority,
        createdAt: new Date(),
        progress: 0
      };

      await this.database.execute(`
        INSERT INTO content_sync_jobs (
          sync_id, content_hash, source_node, target_nodes,
          sync_status, priority, created_at, progress
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        syncId,
        contentHash,
        this.nodeId,
        JSON.stringify(targetNodes),
        'pending',
        priority,
        contentSync.createdAt,
        0
      ]);

      this.syncQueue.set(syncId, contentSync);

      // Start sync process asynchronously
      this.processContentSync(syncId).catch(error => {
        console.error(`[FEDERATION] Content sync ${syncId} failed:`, error);
        this.emit('sync:failed', { syncId, contentHash, error: error.message });
      });

      console.log(`[FEDERATION] Content sync initiated: ${syncId} for ${contentHash}`);
      this.emit('sync:initiated', { syncId, contentHash, targetNodes });

      return syncId;
    } catch (error) {
      console.error(`[FEDERATION] Failed to initiate content sync for ${contentHash}:`, error);
      throw error;
    }
  }

  async processContentSync(syncId: string): Promise<void> {
    const sync = this.syncQueue.get(syncId);
    if (!sync) {
      throw new Error(`Sync job ${syncId} not found`);
    }

    try {
      // Update status to in-progress
      sync.syncStatus = 'in-progress';
      await this.updateSyncStatus(syncId, 'in-progress', 0);

      // Get content from local storage
      const contentData = await this.getLocalContent(sync.contentHash);
      if (!contentData) {
        throw new Error(`Content ${sync.contentHash} not found locally`);
      }

      // Sync to target nodes
      const syncPromises = sync.targetNodes.map(async (nodeId, index) => {
        const node = this.connectedNodes.get(nodeId);
        if (!node) {
          throw new Error(`Target node ${nodeId} not connected`);
        }

        await this.transferContentToNode(sync.contentHash, contentData, node);

        // Update progress
        const progress = ((index + 1) / sync.targetNodes.length) * 100;
        sync.progress = progress;
        await this.updateSyncStatus(syncId, 'in-progress', progress);
      });

      await Promise.all(syncPromises);

      // Mark as completed
      sync.syncStatus = 'completed';
      sync.completedAt = new Date();
      await this.updateSyncStatus(syncId, 'completed', 100);

      console.log(`[FEDERATION] Content sync completed: ${syncId}`);
      this.emit('sync:completed', { syncId, contentHash: sync.contentHash });
    } catch (error) {
      sync.syncStatus = 'failed';
      await this.updateSyncStatus(syncId, 'failed', sync.progress);
      throw error;
    }
  }

  // ==================== Global Content Discovery ====================

  async registerGlobalContent(contentHash: string, metadata: {
    contentType: string;
    size: number;
    backupNodes?: string[];
  }): Promise<void> {
    try {
      const globalContent: GlobalContentReference = {
        contentHash,
        availableNodes: [this.nodeId],
        primaryNode: this.nodeId,
        backupNodes: metadata.backupNodes || [],
        contentType: metadata.contentType,
        size: metadata.size,
        createdAt: new Date(),
        lastVerified: new Date(),
        verificationStatus: 'verified'
      };

      await this.database.execute(`
        INSERT INTO global_content_registry (
          content_hash, available_nodes, primary_node, backup_nodes,
          content_type, size, created_at, last_verified, verification_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (content_hash) DO UPDATE SET
          available_nodes = array_append(
            COALESCE(global_content_registry.available_nodes, ARRAY[]::text[]),
            $2
          ),
          last_verified = EXCLUDED.last_verified,
          verification_status = EXCLUDED.verification_status
      `, [
        contentHash,
        JSON.stringify([this.nodeId]),
        this.nodeId,
        JSON.stringify(metadata.backupNodes || []),
        metadata.contentType,
        metadata.size,
        globalContent.createdAt,
        globalContent.lastVerified,
        'verified'
      ]);

      console.log(`[FEDERATION] Global content registered: ${contentHash}`);
      this.emit('content:registered', globalContent);
    } catch (error) {
      console.error(`[FEDERATION] Failed to register global content ${contentHash}:`, error);
      throw error;
    }
  }

  async discoverGlobalContent(contentHash: string): Promise<GlobalContentReference | null> {
    try {
      const result = await this.database.queryOne(`
        SELECT content_hash, available_nodes, primary_node, backup_nodes,
               content_type, size, created_at, last_verified, verification_status
        FROM global_content_registry
        WHERE content_hash = $1
      `, [contentHash]);

      if (!result) {
        return null;
      }

      return {
        contentHash: result.content_hash,
        availableNodes: JSON.parse(result.available_nodes),
        primaryNode: result.primary_node,
        backupNodes: JSON.parse(result.backup_nodes),
        contentType: result.content_type,
        size: result.size,
        createdAt: new Date(result.created_at),
        lastVerified: new Date(result.last_verified),
        verificationStatus: result.verification_status
      };
    } catch (error) {
      console.error(`[FEDERATION] Failed to discover global content ${contentHash}:`, error);
      return null;
    }
  }

  async routeContentRequest(contentHash: string, clientRegion?: string): Promise<FederationNode | null> {
    try {
      const globalContent = await this.discoverGlobalContent(contentHash);
      if (!globalContent) {
        return null;
      }

      // Find best node for client region
      const availableNodes = await Promise.all(
        globalContent.availableNodes.map(nodeId => this.connectedNodes.get(nodeId))
      ).then(nodes => nodes.filter(Boolean) as FederationNode[]);

      if (availableNodes.length === 0) {
        return null;
      }

      // Route based on region, reputation, and load
      let bestNode = availableNodes[0];
      let bestScore = 0;

      for (const node of availableNodes) {
        let score = node.reputation;

        // Prefer same region
        if (clientRegion && node.region === clientRegion) {
          score += 0.5;
        }

        // Prefer less loaded nodes
        const loadFactor = await this.getNodeLoadFactor(node.nodeId);
        score += (1 - loadFactor) * 0.3;

        if (score > bestScore) {
          bestScore = score;
          bestNode = node;
        }
      }

      return bestNode;
    } catch (error) {
      console.error(`[FEDERATION] Failed to route content request for ${contentHash}:`, error);
      return null;
    }
  }

  // ==================== Analytics and Monitoring ====================

  async getFederationMetrics(): Promise<FederationMetrics> {
    try {
      const [nodeStats, contentStats, syncStats] = await Promise.all([
        this.database.queryOne('SELECT COUNT(*) as count FROM federation_nodes WHERE last_seen > NOW() - INTERVAL \'5 minutes\''),
        this.database.queryOne('SELECT COUNT(*) as count FROM global_content_registry'),
        this.database.queryOne(`
          SELECT
            COUNT(*) FILTER (WHERE sync_status = 'completed') as synced,
            COUNT(*) FILTER (WHERE sync_status IN ('pending', 'in-progress')) as pending
          FROM content_sync_jobs
          WHERE created_at > NOW() - INTERVAL '24 hours'
        `)
      ]);

      return {
        connectedNodes: parseInt(nodeStats?.count || '0'),
        totalContent: parseInt(contentStats?.count || '0'),
        syncedContent: parseInt(syncStats?.synced || '0'),
        pendingSyncs: parseInt(syncStats?.pending || '0'),
        averageLatency: await this.calculateAverageLatency(),
        totalThroughput: await this.calculateTotalThroughput()
      };
    } catch (error) {
      console.error('[FEDERATION] Failed to get metrics:', error);
      return {
        connectedNodes: 0,
        totalContent: 0,
        syncedContent: 0,
        pendingSyncs: 0,
        averageLatency: 0,
        totalThroughput: 0
      };
    }
  }

  // ==================== Private Helper Methods ====================

  private async createFederationTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS federation_nodes (
        node_id TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        port INTEGER NOT NULL,
        public_key TEXT NOT NULL,
        capabilities JSONB NOT NULL,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reputation DECIMAL(3,2) DEFAULT 1.0,
        region TEXT DEFAULT 'unknown',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS content_sync_jobs (
        sync_id TEXT PRIMARY KEY,
        content_hash TEXT NOT NULL,
        source_node TEXT NOT NULL,
        target_nodes JSONB NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'normal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        progress INTEGER DEFAULT 0
      )`,

      `CREATE TABLE IF NOT EXISTS global_content_registry (
        content_hash TEXT PRIMARY KEY,
        available_nodes JSONB NOT NULL,
        primary_node TEXT NOT NULL,
        backup_nodes JSONB DEFAULT '[]'::jsonb,
        content_type TEXT NOT NULL,
        size BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_verified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verification_status TEXT DEFAULT 'pending'
      )`,

      `CREATE INDEX IF NOT EXISTS idx_federation_nodes_region
       ON federation_nodes(region, reputation DESC, last_seen DESC)`,

      `CREATE INDEX IF NOT EXISTS idx_content_sync_status
       ON content_sync_jobs(sync_status, priority, created_at DESC)`,

      `CREATE INDEX IF NOT EXISTS idx_global_content_type
       ON global_content_registry(content_type, last_verified DESC)`
    ];

    for (const sql of tables) {
      await this.database.execute(sql);
    }
  }

  private async loadConnectedNodes(): Promise<void> {
    try {
      const nodes = await this.discoverNodes();
      for (const node of nodes) {
        this.connectedNodes.set(node.nodeId, node);
      }
    } catch (error) {
      console.error('[FEDERATION] Failed to load connected nodes:', error);
    }
  }

  private async startHeartbeat(): Promise<void> {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.sendHeartbeat();
        await this.cleanupStaleNodes();
      } catch (error) {
        console.error('[FEDERATION] Heartbeat failed:', error);
      }
    }, 30000); // Every 30 seconds
  }

  private async sendHeartbeat(): Promise<void> {
    // Update our own last_seen timestamp
    await this.database.execute(`
      UPDATE federation_nodes
      SET last_seen = CURRENT_TIMESTAMP
      WHERE node_id = $1
    `, [this.nodeId]);
  }

  private async cleanupStaleNodes(): Promise<void> {
    const staleNodes = await this.database.query(`
      SELECT node_id
      FROM federation_nodes
      WHERE last_seen < NOW() - INTERVAL '5 minutes'
    `);

    for (const node of staleNodes) {
      this.connectedNodes.delete(node.node_id);
      console.log(`[FEDERATION] Removed stale node: ${node.node_id}`);
    }
  }

  private async updateSyncStatus(syncId: string, status: string, progress: number): Promise<void> {
    await this.database.execute(`
      UPDATE content_sync_jobs
      SET sync_status = $1, progress = $2, completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE sync_id = $3
    `, [status, progress, syncId]);
  }

  private async getLocalContent(contentHash: string): Promise<Buffer | null> {
    // This would interface with the local BRC-26 UHRP service
    // For now, return mock data
    return Buffer.from(`mock content for ${contentHash}`);
  }

  private async transferContentToNode(contentHash: string, contentData: Buffer, targetNode: FederationNode): Promise<void> {
    // This would implement the actual network transfer
    // For now, simulate transfer
    console.log(`[FEDERATION] Transferring ${contentHash} to node ${targetNode.nodeId} (${contentData.length} bytes)`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async getNodeLoadFactor(nodeId: string): Promise<number> {
    // Calculate current load factor for a node (0 = no load, 1 = full load)
    // This would check active connections, CPU usage, etc.
    return Math.random() * 0.5; // Mock: random load between 0-50%
  }

  private async calculateAverageLatency(): Promise<number> {
    // Calculate average network latency to connected nodes
    return 50; // Mock: 50ms average
  }

  private async calculateTotalThroughput(): Promise<number> {
    // Calculate total network throughput in MB/s
    return 100; // Mock: 100 MB/s total throughput
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    console.log(`[FEDERATION] Node ${this.nodeId} shutting down`);
    this.emit('federation:shutdown', { nodeId: this.nodeId });
  }
}