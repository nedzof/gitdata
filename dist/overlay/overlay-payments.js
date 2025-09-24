"use strict";
// BSV Overlay Payment Integration
// Handles payment flows over the overlay network
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverlayPaymentService = void 0;
const events_1 = require("events");
const wallet_1 = require("../lib/wallet");
const overlay_config_1 = require("./overlay-config");
class OverlayPaymentService extends events_1.EventEmitter {
    constructor(overlayManager, database) {
        super();
        this.pendingQuotes = new Map();
        this.pendingPayments = new Map();
        this.overlayManager = overlayManager;
        this.database = database;
        this.setupDatabase();
        this.setupEventHandlers();
    }
    /**
     * Database tables are now created in the main schema at /src/db/postgresql-schema-complete.sql
     * This method is kept for compatibility but no longer creates tables
     */
    setupDatabase() {
        // Tables are now created centrally in the main database schema
        // Overlay payment tables: overlay_payment_quotes, overlay_payment_receipts
        console.log('Overlay payment database tables managed by central schema');
    }
    /**
     * Set up event handlers for overlay payment messages
     */
    setupEventHandlers() {
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
    async createPaymentQuote(request) {
        try {
            // Validate the request
            if (!request.receiptId || !request.versionId || !request.buyerPublicKey) {
                throw new Error('Invalid payment request: missing required fields');
            }
            // Check if version exists and get pricing
            const version = await this.database.queryOne(`
        SELECT v.*, m.unit_price_sat, m.classification
        FROM versions v
        JOIN assets m ON v.version_id = m.version_id
        WHERE v.version_id = $1
      `, [request.versionId]);
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
            const quote = {
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
            await this.database.execute(`
        INSERT INTO overlay_payment_quotes
        (quote_id, receipt_id, version_id, amount_sat, outputs_json, expires_at, template_hash, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (quote_id) DO UPDATE SET
          receipt_id = EXCLUDED.receipt_id,
          version_id = EXCLUDED.version_id,
          amount_sat = EXCLUDED.amount_sat,
          outputs_json = EXCLUDED.outputs_json,
          expires_at = EXCLUDED.expires_at,
          template_hash = EXCLUDED.template_hash,
          created_at = EXCLUDED.created_at
      `, [
                quote.quoteId,
                quote.receiptId,
                quote.versionId,
                quote.amountSat,
                JSON.stringify(quote.outputs),
                quote.expiresAt,
                quote.templateHash,
                quote.createdAt,
            ]);
            this.pendingQuotes.set(quote.quoteId, quote);
            // Publish quote to overlay network
            await this.publishPaymentQuote(quote, request.buyerPublicKey);
            this.emit('quote-created', quote);
            return quote;
        }
        catch (error) {
            throw new Error(`Failed to create payment quote: ${error.message}`);
        }
    }
    /**
     * Process payment submission from overlay
     */
    async processPaymentSubmission(submission) {
        try {
            // Get quote
            const quote = this.pendingQuotes.get(submission.quoteId) || await this.getQuoteFromDatabase(submission.quoteId);
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
            const receipt = {
                receiptId: quote.receiptId,
                txid,
                status: 'pending',
                amountSat: quote.amountSat,
                createdAt: Date.now(),
            };
            // Store receipt
            await this.database.execute(`
        INSERT INTO overlay_payment_receipts
        (receipt_id, quote_id, txid, status, amount_sat, buyer_public_key, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (receipt_id) DO UPDATE SET
          quote_id = EXCLUDED.quote_id,
          txid = EXCLUDED.txid,
          status = EXCLUDED.status,
          amount_sat = EXCLUDED.amount_sat,
          buyer_public_key = EXCLUDED.buyer_public_key,
          created_at = EXCLUDED.created_at
      `, [
                receipt.receiptId,
                quote.quoteId,
                receipt.txid,
                receipt.status,
                receipt.amountSat,
                submission.buyerPublicKey,
                receipt.createdAt,
            ]);
            this.pendingPayments.set(receipt.receiptId, receipt);
            // Publish receipt to overlay
            await this.publishPaymentReceipt(receipt);
            this.emit('payment-received', receipt);
            return receipt;
        }
        catch (error) {
            throw new Error(`Failed to process payment submission: ${error.message}`);
        }
    }
    /**
     * Request payment quote from overlay network
     */
    async requestPaymentQuote(versionId, quantity = 1) {
        try {
            const wallet = wallet_1.walletService.getWallet();
            if (!wallet) {
                throw new Error('Wallet not connected');
            }
            const publicKey = wallet_1.walletService.getPublicKey();
            if (!publicKey) {
                throw new Error('Could not get wallet public key');
            }
            const request = {
                receiptId: this.generateReceiptId(),
                versionId,
                quantity,
                buyerPublicKey: publicKey,
                timestamp: Date.now(),
            };
            // Publish payment request to overlay
            const topic = overlay_config_1.TopicGenerator.paymentTopic(request.receiptId);
            await this.overlayManager.publishAsset({
                type: 'payment_request',
                request,
                timestamp: Date.now(),
            });
            this.emit('quote-requested', request);
        }
        catch (error) {
            throw new Error(`Failed to request payment quote: ${error.message}`);
        }
    }
    /**
     * Submit payment to overlay network
     */
    async submitPayment(quoteId) {
        try {
            const wallet = wallet_1.walletService.getWallet();
            if (!wallet) {
                throw new Error('Wallet not connected');
            }
            const quote = this.pendingQuotes.get(quoteId) || await this.getQuoteFromDatabase(quoteId);
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
                buyerPublicKey: wallet_1.walletService.getPublicKey() || '',
            };
            // Publish payment submission
            const topic = overlay_config_1.TopicGenerator.paymentTopic(quote.receiptId);
            await this.overlayManager.publishAsset({
                type: 'payment_submission',
                submission,
                timestamp: Date.now(),
            });
            // Create local receipt record
            const receipt = {
                receiptId: quote.receiptId,
                txid: txResult.tx, // This would be the actual txid in production
                status: 'pending',
                amountSat: quote.amountSat,
                createdAt: Date.now(),
            };
            this.pendingPayments.set(receipt.receiptId, receipt);
            this.emit('payment-submitted', receipt);
            return receipt;
        }
        catch (error) {
            throw new Error(`Failed to submit payment: ${error.message}`);
        }
    }
    /**
     * Handle incoming payment messages from overlay
     */
    async handlePaymentMessage(data, sender) {
        try {
            if (data.type === 'payment_request') {
                await this.handlePaymentRequestMessage(data.request, sender);
            }
            else if (data.type === 'payment_quote') {
                await this.handlePaymentQuoteMessage(data.quote, sender);
            }
            else if (data.type === 'payment_submission') {
                await this.handlePaymentSubmissionMessage(data.submission, sender);
            }
            else if (data.type === 'payment_receipt') {
                await this.handlePaymentReceiptMessage(data.receipt, sender);
            }
        }
        catch (error) {
            console.error('Failed to handle payment message:', error);
        }
    }
    /**
     * Handle payment request from buyer
     */
    async handlePaymentRequestMessage(request, sender) {
        try {
            // Create and send quote
            const quote = await this.createPaymentQuote(request);
            await this.publishPaymentQuote(quote, request.buyerPublicKey);
        }
        catch (error) {
            console.error('Failed to handle payment request:', error);
        }
    }
    /**
     * Handle payment quote from seller
     */
    async handlePaymentQuoteMessage(quote, sender) {
        try {
            // Store received quote
            this.pendingQuotes.set(quote.quoteId, quote);
            this.emit('quote-received', { quote, sender });
        }
        catch (error) {
            console.error('Failed to handle payment quote:', error);
        }
    }
    /**
     * Handle payment submission from buyer
     */
    async handlePaymentSubmissionMessage(submission, sender) {
        try {
            const receipt = await this.processPaymentSubmission(submission);
            this.emit('payment-processed', { receipt, sender });
        }
        catch (error) {
            console.error('Failed to handle payment submission:', error);
        }
    }
    /**
     * Handle payment receipt from seller
     */
    async handlePaymentReceiptMessage(receipt, sender) {
        try {
            // Update local receipt status
            this.pendingPayments.set(receipt.receiptId, receipt);
            this.emit('receipt-received', { receipt, sender });
        }
        catch (error) {
            console.error('Failed to handle payment receipt:', error);
        }
    }
    /**
     * Publish payment quote to overlay
     */
    async publishPaymentQuote(quote, buyerPublicKey) {
        const topic = overlay_config_1.TopicGenerator.paymentTopic(quote.receiptId);
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
    async publishPaymentReceipt(receipt) {
        const topic = overlay_config_1.TopicGenerator.paymentTopic(receipt.receiptId);
        await this.overlayManager.publishAsset({
            type: 'payment_receipt',
            receipt,
            timestamp: Date.now(),
        });
    }
    /**
     * Handle payment request from overlay
     */
    async handlePaymentRequest(data, sender) {
        try {
            if (data.type === 'payment_request') {
                const quote = await this.createPaymentQuote(data.request);
                await this.publishPaymentQuote(quote, data.request.buyerPublicKey);
            }
        }
        catch (error) {
            console.error('Failed to handle payment request:', error);
        }
    }
    /**
     * Get payment script for producer
     */
    async getPaymentScript() {
        // In production, this would get the producer's payment script from the database
        // For now, return a placeholder
        return '76a914' + '0'.repeat(40) + '88ac'; // P2PKH script template
    }
    /**
     * Get overlay platform fee script
     */
    async getOverlayFeeScript() {
        // Platform fee script
        return '76a914' + '1'.repeat(40) + '88ac'; // P2PKH script template
    }
    /**
     * Validate and broadcast transaction
     */
    async validateAndBroadcastTransaction(rawTxHex, quote) {
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
    async getQuoteFromDatabase(quoteId) {
        try {
            const row = await this.database.queryOne(`
        SELECT * FROM overlay_payment_quotes WHERE quote_id = $1
      `, [quoteId]);
            if (!row)
                return null;
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
        }
        catch (error) {
            console.error('Failed to get quote from database:', error);
            return null;
        }
    }
    /**
     * Generate unique quote ID
     */
    generateQuoteId() {
        return 'quote_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
    /**
     * Generate unique receipt ID
     */
    generateReceiptId() {
        return 'receipt_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
    /**
     * Generate template hash for quote consistency
     */
    generateTemplateHash(outputs) {
        const content = JSON.stringify(outputs.map((o) => ({ script: o.scriptHex, amount: o.satoshis })));
        return Buffer.from(content).toString('base64').substring(0, 16);
    }
    /**
     * Generate mock transaction ID
     */
    generateTxid() {
        return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    /**
     * Get payment statistics
     */
    async getPaymentStats() {
        const now = Date.now();
        const totalQuotesResult = await this.database.queryOne(`
      SELECT COUNT(*) as count FROM overlay_payment_quotes
    `);
        const totalQuotes = totalQuotesResult?.count || 0;
        const activeQuotesResult = await this.database.queryOne(`
      SELECT COUNT(*) as count FROM overlay_payment_quotes WHERE expires_at > $1
    `, [now]);
        const activeQuotes = activeQuotesResult?.count || 0;
        const expiredQuotes = totalQuotes - activeQuotes;
        const totalReceiptsResult = await this.database.queryOne(`
      SELECT COUNT(*) as count FROM overlay_payment_receipts
    `);
        const totalReceipts = totalReceiptsResult?.count || 0;
        const pendingReceiptsResult = await this.database.queryOne(`
      SELECT COUNT(*) as count FROM overlay_payment_receipts WHERE status = 'pending'
    `);
        const pendingReceipts = pendingReceiptsResult?.count || 0;
        const confirmedReceiptsResult = await this.database.queryOne(`
      SELECT COUNT(*) as count FROM overlay_payment_receipts WHERE status = 'confirmed'
    `);
        const confirmedReceipts = confirmedReceiptsResult?.count || 0;
        return {
            quotes: { total: totalQuotes, active: activeQuotes, expired: expiredQuotes },
            receipts: { total: totalReceipts, pending: pendingReceipts, confirmed: confirmedReceipts },
        };
    }
    /**
     * Clean up expired quotes
     */
    async cleanupExpiredQuotes() {
        await this.database.execute(`
      UPDATE overlay_payment_quotes
      SET status = 'expired'
      WHERE expires_at < $1 AND status = 'active'
    `, [Date.now()]);
        // Return number of affected rows (PostgreSQL doesn't provide this directly with execute)
        // For now, return 0 as a placeholder
        return 0;
    }
}
exports.OverlayPaymentService = OverlayPaymentService;
//# sourceMappingURL=overlay-payments.js.map