/**
 * D06 - Agent Marketplace Payment Integration
 * Handles autonomous agent payments with authorization and spending limits
 */
import { EventEmitter } from 'events';
import type { Pool } from 'pg';
export interface AgentPaymentAuthorization {
    authorizationId: string;
    agentId: string;
    authorizedBy: string;
    limits: {
        maxPaymentSatoshis: number;
        dailyLimitSatoshis: number;
        monthlyLimitSatoshis: number;
    };
    currentUsage: {
        dailySpentSatoshis: number;
        monthlySpentSatoshis: number;
        lastResetDate: string;
    };
    status: 'active' | 'suspended' | 'expired';
    expiresAt: Date;
    createdAt: Date;
}
export interface AgentSpendingAnalytics {
    agentId: string;
    agentName: string;
    totalSpentSatoshis: number;
    transactionCount: number;
    averageTransactionSatoshis: number;
    successfulPayments: number;
    failedPayments: number;
    successRate: number;
    budgetUtilization: {
        dailyPercent: number;
        monthlyPercent: number;
    };
    topPurchases: Array<{
        versionId: string;
        title: string;
        amountSatoshis: number;
        timestamp: Date;
    }>;
}
export interface AgentPaymentRequest {
    agentId: string;
    versionId: string;
    quantity: number;
    requestedBy?: string;
    purpose?: string;
    priority?: 'low' | 'normal' | 'high';
}
export declare class AgentPaymentService extends EventEmitter {
    private database;
    constructor(database: Pool);
    /**
     * Authorize an agent for autonomous payments
     */
    authorizeAgent(params: {
        agentId: string;
        authorizedBy: string;
        maxPaymentSatoshis: number;
        dailyLimitSatoshis: number;
        monthlyLimitSatoshis: number;
        expiresAt?: Date;
    }): Promise<AgentPaymentAuthorization>;
    /**
     * Check if agent is authorized for a specific payment
     */
    checkPaymentAuthorization(agentId: string, paymentAmountSatoshis: number): Promise<{
        authorized: boolean;
        reason?: string;
        authorization?: AgentPaymentAuthorization;
    }>;
    /**
     * Record agent payment and update spending limits
     */
    recordAgentPayment(agentId: string, receiptId: string, amountSatoshis: number, successful: boolean): Promise<void>;
    /**
     * Get agent spending analytics
     */
    getAgentSpendingAnalytics(agentId: string, timeframe?: 'day' | 'week' | 'month'): Promise<AgentSpendingAnalytics>;
    /**
     * Process autonomous agent payment request
     */
    processAgentPaymentRequest(request: AgentPaymentRequest): Promise<{
        success: boolean;
        receiptId?: string;
        reason?: string;
        authorization?: AgentPaymentAuthorization;
    }>;
    /**
     * Reset spending limits if date has changed
     */
    private resetSpendingLimitsIfNeeded;
    /**
     * Get current spending for an agent
     */
    private getCurrentSpending;
    /**
     * Record spending analytics data
     */
    private recordSpendingAnalytics;
}
