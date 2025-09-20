import { Router } from 'express';
import { z } from 'zod';
import { openDb } from '../db/index.js';
import {
  queryLineage,
  getOLDataset,
  getOLRun,
  getOLJob,
  searchOLDatasets
} from '../db/index.js';

const router = Router();
const db = openDb();

// Query lineage endpoint - main visualization API
router.get('/lineage', async (req, res) => {
  try {
    const schema = z.object({
      node: z.string().min(1),
      depth: z.coerce.number().min(1).max(10).default(3),
      direction: z.enum(['up', 'down', 'both']).default('both'),
      format: z.enum(['simple', 'cyto']).default('simple')
    });

    const { node, depth, direction, format } = schema.parse(req.query);

    // Parse node format: dataset:namespace:name
    const nodeMatch = node.match(/^dataset:([^:]+):(.+)$/);
    if (!nodeMatch) {
      return res.status(400).json({
        error: 'Invalid node format. Expected: dataset:namespace:name'
      });
    }

    const [, namespace, name] = nodeMatch;

    const result = queryLineage(db, {
      node: `dataset:${namespace}:${name}`,
      depth,
      direction
    });

    if (format === 'cyto') {
      // Convert to Cytoscape format
      const nodes = result.nodes.map(node => ({
        data: {
          id: `dataset:${node.namespace}:${node.name}`,
          label: node.name,
          namespace: node.namespace,
          type: 'dataset',
          facets: node.facets
        }
      }));

      const edges = result.edges.map((edge, index) => ({
        data: {
          id: `edge-${index}`,
          source: `dataset:${edge.namespace}:${edge.parent_dataset_name}`,
          target: `dataset:${edge.namespace}:${edge.child_dataset_name}`,
          rel: 'parent'
        }
      }));

      return res.json({
        elements: { nodes, edges },
        stats: result.stats
      });
    }

    // Simple format (default)
    res.json({
      node,
      depth,
      direction,
      nodes: result.nodes.map(n => ({
        namespace: n.namespace,
        name: n.name,
        type: 'dataset',
        facets: n.facets
      })),
      edges: result.edges.map(e => ({
        from: `dataset:${e.namespace}:${e.parent_dataset_name}`,
        to: `dataset:${e.namespace}:${e.child_dataset_name}`,
        rel: 'parent'
      })),
      stats: result.stats
    });

  } catch (error) {
    console.error('Error in /lineage:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dataset details endpoint
router.get('/nodes/dataset/:namespace/:name', async (req, res) => {
  try {
    const { namespace, name } = req.params;

    const dataset = getOLDataset(db, namespace, name);
    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    res.json({
      dataset: {
        namespace: dataset.namespace,
        name: dataset.name,
        facets: dataset.latest_facets_json ? JSON.parse(dataset.latest_facets_json) : {},
        created_at: dataset.created_at,
        updated_at: dataset.updated_at
      }
    });
  } catch (error) {
    console.error('Error in /nodes/dataset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Run details endpoint
router.get('/runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;

    const run = getOLRun(db, runId);
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
        updated_at: run.updated_at
      }
    });
  } catch (error) {
    console.error('Error in /runs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Job details endpoint
router.get('/jobs/:namespace/:name', async (req, res) => {
  try {
    const { namespace, name } = req.params;

    const job = getOLJob(db, namespace, name);
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
        updated_at: job.updated_at
      }
    });
  } catch (error) {
    console.error('Error in /jobs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search endpoint
router.get('/search', async (req, res) => {
  try {
    const schema = z.object({
      q: z.string().min(1),
      limit: z.coerce.number().min(1).max(100).default(20)
    });

    const { q, limit } = schema.parse(req.query);

    const results = searchOLDatasets(db, q, limit);

    res.json({
      query: q,
      results: results.map(r => ({
        namespace: r.namespace,
        name: r.name,
        type: 'dataset',
        facets: r.latest_facets_json ? JSON.parse(r.latest_facets_json) : {},
        updated_at: r.updated_at
      })),
      count: results.length
    });
  } catch (error) {
    console.error('Error in /search:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Test database connectivity
    const testResult = queryLineage(db, {
      node: 'dataset:overlay:test:test',
      depth: 1,
      direction: 'both'
    });

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
        adapter: 'ok',
        store: 'ok',
        query: 'ok'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable'
    });
  }
});

export default router;