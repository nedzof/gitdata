import { writable } from 'svelte/store';

export const baseUrl = writable('http://localhost:8788');

class APIClient {
  private baseUrl: string = 'http://localhost:8788';

  constructor() {
    // Subscribe to baseUrl changes
    baseUrl.subscribe(url => {
      this.baseUrl = url;
    });
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${data.message || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Listings endpoints
  async searchListings(query = '', limit = 10, offset = 0) {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    return this.request(`/listings?${params}`);
  }

  async getListingDetail(versionId: string) {
    return this.request(`/listings/${encodeURIComponent(versionId)}`);
  }

  // Agents endpoints
  async registerAgent(name: string, webhookUrl: string, capabilities: string[] = []) {
    return this.request('/agents/register', {
      method: 'POST',
      body: { name, webhookUrl, capabilities }
    });
  }

  async searchAgents(query = '') {
    const params = new URLSearchParams();
    if (query) params.append('q', query);

    return this.request(`/agents/search?${params}`);
  }

  async getAgents() {
    return this.request('/agents/search');
  }

  // Rules endpoints
  async createRule(name: string, query = '', agentId: string) {
    const when = { type: 'ready', predicate: {} };
    const find = { source: 'search', query: { q: query }, limit: 10 };
    const actions = [{ action: 'notify', agentId }];

    return this.request('/rules', {
      method: 'POST',
      body: { name, when, find, actions }
    });
  }

  async getRules() {
    return this.request('/rules');
  }

  async runRule(ruleId: string) {
    return this.request(`/rules/${encodeURIComponent(ruleId)}/run`, {
      method: 'POST'
    });
  }

  async deleteRule(ruleId: string) {
    return this.request(`/rules/${encodeURIComponent(ruleId)}`, {
      method: 'DELETE'
    });
  }

  // Jobs endpoints
  async getJobs(state = '') {
    const params = new URLSearchParams();
    if (state) params.append('state', state);

    return this.request(`/jobs?${params}`);
  }

  // Policies endpoints
  async createPolicy(name: string, policy: any) {
    return this.request('/policies', {
      method: 'POST',
      body: { name, policy }
    });
  }

  async getPolicies() {
    return this.request('/policies');
  }

  async getPolicy(policyId: string) {
    return this.request(`/policies/${encodeURIComponent(policyId)}`);
  }

  async updatePolicy(policyId: string, updates: any) {
    return this.request(`/policies/${encodeURIComponent(policyId)}`, {
      method: 'PATCH',
      body: updates
    });
  }

  async deletePolicy(policyId: string) {
    return this.request(`/policies/${encodeURIComponent(policyId)}`, {
      method: 'DELETE'
    });
  }

  async evaluatePolicy(versionId: string, policyId?: string, policy?: any) {
    return this.request('/policies/evaluate', {
      method: 'POST',
      body: { versionId, policyId, policy }
    });
  }

  // Health endpoint
  async getHealth() {
    return this.request('/health');
  }
}

export const api = new APIClient();

// Types
export interface Listing {
  versionId: string;
  name: string;
  description: string;
  datasetId: string;
  producerId: string;
  tags: string[];
  updatedAt: string;
}

export interface ListingDetail {
  versionId: string;
  manifest: {
    name: string;
    description: string;
    datasetId: string;
    contentHash: string;
    license: string;
    classification: string;
    createdAt: string;
  };
}

export interface Agent {
  agentId: string;
  name: string;
  capabilities: string[];
  webhookUrl: string;
  status: string;
  lastPingAt: number;
  createdAt: number;
}

export interface Rule {
  ruleId: string;
  name: string;
  enabled: boolean;
  when: any;
  find: any;
  actions: any[];
  updatedAt: string;
}

export interface Job {
  job_id: string;
  rule_id: string;
  state: string;
  target_id: string;
  attempts: number;
  created_at: number;
  last_error?: string;
}