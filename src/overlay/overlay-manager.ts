// BSV Overlay Manager
// Manages overlay integration with the existing gitdata system

import { EventEmitter } from 'events';

import type { D01AData } from './bsv-overlay-service';
import type { DatabaseAdapter } from './brc26-uhrp';
import { BSVOverlayService, OverlayMessage } from './bsv-overlay-service';
import {
  getOverlayConfig,
  D01A_TOPICS,
  TopicGenerator,
  TopicSubscriptionManager,
} from './overlay-config';

export interface OverlayManagerConfig {
  environment: 'development' | 'staging' | 'production';
  database: DatabaseAdapter;
  autoConnect: boolean;
  enablePaymentIntegration: boolean;
  enableSearchIntegration: boolean;
}

export interface OverlayDataEvent {
  topic: string;
  data: any;
  sender: string;
  timestamp: number;
  messageId: string;
}

class OverlayManager extends EventEmitter {
  private overlayService: BSVOverlayService;
  private subscriptionManager: TopicSubscriptionManager;
  private config: OverlayManagerConfig;
  private database: DatabaseAdapter;
  private isInitialized: boolean = false;

  constructor(config: OverlayManagerConfig) {
    super();
    this.config = config;
    this.database = config.database;
    this.subscriptionManager = new TopicSubscriptionManager();

    // Initialize overlay service with environment-specific config
    const overlayConfig = getOverlayConfig(config.environment);
    this.overlayService = new BSVOverlayService(overlayConfig);

    this.setupOverlayEventHandlers();
    this.setupDatabaseTables();
  }

  /**
   * Initialize overlay manager
   */
  async initialize(): Promise<void> {
    try {
      if (this.config.autoConnect) {
        await this.overlayService.initialize();
        await this.setupDefaultSubscriptions();
        this.isInitialized = true;
        this.emit('initialized');
        console.log('Overlay manager initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize overlay manager:', error);
      throw error;
    }
  }

  /**
   * Set up database tables for overlay data
   */
  private setupDatabaseTables(): void {
    // Database tables are now created in the main schema at /src/db/postgresql-schema-complete.sql
    // Overlay management tables: overlay_messages, overlay_subscriptions, overlay_peers
    console.log('Overlay management database tables managed by central schema');
  }

  /**
   * Set up overlay service event handlers
   */
  private setupOverlayEventHandlers(): void {
    // Handle incoming data
    this.overlayService.on('data-received', (event: OverlayDataEvent) => {
      this.handleIncomingData(event);
    });

    // Handle data publish events
    this.overlayService.on('data-published', (event: OverlayDataEvent) => {
      this.handleDataPublished(event);
    });

    // Handle data requests
    this.overlayService.on('data-request', (event: OverlayDataEvent) => {
      this.handleDataRequest(event);
    });

    // Handle peer connections
    this.overlayService.on('peer-connected', (peerId: string) => {
      this.handlePeerConnected(peerId);
    });

    // Handle peer disconnections
    this.overlayService.on('peer-disconnected', (peerId: string) => {
      this.handlePeerDisconnected(peerId);
    });

    // Handle errors
    this.overlayService.on('error', (error: Error) => {
      console.error('Overlay service error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Set up default topic subscriptions based on environment
   */
  private async setupDefaultSubscriptions(): Promise<void> {
    const overlayConfig = getOverlayConfig(this.config.environment);

    for (const topic of overlayConfig.topics) {
      try {
        await this.subscribeToTopic(topic, true);
      } catch (error) {
        console.warn(`Failed to subscribe to default topic ${topic}:`, error);
      }
    }
  }

  /**
   * Subscribe to a topic
   */
  async subscribeToTopic(topic: string, autoSubscribe: boolean = false): Promise<void> {
    try {
      await this.overlayService.subscribeToTopic(topic);

      // Record subscription in database
      await this.database.execute(
        `
        INSERT INTO overlay_subscriptions
        (topic, classification, subscribed_at, last_activity, auto_subscribe)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (topic) DO UPDATE SET
          classification = EXCLUDED.classification,
          subscribed_at = EXCLUDED.subscribed_at,
          last_activity = EXCLUDED.last_activity,
          auto_subscribe = EXCLUDED.auto_subscribe
      `,
        [
          topic,
          'public', // TODO: Determine classification from topic
          Date.now(),
          Date.now(),
          autoSubscribe,
        ]
      );

      this.subscriptionManager.addSubscription(topic);
      this.emit('subscribed', topic);
    } catch (error) {
      throw new Error(`Failed to subscribe to topic ${topic}: ${(error as Error).message}`);
    }
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribeFromTopic(topic: string): Promise<void> {
    try {
      await this.overlayService.unsubscribeFromTopic(topic);

      // Remove subscription from database
      await this.database.execute(`DELETE FROM overlay_subscriptions WHERE topic = $1`, [topic]);

      this.subscriptionManager.removeSubscription(topic);
      this.emit('unsubscribed', topic);
    } catch (error) {
      throw new Error(`Failed to unsubscribe from topic ${topic}: ${(error as Error).message}`);
    }
  }

  /**
   * Publish D01A asset to overlay network
   */
  async publishAsset(asset: any): Promise<string> {
    const d01aData: D01AData = { asset };
    const topic = TopicGenerator.datasetTopic(
      asset.datasetId,
      asset.policy?.classification || 'public',
    );

    try {
      const messageId = await this.overlayService.publishD01AData(topic, d01aData);

      // Store publication record
      await this.database.execute(
        `
        INSERT INTO overlay_messages
        (message_id, topic, message_type, data_json, received_at, processed)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [messageId, topic, 'publish', JSON.stringify(d01aData), Date.now(), true]
      );

      this.emit('asset-published', { topic, asset, messageId });
      return messageId;
    } catch (error) {
      throw new Error(`Failed to publish asset: ${(error as Error).message}`);
    }
  }

  /**
   * @deprecated Use publishAsset instead
   * Backward compatibility method for publishManifest
   */
  async publishManifest(manifest: any): Promise<string> {
    return this.publishAsset(manifest);
  }

  /**
   * Search for data on overlay network
   */
  async searchData(query: {
    datasetId?: string;
    classification?: string;
    tags?: string[];
    mediaType?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      // Send search request to appropriate topics
      const searchTopics: string[] = [D01A_TOPICS.SEARCH_QUERIES];

      if (query.classification) {
        searchTopics.push(TopicGenerator.datasetTopic('*', query.classification));
      }

      const searchPromises = searchTopics.map((topic) =>
        this.overlayService.requestData(topic as any, {
          type: 'search',
          query,
          timestamp: Date.now(),
        }),
      );

      await Promise.all(searchPromises);

      // Return cached results (overlay responses will be handled by event handlers)
      // In a real implementation, you'd wait for responses or use a callback pattern
      return await this.getCachedSearchResults(query);
    } catch (error) {
      throw new Error(`Failed to search overlay data: ${(error as Error).message}`);
    }
  }

  /**
   * Handle incoming overlay data
   */
  private async handleIncomingData(event: OverlayDataEvent): Promise<void> {
    try {
      // Store message in database
      const messageId = this.generateMessageId(event);
      await this.database.execute(
        `
        INSERT INTO overlay_messages
        (message_id, topic, message_type, sender, data_json, received_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (message_id) DO UPDATE SET
          topic = EXCLUDED.topic,
          message_type = EXCLUDED.message_type,
          sender = EXCLUDED.sender,
          data_json = EXCLUDED.data_json,
          received_at = EXCLUDED.received_at
      `,
        [
          messageId,
          event.topic,
          'data',
          event.sender,
          JSON.stringify(event.data),
          event.timestamp,
        ]
      );

      // Update subscription activity
      this.subscriptionManager.updateActivity(event.topic);

      // Process data based on topic
      this.processTopicData(event.topic, event.data, event.sender);

      this.emit('data-received', event);
    } catch (error) {
      console.error('Failed to handle incoming overlay data:', error);
    }
  }

  /**
   * Handle data published events
   */
  private handleDataPublished(event: OverlayDataEvent): void {
    console.log(`Data published to topic ${event.topic}:`, event.data);
    this.emit('data-published', event);
  }

  /**
   * Handle data request events
   */
  private async handleDataRequest(event: OverlayDataEvent): Promise<void> {
    try {
      // Process search requests
      if (event.data.type === 'search') {
        await this.handleSearchRequest(event);
      }

      this.emit('data-request', event);
    } catch (error) {
      console.error('Failed to handle data request:', error);
    }
  }

  /**
   * Handle search requests from other nodes
   */
  private async handleSearchRequest(event: OverlayDataEvent): Promise<void> {
    try {
      const query = event.data.query;
      const results = await this.searchLocalData(query);

      if (results.length > 0) {
        // Send response back to requester
        this.overlayService.sendData(
          D01A_TOPICS.SEARCH_RESULTS,
          {
            type: 'search_response',
            originalQuery: query,
            results,
            timestamp: Date.now(),
          },
          event.sender,
        );
      }
    } catch (error) {
      console.error('Failed to handle search request:', error);
    }
  }

  /**
   * Search local database for matching data
   */
  private async searchLocalData(query: any): Promise<any[]> {
    try {
      let sql = `
        SELECT m.*, v.version_id, v.content_hash
        FROM assets m
        JOIN versions v ON m.version_id = v.version_id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (query.datasetId) {
        sql += ` AND m.dataset_id = $${paramIndex}`;
        params.push(query.datasetId);
        paramIndex++;
      }

      if (query.classification) {
        sql += ` AND m.classification = $${paramIndex}`;
        params.push(query.classification);
        paramIndex++;
      }

      if (query.mediaType) {
        sql += ` AND m.media_type = $${paramIndex}`;
        params.push(query.mediaType);
        paramIndex++;
      }

      if (query.limit) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(query.limit);
      }

      return await this.database.query(sql, params);
    } catch (error) {
      console.error('Failed to search local data:', error);
      return [];
    }
  }

  /**
   * Process data based on topic type
   */
  private processTopicData(topic: string, data: any, sender: string): void {
    if (topic.includes('.asset') || topic.includes('.manifest')) {
      this.processAssetData(data, sender);
    } else if (topic.includes('.search.results')) {
      this.processSearchResults(data, sender);
    } else if (topic.includes('.agent.')) {
      this.processAgentData(data, sender);
    } else if (topic.includes('.payment.')) {
      this.processPaymentData(data, sender);
    }
  }

  /**
   * Process incoming asset data
   */
  private processAssetData(data: any, sender: string): void {
    try {
      if (data.asset || data.manifest) {
        const asset = data.asset || data.manifest; // Support both for backward compatibility
        // Store asset in local database for discovery
        console.log('Received asset from overlay:', asset.datasetId);
        this.emit('asset-received', { asset, sender });
      }
    } catch (error) {
      console.error('Failed to process asset data:', error);
    }
  }

  /**
   * Process search results
   */
  private processSearchResults(data: any, sender: string): void {
    try {
      if (data.type === 'search_response' && data.results) {
        console.log(`Received ${data.results.length} search results from ${sender}`);
        this.emit('search-results', { results: data.results, sender, query: data.originalQuery });
      }
    } catch (error) {
      console.error('Failed to process search results:', error);
    }
  }

  /**
   * Process agent-related data
   */
  private processAgentData(data: any, sender: string): void {
    try {
      console.log('Received agent data from overlay:', data);
      this.emit('agent-data', { data, sender });
    } catch (error) {
      console.error('Failed to process agent data:', error);
    }
  }

  /**
   * Process payment-related data
   */
  private processPaymentData(data: any, sender: string): void {
    try {
      if (this.config.enablePaymentIntegration) {
        console.log('Received payment data from overlay:', data);
        this.emit('payment-data', { data, sender });
      }
    } catch (error) {
      console.error('Failed to process payment data:', error);
    }
  }

  /**
   * Handle peer connected
   */
  private async handlePeerConnected(peerId: string): Promise<void> {
    await this.database.execute(
      `
      INSERT INTO overlay_peers
      (peer_id, connected_at, last_seen, message_count)
      VALUES ($1, $2, $3, 0)
      ON CONFLICT (peer_id) DO UPDATE SET
        connected_at = EXCLUDED.connected_at,
        last_seen = EXCLUDED.last_seen,
        message_count = EXCLUDED.message_count
    `,
      [peerId, Date.now(), Date.now()]
    );

    this.emit('peer-connected', peerId);
  }

  /**
   * Handle peer disconnected
   */
  private async handlePeerDisconnected(peerId: string): Promise<void> {
    await this.database.execute(
      `
      UPDATE overlay_peers SET last_seen = $1 WHERE peer_id = $2
    `,
      [Date.now(), peerId]
    );

    this.emit('peer-disconnected', peerId);
  }

  /**
   * Get cached search results
   */
  private async getCachedSearchResults(query: any): Promise<any[]> {
    try {
      // Return recent search results from database
      const results = await this.database.query(
        `
        SELECT data_json FROM overlay_messages
        WHERE topic = $1 AND message_type = 'data'
        AND received_at > $2
        ORDER BY received_at DESC
        LIMIT 50
      `,
        [D01A_TOPICS.SEARCH_RESULTS, Date.now() - 300000] // Last 5 minutes
      );

      return results
        .map((row) => JSON.parse(row.data_json))
        .filter((data) => data.type === 'search_response');
    } catch (error) {
      console.error('Failed to get cached search results:', error);
      return [];
    }
  }

  /**
   * Generate message ID
   */
  private generateMessageId(event: OverlayDataEvent): string {
    return `${event.topic}-${event.timestamp}-${event.sender}`.substring(0, 32);
  }

  /**
   * Get overlay statistics
   */
  async getStats(): Promise<{
    overlay: any;
    subscriptions: any;
    messages: { total: number; recent: number };
    peers: { total: number; active: number };
  }> {
    const overlayStats = this.overlayService.getStats();
    const subscriptionStats = this.subscriptionManager.getStats();

    const totalMessagesResult = await this.database.queryOne(
      `
      SELECT COUNT(*) as count FROM overlay_messages
    `
    );
    const totalMessages = totalMessagesResult?.count || 0;

    const recentMessagesResult = await this.database.queryOne(
      `
      SELECT COUNT(*) as count FROM overlay_messages
      WHERE received_at > $1
    `,
      [Date.now() - 3600000] // Last hour
    );
    const recentMessages = recentMessagesResult?.count || 0;

    const totalPeersResult = await this.database.queryOne(
      `
      SELECT COUNT(*) as count FROM overlay_peers
    `
    );
    const totalPeers = totalPeersResult?.count || 0;

    const activePeersResult = await this.database.queryOne(
      `
      SELECT COUNT(*) as count FROM overlay_peers
      WHERE last_seen > $1
    `,
      [Date.now() - 300000] // Last 5 minutes
    );
    const activePeers = activePeersResult?.count || 0;

    return {
      overlay: overlayStats,
      subscriptions: subscriptionStats,
      messages: { total: totalMessages, recent: recentMessages },
      peers: { total: totalPeers, active: activePeers },
    };
  }

  /**
   * Check if overlay is connected
   */
  isConnected(): boolean {
    return this.overlayService.isOverlayConnected();
  }

  /**
   * Disconnect from overlay
   */
  async disconnect(): Promise<void> {
    await this.overlayService.disconnect();
    this.isInitialized = false;
    this.emit('disconnected');
  }

  /**
   * Reconnect to overlay
   */
  async reconnect(): Promise<void> {
    await this.overlayService.reconnect();
    await this.setupDefaultSubscriptions();
    this.isInitialized = true;
    this.emit('reconnected');
  }
}

export { OverlayManager };
