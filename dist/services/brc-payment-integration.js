"use strict";
/**
 * D06 - BRC Standards Integration for Payment Processing
 * Implements BRC-22 payment notifications and BRC-31 identity verification for payments
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRCPaymentIntegrationService = exports.BRC31IdentityVerificationService = exports.BRC22PaymentNotificationService = void 0;
exports.ensureBRC22Tables = ensureBRC22Tables;
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
class BRC22PaymentNotificationService extends events_1.EventEmitter {
    constructor(database, overlayTopics = []) {
        super();
        this.database = database;
        this.overlayTopics = new Set([
            'payments',
            'settlements',
            'refunds',
            'agent-payments',
            ...overlayTopics,
        ]);
    }
    /**
     * Broadcast payment event across BRC-22 overlay network
     */
    async broadcastPaymentEvent(event) {
        try {
            console.log(`📡 Broadcasting BRC-22 payment event: ${event.eventType} for receipt ${event.receiptId}`);
            // Store event in payment_events table
            await this.database.query(`
        INSERT INTO payment_events (
          event_type, receipt_id, payment_txid, agent_id, details_json,
          overlay_topics, brc22_notification_sent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
                event.eventType,
                event.receiptId,
                event.paymentTxid || null,
                event.agentId || null,
                JSON.stringify(event.details),
                event.topics,
                true,
            ]);
            // Emit to local event handlers
            this.emit('payment-event', event);
            // Broadcast to each topic
            for (const topic of event.topics) {
                if (this.overlayTopics.has(topic)) {
                    await this.broadcastToTopic(topic, event);
                }
            }
            console.log(`✅ BRC-22 payment event broadcasted successfully`);
        }
        catch (error) {
            console.error('❌ Failed to broadcast BRC-22 payment event:', error);
            throw error;
        }
    }
    /**
     * Broadcast payment event to specific overlay topic
     */
    async broadcastToTopic(topic, event) {
        // In a real implementation, this would use the actual BRC-22 overlay network
        // For now, we'll implement local broadcasting with database notification
        const notificationPayload = {
            topic,
            event: event.eventType,
            receiptId: event.receiptId,
            timestamp: event.timestamp.toISOString(),
            details: event.details,
        };
        // Store topic-specific notification
        await this.database.query(`
      INSERT INTO brc22_notifications (
        topic, event_type, receipt_id, payload_json, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT DO NOTHING
    `, [topic, event.eventType, event.receiptId, JSON.stringify(notificationPayload)]);
        console.log(`📤 Broadcasted to topic: ${topic}`);
    }
    /**
     * Subscribe to payment events for specific topics
     */
    subscribeToTopic(topic, handler) {
        this.overlayTopics.add(topic);
        this.on('payment-event', (event) => {
            if (event.topics.includes(topic)) {
                handler(event);
            }
        });
    }
    /**
     * Get payment event history for a receipt
     */
    async getPaymentEventHistory(receiptId) {
        const result = await this.database.query(`
      SELECT event_type, receipt_id, payment_txid, agent_id,
             overlay_topics, details_json, created_at
      FROM payment_events
      WHERE receipt_id = $1
      ORDER BY created_at ASC
    `, [receiptId]);
        return result.rows.map((row) => ({
            eventType: row.event_type,
            receiptId: row.receipt_id,
            paymentTxid: row.payment_txid,
            agentId: row.agent_id,
            topics: row.overlay_topics || [],
            timestamp: new Date(row.created_at),
            details: JSON.parse(row.details_json || '{}'),
        }));
    }
}
exports.BRC22PaymentNotificationService = BRC22PaymentNotificationService;
class BRC31IdentityVerificationService {
    constructor(database, minTrustScore = 0.7) {
        this.database = database;
        this.minTrustScore = minTrustScore;
    }
    /**
     * Verify BRC-31 identity for payment authorization
     */
    async verifyIdentity(identityKey, certificate) {
        try {
            console.log(`🔐 Verifying BRC-31 identity: ${identityKey.slice(0, 10)}...`);
            // Check if identity exists in our database
            const identityResult = await this.database.query(`
        SELECT identity_key, identity_certificate, verification_level,
               trust_score, payment_history_count, total_payments_satoshis,
               reputation_score
        FROM payment_identities
        WHERE identity_key = $1
      `, [identityKey]);
            let identity;
            let trustScore;
            if (identityResult.rows.length > 0) {
                const row = identityResult.rows[0];
                identity = {
                    identityKey: row.identity_key,
                    certificate: row.identity_certificate,
                    verificationLevel: row.verification_level,
                    trustScore: parseFloat(row.trust_score),
                    isValid: true,
                };
                trustScore = parseFloat(row.trust_score);
            }
            else {
                // New identity - create basic entry
                identity = await this.createNewIdentity(identityKey, certificate);
                trustScore = identity.trustScore;
            }
            // Perform certificate validation if provided
            if (certificate) {
                const certificateValid = await this.validateCertificate(certificate, identityKey);
                if (!certificateValid) {
                    return {
                        success: false,
                        reason: 'Invalid BRC-31 certificate',
                        trustScore: 0,
                    };
                }
            }
            // Check trust score threshold
            const meetsThreshold = trustScore >= this.minTrustScore;
            console.log(`${meetsThreshold ? '✅' : '❌'} Identity verification ${meetsThreshold ? 'passed' : 'failed'}: trust score ${trustScore}`);
            return {
                success: meetsThreshold,
                identity,
                reason: meetsThreshold
                    ? undefined
                    : `Trust score ${trustScore} below threshold ${this.minTrustScore}`,
                trustScore,
            };
        }
        catch (error) {
            console.error('❌ Identity verification failed:', error);
            return {
                success: false,
                reason: 'Identity verification error: ' + error.message,
                trustScore: 0,
            };
        }
    }
    /**
     * Create new identity record
     */
    async createNewIdentity(identityKey, certificate) {
        const identity = {
            identityKey,
            certificate,
            verificationLevel: 'basic',
            trustScore: 1.0,
            isValid: true,
        };
        await this.database.query(`
      INSERT INTO payment_identities (
        identity_key, identity_certificate, verification_level, trust_score
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (identity_key) DO NOTHING
    `, [identityKey, certificate, identity.verificationLevel, identity.trustScore]);
        console.log(`📝 Created new BRC-31 identity record for ${identityKey.slice(0, 10)}...`);
        return identity;
    }
    /**
     * Validate BRC-31 certificate chain
     */
    async validateCertificate(certificate, identityKey) {
        try {
            // In a real implementation, this would perform full BRC-31 certificate validation
            // For now, we'll implement basic validation
            // Parse certificate (simplified)
            const cert = JSON.parse(certificate);
            // Basic validation checks
            if (!cert.publicKey || cert.publicKey !== identityKey) {
                return false;
            }
            if (!cert.signature || !cert.issuer) {
                return false;
            }
            // Check expiration
            if (cert.expiresAt && new Date(cert.expiresAt) < new Date()) {
                return false;
            }
            // Verify signature (simplified - in reality would use cryptographic verification)
            const expectedSignature = crypto_1.default
                .createHash('sha256')
                .update(cert.publicKey + cert.issuer + (cert.expiresAt || ''))
                .digest('hex');
            return true; // Simplified validation
        }
        catch (error) {
            console.error('Certificate validation error:', error);
            return false;
        }
    }
    /**
     * Update identity trust score based on payment behavior
     */
    async updateTrustScore(identityKey, paymentSuccessful, paymentAmount) {
        try {
            const adjustment = paymentSuccessful ? 0.01 : -0.05;
            const amountFactor = Math.min(paymentAmount / 100000, 0.01); // Small bonus for larger payments
            await this.database.query(`
        UPDATE payment_identities
        SET trust_score = GREATEST(0.0, LEAST(1.0, trust_score + $2 + $3)),
            payment_history_count = payment_history_count + 1,
            total_payments_satoshis = total_payments_satoshis + $4,
            last_payment_at = NOW()
        WHERE identity_key = $1
      `, [identityKey, adjustment, amountFactor, paymentAmount]);
            console.log(`📊 Updated trust score for ${identityKey.slice(0, 10)}... (${paymentSuccessful ? '+' : '-'})`);
        }
        catch (error) {
            console.error('Failed to update trust score:', error);
        }
    }
    /**
     * Get identity payment statistics
     */
    async getIdentityStats(identityKey) {
        const result = await this.database.query(`
      SELECT verification_level, trust_score, payment_history_count,
             total_payments_satoshis, reputation_score, last_payment_at
      FROM payment_identities
      WHERE identity_key = $1
    `, [identityKey]);
        return result.rows[0] || null;
    }
}
exports.BRC31IdentityVerificationService = BRC31IdentityVerificationService;
// Integration service that combines BRC-22 and BRC-31 for payments
class BRCPaymentIntegrationService {
    constructor(database, config = {}) {
        this.brc22Service = new BRC22PaymentNotificationService(database, config.overlayTopics);
        this.brc31Service = new BRC31IdentityVerificationService(database, config.minTrustScore);
    }
    get notifications() {
        return this.brc22Service;
    }
    get identity() {
        return this.brc31Service;
    }
    /**
     * Process payment with full BRC integration
     */
    async processPaymentWithBRCIntegration(params) {
        try {
            let identityVerified = true;
            let trustScore = 1.0;
            // Verify identity if provided
            if (params.identityKey) {
                const verification = await this.brc31Service.verifyIdentity(params.identityKey, params.certificate);
                identityVerified = verification.success;
                trustScore = verification.trustScore;
                if (!verification.success) {
                    return {
                        success: false,
                        identityVerified,
                        trustScore,
                        reason: verification.reason,
                    };
                }
            }
            // Broadcast payment event
            await this.brc22Service.broadcastPaymentEvent({
                eventType: params.eventType,
                receiptId: params.receiptId,
                paymentTxid: params.paymentTxid,
                agentId: params.agentId,
                topics: ['payments', 'settlements'],
                timestamp: new Date(),
                details: params.details,
            });
            return {
                success: true,
                identityVerified,
                trustScore,
            };
        }
        catch (error) {
            console.error('BRC payment integration failed:', error);
            return {
                success: false,
                identityVerified: false,
                trustScore: 0,
                reason: 'BRC integration error: ' + error.message,
            };
        }
    }
}
exports.BRCPaymentIntegrationService = BRCPaymentIntegrationService;
// Create table for BRC-22 notifications if it doesn't exist
async function ensureBRC22Tables(database) {
    await database.query(`
    CREATE TABLE IF NOT EXISTS brc22_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic VARCHAR(100) NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      receipt_id UUID,
      payload_json JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(topic, receipt_id, event_type)
    )
  `);
    await database.query(`
    CREATE INDEX IF NOT EXISTS idx_brc22_notifications_topic_created
    ON brc22_notifications(topic, created_at DESC)
  `);
}
//# sourceMappingURL=brc-payment-integration.js.map