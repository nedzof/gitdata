// API Client for D25 GUI
class APIClient {
  constructor() {
    this.baseUrl = this.getBaseUrl();
  }

  getBaseUrl() {
    return localStorage.getItem('d25_base_url') || 'http://localhost:8788';
  }

  setBaseUrl(url) {
    localStorage.setItem('d25_base_url', url);
    this.baseUrl = url;
  }

  async request(path, options = {}) {
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
        throw new Error(data.error || `HTTP ${response.status}`);
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

  async getListingDetail(versionId) {
    return this.request(`/listings/${encodeURIComponent(versionId)}`);
  }

  // Agents endpoints
  async registerAgent(name, webhookUrl, capabilities = []) {
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

  // Rules endpoints
  async createRule(name, query = '', agentId) {
    const when = { type: 'ready', predicate: {} };
    const find = { source: 'search', query: { q: query }, limit: 10 };
    const actions = [{ action: 'notify', agentId }];

    return this.request('/rules', {
      method: 'POST',
      body: { name, when, find, actions }
    });
  }

  async runRule(ruleId) {
    return this.request(`/rules/${encodeURIComponent(ruleId)}/run`, {
      method: 'POST'
    });
  }

  // Jobs endpoints
  async getJobs(state = '') {
    const params = new URLSearchParams();
    if (state) params.append('state', state);

    return this.request(`/jobs?${params}`);
  }
}

// Export as global
window.api = new APIClient();