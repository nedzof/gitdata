/**
 * D06 - Agent Marketplace Payment Integration Routes
 * API endpoints for autonomous agent payment management
 */

import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import type { Pool } from 'pg';

import { requireIdentity } from '../middleware/identity';
import { AgentPaymentService } from '../services/agent-payment-service';

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

export function d06AgentPaymentsRouter(database: Pool): Router {
  const router = makeRouter();
  const agentPaymentService = new AgentPaymentService(database);

  /**
   * POST /authorize - Agent payment authorization
   */
  router.post(
    '/authorize',
    requireIdentity(),
    async (req: Request & { identityKey?: string }, res: Response) => {
      try {
        const { agentId, maxPaymentSatoshis, dailyLimitSatoshis, monthlyLimitSatoshis, expiresAt } =
          req.body;

        // Validation
        if (!agentId || !maxPaymentSatoshis || !dailyLimitSatoshis || !monthlyLimitSatoshis) {
          return json(res, 400, {
            error: 'missing-required-fields',
            hint: 'agentId, maxPaymentSatoshis, dailyLimitSatoshis, and monthlyLimitSatoshis are required',
          });
        }

        if (!req.identityKey) {
          return json(res, 401, {
            error: 'identity-required',
            hint: 'BRC-31 identity verification required',
          });
        }

        // Validate limits
        if (maxPaymentSatoshis <= 0 || dailyLimitSatoshis <= 0 || monthlyLimitSatoshis <= 0) {
          return json(res, 400, { error: 'invalid-limits', hint: 'All limits must be positive' });
        }

        if (maxPaymentSatoshis > dailyLimitSatoshis) {
          return json(res, 400, {
            error: 'invalid-limits',
            hint: 'maxPaymentSatoshis cannot exceed dailyLimitSatoshis',
          });
        }

        if (dailyLimitSatoshis * 31 < monthlyLimitSatoshis) {
          return json(res, 400, {
            error: 'invalid-limits',
            hint: 'monthlyLimitSatoshis seems too high relative to dailyLimitSatoshis',
          });
        }

        const authorization = await agentPaymentService.authorizeAgent({
          agentId,
          authorizedBy: req.identityKey,
          maxPaymentSatoshis,
          dailyLimitSatoshis,
          monthlyLimitSatoshis,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        });

        return json(res, 200, {
          authorizationId: authorization.authorizationId,
          agentId: authorization.agentId,
          authorizedBy: authorization.authorizedBy,
          limits: authorization.limits,
          currentUsage: authorization.currentUsage,
          status: authorization.status,
          expiresAt: authorization.expiresAt.toISOString(),
          createdAt: authorization.createdAt.toISOString(),
        });
      } catch (error) {
        console.error('Agent authorization error:', error);
        if (error.message.includes('not found')) {
          return json(res, 404, { error: 'not-found', message: error.message });
        }
        return json(res, 500, { error: 'authorization-failed', message: error.message });
      }
    },
  );

  /**
   * GET /v1/payments/agents/:agentId/authorization - Get agent authorization status
   */
  router.get('/:agentId/authorization', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;

      const authResult = await database.query(
        `
        SELECT apa.*, pi.identity_key as authorizer_identity, a.name as agent_name
        FROM agent_payment_authorizations apa
        JOIN payment_identities pi ON apa.authorized_by = pi.id
        JOIN agents a ON apa.agent_id = a.agent_id
        WHERE apa.agent_id = $1 AND apa.is_active = true
      `,
        [agentId],
      );

      if (authResult.rows.length === 0) {
        return json(res, 404, { error: 'authorization-not-found' });
      }

      const auth = authResult.rows[0];

      return json(res, 200, {
        authorizationId: auth.id,
        agentId: auth.agent_id,
        agentName: auth.agent_name,
        authorizedBy: auth.authorizer_identity,
        limits: {
          maxPaymentSatoshis: auth.max_payment_satoshis,
          dailyLimitSatoshis: auth.daily_limit_satoshis,
          monthlyLimitSatoshis: auth.monthly_limit_satoshis,
        },
        currentUsage: {
          dailySpentSatoshis: auth.daily_spent_satoshis,
          monthlySpentSatoshis: auth.monthly_spent_satoshis,
          lastResetDate: auth.last_reset_date,
        },
        status: auth.is_active && new Date(auth.expires_at) > new Date() ? 'active' : 'expired',
        expiresAt: auth.expires_at,
        createdAt: auth.created_at,
      });
    } catch (error) {
      console.error('Authorization status error:', error);
      return json(res, 500, { error: 'status-check-failed', message: error.message });
    }
  });

  /**
   * GET /v1/payments/agents/:agentId/spending - Agent spending analytics
   */
  router.get('/:agentId/spending', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const timeframe = (req.query.timeframe as string) || 'month';

      if (!['day', 'week', 'month'].includes(timeframe)) {
        return json(res, 400, {
          error: 'invalid-timeframe',
          hint: 'timeframe must be day, week, or month',
        });
      }

      const analytics = await agentPaymentService.getAgentSpendingAnalytics(
        agentId,
        timeframe as 'day' | 'week' | 'month',
      );

      return json(res, 200, {
        agentId: analytics.agentId,
        agentName: analytics.agentName,
        timeframe,
        metrics: {
          totalSpentSatoshis: analytics.totalSpentSatoshis,
          transactionCount: analytics.transactionCount,
          averageTransactionSatoshis: analytics.averageTransactionSatoshis,
          successfulPayments: analytics.successfulPayments,
          failedPayments: analytics.failedPayments,
          successRate: analytics.successRate,
        },
        budgetUtilization: analytics.budgetUtilization,
        topPurchases: analytics.topPurchases,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Spending analytics error:', error);
      if (error.message.includes('not found')) {
        return json(res, 404, { error: 'agent-not-found' });
      }
      return json(res, 500, { error: 'analytics-failed', message: error.message });
    }
  });

  /**
   * POST /v1/payments/agents/:agentId/pay - Autonomous agent payment
   */
  router.post('/:agentId/pay', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { versionId, quantity = 1, purpose, priority = 'normal' } = req.body;

      // Validation
      if (!versionId) {
        return json(res, 400, { error: 'version-id-required' });
      }

      if (!/^[0-9a-fA-F]{64}$/.test(versionId)) {
        return json(res, 400, {
          error: 'invalid-version-id',
          hint: 'versionId must be 64-character hex',
        });
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return json(res, 400, {
          error: 'invalid-quantity',
          hint: 'quantity must be positive integer',
        });
      }

      // Process the payment request
      const result = await agentPaymentService.processAgentPaymentRequest({
        agentId,
        versionId,
        quantity,
        purpose,
        priority: priority as 'low' | 'normal' | 'high',
      });

      if (!result.success) {
        return json(res, 403, {
          error: 'payment-not-authorized',
          reason: result.reason,
        });
      }

      return json(res, 200, {
        success: true,
        receiptId: result.receiptId,
        agentId,
        versionId,
        quantity,
        authorization: result.authorization
          ? {
              authorizationId: result.authorization.authorizationId,
              remainingLimits: {
                dailyRemaining:
                  result.authorization.limits.dailyLimitSatoshis -
                  result.authorization.currentUsage.dailySpentSatoshis,
                monthlyRemaining:
                  result.authorization.limits.monthlyLimitSatoshis -
                  result.authorization.currentUsage.monthlySpentSatoshis,
              },
            }
          : null,
        processedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Agent payment error:', error);
      return json(res, 500, { error: 'payment-failed', message: error.message });
    }
  });

  /**
   * POST /v1/payments/agents/:agentId/suspend - Suspend agent payment authorization
   */
  router.post(
    '/:agentId/suspend',
    requireIdentity(),
    async (req: Request & { identityKey?: string }, res: Response) => {
      try {
        const { agentId } = req.params;
        const { reason } = req.body;

        if (!req.identityKey) {
          return json(res, 401, { error: 'identity-required' });
        }

        // Check if the identity has authority to suspend this agent
        const authResult = await database.query(
          `
        SELECT apa.id, pi.identity_key
        FROM agent_payment_authorizations apa
        JOIN payment_identities pi ON apa.authorized_by = pi.id
        WHERE apa.agent_id = $1 AND pi.identity_key = $2 AND apa.is_active = true
      `,
          [agentId, req.identityKey],
        );

        if (authResult.rows.length === 0) {
          return json(res, 403, {
            error: 'not-authorized',
            hint: 'Only the authorizer can suspend agent payments',
          });
        }

        // Suspend the authorization
        await database.query(
          `
        UPDATE agent_payment_authorizations
        SET is_active = false, updated_at = NOW()
        WHERE agent_id = $1
      `,
          [agentId],
        );

        // Log the suspension
        await database.query(
          `
        INSERT INTO payment_events (
          event_type, agent_id, details_json, created_at
        ) VALUES (
          'agent-suspended', $1, $2, NOW()
        )
      `,
          [agentId, JSON.stringify({ reason, suspendedBy: req.identityKey })],
        );

        return json(res, 200, {
          status: 'suspended',
          agentId,
          suspendedBy: req.identityKey,
          reason,
          suspendedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Agent suspension error:', error);
        return json(res, 500, { error: 'suspension-failed', message: error.message });
      }
    },
  );

  /**
   * GET /v1/payments/agents/summary - Get overview of all agent payment authorizations
   */
  router.get('/summary', requireIdentity(), async (req: Request, res: Response) => {
    try {
      const summaryResult = await database.query(`
        SELECT * FROM agent_payment_summary
        ORDER BY total_spent_satoshis DESC
        LIMIT 50
      `);

      const totalStatsResult = await database.query(`
        SELECT
          COUNT(*) as total_agents,
          COUNT(*) FILTER (WHERE is_active = true) as active_agents,
          SUM(total_spent_satoshis) as total_spent_all_agents,
          AVG(total_spent_satoshis) as avg_spent_per_agent
        FROM agent_payment_summary
      `);

      const totalStats = totalStatsResult.rows[0];

      return json(res, 200, {
        summary: summaryResult.rows.map((row) => ({
          agentId: row.agent_id,
          agentName: row.agent_name,
          limits: {
            maxPaymentSatoshis: row.max_payment_satoshis,
            dailyLimitSatoshis: row.daily_limit_satoshis,
            monthlyLimitSatoshis: row.monthly_limit_satoshis,
          },
          currentUsage: {
            dailySpentSatoshis: row.daily_spent_satoshis,
            monthlySpentSatoshis: row.monthly_spent_satoshis,
          },
          totalMetrics: {
            totalPayments: row.total_payments,
            totalSpentSatoshis: row.total_spent_satoshis,
          },
          status: row.is_active ? 'active' : 'inactive',
        })),
        totals: {
          totalAgents: parseInt(totalStats.total_agents),
          activeAgents: parseInt(totalStats.active_agents),
          totalSpentAllAgents: parseInt(totalStats.total_spent_all_agents || '0'),
          averageSpentPerAgent: parseInt(totalStats.avg_spent_per_agent || '0'),
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Agent summary error:', error);
      return json(res, 500, { error: 'summary-failed', message: error.message });
    }
  });

  return router;
}
