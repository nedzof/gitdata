<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '$lib/api';

  let jobs = [];
  let rules = [];
  let loading = false;
  let error = '';

  // Filter options
  let selectedState = '';
  let autoRefresh = true;
  let refreshInterval;

  const stateOptions = [
    { value: '', label: 'All Jobs' },
    { value: 'queued', label: '⏳ Queued' },
    { value: 'running', label: '🏃 Running' },
    { value: 'done', label: '✅ Completed' },
    { value: 'failed', label: '❌ Failed' },
    { value: 'dead', label: '💀 Dead' }
  ];

  onMount(() => {
    loadJobs();
    loadRules();
    startAutoRefresh();
  });

  onDestroy(() => {
    stopAutoRefresh();
  });

  function startAutoRefresh() {
    if (autoRefresh) {
      refreshInterval = setInterval(() => {
        if (!loading) {
          loadJobs();
        }
      }, 5000); // Refresh every 5 seconds
    }
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
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

  async function loadRules() {
    try {
      const result = await api.getRules();
      rules = result.items || [];
    } catch (e) {
      console.warn('Failed to load rules:', e.message);
    }
  }

  function handleStateChange() {
    loadJobs();
  }

  function getRuleName(ruleId) {
    const rule = rules.find(r => r.ruleId === ruleId);
    return rule ? rule.name : ruleId;
  }

  function getStatusColor(state) {
    switch (state) {
      case 'queued': return 'status-pending';
      case 'running': return 'status-running';
      case 'done': return 'status-success';
      case 'failed': return 'status-error';
      case 'dead': return 'status-error';
      default: return 'status-pending';
    }
  }

  function getStatusIcon(state) {
    switch (state) {
      case 'queued': return '⏳';
      case 'running': return '🏃';
      case 'done': return '✅';
      case 'failed': return '❌';
      case 'dead': return '💀';
      default: return '❓';
    }
  }

  function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
  }

  function getTimeAgo(timestamp) {
    const now = Date.now();
    const diffMs = now - (timestamp * 1000);
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="glass-card p-6">
    <h2 class="text-2xl font-bold text-white mb-2">Job Monitoring</h2>
    <p class="text-white/80">
      Monitor the execution of automated tasks and workflows. Track job status, view results, and debug issues in real-time.
    </p>
  </div>

  <!-- Controls -->
  <div class="glass-card p-6">
    <div class="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
      <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div>
          <label class="block text-white font-semibold mb-2">Filter by Status</label>
          <select
            bind:value={selectedState}
            on:change={handleStateChange}
            class="input-field"
          >
            {#each stateOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>

        <div class="flex gap-2">
          <button
            on:click={loadJobs}
            class="btn-primary text-sm py-2 px-4"
            disabled={loading}
          >
            {#if loading}
              <span class="animate-spin mr-2">⚪</span>
              Loading...
            {:else}
              🔄 Refresh Jobs
            {/if}
          </button>

          <button
            on:click={toggleAutoRefresh}
            class="btn-secondary text-sm py-2 px-4 {autoRefresh ? 'bg-green-600 hover:bg-green-700' : ''}"
          >
            {autoRefresh ? '⏸️ Auto Refresh ON' : '▶️ Auto Refresh OFF'}
          </button>
        </div>
      </div>

      {#if jobs.length > 0}
        <div class="text-white/70 text-sm">
          Total: {jobs.length} jobs
          {#if autoRefresh}
            <span class="ml-2 animate-pulse">🔄</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Error Display -->
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
        <div class="text-6xl mb-4 opacity-50">📋</div>
        <h3 class="text-xl font-semibold text-white mb-2">No Jobs Found</h3>
        <p class="text-white/80">
          {selectedState ? `No ${selectedState} jobs at the moment.` : 'No jobs have been created yet.'}
        </p>
      </div>
    {:else}
      {#each jobs as job}
        <div class="glass-card p-6 card-hover">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-lg font-semibold text-white mb-1">
                Job {job.job_id}
              </h3>
              <p class="text-white/70 text-sm">
                Rule: <span class="font-medium">{getRuleName(job.rule_id)}</span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class={getStatusColor(job.state)}>
                {getStatusIcon(job.state)} {job.state.toUpperCase()}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-white/80 text-sm">
            <div>
              <span class="font-medium text-white block">Rule ID:</span>
              <code class="bg-white/20 px-2 py-1 rounded text-xs break-all">{job.rule_id}</code>
            </div>

            {#if job.target_id}
              <div>
                <span class="font-medium text-white block">Target ID:</span>
                <code class="bg-white/20 px-2 py-1 rounded text-xs break-all">{job.target_id}</code>
              </div>
            {/if}

            <div>
              <span class="font-medium text-white block">Attempts:</span>
              <span class="text-lg {job.attempts > 1 ? 'text-yellow-400' : 'text-green-400'}">
                {job.attempts}
              </span>
            </div>
          </div>

          <div class="flex justify-between items-center mt-4 pt-4 border-t border-white/20">
            <div class="text-white/70 text-sm">
              <span class="font-medium text-white">Created:</span>
              <span class="ml-1">{formatTimestamp(job.created_at)}</span>
              <span class="ml-2 text-white/50">({getTimeAgo(job.created_at)})</span>
            </div>

            {#if job.state === 'running'}
              <div class="flex items-center text-blue-400 text-sm">
                <span class="animate-spin mr-2">⚪</span>
                Running...
              </div>
            {/if}
          </div>

          {#if job.last_error}
            <div class="mt-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg">
              <div class="font-medium text-red-200 text-sm mb-1">Error:</div>
              <div class="text-red-300 text-xs font-mono break-all">
                {job.last_error}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Stats Summary -->
  {#if jobs.length > 0}
    <div class="glass-card p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Job Statistics</h3>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        {#each stateOptions as option}
          {#if option.value}
            {@const count = jobs.filter(j => j.state === option.value).length}
            <div class="text-center">
              <div class="text-2xl font-bold text-white">{count}</div>
              <div class="text-white/70 text-sm">{option.label}</div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>