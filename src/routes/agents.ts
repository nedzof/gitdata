import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { upsertAgent, getAgent, searchAgents, setAgentPing, getTestDatabase, isTestEnvironment } from '../db';
import { requireIdentity } from '../middleware/identity';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function agentsRouter(testDb?: Database.Database): Router {
  // Get appropriate database
  const db = testDb || (isTestEnvironment() ? getTestDatabase() : null);
  const router = makeRouter();

  // POST /register (identity-signed recommended)
  router.post('/register', requireIdentity(false), (req: Request & { identityKey?: string }, res: Response) => {
    try {
      if (!db) {
        return json(res, 501, { error: 'not-implemented', message: 'Agents not yet implemented for PostgreSQL' });
      }
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
    if (!db) {
      return json(res, 501, { error: 'not-implemented', message: 'Agents not yet implemented for PostgreSQL' });
    }
    const q = req.query.q ? String(req.query.q) : undefined;
    const cap = req.query.capability ? String(req.query.capability) : undefined;
    const items = searchAgents(db, q, cap, 50, 0).map(a => ({
      agentId: a.agent_id, name: a.name,
      capabilities: JSON.parse(a.capabilities_json || '[]'),
      webhookUrl: a.webhook_url, status: a.status, lastPingAt: a.last_ping_at || null
    }));
    return json(res, 200, { items });
  });

  // GET /:id (get agent details)
  router.get('/:id', (req: Request, res: Response) => {
    if (!db) {
      return json(res, 501, { error: 'not-implemented', message: 'Agents not yet implemented for PostgreSQL' });
    }
    const id = String(req.params.id);
    const ag = getAgent(db, id);
    if (!ag) return json(res, 404, { error: 'not-found' });
    return json(res, 200, {
      agentId: ag.agent_id,
      name: ag.name,
      capabilities: JSON.parse(ag.capabilities_json || '[]'),
      webhookUrl: ag.webhook_url,
      status: ag.status,
      lastPingAt: ag.last_ping_at || null
    });
  });

  // POST /:id/ping (agent calls back to prove reachability)
  router.post('/:id/ping', requireIdentity(false), (req: Request & { identityKey?: string }, res: Response) => {
    if (!db) {
      return json(res, 501, { error: 'not-implemented', message: 'Agents not yet implemented for PostgreSQL' });
    }
    const id = String(req.params.id);
    const ag = getAgent(db, id);
    if (!ag) return json(res, 404, { error: 'not-found' });
    setAgentPing(db, id, true);
    return json(res, 200, { status: 'ok' });
  });

  return router;
}