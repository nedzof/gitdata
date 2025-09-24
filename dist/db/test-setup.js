"use strict";
// Test database setup - provides in-memory mock implementation
// This replaces PostgreSQL/Redis dependencies for unit tests
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestDatabase = void 0;
exports.getTestDatabase = getTestDatabase;
exports.resetTestDatabase = resetTestDatabase;
exports.initSchema = initSchema;
exports.upsertAgent = upsertAgent;
exports.getAgent = getAgent;
exports.searchAgents = searchAgents;
exports.setAgentPing = setAgentPing;
exports.createRule = createRule;
exports.listRules = listRules;
exports.updateRule = updateRule;
exports.deleteRule = deleteRule;
exports.listJobs = listJobs;
exports.createTemplate = createTemplate;
exports.getTemplate = getTemplate;
exports.listTemplates = listTemplates;
exports.updateTemplate = updateTemplate;
exports.deleteTemplate = deleteTemplate;
exports.searchManifests = searchManifests;
exports.listVersionsByDataset = listVersionsByDataset;
exports.getParents = getParents;
class TestDatabase {
    constructor() {
        this.agents = new Map();
        this.rules = new Map();
        this.jobs = new Map();
        this.templates = new Map();
        this.manifests = new Map();
        this.edges = new Map();
    }
    async upsertAgent(agent) {
        const agentId = agent.agent_id || `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();
        const agentRecord = {
            agent_id: agentId,
            name: agent.name,
            capabilities_json: agent.capabilities_json || '[]',
            webhook_url: agent.webhook_url,
            identity_key: agent.identity_key,
            status: agent.status || 'unknown',
            last_ping_at: agent.last_ping_at,
            created_at: agent.created_at || now,
            updated_at: now,
        };
        this.agents.set(agentId, agentRecord);
        return agentId;
    }
    async getAgent(agentId) {
        return this.agents.get(agentId) || null;
    }
    async searchAgents(q, capability, limit = 50, offset = 0) {
        let results = Array.from(this.agents.values());
        if (q) {
            results = results.filter((agent) => agent.name.includes(q) || agent.agent_id.includes(q));
        }
        if (capability) {
            results = results.filter((agent) => agent.capabilities_json.includes(capability));
        }
        return results.slice(offset, offset + limit);
    }
    async setAgentPing(agentId, success) {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.status = success ? 'up' : 'down';
            agent.last_ping_at = Date.now();
            agent.updated_at = Date.now();
        }
    }
    async createRule(rule) {
        const ruleId = rule.rule_id || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();
        const ruleRecord = {
            rule_id: ruleId,
            name: rule.name,
            enabled: rule.enabled !== false ? 1 : 0,
            when_json: typeof rule.when === 'string' ? rule.when : JSON.stringify(rule.when || {}),
            find_json: typeof rule.find === 'string' ? rule.find : JSON.stringify(rule.find || {}),
            actions_json: typeof rule.actions === 'string' ? rule.actions : JSON.stringify(rule.actions || []),
            owner_producer_id: rule.owner_producer_id,
            created_at: rule.created_at || now,
            updated_at: now,
        };
        this.rules.set(ruleId, ruleRecord);
        return ruleId;
    }
    async listRules(enabled) {
        let results = Array.from(this.rules.values());
        if (enabled !== undefined) {
            results = results.filter((rule) => (enabled ? rule.enabled === 1 : rule.enabled === 0));
        }
        return results;
    }
    async updateRule(ruleId, updates) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            Object.assign(rule, updates);
            rule.updated_at = Date.now();
            return rule;
        }
        return null;
    }
    async deleteRule(ruleId) {
        return this.rules.delete(ruleId);
    }
    async listJobs(ruleId, state, limit = 100, offset = 0) {
        let results = Array.from(this.jobs.values());
        if (ruleId) {
            results = results.filter((job) => job.rule_id === ruleId);
        }
        if (state) {
            results = results.filter((job) => job.state === state);
        }
        return results.slice(offset, offset + limit);
    }
    async createTemplate(template) {
        const templateId = template.template_id || `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();
        const templateRecord = {
            template_id: templateId,
            name: template.name,
            description: template.description,
            template_content: template.template_content,
            template_type: template.template_type || 'pdf',
            variables_json: template.variables_json,
            owner_producer_id: template.owner_producer_id,
            created_at: template.created_at || now,
            updated_at: now,
        };
        this.templates.set(templateId, templateRecord);
        return templateId;
    }
    async getTemplate(templateId) {
        return this.templates.get(templateId) || null;
    }
    async listTemplates(limit = 100, offset = 0) {
        const results = Array.from(this.templates.values());
        return results.slice(offset, offset + limit);
    }
    async updateTemplate(templateId, updates) {
        const template = this.templates.get(templateId);
        if (template) {
            Object.assign(template, updates);
            template.updated_at = Date.now();
            return template;
        }
        return null;
    }
    async deleteTemplate(templateId) {
        return this.templates.delete(templateId);
    }
    async searchManifests(q, limit = 50, offset = 0) {
        let results = Array.from(this.manifests.values());
        if (q) {
            results = results.filter((manifest) => (manifest.title && manifest.title.includes(q)) ||
                (manifest.dataset_id && manifest.dataset_id.includes(q)));
        }
        return results.slice(offset, offset + limit);
    }
    async listVersionsByDataset(datasetId) {
        const results = Array.from(this.manifests.values()).filter((manifest) => manifest.dataset_id === datasetId);
        return results;
    }
    async getParents(versionId) {
        return this.edges.get(versionId) || [];
    }
    clear() {
        this.agents.clear();
        this.rules.clear();
        this.jobs.clear();
        this.templates.clear();
        this.manifests.clear();
        this.edges.clear();
    }
    // SQLite compatibility methods for tests
    prepare(sql) {
        return {
            run: (...params) => ({ lastInsertRowid: 1, changes: 1 }),
            get: (...params) => null,
            all: (...params) => [],
        };
    }
    transaction(fn) {
        return fn();
    }
    exec(sql) {
        return this;
    }
    close() {
        // No-op for test database
        return Promise.resolve();
    }
}
exports.TestDatabase = TestDatabase;
// Global test database instance
let testDb;
function getTestDatabase() {
    if (!testDb) {
        testDb = new TestDatabase();
    }
    return testDb;
}
function resetTestDatabase() {
    if (testDb) {
        testDb.clear();
    }
}
// Mock implementations for database functions
async function initSchema() {
    return getTestDatabase();
}
async function upsertAgent(agent) {
    return getTestDatabase().upsertAgent(agent);
}
async function getAgent(agentId) {
    return getTestDatabase().getAgent(agentId);
}
async function searchAgents(q, capability, limit = 50, offset = 0) {
    return getTestDatabase().searchAgents(q, capability, limit, offset);
}
async function setAgentPing(agentId, success) {
    return getTestDatabase().setAgentPing(agentId, success);
}
async function createRule(rule) {
    return getTestDatabase().createRule(rule);
}
async function listRules(enabled) {
    return getTestDatabase().listRules(enabled);
}
async function updateRule(ruleId, updates) {
    return getTestDatabase().updateRule(ruleId, updates);
}
async function deleteRule(ruleId) {
    return getTestDatabase().deleteRule(ruleId);
}
async function listJobs(ruleId, state, limit = 100, offset = 0) {
    return getTestDatabase().listJobs(ruleId, state, limit, offset);
}
async function createTemplate(template) {
    return getTestDatabase().createTemplate(template);
}
async function getTemplate(templateId) {
    return getTestDatabase().getTemplate(templateId);
}
async function listTemplates(limit = 100, offset = 0) {
    return getTestDatabase().listTemplates(limit, offset);
}
async function updateTemplate(templateId, updates) {
    return getTestDatabase().updateTemplate(templateId, updates);
}
async function deleteTemplate(templateId) {
    return getTestDatabase().deleteTemplate(templateId);
}
async function searchManifests(q, limit = 50, offset = 0) {
    return getTestDatabase().searchManifests(q, limit, offset);
}
async function listVersionsByDataset(datasetId) {
    return getTestDatabase().listVersionsByDataset(datasetId);
}
async function getParents(versionId) {
    return getTestDatabase().getParents(versionId);
}
//# sourceMappingURL=test-setup.js.map