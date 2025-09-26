"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentsRouter = agentsRouter;
// D24 agents router for testing
const crypto_1 = __importDefault(require("crypto"));
const express_1 = require("express");
const postgresql_1 = require("../db/postgresql");
function agentsRouter() {
    const router = (0, express_1.Router)();
    const pgClient = (0, postgresql_1.getPostgreSQLClient)();
    // GET /agents - List agents
    router.get('/', async (req, res) => {
        try {
            const result = await pgClient.query('SELECT * FROM agents ORDER BY created_at DESC');
            // Map database fields to API format
            const mappedItems = result.rows.map((row) => ({
                agentId: row.agent_id,
                name: row.name,
                webhookUrl: row.webhook_url,
                capabilities: JSON.parse(row.capabilities_json || '[]'),
                status: row.status,
                identityKey: row.identity_key,
                producer: row.identity_key,
                lastPingAt: row.last_ping_at,
                createdAt: row.created_at,
            }));
            res.json({ items: mappedItems, total: mappedItems.length });
        }
        catch (error) {
            console.error('Error listing agents:', error);
            res.status(500).json({ error: 'internal-error' });
        }
    });
    // POST /agents/register - Register new agent
    router.post('/register', async (req, res) => {
        try {
            const { name, webhookUrl, capabilities } = req.body;
            if (!name || !webhookUrl || !capabilities) {
                return res.status(400).json({ error: 'bad-request' });
            }
            const agentId = crypto_1.default.randomUUID();
            const now = new Date(); // Unix timestamp in seconds (fits in integer)
            await pgClient.query(`
        INSERT INTO agents (agent_id, name, webhook_url, capabilities_json, status, created_at)
        VALUES ($1, $2, $3, $4, 'active', $5)
      `, [agentId, name, webhookUrl, JSON.stringify(capabilities), now]);
            res.status(201).json({
                success: true,
                agentId,
                status: 'active',
                name,
                webhookUrl,
                capabilities,
            });
        }
        catch (error) {
            console.error('Error registering agent:', error);
            res.status(500).json({ error: 'internal-error' });
        }
    });
    // GET /agents/search - Search agents
    router.get('/search', async (req, res) => {
        try {
            const { q } = req.query;
            let query = 'SELECT * FROM agents';
            let params = [];
            if (q) {
                query += ' WHERE name ILIKE $1';
                params.push(`%${q}%`);
            }
            query += ' ORDER BY created_at DESC';
            const result = await pgClient.query(query, params);
            // Map database fields to API format
            const mappedItems = result.rows.map((row) => ({
                agentId: row.agent_id,
                name: row.name,
                webhookUrl: row.webhook_url,
                capabilities: JSON.parse(row.capabilities_json || '[]'),
                status: row.status,
                identityKey: row.identity_key,
                producer: row.identity_key,
                lastPingAt: row.last_ping_at,
                createdAt: row.created_at,
            }));
            res.json({ items: mappedItems, total: mappedItems.length });
        }
        catch (error) {
            console.error('Error searching agents:', error);
            res.status(500).json({ error: 'internal-error' });
        }
    });
    // GET /agents/:agentId - Get specific agent
    router.get('/:agentId', async (req, res) => {
        try {
            const { agentId } = req.params;
            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(agentId)) {
                return res.status(404).json({ error: 'not-found' });
            }
            const result = await pgClient.query('SELECT * FROM agents WHERE agent_id = $1', [agentId]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'not-found' });
            }
            const agent = result.rows[0];
            // Map database fields to API format
            const mappedAgent = {
                agentId: agent.agent_id,
                name: agent.name,
                webhookUrl: agent.webhook_url,
                capabilities: JSON.parse(agent.capabilities_json || '[]'),
                status: agent.status,
                identityKey: agent.identity_key,
                producer: agent.identity_key,
                lastPingAt: agent.last_ping_at,
                createdAt: agent.created_at,
            };
            res.json(mappedAgent);
        }
        catch (error) {
            console.error('Error getting agent:', error);
            res.status(500).json({ error: 'internal-error' });
        }
    });
    // POST /agents/:agentId/ping - Ping agent
    router.post('/:agentId/ping', async (req, res) => {
        try {
            const { agentId } = req.params;
            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(agentId)) {
                return res.status(404).json({ error: 'not-found' });
            }
            const now = new Date();
            // Update last ping timestamp
            const result = await pgClient.query(`
        UPDATE agents SET last_ping_at = $1, status = 'up'
        WHERE agent_id = $2
        RETURNING *
      `, [now, agentId]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'not-found' });
            }
            res.json({ status: 'pinged', lastPingAt: now });
        }
        catch (error) {
            console.error('Error pinging agent:', error);
            res.status(500).json({ error: 'internal-error' });
        }
    });
    return router;
}
//# sourceMappingURL=agents.js.map