"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsRouter = void 0;
exports.opsRouter = opsRouter;
const fs_1 = __importDefault(require("fs"));
const express_1 = require("express");
const registry_1 = require("../metrics/registry");
const headers_cache_1 = require("../spv/headers-cache");
const HEADERS_FILE = process.env.HEADERS_FILE || './data/headers.json';
function opsRouter() {
    const router = (0, express_1.Router)();
    router.get('/health', async (_req, res) => {
        try {
            // DB ping
            const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
            const pgClient = getPostgreSQLClient();
            const result = await pgClient.query('SELECT 1 AS ok');
            const row = result.rows[0];
            if (!row || row.ok !== 1) {
                return res.status(500).json({ ok: false, reason: 'db' });
            }
            // Headers file check
            if (!fs_1.default.existsSync(HEADERS_FILE)) {
                return res.status(200).json({ ok: true, warn: 'headers-missing' });
            }
            try {
                (0, headers_cache_1.getHeadersSnapshot)(HEADERS_FILE);
            }
            catch {
                return res.status(200).json({ ok: true, warn: 'headers-unreadable' });
            }
            return res.status(200).json({ ok: true });
        }
        catch (e) {
            return res.status(500).json({ ok: false, reason: String(e?.message || e) });
        }
    });
    router.get('/metrics', (_req, res) => {
        try {
            const m = (0, registry_1.snapshotMetrics)();
            // Return basic metrics - no database dependency needed for core metrics
            return res.status(200).json({
                ...m,
                policy: {
                    jobs: { running: 0, queued: 0, failed: 0, dead: 0 },
                    agentRegistrations: { totalIPs: 0, totalRegistrations: 0 },
                    concurrency: { current: 0, max: 10 },
                },
            });
        }
        catch (e) {
            return res.status(500).json({ error: 'metrics-failed', message: String(e?.message || e) });
        }
    });
    return router;
}
// Alias for server.ts compatibility
exports.metricsRouter = opsRouter;
//# sourceMappingURL=metrics.js.map