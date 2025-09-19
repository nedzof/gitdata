import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { upsertAgent, getAgent, searchAgents, setAgentPing } from '../db';
import { requireIdentity } from '../middleware/identity';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function agentsRouter(db: Database.Database): Router {
  const router = makeRouter();

  // POST /register (identity-signed recommended)
  router.post('/register', requireIdentity(false), (req: Request & { identityKey?: string }, res: Response) => {
    try {
      const { name, capabilities, webhookUrl, identityKey } = req.body || {};
      if (!name || !webhookUrl || !Array.isArray(capabilities)) {
        return json(res, 400, { error: 'bad-request', hint: 'name, webhookUrl, capabilities[] required' });
      }
      const agentId = upsertAgent(db, {
        name, webhook_url: webhookUrl, capabilities_json: JSON.stringify(capabilities),
        identity_key: (identityKey || req.identityKey || '').toLowerCase(),
        status: 'unknown'
      });
      return json(res, 200, { status: 'ok', agentId });
    } catch (e:any) {
      return json(res, 500, { error: 'register-failed', message: String(e?.message || e) });
    }
  });

  // GET /search?q&capability
  router.get('/search', (req: Request, res: Response) => {
    const q = req.query.q ? String(req.query.q) : undefined;
    const cap = req.query.capability ? String(req.query.capability) : undefined;
    const items = searchAgents(db, q, cap, 50, 0).map(a => ({
      agentId: a.agent_id, name: a.name,
      capabilities: JSON.parse(a.capabilities_json || '[]'),
      webhookUrl: a.webhook_url, status: a.status, lastPingAt: a.last_ping_at || null
    }));
    return json(res, 200, { items });
  });

  // POST /:id/ping (agent calls back to prove reachability)
  router.post('/:id/ping', requireIdentity(false), (req: Request & { identityKey?: string }, res: Response) => {
    const id = String(req.params.id);
    const ag = getAgent(db, id);
    if (!ag) return json(res, 404, { error: 'not-found' });
    setAgentPing(db, id, true);
    return json(res, 200, { status: 'ok' });
  });

  return router;
}