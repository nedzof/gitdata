/**
 * D06 - Revenue Management and Analytics Service
 * Comprehensive revenue tracking, analytics, and financial reporting
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

import type { Pool } from 'pg';

export interface RevenueMetrics {
  totalRevenueSatoshis: number;
  netRevenueSatoshis: number;
  platformFeeSatoshis: number;
  agentCommissionSatoshis: number;
  transactionCount: number;
  averageTransactionSatoshis: number;
  uniquePayers: number;
}

export interface RevenueBreakdown {
  byProducer: Array<{
    producerId: string;
    producerName: string;
    revenueSatoshis: number;
    transactionCount: number;
    percentage: number;
  }>;
  byContentCategory: Array<{
    category: string;
    revenueSatoshis: number;
    percentage: number;
  }>;
  byPaymentMethod: Array<{
    method: string;
    revenueSatoshis: number;
    percentage: number;
  }>;
}

export interface AgentMarketplaceMetrics {
  agentRevenueSatoshis: number;
  agentTransactionCount: number;
  topAgents: Array<{
    agentId: string;
    agentName: string;
    spendingSatoshis: number;
    transactionCount: number;
  }>;
}

export interface RevenueTrends {
  revenueGrowthRate: number;
  transactionGrowthRate: number;
  averageTransactionTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface RevenueAnalyticsReport {
  timeRange: {
    startDate: string;
    endDate: string;
    granularity: 'hourly' | 'daily' | 'weekly' | 'monthly';
  };
  revenueMetrics: RevenueMetrics;
  breakdown: RevenueBreakdown;
  agentMarketplace: AgentMarketplaceMetrics;
  trends: RevenueTrends;
  timeSeries: Array<{
    timestamp: string;
    revenueSatoshis: number;
    transactionCount: number;
  }>;
}

export interface CrossNetworkSettlement {
  settlementBatchId: string;
  sourceNetwork: string;
  targetNetwork: string;
  totalReceipts: number;
  totalAmountSatoshis: number;
  settlementTxid?: string;
  settlementFeeSatoshis?: number;
  status: 'pending' | 'broadcasting' | 'confirmed' | 'failed';
  initiatedAt: Date;
  confirmedAt?: Date;
}

export class RevenueAnalyticsService extends EventEmitter {
  private database: Pool;

  constructor(database: Pool) {
    super();
    this.database = database;
  }

  /**
   * Generate comprehensive revenue analytics report
   */
  async generateRevenueReport(params: {
    startDate: Date;
    endDate: Date;
    granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly';
    includeTimeSeries?: boolean;
  }): Promise<RevenueAnalyticsReport> {
    try {
      console.log(
        `📊 Generating revenue analytics report: ${params.startDate.toISOString()} to ${params.endDate.toISOString()}`,
      );

      const granularity = params.granularity || 'daily';

      // Get overall revenue metrics
      const revenueMetrics = await this.getRevenueMetrics(params.startDate, params.endDate);

      // Get revenue breakdown
      const breakdown = await this.getRevenueBreakdown(params.startDate, params.endDate);

      // Get agent marketplace metrics
      const agentMarketplace = await this.getAgentMarketplaceMetrics(
        params.startDate,
        params.endDate,
      );

      // Get revenue trends
      const trends = await this.getRevenueTrends(params.startDate, params.endDate);

      // Get time series data if requested
      const timeSeries = params.includeTimeSeries
        ? await this.getRevenueTimeSeries(params.startDate, params.endDate, granularity)
        : [];

      const report: RevenueAnalyticsReport = {
        timeRange: {
          startDate: params.startDate.toISOString().split('T')[0],
          endDate: params.endDate.toISOString().split('T')[0],
          granularity,
        },
        revenueMetrics,
        breakdown,
        agentMarketplace,
        trends,
        timeSeries,
      };

      console.log(
        `✅ Revenue report generated: ${revenueMetrics.totalRevenueSatoshis} satoshis total revenue`,
      );
      this.emit('report-generated', report);

      return report;
    } catch (error) {
      console.error('❌ Revenue report generation failed:', error);
      throw error;
    }
  }

  /**
   * Record revenue from a payment
   */
  async recordRevenue(params: {
    receiptId: string;
    producerId: string;
    grossRevenueSatoshis: number;
    platformFeeSatoshis: number;
    agentCommissionSatoshis: number;
    paymentMethod: string;
    contentCategory?: string;
    payerRegion?: string;
    agentType?: string;
  }): Promise<void> {
    try {
      const netRevenue =
        params.grossRevenueSatoshis - params.platformFeeSatoshis - params.agentCommissionSatoshis;
      const now = new Date();
      const revenueDate = now.toISOString().split('T')[0];
      const revenueHour = now.getHours();

      await this.database.query(
        `
        INSERT INTO revenue_log (
          receipt_id, producer_id, gross_revenue_satoshis, platform_fee_satoshis,
          agent_commission_satoshis, net_revenue_satoshis, payment_method,
          revenue_date, revenue_hour, content_category, payer_region, agent_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
        [
          params.receiptId,
          params.producerId,
          params.grossRevenueSatoshis,
          params.platformFeeSatoshis,
          params.agentCommissionSatoshis,
          netRevenue,
          params.paymentMethod,
          revenueDate,
          revenueHour,
          params.contentCategory || null,
          params.payerRegion || null,
          params.agentType || null,
        ],
      );

      console.log(
        `💰 Revenue recorded: ${params.grossRevenueSatoshis} satoshis for receipt ${params.receiptId}`,
      );
      this.emit('revenue-recorded', { ...params, netRevenue });
    } catch (error) {
      console.error('Failed to record revenue:', error);
      throw error;
    }
  }

  /**
   * Get overall revenue metrics for a time period
   */
  private async getRevenueMetrics(startDate: Date, endDate: Date): Promise<RevenueMetrics> {
    const result = await this.database.query(
      `
      SELECT
        SUM(gross_revenue_satoshis) as total_revenue,
        SUM(net_revenue_satoshis) as net_revenue,
        SUM(platform_fee_satoshis) as platform_fees,
        SUM(agent_commission_satoshis) as agent_commissions,
        COUNT(*) as transaction_count,
        AVG(gross_revenue_satoshis) as avg_transaction,
        COUNT(DISTINCT receipt_id) as unique_receipts
      FROM revenue_log
      WHERE revenue_date >= $1 AND revenue_date <= $2
    `,
      [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    );

    const row = result.rows[0];

    return {
      totalRevenueSatoshis: parseInt(row.total_revenue || '0'),
      netRevenueSatoshis: parseInt(row.net_revenue || '0'),
      platformFeeSatoshis: parseInt(row.platform_fees || '0'),
      agentCommissionSatoshis: parseInt(row.agent_commissions || '0'),
      transactionCount: parseInt(row.transaction_count || '0'),
      averageTransactionSatoshis: parseInt(row.avg_transaction || '0'),
      uniquePayers: parseInt(row.unique_receipts || '0'),
    };
  }

  /**
   * Get revenue breakdown by various dimensions
   */
  private async getRevenueBreakdown(startDate: Date, endDate: Date): Promise<RevenueBreakdown> {
    // By producer
    const producerResult = await this.database.query(
      `
      SELECT
        rl.producer_id,
        p.display_name as producer_name,
        SUM(rl.gross_revenue_satoshis) as revenue,
        COUNT(*) as transaction_count,
        (SUM(rl.gross_revenue_satoshis) * 100.0 / (
          SELECT SUM(gross_revenue_satoshis) FROM revenue_log
          WHERE revenue_date >= $1 AND revenue_date <= $2
        )) as percentage
      FROM revenue_log rl
      LEFT JOIN producers p ON rl.producer_id = p.producer_id
      WHERE rl.revenue_date >= $1 AND rl.revenue_date <= $2
      GROUP BY rl.producer_id, p.display_name
      ORDER BY revenue DESC
      LIMIT 10
    `,
      [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    );

    // By content category
    const categoryResult = await this.database.query(
      `
      SELECT
        COALESCE(content_category, 'uncategorized') as category,
        SUM(gross_revenue_satoshis) as revenue,
        (SUM(gross_revenue_satoshis) * 100.0 / (
          SELECT SUM(gross_revenue_satoshis) FROM revenue_log
          WHERE revenue_date >= $1 AND revenue_date <= $2
        )) as percentage
      FROM revenue_log
      WHERE revenue_date >= $1 AND revenue_date <= $2
      GROUP BY content_category
      ORDER BY revenue DESC
    `,
      [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    );

    // By payment method
    const methodResult = await this.database.query(
      `
      SELECT
        payment_method as method,
        SUM(gross_revenue_satoshis) as revenue,
        (SUM(gross_revenue_satoshis) * 100.0 / (
          SELECT SUM(gross_revenue_satoshis) FROM revenue_log
          WHERE revenue_date >= $1 AND revenue_date <= $2
        )) as percentage
      FROM revenue_log
      WHERE revenue_date >= $1 AND revenue_date <= $2
      GROUP BY payment_method
      ORDER BY revenue DESC
    `,
      [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    );

    return {
      byProducer: producerResult.rows.map((row) => ({
        producerId: row.producer_id,
        producerName: row.producer_name || row.producer_id,
        revenueSatoshis: parseInt(row.revenue),
        transactionCount: parseInt(row.transaction_count),
        percentage: parseFloat(row.percentage || '0'),
      })),
      byContentCategory: categoryResult.rows.map((row) => ({
        category: row.category,
        revenueSatoshis: parseInt(row.revenue),
        percentage: parseFloat(row.percentage || '0'),
      })),
      byPaymentMethod: methodResult.rows.map((row) => ({
        method: row.method,
        revenueSatoshis: parseInt(row.revenue),
        percentage: parseFloat(row.percentage || '0'),
      })),
    };
  }

  /**
   * Get agent marketplace specific metrics
   */
  private async getAgentMarketplaceMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<AgentMarketplaceMetrics> {
    // Agent revenue metrics
    const agentRevenueResult = await this.database.query(
      `
      SELECT
        SUM(agent_commission_satoshis) as agent_revenue,
        COUNT(*) FILTER (WHERE agent_commission_satoshis > 0) as agent_transactions
      FROM revenue_log
      WHERE revenue_date >= $1 AND revenue_date <= $2
    `,
      [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    );

    // Top spending agents
    const topAgentsResult = await this.database.query(
      `
      SELECT
        or_table.agent_id,
        a.name as agent_name,
        SUM(rl.gross_revenue_satoshis) as spending,
        COUNT(*) as transaction_count
      FROM revenue_log rl
      JOIN overlay_receipts or_table ON rl.receipt_id = or_table.receipt_id
      JOIN agents a ON or_table.agent_id = a.agent_id
      WHERE rl.revenue_date >= $1 AND rl.revenue_date <= $2
        AND or_table.agent_id IS NOT NULL
      GROUP BY or_table.agent_id, a.name
      ORDER BY spending DESC
      LIMIT 10
    `,
      [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    );

    const agentRevenue = agentRevenueResult.rows[0];

    return {
      agentRevenueSatoshis: parseInt(agentRevenue.agent_revenue || '0'),
      agentTransactionCount: parseInt(agentRevenue.agent_transactions || '0'),
      topAgents: topAgentsResult.rows.map((row) => ({
        agentId: row.agent_id,
        agentName: row.agent_name,
        spendingSatoshis: parseInt(row.spending),
        transactionCount: parseInt(row.transaction_count),
      })),
    };
  }

  /**
   * Calculate revenue trends
   */
  private async getRevenueTrends(startDate: Date, endDate: Date): Promise<RevenueTrends> {
    // Calculate growth rates by comparing to previous period
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = startDate;

    const currentPeriodResult = await this.database.query(
      `
      SELECT
        SUM(gross_revenue_satoshis) as revenue,
        COUNT(*) as transactions,
        AVG(gross_revenue_satoshis) as avg_transaction
      FROM revenue_log
      WHERE revenue_date >= $1 AND revenue_date <= $2
    `,
      [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    );

    const previousPeriodResult = await this.database.query(
      `
      SELECT
        SUM(gross_revenue_satoshis) as revenue,
        COUNT(*) as transactions,
        AVG(gross_revenue_satoshis) as avg_transaction
      FROM revenue_log
      WHERE revenue_date >= $1 AND revenue_date < $2
    `,
      [previousStartDate.toISOString().split('T')[0], previousEndDate.toISOString().split('T')[0]],
    );

    const current = currentPeriodResult.rows[0];
    const previous = previousPeriodResult.rows[0];

    const currentRevenue = parseInt(current.revenue || '0');
    const previousRevenue = parseInt(previous.revenue || '0');
    const currentTransactions = parseInt(current.transactions || '0');
    const previousTransactions = parseInt(previous.transactions || '0');
    const currentAvgTransaction = parseInt(current.avg_transaction || '0');
    const previousAvgTransaction = parseInt(previous.avg_transaction || '0');

    const revenueGrowthRate =
      previousRevenue > 0 ? (currentRevenue - previousRevenue) / previousRevenue : 0;

    const transactionGrowthRate =
      previousTransactions > 0
        ? (currentTransactions - previousTransactions) / previousTransactions
        : 0;

    let averageTransactionTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (currentAvgTransaction > previousAvgTransaction * 1.05) {
      averageTransactionTrend = 'increasing';
    } else if (currentAvgTransaction < previousAvgTransaction * 0.95) {
      averageTransactionTrend = 'decreasing';
    }

    return {
      revenueGrowthRate,
      transactionGrowthRate,
      averageTransactionTrend,
    };
  }

  /**
   * Get revenue time series data
   */
  private async getRevenueTimeSeries(
    startDate: Date,
    endDate: Date,
    granularity: 'hourly' | 'daily' | 'weekly' | 'monthly',
  ): Promise<Array<{ timestamp: string; revenueSatoshis: number; transactionCount: number }>> {
    let dateFormat: string;
    let groupBy: string;

    switch (granularity) {
      case 'hourly':
        dateFormat = 'YYYY-MM-DD HH24:00:00';
        groupBy = 'revenue_date, revenue_hour';
        break;
      case 'daily':
        dateFormat = 'YYYY-MM-DD';
        groupBy = 'revenue_date';
        break;
      case 'weekly':
        dateFormat = 'YYYY-"W"WW';
        groupBy = "date_trunc('week', revenue_date::date)";
        break;
      case 'monthly':
        dateFormat = 'YYYY-MM';
        groupBy = "date_trunc('month', revenue_date::date)";
        break;
    }

    const result = await this.database.query(
      `
      SELECT
        CASE
          WHEN $3 = 'hourly' THEN to_char(revenue_date::date + (revenue_hour || ' hours')::interval, $4)
          ELSE to_char(${groupBy}, $4)
        END as timestamp,
        SUM(gross_revenue_satoshis) as revenue,
        COUNT(*) as transactions
      FROM revenue_log
      WHERE revenue_date >= $1 AND revenue_date <= $2
      GROUP BY ${granularity === 'hourly' ? groupBy : `${groupBy}`}
      ORDER BY timestamp
    `,
      [
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        granularity,
        dateFormat,
      ],
    );

    return result.rows.map((row) => ({
      timestamp: row.timestamp,
      revenueSatoshis: parseInt(row.revenue),
      transactionCount: parseInt(row.transactions),
    }));
  }

  /**
   * Initiate cross-network settlement
   */
  async initiateCrossNetworkSettlement(params: {
    sourceNetwork: string;
    targetNetwork: string;
    receiptIds: string[];
    settlementFeeSatoshis?: number;
  }): Promise<CrossNetworkSettlement> {
    try {
      console.log(
        `🔄 Initiating cross-network settlement: ${params.sourceNetwork} -> ${params.targetNetwork}`,
      );

      const settlementBatchId = crypto.randomUUID();

      // Calculate total amount from receipts
      const receiptAmountsResult = await this.database.query(
        `
        SELECT SUM(total_satoshis) as total_amount, COUNT(*) as receipt_count
        FROM overlay_receipts
        WHERE receipt_id = ANY($1) AND status = 'confirmed'
      `,
        [params.receiptIds],
      );

      const totalAmount = parseInt(receiptAmountsResult.rows[0].total_amount || '0');
      const receiptCount = parseInt(receiptAmountsResult.rows[0].receipt_count || '0');

      if (receiptCount === 0) {
        throw new Error('No confirmed receipts found for settlement');
      }

      // Create settlement record
      await this.database.query(
        `
        INSERT INTO cross_network_settlements (
          settlement_batch_id, source_network, target_network,
          total_receipts, total_amount_satoshis, settlement_fee_satoshis,
          status, initiated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
      `,
        [
          settlementBatchId,
          params.sourceNetwork,
          params.targetNetwork,
          receiptCount,
          totalAmount,
          params.settlementFeeSatoshis || 0,
        ],
      );

      // Mark receipts as part of this settlement
      await this.database.query(
        `
        UPDATE overlay_receipts
        SET cross_network_ref = $1, updated_at = NOW()
        WHERE receipt_id = ANY($2)
      `,
        [settlementBatchId, params.receiptIds],
      );

      const settlement: CrossNetworkSettlement = {
        settlementBatchId,
        sourceNetwork: params.sourceNetwork,
        targetNetwork: params.targetNetwork,
        totalReceipts: receiptCount,
        totalAmountSatoshis: totalAmount,
        settlementFeeSatoshis: params.settlementFeeSatoshis || 0,
        status: 'pending',
        initiatedAt: new Date(),
      };

      console.log(
        `✅ Cross-network settlement initiated: ${settlementBatchId} (${totalAmount} satoshis)`,
      );
      this.emit('settlement-initiated', settlement);

      return settlement;
    } catch (error) {
      console.error('❌ Cross-network settlement initiation failed:', error);
      throw error;
    }
  }

  /**
   * Get settlement status
   */
  async getSettlementStatus(settlementBatchId: string): Promise<CrossNetworkSettlement | null> {
    const result = await this.database.query(
      `
      SELECT * FROM cross_network_settlements
      WHERE settlement_batch_id = $1
    `,
      [settlementBatchId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      settlementBatchId: row.settlement_batch_id,
      sourceNetwork: row.source_network,
      targetNetwork: row.target_network,
      totalReceipts: row.total_receipts,
      totalAmountSatoshis: row.total_amount_satoshis,
      settlementTxid: row.settlement_txid,
      settlementFeeSatoshis: row.settlement_fee_satoshis,
      status: row.status,
      initiatedAt: new Date(row.initiated_at),
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
    };
  }
}
