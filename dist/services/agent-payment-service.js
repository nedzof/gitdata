"use strict";
/**
 * D06 - Agent Marketplace Payment Integration
 * Handles autonomous agent payments with authorization and spending limits
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentPaymentService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
class AgentPaymentService extends events_1.EventEmitter {
    constructor(database) {
        super();
        this.database = database;
    }
    /**
     * Authorize an agent for autonomous payments
     */
    async authorizeAgent(params) {
        try {
            console.log(`🤖 Authorizing agent payment access: ${params.agentId}`);
            // Verify agent exists
            const agentResult = await this.database.query('SELECT agent_id, name FROM agents WHERE agent_id = $1', [params.agentId]);
            if (agentResult.rows.length === 0) {
                throw new Error(`Agent not found: ${params.agentId}`);
            }
            // Verify authorizer identity
            const authorizerResult = await this.database.query('SELECT id FROM payment_identities WHERE identity_key = $1', [params.authorizedBy]);
            if (authorizerResult.rows.length === 0) {
                throw new Error(`Authorizer identity not found: ${params.authorizedBy}`);
            }
            const authorizerId = authorizerResult.rows[0].id;
            const authorizationId = crypto_1.default.randomUUID();
            const expiresAt = params.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year default
            // Insert authorization
            await this.database.query(`
        INSERT INTO agent_payment_authorizations (
          id, agent_id, authorized_by, max_payment_satoshis,
          daily_limit_satoshis, monthly_limit_satoshis,
          daily_spent_satoshis, monthly_spent_satoshis,
          last_reset_date, is_active, expires_at,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 0, 0, CURRENT_DATE, true, $7, NOW(), NOW()
        )
        ON CONFLICT (agent_id) DO UPDATE SET
          authorized_by = EXCLUDED.authorized_by,
          max_payment_satoshis = EXCLUDED.max_payment_satoshis,
          daily_limit_satoshis = EXCLUDED.daily_limit_satoshis,
          monthly_limit_satoshis = EXCLUDED.monthly_limit_satoshis,
          expires_at = EXCLUDED.expires_at,
          is_active = true,
          updated_at = NOW()
      `, [
                authorizationId,
                params.agentId,
                authorizerId,
                params.maxPaymentSatoshis,
                params.dailyLimitSatoshis,
                params.monthlyLimitSatoshis,
                expiresAt,
            ]);
            const authorization = {
                authorizationId,
                agentId: params.agentId,
                authorizedBy: params.authorizedBy,
                limits: {
                    maxPaymentSatoshis: params.maxPaymentSatoshis,
                    dailyLimitSatoshis: params.dailyLimitSatoshis,
                    monthlyLimitSatoshis: params.monthlyLimitSatoshis,
                },
                currentUsage: {
                    dailySpentSatoshis: 0,
                    monthlySpentSatoshis: 0,
                    lastResetDate: new Date().toISOString().split('T')[0],
                },
                status: 'active',
                expiresAt,
                createdAt: new Date(),
            };
            console.log(`✅ Agent payment authorization created: ${authorizationId}`);
            this.emit('agent-authorized', authorization);
            return authorization;
        }
        catch (error) {
            console.error('❌ Agent authorization failed:', error);
            throw error;
        }
    }
    /**
     * Check if agent is authorized for a specific payment
     */
    async checkPaymentAuthorization(agentId, paymentAmountSatoshis) {
        try {
            // Get current authorization
            const authResult = await this.database.query(`
        SELECT apa.*, pi.identity_key as authorizer_identity
        FROM agent_payment_authorizations apa
        JOIN payment_identities pi ON apa.authorized_by = pi.id
        WHERE apa.agent_id = $1 AND apa.is_active = true
      `, [agentId]);
            if (authResult.rows.length === 0) {
                return {
                    authorized: false,
                    reason: 'No active authorization found for agent',
                };
            }
            const auth = authResult.rows[0];
            // Check expiration
            if (new Date(auth.expires_at) < new Date()) {
                return {
                    authorized: false,
                    reason: 'Authorization expired',
                };
            }
            // Reset spending limits if needed (daily/monthly)
            await this.resetSpendingLimitsIfNeeded(agentId);
            // Get current spending
            const currentSpending = await this.getCurrentSpending(agentId);
            // Check limits
            if (paymentAmountSatoshis > auth.max_payment_satoshis) {
                return {
                    authorized: false,
                    reason: `Payment amount ${paymentAmountSatoshis} exceeds maximum per-payment limit ${auth.max_payment_satoshis}`,
                };
            }
            if (currentSpending.dailySpent + paymentAmountSatoshis > auth.daily_limit_satoshis) {
                return {
                    authorized: false,
                    reason: `Payment would exceed daily limit. Current: ${currentSpending.dailySpent}, Limit: ${auth.daily_limit_satoshis}`,
                };
            }
            if (currentSpending.monthlySpent + paymentAmountSatoshis > auth.monthly_limit_satoshis) {
                return {
                    authorized: false,
                    reason: `Payment would exceed monthly limit. Current: ${currentSpending.monthlySpent}, Limit: ${auth.monthly_limit_satoshis}`,
                };
            }
            const authorization = {
                authorizationId: auth.id,
                agentId: auth.agent_id,
                authorizedBy: auth.authorizer_identity,
                limits: {
                    maxPaymentSatoshis: auth.max_payment_satoshis,
                    dailyLimitSatoshis: auth.daily_limit_satoshis,
                    monthlyLimitSatoshis: auth.monthly_limit_satoshis,
                },
                currentUsage: {
                    dailySpentSatoshis: currentSpending.dailySpent,
                    monthlySpentSatoshis: currentSpending.monthlySpent,
                    lastResetDate: auth.last_reset_date,
                },
                status: 'active',
                expiresAt: new Date(auth.expires_at),
                createdAt: new Date(auth.created_at),
            };
            return {
                authorized: true,
                authorization,
            };
        }
        catch (error) {
            console.error('Authorization check failed:', error);
            return {
                authorized: false,
                reason: 'Authorization check error: ' + error.message,
            };
        }
    }
    /**
     * Record agent payment and update spending limits
     */
    async recordAgentPayment(agentId, receiptId, amountSatoshis, successful) {
        try {
            if (successful) {
                // Update spending amounts
                await this.database.query(`
          UPDATE agent_payment_authorizations
          SET daily_spent_satoshis = daily_spent_satoshis + $2,
              monthly_spent_satoshis = monthly_spent_satoshis + $2,
              updated_at = NOW()
          WHERE agent_id = $1
        `, [agentId, amountSatoshis]);
            }
            // Record in spending analytics
            await this.recordSpendingAnalytics(agentId, amountSatoshis, successful);
            console.log(`📊 Recorded agent payment: ${agentId} - ${amountSatoshis} satoshis (${successful ? 'success' : 'failed'})`);
            this.emit('agent-payment-recorded', {
                agentId,
                receiptId,
                amountSatoshis,
                successful,
                timestamp: new Date(),
            });
        }
        catch (error) {
            console.error('Failed to record agent payment:', error);
            throw error;
        }
    }
    /**
     * Get agent spending analytics
     */
    async getAgentSpendingAnalytics(agentId, timeframe = 'month') {
        try {
            const timeCondition = timeframe === 'day'
                ? "interval '1 day'"
                : timeframe === 'week'
                    ? "interval '7 days'"
                    : "interval '30 days'";
            // Get agent info
            const agentResult = await this.database.query('SELECT agent_id, name FROM agents WHERE agent_id = $1', [agentId]);
            if (agentResult.rows.length === 0) {
                throw new Error(`Agent not found: ${agentId}`);
            }
            const agent = agentResult.rows[0];
            // Get spending statistics
            const statsResult = await this.database.query(`
        SELECT
          SUM(total_spent_satoshis) as total_spent,
          SUM(transaction_count) as total_transactions,
          AVG(average_transaction_satoshis) as avg_transaction,
          SUM(successful_payments) as successful_payments,
          SUM(failed_payments) as failed_payments
        FROM agent_spending_analytics
        WHERE agent_id = $1 AND period_start >= NOW() - ${timeCondition}
      `, [agentId]);
            const stats = statsResult.rows[0];
            // Get current limits and usage
            const authResult = await this.database.query(`
        SELECT daily_limit_satoshis, monthly_limit_satoshis,
               daily_spent_satoshis, monthly_spent_satoshis
        FROM agent_payment_authorizations
        WHERE agent_id = $1 AND is_active = true
      `, [agentId]);
            const auth = authResult.rows[0];
            // Get top purchases
            const purchasesResult = await this.database.query(`
        SELECT r.version_id, m.title, r.total_satoshis, r.created_at
        FROM overlay_receipts r
        LEFT JOIN manifests m ON r.version_id = m.version_id
        WHERE r.agent_id = $1 AND r.created_at >= NOW() - ${timeCondition}
        ORDER BY r.total_satoshis DESC
        LIMIT 10
      `, [agentId]);
            const totalSpent = parseInt(stats.total_spent || '0');
            const totalTransactions = parseInt(stats.total_transactions || '0');
            const successfulPayments = parseInt(stats.successful_payments || '0');
            const failedPayments = parseInt(stats.failed_payments || '0');
            const analytics = {
                agentId,
                agentName: agent.name,
                totalSpentSatoshis: totalSpent,
                transactionCount: totalTransactions,
                averageTransactionSatoshis: totalTransactions > 0 ? Math.floor(totalSpent / totalTransactions) : 0,
                successfulPayments,
                failedPayments,
                successRate: totalTransactions > 0 ? successfulPayments / totalTransactions : 0,
                budgetUtilization: auth
                    ? {
                        dailyPercent: auth.daily_limit_satoshis > 0
                            ? (auth.daily_spent_satoshis / auth.daily_limit_satoshis) * 100
                            : 0,
                        monthlyPercent: auth.monthly_limit_satoshis > 0
                            ? (auth.monthly_spent_satoshis / auth.monthly_limit_satoshis) * 100
                            : 0,
                    }
                    : { dailyPercent: 0, monthlyPercent: 0 },
                topPurchases: purchasesResult.rows.map((row) => ({
                    versionId: row.version_id,
                    title: row.title || 'Unknown',
                    amountSatoshis: row.total_satoshis,
                    timestamp: new Date(row.created_at),
                })),
            };
            return analytics;
        }
        catch (error) {
            console.error('Failed to get agent spending analytics:', error);
            throw error;
        }
    }
    /**
     * Process autonomous agent payment request
     */
    async processAgentPaymentRequest(request) {
        try {
            console.log(`🤖 Processing agent payment request: ${request.agentId} for ${request.versionId}`);
            // Get pricing for the requested asset
            const { getBestUnitPrice } = await Promise.resolve().then(() => __importStar(require('../db')));
            const defaultPrice = parseInt(process.env.PRICE_DEFAULT_SATS || '5000');
            const pricing = await getBestUnitPrice(request.versionId, request.quantity, defaultPrice);
            const totalAmount = pricing.satoshis * request.quantity;
            // Check authorization
            const authCheck = await this.checkPaymentAuthorization(request.agentId, totalAmount);
            if (!authCheck.authorized) {
                return {
                    success: false,
                    reason: authCheck.reason,
                };
            }
            // Create payment via the payment processing system
            const { d06PaymentProcessingRouter } = await Promise.resolve().then(() => __importStar(require('../routes/d06-payment-processing')));
            // This would integrate with the main payment processing endpoint
            // For now, we'll create a receipt directly
            const receiptId = crypto_1.default.randomUUID();
            // Record the payment
            await this.recordAgentPayment(request.agentId, receiptId, totalAmount, true);
            console.log(`✅ Agent payment processed successfully: ${receiptId}`);
            return {
                success: true,
                receiptId,
                authorization: authCheck.authorization,
            };
        }
        catch (error) {
            console.error('❌ Agent payment request failed:', error);
            return {
                success: false,
                reason: 'Payment processing error: ' + error.message,
            };
        }
    }
    /**
     * Reset spending limits if date has changed
     */
    async resetSpendingLimitsIfNeeded(agentId) {
        const today = new Date().toISOString().split('T')[0];
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        await this.database.query(`
      UPDATE agent_payment_authorizations
      SET
        daily_spent_satoshis = CASE
          WHEN last_reset_date < $2 THEN 0
          ELSE daily_spent_satoshis
        END,
        monthly_spent_satoshis = CASE
          WHEN DATE_TRUNC('month', last_reset_date) < DATE_TRUNC('month', $2::date) THEN 0
          ELSE monthly_spent_satoshis
        END,
        last_reset_date = $2
      WHERE agent_id = $1
    `, [agentId, today]);
    }
    /**
     * Get current spending for an agent
     */
    async getCurrentSpending(agentId) {
        const result = await this.database.query(`
      SELECT daily_spent_satoshis, monthly_spent_satoshis
      FROM agent_payment_authorizations
      WHERE agent_id = $1
    `, [agentId]);
        if (result.rows.length === 0) {
            return { dailySpent: 0, monthlySpent: 0 };
        }
        return {
            dailySpent: parseInt(result.rows[0].daily_spent_satoshis),
            monthlySpent: parseInt(result.rows[0].monthly_spent_satoshis),
        };
    }
    /**
     * Record spending analytics data
     */
    async recordSpendingAnalytics(agentId, amountSatoshis, successful) {
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
        await this.database.query(`
      INSERT INTO agent_spending_analytics (
        agent_id, period_start, period_end, period_type,
        total_spent_satoshis, transaction_count, average_transaction_satoshis,
        successful_payments, failed_payments, success_rate
      ) VALUES (
        $1, $2, $3, 'daily', $4, 1, $4, $5, $6, $7
      )
      ON CONFLICT (agent_id, period_start, period_type) DO UPDATE SET
        total_spent_satoshis = agent_spending_analytics.total_spent_satoshis + EXCLUDED.total_spent_satoshis,
        transaction_count = agent_spending_analytics.transaction_count + 1,
        average_transaction_satoshis = (agent_spending_analytics.total_spent_satoshis + EXCLUDED.total_spent_satoshis) / (agent_spending_analytics.transaction_count + 1),
        successful_payments = agent_spending_analytics.successful_payments + EXCLUDED.successful_payments,
        failed_payments = agent_spending_analytics.failed_payments + EXCLUDED.failed_payments,
        success_rate = CASE
          WHEN (agent_spending_analytics.transaction_count + 1) > 0
          THEN (agent_spending_analytics.successful_payments + EXCLUDED.successful_payments)::decimal / (agent_spending_analytics.transaction_count + 1)
          ELSE 0
        END
    `, [
            agentId,
            periodStart,
            periodEnd,
            amountSatoshis,
            successful ? 1 : 0,
            successful ? 0 : 1,
            successful ? 1.0 : 0.0,
        ]);
    }
}
exports.AgentPaymentService = AgentPaymentService;
//# sourceMappingURL=agent-payment-service.js.map