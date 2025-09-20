<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  // State management
  let activeTab = 'overview';
  let loading = false;
  let error = '';
  let success = '';

  // Data for all sections
  let agents = [];
  let rules = [];
  let jobs = [];
  let policies = [];

  // Form states
  let newAgentName = '';
  let newAgentWebhook = '';
  let registering = false;

  let newRuleName = '';
  let newRuleQuery = '';
  let newRuleAgentId = '';
  let creating = false;

  let runRuleId = '';
  let running = false;

  // Jobs filtering
  let selectedJobState = '';
  let autoRefresh = true;
  let refreshInterval = null;

  const jobStates = ['', 'queued', 'running', 'done', 'failed', 'dead'];

  onMount(() => {
    loadAllData();
    if (autoRefresh) {
      startAutoRefresh();
    }
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  });

  function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadJobs, 5000);
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  $: {
    if (autoRefresh && activeTab === 'jobs') {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }

  async function loadAllData() {
    await Promise.all([
      loadAgents(),
      loadRules(),
      loadJobs(),
      loadPolicies()
    ]);
  }

  async function loadAgents() {
    try {
      const result = await api.getAgents();
      agents = result.items || [];
    } catch (e) {
      console.warn('Failed to load agents:', e.message);
    }
  }

  async function loadRules() {
    try {
      const result = await api.getRules();
      rules = result.items || [];
    } catch (e) {
      console.warn('Failed to load rules:', e.message);
    }
  }

  async function loadJobs() {
    try {
      const result = await api.getJobs(selectedJobState);
      jobs = result.items || [];
    } catch (e) {
      console.warn('Failed to load jobs:', e.message);
    }
  }

  async function loadPolicies() {
    try {
      const result = await api.getPolicies();
      policies = result.items || [];
    } catch (e) {
      console.warn('Failed to load policies:', e.message);
    }
  }

  // Agent functions
  async function registerAgent(event) {
    event.preventDefault();
    if (!newAgentName.trim() || !newAgentWebhook.trim()) {
      error = 'Name and Webhook URL are required';
      return;
    }

    try {
      registering = true;
      error = '';
      success = '';

      const result = await api.registerAgent(newAgentName.trim(), newAgentWebhook.trim());
      success = `Agent registered successfully: ${result.agentId}`;

      newAgentName = '';
      newAgentWebhook = '';
      await loadAgents();
    } catch (e) {
      error = e.message;
    } finally {
      registering = false;
    }
  }

  // Rule functions
  async function createRule(event) {
    event.preventDefault();
    if (!newRuleName.trim() || !newRuleAgentId.trim()) {
      error = 'Rule Name and Agent ID are required';
      return;
    }

    try {
      creating = true;
      error = '';
      success = '';

      const result = await api.createRule(newRuleName.trim(), newRuleQuery.trim(), newRuleAgentId.trim());
      success = `Rule created successfully: ${result.ruleId}`;

      newRuleName = '';
      newRuleQuery = '';
      newRuleAgentId = '';
      await loadRules();
    } catch (e) {
      error = e.message;
    } finally {
      creating = false;
    }
  }

  async function runRule(event) {
    event.preventDefault();
    if (!runRuleId.trim()) {
      error = 'Rule ID is required';
      return;
    }

    try {
      running = true;
      error = '';
      success = '';

      const result = await api.runRule(runRuleId.trim());
      success = `Rule executed: ${result.enqueued} jobs enqueued`;
      runRuleId = '';
      await loadJobs();
    } catch (e) {
      error = e.message;
    } finally {
      running = false;
    }
  }

  async function deleteRule(ruleId) {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await api.deleteRule(ruleId);
      success = 'Rule deleted successfully';
      await loadRules();
    } catch (e) {
      error = e.message;
    }
  }

  // Job functions
  async function filterJobs(event) {
    selectedJobState = event.target.value;
    await loadJobs();
  }

  // Utility functions
  function getStatusColor(status) {
    switch (status) {
      case 'up': case 'done': return 'status-success';
      case 'down': case 'failed': case 'dead': return 'status-error';
      case 'running': return 'status-warning';
      case 'unknown': case 'queued': return 'status-pending';
      default: return 'status-pending';
    }
  }

  function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
  }

  function formatDuration(created, updated) {
    const duration = (updated - created) * 1000;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    if (duration < 3600000) return `${Math.round(duration / 60000)}m`;
    return `${Math.round(duration / 3600000)}h`;
  }

  function truncateId(id, length = 12) {
    return id.length > length ? `${id.slice(0, length)}...` : id;
  }

  function getAgentName(agentId) {
    const agent = agents.find(a => a.agentId === agentId);
    return agent ? agent.name : agentId;
  }

  function parseEvidence(evidenceJson) {
    try {
      return JSON.parse(evidenceJson || '[]');
    } catch {
      return [];
    }
  }

  // Summary stats
  $: overviewStats = {
    agents: {
      total: agents.length,
      active: agents.filter(a => a.status === 'up').length
    },
    rules: {
      total: rules.length,
      enabled: rules.filter(r => r.enabled).length
    },
    jobs: {
      total: jobs.length,
      running: jobs.filter(j => j.state === 'running').length,
      queued: jobs.filter(j => j.state === 'queued').length,
      failed: jobs.filter(j => j.state === 'failed' || j.state === 'dead').length
    },
    policies: {
      total: policies.length,
      enabled: policies.filter(p => p.enabled).length
    }
  };
</script>

<div class="automation-hub">
  <!-- Header -->
  <div class="header-section">
    <h2>🤖 Automation Hub</h2>
    <p>
      Unified automation management: register agents, create rules, monitor jobs, and configure policies from one central location.
    </p>
  </div>

  <!-- Tab Navigation -->
  <div class="tab-navigation">
    <button
      class="tab-button {activeTab === 'overview' ? 'active' : ''}"
      on:click={() => activeTab = 'overview'}
    >
      📊 Overview
    </button>
    <button
      class="tab-button {activeTab === 'agents' ? 'active' : ''}"
      on:click={() => activeTab = 'agents'}
    >
      🤖 Agents ({agents.length})
    </button>
    <button
      class="tab-button {activeTab === 'rules' ? 'active' : ''}"
      on:click={() => activeTab = 'rules'}
    >
      ⚡ Rules ({rules.length})
    </button>
    <button
      class="tab-button {activeTab === 'jobs' ? 'active' : ''}"
      on:click={() => activeTab = 'jobs'}
    >
      ⚙️ Jobs ({jobs.length})
    </button>
    <button
      class="tab-button {activeTab === 'policies' ? 'active' : ''}"
      on:click={() => activeTab = 'policies'}
    >
      🛡️ Policies ({policies.length})
    </button>
  </div>

  <!-- Error/Success Messages -->
  {#if error}
    <div class="message error">
      <p>❌ {error}</p>
    </div>
  {/if}

  {#if success}
    <div class="message success">
      <p>✅ {success}</p>
    </div>
  {/if}

  <!-- Tab Content -->
  {#if activeTab === 'overview'}
    <div class="overview-tab">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🤖</div>
          <div class="stat-content">
            <h3>Agents</h3>
            <div class="stat-numbers">
              <span class="primary">{overviewStats.agents.total}</span>
              <span class="secondary">({overviewStats.agents.active} active)</span>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">⚡</div>
          <div class="stat-content">
            <h3>Rules</h3>
            <div class="stat-numbers">
              <span class="primary">{overviewStats.rules.total}</span>
              <span class="secondary">({overviewStats.rules.enabled} enabled)</span>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">⚙️</div>
          <div class="stat-content">
            <h3>Jobs</h3>
            <div class="stat-numbers">
              <span class="primary">{overviewStats.jobs.total}</span>
              <span class="secondary">({overviewStats.jobs.running} running)</span>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">🛡️</div>
          <div class="stat-content">
            <h3>Policies</h3>
            <div class="stat-numbers">
              <span class="primary">{overviewStats.policies.total}</span>
              <span class="secondary">({overviewStats.policies.enabled} enabled)</span>
            </div>
          </div>
        </div>
      </div>

      <div class="quick-actions">
        <h3>Quick Actions</h3>
        <div class="action-buttons">
          <button class="btn primary" on:click={() => activeTab = 'agents'}>
            🚀 Register Agent
          </button>
          <button class="btn primary" on:click={() => activeTab = 'rules'}>
            ⚡ Create Rule
          </button>
          <button class="btn secondary" on:click={loadAllData}>
            🔄 Refresh All
          </button>
        </div>
      </div>
    </div>

  {:else if activeTab === 'agents'}
    <div class="agents-tab">
      <!-- Register New Agent -->
      <div class="form-section">
        <h3>Register New Agent</h3>
        <form on:submit={registerAgent}>
          <div class="form-grid">
            <div class="form-group">
              <label>Agent Name</label>
              <input
                bind:value={newAgentName}
                placeholder="My Data Processing Agent"
                required
              />
            </div>
            <div class="form-group">
              <label>Webhook URL</label>
              <input
                bind:value={newAgentWebhook}
                placeholder="https://myservice.com/webhook"
                type="url"
                required
              />
            </div>
          </div>
          <button type="submit" class="btn primary" disabled={registering}>
            {#if registering}
              <span class="spinner">⚪</span>
              Registering...
            {:else}
              🚀 Register Agent
            {/if}
          </button>
        </form>
      </div>

      <!-- Agents List -->
      <div class="data-table">
        {#if agents.length === 0}
          <div class="empty-state">
            <div class="empty-icon">🤖</div>
            <h3>No Agents Found</h3>
            <p>Register the first agent to get started.</p>
          </div>
        {:else}
          {#each agents as agent}
            <div class="data-card">
              <div class="card-header">
                <div class="card-title">
                  <h3>{agent.name}</h3>
                  <p class="agent-id">ID: <code>{agent.agentId}</code></p>
                </div>
                <span class="status {getStatusColor(agent.status)}">
                  {agent.status.toUpperCase()}
                </span>
              </div>
              <div class="card-content">
                <div class="agent-detail">
                  <span class="label">Webhook:</span>
                  <a href={agent.webhookUrl} target="_blank" rel="noopener noreferrer" class="link">
                    {agent.webhookUrl}
                  </a>
                </div>
                <div class="agent-footer">
                  <div class="agent-meta">
                    <span class="label">Created:</span>
                    <span>{formatTimestamp(agent.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>

  {:else if activeTab === 'rules'}
    <div class="rules-tab">
      <!-- Create New Rule -->
      <div class="form-section">
        <h3>Create New Rule</h3>
        <form on:submit={createRule}>
          <div class="form-grid-three">
            <div class="form-group">
              <label>Rule Name</label>
              <input
                bind:value={newRuleName}
                placeholder="New Data Notification Rule"
                required
              />
            </div>
            <div class="form-group">
              <label>Data Filter</label>
              <input
                bind:value={newRuleQuery}
                placeholder="Leave empty for all data, or enter keywords..."
              />
            </div>
            <div class="form-group">
              <label>Target Agent</label>
              {#if agents.length > 0}
                <select bind:value={newRuleAgentId} required>
                  <option value="">Select an agent...</option>
                  {#each agents as agent}
                    <option value={agent.agentId}>{agent.name} ({agent.agentId})</option>
                  {/each}
                </select>
              {:else}
                <input
                  bind:value={newRuleAgentId}
                  placeholder="ag_123456789abcdef"
                  required
                />
              {/if}
            </div>
          </div>
          <button type="submit" class="btn primary" disabled={creating}>
            {#if creating}
              <span class="spinner">⚪</span>
              Creating...
            {:else}
              ⚡ Create Rule
            {/if}
          </button>
        </form>
      </div>

      <!-- Manual Execution -->
      <div class="execution-section">
        <h3>Manual Execution</h3>
        <form on:submit={runRule} class="execution-form">
          <div class="form-group">
            <label>Rule ID</label>
            {#if rules.length > 0}
              <select bind:value={runRuleId} required>
                <option value="">Select a rule to run...</option>
                {#each rules as rule}
                  <option value={rule.ruleId}>{rule.name} ({rule.ruleId})</option>
                {/each}
              </select>
            {:else}
              <input
                bind:value={runRuleId}
                placeholder="rl_123456789abcdef"
                required
              />
            {/if}
          </div>
          <button type="submit" class="btn primary" disabled={running}>
            {#if running}
              <span class="spinner">⚪</span>
              Running...
            {:else}
              ▶️ Run Rule Now
            {/if}
          </button>
        </form>
      </div>

      <!-- Rules List -->
      <div class="data-table">
        {#if rules.length === 0}
          <div class="empty-state">
            <div class="empty-icon">⚡</div>
            <h3>No Rules Found</h3>
            <p>Create your first automation rule to get started.</p>
          </div>
        {:else}
          {#each rules as rule}
            <div class="data-card">
              <div class="card-header">
                <div class="card-title">
                  <h3>{rule.name}</h3>
                  <p class="rule-id">ID: <code>{rule.ruleId}</code></p>
                </div>
                <div class="rule-actions">
                  <span class="status {rule.enabled ? 'status-success' : 'status-error'}">
                    {rule.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <button
                    on:click={() => deleteRule(rule.ruleId)}
                    class="delete-btn"
                    title="Delete rule"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div class="card-content">
                {#if rule.find?.query?.q}
                  <div class="rule-detail">
                    <span class="label">Data Filter:</span>
                    <span class="filter-value">"{rule.find.query.q}"</span>
                  </div>
                {:else}
                  <div class="rule-detail">
                    <span class="label">Data Filter:</span>
                    <span class="filter-all">All data</span>
                  </div>
                {/if}
                <div class="rule-footer">
                  <div class="rule-meta">
                    <span class="label">Updated:</span>
                    <span>{formatTimestamp(rule.updatedAt)}</span>
                  </div>
                  <button
                    on:click={() => { runRuleId = rule.ruleId; }}
                    class="quick-run"
                  >
                    ▶️ Quick Run
                  </button>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>

  {:else if activeTab === 'jobs'}
    <div class="jobs-tab">
      <!-- Jobs Header -->
      <div class="jobs-header">
        <div class="header-actions">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={autoRefresh} />
            Auto Refresh
          </label>
          <div class="filter-section">
            <label>Filter by State:</label>
            <select on:change={filterJobs} bind:value={selectedJobState}>
              <option value="">All States</option>
              {#each jobStates.slice(1) as state}
                <option value={state}>{state.toUpperCase()}</option>
              {/each}
            </select>
          </div>
          <button on:click={loadJobs} class="btn secondary">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Jobs List -->
      <div class="data-table">
        {#if jobs.length === 0}
          <div class="empty-state">
            <div class="empty-icon">⚙️</div>
            <h3>No Jobs Found</h3>
            <p>
              {selectedJobState ? `No jobs in '${selectedJobState}' state` : 'No jobs have been executed yet'}.
            </p>
          </div>
        {:else}
          {#each jobs as job}
            <div class="job-card">
              <div class="job-header">
                <div class="job-title-row">
                  <h3 class="job-title">Job {truncateId(job.job_id)}</h3>
                  <span class="status {getStatusColor(job.state)}">
                    {job.state.toUpperCase()}
                  </span>
                  {#if job.attempts > 0}
                    <span class="attempt-badge">Attempt {job.attempts + 1}</span>
                  {/if}
                </div>
                <div class="job-details">
                  <div class="job-detail">
                    <span class="label">Rule:</span>
                    <span class="value mono">{truncateId(job.rule_id)}</span>
                  </div>
                  <div class="job-detail">
                    <span class="label">Duration:</span>
                    <span class="value">{formatDuration(job.created_at, job.updated_at)}</span>
                  </div>
                </div>
              </div>
              {#if job.last_error}
                <div class="error-section">
                  <span class="label">Error:</span>
                  <span class="error-text">{job.last_error}</span>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>

  {:else if activeTab === 'policies'}
    <div class="policies-tab">
      <div class="empty-state">
        <div class="empty-icon">🛡️</div>
        <h3>Policy Management</h3>
        <p>Policy configuration interface will be available in the Data section.</p>
        <button class="btn primary" on:click={() => window.location.href = '/data'}>
          🔗 Go to Data Section
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .automation-hub {
    max-width: 1200px;
    margin: 0 auto;
  }

  .header-section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 20px;
  }

  .header-section h2 {
    font-size: 24px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .header-section p {
    color: #8b949e;
    line-height: 1.5;
  }

  .tab-navigation {
    display: flex;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 4px;
    margin-bottom: 20px;
    overflow-x: auto;
  }

  .tab-button {
    flex: 1;
    min-width: 120px;
    padding: 12px 16px;
    background: none;
    border: none;
    color: #8b949e;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .tab-button:hover {
    color: #f0f6fc;
    background: rgba(255, 255, 255, 0.05);
  }

  .tab-button.active {
    background: #238636;
    color: white;
  }

  .message {
    padding: 16px;
    border-radius: 6px;
    margin-bottom: 20px;
    border: 1px solid;
  }

  .message.error {
    background: #2d0d0d;
    border-color: #da3633;
  }

  .message.success {
    background: #0d2818;
    border-color: #2ea043;
  }

  .message p {
    color: #f0f6fc;
    font-weight: 500;
    margin: 0;
  }

  /* Overview Tab */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .stat-card {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .stat-icon {
    font-size: 32px;
    opacity: 0.8;
  }

  .stat-content h3 {
    font-size: 16px;
    font-weight: 600;
    color: #f0f6fc;
    margin-bottom: 4px;
  }

  .stat-numbers {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stat-numbers .primary {
    font-size: 24px;
    font-weight: 700;
    color: #ffffff;
  }

  .stat-numbers .secondary {
    font-size: 14px;
    color: #8b949e;
  }

  .quick-actions {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
  }

  .quick-actions h3 {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 16px;
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  /* Common Styles */
  .form-section, .execution-section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 20px;
  }

  .form-section h3, .execution-section h3 {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 16px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }

  .form-grid-three {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-group label {
    margin-bottom: 8px;
    color: #f0f6fc;
    font-weight: 600;
    font-size: 14px;
  }

  .form-group input, .form-group select {
    padding: 8px 12px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .form-group input:focus, .form-group select:focus {
    border-color: #1f6feb;
    outline: none;
  }

  .execution-form {
    display: flex;
    gap: 16px;
    align-items: flex-end;
  }

  .execution-form .form-group {
    flex: 1;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    border: none;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .btn.primary {
    background: #238636;
    color: white;
  }

  .btn.primary:hover:not(:disabled) {
    background: #2ea043;
  }

  .btn.secondary {
    background: #21262d;
    color: #f0f6fc;
    border: 1px solid #30363d;
  }

  .btn.secondary:hover:not(:disabled) {
    background: #30363d;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .data-table {
    margin-bottom: 20px;
  }

  .empty-state {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-state .empty-icon {
    font-size: 48px;
    opacity: 0.5;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .empty-state p {
    color: #8b949e;
    margin-bottom: 16px;
  }

  .data-card, .job-card {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
    transition: background-color 0.2s;
  }

  .data-card:hover, .job-card:hover {
    background: #161b22;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .card-title h3 {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 4px;
  }

  .agent-id, .rule-id {
    color: #8b949e;
    font-size: 14px;
  }

  .agent-id code, .rule-id code {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  }

  .status {
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status.status-success {
    background: #0d2818;
    color: #2ea043;
    border: 1px solid #2ea043;
  }

  .status.status-error {
    background: #2d0d0d;
    color: #da3633;
    border: 1px solid #da3633;
  }

  .status.status-warning {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(96, 165, 250);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .status.status-pending {
    background: #2d2000;
    color: #ffc107;
    border: 1px solid #ffc107;
  }

  .card-content {
    color: #8b949e;
    font-size: 14px;
  }

  .agent-detail, .rule-detail, .job-detail {
    margin-bottom: 12px;
  }

  .label {
    font-weight: 600;
    color: #f0f6fc;
  }

  .link {
    color: #58a6ff;
    text-decoration: none;
    margin-left: 8px;
    word-break: break-all;
  }

  .link:hover {
    text-decoration: underline;
  }

  .agent-footer, .rule-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    margin-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .agent-meta, .rule-meta {
    font-size: 14px;
  }

  .agent-meta span, .rule-meta span {
    margin-left: 4px;
  }

  .quick-run {
    background: none;
    border: none;
    color: #58a6ff;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
  }

  .quick-run:hover {
    text-decoration: underline;
  }

  .delete-btn {
    background: none;
    border: none;
    color: #da3633;
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
  }

  .delete-btn:hover {
    color: #ff4d4d;
  }

  .rule-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .filter-value {
    margin-left: 8px;
  }

  .filter-all {
    margin-left: 8px;
    font-style: italic;
  }

  /* Jobs specific */
  .jobs-header {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    color: #f0f6fc;
    font-size: 14px;
  }

  .checkbox-label input[type="checkbox"] {
    margin-right: 8px;
  }

  .filter-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .filter-section label {
    color: #f0f6fc;
    font-weight: 500;
    font-size: 14px;
  }

  .filter-section select {
    padding: 6px 12px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .job-title-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
  }

  .job-title {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
  }

  .attempt-badge {
    color: #ffa500;
    font-size: 14px;
  }

  .job-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    color: #8b949e;
    font-size: 14px;
  }

  .value {
    margin-left: 8px;
  }

  .value.mono {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  }

  .error-section {
    background: rgba(218, 54, 51, 0.1);
    border: 1px solid rgba(218, 54, 51, 0.3);
    border-radius: 6px;
    padding: 12px;
    margin-top: 12px;
  }

  .error-section .label {
    color: #ff6b6b;
  }

  .error-text {
    color: #ffa8a8;
    margin-left: 8px;
  }

  @media (max-width: 768px) {
    .form-grid, .form-grid-three {
      grid-template-columns: 1fr;
    }

    .execution-form {
      flex-direction: column;
      align-items: stretch;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .action-buttons {
      flex-direction: column;
    }

    .header-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .card-header {
      flex-direction: column;
      gap: 12px;
    }

    .rule-footer, .agent-footer {
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }

    .job-title-row {
      flex-wrap: wrap;
      gap: 8px;
    }

    .job-details {
      grid-template-columns: 1fr;
    }
  }
</style>