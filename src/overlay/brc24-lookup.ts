// BRC-24: Overlay Network Lookup Services
// Implements standardized lookup services for querying overlay state

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { BRC22SubmitService } from './brc22-submit';

export interface BRC24Query {
  provider: string;
  query: any;
}

export interface BRC24Response {
  status: 'success' | 'error';
  utxos?: BRC36UTXO[];
  error?: {
    code: string;
    description: string;
  };
}

export interface BRC36UTXO {
  txid: string;
  vout: number;
  outputScript: string;
  topic: string;
  satoshis: number;
  rawTx: string;
  proof?: string;
  inputs?: string;
  mapiResponses?: string;
}

export interface LookupProvider {
  providerId: string;
  name: string;
  description: string;
  processQuery: (query: any, requesterId?: string) => Promise<Array<{
    topic: string;
    txid: string;
    vout: number;
  }>>;
  onUTXOAdded?: (topic: string, txid: string, vout: number, outputScript: string, satoshis: number) => void;
  onUTXOSpent?: (topic: string, txid: string, vout: number) => void;
}

export interface PaymentRequirement {
  required: boolean;
  amountSat: number;
  description: string;
  receiptTemplate?: any;
}

class BRC24LookupService extends EventEmitter {
  private database: Database.Database;
  private brc22Service: BRC22SubmitService;
  private lookupProviders = new Map<string, LookupProvider>();

  constructor(database: Database.Database, brc22Service: BRC22SubmitService) {
    super();
    this.database = database;
    this.brc22Service = brc22Service;
    this.setupDatabase();
    this.setupDefaultProviders();
    this.setupBRC22EventHandlers();
  }

  /**
   * Set up database tables for BRC-24 lookup operations
   */
  private setupDatabase(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS brc24_queries (
        query_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        query_json TEXT NOT NULL,
        requester_identity TEXT,
        payment_required BOOLEAN DEFAULT FALSE,
        payment_amount_sat INTEGER DEFAULT 0,
        payment_status TEXT DEFAULT 'none',
        results_count INTEGER DEFAULT 0,
        processed_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);

    this.database.exec(`
      CREATE TABLE IF NOT EXISTS brc24_provider_data (
        provider_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        data_key TEXT NOT NULL,
        data_value TEXT NOT NULL,
        utxo_count INTEGER DEFAULT 0,
        last_updated INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (provider_id, topic, data_key)
      )
    `);

    this.database.exec(`
      CREATE INDEX IF NOT EXISTS idx_brc24_queries_provider ON brc24_queries(provider);
      CREATE INDEX IF NOT EXISTS idx_brc24_queries_processed ON brc24_queries(processed_at);
      CREATE INDEX IF NOT EXISTS idx_brc24_provider_data_topic ON brc24_provider_data(topic);
      CREATE INDEX IF NOT EXISTS idx_brc24_provider_data_updated ON brc24_provider_data(last_updated);
    `);
  }

  /**
   * Set up default lookup providers
   */
  private setupDefaultProviders(): void {
    // Topic-based lookup provider
    this.addLookupProvider({
      providerId: 'topic_lookup',
      name: 'Topic Lookup',
      description: 'Query UTXOs by topic name',
      processQuery: async (query: { topic: string; limit?: number }) => {
        const utxos = this.brc22Service.getTopicUTXOs(query.topic, false);
        const limit = query.limit || 100;
        return utxos.slice(0, limit).map(utxo => ({
          topic: query.topic,
          txid: utxo.txid,
          vout: utxo.vout
        }));
      }
    });

    // Dataset search provider
    this.addLookupProvider({
      providerId: 'dataset_search',
      name: 'Dataset Search',
      description: 'Search for datasets by criteria',
      processQuery: async (query: {
        datasetId?: string;
        classification?: string;
        tags?: string[];
        limit?: number;
      }) => {
        return this.searchDatasets(query);
      },
      onUTXOAdded: (topic, txid, vout, outputScript, satoshis) => {
        if (topic.includes('dataset') || topic.includes('manifest')) {
          this.indexDatasetUTXO(topic, txid, vout, outputScript);
        }
      }
    });

    // Payment tracking provider
    this.addLookupProvider({
      providerId: 'payment_tracker',
      name: 'Payment Tracker',
      description: 'Track payment receipts and quotes',
      processQuery: async (query: {
        receiptId?: string;
        versionId?: string;
        status?: string;
        limit?: number;
      }) => {
        return this.searchPayments(query);
      },
      onUTXOAdded: (topic, txid, vout, outputScript, satoshis) => {
        if (topic.includes('payment')) {
          this.indexPaymentUTXO(topic, txid, vout, outputScript, satoshis);
        }
      }
    });

    // Agent services provider
    this.addLookupProvider({
      providerId: 'agent_services',
      name: 'Agent Services',
      description: 'Find available agents and their capabilities',
      processQuery: async (query: {
        agentId?: string;
        capability?: string;
        status?: string;
        limit?: number;
      }) => {
        return this.searchAgents(query);
      },
      onUTXOAdded: (topic, txid, vout, outputScript, satoshis) => {
        if (topic.includes('agent')) {
          this.indexAgentUTXO(topic, txid, vout, outputScript);
        }
      }
    });

    // Lineage tracker provider
    this.addLookupProvider({
      providerId: 'lineage_tracker',
      name: 'Lineage Tracker',
      description: 'Track data lineage and provenance',
      processQuery: async (query: {
        versionId?: string;
        datasetId?: string;
        depth?: number;
        direction?: 'upstream' | 'downstream' | 'both';
        limit?: number;
      }) => {
        return this.searchLineage(query);
      },
      onUTXOAdded: (topic, txid, vout, outputScript, satoshis) => {
        if (topic.includes('lineage') || topic.includes('provenance')) {
          this.indexLineageUTXO(topic, txid, vout, outputScript);
        }
      }
    });
  }

  /**
   * Set up event handlers for BRC-22 events
   */
  private setupBRC22EventHandlers(): void {
    // Handle new UTXOs being admitted
    this.brc22Service.on('transaction-processed', (event) => {
      for (const [topic, outputIndexes] of Object.entries(event.topics)) {
        for (const provider of this.lookupProviders.values()) {
          if (provider.onUTXOAdded) {
            const utxos = this.brc22Service.getTopicUTXOs(topic, false);
            for (const utxo of utxos) {
              if (outputIndexes.includes(utxo.vout)) {
                provider.onUTXOAdded(topic, utxo.txid, utxo.vout, utxo.outputScript, utxo.satoshis);
              }
            }
          }
        }
      }
    });

    // Handle UTXOs being spent
    this.brc22Service.on('utxo-spent', (event) => {
      for (const provider of this.lookupProviders.values()) {
        if (provider.onUTXOSpent) {
          provider.onUTXOSpent(event.topic, event.txid, event.vout);
        }
      }
    });
  }

  /**
   * Add a lookup provider
   */
  addLookupProvider(provider: LookupProvider): void {
    this.lookupProviders.set(provider.providerId, provider);
  }

  /**
   * Remove a lookup provider
   */
  removeLookupProvider(providerId: string): void {
    this.lookupProviders.delete(providerId);
  }

  /**
   * Process a BRC-24 lookup query
   */
  async processLookup(
    queryRequest: BRC24Query,
    requesterId?: string
  ): Promise<BRC24Response> {
    try {
      // Check if provider is supported
      const provider = this.lookupProviders.get(queryRequest.provider);
      if (!provider) {
        return {
          status: 'error',
          error: {
            code: 'ERR_LOOKUP_SERVICE_NOT_SUPPORTED',
            description: `Lookup provider '${queryRequest.provider}' is not supported on this node`
          }
        };
      }

      // Check payment requirements
      const paymentReq = await this.checkPaymentRequirement(queryRequest, requesterId);
      if (paymentReq.required) {
        return {
          status: 'error',
          error: {
            code: 'ERR_PAYMENT_REQUIRED',
            description: `Payment of ${paymentReq.amountSat} satoshis required: ${paymentReq.description}`
          }
        };
      }

      // Process the query
      const queryId = this.generateQueryId();
      const utxoIdentifiers = await provider.processQuery(queryRequest.query, requesterId);

      // Hydrate UTXOs with full information
      const utxos = await this.hydrateUTXOs(utxoIdentifiers);

      // Store query record
      await this.storeQueryRecord(queryId, queryRequest, requesterId, utxos.length);

      this.emit('lookup-processed', {
        queryId,
        provider: queryRequest.provider,
        results: utxos.length,
        requesterId
      });

      return {
        status: 'success',
        utxos
      };

    } catch (error) {
      console.error('BRC-24 lookup processing failed:', error);
      return {
        status: 'error',
        error: {
          code: 'ERR_LOOKUP_FAILED',
          description: error.message
        }
      };
    }
  }

  /**
   * Check payment requirements for a query
   */
  private async checkPaymentRequirement(
    queryRequest: BRC24Query,
    requesterId?: string
  ): Promise<PaymentRequirement> {
    // Simplified payment logic - in production this would be more sophisticated
    const provider = this.lookupProviders.get(queryRequest.provider);

    // Free providers
    if (provider?.providerId === 'topic_lookup') {
      return { required: false, amountSat: 0, description: 'Free topic lookup' };
    }

    // Paid providers based on query complexity
    let amountSat = 0;

    if (provider?.providerId === 'dataset_search') {
      amountSat = 100; // 100 sat for dataset search
    } else if (provider?.providerId === 'lineage_tracker') {
      amountSat = 200; // 200 sat for lineage tracking
    } else {
      amountSat = 50; // 50 sat for other queries
    }

    // For demo purposes, assume payment is always satisfied
    // In production, check actual payment status
    return {
      required: false, // Set to true to require payments
      amountSat,
      description: `Query processing fee for ${provider?.name || 'unknown service'}`
    };
  }

  /**
   * Hydrate UTXO identifiers with full BRC-36 information
   */
  private async hydrateUTXOs(
    identifiers: Array<{ topic: string; txid: string; vout: number }>
  ): Promise<BRC36UTXO[]> {
    const utxos: BRC36UTXO[] = [];

    for (const identifier of identifiers) {
      // Get UTXO from BRC-22 service
      const topicUTXOs = this.brc22Service.getTopicUTXOs(identifier.topic, false);
      const utxo = topicUTXOs.find(u => u.txid === identifier.txid && u.vout === identifier.vout);

      if (utxo) {
        // Get transaction record for additional data
        const txRecord = this.database.prepare(`
          SELECT * FROM brc22_transactions WHERE txid = ?
        `).get(identifier.txid);

        utxos.push({
          txid: utxo.txid,
          vout: utxo.vout,
          outputScript: utxo.outputScript,
          topic: identifier.topic,
          satoshis: utxo.satoshis,
          rawTx: txRecord?.raw_tx || '',
          proof: txRecord?.proof || undefined,
          inputs: txRecord?.inputs_json || undefined,
          mapiResponses: txRecord?.mapi_responses_json || undefined
        });
      }
    }

    return utxos;
  }

  /**
   * Store query record
   */
  private async storeQueryRecord(
    queryId: string,
    queryRequest: BRC24Query,
    requesterId: string | undefined,
    resultsCount: number
  ): Promise<void> {
    this.database.prepare(`
      INSERT INTO brc24_queries
      (query_id, provider, query_json, requester_identity, results_count, processed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      queryId,
      queryRequest.provider,
      JSON.stringify(queryRequest.query),
      requesterId || null,
      resultsCount,
      Date.now()
    );
  }

  // Provider-specific query implementations

  private async searchDatasets(query: {
    datasetId?: string;
    classification?: string;
    tags?: string[];
    limit?: number;
  }): Promise<Array<{ topic: string; txid: string; vout: number }>> {
    const results: Array<{ topic: string; txid: string; vout: number }> = [];
    const limit = query.limit || 50;

    // Search in dataset-related topics
    const topics = ['gitdata.d01a.manifest', 'gitdata.dataset.public', 'gitdata.dataset.commercial'];

    for (const topic of topics) {
      if (query.classification && !topic.includes(query.classification)) {
        continue;
      }

      const utxos = this.brc22Service.getTopicUTXOs(topic, false);
      for (const utxo of utxos) {
        // In production, parse output script to check dataset criteria
        // For now, include all UTXOs from relevant topics
        results.push({ topic, txid: utxo.txid, vout: utxo.vout });

        if (results.length >= limit) {
          return results;
        }
      }
    }

    return results;
  }

  private async searchPayments(query: {
    receiptId?: string;
    versionId?: string;
    status?: string;
    limit?: number;
  }): Promise<Array<{ topic: string; txid: string; vout: number }>> {
    const results: Array<{ topic: string; txid: string; vout: number }> = [];
    const limit = query.limit || 50;

    const topics = ['gitdata.payment.quotes', 'gitdata.payment.receipts'];

    for (const topic of topics) {
      const utxos = this.brc22Service.getTopicUTXOs(topic, false);
      for (const utxo of utxos) {
        results.push({ topic, txid: utxo.txid, vout: utxo.vout });

        if (results.length >= limit) {
          return results;
        }
      }
    }

    return results;
  }

  private async searchAgents(query: {
    agentId?: string;
    capability?: string;
    status?: string;
    limit?: number;
  }): Promise<Array<{ topic: string; txid: string; vout: number }>> {
    const results: Array<{ topic: string; txid: string; vout: number }> = [];
    const limit = query.limit || 50;

    const topics = ['gitdata.agent.registry', 'gitdata.agent.capabilities'];

    for (const topic of topics) {
      const utxos = this.brc22Service.getTopicUTXOs(topic, false);
      for (const utxo of utxos) {
        results.push({ topic, txid: utxo.txid, vout: utxo.vout });

        if (results.length >= limit) {
          return results;
        }
      }
    }

    return results;
  }

  private async searchLineage(query: {
    versionId?: string;
    datasetId?: string;
    depth?: number;
    direction?: 'upstream' | 'downstream' | 'both';
    limit?: number;
  }): Promise<Array<{ topic: string; txid: string; vout: number }>> {
    const results: Array<{ topic: string; txid: string; vout: number }> = [];
    const limit = query.limit || 50;

    const topics = ['gitdata.lineage.graph', 'gitdata.lineage.events', 'gitdata.provenance.chain'];

    for (const topic of topics) {
      const utxos = this.brc22Service.getTopicUTXOs(topic, false);
      for (const utxo of utxos) {
        results.push({ topic, txid: utxo.txid, vout: utxo.vout });

        if (results.length >= limit) {
          return results;
        }
      }
    }

    return results;
  }

  // Provider data indexing methods

  private indexDatasetUTXO(topic: string, txid: string, vout: number, outputScript: string): void {
    // Extract dataset information from output script and index it
    // This is a simplified implementation
    this.updateProviderData('dataset_search', topic, `${txid}:${vout}`, outputScript);
  }

  private indexPaymentUTXO(topic: string, txid: string, vout: number, outputScript: string, satoshis: number): void {
    // Index payment information
    this.updateProviderData('payment_tracker', topic, `${txid}:${vout}`, JSON.stringify({ outputScript, satoshis }));
  }

  private indexAgentUTXO(topic: string, txid: string, vout: number, outputScript: string): void {
    // Index agent information
    this.updateProviderData('agent_services', topic, `${txid}:${vout}`, outputScript);
  }

  private indexLineageUTXO(topic: string, txid: string, vout: number, outputScript: string): void {
    // Index lineage information
    this.updateProviderData('lineage_tracker', topic, `${txid}:${vout}`, outputScript);
  }

  private updateProviderData(providerId: string, topic: string, dataKey: string, dataValue: string): void {
    this.database.prepare(`
      INSERT OR REPLACE INTO brc24_provider_data
      (provider_id, topic, data_key, data_value, utxo_count, last_updated)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(providerId, topic, dataKey, dataValue, Date.now());
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): Array<{
    providerId: string;
    name: string;
    description: string;
  }> {
    return Array.from(this.lookupProviders.values()).map(provider => ({
      providerId: provider.providerId,
      name: provider.name,
      description: provider.description
    }));
  }

  /**
   * Get lookup statistics
   */
  getStats(): {
    providers: Record<string, { queries: number; recentQueries: number }>;
    totalQueries: number;
    indexedData: Record<string, number>;
  } {
    const providerStats: Record<string, { queries: number; recentQueries: number }> = {};

    for (const [providerId] of this.lookupProviders) {
      const queries = this.database.prepare(`
        SELECT COUNT(*) as count FROM brc24_queries WHERE provider = ?
      `).get(providerId)?.count || 0;

      const recentQueries = this.database.prepare(`
        SELECT COUNT(*) as count FROM brc24_queries
        WHERE provider = ? AND processed_at > ?
      `).get(providerId, Date.now() - 3600000)?.count || 0; // Last hour

      providerStats[providerId] = { queries, recentQueries };
    }

    const totalQueries = this.database.prepare(`
      SELECT COUNT(*) as count FROM brc24_queries
    `).get()?.count || 0;

    const indexedData: Record<string, number> = {};
    const providers = Array.from(this.lookupProviders.keys());
    for (const providerId of providers) {
      indexedData[providerId] = this.database.prepare(`
        SELECT COUNT(*) as count FROM brc24_provider_data WHERE provider_id = ?
      `).get(providerId)?.count || 0;
    }

    return {
      providers: providerStats,
      totalQueries,
      indexedData
    };
  }

  private generateQueryId(): string {
    return 'query_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}

export { BRC24LookupService };