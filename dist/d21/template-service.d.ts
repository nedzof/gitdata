/**
 * D21 Payment Template Service
 *
 * Provides deterministic payment template generation with custom revenue splits.
 * Templates ensure reproducible payment outputs and integrate with BRC-41 payments.
 */
import type { DatabaseAdapter } from '../overlay/brc26-uhrp.js';
import type { D21PaymentTemplate, D21PaymentTemplateService, PaymentSplitRules } from './types.js';
export declare class D21PaymentTemplateServiceImpl implements D21PaymentTemplateService {
    private database;
    private initialized;
    constructor(database: DatabaseAdapter);
    initialize(): Promise<void>;
    private createTemplateSchema;
    /**
     * Generate deterministic payment template
     */
    generateTemplate(params: {
        brc41PaymentId?: string;
        splitRules: PaymentSplitRules;
        totalSatoshis: number;
        createdBy: string;
        metadata?: Record<string, any>;
    }): Promise<D21PaymentTemplate>;
    /**
     * Retrieve payment template by hash
     */
    getTemplate(templateHash: string): Promise<D21PaymentTemplate | null>;
    /**
     * Verify template reproducibility
     */
    verifyTemplate(templateHash: string): Promise<boolean>;
    /**
     * Get template usage analytics
     */
    getTemplateUsage(templateHash: string): Promise<{
        totalUses: number;
        totalVolumeSatoshis: number;
        averageTransactionSize: number;
    }>;
    private validateSplitRules;
    private calculateTemplateHash;
    private generatePaymentOutputs;
    private generateScriptForRecipient;
    private getRecipientDescription;
    private storeTemplate;
}
export default D21PaymentTemplateServiceImpl;
