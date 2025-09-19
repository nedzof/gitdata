/**
 * Audit logger middleware: logs one JSON line per request with basic fields.
 * Fields: ts, ip, method, path, status, ms, ua
 */
export function auditLogger() {
  return function (req: any, res: any, next: any) {
    const start = Date.now();
    const ip = (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString();
    const ua = (req.headers['user-agent'] || '').toString();

    // Hook into finish event to get status
    res.on('finish', () => {
      const ms = Date.now() - start;
      const line = {
        ts: new Date().toISOString(),
        ip,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        ms,
        ua,
      };
      try {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(line));
      } catch {
        // ignore
      }
    });

    next();
  };
}