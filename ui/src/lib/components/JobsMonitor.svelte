<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let jobs = [];
  let loading = false;
  let error = '';
  let autoRefresh = true;
  let refreshInterval = null;

  // Filter
  let selectedState = '';
  let filtering = false;

  const jobStates = ['', 'queued', 'running', 'done', 'failed', 'dead'];

  onMount(() => {
    loadJobs();
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
    refreshInterval = setInterval(loadJobs, 5000); // Refresh every 5 seconds
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  $: {
    if (autoRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }

  async function loadJobs() {
    try {
      loading = true;
      error = '';
      const result = await api.getJobs(selectedState);
      jobs = result.items || [];
    } catch (e) {
      error = e.message;
      jobs = [];
    } finally {
      loading = false;
    }
  }

  async function filterJobs(event) {
    selectedState = event.target.value;
    await loadJobs();
  }

  function getStatusColor(status) {
    switch (status) {
      case 'done': return 'status-success';
      case 'failed':
      case 'dead': return 'status-error';
      case 'running': return 'status-warning';
      case 'queued': return 'status-pending';
      default: return 'status-pending';
    }
  }

  function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
  }

  function formatDuration(created, updated) {
    const duration = (updated - created) * 1000; // Convert to milliseconds
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    if (duration < 3600000) return `${Math.round(duration / 60000)}m`;
    return `${Math.round(duration / 3600000)}h`;
  }

  function truncateId(id, length = 12) {
    return id.length > length ? `${id.slice(0, length)}...` : id;
  }

  function parseEvidence(evidenceJson) {
    try {
      return JSON.parse(evidenceJson || '[]');
    } catch {
      return [];
    }
  }
</script>

<div>
  <!-- Header -->
  <div class="header-section">
    <div class="header-content">
      <div class="header-info">
        <h2>Jobs Monitor</h2>
        <p>
          Monitor automation job execution status and results in real-time.
        </p>
      </div>
      <div class="header-actions">
        <label class="checkbox-label">
          <input
            type="checkbox"
            bind:checked={autoRefresh}
          />
          Auto Refresh
        </label>
        <button on:click={loadJobs} class="btn secondary" disabled={loading}>
          {#if loading}
            <span class="spinner">⚪</span>
            Refreshing...
          {:else}
            🔄 Refresh
          {/if}
        </button>
      </div>
    </div>

    <!-- Filter -->
    <div class="filter-section">
      <label>Filter by State:</label>
      <select
        on:change={filterJobs}
        bind:value={selectedState}
      >
        <option value="">All States</option>
        {#each jobStates.slice(1) as state}
          <option value={state}>{state.toUpperCase()}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="message error">
      <p>❌ {error}</p>
    </div>
  {/if}

  <!-- Jobs List -->
  <div class="jobs-list">
    {#if loading && jobs.length === 0}
      <div class="loading-state">
        <div class="spinner large">⚪</div>
        <p>Loading jobs...</p>
      </div>
    {:else if jobs.length === 0}
      <div class="empty-state">
        <div class="empty-icon">⚙️</div>
        <h3>No Jobs Found</h3>
        <p>
          {selectedState ? `No jobs in '${selectedState}' state` : 'No jobs have been executed yet'}.
        </p>
      </div>
    {:else}
      {#each jobs as job}
        <div class="job-card">
          <div class="job-header">
            <div class="job-title-section">
              <div class="job-title-row">
                <h3 class="job-title">
                  Job {truncateId(job.job_id)}
                </h3>
                <span class="status {getStatusColor(job.state)}">
                  {job.state.toUpperCase()}
                </span>
                {#if job.attempts > 0}
                  <span class="attempt-badge">
                    Attempt {job.attempts + 1}
                  </span>
                {/if}
              </div>

              <div class="job-details">
                <div class="job-detail">
                  <span class="label">Rule:</span>
                  <span class="value mono">{truncateId(job.rule_id)}</span>
                </div>
                {#if job.target_id}
                  <div class="job-detail">
                    <span class="label">Target:</span>
                    <span class="value mono">{truncateId(job.target_id)}</span>
                  </div>
                {/if}
                <div class="job-detail">
                  <span class="label">Duration:</span>
                  <span class="value">{formatDuration(job.created_at, job.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Timestamps -->
          <div class="job-timestamps">
            <div class="timestamp">
              <span class="label">Created:</span>
              <span class="value">{formatTimestamp(job.created_at)}</span>
            </div>
            <div class="timestamp">
              <span class="label">Updated:</span>
              <span class="value">{formatTimestamp(job.updated_at)}</span>
            </div>
          </div>

          <!-- Error Message -->
          {#if job.last_error}
            <div class="error-section">
              <span class="label">Error:</span>
              <span class="error-text">{job.last_error}</span>
            </div>
          {/if}

          <!-- Evidence -->
          {#if job.evidence_json}
            {@const evidence = parseEvidence(job.evidence_json)}
            {#if evidence.length > 0}
              <div class="evidence-section">
                <h4 class="evidence-title">Evidence ({evidence.length} items):</h4>
                <div class="evidence-list">
                  {#each evidence as item}
                    <div class="evidence-item">
                      <div class="evidence-header">
                        <span class="action-name">
                          {item.action || 'unknown'}
                        </span>
                        {#if item.agentId}
                          <span class="agent-ref">→ {truncateId(item.agentId, 8)}</span>
                        {/if}
                        {#if item.status}
                          <span class="status-code {item.status < 300 ? 'success' : 'error'}">
                            {item.status}
                          </span>
                        {/if}
                      </div>
                      {#if item.body || item.artifact || item.note}
                        <div class="evidence-body">
                          {JSON.stringify(item.body || item.artifact || item.note).slice(0, 100)}...
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Summary Stats -->
  {#if jobs.length > 0}
    <div class="summary-section">
      <h3>Summary</h3>
      <div class="summary-grid">
        {#each jobStates.slice(1) as state}
          {@const count = jobs.filter(j => j.state === state).length}
          <div class="summary-card">
            <div class="summary-count">{count}</div>
            <div class="summary-label">{state}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .header-section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 20px;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .header-info h2 {
    font-size: 24px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .header-info p {
    color: #8b949e;
    line-height: 1.5;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    color: #f0f6fc;
    font-size: 14px;
  }

  .checkbox-label input[type="checkbox"] {
    margin-right: 8px;
    border-radius: 4px;
  }

  .filter-section {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .filter-section label {
    color: #f0f6fc;
    font-weight: 500;
    font-size: 14px;
  }

  .filter-section select {
    padding: 8px 12px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .filter-section select:focus {
    border-color: #1f6feb;
    outline: none;
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

  .message p {
    color: #f0f6fc;
    font-weight: 500;
    margin: 0;
  }

  .jobs-list {
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

  .job-card {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
    transition: background-color 0.2s;
  }

  .job-card:hover {
    background: #161b22;
  }

  .job-header {
    margin-bottom: 16px;
  }

  .job-title-section {
    flex: 1;
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

  .job-detail {
    display: flex;
    align-items: center;
  }

  .label {
    font-weight: 600;
    color: #f0f6fc;
  }

  .value {
    margin-left: 8px;
  }

  .value.mono {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  }

  .job-timestamps {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
    color: #8b949e;
    font-size: 14px;
  }

  .timestamp {
    display: flex;
    align-items: center;
  }

  .error-section {
    background: rgba(218, 54, 51, 0.1);
    border: 1px solid rgba(218, 54, 51, 0.3);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .error-section .label {
    color: #ff6b6b;
  }

  .error-text {
    color: #ffa8a8;
    margin-left: 8px;
  }

  .evidence-section {
    margin-top: 16px;
  }

  .evidence-title {
    font-weight: 600;
    color: #f0f6fc;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .evidence-list {
    max-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .evidence-item {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 12px;
    font-size: 14px;
  }

  .evidence-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .action-name {
    font-weight: 600;
    color: #58a6ff;
  }

  .agent-ref {
    color: rgba(255, 255, 255, 0.6);
  }

  .status-code {
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .status-code.success {
    background: rgba(46, 160, 67, 0.2);
    color: #4ade80;
  }

  .status-code.error {
    background: rgba(218, 54, 51, 0.2);
    color: #fca5a5;
  }

  .evidence-body {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
  }

  .summary-section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
  }

  .summary-section h3 {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 16px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 16px;
    text-align: center;
  }

  .summary-card {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 16px;
  }

  .summary-count {
    font-size: 24px;
    font-weight: 700;
    color: #ffffff;
  }

  .summary-label {
    font-size: 14px;
    color: #8b949e;
    text-transform: capitalize;
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      gap: 16px;
      align-items: stretch;
    }

    .header-actions {
      justify-content: space-between;
    }

    .filter-section {
      flex-direction: column;
      align-items: stretch;
    }

    .job-details {
      grid-template-columns: 1fr;
    }

    .job-timestamps {
      grid-template-columns: 1fr;
    }

    .summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .job-title-row {
      flex-wrap: wrap;
      gap: 8px;
    }
  }
</style>