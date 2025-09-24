"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsMiddleware = void 0;
exports.metricsRoute = metricsRoute;
const registry_1 = require("../metrics/registry");
/**
 * Per-request metrics recorder. Place before the actual route handler.
 */
function metricsRoute(route) {
    return (req, res, next) => {
        const writeHead = res.writeHead;
        res.writeHead = function patched(statusCode, ...args) {
            try {
                (0, registry_1.incRequest)(route, statusCode);
            }
            catch {
                // ignore
            }
            return writeHead.call(this, statusCode, ...args);
        };
        next();
    };
}
// Alias for server.ts compatibility
const metricsMiddleware = () => metricsRoute('other');
exports.metricsMiddleware = metricsMiddleware;
//# sourceMappingURL=metrics.js.map