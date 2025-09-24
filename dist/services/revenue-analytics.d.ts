/**
 * D06 - Revenue Management and Analytics Service
 * Comprehensive revenue tracking, analytics, and financial reporting
 */
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
export declare class RevenueAnalyticsService extends EventEmitter {
    private database;
    constructor(database: Pool);
    /**
     * Generate comprehensive revenue analytics report
     */
    generateRevenueReport(params: {
        startDate: Date;
        endDate: Date;
        granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly';
        includeTimeSeries?: boolean;
    }): Promise<RevenueAnalyticsReport>;
    /**
     * Record revenue from a payment
     */
    recordRevenue(params: {
        receiptId: string;
        producerId: string;
        grossRevenueSatoshis: number;
        platformFeeSatoshis: number;
        agentCommissionSatoshis: number;
        paymentMethod: string;
        contentCategory?: string;
        payerRegion?: string;
        agentType?: string;
    }): Promise<void>;
    /**
     * Get overall revenue metrics for a time period
     */
    private getRevenueMetrics;
    /**
     * Get revenue breakdown by various dimensions
     */
    private getRevenueBreakdown;
    /**
     * Get agent marketplace specific metrics
     */
    private getAgentMarketplaceMetrics;
    /**
     * Calculate revenue trends
     */
    private getRevenueTrends;
    /**
     * Get revenue time series data
     */
    private getRevenueTimeSeries;
    /**
     * Initiate cross-network settlement
     */
    initiateCrossNetworkSettlement(params: {
        sourceNetwork: string;
        targetNetwork: string;
        receiptIds: string[];
        settlementFeeSatoshis?: number;
    }): Promise<CrossNetworkSettlement>;
    /**
     * Get settlement status
     */
    getSettlementStatus(settlementBatchId: string): Promise<CrossNetworkSettlement | null>;
}
