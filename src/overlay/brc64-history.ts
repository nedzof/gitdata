// BRC-64: Overlay Network Transaction History Tracking
// Implements transaction history tracking with input preservation and lineage traversal

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { BRC22SubmitService } from './brc22-submit';
import { BRC24LookupService, BRC36UTXO } from './brc24-lookup';

export interface HistoricalUTXO extends BRC36UTXO {
  spentAt?: number;
  spentByTxid?: string;
  spentInTopic?: string;
  historicalInputs?: HistoricalInput[];
  lineageDepth?: number;
  parentUTXOs?: string[]; // Array of "txid:vout" references
  childUTXOs?: string[];  // Array of "txid:vout" references
}

export interface HistoricalInput {
  txid: string;
  vout: number;
  outputScript: string;
  satoshis: number;
  topic: string;
  rawTx: string;
  spentAt: number;
  spentByTxid: string;
  originalAdmittedAt: number;
}

export interface HistoryQuery {
  utxoId: string; // "txid:vout" format
  topic: string;
  depth?: number;
  direction?: 'backward' | 'forward' | 'both';
  includeSpent?: boolean;
  timeRange?: {
    start: number;
    end: number;
  };
}

export interface LineageGraph {
  nodes: Array<{
    utxoId: string;
    txid: string;
    vout: number;
    topic: string;
    satoshis: number;
    timestamp: number;
    status: 'active' | 'spent';
    metadata?: any;
  }>;
  edges: Array<{
    from: string; // utxoId
    to: string;   // utxoId
    relationship: 'input' | 'output' | 'topic_transfer';
    timestamp: number;
    txid: string;
  }>;
}

class BRC64HistoryService extends EventEmitter {
  private database: Database.Database;
  private brc22Service: BRC22SubmitService;
  private brc24Service: BRC24LookupService;

  constructor(
    database: Database.Database,
    brc22Service: BRC22SubmitService,
    brc24Service: BRC24LookupService
  ) {
    super();
    this.database = database;
    this.brc22Service = brc22Service;
    this.brc24Service = brc24Service;
    this.setupDatabase();
    this.setupEventHandlers();
  }

  /**
   * Set up database tables for BRC-64 history tracking
   */
  private setupDatabase(): void {
    // Historical inputs table
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS brc64_historical_inputs (
        input_id TEXT PRIMARY KEY, -- "spending_txid:input_index"
        spending_txid TEXT NOT NULL,
        input_index INTEGER NOT NULL,
        source_txid TEXT NOT NULL,
        source_vout INTEGER NOT NULL,
        topic TEXT NOT NULL,
        output_script TEXT NOT NULL,
        satoshis INTEGER NOT NULL,
        raw_tx TEXT NOT NULL,
        spent_at INTEGER NOT NULL,
        original_admitted_at INTEGER NOT NULL,
        metadata_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(spending_txid, input_index)
      )
    `);

    // UTXO lineage relationships
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS brc64_lineage_edges (
        edge_id TEXT PRIMARY KEY,
        parent_utxo TEXT NOT NULL, -- "txid:vout"
        child_utxo TEXT NOT NULL,  -- "txid:vout"
        relationship_type TEXT NOT NULL, -- 'input', 'output', 'topic_transfer'
        topic TEXT NOT NULL,
        connecting_txid TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(parent_utxo, child_utxo, relationship_type)
      )
    `);

    // Historical queries cache
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS brc64_history_cache (
        cache_key TEXT PRIMARY KEY,
        query_hash TEXT NOT NULL,
        result_json TEXT NOT NULL,
        expiry INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Indexes for performance
    this.database.exec(`
      CREATE INDEX IF NOT EXISTS idx_brc64_inputs_spending_txid ON brc64_historical_inputs(spending_txid);
      CREATE INDEX IF NOT EXISTS idx_brc64_inputs_source ON brc64_historical_inputs(source_txid, source_vout);
      CREATE INDEX IF NOT EXISTS idx_brc64_inputs_topic ON brc64_historical_inputs(topic);
      CREATE INDEX IF NOT EXISTS idx_brc64_inputs_spent_at ON brc64_historical_inputs(spent_at);

      CREATE INDEX IF NOT EXISTS idx_brc64_edges_parent ON brc64_lineage_edges(parent_utxo);
      CREATE INDEX IF NOT EXISTS idx_brc64_edges_child ON brc64_lineage_edges(child_utxo);
      CREATE INDEX IF NOT EXISTS idx_brc64_edges_topic ON brc64_lineage_edges(topic);
      CREATE INDEX IF NOT EXISTS idx_brc64_edges_timestamp ON brc64_lineage_edges(timestamp);

      CREATE INDEX IF NOT EXISTS idx_brc64_cache_expiry ON brc64_history_cache(expiry);
    `);
  }

  /**
   * Set up event handlers for BRC-22 transaction processing
   */
  private setupEventHandlers(): void {
    // Listen for transaction processing to capture inputs
    this.brc22Service.on('transaction-processed', async (event) => {
      await this.captureTransactionHistory(event.transaction, event.txid, event.topics);
    });

    // Listen for UTXO admissions to build lineage
    this.brc22Service.on('manifest-utxo-admitted', async (event) => {
      await this.buildLineageRelationships(event.txid, event.vout, 'gitdata.d01a.manifest');
    });

    this.brc22Service.on('payment-utxo-admitted', async (event) => {
      await this.buildLineageRelationships(event.txid, event.vout, 'gitdata.payment.receipts');
    });

    this.brc22Service.on('agent-utxo-admitted', async (event) => {
      await this.buildLineageRelationships(event.txid, event.vout, 'gitdata.agent.registry');
    });

    this.brc22Service.on('lineage-utxo-admitted', async (event) => {
      await this.buildLineageRelationships(event.txid, event.vout, 'gitdata.lineage.graph');
    });
  }

  /**
   * Capture transaction history when a transaction is processed
   */
  private async captureTransactionHistory(
    transaction: any,
    txid: string,
    admittedTopics: Record<string, number[]>
  ): Promise<void> {
    try {
      // Parse transaction inputs
      const inputs = this.parseTransactionInputs(transaction.rawTx);

      for (let inputIndex = 0; inputIndex < inputs.length; inputIndex++) {
        const input = inputs[inputIndex];

        // Check if this input was a tracked UTXO in any topic
        for (const [topic, outputIndexes] of Object.entries(admittedTopics)) {
          const trackedUTXOs = this.brc22Service.getTopicUTXOs(topic, true); // Include spent
          const sourceUTXO = trackedUTXOs.find(u =>
            u.txid === input.txid && u.vout === input.vout && u.spentByTxid === txid
          );

          if (sourceUTXO) {
            // Store historical input
            await this.storeHistoricalInput(
              txid,
              inputIndex,
              sourceUTXO,
              topic,
              transaction
            );
          }
        }
      }

      this.emit('history-captured', { txid, inputCount: inputs.length });

    } catch (error) {
      console.error('Failed to capture transaction history:', error);
    }
  }

  /**
   * Store a historical input
   */
  private async storeHistoricalInput(
    spendingTxid: string,
    inputIndex: number,
    sourceUTXO: any,
    topic: string,
    transaction: any
  ): Promise<void> {
    const inputId = `${spendingTxid}:${inputIndex}`;

    this.database.prepare(`
      INSERT OR REPLACE INTO brc64_historical_inputs
      (input_id, spending_txid, input_index, source_txid, source_vout, topic,
       output_script, satoshis, raw_tx, spent_at, original_admitted_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      inputId,
      spendingTxid,
      inputIndex,
      sourceUTXO.txid,
      sourceUTXO.vout,
      topic,
      sourceUTXO.outputScript,
      sourceUTXO.satoshis,
      transaction.rawTx,
      Date.now(),
      sourceUTXO.admittedAt,
      JSON.stringify({ topics: transaction.topics })
    );
  }

  /**
   * Build lineage relationships for newly admitted UTXOs
   */
  private async buildLineageRelationships(
    txid: string,
    vout: number,
    topic: string
  ): Promise<void> {
    try {
      const utxoId = `${txid}:${vout}`;

      // Find inputs that led to this UTXO
      const parentInputs = this.database.prepare(`
        SELECT * FROM brc64_historical_inputs
        WHERE spending_txid = ?
      `).all(txid);

      for (const parentInput of parentInputs) {
        const parentUtxoId = `${parentInput.source_txid}:${parentInput.source_vout}`;

        await this.createLineageEdge(
          parentUtxoId,
          utxoId,
          'input',
          topic,
          txid,
          { inputIndex: parentInput.input_index }
        );
      }

      // Find future outputs that spend this UTXO
      const futureSpends = this.database.prepare(`
        SELECT * FROM brc64_historical_inputs
        WHERE source_txid = ? AND source_vout = ?
      `).all(txid, vout);

      for (const futureSpend of futureSpends) {
        const childUtxoId = `${futureSpend.spending_txid}:0`; // Simplified - assume first output

        await this.createLineageEdge(
          utxoId,
          childUtxoId,
          'output',
          topic,
          futureSpend.spending_txid,
          { spentAt: futureSpend.spent_at }
        );
      }

      this.emit('lineage-built', { utxoId, topic });

    } catch (error) {
      console.error('Failed to build lineage relationships:', error);
    }
  }

  /**
   * Create a lineage edge between two UTXOs
   */
  private async createLineageEdge(
    parentUtxo: string,
    childUtxo: string,
    relationshipType: 'input' | 'output' | 'topic_transfer',
    topic: string,
    connectingTxid: string,
    metadata?: any
  ): Promise<void> {
    const edgeId = `${parentUtxo}_${childUtxo}_${relationshipType}`;

    this.database.prepare(`
      INSERT OR REPLACE INTO brc64_lineage_edges
      (edge_id, parent_utxo, child_utxo, relationship_type, topic, connecting_txid, timestamp, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      edgeId,
      parentUtxo,
      childUtxo,
      relationshipType,
      topic,
      connectingTxid,
      Date.now(),
      JSON.stringify(metadata || {})
    );
  }

  /**
   * Query UTXO history
   */
  async queryHistory(query: HistoryQuery): Promise<HistoricalUTXO[]> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(query);
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      const results: HistoricalUTXO[] = [];
      const visited = new Set<string>();
      const maxDepth = query.depth || 10;

      // Start with the requested UTXO
      await this.traverseHistory(
        query.utxoId,
        query.topic,
        query.direction || 'both',
        0,
        maxDepth,
        visited,
        results,
        query
      );

      // Cache the results
      this.cacheResult(cacheKey, results);

      return results;

    } catch (error) {
      console.error('Failed to query history:', error);
      return [];
    }
  }

  /**
   * Recursively traverse UTXO history
   */
  private async traverseHistory(
    utxoId: string,
    topic: string,
    direction: 'backward' | 'forward' | 'both',
    currentDepth: number,
    maxDepth: number,
    visited: Set<string>,
    results: HistoricalUTXO[],
    query: HistoryQuery
  ): Promise<void> {
    if (currentDepth >= maxDepth || visited.has(utxoId)) {
      return;
    }

    visited.add(utxoId);

    // Get the UTXO details
    const [txid, vout] = utxoId.split(':');
    const utxo = await this.getUTXODetails(txid, parseInt(vout), topic);

    if (!utxo) {
      return;
    }

    // Apply time range filter
    if (query.timeRange) {
      const timestamp = utxo.timestamp || 0;
      if (timestamp < query.timeRange.start || timestamp > query.timeRange.end) {
        return;
      }
    }

    // Get historical inputs for this UTXO
    const historicalInputs = await this.getHistoricalInputs(txid);
    utxo.historicalInputs = historicalInputs;
    utxo.lineageDepth = currentDepth;

    // Get parent and child relationships
    utxo.parentUTXOs = await this.getParentUTXOs(utxoId);
    utxo.childUTXOs = await this.getChildUTXOs(utxoId);

    results.push(utxo);

    // Traverse backward (inputs/parents)
    if (direction === 'backward' || direction === 'both') {
      for (const parentUtxoId of utxo.parentUTXOs || []) {
        await this.traverseHistory(
          parentUtxoId,
          topic,
          direction,
          currentDepth + 1,
          maxDepth,
          visited,
          results,
          query
        );
      }
    }

    // Traverse forward (outputs/children)
    if (direction === 'forward' || direction === 'both') {
      for (const childUtxoId of utxo.childUTXOs || []) {
        await this.traverseHistory(
          childUtxoId,
          topic,
          direction,
          currentDepth + 1,
          maxDepth,
          visited,
          results,
          query
        );
      }
    }
  }

  /**
   * Get UTXO details
   */
  private async getUTXODetails(txid: string, vout: number, topic: string): Promise<HistoricalUTXO | null> {
    // First check active UTXOs
    const activeUTXOs = this.brc22Service.getTopicUTXOs(topic, false);
    let utxo = activeUTXOs.find(u => u.txid === txid && u.vout === vout);

    if (!utxo) {
      // Check spent UTXOs
      const spentUTXOs = this.brc22Service.getTopicUTXOs(topic, true);
      utxo = spentUTXOs.find(u => u.txid === txid && u.vout === vout);
    }

    if (!utxo) {
      return null;
    }

    // Get transaction details
    const txRecord = this.database.prepare(`
      SELECT * FROM brc22_transactions WHERE txid = ?
    `).get(txid);

    return {
      txid: utxo.txid,
      vout: utxo.vout,
      outputScript: utxo.outputScript,
      topic,
      satoshis: utxo.satoshis,
      rawTx: txRecord?.raw_tx || '',
      proof: txRecord?.proof || undefined,
      inputs: txRecord?.inputs_json || undefined,
      mapiResponses: txRecord?.mapi_responses_json || undefined,
      spentAt: utxo.spentAt,
      spentByTxid: utxo.spentByTxid,
      timestamp: utxo.admittedAt
    };
  }

  /**
   * Get historical inputs for a transaction
   */
  private async getHistoricalInputs(txid: string): Promise<HistoricalInput[]> {
    const inputs = this.database.prepare(`
      SELECT * FROM brc64_historical_inputs
      WHERE spending_txid = ?
      ORDER BY input_index
    `).all(txid);

    return inputs.map(input => ({
      txid: input.source_txid,
      vout: input.source_vout,
      outputScript: input.output_script,
      satoshis: input.satoshis,
      topic: input.topic,
      rawTx: input.raw_tx,
      spentAt: input.spent_at,
      spentByTxid: input.spending_txid,
      originalAdmittedAt: input.original_admitted_at
    }));
  }

  /**
   * Get parent UTXOs
   */
  private async getParentUTXOs(utxoId: string): Promise<string[]> {
    const edges = this.database.prepare(`
      SELECT parent_utxo FROM brc64_lineage_edges
      WHERE child_utxo = ?
    `).all(utxoId);

    return edges.map(edge => edge.parent_utxo);
  }

  /**
   * Get child UTXOs
   */
  private async getChildUTXOs(utxoId: string): Promise<string[]> {
    const edges = this.database.prepare(`
      SELECT child_utxo FROM brc64_lineage_edges
      WHERE parent_utxo = ?
    `).all(utxoId);

    return edges.map(edge => edge.child_utxo);
  }

  /**
   * Generate lineage graph
   */
  async generateLineageGraph(
    startUtxoId: string,
    topic: string,
    maxDepth: number = 5
  ): Promise<LineageGraph> {
    const history = await this.queryHistory({
      utxoId: startUtxoId,
      topic,
      depth: maxDepth,
      direction: 'both'
    });

    const nodes = history.map(utxo => ({
      utxoId: `${utxo.txid}:${utxo.vout}`,
      txid: utxo.txid,
      vout: utxo.vout,
      topic: utxo.topic,
      satoshis: utxo.satoshis,
      timestamp: utxo.timestamp || 0,
      status: utxo.spentAt ? 'spent' as const : 'active' as const,
      metadata: {
        lineageDepth: utxo.lineageDepth,
        historicalInputsCount: utxo.historicalInputs?.length || 0
      }
    }));

    const edges: LineageGraph['edges'] = [];
    const edgeRecords = this.database.prepare(`
      SELECT * FROM brc64_lineage_edges
      WHERE parent_utxo IN (${history.map(() => '?').join(',')})
         OR child_utxo IN (${history.map(() => '?').join(',')})
    `).all(
      ...history.map(u => `${u.txid}:${u.vout}`),
      ...history.map(u => `${u.txid}:${u.vout}`)
    );

    for (const edge of edgeRecords) {
      edges.push({
        from: edge.parent_utxo,
        to: edge.child_utxo,
        relationship: edge.relationship_type,
        timestamp: edge.timestamp,
        txid: edge.connecting_txid
      });
    }

    return { nodes, edges };
  }

  /**
   * Get history statistics
   */
  getStats(): {
    historicalInputs: number;
    lineageEdges: number;
    trackedTransactions: number;
    cacheHitRate: number;
  } {
    const historicalInputs = this.database.prepare(`
      SELECT COUNT(*) as count FROM brc64_historical_inputs
    `).get()?.count || 0;

    const lineageEdges = this.database.prepare(`
      SELECT COUNT(*) as count FROM brc64_lineage_edges
    `).get()?.count || 0;

    const trackedTransactions = this.database.prepare(`
      SELECT COUNT(DISTINCT spending_txid) as count FROM brc64_historical_inputs
    `).get()?.count || 0;

    // Cache hit rate calculation would require tracking cache hits/misses
    const cacheHitRate = 0.75; // Placeholder

    return {
      historicalInputs,
      lineageEdges,
      trackedTransactions,
      cacheHitRate
    };
  }

  // Helper methods

  private parseTransactionInputs(rawTx: string): Array<{ txid: string; vout: number }> {
    // Simplified input parsing - in production use proper Bitcoin transaction parser
    return [
      { txid: 'abc123', vout: 0 },
      { txid: 'def456', vout: 1 }
    ];
  }

  private generateCacheKey(query: HistoryQuery): string {
    return require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(query))
      .digest('hex')
      .substring(0, 16);
  }

  private getCachedResult(cacheKey: string): HistoricalUTXO[] | null {
    const cached = this.database.prepare(`
      SELECT result_json FROM brc64_history_cache
      WHERE cache_key = ? AND expiry > ?
    `).get(cacheKey, Date.now());

    return cached ? JSON.parse(cached.result_json) : null;
  }

  private cacheResult(cacheKey: string, results: HistoricalUTXO[]): void {
    const expiry = Date.now() + (30 * 60 * 1000); // 30 minutes

    this.database.prepare(`
      INSERT OR REPLACE INTO brc64_history_cache
      (cache_key, query_hash, result_json, expiry)
      VALUES (?, ?, ?, ?)
    `).run(
      cacheKey,
      cacheKey,
      JSON.stringify(results),
      expiry
    );
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache(): number {
    const result = this.database.prepare(`
      DELETE FROM brc64_history_cache WHERE expiry < ?
    `).run(Date.now());

    return result.changes;
  }
}

export { BRC64HistoryService };