/**
 * Minimal in-memory metrics registry for ops/monitoring.
 * Exposes:
 *  - request counters by route + status class
 *  - admissions counter (/submit)
 *  - bundles cache hits/misses
 *  - SPV proof latency histogram (last N samples) with p50/p95
 *  - uptime
 */
type RouteKey = 'submit' | 'bundle' | 'ready' | 'price' | 'data' | 'pay' | 'advisories' | 'producers' | 'listings' | 'agents' | 'rules' | 'jobs' | 'other';
export declare function incRequest(route: RouteKey, statusCode: number): void;
export declare function incAdmissions(n?: number): void;
export declare function cacheHit(): void;
export declare function cacheMiss(): void;
export declare function observeProofLatency(ms: number): void;
export declare function snapshotMetrics(): {
    nowIso: string;
    uptimeSec: number;
    requestsTotal: number;
    requestsByRoute: {
        data: number;
        submit: number;
        bundle: number;
        ready: number;
        price: number;
        pay: number;
        agents: number;
        rules: number;
        jobs: number;
        advisories: number;
        producers: number;
        listings: number;
        other: number;
    };
    requestsByClass: {
        other: number;
        "2xx": number;
        "4xx": number;
        "5xx": number;
        "3xx": number;
        "1xx": number;
    };
    admissionsTotal: number;
    bundlesCache: {
        hits: number;
        misses: number;
    };
    proofLatencyMs: {
        count: number;
        p50: number;
        p95: number;
        avg: number;
        max: number;
    };
};
export {};
