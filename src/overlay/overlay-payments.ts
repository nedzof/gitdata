// BSV Overlay Payment Integration
// Handles payment flows over the overlay network

import { EventEmitter } from 'events';

import { walletService } from '../lib/wallet';

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

  static selectWithJoin(
    fromTable: string,
    joinTable: string,
    joinCondition: string,
    columns: string[],
    whereCondition?: string,
    params: any[] = [],
  ): { query: string; params: any[] } {
    const cols = columns.join(', ');
    let query = `SELECT ${cols} FROM ${fromTable} JOIN ${joinTable} ON ${joinCondition}`;

    if (whereCondition) {
      query += ` WHERE ${whereCondition}`;
    }

    return { query, params };
  }

  static updateWithCondition(
    table: string,
    data: Record<string, any>,
    whereCondition: string,
    whereParams: any[] = [],
  ): { query: string; params: any[] } {
    const setClause = Object.keys(data)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    const params = [...Object.values(data), ...whereParams];

    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereCondition}`;
    return { query, params };
  }
}

import { D01A_TOPICS, TopicGenerator } from './overlay-config';
import type { OverlayManager } from './overlay-manager';

export interface PaymentQuote {
  quoteId: string;
  receiptId: string;
  versionId: string;
  amountSat: number;
  outputs: Array<{
    scriptHex: string;
    satoshis: number;
    description: string;
  }>;
  expiresAt: number;
  templateHash: string;
  createdAt: number;
}

export interface PaymentRequest {
  receiptId: string;
  versionId: string;
  quantity: number;
  buyerPublicKey: string;
  timestamp: number;
}

export interface PaymentReceipt {
  receiptId: string;
  txid: string;
  status: 'pending' | 'confirmed' | 'failed';
  amountSat: number;
  createdAt: number;
  confirmedAt?: number;
}

class OverlayPaymentService extends EventEmitter {
  private overlayManager: OverlayManager;
  private database: DatabaseAdapter;
  private pendingQuotes = new Map<string, PaymentQuote>();
  private pendingPayments = new Map<string, PaymentReceipt>();

  constructor(overlayManager: OverlayManager, database: DatabaseAdapter) {
    super();
    this.overlayManager = overlayManager;
    this.database = database;

    this.setupDatabase();
    this.setupEventHandlers();
  }

  /**
   * Database tables are now created in the main schema at /src/db/postgresql-schema-complete.sql
   * This method is kept for compatibility but no longer creates tables
   */
  private setupDatabase(): void {
    // Tables are now created centrally in the main database schema
    // Overlay payment tables: overlay_payment_quotes, overlay_payment_receipts
    console.log('Overlay payment database tables managed by central schema');
  }

  /**
   * Set up event handlers for overlay payment messages
   */
  private setupEventHandlers(): void {
    // Handle payment requests from overlay
    this.overlayManager.on('payment-data', (event) => {
      this.handlePaymentMessage(event.data, event.sender);
    });

    // Handle data requests that might be payment-related
    this.overlayManager.on('data-request', (event) => {
      if (event.topic.includes('payment')) {
        this.handlePaymentRequest(event.data, event.sender);
      }
    });
  }

  /**
   * Create a payment quote for overlay transmission
   */
  async createPaymentQuote(request: PaymentRequest): Promise<PaymentQuote> {
    try {
      // Validate the request
      if (!request.receiptId || !request.versionId || !request.buyerPublicKey) {
        throw new Error('Invalid payment request: missing required fields');
      }

      // Check if version exists and get pricing
      const { query: versionQuery, params: versionParams } = QueryBuilder.selectWithJoin(
        'versions v',
        'assets m',
        'v.version_id = m.version_id',
        ['v.*', 'm.unit_price_sat', 'm.classification'],
        'v.version_id = $1',
        [request.versionId],
      );
      const version = await this.database.queryOne(versionQuery, versionParams);

      if (!version) {
        throw new Error(`Version not found: ${request.versionId}`);
      }

      const unitPriceSat = version.unit_price_sat || 1000; // Default price
      const totalAmount = unitPriceSat * (request.quantity || 1);

      // Create payment outputs (simplified version)
      const outputs = [
        {
          scriptHex: await this.getPaymentScript(), // Producer payment script
          satoshis: Math.floor(totalAmount * 0.95), // 95% to producer
          description: `Payment for ${request.versionId}`,
        },
        {
          scriptHex: await this.getOverlayFeeScript(), // Platform fee script
          satoshis: Math.floor(totalAmount * 0.05), // 5% platform fee
          description: 'Platform fee',
        },
      ];

      // Generate quote
      const quote: PaymentQuote = {
        quoteId: this.generateQuoteId(),
        receiptId: request.receiptId,
        versionId: request.versionId,
        amountSat: totalAmount,
        outputs,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        templateHash: this.generateTemplateHash(outputs),
        createdAt: Date.now(),
      };

      // Store quote
      const quoteData = {
        quote_id: quote.quoteId,
        receipt_id: quote.receiptId,
        version_id: quote.versionId,
        amount_sat: quote.amountSat,
        outputs_json: JSON.stringify(quote.outputs),
        expires_at: quote.expiresAt,
        template_hash: quote.templateHash,
        created_at: quote.createdAt,
      };

      const onConflict = `ON CONFLICT (quote_id) DO UPDATE SET
          receipt_id = EXCLUDED.receipt_id,
          version_id = EXCLUDED.version_id,
          amount_sat = EXCLUDED.amount_sat,
          outputs_json = EXCLUDED.outputs_json,
          expires_at = EXCLUDED.expires_at,
          template_hash = EXCLUDED.template_hash,
          created_at = EXCLUDED.created_at`;

      const { query: insertQuoteQuery, params: insertQuoteParams } = QueryBuilder.insert(
        'overlay_payment_quotes',
        quoteData,
        onConflict,
      );
      await this.database.execute(insertQuoteQuery, insertQuoteParams);

      this.pendingQuotes.set(quote.quoteId, quote);

      // Publish quote to overlay network
      await this.publishPaymentQuote(quote, request.buyerPublicKey);

      this.emit('quote-created', quote);
      return quote;
    } catch (error) {
      throw new Error(`Failed to create payment quote: ${(error as Error).message}`);
    }
  }

  /**
   * Process payment submission from overlay
   */
  async processPaymentSubmission(submission: {
    quoteId: string;
    rawTxHex: string;
    buyerPublicKey: string;
  }): Promise<PaymentReceipt> {
    try {
      // Get quote
      const quote =
        this.pendingQuotes.get(submission.quoteId) ||
        (await this.getQuoteFromDatabase(submission.quoteId));

      if (!quote) {
        throw new Error(`Quote not found: ${submission.quoteId}`);
      }

      // Check if quote is still valid
      if (Date.now() > quote.expiresAt) {
        throw new Error('Payment quote has expired');
      }

      // Validate transaction (simplified - in production you'd do full validation)
      const txid = await this.validateAndBroadcastTransaction(submission.rawTxHex, quote);

      // Create receipt
      const receipt: PaymentReceipt = {
        receiptId: quote.receiptId,
        txid,
        status: 'pending',
        amountSat: quote.amountSat,
        createdAt: Date.now(),
      };

      // Store receipt
      const receiptData = {
        receipt_id: receipt.receiptId,
        quote_id: quote.quoteId,
        txid: receipt.txid,
        status: receipt.status,
        amount_sat: receipt.amountSat,
        buyer_public_key: submission.buyerPublicKey,
        created_at: receipt.createdAt,
      };

      const onConflict = `ON CONFLICT (receipt_id) DO UPDATE SET
          quote_id = EXCLUDED.quote_id,
          txid = EXCLUDED.txid,
          status = EXCLUDED.status,
          amount_sat = EXCLUDED.amount_sat,
          buyer_public_key = EXCLUDED.buyer_public_key,
          created_at = EXCLUDED.created_at`;

      const { query: insertReceiptQuery, params: insertReceiptParams } = QueryBuilder.insert(
        'overlay_payment_receipts',
        receiptData,
        onConflict,
      );
      await this.database.execute(insertReceiptQuery, insertReceiptParams);

      this.pendingPayments.set(receipt.receiptId, receipt);

      // Publish receipt to overlay
      await this.publishPaymentReceipt(receipt);

      this.emit('payment-received', receipt);
      return receipt;
    } catch (error) {
      throw new Error(`Failed to process payment submission: ${(error as Error).message}`);
    }
  }

  /**
   * Request payment quote from overlay network
   */
  async requestPaymentQuote(versionId: string, quantity: number = 1): Promise<void> {
    try {
      const wallet = walletService.getWallet();
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      const publicKey = walletService.getPublicKey();
      if (!publicKey) {
        throw new Error('Could not get wallet public key');
      }

      const request: PaymentRequest = {
        receiptId: this.generateReceiptId(),
        versionId,
        quantity,
        buyerPublicKey: publicKey,
        timestamp: Date.now(),
      };

      // Publish payment request to overlay
      const topic = TopicGenerator.paymentTopic(request.receiptId);
      await this.overlayManager.publishAsset({
        type: 'payment_request',
        request,
        timestamp: Date.now(),
      });

      this.emit('quote-requested', request);
    } catch (error) {
      throw new Error(`Failed to request payment quote: ${(error as Error).message}`);
    }
  }

  /**
   * Submit payment to overlay network
   */
  async submitPayment(quoteId: string): Promise<PaymentReceipt> {
    try {
      const wallet = walletService.getWallet();
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      const quote = this.pendingQuotes.get(quoteId) || (await this.getQuoteFromDatabase(quoteId));
      if (!quote) {
        throw new Error(`Quote not found: ${quoteId}`);
      }

      // Create transaction using wallet
      const txResult = await wallet.createAction({
        description: `Purchase data version ${quote.versionId}`,
        outputs: quote.outputs.map((output) => ({
          script: output.scriptHex,
          satoshis: output.satoshis,
          description: output.description,
          basket: 'purchases',
          tags: ['overlay-payment', `version:${quote.versionId}`, `quote:${quoteId}`],
        })),
        labels: ['overlay-payment', 'gitdata-purchase'],
      });

      if (!txResult.tx) {
        throw new Error('Failed to create transaction');
      }

      // Submit payment to overlay
      const submission = {
        quoteId,
        rawTxHex: txResult.tx,
        buyerPublicKey: walletService.getPublicKey() || '',
      };

      // Publish payment submission
      const topic = TopicGenerator.paymentTopic(quote.receiptId);
      await this.overlayManager.publishAsset({
        type: 'payment_submission',
        submission,
        timestamp: Date.now(),
      });

      // Create local receipt record
      const receipt: PaymentReceipt = {
        receiptId: quote.receiptId,
        txid: txResult.tx, // This would be the actual txid in production
        status: 'pending',
        amountSat: quote.amountSat,
        createdAt: Date.now(),
      };

      this.pendingPayments.set(receipt.receiptId, receipt);
      this.emit('payment-submitted', receipt);

      return receipt;
    } catch (error) {
      throw new Error(`Failed to submit payment: ${(error as Error).message}`);
    }
  }

  /**
   * Handle incoming payment messages from overlay
   */
  private async handlePaymentMessage(data: any, sender: string): Promise<void> {
    try {
      if (data.type === 'payment_request') {
        await this.handlePaymentRequestMessage(data.request, sender);
      } else if (data.type === 'payment_quote') {
        await this.handlePaymentQuoteMessage(data.quote, sender);
      } else if (data.type === 'payment_submission') {
        await this.handlePaymentSubmissionMessage(data.submission, sender);
      } else if (data.type === 'payment_receipt') {
        await this.handlePaymentReceiptMessage(data.receipt, sender);
      }
    } catch (error) {
      console.error('Failed to handle payment message:', error);
    }
  }

  /**
   * Handle payment request from buyer
   */
  private async handlePaymentRequestMessage(
    request: PaymentRequest,
    sender: string,
  ): Promise<void> {
    try {
      // Create and send quote
      const quote = await this.createPaymentQuote(request);
      await this.publishPaymentQuote(quote, request.buyerPublicKey);
    } catch (error) {
      console.error('Failed to handle payment request:', error);
    }
  }

  /**
   * Handle payment quote from seller
   */
  private async handlePaymentQuoteMessage(quote: PaymentQuote, sender: string): Promise<void> {
    try {
      // Store received quote
      this.pendingQuotes.set(quote.quoteId, quote);
      this.emit('quote-received', { quote, sender });
    } catch (error) {
      console.error('Failed to handle payment quote:', error);
    }
  }

  /**
   * Handle payment submission from buyer
   */
  private async handlePaymentSubmissionMessage(submission: any, sender: string): Promise<void> {
    try {
      const receipt = await this.processPaymentSubmission(submission);
      this.emit('payment-processed', { receipt, sender });
    } catch (error) {
      console.error('Failed to handle payment submission:', error);
    }
  }

  /**
   * Handle payment receipt from seller
   */
  private async handlePaymentReceiptMessage(
    receipt: PaymentReceipt,
    sender: string,
  ): Promise<void> {
    try {
      // Update local receipt status
      this.pendingPayments.set(receipt.receiptId, receipt);
      this.emit('receipt-received', { receipt, sender });
    } catch (error) {
      console.error('Failed to handle payment receipt:', error);
    }
  }

  /**
   * Publish payment quote to overlay
   */
  private async publishPaymentQuote(quote: PaymentQuote, buyerPublicKey: string): Promise<void> {
    const topic = TopicGenerator.paymentTopic(quote.receiptId);
    await this.overlayManager.publishAsset({
      type: 'payment_quote',
      quote,
      buyerPublicKey,
      timestamp: Date.now(),
    });
  }

  /**
   * Publish payment receipt to overlay
   */
  private async publishPaymentReceipt(receipt: PaymentReceipt): Promise<void> {
    const topic = TopicGenerator.paymentTopic(receipt.receiptId);
    await this.overlayManager.publishAsset({
      type: 'payment_receipt',
      receipt,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle payment request from overlay
   */
  private async handlePaymentRequest(data: any, sender: string): Promise<void> {
    try {
      if (data.type === 'payment_request') {
        const quote = await this.createPaymentQuote(data.request);
        await this.publishPaymentQuote(quote, data.request.buyerPublicKey);
      }
    } catch (error) {
      console.error('Failed to handle payment request:', error);
    }
  }

  /**
   * Get payment script for producer
   */
  private async getPaymentScript(): Promise<string> {
    // In production, this would get the producer's payment script from the database
    // For now, return a placeholder
    return '76a914' + '0'.repeat(40) + '88ac'; // P2PKH script template
  }

  /**
   * Get overlay platform fee script
   */
  private async getOverlayFeeScript(): Promise<string> {
    // Platform fee script
    return '76a914' + '1'.repeat(40) + '88ac'; // P2PKH script template
  }

  /**
   * Validate and broadcast transaction
   */
  private async validateAndBroadcastTransaction(
    rawTxHex: string,
    quote: PaymentQuote,
  ): Promise<string> {
    // In production, this would:
    // 1. Parse the transaction
    // 2. Validate outputs match the quote
    // 3. Broadcast to BSV network
    // 4. Return the txid

    // For now, generate a mock txid
    return this.generateTxid();
  }

  /**
   * Get quote from database
   */
  private async getQuoteFromDatabase(quoteId: string): Promise<PaymentQuote | null> {
    try {
      const { query: selectQuery, params: selectParams } = QueryBuilder.selectWithOptions(
        'overlay_payment_quotes',
        {
          where: { quote_id: quoteId },
        },
      );
      const row = await this.database.queryOne(selectQuery, selectParams);

      if (!row) return null;

      return {
        quoteId: row.quote_id,
        receiptId: row.receipt_id,
        versionId: row.version_id,
        amountSat: row.amount_sat,
        outputs: JSON.parse(row.outputs_json),
        expiresAt: row.expires_at,
        templateHash: row.template_hash,
        createdAt: row.created_at,
      };
    } catch (error) {
      console.error('Failed to get quote from database:', error);
      return null;
    }
  }

  /**
   * Generate unique quote ID
   */
  private generateQuoteId(): string {
    return 'quote_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Generate unique receipt ID
   */
  private generateReceiptId(): string {
    return 'receipt_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Generate template hash for quote consistency
   */
  private generateTemplateHash(outputs: any[]): string {
    const content = JSON.stringify(
      outputs.map((o) => ({ script: o.scriptHex, amount: o.satoshis })),
    );
    return Buffer.from(content).toString('base64').substring(0, 16);
  }

  /**
   * Generate mock transaction ID
   */
  private generateTxid(): string {
    return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<{
    quotes: { total: number; active: number; expired: number };
    receipts: { total: number; pending: number; confirmed: number };
  }> {
    const now = Date.now();

    const totalQuotesQuery = QueryBuilder.count('overlay_payment_quotes');
    const totalQuotesResult = await this.database.queryOne(
      totalQuotesQuery.query,
      totalQuotesQuery.params,
    );
    const totalQuotes = totalQuotesResult?.count || 0;

    const activeQuotesQuery = QueryBuilder.countWithCondition(
      'overlay_payment_quotes',
      'expires_at > $1',
      [now],
    );
    const activeQuotesResult = await this.database.queryOne(
      activeQuotesQuery.query,
      activeQuotesQuery.params,
    );
    const activeQuotes = activeQuotesResult?.count || 0;

    const expiredQuotes = totalQuotes - activeQuotes;

    const totalReceiptsQuery = QueryBuilder.count('overlay_payment_receipts');
    const totalReceiptsResult = await this.database.queryOne(
      totalReceiptsQuery.query,
      totalReceiptsQuery.params,
    );
    const totalReceipts = totalReceiptsResult?.count || 0;

    const pendingReceiptsQuery = QueryBuilder.count('overlay_payment_receipts', {
      status: 'pending',
    });
    const pendingReceiptsResult = await this.database.queryOne(
      pendingReceiptsQuery.query,
      pendingReceiptsQuery.params,
    );
    const pendingReceipts = pendingReceiptsResult?.count || 0;

    const confirmedReceiptsQuery = QueryBuilder.count('overlay_payment_receipts', {
      status: 'confirmed',
    });
    const confirmedReceiptsResult = await this.database.queryOne(
      confirmedReceiptsQuery.query,
      confirmedReceiptsQuery.params,
    );
    const confirmedReceipts = confirmedReceiptsResult?.count || 0;

    return {
      quotes: { total: totalQuotes, active: activeQuotes, expired: expiredQuotes },
      receipts: { total: totalReceipts, pending: pendingReceipts, confirmed: confirmedReceipts },
    };
  }

  /**
   * Clean up expired quotes
   */
  async cleanupExpiredQuotes(): Promise<number> {
    const updateData = { status: 'expired' };
    const { query: updateQuery, params: updateParams } = QueryBuilder.updateWithCondition(
      'overlay_payment_quotes',
      updateData,
      'expires_at < $1 AND status = $2',
      [Date.now(), 'active'],
    );
    await this.database.execute(updateQuery, updateParams);

    // Return number of affected rows (PostgreSQL doesn't provide this directly with execute)
    // For now, return 0 as a placeholder
    return 0;
  }
}

export { OverlayPaymentService };
