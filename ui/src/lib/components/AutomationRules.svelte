<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let rules = [];
  let agents = [];
  let loading = false;
  let error = '';
  let success = '';

  // Create rule form
  let newRuleName = '';
  let newRuleQuery = '';
  let newRuleAgentId = '';
  let creating = false;

  // Run rule form
  let runRuleId = '';
  let running = false;

  onMount(() => {
    loadRules();
    loadAgents();
  });

  async function loadRules() {
    try {
      loading = true;
      error = '';
      const result = await api.getRules();
      rules = result.items || [];
    } catch (e) {
      error = e.message;
      rules = [];
    } finally {
      loading = false;
    }
  }

  async function loadAgents() {
    try {
      const result = await api.getAgents();
      agents = result.items || [];
    } catch (e) {
      console.warn('Failed to load agents:', e.message);
    }
  }

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

      // Clear form
      newRuleName = '';
      newRuleQuery = '';
      newRuleAgentId = '';

      // Refresh rules list
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

      // Clear form
      runRuleId = '';
    } catch (e) {
      error = e.message;
    } finally {
      running = false;
    }
  }

  async function deleteRule(ruleId) {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      await api.deleteRule(ruleId);
      success = 'Rule deleted successfully';
      await loadRules();
    } catch (e) {
      error = e.message;
    }
  }

  function getAgentName(agentId) {
    const agent = agents.find(a => a.agentId === agentId);
    return agent ? agent.name : agentId;
  }

  function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }
</script>

<div>
  <!-- Header -->
  <div class="header-section">
    <h2>Automation Rules</h2>
    <p>
      Create automated workflows that trigger when new data matches your criteria. Rules can notify agents, generate documents, or execute custom actions.
    </p>
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
  <div class="rules-list">
    <div class="list-header">
      <h3>Existing Rules</h3>
      <button
        on:click={loadRules}
        class="btn secondary small"
        disabled={loading}
      >
        {#if loading}
          <span class="spinner">⚪</span>
          Loading...
        {:else}
          🔄 Refresh
        {/if}
      </button>
    </div>

    <div class="data-table">
      {#if loading}
        <div class="loading-state">
          <div class="spinner large">⚪</div>
          <p>Loading rules...</p>
        </div>
      {:else if rules.length === 0}
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
                <p class="rule-id">
                  ID: <code>{rule.ruleId}</code>
                </p>
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

              {#if rule.actions && rule.actions.length > 0}
                <div class="rule-detail">
                  <span class="label">Actions:</span>
                  <div class="actions-list">
                    {#each rule.actions as action}
                      <div class="action-item">
                        <span class="action-tag">
                          {action.action}
                        </span>
                        {#if action.agentId}
                          <span class="arrow">→</span>
                          <span class="agent-name">{getAgentName(action.agentId)}</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
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
</div>

<style>
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

  .btn.small {
    padding: 6px 12px;
    font-size: 12px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  .spinner.large {
    font-size: 32px;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .rules-list {
    margin-bottom: 20px;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .list-header h3 {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
  }

  .data-table {
    margin-bottom: 20px;
  }

  .loading-state, .empty-state {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 40px 20px;
    text-align: center;
  }

  .loading-state p, .empty-state p {
    color: #8b949e;
    margin-top: 16px;
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

  .data-card {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
    transition: background-color 0.2s;
  }

  .data-card:hover {
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

  .rule-id {
    color: #8b949e;
    font-size: 14px;
  }

  .rule-id code {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  }

  .rule-actions {
    display: flex;
    align-items: center;
    gap: 8px;
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

  .card-content {
    color: #8b949e;
    font-size: 14px;
  }

  .rule-detail {
    margin-bottom: 12px;
  }

  .label {
    font-weight: 600;
    color: #f0f6fc;
  }

  .filter-value {
    margin-left: 8px;
  }

  .filter-all {
    margin-left: 8px;
    font-style: italic;
  }

  .actions-list {
    margin-top: 6px;
  }

  .action-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .action-tag {
    background: rgba(88, 166, 255, 0.2);
    color: #58a6ff;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
  }

  .arrow {
    color: rgba(255, 255, 255, 0.4);
  }

  .agent-name {
    color: #58a6ff;
  }

  .rule-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    margin-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .rule-meta span {
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

  @media (max-width: 768px) {
    .form-grid-three {
      grid-template-columns: 1fr;
    }

    .execution-form {
      flex-direction: column;
      align-items: stretch;
    }

    .card-header {
      flex-direction: column;
      gap: 12px;
    }

    .rule-footer {
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }

    .action-item {
      flex-wrap: wrap;
    }
  }
</style>