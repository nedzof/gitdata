// BRC-22: Overlay Network Data Synchronization
// Implements standardized transaction submission with topic-based UTXO tracking

import { EventEmitter } from 'events';
import { DatabaseAdapter } from './brc26-uhrp';
import { walletService } from '../../ui/src/lib/wallet';

export interface BRC22Transaction {
  rawTx: string;
  inputs: Record<string, BRC22Input>;
  mapiResponses?: Array<{
    payload: string;
    signature: string;
    publicKey: string;
  }>;
  proof?: string;
  topics: string[];
}

export interface BRC22Input {
  proof?: {
    flags: number;
    index: number;
    txOrId: string;
    target: string;
    nodes: string[];
    targetType: string;
  };
  rawTx: string;
}

export interface BRC22Response {
  status: 'success' | 'error';
  topics?: Record<string, number[]>;
  error?: {
    code: string;
    description: string;
  };
}

export interface TopicManager {
  topicName: string;
  admittanceLogic: (transaction: BRC22Transaction, outputIndex: number) => boolean;
  spentInputLogic?: (inputTxid: string, inputVout: number) => boolean;
  onOutputAdmitted?: (txid: string, vout: number, outputScript: string, satoshis: number) => void;
  onInputSpent?: (txid: string, vout: number) => void;
}

class BRC22SubmitService extends EventEmitter {
  private database: DatabaseAdapter;
  private topicManagers = new Map<string, TopicManager>();
  private trackedUTXOs = new Map<string, Set<string>>(); // topic -> set of "txid:vout"

  constructor(database: DatabaseAdapter) {
    super();
    this.database = database;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.setupDatabase();
    this.setupDefaultTopicManagers();
  }

  /**
   * Set up database tables for BRC-22 UTXO tracking
   */
  private async setupDatabase(): Promise<void> {
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS brc22_utxos (
        id SERIAL PRIMARY KEY,
        utxo_id TEXT UNIQUE NOT NULL, -- txid:vout format
        topic TEXT NOT NULL,
        txid TEXT NOT NULL,
        vout INTEGER NOT NULL,
        output_script TEXT NOT NULL,
        satoshis BIGINT NOT NULL,
        admitted_at BIGINT NOT NULL,
        spent_at BIGINT,
        spent_by_txid TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(topic, txid, vout)
      )
    `);

    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS brc22_transactions (
        id SERIAL PRIMARY KEY,
        txid TEXT UNIQUE NOT NULL,
        raw_tx TEXT NOT NULL,
        topics_json TEXT NOT NULL,
        inputs_json TEXT,
        mapi_responses_json TEXT,
        proof TEXT,
        processed_at BIGINT NOT NULL,
        status TEXT DEFAULT 'success',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.database.execute(`
      CREATE INDEX IF NOT EXISTS idx_brc22_utxos_topic ON brc22_utxos(topic);
      CREATE INDEX IF NOT EXISTS idx_brc22_utxos_spent ON brc22_utxos(spent_at);
      CREATE INDEX IF NOT EXISTS idx_brc22_utxos_txid_vout ON brc22_utxos(txid, vout);
      CREATE INDEX IF NOT EXISTS idx_brc22_transactions_processed ON brc22_transactions(processed_at);
    `);
  }

  /**
   * Set up default topic managers for common Gitdata use cases
   */
  private setupDefaultTopicManagers(): void {
    // D01A Manifest topic manager
    this.addTopicManager({
      topicName: 'gitdata.d01a.manifest',
      admittanceLogic: (tx, outputIndex) => {
        // Admit outputs that contain D01A manifest data
        return this.isD01AManifestOutput(tx, outputIndex);
      },
      onOutputAdmitted: (txid, vout, outputScript, satoshis) => {
        this.emit('manifest-utxo-admitted', { txid, vout, outputScript, satoshis });
      }
    });

    // Payment receipts topic manager
    this.addTopicManager({
      topicName: 'gitdata.payment.receipts',
      admittanceLogic: (tx, outputIndex) => {
        return this.isPaymentReceiptOutput(tx, outputIndex);
      },
      onOutputAdmitted: (txid, vout, outputScript, satoshis) => {
        this.emit('payment-utxo-admitted', { txid, vout, outputScript, satoshis });
      }
    });

    // Agent registry topic manager
    this.addTopicManager({
      topicName: 'gitdata.agent.registry',
      admittanceLogic: (tx, outputIndex) => {
        return this.isAgentRegistryOutput(tx, outputIndex);
      },
      onOutputAdmitted: (txid, vout, outputScript, satoshis) => {
        this.emit('agent-utxo-admitted', { txid, vout, outputScript, satoshis });
      }
    });

    // Lineage tracking topic manager
    this.addTopicManager({
      topicName: 'gitdata.lineage.graph',
      admittanceLogic: (tx, outputIndex) => {
        return this.isLineageOutput(tx, outputIndex);
      },
      onOutputAdmitted: (txid, vout, outputScript, satoshis) => {
        this.emit('lineage-utxo-admitted', { txid, vout, outputScript, satoshis });
      }
    });
  }

  /**
   * Add a topic manager
   */
  addTopicManager(manager: TopicManager): void {
    this.topicManagers.set(manager.topicName, manager);
    this.trackedUTXOs.set(manager.topicName, new Set());
  }

  /**
   * Remove a topic manager
   */
  removeTopicManager(topicName: string): void {
    this.topicManagers.delete(topicName);
    this.trackedUTXOs.delete(topicName);
  }

  /**
   * Process a BRC-22 transaction submission
   */
  async processSubmission(transaction: BRC22Transaction, senderIdentity?: string): Promise<BRC22Response> {
    try {
      // 1. Verify BRC-31 identity (simplified - in production you'd do full verification)
      if (!senderIdentity && !walletService.isConnected()) {
        return {
          status: 'error',
          error: {
            code: 'ERR_IDENTITY_REQUIRED',
            description: 'BRC-31 identity verification required for transaction submission'
          }
        };
      }

      // 2. Check if we host any of the requested topics
      const hostedTopics = transaction.topics.filter(topic => this.topicManagers.has(topic));
      if (hostedTopics.length === 0) {
        return {
          status: 'success',
          topics: {}
        };
      }

      // 3. Verify transaction envelope (simplified SPV verification)
      const isValid = await this.verifyTransactionEnvelope(transaction);
      if (!isValid) {
        return {
          status: 'error',
          error: {
            code: 'ERR_INVALID_TRANSACTION',
            description: 'Transaction envelope verification failed'
          }
        };
      }

      // 4. Apply topic-specific logic
      const admittedOutputs: Record<string, number[]> = {};
      const txid = this.calculateTxid(transaction.rawTx);

      for (const topic of hostedTopics) {
        const manager = this.topicManagers.get(topic)!;
        const admittedIndexes: number[] = [];

        // Check inputs for spent UTXOs
        await this.processSpentInputs(transaction, topic, manager);

        // Check outputs for admittance
        const outputs = this.parseTransactionOutputs(transaction.rawTx);
        for (let i = 0; i < outputs.length; i++) {
          if (manager.admittanceLogic(transaction, i)) {
            admittedIndexes.push(i);
            await this.admitOutput(topic, txid, i, outputs[i], manager);
          }
        }

        if (admittedIndexes.length > 0) {
          admittedOutputs[topic] = admittedIndexes;
        }
      }

      // 5. Store transaction record
      await this.storeTransactionRecord(transaction, txid);

      // 6. Emit events for admitted outputs
      this.emit('transaction-processed', {
        txid,
        topics: admittedOutputs,
        transaction
      });

      return {
        status: 'success',
        topics: admittedOutputs
      };

    } catch (error) {
      console.error('BRC-22 transaction processing failed:', error);
      return {
        status: 'error',
        error: {
          code: 'ERR_PROCESSING_FAILED',
          description: error.message
        }
      };
    }
  }

  /**
   * Process spent inputs for a topic
   */
  private async processSpentInputs(
    transaction: BRC22Transaction,
    topic: string,
    manager: TopicManager
  ): Promise<void> {
    const inputs = this.parseTransactionInputs(transaction.rawTx);

    for (const input of inputs) {
      const utxoId = `${input.txid}:${input.vout}`;
      const trackedUTXOs = this.trackedUTXOs.get(topic);

      if (trackedUTXOs?.has(utxoId)) {
        // Mark UTXO as spent
        await this.markUTXOSpent(topic, input.txid, input.vout, this.calculateTxid(transaction.rawTx));

        // Call manager's spent input logic
        if (manager.spentInputLogic) {
          manager.spentInputLogic(input.txid, input.vout);
        }

        // Call manager's onInputSpent callback
        if (manager.onInputSpent) {
          manager.onInputSpent(input.txid, input.vout);
        }

        // Remove from tracked UTXOs
        trackedUTXOs.delete(utxoId);
      }
    }
  }

  /**
   * Admit an output to a topic
   */
  private async admitOutput(
    topic: string,
    txid: string,
    vout: number,
    output: { script: string; satoshis: number },
    manager: TopicManager
  ): Promise<void> {
    const utxoId = `${txid}:${vout}`;

    // Store in database
    this.database.prepare(`
      INSERT OR REPLACE INTO brc22_utxos
      (utxo_id, topic, txid, vout, output_script, satoshis, admitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      utxoId,
      topic,
      txid,
      vout,
      output.script,
      output.satoshis,
      Date.now()
    );

    // Add to tracked UTXOs
    this.trackedUTXOs.get(topic)?.add(utxoId);

    // Call manager's onOutputAdmitted callback
    if (manager.onOutputAdmitted) {
      manager.onOutputAdmitted(txid, vout, output.script, output.satoshis);
    }
  }

  /**
   * Mark UTXO as spent
   */
  private async markUTXOSpent(topic: string, txid: string, vout: number, spentByTxid: string): Promise<void> {
    this.database.prepare(`
      UPDATE brc22_utxos
      SET spent_at = ?, spent_by_txid = ?
      WHERE topic = ? AND txid = ? AND vout = ?
    `).run(Date.now(), spentByTxid, topic, txid, vout);
  }

  /**
   * Store transaction record
   */
  private async storeTransactionRecord(transaction: BRC22Transaction, txid: string): Promise<void> {
    this.database.prepare(`
      INSERT OR REPLACE INTO brc22_transactions
      (txid, raw_tx, topics_json, inputs_json, mapi_responses_json, proof, processed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      txid,
      transaction.rawTx,
      JSON.stringify(transaction.topics),
      JSON.stringify(transaction.inputs || {}),
      JSON.stringify(transaction.mapiResponses || []),
      transaction.proof || null,
      Date.now()
    );
  }

  /**
   * Get UTXOs for a topic
   */
  getTopicUTXOs(topic: string, includeSpent: boolean = false): Array<{
    utxoId: string;
    txid: string;
    vout: number;
    outputScript: string;
    satoshis: number;
    admittedAt: number;
    spentAt?: number;
    spentByTxid?: string;
  }> {
    const sql = `
      SELECT * FROM brc22_utxos
      WHERE topic = ? ${includeSpent ? '' : 'AND spent_at IS NULL'}
      ORDER BY admitted_at DESC
    `;

    return this.database.prepare(sql).all(topic).map(row => ({
      utxoId: row.utxo_id,
      txid: row.txid,
      vout: row.vout,
      outputScript: row.output_script,
      satoshis: row.satoshis,
      admittedAt: row.admitted_at,
      spentAt: row.spent_at || undefined,
      spentByTxid: row.spent_by_txid || undefined
    }));
  }

  /**
   * Get statistics for BRC-22 operations
   */
  getStats(): {
    topics: Record<string, { active: number; spent: number; total: number }>;
    transactions: { total: number; recent: number };
  } {
    const topicStats: Record<string, { active: number; spent: number; total: number }> = {};

    for (const [topic] of this.topicManagers) {
      const active = this.database.prepare(`
        SELECT COUNT(*) as count FROM brc22_utxos
        WHERE topic = ? AND spent_at IS NULL
      `).get(topic)?.count || 0;

      const spent = this.database.prepare(`
        SELECT COUNT(*) as count FROM brc22_utxos
        WHERE topic = ? AND spent_at IS NOT NULL
      `).get(topic)?.count || 0;

      topicStats[topic] = {
        active,
        spent,
        total: active + spent
      };
    }

    const totalTransactions = this.database.prepare(`
      SELECT COUNT(*) as count FROM brc22_transactions
    `).get()?.count || 0;

    const recentTransactions = this.database.prepare(`
      SELECT COUNT(*) as count FROM brc22_transactions
      WHERE processed_at > ?
    `).get(Date.now() - 3600000)?.count || 0; // Last hour

    return {
      topics: topicStats,
      transactions: { total: totalTransactions, recent: recentTransactions }
    };
  }

  // Topic-specific admittance logic helpers

  private isD01AManifestOutput(transaction: BRC22Transaction, outputIndex: number): boolean {
    // Check if output contains D01A manifest data
    const outputs = this.parseTransactionOutputs(transaction.rawTx);
    const output = outputs[outputIndex];
    if (!output) return false;

    // Look for D01A manifest markers in output script
    return output.script.includes('d01a') || output.script.includes('manifest');
  }

  private isPaymentReceiptOutput(transaction: BRC22Transaction, outputIndex: number): boolean {
    // Check if output represents a payment receipt
    const outputs = this.parseTransactionOutputs(transaction.rawTx);
    const output = outputs[outputIndex];
    if (!output) return false;

    // Look for payment receipt markers
    return output.script.includes('payment') || output.script.includes('receipt');
  }

  private isAgentRegistryOutput(transaction: BRC22Transaction, outputIndex: number): boolean {
    // Check if output is an agent registration
    const outputs = this.parseTransactionOutputs(transaction.rawTx);
    const output = outputs[outputIndex];
    if (!output) return false;

    // Look for agent registry markers
    return output.script.includes('agent') || output.script.includes('registry');
  }

  private isLineageOutput(transaction: BRC22Transaction, outputIndex: number): boolean {
    // Check if output contains lineage information
    const outputs = this.parseTransactionOutputs(transaction.rawTx);
    const output = outputs[outputIndex];
    if (!output) return false;

    // Look for lineage markers
    return output.script.includes('lineage') || output.script.includes('provenance');
  }

  // Transaction parsing helpers (simplified implementations)

  private calculateTxid(rawTx: string): string {
    // In production, use proper Bitcoin transaction parsing
    // For now, generate a deterministic hash
    return require('crypto').createHash('sha256').update(rawTx).digest('hex');
  }

  private parseTransactionOutputs(rawTx: string): Array<{ script: string; satoshis: number }> {
    // Simplified output parsing - in production use proper Bitcoin transaction parser
    // For now, return mock outputs
    return [
      { script: '76a914' + '0'.repeat(40) + '88ac', satoshis: 1000 },
      { script: '76a914' + '1'.repeat(40) + '88ac', satoshis: 2000 }
    ];
  }

  private parseTransactionInputs(rawTx: string): Array<{ txid: string; vout: number }> {
    // Simplified input parsing - in production use proper Bitcoin transaction parser
    // For now, return mock inputs
    return [
      { txid: 'abc123', vout: 0 },
      { txid: 'def456', vout: 1 }
    ];
  }

  private async verifyTransactionEnvelope(transaction: BRC22Transaction): Promise<boolean> {
    // Simplified SPV verification - in production implement proper BRC-9 verification
    // Check that rawTx is valid hex and has basic structure
    if (!transaction.rawTx || !/^[0-9a-fA-F]+$/.test(transaction.rawTx)) {
      return false;
    }

    // Check minimum transaction size
    if (transaction.rawTx.length < 20) { // Minimum viable transaction
      return false;
    }

    return true;
  }
}

export { BRC22SubmitService };