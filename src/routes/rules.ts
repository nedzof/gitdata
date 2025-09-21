import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { requireIdentity } from '../middleware/identity';
import * as db from '../db';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

// Normalize rule bodies
function toJsonOrString(v: any) {
  return typeof v === 'string' ? v : JSON.stringify(v ?? {});
}

export function rulesRouter(): Router {
  const router = makeRouter();

  // POST / (create)
  router.post('/', requireIdentity(false), async (req: Request, res: Response) => {
    try {
      const { name, enabled, when, find, actions } = req.body || {};
      if (!name || !when || !find || !actions) {
        return json(res, 400, { error: 'bad-request', hint: 'name, when, find, actions required' });
      }

      const ruleId = await db.createRule({
        name,
        enabled: enabled !== false,
        when_json: toJsonOrString(when),
        find_json: toJsonOrString(find),
        actions_json: toJsonOrString(actions)
      });

      return json(res, 201, {
        ruleId,
        name,
        enabled: enabled !== false,
        when: toJsonOrString(when),
        find: toJsonOrString(find),
        actions: toJsonOrString(actions)
      });
    } catch (e:any) {
      return json(res, 500, { error: 'create-failed', message: String(e?.message || e) });
    }
  });

  // GET / (list)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const enabled = req.query.enabled === 'true' ? true : (req.query.enabled === 'false' ? false : undefined);
      const rules = await db.listRules(enabled);

      const formattedRules = rules.map(rule => ({
        ruleId: rule.rule_id,
        name: rule.name,
        enabled: rule.enabled === 1,
        when: rule.when_json,
        find: rule.find_json,
        actions: rule.actions_json,
        createdAt: rule.created_at,
        updatedAt: rule.updated_at
      }));

      return json(res, 200, { items: formattedRules });
    } catch (e:any) {
      return json(res, 500, { error: 'list-failed', message: String(e?.message || e) });
    }
  });

  // GET /:id (get specific rule)
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const ruleId = req.params.id;
      const rule = await db.getRule(ruleId);

      if (!rule) {
        return json(res, 404, { error: 'not-found', message: `Rule ${ruleId} not found` });
      }

      return json(res, 200, {
        ruleId: rule.rule_id,
        name: rule.name,
        enabled: rule.enabled === 1,
        when: rule.when_json,
        find: rule.find_json,
        actions: rule.actions_json,
        createdAt: rule.created_at,
        updatedAt: rule.updated_at
      });
    } catch (e:any) {
      return json(res, 500, { error: 'get-failed', message: String(e?.message || e) });
    }
  });

  // POST /:id/run (trigger rule execution)
  router.post('/:id/run', async (req: Request, res: Response) => {
    try {
      const ruleId = req.params.id;

      // Get the rule
      const rule = await db.getRule(ruleId);
      if (!rule || !rule.enabled) {
        return json(res, 404, { error: 'not-found' });
      }

      // Parse the find criteria
      const findCriteria = typeof rule.find_json === 'string' ? JSON.parse(rule.find_json) : rule.find_json;
      const actionsCriteria = typeof rule.actions_json === 'string' ? JSON.parse(rule.actions_json) : rule.actions_json;

      // Get PostgreSQL client for manifest search
      const { getPostgreSQLClient } = await import('../db/postgresql');
      const pgClient = getPostgreSQLClient();

      let manifests = [];

      // Execute search based on find criteria
      if (findCriteria.source === 'search' && findCriteria.query) {
        const { q, datasetId } = findCriteria.query;
        const limit = findCriteria.limit || 10;

        let searchQuery = 'SELECT * FROM manifests WHERE 1=1';
        const params = [];
        let paramCount = 0;

        if (datasetId) {
          paramCount++;
          searchQuery += ` AND dataset_id = $${paramCount}`;
          params.push(datasetId);
        }

        if (q) {
          paramCount++;
          searchQuery += ` AND (manifest_json::text ILIKE $${paramCount} OR title ILIKE $${paramCount})`;
          params.push(`%${q}%`);
        }

        searchQuery += ` LIMIT $${paramCount + 1}`;
        params.push(limit);

        const searchResult = await pgClient.query(searchQuery, params);
        manifests = searchResult.rows;
      }

      // Create jobs for matching manifests
      let jobsEnqueued = 0;

      for (const manifest of manifests) {
        const jobId = `job_${Date.now()}_${Math.random().toString(16).slice(2)}`;

        // Insert job directly using PostgreSQL
        const now = Math.floor(Date.now() / 1000);
        await pgClient.query(`
          INSERT INTO jobs (job_id, rule_id, target_id, state, attempts, next_run_at, created_at, updated_at, evidence_json)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          jobId,
          ruleId,
          manifest.version_id,
          'queued',
          0,
          now, // next_run_at (run immediately)
          now, // created_at
          now, // updated_at
          JSON.stringify({
            actions: actionsCriteria,
            manifest: manifest,
            searchQuery: findCriteria.query
          })
        ]);

        jobsEnqueued++;
      }

      return json(res, 200, {
        status: 'triggered',
        ruleId,
        enqueued: jobsEnqueued,
        manifestsFound: manifests.length
      });
    } catch (e:any) {
      return json(res, 500, { error: 'run-failed', message: String(e?.message || e) });
    }
  });

  // PATCH /:id (update)
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const ruleId = req.params.id;
      const updates = req.body || {};

      const updatedRule = await db.updateRule(ruleId, {
        enabled: updates.enabled,
        name: updates.name,
        when_json: updates.when ? toJsonOrString(updates.when) : undefined,
        find_json: updates.find ? toJsonOrString(updates.find) : undefined,
        actions_json: updates.actions ? toJsonOrString(updates.actions) : undefined
      });

      if (!updatedRule) {
        return json(res, 404, { error: 'not-found' });
      }

      return json(res, 200, {
        ruleId: updatedRule.rule_id,
        name: updatedRule.name,
        enabled: updatedRule.enabled === 1,
        when: updatedRule.when_json,
        find: updatedRule.find_json,
        actions: updatedRule.actions_json
      });
    } catch (e:any) {
      return json(res, 500, { error: 'update-failed', message: String(e?.message || e) });
    }
  });

  // DELETE /:id
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const ruleId = req.params.id;
      const deleted = await db.deleteRule(ruleId);

      if (!deleted) {
        return json(res, 404, { error: 'not-found' });
      }

      return json(res, 200, { status: 'deleted', ruleId });
    } catch (e:any) {
      return json(res, 500, { error: 'delete-failed', message: String(e?.message || e) });
    }
  });

  return router;
}