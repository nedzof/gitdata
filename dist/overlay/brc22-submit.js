"use strict";
// BRC-22: Overlay Network Data Synchronization
// Implements standardized transaction submission with topic-based UTXO tracking
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRC22SubmitService = void 0;
const events_1 = require("events");
const wallet_1 = require("../lib/wallet");
class QueryBuilder {
    static insert(table, data, onConflict) {
        const keys = Object.keys(data);
        const placeholders = keys.map((_, index) => `$${index + 1}`);
        const params = Object.values(data);
        let query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;
        if (onConflict) {
            query += ` ${onConflict}`;
        }
        return { query, params };
    }
    static update(table, data, where) {
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
    static selectWithOptions(table, options = {}) {
        const columns = options.columns || ['*'];
        const cols = columns.join(', ');
        let query = `SELECT ${cols} FROM ${table}`;
        const params = [];
        if (options.where) {
            const conditions = Object.keys(options.where).map((key, index) => {
                params.push(options.where[key]);
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
    static count(table, where) {
        let query = `SELECT COUNT(*) as count FROM ${table}`;
        const params = [];
        if (where) {
            const conditions = Object.keys(where).map((key, index) => {
                params.push(where[key]);
                return `${key} = $${index + 1}`;
            });
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        return { query, params };
    }
    static countWithCondition(table, condition, params = []) {
        const query = `SELECT COUNT(*) as count FROM ${table} WHERE ${condition}`;
        return { query, params };
    }
    static selectWithCustomWhere(table, columns, whereCondition, params = [], options = {}) {
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
class BRC22SubmitService extends events_1.EventEmitter {
    constructor(database) {
        super();
        this.topicManagers = new Map();
        this.trackedUTXOs = new Map(); // topic -> set of "txid:vout"
        this.database = database;
        this.initialize();
    }
    async initialize() {
        await this.setupDatabase();
        this.setupDefaultTopicManagers();
    }
    /**
     * Database tables are now created in the main schema at /src/db/postgresql-schema-complete.sql
     * This method is kept for compatibility but no longer creates tables
     */
    async setupDatabase() {
        // Tables are now created centrally in the main database schema
        // BRC-22 tables: brc22_utxos, brc22_transactions
        console.log('BRC-22 database tables managed by central schema');
    }
    /**
     * Set up default topic managers for common Gitdata use cases
     */
    setupDefaultTopicManagers() {
        // D01A Asset topic manager
        this.addTopicManager({
            topicName: 'gitdata.d01a.asset',
            admittanceLogic: (tx, outputIndex) => {
                // Admit outputs that contain D01A asset data
                return this.isD01AAssetOutput(tx, outputIndex);
            },
            onOutputAdmitted: (txid, vout, outputScript, satoshis) => {
                this.emit('asset-utxo-admitted', { txid, vout, outputScript, satoshis });
                // Backward compatibility
                this.emit('manifest-utxo-admitted', { txid, vout, outputScript, satoshis });
            },
        });
        // Payment receipts topic manager
        this.addTopicManager({
            topicName: 'gitdata.payment.receipts',
            admittanceLogic: (tx, outputIndex) => {
                return this.isPaymentReceiptOutput(tx, outputIndex);
            },
            onOutputAdmitted: (txid, vout, outputScript, satoshis) => {
                this.emit('payment-utxo-admitted', { txid, vout, outputScript, satoshis });
            },
        });
        // Agent registry topic manager
        this.addTopicManager({
            topicName: 'gitdata.agent.registry',
            admittanceLogic: (tx, outputIndex) => {
                return this.isAgentRegistryOutput(tx, outputIndex);
            },
            onOutputAdmitted: (txid, vout, outputScript, satoshis) => {
                this.emit('agent-utxo-admitted', { txid, vout, outputScript, satoshis });
            },
        });
        // Lineage tracking topic manager
        this.addTopicManager({
            topicName: 'gitdata.lineage.graph',
            admittanceLogic: (tx, outputIndex) => {
                return this.isLineageOutput(tx, outputIndex);
            },
            onOutputAdmitted: (txid, vout, outputScript, satoshis) => {
                this.emit('lineage-utxo-admitted', { txid, vout, outputScript, satoshis });
            },
        });
    }
    /**
     * Add a topic manager
     */
    addTopicManager(manager) {
        this.topicManagers.set(manager.topicName, manager);
        this.trackedUTXOs.set(manager.topicName, new Set());
    }
    /**
     * Remove a topic manager
     */
    removeTopicManager(topicName) {
        this.topicManagers.delete(topicName);
        this.trackedUTXOs.delete(topicName);
    }
    /**
     * Process a BRC-22 transaction submission
     */
    async processSubmission(transaction, senderIdentity) {
        try {
            // 1. Verify BRC-31 identity (simplified - in production you'd do full verification)
            if (!senderIdentity && !wallet_1.walletService.isConnected()) {
                return {
                    status: 'error',
                    error: {
                        code: 'ERR_IDENTITY_REQUIRED',
                        description: 'BRC-31 identity verification required for transaction submission',
                    },
                };
            }
            // 2. Check if we host any of the requested topics
            const hostedTopics = transaction.topics.filter((topic) => this.topicManagers.has(topic));
            if (hostedTopics.length === 0) {
                return {
                    status: 'success',
                    topics: {},
                };
            }
            // 3. Verify transaction envelope (simplified SPV verification)
            const isValid = await this.verifyTransactionEnvelope(transaction);
            if (!isValid) {
                return {
                    status: 'error',
                    error: {
                        code: 'ERR_INVALID_TRANSACTION',
                        description: 'Transaction envelope verification failed',
                    },
                };
            }
            // 4. Apply topic-specific logic
            const admittedOutputs = {};
            const txid = this.calculateTxid(transaction.rawTx);
            for (const topic of hostedTopics) {
                const manager = this.topicManagers.get(topic);
                const admittedIndexes = [];
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
                transaction,
            });
            return {
                status: 'success',
                topics: admittedOutputs,
            };
        }
        catch (error) {
            console.error('BRC-22 transaction processing failed:', error);
            return {
                status: 'error',
                error: {
                    code: 'ERR_PROCESSING_FAILED',
                    description: error.message,
                },
            };
        }
    }
    /**
     * Process spent inputs for a topic
     */
    async processSpentInputs(transaction, topic, manager) {
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
    async admitOutput(topic, txid, vout, output, manager) {
        const utxoId = `${txid}:${vout}`;
        // Store in database
        const utxoData = {
            utxo_id: utxoId,
            topic: topic,
            txid: txid,
            vout: vout,
            output_script: output.script,
            satoshis: output.satoshis,
            admitted_at: Date.now(),
        };
        const onConflict = `ON CONFLICT (utxo_id) DO UPDATE SET
      topic = EXCLUDED.topic,
      output_script = EXCLUDED.output_script,
      satoshis = EXCLUDED.satoshis,
      admitted_at = EXCLUDED.admitted_at`;
        const { query, params } = QueryBuilder.insert('brc22_utxos', utxoData, onConflict);
        await this.database.execute(query, params);
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
    async markUTXOSpent(topic, txid, vout, spentByTxid) {
        const updateData = {
            spent_at: Date.now(),
            spent_by_txid: spentByTxid,
        };
        const whereCondition = {
            topic: topic,
            txid: txid,
            vout: vout,
        };
        const { query, params } = QueryBuilder.update('brc22_utxos', updateData, whereCondition);
        await this.database.execute(query, params);
    }
    /**
     * Store transaction record
     */
    async storeTransactionRecord(transaction, txid) {
        const transactionData = {
            txid: txid,
            raw_tx: transaction.rawTx,
            topics_json: JSON.stringify(transaction.topics),
            inputs_json: JSON.stringify(transaction.inputs || {}),
            mapi_responses_json: JSON.stringify(transaction.mapiResponses || []),
            proof: transaction.proof || null,
            processed_at: Date.now(),
        };
        const onConflict = `ON CONFLICT (txid) DO UPDATE SET
        raw_tx = EXCLUDED.raw_tx,
        topics_json = EXCLUDED.topics_json,
        inputs_json = EXCLUDED.inputs_json,
        mapi_responses_json = EXCLUDED.mapi_responses_json,
        proof = EXCLUDED.proof,
        processed_at = EXCLUDED.processed_at`;
        const { query, params } = QueryBuilder.insert('brc22_transactions', transactionData, onConflict);
        await this.database.execute(query, params);
    }
    /**
     * Get UTXOs for a topic
     */
    async getTopicUTXOs(topic, includeSpent = false) {
        let rows;
        if (includeSpent) {
            const { query, params } = QueryBuilder.selectWithOptions('brc22_utxos', {
                where: { topic },
                orderBy: 'admitted_at',
                orderDirection: 'DESC',
            });
            rows = await this.database.query(query, params);
        }
        else {
            const { query, params } = QueryBuilder.selectWithCustomWhere('brc22_utxos', ['*'], 'topic = $1 AND spent_at IS NULL', [topic], {
                orderBy: 'admitted_at',
                orderDirection: 'DESC',
            });
            rows = await this.database.query(query, params);
        }
        return rows.map((row) => ({
            utxoId: row.utxo_id,
            txid: row.txid,
            vout: row.vout,
            outputScript: row.output_script,
            satoshis: row.satoshis,
            admittedAt: row.admitted_at,
            spentAt: row.spent_at || undefined,
            spentByTxid: row.spent_by_txid || undefined,
        }));
    }
    /**
     * Get statistics for BRC-22 operations
     */
    async getStats() {
        const topicStats = {};
        for (const [topic] of Array.from(this.topicManagers.entries())) {
            const activeQuery = QueryBuilder.countWithCondition('brc22_utxos', 'topic = $1 AND spent_at IS NULL', [topic]);
            const spentQuery = QueryBuilder.countWithCondition('brc22_utxos', 'topic = $1 AND spent_at IS NOT NULL', [topic]);
            const activeResult = await this.database.queryOne(activeQuery.query, activeQuery.params);
            const active = activeResult?.count || 0;
            const spentResult = await this.database.queryOne(spentQuery.query, spentQuery.params);
            const spent = spentResult?.count || 0;
            topicStats[topic] = {
                active,
                spent,
                total: active + spent,
            };
        }
        const totalQuery = QueryBuilder.count('brc22_transactions');
        const recentQuery = QueryBuilder.countWithCondition('brc22_transactions', 'processed_at > $1', [Date.now() - 3600000]);
        const totalResult = await this.database.queryOne(totalQuery.query, totalQuery.params);
        const totalTransactions = totalResult?.count || 0;
        const recentResult = await this.database.queryOne(recentQuery.query, recentQuery.params);
        const recentTransactions = recentResult?.count || 0;
        return {
            topics: topicStats,
            transactions: { total: totalTransactions, recent: recentTransactions },
        };
    }
    // Topic-specific admittance logic helpers
    isD01AAssetOutput(transaction, outputIndex) {
        // Check if output contains D01A asset data
        const outputs = this.parseTransactionOutputs(transaction.rawTx);
        const output = outputs[outputIndex];
        if (!output)
            return false;
        // Look for D01A asset markers in output script (including legacy manifest for backward compatibility)
        return (output.script.includes('d01a') ||
            output.script.includes('asset') ||
            output.script.includes('manifest'));
    }
    isPaymentReceiptOutput(transaction, outputIndex) {
        // Check if output represents a payment receipt
        const outputs = this.parseTransactionOutputs(transaction.rawTx);
        const output = outputs[outputIndex];
        if (!output)
            return false;
        // Look for payment receipt markers
        return output.script.includes('payment') || output.script.includes('receipt');
    }
    isAgentRegistryOutput(transaction, outputIndex) {
        // Check if output is an agent registration
        const outputs = this.parseTransactionOutputs(transaction.rawTx);
        const output = outputs[outputIndex];
        if (!output)
            return false;
        // Look for agent registry markers
        return output.script.includes('agent') || output.script.includes('registry');
    }
    isLineageOutput(transaction, outputIndex) {
        // Check if output contains lineage information
        const outputs = this.parseTransactionOutputs(transaction.rawTx);
        const output = outputs[outputIndex];
        if (!output)
            return false;
        // Look for lineage markers
        return output.script.includes('lineage') || output.script.includes('provenance');
    }
    // Transaction parsing helpers (simplified implementations)
    calculateTxid(rawTx) {
        // In production, use proper Bitcoin transaction parsing
        // For now, generate a deterministic hash
        return require('crypto').createHash('sha256').update(rawTx).digest('hex');
    }
    parseTransactionOutputs(rawTx) {
        // Simplified output parsing - in production use proper Bitcoin transaction parser
        // For now, return mock outputs
        return [
            { script: '76a914' + '0'.repeat(40) + '88ac', satoshis: 1000 },
            { script: '76a914' + '1'.repeat(40) + '88ac', satoshis: 2000 },
        ];
    }
    parseTransactionInputs(rawTx) {
        // Simplified input parsing - in production use proper Bitcoin transaction parser
        // For now, return mock inputs
        return [
            { txid: 'abc123', vout: 0 },
            { txid: 'def456', vout: 1 },
        ];
    }
    async verifyTransactionEnvelope(transaction) {
        // Simplified SPV verification - in production implement proper BRC-9 verification
        // Check that rawTx is valid hex and has basic structure
        if (!transaction.rawTx || !/^[0-9a-fA-F]+$/.test(transaction.rawTx)) {
            return false;
        }
        // Check minimum transaction size
        if (transaction.rawTx.length < 20) {
            // Minimum viable transaction
            return false;
        }
        return true;
    }
}
exports.BRC22SubmitService = BRC22SubmitService;
//# sourceMappingURL=brc22-submit.js.map