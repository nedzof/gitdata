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
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingsRouter = listingsRouter;
const express_1 = require("express");
const db_1 = require("../db");
function json(res, code, body) {
    return res.status(code).json(body);
}
function listingsRouter() {
    const router = (0, express_1.Router)();
    // GET /?q=&datasetId=&producerId=&limit=&offset=
    router.get('/', async (req, res) => {
        try {
            const q = req.query.q ? String(req.query.q) : undefined;
            const datasetId = req.query.datasetId ? String(req.query.datasetId) : undefined;
            const producerId = req.query.producerId ? String(req.query.producerId) : undefined;
            const limit = Math.min(Number(req.query.limit || 50), 200);
            const offset = Math.max(Number(req.query.offset || 0), 0);
            // Use modern hybrid database with cache-aside pattern
            const rows = await (0, db_1.searchManifests)({ q, datasetId, limit, offset });
            const items = rows.map((m) => ({
                versionId: m.version_id,
                name: m.title || null,
                description: null, // Could extract from manifest_json if needed
                datasetId: m.dataset_id || null,
                producerId: m.producer_id || null,
                tags: null, // Could extract from manifest_json if needed
                updatedAt: m.created_at || null,
            }));
            // Set cache headers for successful responses
            res.setHeader('Cache-Control', 'public, max-age=120'); // 2 minutes
            return json(res, 200, { items, limit, offset });
        }
        catch (e) {
            return json(res, 500, { error: 'search-failed', message: String(e?.message || e) });
        }
    });
    // GET /:versionId
    router.get('/:versionId', async (req, res) => {
        try {
            const versionId = String(req.params.versionId);
            // Use modern hybrid database with cache-aside pattern
            const manifest = await (0, db_1.getManifest)(versionId);
            if (!manifest) {
                return json(res, 404, { error: 'not-found', hint: 'versionId not found' });
            }
            let manifestData = {};
            try {
                manifestData = JSON.parse(manifest.manifest_json || '{}');
            }
            catch {
                // ignore parse errors
            }
            const detail = {
                versionId: manifest.version_id,
                manifest: {
                    name: manifest.title || manifestData.name || null,
                    description: manifestData.description || null,
                    datasetId: manifest.dataset_id || null,
                    contentHash: manifest.content_hash || null,
                    license: manifest.license || null,
                    classification: manifest.classification || null,
                    createdAt: manifest.created_at || null,
                },
                // Note: price snippet would be added here with feature flag
            };
            // Set cache headers for successful responses
            res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
            return json(res, 200, detail);
        }
        catch (e) {
            return json(res, 500, { error: 'get-failed', message: String(e?.message || e) });
        }
    });
    // Add search endpoint for CLI compatibility - return agents data
    router.get('/search', async (req, res) => {
        try {
            // For CLI compatibility, redirect to agents endpoint behavior
            // This endpoint is used by consumer CLI for service discovery
            const result = await Promise.resolve().then(() => __importStar(require('./agents'))).then(m => m.agentsRouter());
            // Return empty results in the expected format for now
            res.json({ items: [], total: 0 });
        }
        catch (e) {
            return json(res, 500, { error: 'search-failed', message: String(e?.message || e) });
        }
    });
    return router;
}
//# sourceMappingURL=listings.js.map