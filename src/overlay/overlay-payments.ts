// BSV Overlay Payment Integration
// Handles payment flows over the overlay network

import { walletService } from '../../ui/src/lib/wallet';
import { OverlayManager } from './overlay-manager';
import { D01A_TOPICS, TopicGenerator } from './overlay-config';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';

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
  private database: Database.Database;
  private pendingQuotes = new Map<string, PaymentQuote>();
  private pendingPayments = new Map<string, PaymentReceipt>();

  constructor(overlayManager: OverlayManager, database: Database.Database) {
    super();
    this.overlayManager = overlayManager;
    this.database = database;

    this.setupDatabase();
    this.setupEventHandlers();
  }

  /**
   * Set up database tables for overlay payments
   */
  private setupDatabase(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS overlay_payment_quotes (
        quote_id TEXT PRIMARY KEY,
        receipt_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        amount_sat INTEGER NOT NULL,
        outputs_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        template_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT DEFAULT 'active'
      )
    `);

    this.database.exec(`
      CREATE TABLE IF NOT EXISTS overlay_payment_receipts (
        receipt_id TEXT PRIMARY KEY,
        quote_id TEXT,
        txid TEXT,
        status TEXT DEFAULT 'pending',
        amount_sat INTEGER NOT NULL,
        buyer_public_key TEXT,
        created_at INTEGER NOT NULL,
        confirmed_at INTEGER,
        FOREIGN KEY (quote_id) REFERENCES overlay_payment_quotes(quote_id)
      )
    `);

    this.database.exec(`
      CREATE INDEX IF NOT EXISTS idx_overlay_quotes_expires ON overlay_payment_quotes(expires_at);
      CREATE INDEX IF NOT EXISTS idx_overlay_receipts_status ON overlay_payment_receipts(status);
      CREATE INDEX IF NOT EXISTS idx_overlay_receipts_txid ON overlay_payment_receipts(txid);
    `);
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
      const version = this.database.prepare(`
        SELECT v.*, m.unit_price_sat, m.classification
        FROM versions v
        JOIN manifests m ON v.version_id = m.version_id
        WHERE v.version_id = ?
      `).get(request.versionId);

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
          description: `Payment for ${request.versionId}`
        },
        {
          scriptHex: await this.getOverlayFeeScript(), // Platform fee script
          satoshis: Math.floor(totalAmount * 0.05), // 5% platform fee
          description: 'Platform fee'
        }
      ];

      // Generate quote
      const quote: PaymentQuote = {
        quoteId: this.generateQuoteId(),
        receiptId: request.receiptId,
        versionId: request.versionId,
        amountSat: totalAmount,
        outputs,
        expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
        templateHash: this.generateTemplateHash(outputs),
        createdAt: Date.now()
      };

      // Store quote
      this.database.prepare(`
        INSERT INTO overlay_payment_quotes
        (quote_id, receipt_id, version_id, amount_sat, outputs_json, expires_at, template_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quote.quoteId,
        quote.receiptId,
        quote.versionId,
        quote.amountSat,
        JSON.stringify(quote.outputs),
        quote.expiresAt,
        quote.templateHash,
        quote.createdAt
      );

      this.pendingQuotes.set(quote.quoteId, quote);

      // Publish quote to overlay network
      await this.publishPaymentQuote(quote, request.buyerPublicKey);

      this.emit('quote-created', quote);
      return quote;

    } catch (error) {
      throw new Error(`Failed to create payment quote: ${error.message}`);
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
      const quote = this.pendingQuotes.get(submission.quoteId) ||
        this.getQuoteFromDatabase(submission.quoteId);

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
        createdAt: Date.now()
      };

      // Store receipt
      this.database.prepare(`
        INSERT INTO overlay_payment_receipts
        (receipt_id, quote_id, txid, status, amount_sat, buyer_public_key, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        receipt.receiptId,
        quote.quoteId,
        receipt.txid,
        receipt.status,
        receipt.amountSat,
        submission.buyerPublicKey,
        receipt.createdAt
      );

      this.pendingPayments.set(receipt.receiptId, receipt);

      // Publish receipt to overlay
      await this.publishPaymentReceipt(receipt);

      this.emit('payment-received', receipt);
      return receipt;

    } catch (error) {
      throw new Error(`Failed to process payment submission: ${error.message}`);
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
        timestamp: Date.now()
      };

      // Publish payment request to overlay
      const topic = TopicGenerator.paymentTopic(request.receiptId);
      await this.overlayManager.publishManifest({
        type: 'payment_request',
        request,
        timestamp: Date.now()
      });

      this.emit('quote-requested', request);

    } catch (error) {
      throw new Error(`Failed to request payment quote: ${error.message}`);
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

      const quote = this.pendingQuotes.get(quoteId) || this.getQuoteFromDatabase(quoteId);
      if (!quote) {
        throw new Error(`Quote not found: ${quoteId}`);
      }

      // Create transaction using wallet
      const txResult = await wallet.createAction({
        description: `Purchase data version ${quote.versionId}`,
        outputs: quote.outputs.map(output => ({
          script: output.scriptHex,
          satoshis: output.satoshis,
          description: output.description,
          basket: 'purchases',
          tags: ['overlay-payment', `version:${quote.versionId}`, `quote:${quoteId}`]
        })),
        labels: ['overlay-payment', 'gitdata-purchase']
      });

      if (!txResult.tx) {
        throw new Error('Failed to create transaction');
      }

      // Submit payment to overlay
      const submission = {
        quoteId,
        rawTxHex: txResult.tx,
        buyerPublicKey: walletService.getPublicKey() || ''
      };

      // Publish payment submission
      const topic = TopicGenerator.paymentTopic(quote.receiptId);
      await this.overlayManager.publishManifest({
        type: 'payment_submission',
        submission,
        timestamp: Date.now()
      });

      // Create local receipt record
      const receipt: PaymentReceipt = {
        receiptId: quote.receiptId,
        txid: txResult.tx, // This would be the actual txid in production
        status: 'pending',
        amountSat: quote.amountSat,
        createdAt: Date.now()
      };

      this.pendingPayments.set(receipt.receiptId, receipt);
      this.emit('payment-submitted', receipt);

      return receipt;

    } catch (error) {
      throw new Error(`Failed to submit payment: ${error.message}`);
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
  private async handlePaymentRequestMessage(request: PaymentRequest, sender: string): Promise<void> {
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
  private async handlePaymentReceiptMessage(receipt: PaymentReceipt, sender: string): Promise<void> {
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
    await this.overlayManager.publishManifest({
      type: 'payment_quote',
      quote,
      buyerPublicKey,
      timestamp: Date.now()
    });
  }

  /**
   * Publish payment receipt to overlay
   */
  private async publishPaymentReceipt(receipt: PaymentReceipt): Promise<void> {
    const topic = TopicGenerator.paymentTopic(receipt.receiptId);
    await this.overlayManager.publishManifest({
      type: 'payment_receipt',
      receipt,
      timestamp: Date.now()
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
  private async validateAndBroadcastTransaction(rawTxHex: string, quote: PaymentQuote): Promise<string> {
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
  private getQuoteFromDatabase(quoteId: string): PaymentQuote | null {
    try {
      const row = this.database.prepare(`
        SELECT * FROM overlay_payment_quotes WHERE quote_id = ?
      `).get(quoteId);

      if (!row) return null;

      return {
        quoteId: row.quote_id,
        receiptId: row.receipt_id,
        versionId: row.version_id,
        amountSat: row.amount_sat,
        outputs: JSON.parse(row.outputs_json),
        expiresAt: row.expires_at,
        templateHash: row.template_hash,
        createdAt: row.created_at
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
    const content = JSON.stringify(outputs.map(o => ({ script: o.scriptHex, amount: o.satoshis })));
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
  getPaymentStats(): {
    quotes: { total: number; active: number; expired: number };
    receipts: { total: number; pending: number; confirmed: number };
  } {
    const now = Date.now();

    const totalQuotes = this.database.prepare(`
      SELECT COUNT(*) as count FROM overlay_payment_quotes
    `).get()?.count || 0;

    const activeQuotes = this.database.prepare(`
      SELECT COUNT(*) as count FROM overlay_payment_quotes WHERE expires_at > ?
    `).get(now)?.count || 0;

    const expiredQuotes = totalQuotes - activeQuotes;

    const totalReceipts = this.database.prepare(`
      SELECT COUNT(*) as count FROM overlay_payment_receipts
    `).get()?.count || 0;

    const pendingReceipts = this.database.prepare(`
      SELECT COUNT(*) as count FROM overlay_payment_receipts WHERE status = 'pending'
    `).get()?.count || 0;

    const confirmedReceipts = this.database.prepare(`
      SELECT COUNT(*) as count FROM overlay_payment_receipts WHERE status = 'confirmed'
    `).get()?.count || 0;

    return {
      quotes: { total: totalQuotes, active: activeQuotes, expired: expiredQuotes },
      receipts: { total: totalReceipts, pending: pendingReceipts, confirmed: confirmedReceipts }
    };
  }

  /**
   * Clean up expired quotes
   */
  cleanupExpiredQuotes(): number {
    const result = this.database.prepare(`
      UPDATE overlay_payment_quotes
      SET status = 'expired'
      WHERE expires_at < ? AND status = 'active'
    `).run(Date.now());

    return result.changes;
  }
}

export { OverlayPaymentService };