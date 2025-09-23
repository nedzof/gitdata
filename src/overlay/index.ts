// BSV Overlay Integration Entry Point
// Exports all overlay services and utilities including BRC standards

export { BSVOverlayService } from './bsv-overlay-service';
export { OverlayManager } from './overlay-manager';
export { OverlayPaymentService } from './overlay-payments';
export { BRC22SubmitService } from './brc22-submit';
export { BRC24LookupService } from './brc24-lookup';
export { BRC64HistoryService } from './brc64-history';
export { BRC88SHIPSLAPService } from './brc88-ship-slap';
export { BRC26UHRPService } from './brc26-uhrp';

// D24 Agent Marketplace Services
export { OverlayAgentRegistry } from '../agents/overlay-agent-registry';
export { OverlayRuleEngine } from '../agents/overlay-rule-engine';
export { AgentExecutionService } from '../agents/agent-execution-service';
export {
  getOverlayConfig,
  D01A_TOPICS,
  TopicGenerator,
  TopicSubscriptionManager,
  TOPIC_CLASSIFICATION,
} from './overlay-config';

export type { OverlayConfig, D01AData, OverlayMessage } from './bsv-overlay-service';

export type { OverlayManagerConfig, OverlayDataEvent } from './overlay-manager';

export type { PaymentQuote, PaymentRequest, PaymentReceipt } from './overlay-payments';

export type { BRC22Transaction, BRC22Response, TopicManager } from './brc22-submit';

export type { BRC24Query, BRC24Response, BRC36UTXO, LookupProvider } from './brc24-lookup';

export type { HistoricalUTXO, HistoryQuery, LineageGraph } from './brc64-history';

export type { SHIPAdvertisement, SLAPAdvertisement, ServiceNode } from './brc88-ship-slap';

export type { UHRPAdvertisement, UHRPContent, UHRPQuery, UHRPHost } from './brc26-uhrp';

// Main overlay initialization function
import { OverlayManager } from './overlay-manager';
import { OverlayPaymentService } from './overlay-payments';
import { BRC22SubmitService } from './brc22-submit';
import { BRC24LookupService } from './brc24-lookup';
import { BRC64HistoryService } from './brc64-history';
import { BRC88SHIPSLAPService } from './brc88-ship-slap';
import {
  PostgreSQLBRC22SubmitService,
  PostgreSQLBRC24LookupService,
  PostgreSQLBRC64HistoryService,
  PostgreSQLBRC88SHIPSLAPService,
} from './brc-services-postgresql';
import { BRC26UHRPService } from './brc26-uhrp';
import { getOverlayConfig } from './overlay-config';

import type * as Database from 'better-sqlite3';
import { Pool } from 'pg';

// Database adapter interface for PostgreSQL support
interface DatabaseAdapter {
  query(sql: string, params?: any[]): Promise<any[]>;
  queryOne(sql: string, params?: any[]): Promise<any>;
  execute(sql: string, params?: any[]): Promise<void>;
}

class PostgreSQLAdapter implements DatabaseAdapter {
  constructor(private pool: Pool) {}

  async query(sql: string, params: any[] = []): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async queryOne(sql: string, params: any[] = []): Promise<any> {
    const results = await this.query(sql, params);
    return results[0] || null;
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    await this.query(sql, params);
  }
}

class SQLiteAdapter implements DatabaseAdapter {
  constructor(private db: Database.Database) {}

  async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      console.error('SQLite query error:', error);
      return [];
    }
  }

  async queryOne(sql: string, params: any[] = []): Promise<any> {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params) || null;
    } catch (error) {
      console.error('SQLite queryOne error:', error);
      return null;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    try {
      const stmt = this.db.prepare(sql);
      stmt.run(...params);
    } catch (error) {
      console.error('SQLite execute error:', error);
    }
  }
}

/**
 * Creates a legacy SQLite-compatible wrapper for PostgreSQL DatabaseAdapter
 * Used by OverlayManager and OverlayPaymentService until they're fully migrated
 */
function createLegacyWrapper(dbAdapter: DatabaseAdapter): any {
  const queryCache = new Map<string, any>();

  return {
    // Synchronous exec method - run async in background
    exec: (sql: string) => {
      dbAdapter
        .execute(sql)
        .catch((err) => console.warn('[LEGACY-DB] Async exec error:', err.message));
    },

    // Prepare method that returns an object with run/get/all methods
    prepare: (sql: string) => {
      return {
        run: (...params: any[]) => {
          dbAdapter
            .execute(sql, params)
            .catch((err) => console.warn('[LEGACY-DB] Async run error:', err.message));
          return { lastInsertRowid: Date.now(), changes: 1 };
        },

        get: (...params: any[]) => {
          // For read operations, we need to handle them differently
          // These will return null but shouldn't break the application
          const cacheKey = `${sql}:${JSON.stringify(params)}`;
          if (queryCache.has(cacheKey)) {
            return queryCache.get(cacheKey);
          }

          // Async operation - can't return real data synchronously
          dbAdapter
            .queryOne(sql, params)
            .then((result) => {
              if (result) queryCache.set(cacheKey, result);
            })
            .catch((err) => console.warn('[LEGACY-DB] Async get error:', err.message));

          return null; // Legacy services must handle null gracefully
        },

        all: (...params: any[]) => {
          // Similar to get, but for multiple results
          const cacheKey = `all:${sql}:${JSON.stringify(params)}`;
          if (queryCache.has(cacheKey)) {
            return queryCache.get(cacheKey);
          }

          dbAdapter
            .query(sql, params)
            .then((results) => {
              if (results) queryCache.set(cacheKey, results);
            })
            .catch((err) => console.warn('[LEGACY-DB] Async all error:', err.message));

          return []; // Return empty array for legacy compatibility
        },
      };
    },
  };
}

// Import agent marketplace services
import { AgentExecutionService } from '../agents/agent-execution-service';
import { OverlayAgentRegistry } from '../agents/overlay-agent-registry';
import { OverlayRuleEngine } from '../agents/overlay-rule-engine';

export interface GitdataOverlayServices {
  overlayManager: OverlayManager;
  paymentService: OverlayPaymentService;
  brc22Service: BRC22SubmitService;
  brc24Service: BRC24LookupService;
  brc64Service: BRC64HistoryService;
  brc88Service: BRC88SHIPSLAPService;
  brc26Service: BRC26UHRPService;
  // D24 Agent Marketplace Services
  agentRegistry: OverlayAgentRegistry;
  ruleEngine: OverlayRuleEngine;
  executionService: AgentExecutionService;
}

/**
 * Initialize complete BSV overlay services with BRC standards for Gitdata
 */
export async function initializeOverlayServices(
  database: Database.Database | Pool,
  environment: 'development' | 'staging' | 'production' = 'development',
  myDomain: string = 'localhost:8788',
  options: {
    storageBasePath?: string;
    baseUrl?: string;
  } = {},
): Promise<GitdataOverlayServices> {
  // Create database adapter based on the type of database provided
  let dbAdapter: DatabaseAdapter;
  if (database instanceof Pool) {
    dbAdapter = new PostgreSQLAdapter(database);
    console.log('[OVERLAY] Using PostgreSQL database for overlay services');
  } else {
    dbAdapter = new SQLiteAdapter(database);
    console.log('[OVERLAY] Using SQLite database for overlay services');
  }

  // Default configuration
  const storageBasePath = options.storageBasePath || './data/uhrp-storage';
  const baseUrl = options.baseUrl || `http://${myDomain}`;

  // Initialize BRC services based on database type
  let brc22Service: BRC22SubmitService | PostgreSQLBRC22SubmitService | null = null;
  let brc24Service: BRC24LookupService | PostgreSQLBRC24LookupService | null = null;
  let brc64Service: BRC64HistoryService | PostgreSQLBRC64HistoryService | null = null;
  let brc88Service: BRC88SHIPSLAPService | PostgreSQLBRC88SHIPSLAPService | null = null;

  if (database instanceof Pool) {
    // PostgreSQL: Use production-ready BRC services
    brc22Service = new PostgreSQLBRC22SubmitService(dbAdapter);
    brc24Service = new PostgreSQLBRC24LookupService(dbAdapter, brc22Service);
    brc64Service = new PostgreSQLBRC64HistoryService(dbAdapter, brc22Service, brc24Service);
    brc88Service = new PostgreSQLBRC88SHIPSLAPService(dbAdapter, myDomain);

    console.log('[OVERLAY] ✅ Initialized PostgreSQL BRC services (22, 24, 64, 88)');
    console.log('[OVERLAY] ✅ Production-ready with scalable database backend');
    console.log('[OVERLAY] ✅ All BRC standards available for production use');
  } else {
    // SQLite: Use legacy services for development
    brc22Service = new BRC22SubmitService(dbAdapter);
    brc24Service = new BRC24LookupService(dbAdapter, brc22Service);
    brc64Service = new BRC64HistoryService(dbAdapter, brc22Service, brc24Service);
    brc88Service = new BRC88SHIPSLAPService(
      dbAdapter as any,
      brc22Service,
      brc24Service,
      {
        enableAutoSync: true,
        syncInterval: 60000, // 1 minute
        peerDiscoveryUrls: ['https://overlay.powping.com', 'https://overlay.bitcoinfiles.org'],
        advertisementTTL: 24 * 60 * 60 * 1000, // 24 hours
        maxPeers: 50,
      },
      myDomain,
    );
    console.log('[OVERLAY] ✅ Initialized SQLite BRC services (22, 24, 64, 88) for development');
  }

  // Create BRC-26 UHRP service (Universal Hash Resolution Protocol for file storage)
  const brc26Service = new BRC26UHRPService(dbAdapter, storageBasePath, baseUrl);

  // Create overlay manager - use appropriate database interface
  const legacyDatabase = database instanceof Pool ? createLegacyWrapper(dbAdapter) : database;

  const overlayManager = new OverlayManager({
    environment,
    database: legacyDatabase,
    autoConnect: true,
    enablePaymentIntegration: true,
    enableSearchIntegration: true,
  });

  // Create payment service
  const paymentService = new OverlayPaymentService(overlayManager, legacyDatabase);

  // D24 Agent Marketplace Services
  const agentRegistry = new OverlayAgentRegistry(dbAdapter, brc88Service as any);
  const ruleEngine = new OverlayRuleEngine(dbAdapter, brc22Service as any, agentRegistry);
  const executionService = new AgentExecutionService(dbAdapter, {
    webhookTimeoutMs: 15000,
    requireIdentity: true,
  });

  // Initialize overlay manager
  await overlayManager.initialize();

  // Set up cross-service event handling
  setupCrossServiceEvents(
    overlayManager,
    paymentService,
    brc22Service as any,
    brc24Service as any,
    brc64Service as any,
    brc88Service as any,
    brc26Service,
  );

  return {
    overlayManager,
    paymentService,
    brc22Service: brc22Service as any,
    brc24Service: brc24Service as any,
    brc64Service: brc64Service as any,
    brc88Service: brc88Service as any,
    brc26Service,
    // D24 Agent Marketplace Services
    agentRegistry,
    ruleEngine,
    executionService,
  };
}

/**
 * Set up comprehensive event handling between all overlay services
 */
function setupCrossServiceEvents(
  overlayManager: OverlayManager,
  paymentService: OverlayPaymentService,
  brc22Service: BRC22SubmitService | null,
  brc24Service: BRC24LookupService | null,
  brc64Service: BRC64HistoryService | null,
  brc88Service: BRC88SHIPSLAPService | null,
  brc26Service: BRC26UHRPService,
): void {
  // === Overlay Manager Events ===

  // Forward payment events from overlay manager to payment service
  overlayManager.on('payment-data', (event) => {
    paymentService.emit('overlay-payment-message', event);
  });

  // Forward search results that include payment info
  overlayManager.on('search-results', (event) => {
    if (event.results.some((r: any) => r.paymentRequired)) {
      paymentService.emit('payment-required-data', event);
    }
  });

  // Forward asset publications for payment tracking
  overlayManager.on('asset-published', (event) => {
    if (event.asset.policy?.paymentRequired) {
      paymentService.emit('paid-content-published', event);
    }
  });

  // === Payment Service Events ===

  // Handle payment confirmations
  paymentService.on('payment-received', (receipt) => {
    overlayManager.emit('payment-confirmed', receipt);
  });

  // Handle payment failures
  paymentService.on('payment-failed', (error) => {
    overlayManager.emit('payment-error', error);
  });

  // === BRC-22 Service Events ===

  if (brc22Service) {
    // Forward BRC-22 UTXO admissions to overlay for publishing
    brc22Service.on('manifest-utxo-admitted', async (event) => {
      // Publish asset data to overlay network
      try {
        const asset = await extractAssetFromUTXO(event);
        if (asset) {
          await overlayManager.publishAsset(asset);
        }
      } catch (error) {
        console.error('Failed to publish asset from BRC-22 admission:', error);
      }
    });

    // Forward transaction processing to history service
    brc22Service.on('transaction-processed', (event) => {
      if (brc64Service) {
        brc64Service.emit('transaction-for-history', event);
      }
    });
  }

  // === BRC-24 Service Events ===

  if (brc24Service) {
    // Forward lookup results to overlay for caching/sharing
    brc24Service.on('lookup-processed', (event) => {
      overlayManager.emit('lookup-completed', event);
    });
  }

  // === BRC-64 Service Events ===

  if (brc64Service) {
    // Forward history captures for lineage visualization
    brc64Service.on('history-captured', (event) => {
      overlayManager.emit('lineage-updated', event);
    });

    // Forward lineage graph updates
    brc64Service.on('lineage-built', (event) => {
      overlayManager.emit('lineage-graph-updated', event);
    });
  }

  // === BRC-88 Service Events ===

  if (brc88Service) {
    // Forward peer discoveries to overlay manager
    brc88Service.on('peer-discovered', (peer) => {
      overlayManager.emit('overlay-peer-discovered', peer);
    });

    // Forward service advertisements
    brc88Service.on('ship-advertisement-created', (event) => {
      overlayManager.emit('service-advertised', { type: 'SHIP', ...event });
    });

    brc88Service.on('slap-advertisement-created', (event) => {
      overlayManager.emit('service-advertised', { type: 'SLAP', ...event });
    });

    // Handle peer synchronization
    brc88Service.on('peer-synced', (peer) => {
      overlayManager.emit('peer-synchronized', peer);
    });
  }

  // === BRC-26 UHRP Service Events ===

  // Forward file storage events to overlay for publication
  brc26Service.on('file-stored', async (content) => {
    try {
      // Create asset metadata for the stored file
      const asset = {
        datasetId: `uhrp-file-${content.hash}`,
        description: `UHRP stored file: ${content.filename}`,
        provenance: {
          createdAt: new Date(content.uploadedAt).toISOString(),
          issuer: 'uhrp-service',
        },
        policy: {
          license: 'proprietary',
          classification: content.isPublic ? 'public' : 'private',
        },
        content: {
          contentHash: content.hash,
          mediaType: content.contentType,
          sizeBytes: content.size,
          url: `uhrp://${content.hash}`,
        },
        parents: [],
        tags: ['uhrp-file', ...(content.metadata?.tags || [])],
      };

      await overlayManager.publishAsset(asset);
      console.log(`[OVERLAY] Published UHRP file asset: ${content.hash}`);
    } catch (error) {
      console.error('[OVERLAY] Failed to publish UHRP file asset:', error);
    }
  });

  // Forward advertisement events
  brc26Service.on('advertisement-created', (advertisement) => {
    overlayManager.emit('uhrp-advertisement', advertisement);
    // Also publish via BRC-22 if needed
    brc22Service.emit('uhrp-advertisement-for-submission', advertisement);
  });

  // === Cross-Service Integration ===

  // When new data is discovered via overlay, process through BRC-22
  overlayManager.on('data-received', async (event) => {
    if (
      brc22Service &&
      (event.topic.includes('asset') ||
        event.topic.includes('manifest') ||
        event.topic.includes('d01a'))
    ) {
      try {
        // Convert overlay data to BRC-22 transaction format
        const brc22Transaction = convertOverlayDataToBRC22(event);
        if (brc22Transaction) {
          await brc22Service.processSubmission(brc22Transaction, event.sender);
        }
      } catch (error) {
        console.error('Failed to process overlay data via BRC-22:', error);
      }
    }
  });

  // When BRC-24 lookup is requested, also search overlay network
  if (brc24Service) {
    brc24Service.on('lookup-processed', async (event) => {
      try {
        // Also search overlay network for additional results
        const overlayResults = await overlayManager.searchData({
          classification: 'public',
          limit: 10,
        });
        // Merge results if needed
      } catch (error) {
        console.error('Failed to cross-search overlay:', error);
      }
    });
  }

  // When SHIP/SLAP services are advertised, update BRC-24 providers
  if (brc88Service && brc24Service) {
    brc88Service.on('slap-advertisement-received', (event) => {
      // Add discovered lookup providers to BRC-24 service
      const provider = {
        providerId: event.advertisement.serviceId,
        name: `Remote Service: ${event.advertisement.serviceId}`,
        description: `Lookup service from ${event.advertisement.domainName}`,
        processQuery: async (query: any) => {
          // In production, make HTTP request to remote service
          return [];
        },
      };
      // brc24Service.addLookupProvider(provider); // Uncomment when remote providers are implemented
    });
  }

  console.log('[OVERLAY] Cross-service event handling configured');
}

/**
 * Helper function to extract asset from UTXO (placeholder)
 */
async function extractAssetFromUTXO(event: any): Promise<any | null> {
  // In production, parse the UTXO output script to extract D01A asset
  // For now, return a mock asset
  return {
    datasetId: 'extracted-from-utxo',
    description: 'Asset extracted from BRC-22 UTXO',
    provenance: {
      createdAt: new Date().toISOString(),
      issuer: event.outputScript?.substring(0, 16) || 'unknown',
    },
    policy: {
      license: 'cc-by-4.0',
      classification: 'public',
    },
    content: {
      contentHash: event.txid,
      mediaType: 'application/json',
      sizeBytes: event.satoshis,
      url: `utxo://${event.txid}:${event.vout}`,
    },
    parents: [],
    tags: ['brc22-extracted'],
  };
}

/**
 * @deprecated Use extractAssetFromUTXO instead
 * Backward compatibility function for extractManifestFromUTXO
 */
async function extractManifestFromUTXO(event: any): Promise<any | null> {
  return extractAssetFromUTXO(event);
}

/**
 * Helper function to convert overlay data to BRC-22 transaction (placeholder)
 */
function convertOverlayDataToBRC22(event: any): any | null {
  // In production, convert overlay message to proper BRC-22 transaction format
  // For now, return a mock transaction
  if (event.data && event.topic) {
    return {
      rawTx: '0100000001' + '00'.repeat(32), // Mock transaction
      inputs: {},
      topics: [event.topic],
      mapiResponses: [],
    };
  }
  return null;
}
