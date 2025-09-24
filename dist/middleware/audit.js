"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = auditLogger;
/**
 * Audit logger middleware: logs one JSON line per request with basic fields.
 * Fields: ts, ip, method, path, status, ms, ua
 */
function auditLogger() {
    return function (req, res, next) {
        const start = Date.now();
        const ip = (req.ip ||
            req.headers['x-forwarded-for'] ||
            req.socket?.remoteAddress ||
            '').toString();
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
                console.log(JSON.stringify(line));
            }
            catch {
                // ignore
            }
        });
        next();
    };
}
//# sourceMappingURL=audit.js.map