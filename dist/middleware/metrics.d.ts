type RouteKey = 'submit' | 'bundle' | 'ready' | 'price' | 'data' | 'pay' | 'advisories' | 'producers' | 'listings' | 'agents' | 'rules' | 'jobs' | 'other';
/**
 * Per-request metrics recorder. Place before the actual route handler.
 */
export declare function metricsRoute(route: RouteKey): (req: any, res: any, next: any) => void;
export declare const metricsMiddleware: () => (req: any, res: any, next: any) => void;
export {};
