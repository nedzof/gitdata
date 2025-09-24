"use strict";
/**
 * D06 - Revenue Management and Analytics API Routes
 * Comprehensive revenue tracking, analytics, and financial reporting endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.d06RevenueManagementRouter = d06RevenueManagementRouter;
const express_1 = require("express");
const identity_1 = require("../middleware/identity");
const revenue_analytics_1 = require("../services/revenue-analytics");
function json(res, code, body) {
    return res.status(code).json(body);
}
function parseDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${dateString}`);
    }
    return date;
}
function d06RevenueManagementRouter(database) {
    const router = (0, express_1.Router)();
    const revenueService = new revenue_analytics_1.RevenueAnalyticsService(database);
    /**
     * GET /v1/revenue/analytics - Comprehensive revenue analytics
     */
    router.get('/analytics', (0, identity_1.requireIdentity)(), async (req, res) => {
        try {
            const { startDate, endDate, granularity = 'daily', includeTimeSeries = 'true' } = req.query;
            // Validation
            if (!startDate || !endDate) {
                return json(res, 400, {
                    error: 'missing-date-range',
                    hint: 'startDate and endDate query parameters required (YYYY-MM-DD format)',
                });
            }
            if (!['hourly', 'daily', 'weekly', 'monthly'].includes(granularity)) {
                return json(res, 400, {
                    error: 'invalid-granularity',
                    hint: 'granularity must be one of: hourly, daily, weekly, monthly',
                });
            }
            const start = parseDate(startDate);
            const end = parseDate(endDate);
            if (start >= end) {
                return json(res, 400, {
                    error: 'invalid-date-range',
                    hint: 'startDate must be before endDate',
                });
            }
            // Check for reasonable date range
            const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff > 365) {
                return json(res, 400, {
                    error: 'date-range-too-large',
                    hint: 'Date range cannot exceed 365 days',
                });
            }
            const report = await revenueService.generateRevenueReport({
                startDate: start,
                endDate: end,
                granularity: granularity,
                includeTimeSeries: includeTimeSeries === 'true',
            });
            return json(res, 200, report);
        }
        catch (error) {
            console.error('Revenue analytics error:', error);
            if (error.message.includes('Invalid date')) {
                return json(res, 400, { error: 'invalid-date-format', message: error.message });
            }
            return json(res, 500, { error: 'analytics-generation-failed', message: error.message });
        }
    });
    /**
     * GET /v1/revenue/summary - Quick revenue summary
     */
    router.get('/summary', (0, identity_1.requireIdentity)(), async (req, res) => {
        try {
            const timeframe = req.query.timeframe || 'month';
            let startDate;
            const endDate = new Date();
            switch (timeframe) {
                case 'day':
                    startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case 'week':
                    startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'year':
                    startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    return json(res, 400, {
                        error: 'invalid-timeframe',
                        hint: 'timeframe must be day, week, month, or year',
                    });
            }
            // Get quick metrics from revenue_analytics_daily view
            const result = await database.query(`
        SELECT
          SUM(daily_gross_revenue) as total_revenue,
          SUM(daily_net_revenue) as net_revenue,
          SUM(daily_platform_fees) as platform_fees,
          SUM(daily_agent_commissions) as agent_commissions,
          SUM(transaction_count) as total_transactions,
          COUNT(DISTINCT revenue_date) as active_days
        FROM revenue_analytics_daily
        WHERE revenue_date >= $1 AND revenue_date <= $2
      `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);
            const summary = result.rows[0];
            return json(res, 200, {
                timeframe,
                period: {
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0],
                },
                metrics: {
                    totalRevenueSatoshis: parseInt(summary.total_revenue || '0'),
                    netRevenueSatoshis: parseInt(summary.net_revenue || '0'),
                    platformFeeSatoshis: parseInt(summary.platform_fees || '0'),
                    agentCommissionSatoshis: parseInt(summary.agent_commissions || '0'),
                    transactionCount: parseInt(summary.total_transactions || '0'),
                    activeDays: parseInt(summary.active_days || '0'),
                    averageDailyRevenue: summary.active_days > 0
                        ? Math.floor(parseInt(summary.total_revenue || '0') / parseInt(summary.active_days))
                        : 0,
                },
                generatedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('Revenue summary error:', error);
            return json(res, 500, { error: 'summary-generation-failed', message: error.message });
        }
    });
    /**
     * GET /v1/revenue/producers/:producerId - Producer-specific revenue analytics
     */
    router.get('/producers/:producerId', (0, identity_1.requireIdentity)(), async (req, res) => {
        try {
            const { producerId } = req.params;
            const { startDate, endDate, granularity = 'daily' } = req.query;
            // Use default time range if not provided
            const end = endDate ? parseDate(endDate) : new Date();
            const start = startDate
                ? parseDate(startDate)
                : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
            // Get producer information
            const producerResult = await database.query('SELECT producer_id, display_name FROM producers WHERE producer_id = $1', [producerId]);
            if (producerResult.rows.length === 0) {
                return json(res, 404, { error: 'producer-not-found' });
            }
            const producer = producerResult.rows[0];
            // Get producer revenue metrics
            const metricsResult = await database.query(`
        SELECT
          SUM(gross_revenue_satoshis) as total_revenue,
          SUM(net_revenue_satoshis) as net_revenue,
          SUM(platform_fee_satoshis) as platform_fees,
          COUNT(*) as transaction_count,
          AVG(gross_revenue_satoshis) as avg_transaction
        FROM revenue_log
        WHERE producer_id = $1 AND revenue_date >= $2 AND revenue_date <= $3
      `, [producerId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]]);
            const metrics = metricsResult.rows[0];
            // Get time series data
            let timeSeriesQuery = '';
            let groupBy = '';
            switch (granularity) {
                case 'daily':
                    timeSeriesQuery = 'revenue_date as date';
                    groupBy = 'revenue_date';
                    break;
                case 'weekly':
                    timeSeriesQuery = "date_trunc('week', revenue_date::date) as date";
                    groupBy = "date_trunc('week', revenue_date::date)";
                    break;
                case 'monthly':
                    timeSeriesQuery = "date_trunc('month', revenue_date::date) as date";
                    groupBy = "date_trunc('month', revenue_date::date)";
                    break;
                default:
                    return json(res, 400, { error: 'invalid-granularity' });
            }
            const timeSeriesResult = await database.query(`
        SELECT
          ${timeSeriesQuery},
          SUM(gross_revenue_satoshis) as revenue,
          COUNT(*) as transactions
        FROM revenue_log
        WHERE producer_id = $1 AND revenue_date >= $2 AND revenue_date <= $3
        GROUP BY ${groupBy}
        ORDER BY date
      `, [producerId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]]);
            return json(res, 200, {
                producer: {
                    producerId: producer.producer_id,
                    displayName: producer.display_name,
                },
                timeRange: {
                    startDate: start.toISOString().split('T')[0],
                    endDate: end.toISOString().split('T')[0],
                    granularity,
                },
                metrics: {
                    totalRevenueSatoshis: parseInt(metrics.total_revenue || '0'),
                    netRevenueSatoshis: parseInt(metrics.net_revenue || '0'),
                    platformFeeSatoshis: parseInt(metrics.platform_fees || '0'),
                    transactionCount: parseInt(metrics.transaction_count || '0'),
                    averageTransactionSatoshis: parseInt(metrics.avg_transaction || '0'),
                },
                timeSeries: timeSeriesResult.rows.map((row) => ({
                    date: row.date,
                    revenueSatoshis: parseInt(row.revenue),
                    transactionCount: parseInt(row.transactions),
                })),
            });
        }
        catch (error) {
            console.error('Producer revenue analytics error:', error);
            return json(res, 500, { error: 'producer-analytics-failed', message: error.message });
        }
    });
    /**
     * POST /v1/revenue/settlements - Cross-network settlement management
     */
    router.post('/settlements', (0, identity_1.requireIdentity)(), async (req, res) => {
        try {
            const { sourceNetwork, targetNetwork, receiptIds, settlementFeeSatoshis } = req.body;
            // Validation
            if (!sourceNetwork || !targetNetwork || !receiptIds || !Array.isArray(receiptIds)) {
                return json(res, 400, {
                    error: 'missing-required-fields',
                    hint: 'sourceNetwork, targetNetwork, and receiptIds array required',
                });
            }
            if (receiptIds.length === 0) {
                return json(res, 400, {
                    error: 'empty-receipt-list',
                    hint: 'At least one receipt ID required',
                });
            }
            if (receiptIds.length > 1000) {
                return json(res, 400, {
                    error: 'too-many-receipts',
                    hint: 'Maximum 1000 receipts per settlement batch',
                });
            }
            const settlement = await revenueService.initiateCrossNetworkSettlement({
                sourceNetwork,
                targetNetwork,
                receiptIds,
                settlementFeeSatoshis: settlementFeeSatoshis || 0,
            });
            return json(res, 200, {
                settlementBatchId: settlement.settlementBatchId,
                sourceNetwork: settlement.sourceNetwork,
                targetNetwork: settlement.targetNetwork,
                totalReceipts: settlement.totalReceipts,
                totalAmountSatoshis: settlement.totalAmountSatoshis,
                settlementFeeSatoshis: settlement.settlementFeeSatoshis,
                status: settlement.status,
                initiatedAt: settlement.initiatedAt.toISOString(),
            });
        }
        catch (error) {
            console.error('Settlement initiation error:', error);
            if (error.message.includes('No confirmed receipts')) {
                return json(res, 400, { error: 'no-confirmed-receipts', message: error.message });
            }
            return json(res, 500, { error: 'settlement-initiation-failed', message: error.message });
        }
    });
    /**
     * GET /v1/revenue/settlements/:settlementBatchId - Get settlement status
     */
    router.get('/settlements/:settlementBatchId', (0, identity_1.requireIdentity)(), async (req, res) => {
        try {
            const { settlementBatchId } = req.params;
            const settlement = await revenueService.getSettlementStatus(settlementBatchId);
            if (!settlement) {
                return json(res, 404, { error: 'settlement-not-found' });
            }
            return json(res, 200, {
                settlementBatchId: settlement.settlementBatchId,
                sourceNetwork: settlement.sourceNetwork,
                targetNetwork: settlement.targetNetwork,
                totalReceipts: settlement.totalReceipts,
                totalAmountSatoshis: settlement.totalAmountSatoshis,
                settlementTxid: settlement.settlementTxid,
                settlementFeeSatoshis: settlement.settlementFeeSatoshis,
                status: settlement.status,
                initiatedAt: settlement.initiatedAt.toISOString(),
                confirmedAt: settlement.confirmedAt?.toISOString(),
            });
        }
        catch (error) {
            console.error('Settlement status error:', error);
            return json(res, 500, { error: 'settlement-status-failed', message: error.message });
        }
    });
    /**
     * GET /v1/revenue/settlements - List settlements with filtering
     */
    router.get('/settlements', (0, identity_1.requireIdentity)(), async (req, res) => {
        try {
            const { status, sourceNetwork, targetNetwork, limit = '50', offset = '0' } = req.query;
            let whereConditions = [];
            let parameters = [];
            let paramIndex = 1;
            if (status) {
                whereConditions.push(`status = $${paramIndex++}`);
                parameters.push(status);
            }
            if (sourceNetwork) {
                whereConditions.push(`source_network = $${paramIndex++}`);
                parameters.push(sourceNetwork);
            }
            if (targetNetwork) {
                whereConditions.push(`target_network = $${paramIndex++}`);
                parameters.push(targetNetwork);
            }
            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
            const result = await database.query(`
        SELECT * FROM cross_network_settlements
        ${whereClause}
        ORDER BY initiated_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `, [...parameters, parseInt(limit), parseInt(offset)]);
            const countResult = await database.query(`
        SELECT COUNT(*) as total FROM cross_network_settlements
        ${whereClause}
      `, parameters);
            return json(res, 200, {
                settlements: result.rows.map((row) => ({
                    settlementBatchId: row.settlement_batch_id,
                    sourceNetwork: row.source_network,
                    targetNetwork: row.target_network,
                    totalReceipts: row.total_receipts,
                    totalAmountSatoshis: row.total_amount_satoshis,
                    settlementTxid: row.settlement_txid,
                    settlementFeeSatoshis: row.settlement_fee_satoshis,
                    status: row.status,
                    initiatedAt: row.initiated_at,
                    confirmedAt: row.confirmed_at,
                })),
                pagination: {
                    total: parseInt(countResult.rows[0].total),
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                },
            });
        }
        catch (error) {
            console.error('Settlements list error:', error);
            return json(res, 500, { error: 'settlements-list-failed', message: error.message });
        }
    });
    /**
     * GET /v1/revenue/export - Export revenue data
     */
    router.get('/export', (0, identity_1.requireIdentity)(), async (req, res) => {
        try {
            const { startDate, endDate, format = 'json', includePii = 'false' } = req.query;
            if (!startDate || !endDate) {
                return json(res, 400, { error: 'date-range-required' });
            }
            const start = parseDate(startDate);
            const end = parseDate(endDate);
            // Limit export range
            const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff > 90) {
                return json(res, 400, {
                    error: 'export-range-too-large',
                    hint: 'Maximum 90 days for export',
                });
            }
            const includePersonalInfo = includePii === 'true';
            // Get revenue data
            const query = includePersonalInfo
                ? `
        SELECT
          rl.*,
          or_table.payer_identity_key,
          or_table.payer_address,
          m.title as content_title
        FROM revenue_log rl
        LEFT JOIN overlay_receipts or_table ON rl.receipt_id = or_table.receipt_id
        LEFT JOIN manifests m ON or_table.version_id = m.version_id
        WHERE rl.revenue_date >= $1 AND rl.revenue_date <= $2
        ORDER BY rl.created_at DESC
      `
                : `
        SELECT
          rl.revenue_date,
          rl.revenue_hour,
          rl.gross_revenue_satoshis,
          rl.net_revenue_satoshis,
          rl.platform_fee_satoshis,
          rl.agent_commission_satoshis,
          rl.payment_method,
          rl.content_category,
          rl.payer_region,
          rl.agent_type
        FROM revenue_log rl
        WHERE rl.revenue_date >= $1 AND rl.revenue_date <= $2
        ORDER BY rl.created_at DESC
      `;
            const result = await database.query(query, [
                start.toISOString().split('T')[0],
                end.toISOString().split('T')[0],
            ]);
            if (format === 'csv') {
                // Generate CSV
                const headers = Object.keys(result.rows[0] || {});
                const csvData = [
                    headers.join(','),
                    ...result.rows.map((row) => headers.map((h) => `"${row[h] || ''}"`).join(',')),
                ].join('\n');
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="revenue-export-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv"`);
                return res.send(csvData);
            }
            return json(res, 200, {
                exportDetails: {
                    startDate: start.toISOString().split('T')[0],
                    endDate: end.toISOString().split('T')[0],
                    recordCount: result.rows.length,
                    includesPii: includePersonalInfo,
                    exportedAt: new Date().toISOString(),
                },
                data: result.rows,
            });
        }
        catch (error) {
            console.error('Revenue export error:', error);
            return json(res, 500, { error: 'export-failed', message: error.message });
        }
    });
    return router;
}
//# sourceMappingURL=d06-revenue-management.js.map