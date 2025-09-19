import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import {
  upsertRule,
  getRule,
  listRules,
  deleteRule,
  insertJob,
  searchManifests,
  type RuleRow,
  type JobRow
} from '../db';
import { rateLimit } from '../middleware/limits';

export function rulesRouter(db: Database.Database): Router {
  const router = makeRouter();

  // Apply rate limiting to all rule routes
  router.use(rateLimit('rules'));

  // POST /rules - Create a new rule
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, enabled, when, find, actions } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'bad-request', hint: 'name is required' });
      }

      if (!when || typeof when !== 'object') {
        return res.status(400).json({ error: 'bad-request', hint: 'when object is required' });
      }

      if (!find || typeof find !== 'object') {
        return res.status(400).json({ error: 'bad-request', hint: 'find object is required' });
      }

      if (!Array.isArray(actions)) {
        return res.status(400).json({ error: 'bad-request', hint: 'actions must be an array' });
      }

      // Validate find configuration
      if (find.source !== 'search') {
        return res.status(400).json({ error: 'bad-request', hint: 'find.source must be "search"' });
      }

      if (!find.query || typeof find.query !== 'object') {
        return res.status(400).json({ error: 'bad-request', hint: 'find.query is required' });
      }

      // Validate actions
      for (const action of actions) {
        if (!action.action || typeof action.action !== 'string') {
          return res.status(400).json({ error: 'bad-request', hint: 'action.action is required' });
        }

        if (action.action === 'notify' && !action.agentId) {
          return res.status(400).json({ error: 'bad-request', hint: 'notify action requires agentId' });
        }
      }

      // Generate rule ID
      const ruleId = 'rl_' + crypto.randomBytes(16).toString('hex');

      const rule: Partial<RuleRow> = {
        rule_id: ruleId,
        name: name.trim(),
        enabled: enabled !== false ? 1 : 0,
        when_json: JSON.stringify(when),
        find_json: JSON.stringify(find),
        actions_json: JSON.stringify(actions)
      };

      upsertRule(db, rule);

      res.status(201).json({
        ruleId,
        name: rule.name,
        enabled: rule.enabled === 1,
        when,
        find,
        actions
      });

    } catch (e: any) {
      console.error('Rule creation error:', e);
      res.status(500).json({ error: 'rule-creation-failed', message: String(e?.message || e) });
    }
  });

  // GET /rules - List rules
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { enabled, limit } = req.query;

      const opts: Parameters<typeof listRules>[1] = {};

      if (enabled !== undefined) {
        opts.enabled = enabled === 'true';
      }

      if (limit) {
        const limitNum = parseInt(String(limit));
        if (limitNum > 0 && limitNum <= 100) {
          opts.limit = limitNum;
        }
      }

      const rules = listRules(db, opts);

      const results = rules.map(rule => ({
        ruleId: rule.rule_id,
        name: rule.name,
        enabled: rule.enabled === 1,
        when: JSON.parse(rule.when_json),
        find: JSON.parse(rule.find_json),
        actions: JSON.parse(rule.actions_json),
        createdAt: rule.created_at,
        updatedAt: rule.updated_at
      }));

      res.json({ rules: results });

    } catch (e: any) {
      console.error('List rules error:', e);
      res.status(500).json({ error: 'list-failed', message: String(e?.message || e) });
    }
  });

  // GET /rules/:id - Get specific rule
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const ruleId = req.params.id;

      const rule = getRule(db, ruleId);
      if (!rule) {
        return res.status(404).json({ error: 'rule-not-found' });
      }

      res.json({
        ruleId: rule.rule_id,
        name: rule.name,
        enabled: rule.enabled === 1,
        when: JSON.parse(rule.when_json),
        find: JSON.parse(rule.find_json),
        actions: JSON.parse(rule.actions_json),
        createdAt: rule.created_at,
        updatedAt: rule.updated_at
      });

    } catch (e: any) {
      console.error('Get rule error:', e);
      res.status(500).json({ error: 'get-failed', message: String(e?.message || e) });
    }
  });

  // PATCH /rules/:id - Update rule
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const ruleId = req.params.id;

      const existingRule = getRule(db, ruleId);
      if (!existingRule) {
        return res.status(404).json({ error: 'rule-not-found' });
      }

      const { name, enabled, when, find, actions } = req.body;

      const updates: Partial<RuleRow> = {
        rule_id: ruleId
      };

      if (name !== undefined) {
        if (typeof name !== 'string') {
          return res.status(400).json({ error: 'bad-request', hint: 'name must be string' });
        }
        updates.name = name.trim();
      }

      if (enabled !== undefined) {
        updates.enabled = enabled ? 1 : 0;
      }

      if (when !== undefined) {
        if (typeof when !== 'object') {
          return res.status(400).json({ error: 'bad-request', hint: 'when must be object' });
        }
        updates.when_json = JSON.stringify(when);
      }

      if (find !== undefined) {
        if (typeof find !== 'object') {
          return res.status(400).json({ error: 'bad-request', hint: 'find must be object' });
        }
        updates.find_json = JSON.stringify(find);
      }

      if (actions !== undefined) {
        if (!Array.isArray(actions)) {
          return res.status(400).json({ error: 'bad-request', hint: 'actions must be array' });
        }
        updates.actions_json = JSON.stringify(actions);
      }

      upsertRule(db, updates);

      // Return updated rule
      const updatedRule = getRule(db, ruleId)!;
      res.json({
        ruleId: updatedRule.rule_id,
        name: updatedRule.name,
        enabled: updatedRule.enabled === 1,
        when: JSON.parse(updatedRule.when_json),
        find: JSON.parse(updatedRule.find_json),
        actions: JSON.parse(updatedRule.actions_json),
        createdAt: updatedRule.created_at,
        updatedAt: updatedRule.updated_at
      });

    } catch (e: any) {
      console.error('Update rule error:', e);
      res.status(500).json({ error: 'update-failed', message: String(e?.message || e) });
    }
  });

  // DELETE /rules/:id - Delete rule
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const ruleId = req.params.id;

      const existingRule = getRule(db, ruleId);
      if (!existingRule) {
        return res.status(404).json({ error: 'rule-not-found' });
      }

      deleteRule(db, ruleId);

      res.json({ status: 'deleted', ruleId });

    } catch (e: any) {
      console.error('Delete rule error:', e);
      res.status(500).json({ error: 'delete-failed', message: String(e?.message || e) });
    }
  });

  // POST /rules/:id/run - Manually trigger rule execution
  router.post('/:id/run', async (req: Request, res: Response) => {
    try {
      const ruleId = req.params.id;

      const rule = getRule(db, ruleId);
      if (!rule) {
        return res.status(404).json({ error: 'rule-not-found' });
      }

      if (rule.enabled === 0) {
        return res.status(400).json({ error: 'rule-disabled' });
      }

      // Parse rule configuration
      const find = JSON.parse(rule.find_json);
      const actions = JSON.parse(rule.actions_json);

      // Execute find query
      let enqueued = 0;
      if (find.source === 'search') {
        const manifests = searchManifests(db, {
          q: find.query.q || '',
          datasetId: find.query.datasetId,
          limit: find.limit || 10
        });

        // Create jobs for found manifests
        for (const manifest of manifests) {
          const jobId = 'job_' + crypto.randomBytes(16).toString('hex');

          const job: Partial<JobRow> = {
            job_id: jobId,
            rule_id: ruleId,
            state: 'queued',
            evidence_json: JSON.stringify({
              trigger: 'manual',
              manifest: {
                versionId: manifest.version_id,
                datasetId: manifest.dataset_id,
                contentHash: manifest.content_hash
              },
              actions: actions.map(a => ({ ...a, status: 'pending' }))
            })
          };

          insertJob(db, job);
          enqueued++;
        }
      }

      res.json({
        ruleId,
        status: 'triggered',
        enqueued,
        timestamp: Math.floor(Date.now() / 1000)
      });

    } catch (e: any) {
      console.error('Rule run error:', e);
      res.status(500).json({ error: 'run-failed', message: String(e?.message || e) });
    }
  });

  return router;
}