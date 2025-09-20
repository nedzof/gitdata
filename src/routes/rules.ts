import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { createRule, updateRule, getRule, listRules, deleteRule, enqueueJob, getTestDatabase, isTestEnvironment } from '../db';
import { requireIdentity } from '../middleware/identity';
import { searchManifests } from '../db';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

// Normalize rule bodies
function toJsonOrString(v: any) {
  return typeof v === 'string' ? v : JSON.stringify(v ?? {});
}

export function rulesRouter(testDb?: Database.Database): Router {
  // Get appropriate database
  const db = testDb || (isTestEnvironment() ? getTestDatabase() : null);
  const router = makeRouter();

  // POST / (create)
  router.post('/', requireIdentity(false), (req: Request, res: Response) => {
    try {
      if (!db) {
        return json(res, 501, { error: 'not-implemented', message: 'Rules not yet implemented for PostgreSQL' });
      }
      const { name, enabled=true, when, find, actions } = req.body || {};
      if (!name || !when || !find || !Array.isArray(actions)) {
        return json(res, 400, { error: 'bad-request', hint: 'name, when, find, actions[] required' });
      }
      const id = createRule(db, {
        name, enabled: enabled ? 1 : 0,
        when_json: toJsonOrString(when),
        find_json: toJsonOrString(find),
        actions_json: toJsonOrString(actions)
      });
      return json(res, 200, { status: 'ok', ruleId: id });
    } catch (e:any) {
      return json(res, 500, { error: 'create-rule-failed', message: String(e?.message || e) });
    }
  });

  // GET /
  router.get('/', (req: Request, res: Response) => {
    if (!db) {
      return json(res, 501, { error: 'not-implemented', message: 'Rules not yet implemented for PostgreSQL' });
    }
    const enabledOnly = /^true$/i.test(String(req.query.enabled || 'false'));
    const items = listRules(db, enabledOnly, 100, 0).map(r => ({
      ruleId: r.rule_id, name: r.name, enabled: !!r.enabled,
      when: JSON.parse(r.when_json), find: JSON.parse(r.find_json), actions: JSON.parse(r.actions_json),
      updatedAt: r.updated_at
    }));
    return json(res, 200, { items });
  });

  // GET /:id
  router.get('/:id', (req: Request, res: Response) => {
    if (!db) {
      return json(res, 501, { error: 'not-implemented', message: 'Rules not yet implemented for PostgreSQL' });
    }
    const r = getRule(db, String(req.params.id));
    if (!r) return json(res, 404, { error: 'not-found' });
    return json(res, 200, {
      ruleId: r.rule_id, name: r.name, enabled: !!r.enabled,
      when: JSON.parse(r.when_json), find: JSON.parse(r.find_json), actions: JSON.parse(r.actions_json),
      updatedAt: r.updated_at
    });
  });

  // PATCH /:id (enable/disable/update)
  router.patch('/:id', requireIdentity(false), (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const r = getRule(db, id);
      if (!r) return json(res, 404, { error: 'not-found' });
      const patch: any = {};
      if (typeof req.body?.name === 'string') patch.name = req.body.name;
      if (typeof req.body?.enabled !== 'undefined') patch.enabled = req.body.enabled ? 1 : 0;
      if (req.body?.when) patch.when_json = toJsonOrString(req.body.when);
      if (req.body?.find) patch.find_json = toJsonOrString(req.body.find);
      if (req.body?.actions) patch.actions_json = toJsonOrString(req.body.actions);
      updateRule(db, id, patch);
      return json(res, 200, { status: 'ok' });
    } catch (e:any) {
      return json(res, 500, { error: 'update-rule-failed', message: String(e?.message || e) });
    }
  });

  // DELETE /:id
  router.delete('/:id', requireIdentity(false), (req: Request, res: Response) => {
    if (!db) {
      return json(res, 501, { error: 'not-implemented', message: 'Rules not yet implemented for PostgreSQL' });
    }
    deleteRule(db, String(req.params.id));
    return json(res, 200, { status: 'ok' });
  });

  // POST /:id/run (manual trigger => enqueue jobs for found items)
  router.post('/:id/run', requireIdentity(false), (req: Request, res: Response) => {
    try {
      if (!db) {
        return json(res, 501, { error: 'not-implemented', message: 'Rules not yet implemented for PostgreSQL' });
      }
      const r = getRule(db, String(req.params.id));
      if (!r) return json(res, 404, { error: 'not-found' });
      const find = JSON.parse(r.find_json || '{}');
      const q = find?.query || {};
      const limit = Number(find?.limit || 50);
      const rows = searchManifests(db, { q: q.q, datasetId: q.datasetId, limit });

      let count = 0;
      for (const m of rows) {
        // target_id = versionId (manifest_hash equals versionId in your system)
        enqueueJob(db, { rule_id: r.rule_id, target_id: m.version_id });
        count++;
      }
      return json(res, 200, { status: 'ok', enqueued: count });
    } catch (e:any) {
      return json(res, 500, { error: 'run-rule-failed', message: String(e?.message || e) });
    }
  });

  return router;
}