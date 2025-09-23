// BRC-88: Overlay Services Synchronization Architecture
// Implements SHIP (Services Host Interconnect Protocol) and SLAP (Services Lookup Availability Protocol)

import { EventEmitter } from 'events';

import { walletService } from '../../ui/src/lib/wallet';
import type { PostgreSQLClient } from '../db/postgresql';
import { getPostgreSQLClient } from '../db/postgresql';

import type { BRC22SubmitService } from './brc22-submit';
import type { BRC24LookupService } from './brc24-lookup';

export interface SHIPAdvertisement {
  advertiserIdentity: string;
  domainName: string;
  topicName: string;
  signature: string;
  timestamp: number;
  isRevocation?: boolean;
}

export interface SLAPAdvertisement {
  advertiserIdentity: string;
  domainName: string;
  serviceId: string; // BRC-24 provider ID
  signature: string;
  timestamp: number;
  isRevocation?: boolean;
}

export interface ServiceNode {
  identity: string;
  domainName: string;
  services: {
    topics: string[];
    lookupProviders: string[];
  };
  lastSeen: number;
  isActive: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'pending';
}

export interface SynchronizationConfig {
  enableAutoSync: boolean;
  syncInterval: number; // milliseconds
  peerDiscoveryUrls: string[];
  advertisementTTL: number; // milliseconds
  maxPeers: number;
}

class BRC88SHIPSLAPService extends EventEmitter {
  private database: PostgreSQLClient;
  private brc22Service: BRC22SubmitService;
  private brc24Service: BRC24LookupService;
  private config: SynchronizationConfig;
  private myIdentity: string | null = null;
  private myDomain: string;
  private syncTimer: NodeJS.Timeout | null = null;
  private knownPeers = new Map<string, ServiceNode>();

  constructor(
    database: PostgreSQLClient,
    brc22Service: BRC22SubmitService,
    brc24Service: BRC24LookupService,
    config: SynchronizationConfig,
    myDomain: string,
  ) {
    super();
    this.database = database;
    this.brc22Service = brc22Service;
    this.brc24Service = brc24Service;
    this.config = config;
    this.myDomain = myDomain;

    this.setupDatabase();
    this.setupSHIPSLAPTopicManagers();
    this.initializeIdentity();
    this.startSynchronization();
  }

  /**
   * Database tables are now created in the main schema at /src/db/postgresql-schema-complete.sql
   * This method is kept for compatibility but no longer creates tables
   */
  private setupDatabase(): void {
    // Tables are now created centrally in the main database schema
    // BRC-88 tables: brc88_ship_ads, brc88_slap_ads, brc88_peers, brc88_sync_history
    console.log('BRC-88 database tables managed by central schema');
  }

  /**
   * Set up SHIP and SLAP topic managers in BRC-22
   */
  private setupSHIPSLAPTopicManagers(): void {
    // SHIP topic manager
    this.brc22Service.addTopicManager({
      topicName: 'SHIP',
      admittanceLogic: (transaction, outputIndex) => {
        return this.validateSHIPToken(transaction, outputIndex);
      },
      onOutputAdmitted: (txid, vout, outputScript, satoshis) => {
        this.processSHIPAdvertisement(txid, vout, outputScript);
      },
    });

    // SLAP topic manager
    this.brc22Service.addTopicManager({
      topicName: 'SLAP',
      admittanceLogic: (transaction, outputIndex) => {
        return this.validateSLAPToken(transaction, outputIndex);
      },
      onOutputAdmitted: (txid, vout, outputScript, satoshis) => {
        this.processSLAPAdvertisement(txid, vout, outputScript);
      },
    });
  }

  /**
   * Initialize identity from connected wallet
   */
  private async initializeIdentity(): Promise<void> {
    try {
      if (walletService.isConnected()) {
        this.myIdentity = walletService.getPublicKey();
        if (this.myIdentity) {
          console.log(`[BRC-88] Initialized with identity: ${this.myIdentity.substring(0, 16)}...`);
        }
      }
    } catch (error) {
      console.warn('[BRC-88] Failed to initialize identity:', error);
    }
  }

  /**
   * Start synchronization process
   */
  private startSynchronization(): void {
    if (this.config.enableAutoSync && !this.syncTimer) {
      this.syncTimer = setInterval(() => {
        this.performSynchronization();
      }, this.config.syncInterval);

      // Initial sync
      setTimeout(() => this.performSynchronization(), 1000);
    }
  }

  /**
   * Perform synchronization with peers
   */
  private async performSynchronization(): Promise<void> {
    try {
      // Discover new peers
      await this.discoverPeers();

      // Sync with active peers
      await this.syncWithPeers();

      // Clean up stale advertisements
      await this.cleanupStaleAdvertisements();

      // Update our own advertisements
      await this.updateOwnAdvertisements();

      this.emit('sync-completed', {
        peers: this.knownPeers.size,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[BRC-88] Synchronization failed:', error);
      this.recordSyncAttempt(null, 'full_sync', 'outgoing', 'failed', 0, error.message);
    }
  }

  /**
   * Discover new peers from configured URLs
   */
  private async discoverPeers(): Promise<void> {
    for (const url of this.config.peerDiscoveryUrls) {
      try {
        // In production, this would make HTTP requests to discovery services
        // For now, simulate peer discovery
        await this.simulatePeerDiscovery(url);
      } catch (error) {
        console.warn(`[BRC-88] Peer discovery failed for ${url}:`, error);
      }
    }
  }

  /**
   * Simulate peer discovery (placeholder for real implementation)
   */
  private async simulatePeerDiscovery(discoveryUrl: string): Promise<void> {
    // In production, this would:
    // 1. Query the discovery service
    // 2. Parse SHIP/SLAP advertisements
    // 3. Validate signatures
    // 4. Add new peers to our database

    const mockPeers = [
      {
        identity: '02aabbcc' + 'deadbeef'.repeat(7),
        domain: 'peer1.example.com',
        topics: ['gitdata.d01a.asset', 'gitdata.dataset.public'],
        services: ['topic_lookup', 'dataset_search'],
      },
      {
        identity: '03112233' + 'cafebabe'.repeat(7),
        domain: 'peer2.example.com',
        topics: ['gitdata.agent.registry', 'gitdata.payment.quotes'],
        services: ['agent_services', 'payment_tracker'],
      },
    ];

    for (const peer of mockPeers) {
      await this.addDiscoveredPeer(peer);
    }
  }

  /**
   * Add a discovered peer
   */
  private async addDiscoveredPeer(peerInfo: {
    identity: string;
    domain: string;
    topics: string[];
    services: string[];
  }): Promise<void> {
    const serviceNode: ServiceNode = {
      identity: peerInfo.identity,
      domainName: peerInfo.domain,
      services: {
        topics: peerInfo.topics,
        lookupProviders: peerInfo.services,
      },
      lastSeen: Date.now(),
      isActive: true,
      connectionStatus: 'discovered',
    };

    this.knownPeers.set(peerInfo.identity, serviceNode);

    // Store in database
    this.database
      .prepare(
        `
      INSERT OR REPLACE INTO brc88_peers
      (peer_identity, domain_name, topics_json, services_json, last_seen, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        peerInfo.identity,
        peerInfo.domain,
        JSON.stringify(peerInfo.topics),
        JSON.stringify(peerInfo.services),
        Date.now(),
        true,
      );

    this.emit('peer-discovered', serviceNode);
  }

  /**
   * Sync with known peers
   */
  private async syncWithPeers(): Promise<void> {
    const activePeers = Array.from(this.knownPeers.values())
      .filter((peer) => peer.isActive)
      .slice(0, this.config.maxPeers);

    for (const peer of activePeers) {
      try {
        await this.syncWithPeer(peer);
      } catch (error) {
        console.warn(`[BRC-88] Sync failed with peer ${peer.domainName}:`, error);
        await this.handlePeerSyncFailure(peer);
      }
    }
  }

  /**
   * Sync with a specific peer
   */
  private async syncWithPeer(peer: ServiceNode): Promise<void> {
    // In production, this would:
    // 1. Connect to peer's domain
    // 2. Exchange SHIP/SLAP advertisements
    // 3. Submit relevant transactions
    // 4. Update peer status

    // Simulate successful sync
    peer.lastSeen = Date.now();
    peer.connectionStatus = 'connected';

    this.recordSyncAttempt(
      peer.identity,
      'peer_sync',
      'outgoing',
      'success',
      peer.services.topics.length + peer.services.lookupProviders.length,
    );

    this.emit('peer-synced', peer);
  }

  /**
   * Handle peer sync failure
   */
  private async handlePeerSyncFailure(peer: ServiceNode): Promise<void> {
    const currentAttempts =
      this.database
        .prepare(
          `
      SELECT sync_attempts FROM brc88_peers WHERE peer_identity = ?
    `,
        )
        .get(peer.identity)?.sync_attempts || 0;

    const newAttempts = currentAttempts + 1;

    this.database
      .prepare(
        `
      UPDATE brc88_peers
      SET sync_attempts = ?, connection_status = ?, is_active = ?
      WHERE peer_identity = ?
    `,
      )
      .run(
        newAttempts,
        'disconnected',
        newAttempts < 5, // Deactivate after 5 failed attempts
        peer.identity,
      );

    peer.connectionStatus = 'disconnected';
    peer.isActive = newAttempts < 5;

    this.recordSyncAttempt(
      peer.identity,
      'peer_sync',
      'outgoing',
      'failed',
      0,
      'Connection failed',
    );
  }

  /**
   * Create and submit SHIP advertisement
   */
  async createSHIPAdvertisement(topicName: string): Promise<string> {
    if (!this.myIdentity) {
      throw new Error('Identity not initialized - wallet must be connected');
    }

    try {
      const advertisement: SHIPAdvertisement = {
        advertiserIdentity: this.myIdentity,
        domainName: this.myDomain,
        topicName,
        signature: '',
        timestamp: Date.now(),
      };

      // Sign the advertisement
      const message = this.createSHIPMessage(advertisement);
      advertisement.signature = await walletService.signData(message, 'brc88-ship');

      // Create transaction
      const txResult = await this.createAdvertisementTransaction('SHIP', advertisement);

      // Store locally
      await this.storeSHIPAdvertisement(advertisement);

      this.emit('ship-advertisement-created', { topicName, txid: txResult.txid });
      return txResult.txid;
    } catch (error) {
      throw new Error(`Failed to create SHIP advertisement: ${error.message}`);
    }
  }

  /**
   * Create and submit SLAP advertisement
   */
  async createSLAPAdvertisement(serviceId: string): Promise<string> {
    if (!this.myIdentity) {
      throw new Error('Identity not initialized - wallet must be connected');
    }

    try {
      const advertisement: SLAPAdvertisement = {
        advertiserIdentity: this.myIdentity,
        domainName: this.myDomain,
        serviceId,
        signature: '',
        timestamp: Date.now(),
      };

      // Sign the advertisement
      const message = this.createSLAPMessage(advertisement);
      advertisement.signature = await walletService.signData(message, 'brc88-slap');

      // Create transaction
      const txResult = await this.createAdvertisementTransaction('SLAP', advertisement);

      // Store locally
      await this.storeSLAPAdvertisement(advertisement);

      this.emit('slap-advertisement-created', { serviceId, txid: txResult.txid });
      return txResult.txid;
    } catch (error) {
      throw new Error(`Failed to create SLAP advertisement: ${error.message}`);
    }
  }

  /**
   * Update our own advertisements based on current services
   */
  private async updateOwnAdvertisements(): Promise<void> {
    if (!this.myIdentity) return;

    try {
      // Get current topic managers from BRC-22
      const stats = this.brc22Service.getStats();
      const activeTopics = Object.keys(stats.topics);

      // Create SHIP advertisements for each topic
      for (const topic of activeTopics) {
        const existingAd = this.database
          .prepare(
            `
          SELECT * FROM brc88_ship_ads
          WHERE advertiser_identity = ? AND topic_name = ? AND is_active = TRUE
        `,
          )
          .get(this.myIdentity, topic);

        if (!existingAd) {
          await this.createSHIPAdvertisement(topic);
        }
      }

      // Get current lookup providers from BRC-24
      const providers = this.brc24Service.getAvailableProviders();

      // Create SLAP advertisements for each provider
      for (const provider of providers) {
        const existingAd = this.database
          .prepare(
            `
          SELECT * FROM brc88_slap_ads
          WHERE advertiser_identity = ? AND service_id = ? AND is_active = TRUE
        `,
          )
          .get(this.myIdentity, provider.providerId);

        if (!existingAd) {
          await this.createSLAPAdvertisement(provider.providerId);
        }
      }
    } catch (error) {
      console.error('[BRC-88] Failed to update own advertisements:', error);
    }
  }

  /**
   * Validate SHIP token in transaction output
   */
  private validateSHIPToken(transaction: any, outputIndex: number): boolean {
    try {
      // In production, parse the actual output script to extract SHIP token
      // For now, simulate validation
      const outputs = this.parseTransactionOutputs(transaction.rawTx);
      const output = outputs[outputIndex];

      return output && output.script.includes('SHIP');
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate SLAP token in transaction output
   */
  private validateSLAPToken(transaction: any, outputIndex: number): boolean {
    try {
      // In production, parse the actual output script to extract SLAP token
      // For now, simulate validation
      const outputs = this.parseTransactionOutputs(transaction.rawTx);
      const output = outputs[outputIndex];

      return output && output.script.includes('SLAP');
    } catch (error) {
      return false;
    }
  }

  /**
   * Process SHIP advertisement from blockchain
   */
  private async processSHIPAdvertisement(
    txid: string,
    vout: number,
    outputScript: string,
  ): Promise<void> {
    try {
      // In production, parse the output script to extract SHIP data
      const advertisement = this.parseSHIPFromScript(outputScript);
      if (advertisement) {
        await this.storeSHIPAdvertisement(advertisement);
        this.emit('ship-advertisement-received', { advertisement, txid, vout });
      }
    } catch (error) {
      console.error('[BRC-88] Failed to process SHIP advertisement:', error);
    }
  }

  /**
   * Process SLAP advertisement from blockchain
   */
  private async processSLAPAdvertisement(
    txid: string,
    vout: number,
    outputScript: string,
  ): Promise<void> {
    try {
      // In production, parse the output script to extract SLAP data
      const advertisement = this.parseSLAPFromScript(outputScript);
      if (advertisement) {
        await this.storeSLAPAdvertisement(advertisement);
        this.emit('slap-advertisement-received', { advertisement, txid, vout });
      }
    } catch (error) {
      console.error('[BRC-88] Failed to process SLAP advertisement:', error);
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    ship: { total: number; active: number; own: number };
    slap: { total: number; active: number; own: number };
    peers: { total: number; active: number; connected: number };
    sync: { attempts: number; successes: number; failures: number };
  } {
    const myIdentity = this.myIdentity || '';

    const shipTotal =
      this.database
        .prepare(
          `
      SELECT COUNT(*) as count FROM brc88_ship_ads
    `,
        )
        .get()?.count || 0;

    const shipActive =
      this.database
        .prepare(
          `
      SELECT COUNT(*) as count FROM brc88_ship_ads WHERE is_active = TRUE
    `,
        )
        .get()?.count || 0;

    const shipOwn =
      this.database
        .prepare(
          `
      SELECT COUNT(*) as count FROM brc88_ship_ads
      WHERE advertiser_identity = ? AND is_active = TRUE
    `,
        )
        .get(myIdentity)?.count || 0;

    const slapTotal =
      this.database
        .prepare(
          `
      SELECT COUNT(*) as count FROM brc88_slap_ads
    `,
        )
        .get()?.count || 0;

    const slapActive =
      this.database
        .prepare(
          `
      SELECT COUNT(*) as count FROM brc88_slap_ads WHERE is_active = TRUE
    `,
        )
        .get()?.count || 0;

    const slapOwn =
      this.database
        .prepare(
          `
      SELECT COUNT(*) as count FROM brc88_slap_ads
      WHERE advertiser_identity = ? AND is_active = TRUE
    `,
        )
        .get(myIdentity)?.count || 0;

    const peersTotal =
      this.database
        .prepare(
          `
      SELECT COUNT(*) as count FROM brc88_peers
    `,
        )
        .get()?.count || 0;

    const peersActive =
      this.database
        .prepare(
          `
      SELECT COUNT(*) as count FROM brc88_peers WHERE is_active = TRUE
    `,
        )
        .get()?.count || 0;

    const peersConnected =
      this.database
        .prepare(
          `
      SELECT COUNT(*) as count FROM brc88_peers
      WHERE connection_status = 'connected'
    `,
        )
        .get()?.count || 0;

    const syncAttempts =
      this.database
        .prepare(
          `
      SELECT COUNT(*) as count FROM brc88_sync_history
    `,
        )
        .get()?.count || 0;

    const syncSuccesses =
      this.database
        .prepare(
          `
      SELECT COUNT(*) as count FROM brc88_sync_history WHERE status = 'success'
    `,
        )
        .get()?.count || 0;

    const syncFailures = syncAttempts - syncSuccesses;

    return {
      ship: { total: shipTotal, active: shipActive, own: shipOwn },
      slap: { total: slapTotal, active: slapActive, own: slapOwn },
      peers: { total: peersTotal, active: peersActive, connected: peersConnected },
      sync: { attempts: syncAttempts, successes: syncSuccesses, failures: syncFailures },
    };
  }

  // Helper methods

  private createSHIPMessage(ad: SHIPAdvertisement): string {
    return `SHIP|${ad.advertiserIdentity}|${ad.domainName}|${ad.topicName}|${ad.timestamp}`;
  }

  private createSLAPMessage(ad: SLAPAdvertisement): string {
    return `SLAP|${ad.advertiserIdentity}|${ad.domainName}|${ad.serviceId}|${ad.timestamp}`;
  }

  private async createAdvertisementTransaction(
    type: 'SHIP' | 'SLAP',
    advertisement: any,
  ): Promise<{ txid: string }> {
    // In production, create actual transaction with proper output script
    // For now, return mock transaction ID
    return { txid: require('crypto').randomBytes(32).toString('hex') };
  }

  private async storeSHIPAdvertisement(ad: SHIPAdvertisement): Promise<void> {
    const adId = `ship_${ad.advertiserIdentity}_${ad.topicName}_${ad.timestamp}`;

    this.database
      .prepare(
        `
      INSERT OR REPLACE INTO brc88_ship_ads
      (ad_id, advertiser_identity, domain_name, topic_name, signature, timestamp, is_revocation, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        adId,
        ad.advertiserIdentity,
        ad.domainName,
        ad.topicName,
        ad.signature,
        ad.timestamp,
        ad.isRevocation || false,
        !ad.isRevocation,
      );
  }

  private async storeSLAPAdvertisement(ad: SLAPAdvertisement): Promise<void> {
    const adId = `slap_${ad.advertiserIdentity}_${ad.serviceId}_${ad.timestamp}`;

    this.database
      .prepare(
        `
      INSERT OR REPLACE INTO brc88_slap_ads
      (ad_id, advertiser_identity, domain_name, service_id, signature, timestamp, is_revocation, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        adId,
        ad.advertiserIdentity,
        ad.domainName,
        ad.serviceId,
        ad.signature,
        ad.timestamp,
        ad.isRevocation || false,
        !ad.isRevocation,
      );
  }

  private parseSHIPFromScript(outputScript: string): SHIPAdvertisement | null {
    // Simplified parsing - in production use proper script parsing
    if (outputScript.includes('SHIP')) {
      return {
        advertiserIdentity: 'parsed_identity',
        domainName: 'parsed_domain.com',
        topicName: 'parsed_topic',
        signature: 'parsed_signature',
        timestamp: Date.now(),
      };
    }
    return null;
  }

  private parseSLAPFromScript(outputScript: string): SLAPAdvertisement | null {
    // Simplified parsing - in production use proper script parsing
    if (outputScript.includes('SLAP')) {
      return {
        advertiserIdentity: 'parsed_identity',
        domainName: 'parsed_domain.com',
        serviceId: 'parsed_service',
        signature: 'parsed_signature',
        timestamp: Date.now(),
      };
    }
    return null;
  }

  private parseTransactionOutputs(rawTx: string): Array<{ script: string; satoshis: number }> {
    // Simplified parsing - use proper Bitcoin transaction parser in production
    return [
      { script: 'SHIP_mock_script', satoshis: 1000 },
      { script: 'SLAP_mock_script', satoshis: 1000 },
    ];
  }

  private recordSyncAttempt(
    peerIdentity: string | null,
    syncType: string,
    direction: string,
    status: string,
    messageCount: number = 0,
    errorMessage?: string,
  ): void {
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.database
      .prepare(
        `
      INSERT INTO brc88_sync_history
      (sync_id, peer_identity, sync_type, direction, status, message_count, error_message, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        syncId,
        peerIdentity,
        syncType,
        direction,
        status,
        messageCount,
        errorMessage || null,
        Date.now(),
      );
  }

  private async cleanupStaleAdvertisements(): Promise<void> {
    const staleThreshold = Date.now() - this.config.advertisementTTL;

    // Mark stale SHIP advertisements as inactive
    this.database
      .prepare(
        `
      UPDATE brc88_ship_ads
      SET is_active = FALSE
      WHERE timestamp < ? AND is_active = TRUE
    `,
      )
      .run(staleThreshold);

    // Mark stale SLAP advertisements as inactive
    this.database
      .prepare(
        `
      UPDATE brc88_slap_ads
      SET is_active = FALSE
      WHERE timestamp < ? AND is_active = TRUE
    `,
      )
      .run(staleThreshold);

    // Mark stale peers as inactive
    this.database
      .prepare(
        `
      UPDATE brc88_peers
      SET is_active = FALSE
      WHERE last_seen < ? AND is_active = TRUE
    `,
      )
      .run(staleThreshold);
  }

  /**
   * Stop synchronization
   */
  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}

export { BRC88SHIPSLAPService };
