"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openlineageRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const index_js_1 = require("../db/index.js");
const router = (0, express_1.Router)();
// Query lineage endpoint - main visualization API
router.get('/lineage', async (req, res) => {
    try {
        const schema = zod_1.z.object({
            node: zod_1.z.string().min(1),
            depth: zod_1.z.coerce.number().min(1).max(10).default(3),
            direction: zod_1.z.enum(['up', 'down', 'both']).default('both'),
            format: zod_1.z.enum(['simple', 'cyto']).default('simple'),
        });
        const { node, depth, direction, format } = schema.parse(req.query);
        // Parse node format: dataset:namespace:name
        const nodeMatch = node.match(/^dataset:([^:]+):(.+)$/);
        if (!nodeMatch) {
            return res.status(400).json({
                error: 'Invalid node format. Expected: dataset:namespace:name',
            });
        }
        const [, namespace, name] = nodeMatch;
        const result = await (0, index_js_1.queryLineage)({
            node: `dataset:${namespace}:${name}`,
            depth,
            direction,
        });
        if (format === 'cyto') {
            // Convert to Cytoscape format
            const nodes = result.nodes.map((node) => ({
                data: {
                    id: `dataset:${node.namespace}:${node.name}`,
                    label: node.name,
                    namespace: node.namespace,
                    type: 'dataset',
                    facets: node.facets,
                },
            }));
            const edges = result.edges.map((edge, index) => ({
                data: {
                    id: `edge-${index}`,
                    source: `dataset:${edge.namespace}:${edge.parent_dataset_name}`,
                    target: `dataset:${edge.namespace}:${edge.child_dataset_name}`,
                    rel: 'parent',
                },
            }));
            return res.json({
                elements: { nodes, edges },
                stats: result.stats,
            });
        }
        // Simple format (default)
        res.json({
            node,
            depth,
            direction,
            nodes: result.nodes.map((n) => ({
                namespace: n.namespace,
                name: n.name,
                type: 'dataset',
                facets: n.facets,
            })),
            edges: result.edges.map((e) => ({
                from: `dataset:${e.namespace}:${e.parent_dataset_name}`,
                to: `dataset:${e.namespace}:${e.child_dataset_name}`,
                rel: 'parent',
            })),
            stats: result.stats,
        });
    }
    catch (error) {
        console.error('Error in /lineage:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Dataset details endpoint
router.get('/nodes/dataset/:namespace/:name', async (req, res) => {
    try {
        const { namespace, name } = req.params;
        const dataset = await (0, index_js_1.getOLDataset)(namespace, name);
        if (!dataset) {
            return res.status(404).json({ error: 'Dataset not found' });
        }
        res.json({
            dataset: {
                namespace: dataset.namespace,
                name: dataset.name,
                facets: dataset.latest_facets_json ? JSON.parse(dataset.latest_facets_json) : {},
                created_at: dataset.created_at,
                updated_at: dataset.updated_at,
            },
        });
    }
    catch (error) {
        console.error('Error in /nodes/dataset:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Run details endpoint
router.get('/runs/:runId', async (req, res) => {
    try {
        const { runId } = req.params;
        const run = await (0, index_js_1.getOLRun)(runId);
        if (!run) {
            return res.status(404).json({ error: 'Run not found' });
        }
        res.json({
            run: {
                run_key: run.run_key,
                namespace: run.namespace,
                job_name: run.job_name,
                run_id: run.run_id,
                state: run.state,
                start_time: run.start_time,
                end_time: run.end_time,
                facets: run.facets_json ? JSON.parse(run.facets_json) : {},
                created_at: run.created_at,
                updated_at: run.updated_at,
            },
        });
    }
    catch (error) {
        console.error('Error in /runs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Job details endpoint
router.get('/jobs/:namespace/:name', async (req, res) => {
    try {
        const { namespace, name } = req.params;
        const job = await (0, index_js_1.getOLJob)(namespace, name);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json({
            job: {
                job_id: job.job_id,
                namespace: job.namespace,
                name: job.name,
                facets: job.latest_facets_json ? JSON.parse(job.latest_facets_json) : {},
                created_at: job.created_at,
                updated_at: job.updated_at,
            },
        });
    }
    catch (error) {
        console.error('Error in /jobs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Search endpoint
router.get('/search', async (req, res) => {
    try {
        const schema = zod_1.z.object({
            q: zod_1.z.string().min(1),
            limit: zod_1.z.coerce.number().min(1).max(100).default(20),
        });
        const { q, limit } = schema.parse(req.query);
        const results = await (0, index_js_1.searchOLDatasets)('default', q);
        res.json({
            query: q,
            results: results.map((r) => ({
                namespace: r.namespace,
                name: r.name,
                type: 'dataset',
                facets: r.latest_facets_json ? JSON.parse(r.latest_facets_json) : {},
                updated_at: r.updated_at,
            })),
            count: results.length,
        });
    }
    catch (error) {
        console.error('Error in /search:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        // Test database connectivity
        const testResult = await (0, index_js_1.queryLineage)({
            node: 'dataset:overlay:test:test',
            depth: 1,
            direction: 'both',
        });
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            checks: {
                database: 'ok',
                adapter: 'ok',
                store: 'ok',
                query: 'ok',
            },
        });
    }
    catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: 'Service unavailable',
        });
    }
});
exports.default = router;
// Named export for server.ts compatibility
const openlineageRouter = () => router;
exports.openlineageRouter = openlineageRouter;
//# sourceMappingURL=openlineage.js.map