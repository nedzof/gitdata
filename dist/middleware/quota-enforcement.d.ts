/**
 * D07 Quota Enforcement Middleware
 * Real-time quota validation and enforcement for streaming requests
 */
import type { Request, Response, NextFunction } from 'express';
export interface QuotaValidationResult {
    allowed: boolean;
    quotaStatus: any;
    errorMessage?: string;
    remainingBytes?: number;
    remainingRequests?: number;
}
/**
 * Validate quota for a receipt and requested bytes
 */
export declare function validateQuota(receiptId: string, requestedBytes?: number, windowType?: 'hour' | 'day' | 'month'): Promise<QuotaValidationResult>;
/**
 * Check concurrent streaming limits
 */
export declare function validateConcurrentStreams(receiptId: string): Promise<{
    allowed: boolean;
    activeStreams: number;
    maxAllowed: number;
    errorMessage?: string;
}>;
/**
 * Express middleware for quota enforcement
 * Checks quotas before allowing streaming requests
 */
export declare function enforceQuotas(options?: {
    estimatedBytesField?: string;
    windowType?: 'hour' | 'day' | 'month';
    checkConcurrent?: boolean;
}): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Middleware specifically for streaming data endpoints
 */
export declare const enforceStreamingQuotas: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Middleware for agent streaming with relaxed limits
 */
export declare const enforceAgentStreamingQuotas: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Middleware for burst requests with shorter windows
 */
export declare const enforceBurstQuotas: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
declare const _default: {
    validateQuota: typeof validateQuota;
    validateConcurrentStreams: typeof validateConcurrentStreams;
    enforceQuotas: typeof enforceQuotas;
    enforceStreamingQuotas: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    enforceAgentStreamingQuotas: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    enforceBurstQuotas: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
};
export default _default;
