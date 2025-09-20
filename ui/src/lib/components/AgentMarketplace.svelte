<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let agents = [];
  let loading = false;
  let error = '';
  let success = '';

  // Registration form
  let newAgentName = '';
  let newAgentWebhook = '';
  let registering = false;

  // Search
  let searchQuery = '';
  let searching = false;

  onMount(() => {
    loadAgents();
  });

  async function loadAgents() {
    try {
      loading = true;
      error = '';
      const result = await api.getAgents();
      agents = result.items || [];
    } catch (e) {
      error = e.message;
      agents = [];
    } finally {
      loading = false;
    }
  }

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

      // Clear form
      newAgentName = '';
      newAgentWebhook = '';

      // Refresh agents list
      await loadAgents();
    } catch (e) {
      error = e.message;
    } finally {
      registering = false;
    }
  }

  async function searchAgents(event) {
    event.preventDefault();

    try {
      searching = true;
      error = '';
      const result = await api.searchAgents(searchQuery);
      agents = result.items || [];
    } catch (e) {
      error = e.message;
      agents = [];
    } finally {
      searching = false;
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'up': return 'status-success';
      case 'down': return 'status-error';
      case 'unknown': return 'status-pending';
      default: return 'status-pending';
    }
  }

  function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
  }
</script>

<div>
  <!-- Header -->
  <div class="header-section">
    <h2>Agent Marketplace</h2>
    <p>
      Register automation agents and discover services that can process your data. Agents provide capabilities like notifications, document generation, and custom workflows.
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

  <!-- Search Agents -->
  <div class="search-section">
    <h3>Discover Agents</h3>
    <form on:submit={searchAgents} class="search-form">
      <input
        bind:value={searchQuery}
        placeholder="Search by name or capability..."
      />
      <button type="submit" class="btn primary" disabled={searching}>
        {#if searching}
          <span class="spinner">⚪</span>
          Searching...
        {:else}
          🔍 Search Agents
        {/if}
      </button>
    </form>
  </div>

  <!-- Agents List -->
  <div class="data-table">
    {#if loading}
      <div class="loading-state">
        <div class="spinner large">⚪</div>
        <p>Loading agents...</p>
      </div>
    {:else if agents.length === 0}
      <div class="empty-state">
        <div class="empty-icon">🤖</div>
        <h3>No Agents Found</h3>
        <p>Register the first agent or adjust your search criteria.</p>
      </div>
    {:else}
      {#each agents as agent}
        <div class="data-card">
          <div class="card-header">
            <div class="card-title">
              <h3>{agent.name}</h3>
              <p class="agent-id">
                ID: <code>{agent.agentId}</code>
              </p>
            </div>
            <span class="status {getStatusColor(agent.status)}">
              {agent.status.toUpperCase()}
            </span>
          </div>

          <div class="card-content">
            <div class="agent-detail">
              <span class="label">Webhook:</span>
              <a
                href={agent.webhookUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="link"
              >
                {agent.webhookUrl}
              </a>
            </div>

            {#if agent.capabilities && agent.capabilities.length > 0}
              <div class="agent-detail">
                <span class="label">Capabilities:</span>
                <div class="capabilities">
                  {#each agent.capabilities as capability}
                    <span class="capability-tag">
                      {capability}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="agent-footer">
              <div class="agent-meta">
                <span class="label">Created:</span>
                <span>{formatTimestamp(agent.createdAt)}</span>
              </div>
              {#if agent.lastPingAt}
                <div class="agent-meta">
                  <span class="label">Last Ping:</span>
                  <span>{formatTimestamp(agent.lastPingAt)}</span>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Refresh Button -->
  <div class="actions">
    <button
      on:click={loadAgents}
      class="btn secondary"
      disabled={loading}
    >
      {#if loading}
        <span class="spinner">⚪</span>
        Loading...
      {:else}
        🔄 Refresh Agents
      {/if}
    </button>
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

  .form-section, .search-section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 20px;
  }

  .form-section h3, .search-section h3 {
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

  .form-group input, .search-section input {
    padding: 8px 12px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .form-group input:focus, .search-section input:focus {
    border-color: #1f6feb;
    outline: none;
  }

  .search-form {
    display: flex;
    gap: 16px;
    align-items: flex-end;
  }

  .search-form input {
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

  .spinner.large {
    font-size: 32px;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
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

  .agent-id {
    color: #8b949e;
    font-size: 14px;
  }

  .agent-id code {
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

  .status.status-pending {
    background: #2d2000;
    color: #ffc107;
    border: 1px solid #ffc107;
  }

  .card-content {
    color: #8b949e;
    font-size: 14px;
  }

  .agent-detail {
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

  .capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .capability-tag {
    background: rgba(88, 166, 255, 0.2);
    color: #58a6ff;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
  }

  .agent-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    margin-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .agent-meta span {
    margin-left: 4px;
  }

  .actions {
    text-align: center;
    margin-top: 20px;
  }

  @media (max-width: 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }

    .search-form {
      flex-direction: column;
      align-items: stretch;
    }

    .card-header {
      flex-direction: column;
      gap: 12px;
    }

    .agent-footer {
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }
  }
</style>