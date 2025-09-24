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
exports.catalogRouter = catalogRouter;
const express_1 = require("express");
const db_1 = require("../db");
function json(res, code, body) {
    return res.status(code).json(body);
}
function parseCursor(s) {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 0)
        return Math.floor(n);
    // support base64 "offset:<n>"
    if (typeof s === 'string' && s.startsWith('offset:')) {
        const k = Number(s.split(':')[1]);
        if (Number.isFinite(k) && k >= 0)
            return Math.floor(k);
    }
    return 0;
}
function nextCursor(offset, count) {
    return count > 0 ? `offset:${offset + count}` : null;
}
function catalogRouter() {
    const router = (0, express_1.Router)();
    /**
     * GET /search?q=...&datasetId=...&tag=...&lineage=...&limit=&cursor=
     * - q: free-text-ish
     * - datasetId: exact
     * - tag: parsed from manifest_json.metadata.tags or manifest.tags (array of strings)
     * - lineage: 'parents', 'children', 'leafs' (nodes with no children), 'roots' (nodes with no parents)
     * Paging: limit (default 20, max 100), cursor "offset:<n>"
     */
    router.get('/search', async (req, res) => {
        try {
            const q = req.query.q ? String(req.query.q) : undefined;
            const datasetId = req.query.datasetId ? String(req.query.datasetId) : undefined;
            const tag = req.query.tag ? String(req.query.tag).toLowerCase() : undefined;
            const lineage = req.query.lineage ? String(req.query.lineage).toLowerCase() : undefined;
            const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
            const offset = parseCursor(req.query.cursor);
            // Get results using async PostgreSQL function
            const allRows = await (0, db_1.searchManifests)(q, limit + offset + 50);
            // Filter by datasetId if specified
            let filteredRows = allRows;
            if (datasetId) {
                filteredRows = allRows.filter((r) => r.dataset_id === datasetId);
            }
            // Manual pagination with offset
            const rows = filteredRows.slice(offset, offset + limit);
            // Post-filter by tag if requested (parse manifest_json)
            let filtered = rows.filter((r) => {
                if (!tag)
                    return true;
                try {
                    const m = JSON.parse(r.manifest_json || '{}');
                    const tags = Array.isArray(m?.metadata?.tags)
                        ? m.metadata.tags
                        : Array.isArray(m?.tags)
                            ? m.tags
                            : [];
                    return tags.map((t) => String(t).toLowerCase()).includes(tag);
                }
                catch {
                    return false;
                }
            });
            // Post-filter by lineage if requested
            if (lineage) {
                const { getParents } = await Promise.resolve().then(() => __importStar(require('../db')));
                // Helper function to get children by querying edges table directly
                async function getChildren(versionId) {
                    const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('../db/hybrid')));
                    const db = getHybridDatabase();
                    const result = await db.pg.query(`
            SELECT child_version_id FROM edges WHERE parent_version_id = $1
          `, [versionId]);
                    return result.rows.map((row) => row.child_version_id);
                }
                if (lineage === 'leafs') {
                    // Filter for nodes that have no children
                    const filteredByLineage = [];
                    for (const row of filtered) {
                        const children = await getChildren(row.version_id);
                        if (children.length === 0) {
                            filteredByLineage.push(row);
                        }
                    }
                    filtered = filteredByLineage;
                }
                else if (lineage === 'roots') {
                    // Filter for nodes that have no parents
                    const filteredByLineage = [];
                    for (const row of filtered) {
                        const parents = await getParents(row.version_id);
                        if (parents.length === 0) {
                            filteredByLineage.push(row);
                        }
                    }
                    filtered = filteredByLineage;
                }
                else if (lineage === 'parents') {
                    // Filter for nodes that have children (are parents)
                    const filteredByLineage = [];
                    for (const row of filtered) {
                        const children = await getChildren(row.version_id);
                        if (children.length > 0) {
                            filteredByLineage.push(row);
                        }
                    }
                    filtered = filteredByLineage;
                }
                else if (lineage === 'children') {
                    // Filter for nodes that have parents (are children)
                    const filteredByLineage = [];
                    for (const row of filtered) {
                        const parents = await getParents(row.version_id);
                        if (parents.length > 0) {
                            filteredByLineage.push(row);
                        }
                    }
                    filtered = filteredByLineage;
                }
            }
            const items = filtered.map((r) => ({
                versionId: r.version_id,
                datasetId: r.dataset_id,
                name: r.name,
                description: r.description,
                contentHash: r.content_hash,
                mimeType: r.mime_type,
                sizeBytes: r.size_bytes,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
                // Extract license and classification from policy_meta if available
                license: r.policy_meta?.license || null,
                classification: r.policy_meta?.classification || null,
            }));
            return json(res, 200, {
                items,
                limit,
                nextCursor: nextCursor(offset, rows.length),
            });
        }
        catch (e) {
            return json(res, 500, { error: 'search-failed', message: String(e?.message || e) });
        }
    });
    /**
     * GET /resolve?versionId=... | /resolve?datasetId=...&limit=&cursor=
     * - If versionId: return that node + its parents
     * - If datasetId: return paged versions of that dataset with parents per item
     */
    router.get('/resolve', async (req, res) => {
        try {
            const versionId = req.query.versionId ? String(req.query.versionId).toLowerCase() : undefined;
            const datasetId = req.query.datasetId ? String(req.query.datasetId) : undefined;
            if (!versionId && !datasetId) {
                return json(res, 400, { error: 'bad-request', hint: 'provide versionId or datasetId' });
            }
            if (versionId) {
                if (!/^[0-9a-fA-F]{64}$/.test(versionId)) {
                    return json(res, 400, { error: 'bad-request', hint: 'versionId=64-hex' });
                }
                const parents = await (0, db_1.getParents)(versionId);
                return json(res, 200, {
                    items: [{ versionId, parents }],
                    nextCursor: null,
                });
            }
            // datasetId path
            const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
            const offset = parseCursor(req.query.cursor);
            const versions = await (0, db_1.listVersionsByDataset)(datasetId);
            // Manual pagination for versions
            const paginatedVersions = versions.slice(offset, offset + limit);
            const items = await Promise.all(paginatedVersions.map(async (v) => ({
                versionId: v.version_id,
                parents: await (0, db_1.getParents)(v.version_id),
                createdAt: v.created_at,
                contentHash: v.content_hash,
            })));
            return json(res, 200, {
                items,
                limit,
                nextCursor: nextCursor(offset, paginatedVersions.length),
            });
        }
        catch (e) {
            return json(res, 500, { error: 'resolve-failed', message: String(e?.message || e) });
        }
    });
    /**
     * GET /lineage?versionId=...
     * Returns the full lineage tree (upstream and downstream) for a specific dataset
     */
    router.get('/lineage', async (req, res) => {
        try {
            const versionId = req.query.versionId ? String(req.query.versionId).toLowerCase() : undefined;
            if (!versionId) {
                return json(res, 400, { error: 'bad-request', hint: 'provide versionId' });
            }
            if (!/^[0-9a-fA-F]{64}$/.test(versionId)) {
                return json(res, 400, { error: 'bad-request', hint: 'versionId=64-hex' });
            }
            const { getHybridDatabase } = await Promise.resolve().then(() => __importStar(require('../db/hybrid')));
            const { getManifest } = await Promise.resolve().then(() => __importStar(require('../db')));
            const db = getHybridDatabase();
            // Get current dataset info
            const currentDataset = await getManifest(versionId);
            if (!currentDataset) {
                return json(res, 404, { error: 'not-found', hint: 'dataset not found' });
            }
            // Helper function to recursively get all ancestors
            async function getAncestors(versionId, visited = new Set()) {
                if (visited.has(versionId))
                    return [];
                visited.add(versionId);
                const result = await db.pg.query(`
          SELECT parent_version_id, relationship_type
          FROM edges
          WHERE child_version_id = $1
        `, [versionId]);
                const ancestors = [];
                for (const row of result.rows) {
                    const manifest = await getManifest(row.parent_version_id);
                    if (manifest) {
                        const node = {
                            versionId: row.parent_version_id,
                            title: manifest.title,
                            datasetId: manifest.dataset_id,
                            producer: manifest.producer_id,
                            classification: manifest.classification,
                            relationshipType: row.relationship_type,
                            type: 'ancestor',
                        };
                        ancestors.push(node);
                        // Recursively get ancestors of this ancestor
                        const nestedAncestors = await getAncestors(row.parent_version_id, visited);
                        ancestors.push(...nestedAncestors);
                    }
                }
                return ancestors;
            }
            // Helper function to recursively get all descendants
            async function getDescendants(versionId, visited = new Set()) {
                if (visited.has(versionId))
                    return [];
                visited.add(versionId);
                const result = await db.pg.query(`
          SELECT child_version_id, relationship_type
          FROM edges
          WHERE parent_version_id = $1
        `, [versionId]);
                const descendants = [];
                for (const row of result.rows) {
                    const manifest = await getManifest(row.child_version_id);
                    if (manifest) {
                        const node = {
                            versionId: row.child_version_id,
                            title: manifest.title,
                            datasetId: manifest.dataset_id,
                            producer: manifest.producer_id,
                            classification: manifest.classification,
                            relationshipType: row.relationship_type,
                            type: 'descendant',
                        };
                        descendants.push(node);
                        // Recursively get descendants of this descendant
                        const nestedDescendants = await getDescendants(row.child_version_id, visited);
                        descendants.push(...nestedDescendants);
                    }
                }
                return descendants;
            }
            // Get all ancestors and descendants
            const [ancestors, descendants] = await Promise.all([
                getAncestors(versionId),
                getDescendants(versionId),
            ]);
            // Build the complete lineage tree
            const lineageTree = {
                current: {
                    versionId: currentDataset.version_id,
                    title: currentDataset.title,
                    datasetId: currentDataset.dataset_id,
                    producer: currentDataset.producer_id,
                    classification: currentDataset.classification,
                    type: 'current',
                },
                upstream: ancestors,
                downstream: descendants,
                summary: {
                    totalAncestors: ancestors.length,
                    totalDescendants: descendants.length,
                    totalNodes: ancestors.length + descendants.length + 1,
                },
            };
            return json(res, 200, lineageTree);
        }
        catch (e) {
            return json(res, 500, { error: 'lineage-failed', message: String(e?.message || e) });
        }
    });
    return router;
}
//# sourceMappingURL=catalog.js.map