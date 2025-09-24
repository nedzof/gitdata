import type { Request, Response, NextFunction } from 'express';
export declare function enforceAgentRegistrationPolicy(): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function enforceRuleConcurrency(): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function enforceJobCreationPolicy(): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function enforceResourceLimits(): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function enforceAgentSecurityPolicy(): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function resetPolicyState(): void;
export declare function getPolicyMetrics(): {
    jobs: {
        running: number;
        queued: number;
        failed: number;
        dead: number;
        maxConcurrency: number;
        concurrencyUtilization: number;
    };
    agents: {
        maxPerIP: number;
        rateWindowHours: number;
        activeRateLimits: number;
    };
    limits: {
        maxRequestSize: number;
        maxTemplateSize: number;
        maxPendingJobsPerRule: number;
    };
};
