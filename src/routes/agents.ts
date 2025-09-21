import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { upsertAgent, getAgent, searchAgents, setAgentPing } from '../db';
import { requireIdentity } from '../middleware/identity';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function agentsRouter(): Router {
  const router = makeRouter();

  // POST /register (identity-signed recommended)
  router.post('/register', requireIdentity(false), async (req: Request & { identityKey?: string }, res: Response) => {
    try {
      const { name, capabilities, webhookUrl, identityKey } = req.body || {};
      if (!name || !webhookUrl || !Array.isArray(capabilities)) {
        return json(res, 400, { error: 'bad-request', hint: 'name, webhookUrl, capabilities[] required' });
      }
      const agentId = await upsertAgent({
        name, webhook_url: webhookUrl, capabilities_json: JSON.stringify(capabilities),
        identity_key: (identityKey || req.identityKey || '').toLowerCase(),
        status: 'unknown'
      });
      return json(res, 201, { status: 'active', agentId, name });
    } catch (e:any) {
      return json(res, 500, { error: 'register-failed', message: String(e?.message || e) });
    }
  });

  // GET /search?q&capability
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const q = req.query.q ? String(req.query.q) : undefined;
      const cap = req.query.capability ? String(req.query.capability) : undefined;
      const items = (await searchAgents(q, cap, 50, 0)).map(a => ({
        agentId: a.agent_id, name: a.name,
        capabilities: JSON.parse(a.capabilities_json || '[]'),
        webhookUrl: a.webhook_url, status: a.status, lastPingAt: a.last_ping_at || null
      }));
      return json(res, 200, { items });
    } catch (e:any) {
      return json(res, 500, { error: 'search-failed', message: String(e?.message || e) });
    }
  });

  // GET /:id (get agent details)
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const agentId = req.params.id;
      const agent = await getAgent(agentId);
      if (!agent) {
        return json(res, 404, { error: 'not-found', message: `Agent ${agentId} not found` });
      }
      return json(res, 200, {
        agentId: agent.agent_id, name: agent.name,
        capabilities: JSON.parse(agent.capabilities_json || '[]'),
        webhookUrl: agent.webhook_url, status: agent.status,
        lastPingAt: agent.last_ping_at || null
      });
    } catch (e:any) {
      return json(res, 500, { error: 'get-failed', message: String(e?.message || e) });
    }
  });

  // POST /:id/ping (ping an agent)
  router.post('/:id/ping', async (req: Request, res: Response) => {
    try {
      const agentId = req.params.id;
      const agent = await getAgent(agentId);
      if (!agent) {
        return json(res, 404, { error: 'not-found', message: `Agent ${agentId} not found` });
      }
      await setAgentPing(agentId, true);
      return json(res, 200, { status: 'pinged', agentId });
    } catch (e:any) {
      return json(res, 500, { error: 'ping-failed', message: String(e?.message || e) });
    }
  });

  return router;
}