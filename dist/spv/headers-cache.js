"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHeadersSnapshot = getHeadersSnapshot;
exports.invalidateHeadersSnapshot = invalidateHeadersSnapshot;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ttls_1 = require("../cache/ttls");
const verify_envelope_1 = require("./verify-envelope");
let memo = null;
/**
 * Get a headers snapshot with simple TTL + mtime invalidation.
 * If the file's mtime changes or TTL expires, reload via loadHeaders().
 */
function getHeadersSnapshot(headersFile) {
    const abs = path_1.default.resolve(headersFile);
    const ttl = (0, ttls_1.getCacheTTLs)().headers;
    const now = Date.now();
    const stat = fs_1.default.statSync(abs);
    const mtimeMs = stat.mtimeMs;
    if (!memo || memo.file !== abs || now - memo.loadedAtMs > ttl || memo.mtimeMs !== mtimeMs) {
        const idx = (0, verify_envelope_1.loadHeaders)(abs);
        memo = { file: abs, idx, loadedAtMs: now, mtimeMs };
    }
    return memo.idx;
}
/** Force invalidate the memoized headers snapshot (used in tests if needed) */
function invalidateHeadersSnapshot() {
    memo = null;
}
//# sourceMappingURL=headers-cache.js.map