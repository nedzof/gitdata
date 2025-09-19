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

<div class="space-y-6">
  <!-- Header -->
  <div class="glass-card p-6">
    <h2 class="text-2xl font-bold text-white mb-2">Agent Marketplace</h2>
    <p class="text-white/80">
      Register automation agents and discover services that can process your data. Agents provide capabilities like notifications, document generation, and custom workflows.
    </p>
  </div>

  <!-- Error/Success Messages -->
  {#if error}
    <div class="glass-card p-4 border-red-400 bg-red-500/20">
      <p class="text-red-200 font-medium">❌ {error}</p>
    </div>
  {/if}

  {#if success}
    <div class="glass-card p-4 border-green-400 bg-green-500/20">
      <p class="text-green-200 font-medium">✅ {success}</p>
    </div>
  {/if}

  <!-- Register New Agent -->
  <div class="glass-card p-6">
    <h3 class="text-xl font-semibold text-white mb-4">Register New Agent</h3>
    <form on:submit={registerAgent} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-white font-semibold mb-2">Agent Name</label>
          <input
            bind:value={newAgentName}
            placeholder="My Data Processing Agent"
            required
            class="input-field w-full"
          />
        </div>
        <div>
          <label class="block text-white font-semibold mb-2">Webhook URL</label>
          <input
            bind:value={newAgentWebhook}
            placeholder="https://myservice.com/webhook"
            type="url"
            required
            class="input-field w-full"
          />
        </div>
      </div>

      <button type="submit" class="btn-primary" disabled={registering}>
        {#if registering}
          <span class="animate-spin mr-2">⚪</span>
          Registering...
        {:else}
          🚀 Register Agent
        {/if}
      </button>
    </form>
  </div>

  <!-- Search Agents -->
  <div class="glass-card p-6">
    <h3 class="text-xl font-semibold text-white mb-4">Discover Agents</h3>
    <form on:submit={searchAgents} class="flex gap-4">
      <div class="flex-1">
        <input
          bind:value={searchQuery}
          placeholder="Search by name or capability..."
          class="input-field w-full"
        />
      </div>
      <button type="submit" class="btn-primary" disabled={searching}>
        {#if searching}
          <span class="animate-spin mr-2">⚪</span>
          Searching...
        {:else}
          🔍 Search Agents
        {/if}
      </button>
    </form>
  </div>

  <!-- Agents List -->
  <div class="space-y-4">
    {#if loading}
      <div class="glass-card p-8 text-center">
        <div class="animate-spin text-4xl mb-4">⚪</div>
        <p class="text-white/80">Loading agents...</p>
      </div>
    {:else if agents.length === 0}
      <div class="glass-card p-8 text-center">
        <div class="text-6xl mb-4 opacity-50">🤖</div>
        <h3 class="text-xl font-semibold text-white mb-2">No Agents Found</h3>
        <p class="text-white/80">Register the first agent or adjust your search criteria.</p>
      </div>
    {:else}
      {#each agents as agent}
        <div class="glass-card p-6 card-hover">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-lg font-semibold text-white mb-1">{agent.name}</h3>
              <p class="text-white/70 text-sm">
                ID: <code class="bg-white/20 px-2 py-1 rounded">{agent.agentId}</code>
              </p>
            </div>
            <span class={getStatusColor(agent.status)}>
              {agent.status.toUpperCase()}
            </span>
          </div>

          <div class="space-y-2 text-white/80 text-sm">
            <div>
              <span class="font-medium text-white">Webhook:</span>
              <a
                href={agent.webhookUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-300 hover:text-primary-200 ml-2 break-all"
              >
                {agent.webhookUrl}
              </a>
            </div>

            {#if agent.capabilities && agent.capabilities.length > 0}
              <div>
                <span class="font-medium text-white">Capabilities:</span>
                <div class="flex flex-wrap gap-1 mt-1">
                  {#each agent.capabilities as capability}
                    <span class="bg-primary-500/30 text-primary-200 px-2 py-1 rounded-full text-xs">
                      {capability}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="flex justify-between items-center pt-2 border-t border-white/20">
              <div>
                <span class="font-medium text-white">Created:</span>
                <span class="ml-1">{formatTimestamp(agent.createdAt)}</span>
              </div>
              {#if agent.lastPingAt}
                <div>
                  <span class="font-medium text-white">Last Ping:</span>
                  <span class="ml-1">{formatTimestamp(agent.lastPingAt)}</span>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Refresh Button -->
  <div class="text-center">
    <button
      on:click={loadAgents}
      class="btn-secondary"
      disabled={loading}
    >
      {#if loading}
        <span class="animate-spin mr-2">⚪</span>
        Loading...
      {:else}
        🔄 Refresh Agents
      {/if}
    </button>
  </div>
</div>