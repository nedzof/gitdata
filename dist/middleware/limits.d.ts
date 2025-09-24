/**
 * Rate limits per route using a simple token bucket per (ip, routeKey).
 * Configure via RATE_LIMITS_JSON, e.g.:
 *   {"submit":200,"bundle":200,"ready":200,"price":200,"data":200,"pay":200}
 * Units: requests per minute.
 */
/** Middleware factory for a given logical route key (e.g., 'submit', 'bundle', 'ready', 'price', 'data', 'pay') */
export declare function rateLimit(routeKey: string): (req: any, res: any, next: any) => any;
export declare const limitsMiddleware: () => (req: any, res: any, next: any) => any;
