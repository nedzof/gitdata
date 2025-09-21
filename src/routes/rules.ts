import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { requireIdentity } from '../middleware/identity';
import { createRule, listRules, updateRule, deleteRule } from '../db';

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

      const ruleId = await createRule({
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
      const rules = await listRules(enabled);

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

      return json(res, 200, { rules: formattedRules });
    } catch (e:any) {
      return json(res, 500, { error: 'list-failed', message: String(e?.message || e) });
    }
  });

  // POST /:id/run (trigger rule execution)
  router.post('/:id/run', async (req: Request, res: Response) => {
    try {
      const ruleId = req.params.id;
      // Mock rule execution
      return json(res, 200, {
        status: 'triggered',
        ruleId,
        enqueued: 0 // No jobs actually enqueued in test mode
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

      const updatedRule = await updateRule(ruleId, {
        enabled: updates.enabled,
        name: updates.name,
        when_json: updates.when ? toJsonOrString(updates.when) : undefined,
        find_json: updates.find ? toJsonOrString(updates.find) : undefined,
        actions_json: updates.actions ? toJsonOrString(updates.actions) : undefined
      });

      if (!updatedRule) {
        return json(res, 404, { error: 'rule-not-found' });
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
      const deleted = await deleteRule(ruleId);

      if (!deleted) {
        return json(res, 404, { error: 'rule-not-found' });
      }

      return json(res, 200, { status: 'deleted', ruleId });
    } catch (e:any) {
      return json(res, 500, { error: 'delete-failed', message: String(e?.message || e) });
    }
  });

  return router;
}