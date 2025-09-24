// BRC-24: Overlay Network Lookup Services
// Implements standardized lookup services for querying overlay state

import { EventEmitter } from 'events';

import type { BRC22SubmitService } from './brc22-submit';
import type { DatabaseAdapter } from './brc26-uhrp';

// ==================== Query Builder Helper ====================

interface TableColumn {
  name: string;
  type: string;
  constraints?: string[];
}

interface TableDefinition {
  name: string;
  columns: TableColumn[];
  constraints?: string[];
}

class QueryBuilder {
  static insert(
    table: string,
    data: Record<string, any>,
    onConflict?: string,
  ): { query: string; params: any[] } {
    const keys = Object.keys(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`);
    const params = Object.values(data);

    let query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;

    if (onConflict) {
      query += ` ${onConflict}`;
    }

    return { query, params };
  }

  static update(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>,
  ): { query: string; params: any[] } {
    const setClause = Object.keys(data)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    const params = [...Object.values(data)];

    const whereClause = Object.keys(where)
      .map((key, index) => {
        params.push(where[key]);
        return `${key} = $${params.length}`;
      })
      .join(' AND ');

    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    return { query, params };
  }

  static selectWithOptions(
    table: string,
    options: {
      columns?: string[];
      where?: Record<string, any>;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
      limit?: number;
      offset?: number;
    } = {},
  ): { query: string; params: any[] } {
    const columns = options.columns || ['*'];
    const cols = columns.join(', ');
    let query = `SELECT ${cols} FROM ${table}`;
    const params: any[] = [];

    if (options.where) {
      const conditions = Object.keys(options.where).map((key, index) => {
        params.push(options.where![key]);
        return `${key} = $${index + 1}`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
      if (options.orderDirection) {
        query += ` ${options.orderDirection}`;
      }
    }

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    return { query, params };
  }

  static count(table: string, where?: Record<string, any>): { query: string; params: any[] } {
    let query = `SELECT COUNT(*) as count FROM ${table}`;
    const params: any[] = [];

    if (where) {
      const conditions = Object.keys(where).map((key, index) => {
        params.push(where[key]);
        return `${key} = $${index + 1}`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    return { query, params };
  }

  static countWithCondition(
    table: string,
    condition: string,
    params: any[] = [],
  ): { query: string; params: any[] } {
    const query = `SELECT COUNT(*) as count FROM ${table} WHERE ${condition}`;
    return { query, params };
  }

  static selectWithCustomWhere(
    table: string,
    columns: string[],
    whereCondition: string,
    params: any[] = [],
    options: {
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
      limit?: number;
      offset?: number;
    } = {},
  ): { query: string; params: any[] } {
    const cols = columns.join(', ');
    let query = `SELECT ${cols} FROM ${table} WHERE ${whereCondition}`;

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
      if (options.orderDirection) {
        query += ` ${options.orderDirection}`;
      }
    }

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    return { query, params };
  }
}

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
  processQuery: (
    query: any,
    requesterId?: string,
  ) => Promise<
    Array<{
      topic: string;
      txid: string;
      vout: number;
    }>
  >;
  onUTXOAdded?: (
    topic: string,
    txid: string,
    vout: number,
    outputScript: string,
    satoshis: number,
  ) => void;
  onUTXOSpent?: (topic: string, txid: string, vout: number) => void;
}

export interface PaymentRequirement {
  required: boolean;
  amountSat: number;
  description: string;
  receiptTemplate?: any;
}

class BRC24LookupService extends EventEmitter {
  private database: DatabaseAdapter;
  private brc22Service: BRC22SubmitService;
  private lookupProviders = new Map<string, LookupProvider>();

  constructor(database: DatabaseAdapter, brc22Service: BRC22SubmitService) {
    super();
    this.database = database;
    this.brc22Service = brc22Service;
    this.setupDatabase();
    this.setupDefaultProviders();
    this.setupBRC22EventHandlers();
  }

  /**
   * Database tables are now created in the main schema at /src/db/postgresql-schema-complete.sql
   * This method is kept for compatibility but no longer creates tables
   */
  private setupDatabase(): void {
    // Tables are now created centrally in the main database schema
    // BRC-24 tables: brc24_queries, brc24_provider_data
    console.log('BRC-24 database tables managed by central schema');
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
        const utxos = await this.brc22Service.getTopicUTXOs(query.topic, false);
        const limit = query.limit || 100;
        return utxos.slice(0, limit).map((utxo) => ({
          topic: query.topic,
          txid: utxo.txid,
          vout: utxo.vout,
        }));
      },
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
        if (topic.includes('dataset') || topic.includes('asset')) {
          this.indexDatasetUTXO(topic, txid, vout, outputScript);
        }
      },
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
      },
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
      },
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
      },
    });
  }

  /**
   * Set up event handlers for BRC-22 events
   */
  private setupBRC22EventHandlers(): void {
    // Handle new UTXOs being admitted
    this.brc22Service.on('transaction-processed', async (event) => {
      for (const [topic, outputIndexes] of Object.entries(event.topics)) {
        for (const provider of Array.from(this.lookupProviders.values())) {
          if (provider.onUTXOAdded) {
            const utxos = await this.brc22Service.getTopicUTXOs(topic, false);
            for (const utxo of utxos) {
              if (Array.isArray(outputIndexes) && outputIndexes.includes(utxo.vout)) {
                provider.onUTXOAdded(topic, utxo.txid, utxo.vout, utxo.outputScript, utxo.satoshis);
              }
            }
          }
        }
      }
    });

    // Handle UTXOs being spent
    this.brc22Service.on('utxo-spent', (event) => {
      for (const provider of Array.from(this.lookupProviders.values())) {
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
  async processLookup(queryRequest: BRC24Query, requesterId?: string): Promise<BRC24Response> {
    try {
      // Check if provider is supported
      const provider = this.lookupProviders.get(queryRequest.provider);
      if (!provider) {
        return {
          status: 'error',
          error: {
            code: 'ERR_LOOKUP_SERVICE_NOT_SUPPORTED',
            description: `Lookup provider '${queryRequest.provider}' is not supported on this node`,
          },
        };
      }

      // Check payment requirements
      const paymentReq = await this.checkPaymentRequirement(queryRequest, requesterId);
      if (paymentReq.required) {
        return {
          status: 'error',
          error: {
            code: 'ERR_PAYMENT_REQUIRED',
            description: `Payment of ${paymentReq.amountSat} satoshis required: ${paymentReq.description}`,
          },
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
        requesterId,
      });

      return {
        status: 'success',
        utxos,
      };
    } catch (error) {
      console.error('BRC-24 lookup processing failed:', error);
      return {
        status: 'error',
        error: {
          code: 'ERR_LOOKUP_FAILED',
          description: (error as Error).message,
        },
      };
    }
  }

  /**
   * Check payment requirements for a query
   */
  private async checkPaymentRequirement(
    queryRequest: BRC24Query,
    requesterId?: string,
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
      description: `Query processing fee for ${provider?.name || 'unknown service'}`,
    };
  }

  /**
   * Hydrate UTXO identifiers with full BRC-36 information
   */
  private async hydrateUTXOs(
    identifiers: Array<{ topic: string; txid: string; vout: number }>,
  ): Promise<BRC36UTXO[]> {
    const utxos: BRC36UTXO[] = [];

    for (const identifier of identifiers) {
      // Get UTXO from BRC-22 service
      const topicUTXOs = await this.brc22Service.getTopicUTXOs(identifier.topic, false);
      const utxo = topicUTXOs.find((u) => u.txid === identifier.txid && u.vout === identifier.vout);

      if (utxo) {
        // Get transaction record for additional data
        const { query, params } = QueryBuilder.selectWithOptions('brc22_transactions', {
          where: { txid: identifier.txid },
        });
        const txRecord = await this.database.queryOne(query, params);

        utxos.push({
          txid: utxo.txid,
          vout: utxo.vout,
          outputScript: utxo.outputScript,
          topic: identifier.topic,
          satoshis: utxo.satoshis,
          rawTx: txRecord?.raw_tx || '',
          proof: txRecord?.proof || undefined,
          inputs: txRecord?.inputs_json || undefined,
          mapiResponses: txRecord?.mapi_responses_json || undefined,
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
    resultsCount: number,
  ): Promise<void> {
    const queryData = {
      query_id: queryId,
      provider: queryRequest.provider,
      query_json: JSON.stringify(queryRequest.query),
      requester_identity: requesterId || null,
      results_count: resultsCount,
      processed_at: Date.now(),
    };

    const onConflict = `ON CONFLICT (query_id) DO UPDATE SET
        provider = EXCLUDED.provider,
        query_json = EXCLUDED.query_json,
        requester_identity = EXCLUDED.requester_identity,
        results_count = EXCLUDED.results_count,
        processed_at = EXCLUDED.processed_at`;

    const { query, params } = QueryBuilder.insert('brc24_queries', queryData, onConflict);
    await this.database.execute(query, params);
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
    const topics = ['gitdata.d01a.asset', 'gitdata.dataset.public', 'gitdata.dataset.commercial'];

    for (const topic of topics) {
      if (query.classification && !topic.includes(query.classification)) {
        continue;
      }

      const utxos = await this.brc22Service.getTopicUTXOs(topic, false);
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
      const utxos = await this.brc22Service.getTopicUTXOs(topic, false);
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
      const utxos = await this.brc22Service.getTopicUTXOs(topic, false);
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
      const utxos = await this.brc22Service.getTopicUTXOs(topic, false);
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

  private async indexDatasetUTXO(
    topic: string,
    txid: string,
    vout: number,
    outputScript: string,
  ): Promise<void> {
    // Extract dataset information from output script and index it
    // This is a simplified implementation
    await this.updateProviderData('dataset_search', topic, `${txid}:${vout}`, outputScript);
  }

  private async indexPaymentUTXO(
    topic: string,
    txid: string,
    vout: number,
    outputScript: string,
    satoshis: number,
  ): Promise<void> {
    // Index payment information
    await this.updateProviderData(
      'payment_tracker',
      topic,
      `${txid}:${vout}`,
      JSON.stringify({ outputScript, satoshis }),
    );
  }

  private async indexAgentUTXO(
    topic: string,
    txid: string,
    vout: number,
    outputScript: string,
  ): Promise<void> {
    // Index agent information
    await this.updateProviderData('agent_services', topic, `${txid}:${vout}`, outputScript);
  }

  private async indexLineageUTXO(
    topic: string,
    txid: string,
    vout: number,
    outputScript: string,
  ): Promise<void> {
    // Index lineage information
    await this.updateProviderData('lineage_tracker', topic, `${txid}:${vout}`, outputScript);
  }

  private async updateProviderData(
    providerId: string,
    topic: string,
    dataKey: string,
    dataValue: string,
  ): Promise<void> {
    const providerData = {
      provider_id: providerId,
      topic: topic,
      data_key: dataKey,
      data_value: dataValue,
      utxo_count: 1,
      last_updated: Date.now(),
    };

    const onConflict = `ON CONFLICT (provider_id, topic, data_key) DO UPDATE SET
        data_value = EXCLUDED.data_value,
        utxo_count = EXCLUDED.utxo_count,
        last_updated = EXCLUDED.last_updated`;

    const { query, params } = QueryBuilder.insert('brc24_provider_data', providerData, onConflict);
    await this.database.execute(query, params);
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): Array<{
    providerId: string;
    name: string;
    description: string;
  }> {
    return Array.from(this.lookupProviders.values()).map((provider) => ({
      providerId: provider.providerId,
      name: provider.name,
      description: provider.description,
    }));
  }

  /**
   * Get lookup statistics
   */
  async getStats(): Promise<{
    providers: Record<string, { queries: number; recentQueries: number }>;
    totalQueries: number;
    indexedData: Record<string, number>;
  }> {
    const providerStats: Record<string, { queries: number; recentQueries: number }> = {};

    for (const [providerId] of Array.from(this.lookupProviders.entries())) {
      const queriesQuery = QueryBuilder.count('brc24_queries', { provider: providerId });
      const recentQueriesQuery = QueryBuilder.countWithCondition(
        'brc24_queries',
        'provider = $1 AND processed_at > $2',
        [providerId, Date.now() - 3600000], // Last hour
      );

      const queriesResult = await this.database.queryOne(queriesQuery.query, queriesQuery.params);
      const queries = queriesResult?.count || 0;

      const recentQueriesResult = await this.database.queryOne(
        recentQueriesQuery.query,
        recentQueriesQuery.params,
      );
      const recentQueries = recentQueriesResult?.count || 0;

      providerStats[providerId] = { queries, recentQueries };
    }

    const totalQueriesQuery = QueryBuilder.count('brc24_queries');
    const totalQueriesResult = await this.database.queryOne(
      totalQueriesQuery.query,
      totalQueriesQuery.params,
    );
    const totalQueries = totalQueriesResult?.count || 0;

    const indexedData: Record<string, number> = {};
    const providers = Array.from(this.lookupProviders.keys());
    for (const providerId of providers) {
      const indexedQuery = QueryBuilder.count('brc24_provider_data', { provider_id: providerId });
      const indexedResult = await this.database.queryOne(indexedQuery.query, indexedQuery.params);
      indexedData[providerId] = indexedResult?.count || 0;
    }

    return {
      providers: providerStats,
      totalQueries,
      indexedData,
    };
  }

  private generateQueryId(): string {
    return 'query_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}

export { BRC24LookupService };
