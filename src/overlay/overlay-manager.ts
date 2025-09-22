// BSV Overlay Manager
// Manages overlay integration with the existing gitdata system

import { BSVOverlayService, D01AData, OverlayMessage } from './bsv-overlay-service';
import { getOverlayConfig, D01A_TOPICS, TopicGenerator, TopicSubscriptionManager } from './overlay-config';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';

export interface OverlayManagerConfig {
  environment: 'development' | 'staging' | 'production';
  database: Database.Database;
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
  private database: Database.Database;
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
    // Table for tracking overlay messages
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS overlay_messages (
        message_id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        message_type TEXT NOT NULL,
        sender TEXT,
        data_json TEXT NOT NULL,
        signature TEXT,
        public_key TEXT,
        received_at INTEGER NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Table for tracking overlay subscriptions
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS overlay_subscriptions (
        topic TEXT PRIMARY KEY,
        classification TEXT NOT NULL,
        subscribed_at INTEGER NOT NULL,
        last_activity INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0,
        auto_subscribe BOOLEAN DEFAULT FALSE,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Table for overlay peer information
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS overlay_peers (
        peer_id TEXT PRIMARY KEY,
        connected_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0,
        topics_json TEXT,
        metadata_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Indexes for performance
    this.database.exec(`
      CREATE INDEX IF NOT EXISTS idx_overlay_messages_topic ON overlay_messages(topic);
      CREATE INDEX IF NOT EXISTS idx_overlay_messages_received_at ON overlay_messages(received_at);
      CREATE INDEX IF NOT EXISTS idx_overlay_messages_processed ON overlay_messages(processed);
      CREATE INDEX IF NOT EXISTS idx_overlay_subscriptions_classification ON overlay_subscriptions(classification);
    `);
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
      this.database.prepare(`
        INSERT OR REPLACE INTO overlay_subscriptions
        (topic, classification, subscribed_at, last_activity, auto_subscribe)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        topic,
        'public', // TODO: Determine classification from topic
        Date.now(),
        Date.now(),
        autoSubscribe
      );

      this.subscriptionManager.addSubscription(topic);
      this.emit('subscribed', topic);

    } catch (error) {
      throw new Error(`Failed to subscribe to topic ${topic}: ${error.message}`);
    }
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribeFromTopic(topic: string): Promise<void> {
    try {
      await this.overlayService.unsubscribeFromTopic(topic);

      // Remove subscription from database
      this.database.prepare(`DELETE FROM overlay_subscriptions WHERE topic = ?`).run(topic);

      this.subscriptionManager.removeSubscription(topic);
      this.emit('unsubscribed', topic);

    } catch (error) {
      throw new Error(`Failed to unsubscribe from topic ${topic}: ${error.message}`);
    }
  }

  /**
   * Publish D01A manifest to overlay network
   */
  async publishManifest(manifest: any): Promise<string> {
    const d01aData: D01AData = { manifest };
    const topic = TopicGenerator.datasetTopic(manifest.datasetId, manifest.policy?.classification || 'public');

    try {
      const messageId = await this.overlayService.publishD01AData(topic, d01aData);

      // Store publication record
      this.database.prepare(`
        INSERT INTO overlay_messages
        (message_id, topic, message_type, data_json, received_at, processed)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        messageId,
        topic,
        'publish',
        JSON.stringify(d01aData),
        Date.now(),
        true
      );

      this.emit('manifest-published', { topic, manifest, messageId });
      return messageId;

    } catch (error) {
      throw new Error(`Failed to publish manifest: ${error.message}`);
    }
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
      const searchTopics = [D01A_TOPICS.SEARCH_QUERIES];

      if (query.classification) {
        searchTopics.push(TopicGenerator.datasetTopic('*', query.classification));
      }

      const searchPromises = searchTopics.map(topic =>
        this.overlayService.requestData(topic, {
          type: 'search',
          query,
          timestamp: Date.now()
        })
      );

      await Promise.all(searchPromises);

      // Return cached results (overlay responses will be handled by event handlers)
      // In a real implementation, you'd wait for responses or use a callback pattern
      return this.getCachedSearchResults(query);

    } catch (error) {
      throw new Error(`Failed to search overlay data: ${error.message}`);
    }
  }

  /**
   * Handle incoming overlay data
   */
  private handleIncomingData(event: OverlayDataEvent): void {
    try {
      // Store message in database
      const messageId = this.generateMessageId(event);
      this.database.prepare(`
        INSERT OR REPLACE INTO overlay_messages
        (message_id, topic, message_type, sender, data_json, received_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        messageId,
        event.topic,
        'data',
        event.sender,
        JSON.stringify(event.data),
        event.timestamp
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
  private handleDataRequest(event: OverlayDataEvent): void {
    try {
      // Process search requests
      if (event.data.type === 'search') {
        this.handleSearchRequest(event);
      }

      this.emit('data-request', event);

    } catch (error) {
      console.error('Failed to handle data request:', error);
    }
  }

  /**
   * Handle search requests from other nodes
   */
  private handleSearchRequest(event: OverlayDataEvent): void {
    try {
      const query = event.data.query;
      const results = this.searchLocalData(query);

      if (results.length > 0) {
        // Send response back to requester
        this.overlayService.sendData(
          D01A_TOPICS.SEARCH_RESULTS,
          {
            type: 'search_response',
            originalQuery: query,
            results,
            timestamp: Date.now()
          },
          event.sender
        );
      }

    } catch (error) {
      console.error('Failed to handle search request:', error);
    }
  }

  /**
   * Search local database for matching data
   */
  private searchLocalData(query: any): any[] {
    try {
      let sql = `
        SELECT m.*, v.version_id, v.content_hash
        FROM manifests m
        JOIN versions v ON m.version_id = v.version_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (query.datasetId) {
        sql += ` AND m.dataset_id = ?`;
        params.push(query.datasetId);
      }

      if (query.classification) {
        sql += ` AND m.classification = ?`;
        params.push(query.classification);
      }

      if (query.mediaType) {
        sql += ` AND m.media_type = ?`;
        params.push(query.mediaType);
      }

      if (query.limit) {
        sql += ` LIMIT ?`;
        params.push(query.limit);
      }

      return this.database.prepare(sql).all(...params);

    } catch (error) {
      console.error('Failed to search local data:', error);
      return [];
    }
  }

  /**
   * Process data based on topic type
   */
  private processTopicData(topic: string, data: any, sender: string): void {
    if (topic.includes('.manifest')) {
      this.processManifestData(data, sender);
    } else if (topic.includes('.search.results')) {
      this.processSearchResults(data, sender);
    } else if (topic.includes('.agent.')) {
      this.processAgentData(data, sender);
    } else if (topic.includes('.payment.')) {
      this.processPaymentData(data, sender);
    }
  }

  /**
   * Process incoming manifest data
   */
  private processManifestData(data: any, sender: string): void {
    try {
      if (data.manifest) {
        // Store manifest in local database for discovery
        // Implementation would depend on your existing manifest schema
        console.log('Received manifest from overlay:', data.manifest.datasetId);
        this.emit('manifest-received', { manifest: data.manifest, sender });
      }
    } catch (error) {
      console.error('Failed to process manifest data:', error);
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
  private handlePeerConnected(peerId: string): void {
    this.database.prepare(`
      INSERT OR REPLACE INTO overlay_peers
      (peer_id, connected_at, last_seen, message_count)
      VALUES (?, ?, ?, 0)
    `).run(peerId, Date.now(), Date.now());

    this.emit('peer-connected', peerId);
  }

  /**
   * Handle peer disconnected
   */
  private handlePeerDisconnected(peerId: string): void {
    this.database.prepare(`
      UPDATE overlay_peers SET last_seen = ? WHERE peer_id = ?
    `).run(Date.now(), peerId);

    this.emit('peer-disconnected', peerId);
  }

  /**
   * Get cached search results
   */
  private getCachedSearchResults(query: any): any[] {
    try {
      // Return recent search results from database
      const results = this.database.prepare(`
        SELECT data_json FROM overlay_messages
        WHERE topic = ? AND message_type = 'data'
        AND received_at > ?
        ORDER BY received_at DESC
        LIMIT 50
      `).all(D01A_TOPICS.SEARCH_RESULTS, Date.now() - 300000); // Last 5 minutes

      return results.map(row => JSON.parse(row.data_json)).filter(data =>
        data.type === 'search_response'
      );

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
  getStats(): {
    overlay: any;
    subscriptions: any;
    messages: { total: number; recent: number };
    peers: { total: number; active: number };
  } {
    const overlayStats = this.overlayService.getStats();
    const subscriptionStats = this.subscriptionManager.getStats();

    const totalMessages = this.database.prepare(`
      SELECT COUNT(*) as count FROM overlay_messages
    `).get()?.count || 0;

    const recentMessages = this.database.prepare(`
      SELECT COUNT(*) as count FROM overlay_messages
      WHERE received_at > ?
    `).get(Date.now() - 3600000)?.count || 0; // Last hour

    const totalPeers = this.database.prepare(`
      SELECT COUNT(*) as count FROM overlay_peers
    `).get()?.count || 0;

    const activePeers = this.database.prepare(`
      SELECT COUNT(*) as count FROM overlay_peers
      WHERE last_seen > ?
    `).get(Date.now() - 300000)?.count || 0; // Last 5 minutes

    return {
      overlay: overlayStats,
      subscriptions: subscriptionStats,
      messages: { total: totalMessages, recent: recentMessages },
      peers: { total: totalPeers, active: activePeers }
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