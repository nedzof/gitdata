/**
 * Producer Database Models
 *
 * Complete PostgreSQL database models and operations for producer functionality.
 * Implements all tables from the D15 specification with TypeScript interfaces
 * and database operations.
 *
 * Tables:
 * - producer_identities: Identity and profile management
 * - producer_advertisements: BRC-88 service advertisements
 * - published_content: BRC-26 content records
 * - producer_streams: Live streaming services
 * - producer_consumers: Consumer relationship management
 * - producer_revenue: Payment and revenue tracking
 * - producer_analytics: BRC-64 analytics events
 * - content_distribution: D22 multi-node distribution
 */

import { Pool } from 'pg';

interface ProducerIdentity {
  producerId: string;
  identityKey: string;
  displayName: string;
  description?: string;
  contactInfo: any;
  capabilities: string[];
  geographicRegions: string[];
  reputationScore: number;
  totalRevenueSatoshis: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ProducerAdvertisement {
  advertisementId: string;
  producerId: string;
  serviceType: string;
  capability: string;
  shipAdvertisementData: any;
  slapAdvertisementData?: any;
  pricingModel: string;
  baseRateSatoshis: number;
  geographicScope: string[];
  availabilitySla: number;
  maxConsumers: number;
  status: string;
  createdAt: Date;
  expiresAt?: Date;
}

interface PublishedContent {
  contentId: string;
  producerId: string;
  uhrpHash: string;
  title: string;
  description?: string;
  contentType: string;
  fileSizeBytes: number;
  tags: string[];
  pricing: any;
  licenseType: string;
  brc22TransactionId?: string;
  distributionNodes: string[];
  downloadCount: number;
  totalRevenueSatoshis: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ProducerStream {
  streamId: string;
  producerId: string;
  title: string;
  description?: string;
  streamFormat: string;
  updateFrequencyMs: number;
  pricePerMinuteSatoshis: number;
  maxConsumers: number;
  currentConsumers: number;
  streamStatus: string;
  qualitySettings: any;
  historicalBufferHours: number;
  totalStreamingHours: number;
  totalRevenueSatoshis: number;
  createdAt: Date;
  lastUpdated: Date;
}

interface ProducerConsumer {
  relationshipId: string;
  producerId: string;
  consumerId: string;
  firstInteractionAt: Date;
  lastInteractionAt: Date;
  totalPaymentsSatoshis: number;
  totalDataTransferredBytes: number;
  relationshipStatus: string;
  consumerTier: string;
  notes?: string;
}

interface ProducerRevenue {
  revenueId: string;
  producerId: string;
  consumerId?: string;
  contentId?: string;
  streamId?: string;
  paymentMethod: string;
  amountSatoshis: number;
  brc22TransactionId?: string;
  d21TemplateId?: string;
  paymentStatus: string;
  revenueSplits?: any;
  createdAt: Date;
  confirmedAt?: Date;
}

interface ProducerAnalytics {
  eventId: string;
  producerId: string;
  eventType: string;
  resourceId?: string;
  consumerId?: string;
  eventData: any;
  revenueGenerated: number;
  brc64LineageData?: any;
  recordedAt: Date;
}

interface ContentDistribution {
  distributionId: string;
  contentId: string;
  overlayNodeId: string;
  distributionStatus: string;
  replicationFactor: number;
  lastSyncAt?: Date;
  nodeResponseTimeMs?: number;
  availabilityScore: number;
  createdAt: Date;
}

export class ProducerDatabase {
  private pool: Pool;
  private databaseUrl: string;

  constructor(databaseUrl: string) {
    this.databaseUrl = databaseUrl;
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Initialize database with all producer tables
   */
  async initialize(): Promise<void> {
    try {
      console.log('[DATABASE] Initializing producer database schema...');

      await this.createTables();
      await this.createIndexes();

      console.log('[DATABASE] ✅ Producer database initialized');
    } catch (error) {
      console.error('[DATABASE] ❌ Database initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Store producer identity
   */
  async storeProducerIdentity(identity: ProducerIdentity): Promise<void> {
    const query = `
      INSERT INTO producer_identities (
        producer_id, identity_key, display_name, description, contact_info,
        capabilities, geographic_regions, reputation_score, total_revenue_satoshis,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (producer_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        contact_info = EXCLUDED.contact_info,
        capabilities = EXCLUDED.capabilities,
        geographic_regions = EXCLUDED.geographic_regions,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(query, [
      identity.producerId,
      identity.identityKey,
      identity.displayName,
      identity.description,
      JSON.stringify(identity.contactInfo),
      identity.capabilities,
      identity.geographicRegions,
      identity.reputationScore,
      identity.totalRevenueSatoshis,
      identity.createdAt,
      identity.updatedAt
    ]);
  }

  /**
   * Get producer profile
   */
  async getProducerProfile(): Promise<ProducerIdentity | null> {
    const query = 'SELECT * FROM producer_identities ORDER BY created_at DESC LIMIT 1';
    const result = await this.pool.query(query);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      producerId: row.producer_id,
      identityKey: row.identity_key,
      displayName: row.display_name,
      description: row.description,
      contactInfo: JSON.parse(row.contact_info || '{}'),
      capabilities: row.capabilities,
      geographicRegions: row.geographic_regions,
      reputationScore: parseFloat(row.reputation_score),
      totalRevenueSatoshis: parseInt(row.total_revenue_satoshis),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Store advertisement
   */
  async storeAdvertisement(advertisement: ProducerAdvertisement): Promise<void> {
    const query = `
      INSERT INTO producer_advertisements (
        advertisement_id, producer_id, service_type, capability,
        ship_advertisement_data, slap_advertisement_data, pricing_model,
        base_rate_satoshis, geographic_scope, availability_sla,
        max_consumers, status, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;

    await this.pool.query(query, [
      advertisement.advertisementId,
      advertisement.producerId,
      advertisement.serviceType,
      advertisement.capability,
      JSON.stringify(advertisement.shipAdvertisementData),
      JSON.stringify(advertisement.slapAdvertisementData),
      advertisement.pricingModel,
      advertisement.baseRateSatoshis,
      advertisement.geographicScope,
      advertisement.availabilitySla,
      advertisement.maxConsumers,
      advertisement.status,
      advertisement.createdAt,
      advertisement.expiresAt
    ]);
  }

  /**
   * Get active advertisements
   */
  async getActiveAdvertisements(producerId: string): Promise<ProducerAdvertisement[]> {
    const query = `
      SELECT * FROM producer_advertisements
      WHERE producer_id = $1 AND status = 'active'
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [producerId]);

    return result.rows.map(row => ({
      advertisementId: row.advertisement_id,
      producerId: row.producer_id,
      serviceType: row.service_type,
      capability: row.capability,
      shipAdvertisementData: JSON.parse(row.ship_advertisement_data),
      slapAdvertisementData: JSON.parse(row.slap_advertisement_data || '{}'),
      pricingModel: row.pricing_model,
      baseRateSatoshis: row.base_rate_satoshis,
      geographicScope: row.geographic_scope,
      availabilitySla: row.availability_sla,
      maxConsumers: row.max_consumers,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    }));
  }

  /**
   * Store published content
   */
  async storePublishedContent(content: PublishedContent): Promise<void> {
    const query = `
      INSERT INTO published_content (
        content_id, producer_id, uhrp_hash, title, description,
        content_type, file_size_bytes, tags, pricing, license_type,
        brc22_transaction_id, distribution_nodes, download_count,
        total_revenue_satoshis, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `;

    await this.pool.query(query, [
      content.contentId,
      content.producerId,
      content.uhrpHash,
      content.title,
      content.description,
      content.contentType,
      content.fileSizeBytes,
      content.tags,
      JSON.stringify(content.pricing),
      content.licenseType,
      content.brc22TransactionId,
      content.distributionNodes,
      content.downloadCount,
      content.totalRevenueSatoshis,
      content.createdAt,
      content.updatedAt
    ]);
  }

  /**
   * Store distribution record
   */
  async storeDistributionRecord(distribution: ContentDistribution): Promise<void> {
    const query = `
      INSERT INTO content_distribution (
        distribution_id, content_id, overlay_node_id, distribution_status,
        replication_factor, node_response_time_ms, availability_score, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await this.pool.query(query, [
      distribution.distributionId,
      distribution.contentId,
      distribution.overlayNodeId,
      distribution.distributionStatus,
      distribution.replicationFactor,
      distribution.nodeResponseTimeMs,
      distribution.availabilityScore,
      distribution.createdAt
    ]);
  }

  /**
   * Get consumer relationships
   */
  async getConsumerRelationships(): Promise<ProducerConsumer[]> {
    const query = `
      SELECT * FROM producer_consumers
      WHERE relationship_status = 'active'
      ORDER BY total_payments_satoshis DESC
    `;

    const result = await this.pool.query(query);

    return result.rows.map(row => ({
      relationshipId: row.relationship_id,
      producerId: row.producer_id,
      consumerId: row.consumer_id,
      firstInteractionAt: row.first_interaction_at,
      lastInteractionAt: row.last_interaction_at,
      totalPaymentsSatoshis: parseInt(row.total_payments_satoshis),
      totalDataTransferredBytes: parseInt(row.total_data_transferred_bytes),
      relationshipStatus: row.relationship_status,
      consumerTier: row.consumer_tier,
      notes: row.notes
    }));
  }

  /**
   * Track analytics event
   */
  async trackAnalyticsEvent(event: ProducerAnalytics): Promise<void> {
    const query = `
      INSERT INTO producer_analytics (
        event_id, producer_id, event_type, resource_id, consumer_id,
        event_data, revenue_generated, brc64_lineage_data, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await this.pool.query(query, [
      event.eventId,
      event.producerId,
      event.eventType,
      event.resourceId,
      event.consumerId,
      JSON.stringify(event.eventData),
      event.revenueGenerated,
      JSON.stringify(event.brc64LineageData),
      event.recordedAt
    ]);
  }

  /**
   * Create all database tables
   */
  private async createTables(): Promise<void> {
    const tables = [
      this.createProducerIdentitiesTable(),
      this.createProducerAdvertisementsTable(),
      this.createPublishedContentTable(),
      this.createProducerStreamsTable(),
      this.createProducerConsumersTable(),
      this.createProducerRevenueTable(),
      this.createProducerAnalyticsTable(),
      this.createContentDistributionTable()
    ];

    for (const tableQuery of tables) {
      await this.pool.query(tableQuery);
    }
  }

  /**
   * Create database indexes for performance
   */
  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_producer_advertisements_producer ON producer_advertisements(producer_id, status);',
      'CREATE INDEX IF NOT EXISTS idx_published_content_producer ON published_content(producer_id, created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_published_content_tags ON published_content USING GIN(tags);',
      'CREATE INDEX IF NOT EXISTS idx_producer_streams_producer_status ON producer_streams(producer_id, stream_status);',
      'CREATE INDEX IF NOT EXISTS idx_producer_revenue_producer_date ON producer_revenue(producer_id, created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_producer_analytics_producer_type ON producer_analytics(producer_id, event_type, recorded_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_content_distribution_content ON content_distribution(content_id, distribution_status);'
    ];

    for (const indexQuery of indexes) {
      await this.pool.query(indexQuery);
    }
  }

  // Table creation methods
  private createProducerIdentitiesTable(): string {
    return `
      CREATE TABLE IF NOT EXISTS producer_identities (
        producer_id TEXT PRIMARY KEY,
        identity_key TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        description TEXT,
        contact_info JSONB DEFAULT '{}',
        capabilities TEXT[] NOT NULL,
        geographic_regions TEXT[] DEFAULT '[]',
        reputation_score DECIMAL(3,2) DEFAULT 0.0,
        total_revenue_satoshis BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
  }

  private createProducerAdvertisementsTable(): string {
    return `
      CREATE TABLE IF NOT EXISTS producer_advertisements (
        advertisement_id TEXT PRIMARY KEY,
        producer_id TEXT NOT NULL,
        service_type TEXT NOT NULL,
        capability TEXT NOT NULL,
        ship_advertisement_data JSONB NOT NULL,
        slap_advertisement_data JSONB,
        pricing_model TEXT NOT NULL,
        base_rate_satoshis INTEGER NOT NULL,
        geographic_scope TEXT[] DEFAULT '["global"]',
        availability_sla DECIMAL(4,2) DEFAULT 99.0,
        max_consumers INTEGER DEFAULT 1000,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        FOREIGN KEY (producer_id) REFERENCES producer_identities(producer_id)
      );
    `;
  }

  private createPublishedContentTable(): string {
    return `
      CREATE TABLE IF NOT EXISTS published_content (
        content_id TEXT PRIMARY KEY,
        producer_id TEXT NOT NULL,
        uhrp_hash TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        content_type TEXT NOT NULL,
        file_size_bytes BIGINT,
        tags TEXT[] DEFAULT '[]',
        pricing JSONB NOT NULL,
        license_type TEXT DEFAULT 'commercial',
        brc22_transaction_id TEXT,
        distribution_nodes TEXT[] DEFAULT '[]',
        download_count INTEGER DEFAULT 0,
        total_revenue_satoshis BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producer_id) REFERENCES producer_identities(producer_id)
      );
    `;
  }

  private createProducerStreamsTable(): string {
    return `
      CREATE TABLE IF NOT EXISTS producer_streams (
        stream_id TEXT PRIMARY KEY,
        producer_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        stream_format TEXT NOT NULL,
        update_frequency_ms INTEGER NOT NULL,
        price_per_minute_satoshis INTEGER NOT NULL,
        max_consumers INTEGER DEFAULT 100,
        current_consumers INTEGER DEFAULT 0,
        stream_status TEXT DEFAULT 'stopped',
        quality_settings JSONB DEFAULT '{}',
        historical_buffer_hours INTEGER DEFAULT 0,
        total_streaming_hours DECIMAL(10,2) DEFAULT 0,
        total_revenue_satoshis BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producer_id) REFERENCES producer_identities(producer_id)
      );
    `;
  }

  private createProducerConsumersTable(): string {
    return `
      CREATE TABLE IF NOT EXISTS producer_consumers (
        relationship_id TEXT PRIMARY KEY,
        producer_id TEXT NOT NULL,
        consumer_id TEXT NOT NULL,
        first_interaction_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_interaction_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_payments_satoshis BIGINT DEFAULT 0,
        total_data_transferred_bytes BIGINT DEFAULT 0,
        relationship_status TEXT DEFAULT 'active',
        consumer_tier TEXT DEFAULT 'standard',
        notes TEXT,
        FOREIGN KEY (producer_id) REFERENCES producer_identities(producer_id)
      );
    `;
  }

  private createProducerRevenueTable(): string {
    return `
      CREATE TABLE IF NOT EXISTS producer_revenue (
        revenue_id TEXT PRIMARY KEY,
        producer_id TEXT NOT NULL,
        consumer_id TEXT,
        content_id TEXT,
        stream_id TEXT,
        payment_method TEXT NOT NULL,
        amount_satoshis INTEGER NOT NULL,
        brc22_transaction_id TEXT,
        d21_template_id TEXT,
        payment_status TEXT DEFAULT 'pending',
        revenue_splits JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP,
        FOREIGN KEY (producer_id) REFERENCES producer_identities(producer_id)
      );
    `;
  }

  private createProducerAnalyticsTable(): string {
    return `
      CREATE TABLE IF NOT EXISTS producer_analytics (
        event_id TEXT PRIMARY KEY,
        producer_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        resource_id TEXT,
        consumer_id TEXT,
        event_data JSONB NOT NULL,
        revenue_generated INTEGER DEFAULT 0,
        brc64_lineage_data JSONB,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producer_id) REFERENCES producer_identities(producer_id)
      );
    `;
  }

  private createContentDistributionTable(): string {
    return `
      CREATE TABLE IF NOT EXISTS content_distribution (
        distribution_id TEXT PRIMARY KEY,
        content_id TEXT NOT NULL,
        overlay_node_id TEXT NOT NULL,
        distribution_status TEXT DEFAULT 'pending',
        replication_factor INTEGER DEFAULT 1,
        last_sync_at TIMESTAMP,
        node_response_time_ms INTEGER,
        availability_score DECIMAL(4,2) DEFAULT 100.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (content_id) REFERENCES published_content(content_id)
      );
    `;
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Get database health status
   */
  async healthCheck(): Promise<any> {
    try {
      const result = await this.pool.query('SELECT NOW() as current_time');
      return {
        status: 'healthy',
        connection: 'active',
        currentTime: result.rows[0].current_time
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

export {
  ProducerIdentity,
  ProducerAdvertisement,
  PublishedContent,
  ProducerStream,
  ProducerConsumer,
  ProducerRevenue,
  ProducerAnalytics,
  ContentDistribution
};