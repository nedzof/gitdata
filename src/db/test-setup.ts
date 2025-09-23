// Test database setup - provides in-memory mock implementation
// This replaces PostgreSQL/Redis dependencies for unit tests

export class TestDatabase {
  private agents = new Map<string, any>();
  private rules = new Map<string, any>();
  private jobs = new Map<string, any>();
  private templates = new Map<string, any>();
  private manifests = new Map<string, any>();
  private edges = new Map<string, string[]>();

  async upsertAgent(agent: any): Promise<string> {
    const agentId =
      agent.agent_id || `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  async getAgent(agentId: string): Promise<any> {
    return this.agents.get(agentId) || null;
  }

  async searchAgents(q?: string, capability?: string, limit = 50, offset = 0): Promise<any[]> {
    let results = Array.from(this.agents.values());

    if (q) {
      results = results.filter((agent) => agent.name.includes(q) || agent.agent_id.includes(q));
    }

    if (capability) {
      results = results.filter((agent) => agent.capabilities_json.includes(capability));
    }

    return results.slice(offset, offset + limit);
  }

  async setAgentPing(agentId: string, success: boolean): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = success ? 'up' : 'down';
      agent.last_ping_at = Date.now();
      agent.updated_at = Date.now();
    }
  }

  async createRule(rule: any): Promise<string> {
    const ruleId = rule.rule_id || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const ruleRecord = {
      rule_id: ruleId,
      name: rule.name,
      enabled: rule.enabled !== false ? 1 : 0,
      when_json: typeof rule.when === 'string' ? rule.when : JSON.stringify(rule.when || {}),
      find_json: typeof rule.find === 'string' ? rule.find : JSON.stringify(rule.find || {}),
      actions_json:
        typeof rule.actions === 'string' ? rule.actions : JSON.stringify(rule.actions || []),
      owner_producer_id: rule.owner_producer_id,
      created_at: rule.created_at || now,
      updated_at: now,
    };

    this.rules.set(ruleId, ruleRecord);
    return ruleId;
  }

  async listRules(enabled?: boolean): Promise<any[]> {
    let results = Array.from(this.rules.values());

    if (enabled !== undefined) {
      results = results.filter((rule) => (enabled ? rule.enabled === 1 : rule.enabled === 0));
    }

    return results;
  }

  async updateRule(ruleId: string, updates: any): Promise<any> {
    const rule = this.rules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      rule.updated_at = Date.now();
      return rule;
    }
    return null;
  }

  async deleteRule(ruleId: string): Promise<boolean> {
    return this.rules.delete(ruleId);
  }

  async listJobs(ruleId?: string, state?: string, limit = 100, offset = 0): Promise<any[]> {
    let results = Array.from(this.jobs.values());

    if (ruleId) {
      results = results.filter((job) => job.rule_id === ruleId);
    }

    if (state) {
      results = results.filter((job) => job.state === state);
    }

    return results.slice(offset, offset + limit);
  }

  async createTemplate(template: any): Promise<string> {
    const templateId =
      template.template_id || `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  async getTemplate(templateId: string): Promise<any> {
    return this.templates.get(templateId) || null;
  }

  async listTemplates(limit = 100, offset = 0): Promise<any[]> {
    const results = Array.from(this.templates.values());
    return results.slice(offset, offset + limit);
  }

  async updateTemplate(templateId: string, updates: any): Promise<any> {
    const template = this.templates.get(templateId);
    if (template) {
      Object.assign(template, updates);
      template.updated_at = Date.now();
      return template;
    }
    return null;
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    return this.templates.delete(templateId);
  }

  async searchManifests(q?: string, limit = 50, offset = 0): Promise<any[]> {
    let results = Array.from(this.manifests.values());

    if (q) {
      results = results.filter(
        (manifest) =>
          (manifest.title && manifest.title.includes(q)) ||
          (manifest.dataset_id && manifest.dataset_id.includes(q)),
      );
    }

    return results.slice(offset, offset + limit);
  }

  async listVersionsByDataset(datasetId: string): Promise<any[]> {
    const results = Array.from(this.manifests.values()).filter(
      (manifest) => manifest.dataset_id === datasetId,
    );
    return results;
  }

  async getParents(versionId: string): Promise<string[]> {
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
  prepare(sql: string) {
    return {
      run: (...params: any[]) => ({ lastInsertRowid: 1, changes: 1 }),
      get: (...params: any[]) => null,
      all: (...params: any[]) => [],
    };
  }

  transaction(fn: () => any) {
    return fn();
  }

  exec(sql: string) {
    return this;
  }

  close() {
    // No-op for test database
    return Promise.resolve();
  }
}

// Global test database instance
let testDb: TestDatabase;

export function getTestDatabase(): TestDatabase {
  if (!testDb) {
    testDb = new TestDatabase();
  }
  return testDb;
}

export function resetTestDatabase(): void {
  if (testDb) {
    testDb.clear();
  }
}

// Mock implementations for database functions
export async function initSchema(): Promise<TestDatabase> {
  return getTestDatabase();
}

export async function upsertAgent(agent: any): Promise<string> {
  return getTestDatabase().upsertAgent(agent);
}

export async function getAgent(agentId: string): Promise<any> {
  return getTestDatabase().getAgent(agentId);
}

export async function searchAgents(
  q?: string,
  capability?: string,
  limit = 50,
  offset = 0,
): Promise<any[]> {
  return getTestDatabase().searchAgents(q, capability, limit, offset);
}

export async function setAgentPing(agentId: string, success: boolean): Promise<void> {
  return getTestDatabase().setAgentPing(agentId, success);
}

export async function createRule(rule: any): Promise<string> {
  return getTestDatabase().createRule(rule);
}

export async function listRules(enabled?: boolean): Promise<any[]> {
  return getTestDatabase().listRules(enabled);
}

export async function updateRule(ruleId: string, updates: any): Promise<any> {
  return getTestDatabase().updateRule(ruleId, updates);
}

export async function deleteRule(ruleId: string): Promise<boolean> {
  return getTestDatabase().deleteRule(ruleId);
}

export async function listJobs(
  ruleId?: string,
  state?: string,
  limit = 100,
  offset = 0,
): Promise<any[]> {
  return getTestDatabase().listJobs(ruleId, state, limit, offset);
}

export async function createTemplate(template: any): Promise<string> {
  return getTestDatabase().createTemplate(template);
}

export async function getTemplate(templateId: string): Promise<any> {
  return getTestDatabase().getTemplate(templateId);
}

export async function listTemplates(limit = 100, offset = 0): Promise<any[]> {
  return getTestDatabase().listTemplates(limit, offset);
}

export async function updateTemplate(templateId: string, updates: any): Promise<any> {
  return getTestDatabase().updateTemplate(templateId, updates);
}

export async function deleteTemplate(templateId: string): Promise<boolean> {
  return getTestDatabase().deleteTemplate(templateId);
}

export async function searchManifests(q?: string, limit = 50, offset = 0): Promise<any[]> {
  return getTestDatabase().searchManifests(q, limit, offset);
}

export async function listVersionsByDataset(datasetId: string): Promise<any[]> {
  return getTestDatabase().listVersionsByDataset(datasetId);
}

export async function getParents(versionId: string): Promise<string[]> {
  return getTestDatabase().getParents(versionId);
}
