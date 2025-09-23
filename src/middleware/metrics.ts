import { incRequest } from '../metrics/registry';

type RouteKey =
  | 'submit'
  | 'bundle'
  | 'ready'
  | 'price'
  | 'data'
  | 'pay'
  | 'advisories'
  | 'producers'
  | 'listings'
  | 'agents'
  | 'rules'
  | 'jobs'
  | 'other';

/**
 * Per-request metrics recorder. Place before the actual route handler.
 */
export function metricsRoute(route: RouteKey) {
  return (req: any, res: any, next: any) => {
    const writeHead = res.writeHead;
    res.writeHead = function patched(this: any, statusCode: number, ...args: any[]) {
      try {
        incRequest(route, statusCode);
      } catch {
        // ignore
      }
      return writeHead.call(this, statusCode, ...args);
    };
    next();
  };
}

// Alias for server.ts compatibility
export const metricsMiddleware = () => metricsRoute('other');