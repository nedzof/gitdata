// D24 Overlay Agent Registry
// BRC-88 integrated agent registration and discovery system

import { EventEmitter } from 'events';
import { DatabaseAdapter } from '../overlay/brc26-uhrp';
import { PostgreSQLBRC88SHIPSLAPService } from '../overlay/brc-services-postgresql';

export interface OverlayAgent {
  agentId: string;
  name: string;
  capabilities: AgentCapability[];
  overlayTopics: string[];
  shipAdvertisementId?: string;
  slapAdvertisementId?: string;
  geographicRegion?: string;
  reputationScore: number;
  performanceStats: AgentPerformanceStats;
  identityKey?: string;
  webhookUrl: string;
  status: 'unknown' | 'up' | 'down';
  lastPingAt?: number;
  overlayNodeId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentCapability {
  name: string;
  inputs: string[];
  outputs: string[];
  description?: string;
  version?: string;
}

export interface AgentPerformanceStats {
  totalJobs: number;
  successfulJobs: number;
  avgExecutionTime: number;
  avgQualityScore: number;
  successRate: number;
  lastJobAt?: number;
}

export interface AgentSearchQuery {
  capability?: string;
  region?: string;
  minReputation?: number;
  maxExecutionTime?: number;
  overlayTopic?: string;
  limit?: number;
  offset?: number;
}

export class OverlayAgentRegistry extends EventEmitter {
  private database: DatabaseAdapter;
  private brc88Service: PostgreSQLBRC88SHIPSLAPService;

  constructor(database: DatabaseAdapter, brc88Service: PostgreSQLBRC88SHIPSLAPService) {
    super();
    this.database = database;
    this.brc88Service = brc88Service;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.setupDatabase();
  }

  private async setupDatabase(): Promise<void> {
    // Enhanced agent registry with overlay integration
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS overlay_agents (
        agent_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        capabilities_json TEXT NOT NULL,
        overlay_topics TEXT[],
        ship_advertisement_id TEXT,
        slap_advertisement_id TEXT,
        geographic_region TEXT,
        reputation_score DECIMAL(3,2) DEFAULT 0.0,
        performance_stats JSONB DEFAULT '{"totalJobs":0,"successfulJobs":0,"avgExecutionTime":0,"avgQualityScore":0,"successRate":0}'::jsonb,
        identity_key TEXT,
        webhook_url TEXT NOT NULL,
        status TEXT DEFAULT 'unknown',
        last_ping_at BIGINT,
        overlay_node_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Agent performance tracking
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS agent_performance (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        execution_time_ms INTEGER,
        success BOOLEAN,
        quality_score DECIMAL(3,2),
        client_feedback JSONB,
        overlay_confirmation TEXT,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await this.database.execute(`
      CREATE INDEX IF NOT EXISTS idx_overlay_agents_topics ON overlay_agents USING GIN(overlay_topics);
      CREATE INDEX IF NOT EXISTS idx_overlay_agents_region ON overlay_agents(geographic_region);
      CREATE INDEX IF NOT EXISTS idx_overlay_agents_reputation ON overlay_agents(reputation_score DESC);
      CREATE INDEX IF NOT EXISTS idx_overlay_agents_status ON overlay_agents(status);
      CREATE INDEX IF NOT EXISTS idx_agent_performance_agent ON agent_performance(agent_id, recorded_at);
    `);
  }

  /**
   * Register agent with BRC-88 SHIP advertisement
   */
  async registerAgent(agentData: {
    name: string;
    capabilities: AgentCapability[];
    overlayTopics: string[];
    webhookUrl: string;
    geographicRegion?: string;
    identityKey?: string;
    overlayNodeId?: string;
  }): Promise<OverlayAgent> {
    const agentId = this.generateAgentId();
    const now = Date.now();

    // Create BRC-88 SHIP advertisement for capabilities
    let shipAdvertisementId: string | undefined;
    if (agentData.overlayTopics.length > 0) {
      try {
        const shipAd = await this.brc88Service.createSHIPAdvertisement(
          agentData.overlayTopics[0] // Primary topic for SHIP
        );
        shipAdvertisementId = shipAd.utxoId;
        this.emit('ship-advertisement-created', { agentId, advertisement: shipAd });
      } catch (error) {
        console.warn('[AGENT-REGISTRY] Failed to create SHIP advertisement:', error);
      }
    }

    // Create SLAP advertisement for service discovery
    let slapAdvertisementId: string | undefined;
    try {
      const slapAd = await this.brc88Service.createSLAPAdvertisement(
        `agent-service-${agentId}`
      );
      slapAdvertisementId = slapAd.utxoId;
      this.emit('slap-advertisement-created', { agentId, advertisement: slapAd });
    } catch (error) {
      console.warn('[AGENT-REGISTRY] Failed to create SLAP advertisement:', error);
    }

    const agent: OverlayAgent = {
      agentId,
      name: agentData.name,
      capabilities: agentData.capabilities,
      overlayTopics: agentData.overlayTopics,
      shipAdvertisementId,
      slapAdvertisementId,
      geographicRegion: agentData.geographicRegion,
      reputationScore: 0.0,
      performanceStats: {
        totalJobs: 0,
        successfulJobs: 0,
        avgExecutionTime: 0,
        avgQualityScore: 0,
        successRate: 0
      },
      identityKey: agentData.identityKey,
      webhookUrl: agentData.webhookUrl,
      status: 'unknown',
      overlayNodeId: agentData.overlayNodeId,
      createdAt: now,
      updatedAt: now
    };

    await this.database.execute(`
      INSERT INTO overlay_agents
      (agent_id, name, capabilities_json, overlay_topics, ship_advertisement_id, slap_advertisement_id,
       geographic_region, identity_key, webhook_url, overlay_node_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      agent.agentId,
      agent.name,
      JSON.stringify(agent.capabilities),
      agent.overlayTopics,
      agent.shipAdvertisementId,
      agent.slapAdvertisementId,
      agent.geographicRegion,
      agent.identityKey,
      agent.webhookUrl,
      agent.overlayNodeId,
      new Date(agent.createdAt),
      new Date(agent.updatedAt)
    ]);

    this.emit('agent-registered', agent);
    return agent;
  }

  /**
   * Search agents by capability, region, reputation, etc.
   */
  async searchAgents(query: AgentSearchQuery): Promise<OverlayAgent[]> {
    let sql = `
      SELECT agent_id, name, capabilities_json, overlay_topics, ship_advertisement_id, slap_advertisement_id,
             geographic_region, reputation_score, performance_stats, identity_key, webhook_url, status,
             last_ping_at, overlay_node_id,
             EXTRACT(EPOCH FROM created_at) * 1000 as created_at,
             EXTRACT(EPOCH FROM updated_at) * 1000 as updated_at
      FROM overlay_agents
      WHERE status != 'down'
    `;
    const params: any[] = [];

    if (query.capability) {
      sql += ` AND capabilities_json::text ILIKE $${params.length + 1}`;
      params.push(`%${query.capability}%`);
    }

    if (query.region) {
      sql += ` AND geographic_region = $${params.length + 1}`;
      params.push(query.region);
    }

    if (query.minReputation !== undefined) {
      sql += ` AND reputation_score >= $${params.length + 1}`;
      params.push(query.minReputation);
    }

    if (query.overlayTopic) {
      sql += ` AND $${params.length + 1} = ANY(overlay_topics)`;
      params.push(query.overlayTopic);
    }

    if (query.maxExecutionTime !== undefined) {
      sql += ` AND (performance_stats->>'avgExecutionTime')::int <= $${params.length + 1}`;
      params.push(query.maxExecutionTime);
    }

    sql += ` ORDER BY reputation_score DESC, (performance_stats->>'successRate')::decimal DESC`;

    if (query.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(query.limit);
    }

    if (query.offset) {
      sql += ` OFFSET $${params.length + 1}`;
      params.push(query.offset);
    }

    const results = await this.database.query(sql, params);

    return results.map(row => this.mapRowToAgent(row));
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<OverlayAgent | null> {
    const results = await this.database.query(`
      SELECT agent_id, name, capabilities_json, overlay_topics, ship_advertisement_id, slap_advertisement_id,
             geographic_region, reputation_score, performance_stats, identity_key, webhook_url, status,
             last_ping_at, overlay_node_id,
             EXTRACT(EPOCH FROM created_at) * 1000 as created_at,
             EXTRACT(EPOCH FROM updated_at) * 1000 as updated_at
      FROM overlay_agents
      WHERE agent_id = $1
    `, [agentId]);

    if (results.length === 0) return null;
    return this.mapRowToAgent(results[0]);
  }

  /**
   * Update agent ping status
   */
  async updateAgentPing(agentId: string, isUp: boolean): Promise<void> {
    const status = isUp ? 'up' : 'down';
    const now = Date.now();

    await this.database.execute(`
      UPDATE overlay_agents
      SET status = $1, last_ping_at = $2, updated_at = $3
      WHERE agent_id = $4
    `, [status, Math.floor(now / 1000), new Date(now), agentId]);

    this.emit('agent-ping-updated', { agentId, status, timestamp: now });
  }

  /**
   * Update agent capabilities and re-advertise
   */
  async updateAgentCapabilities(
    agentId: string,
    capabilities: AgentCapability[],
    overlayTopics?: string[]
  ): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) throw new Error('Agent not found');

    const now = Date.now();

    // Update SHIP advertisement if topics changed
    let shipAdvertisementId = agent.shipAdvertisementId;
    if (overlayTopics && overlayTopics.length > 0 && overlayTopics[0] !== agent.overlayTopics[0]) {
      try {
        const shipAd = await this.brc88Service.createSHIPAdvertisement(overlayTopics[0]);
        shipAdvertisementId = shipAd.utxoId;
        this.emit('ship-advertisement-updated', { agentId, advertisement: shipAd });
      } catch (error) {
        console.warn('[AGENT-REGISTRY] Failed to update SHIP advertisement:', error);
      }
    }

    await this.database.execute(`
      UPDATE overlay_agents
      SET capabilities_json = $1, overlay_topics = $2, ship_advertisement_id = $3, updated_at = $4
      WHERE agent_id = $5
    `, [
      JSON.stringify(capabilities),
      overlayTopics || agent.overlayTopics,
      shipAdvertisementId,
      new Date(now),
      agentId
    ]);

    this.emit('agent-capabilities-updated', { agentId, capabilities, overlayTopics });
  }

  /**
   * Record agent performance
   */
  async recordAgentPerformance(
    agentId: string,
    jobId: string,
    performance: {
      executionTimeMs: number;
      success: boolean;
      qualityScore?: number;
      clientFeedback?: any;
      overlayConfirmation?: string;
    }
  ): Promise<void> {
    // Record individual performance
    await this.database.execute(`
      INSERT INTO agent_performance
      (agent_id, job_id, execution_time_ms, success, quality_score, client_feedback, overlay_confirmation)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      agentId,
      jobId,
      performance.executionTimeMs,
      performance.success,
      performance.qualityScore || null,
      performance.clientFeedback ? JSON.stringify(performance.clientFeedback) : null,
      performance.overlayConfirmation
    ]);

    // Update aggregate performance stats
    await this.updateAgentAggregateStats(agentId);

    this.emit('agent-performance-recorded', { agentId, jobId, performance });
  }

  /**
   * Update agent's aggregate performance statistics
   */
  private async updateAgentAggregateStats(agentId: string): Promise<void> {
    const statsResult = await this.database.queryOne(`
      SELECT
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE success = true) as successful_jobs,
        AVG(execution_time_ms) as avg_execution_time,
        AVG(quality_score) FILTER (WHERE quality_score IS NOT NULL) as avg_quality_score,
        MAX(recorded_at) as last_job_at
      FROM agent_performance
      WHERE agent_id = $1
    `, [agentId]);

    if (!statsResult) return;

    const performanceStats: AgentPerformanceStats = {
      totalJobs: parseInt(statsResult.total_jobs || '0'),
      successfulJobs: parseInt(statsResult.successful_jobs || '0'),
      avgExecutionTime: Math.round(parseFloat(statsResult.avg_execution_time || '0')),
      avgQualityScore: parseFloat(statsResult.avg_quality_score || '0'),
      successRate: parseFloat(statsResult.total_jobs) > 0
        ? parseFloat(statsResult.successful_jobs) / parseFloat(statsResult.total_jobs)
        : 0,
      lastJobAt: statsResult.last_job_at ? new Date(statsResult.last_job_at).getTime() : undefined
    };

    // Calculate reputation score based on performance
    const reputationScore = this.calculateReputationScore(performanceStats);

    await this.database.execute(`
      UPDATE overlay_agents
      SET performance_stats = $1, reputation_score = $2, updated_at = $3
      WHERE agent_id = $4
    `, [
      JSON.stringify(performanceStats),
      reputationScore,
      new Date(),
      agentId
    ]);

    this.emit('agent-stats-updated', { agentId, performanceStats, reputationScore });
  }

  /**
   * Calculate reputation score based on performance metrics
   */
  private calculateReputationScore(stats: AgentPerformanceStats): number {
    if (stats.totalJobs === 0) return 0.0;

    // Base score from success rate (0-40 points)
    const successScore = stats.successRate * 0.4;

    // Quality score bonus (0-30 points)
    const qualityScore = stats.avgQualityScore > 0 ? (stats.avgQualityScore * 0.3) : 0;

    // Execution time penalty/bonus (0-20 points)
    const avgTimeMs = stats.avgExecutionTime;
    let timeScore = 0.2;
    if (avgTimeMs > 0) {
      if (avgTimeMs < 2000) timeScore = 0.2; // Fast execution bonus
      else if (avgTimeMs < 5000) timeScore = 0.15;
      else if (avgTimeMs < 10000) timeScore = 0.1;
      else if (avgTimeMs < 30000) timeScore = 0.05;
      else timeScore = 0; // Slow execution penalty
    }

    // Volume bonus (0-10 points)
    const volumeScore = Math.min(stats.totalJobs / 100, 1) * 0.1;

    const totalScore = successScore + qualityScore + timeScore + volumeScore;
    return Math.round(Math.min(totalScore, 1.0) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get agents by geographic region
   */
  async getAgentsByRegion(region: string): Promise<OverlayAgent[]> {
    return this.searchAgents({ region });
  }

  /**
   * Get agents subscribed to specific overlay topic
   */
  async getAgentsByTopic(topic: string): Promise<OverlayAgent[]> {
    return this.searchAgents({ overlayTopic: topic });
  }

  /**
   * Get top-rated agents by capability
   */
  async getTopAgentsByCapability(capability: string, limit: number = 10): Promise<OverlayAgent[]> {
    return this.searchAgents({
      capability,
      minReputation: 0.5,
      limit
    });
  }

  /**
   * Get agent performance history
   */
  async getAgentPerformanceHistory(
    agentId: string,
    limit: number = 50
  ): Promise<Array<{
    jobId: string;
    executionTimeMs: number;
    success: boolean;
    qualityScore?: number;
    clientFeedback?: any;
    recordedAt: number;
  }>> {
    const results = await this.database.query(`
      SELECT job_id, execution_time_ms, success, quality_score, client_feedback,
             EXTRACT(EPOCH FROM recorded_at) * 1000 as recorded_at
      FROM agent_performance
      WHERE agent_id = $1
      ORDER BY recorded_at DESC
      LIMIT $2
    `, [agentId, limit]);

    return results.map(row => ({
      jobId: row.job_id,
      executionTimeMs: row.execution_time_ms,
      success: row.success,
      qualityScore: row.quality_score || undefined,
      clientFeedback: row.client_feedback ? JSON.parse(row.client_feedback) : undefined,
      recordedAt: parseInt(row.recorded_at)
    }));
  }

  /**
   * Remove agent and cleanup advertisements
   */
  async removeAgent(agentId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) return;

    // TODO: In production, also remove BRC-88 advertisements from overlay network

    await this.database.execute('DELETE FROM agent_performance WHERE agent_id = $1', [agentId]);
    await this.database.execute('DELETE FROM overlay_agents WHERE agent_id = $1', [agentId]);

    this.emit('agent-removed', { agentId });
  }

  /**
   * Get registry statistics
   */
  async getRegistryStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    agentsByRegion: Record<string, number>;
    agentsByCapability: Record<string, number>;
    avgReputationScore: number;
  }> {
    const [totalResult, activeResult, avgReputationResult] = await Promise.all([
      this.database.queryOne('SELECT COUNT(*) as count FROM overlay_agents'),
      this.database.queryOne('SELECT COUNT(*) as count FROM overlay_agents WHERE status = \'up\''),
      this.database.queryOne('SELECT AVG(reputation_score) as avg FROM overlay_agents WHERE reputation_score > 0')
    ]);

    const regionResults = await this.database.query(`
      SELECT geographic_region, COUNT(*) as count
      FROM overlay_agents
      WHERE geographic_region IS NOT NULL
      GROUP BY geographic_region
    `);

    const capabilityResults = await this.database.query(`
      SELECT
        jsonb_array_elements(capabilities_json::jsonb)->>'name' as capability,
        COUNT(*) as count
      FROM overlay_agents
      GROUP BY capability
    `);

    const agentsByRegion: Record<string, number> = {};
    regionResults.forEach(row => {
      agentsByRegion[row.geographic_region] = parseInt(row.count);
    });

    const agentsByCapability: Record<string, number> = {};
    capabilityResults.forEach(row => {
      agentsByCapability[row.capability] = parseInt(row.count);
    });

    return {
      totalAgents: parseInt(totalResult?.count || '0'),
      activeAgents: parseInt(activeResult?.count || '0'),
      agentsByRegion,
      agentsByCapability,
      avgReputationScore: parseFloat(avgReputationResult?.avg || '0')
    };
  }

  private generateAgentId(): string {
    return 'agent_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  private mapRowToAgent(row: any): OverlayAgent {
    return {
      agentId: row.agent_id,
      name: row.name,
      capabilities: JSON.parse(row.capabilities_json || '[]'),
      overlayTopics: row.overlay_topics || [],
      shipAdvertisementId: row.ship_advertisement_id,
      slapAdvertisementId: row.slap_advertisement_id,
      geographicRegion: row.geographic_region,
      reputationScore: parseFloat(row.reputation_score || '0'),
      performanceStats: typeof row.performance_stats === 'string'
        ? JSON.parse(row.performance_stats)
        : row.performance_stats || {
            totalJobs: 0,
            successfulJobs: 0,
            avgExecutionTime: 0,
            avgQualityScore: 0,
            successRate: 0
          },
      identityKey: row.identity_key,
      webhookUrl: row.webhook_url,
      status: row.status || 'unknown',
      lastPingAt: row.last_ping_at ? parseInt(row.last_ping_at) * 1000 : undefined,
      overlayNodeId: row.overlay_node_id,
      createdAt: parseInt(row.created_at),
      updatedAt: parseInt(row.updated_at)
    };
  }
}