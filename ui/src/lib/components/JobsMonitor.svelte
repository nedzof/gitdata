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

<div class="space-y-6">
  <!-- Header -->
  <div class="glass-card p-6">
    <div class="flex justify-between items-center mb-4">
      <div>
        <h2 class="text-2xl font-bold text-white mb-2">Jobs Monitor</h2>
        <p class="text-white/80">
          Monitor automation job execution status and results in real-time.
        </p>
      </div>
      <div class="flex items-center space-x-4">
        <label class="flex items-center text-white">
          <input
            type="checkbox"
            bind:checked={autoRefresh}
            class="mr-2 rounded"
          />
          Auto Refresh
        </label>
        <button on:click={loadJobs} class="btn-secondary" disabled={loading}>
          {#if loading}
            <span class="animate-spin mr-2">⚪</span>
            Refreshing...
          {:else}
            🔄 Refresh
          {/if}
        </button>
      </div>
    </div>

    <!-- Filter -->
    <div class="flex items-center space-x-4">
      <label class="text-white font-medium">Filter by State:</label>
      <select
        on:change={filterJobs}
        bind:value={selectedState}
        class="input-field"
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
    <div class="glass-card p-4 border-red-400 bg-red-500/20">
      <p class="text-red-200 font-medium">❌ {error}</p>
    </div>
  {/if}

  <!-- Jobs List -->
  <div class="space-y-4">
    {#if loading && jobs.length === 0}
      <div class="glass-card p-8 text-center">
        <div class="animate-spin text-4xl mb-4">⚪</div>
        <p class="text-white/80">Loading jobs...</p>
      </div>
    {:else if jobs.length === 0}
      <div class="glass-card p-8 text-center">
        <div class="text-6xl mb-4 opacity-50">⚙️</div>
        <h3 class="text-xl font-semibold text-white mb-2">No Jobs Found</h3>
        <p class="text-white/80">
          {selectedState ? `No jobs in '${selectedState}' state` : 'No jobs have been executed yet'}.
        </p>
      </div>
    {:else}
      {#each jobs as job}
        <div class="glass-card p-6 card-hover">
          <div class="flex justify-between items-start mb-4">
            <div class="flex-1">
              <div class="flex items-center space-x-4 mb-2">
                <h3 class="text-lg font-semibold text-white">
                  Job {truncateId(job.job_id)}
                </h3>
                <span class={getStatusColor(job.state)}>
                  {job.state.toUpperCase()}
                </span>
                {#if job.attempts > 0}
                  <span class="text-orange-300 text-sm">
                    Attempt {job.attempts + 1}
                  </span>
                {/if}
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-white/80">
                <div>
                  <span class="font-medium text-white">Rule:</span>
                  <span class="ml-2 font-mono">{truncateId(job.rule_id)}</span>
                </div>
                {#if job.target_id}
                  <div>
                    <span class="font-medium text-white">Target:</span>
                    <span class="ml-2 font-mono">{truncateId(job.target_id)}</span>
                  </div>
                {/if}
                <div>
                  <span class="font-medium text-white">Duration:</span>
                  <span class="ml-2">{formatDuration(job.created_at, job.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Timestamps -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-white/70 mb-4">
            <div>
              <span class="font-medium text-white">Created:</span>
              <span class="ml-2">{formatTimestamp(job.created_at)}</span>
            </div>
            <div>
              <span class="font-medium text-white">Updated:</span>
              <span class="ml-2">{formatTimestamp(job.updated_at)}</span>
            </div>
          </div>

          <!-- Error Message -->
          {#if job.last_error}
            <div class="bg-red-500/20 border border-red-400/30 rounded-lg p-3 mb-4">
              <span class="font-medium text-red-200">Error:</span>
              <span class="ml-2 text-red-300">{job.last_error}</span>
            </div>
          {/if}

          <!-- Evidence -->
          {#if job.evidence_json}
            {@const evidence = parseEvidence(job.evidence_json)}
            {#if evidence.length > 0}
              <div class="mt-4">
                <h4 class="font-medium text-white mb-2">Evidence ({evidence.length} items):</h4>
                <div class="space-y-2 max-h-32 overflow-y-auto">
                  {#each evidence as item}
                    <div class="bg-white/10 rounded-lg p-3 text-sm">
                      <div class="flex items-center space-x-2 mb-1">
                        <span class="font-medium text-primary-300">
                          {item.action || 'unknown'}
                        </span>
                        {#if item.agentId}
                          <span class="text-white/60">→ {truncateId(item.agentId, 8)}</span>
                        {/if}
                        {#if item.status}
                          <span class="text-xs px-2 py-1 rounded {item.status < 300 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}">
                            {item.status}
                          </span>
                        {/if}
                      </div>
                      {#if item.body || item.artifact || item.note}
                        <div class="text-white/70 text-xs">
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
    <div class="glass-card p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Summary</h3>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
        {#each jobStates.slice(1) as state}
          {@const count = jobs.filter(j => j.state === state).length}
          <div class="bg-white/10 rounded-lg p-4">
            <div class="text-2xl font-bold text-white">{count}</div>
            <div class="text-sm text-white/70 capitalize">{state}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .status-warning {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(96, 165, 250);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
</style>