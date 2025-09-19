import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import {
  upsertAgent,
  getAgent,
  searchAgents,
  updateAgentPing,
  type AgentRow
} from '../db';
import { rateLimit } from '../middleware/limits';

export function agentsRouter(db: Database.Database): Router {
  const router = makeRouter();

  // Apply rate limiting to all agent routes
  router.use(rateLimit('agents'));

  // POST /agents/register - Register a new agent
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { name, capabilities, webhookUrl, identityKey } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'bad-request', hint: 'name is required' });
      }

      if (!Array.isArray(capabilities)) {
        return res.status(400).json({ error: 'bad-request', hint: 'capabilities must be an array' });
      }

      if (!webhookUrl || typeof webhookUrl !== 'string') {
        return res.status(400).json({ error: 'bad-request', hint: 'webhookUrl is required' });
      }

      // Validate webhook URL format
      try {
        new URL(webhookUrl);
      } catch {
        return res.status(400).json({ error: 'bad-request', hint: 'webhookUrl must be a valid URL' });
      }

      // Validate identity key if provided
      if (identityKey && !/^[0-9a-fA-F]{66}$/.test(identityKey)) {
        return res.status(400).json({ error: 'bad-request', hint: 'identityKey must be 66-character hex' });
      }

      // Generate agent ID
      const agentId = 'ag_' + crypto.randomBytes(16).toString('hex');

      const agent: Partial<AgentRow> = {
        agent_id: agentId,
        name: name.trim(),
        capabilities_json: JSON.stringify(capabilities),
        webhook_url: webhookUrl.trim(),
        identity_key: identityKey?.toLowerCase() || null,
        status: 'active'
      };

      upsertAgent(db, agent);

      res.status(201).json({
        agentId,
        name: agent.name,
        capabilities,
        webhookUrl: agent.webhook_url,
        identityKey: agent.identity_key,
        status: agent.status
      });

    } catch (e: any) {
      console.error('Agent registration error:', e);
      res.status(500).json({ error: 'registration-failed', message: String(e?.message || e) });
    }
  });

  // GET /agents/search - Search for agents
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const { q, capability, status, limit } = req.query;

      const opts: Parameters<typeof searchAgents>[1] = {};

      if (q && typeof q === 'string') {
        opts.q = q.trim();
      }

      if (capability && typeof capability === 'string') {
        opts.capability = capability.trim();
      }

      if (status && typeof status === 'string') {
        opts.status = status.trim();
      }

      if (limit) {
        const limitNum = parseInt(String(limit));
        if (limitNum > 0 && limitNum <= 100) {
          opts.limit = limitNum;
        }
      }

      const agents = searchAgents(db, opts);

      const results = agents.map(agent => ({
        agentId: agent.agent_id,
        name: agent.name,
        capabilities: JSON.parse(agent.capabilities_json),
        webhookUrl: agent.webhook_url,
        identityKey: agent.identity_key,
        status: agent.status,
        lastPingAt: agent.last_ping_at,
        createdAt: agent.created_at
      }));

      res.json({ agents: results });

    } catch (e: any) {
      console.error('Agent search error:', e);
      res.status(500).json({ error: 'search-failed', message: String(e?.message || e) });
    }
  });

  // GET /agents/:id - Get specific agent
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const agentId = req.params.id;

      const agent = getAgent(db, agentId);
      if (!agent) {
        return res.status(404).json({ error: 'agent-not-found' });
      }

      res.json({
        agentId: agent.agent_id,
        name: agent.name,
        capabilities: JSON.parse(agent.capabilities_json),
        webhookUrl: agent.webhook_url,
        identityKey: agent.identity_key,
        status: agent.status,
        lastPingAt: agent.last_ping_at,
        createdAt: agent.created_at,
        updatedAt: agent.updated_at
      });

    } catch (e: any) {
      console.error('Get agent error:', e);
      res.status(500).json({ error: 'get-failed', message: String(e?.message || e) });
    }
  });

  // POST /agents/:id/ping - Update agent ping timestamp
  router.post('/:id/ping', async (req: Request, res: Response) => {
    try {
      const agentId = req.params.id;

      const agent = getAgent(db, agentId);
      if (!agent) {
        return res.status(404).json({ error: 'agent-not-found' });
      }

      updateAgentPing(db, agentId);

      res.json({
        agentId,
        status: 'pinged',
        timestamp: Math.floor(Date.now() / 1000)
      });

    } catch (e: any) {
      console.error('Agent ping error:', e);
      res.status(500).json({ error: 'ping-failed', message: String(e?.message || e) });
    }
  });

  return router;
}