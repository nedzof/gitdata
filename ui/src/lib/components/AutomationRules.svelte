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

<div class="space-y-6">
  <!-- Header -->
  <div class="glass-card p-6">
    <h2 class="text-2xl font-bold text-white mb-2">Automation Rules</h2>
    <p class="text-white/80">
      Create automated workflows that trigger when new data matches your criteria. Rules can notify agents, generate documents, or execute custom actions.
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

  <!-- Create New Rule -->
  <div class="glass-card p-6">
    <h3 class="text-xl font-semibold text-white mb-4">Create New Rule</h3>
    <form on:submit={createRule} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-white font-semibold mb-2">Rule Name</label>
          <input
            bind:value={newRuleName}
            placeholder="New Data Notification Rule"
            required
            class="input-field w-full"
          />
        </div>
        <div>
          <label class="block text-white font-semibold mb-2">Data Filter</label>
          <input
            bind:value={newRuleQuery}
            placeholder="Leave empty for all data, or enter keywords..."
            class="input-field w-full"
          />
        </div>
        <div>
          <label class="block text-white font-semibold mb-2">Target Agent</label>
          {#if agents.length > 0}
            <select bind:value={newRuleAgentId} required class="input-field w-full">
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
              class="input-field w-full"
            />
          {/if}
        </div>
      </div>

      <button type="submit" class="btn-primary" disabled={creating}>
        {#if creating}
          <span class="animate-spin mr-2">⚪</span>
          Creating...
        {:else}
          ⚡ Create Rule
        {/if}
      </button>
    </form>
  </div>

  <!-- Manual Execution -->
  <div class="glass-card p-6">
    <h3 class="text-xl font-semibold text-white mb-4">Manual Execution</h3>
    <form on:submit={runRule} class="space-y-4">
      <div class="flex gap-4">
        <div class="flex-1">
          <label class="block text-white font-semibold mb-2">Rule ID</label>
          {#if rules.length > 0}
            <select bind:value={runRuleId} required class="input-field w-full">
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
              class="input-field w-full"
            />
          {/if}
        </div>
        <div class="flex items-end">
          <button type="submit" class="btn-primary" disabled={running}>
            {#if running}
              <span class="animate-spin mr-2">⚪</span>
              Running...
            {:else}
              ▶️ Run Rule Now
            {/if}
          </button>
        </div>
      </div>
    </form>
  </div>

  <!-- Rules List -->
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <h3 class="text-xl font-semibold text-white">Existing Rules</h3>
      <button
        on:click={loadRules}
        class="btn-secondary text-sm py-2 px-4"
        disabled={loading}
      >
        {#if loading}
          <span class="animate-spin mr-2">⚪</span>
          Loading...
        {:else}
          🔄 Refresh
        {/if}
      </button>
    </div>

    {#if loading}
      <div class="glass-card p-8 text-center">
        <div class="animate-spin text-4xl mb-4">⚪</div>
        <p class="text-white/80">Loading rules...</p>
      </div>
    {:else if rules.length === 0}
      <div class="glass-card p-8 text-center">
        <div class="text-6xl mb-4 opacity-50">⚡</div>
        <h3 class="text-xl font-semibold text-white mb-2">No Rules Found</h3>
        <p class="text-white/80">Create your first automation rule to get started.</p>
      </div>
    {:else}
      {#each rules as rule}
        <div class="glass-card p-6 card-hover">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-lg font-semibold text-white mb-1">{rule.name}</h3>
              <p class="text-white/70 text-sm">
                ID: <code class="bg-white/20 px-2 py-1 rounded">{rule.ruleId}</code>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class={rule.enabled ? 'status-success' : 'status-error'}>
                {rule.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
              <button
                on:click={() => deleteRule(rule.ruleId)}
                class="text-red-400 hover:text-red-300 text-sm font-medium"
                title="Delete rule"
              >
                🗑️
              </button>
            </div>
          </div>

          <div class="space-y-3 text-white/80 text-sm">
            {#if rule.find?.query?.q}
              <div>
                <span class="font-medium text-white">Data Filter:</span>
                <span class="ml-2">"{rule.find.query.q}"</span>
              </div>
            {:else}
              <div>
                <span class="font-medium text-white">Data Filter:</span>
                <span class="ml-2 italic">All data</span>
              </div>
            {/if}

            {#if rule.actions && rule.actions.length > 0}
              <div>
                <span class="font-medium text-white">Actions:</span>
                <div class="mt-1 space-y-1">
                  {#each rule.actions as action}
                    <div class="flex items-center gap-2">
                      <span class="bg-secondary-500/30 text-secondary-200 px-2 py-1 rounded text-xs">
                        {action.action}
                      </span>
                      {#if action.agentId}
                        <span class="text-white/60">→</span>
                        <span class="text-primary-300">{getAgentName(action.agentId)}</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="flex justify-between items-center pt-2 border-t border-white/20">
              <div>
                <span class="font-medium text-white">Updated:</span>
                <span class="ml-1">{formatTimestamp(rule.updatedAt)}</span>
              </div>
              <button
                on:click={() => { runRuleId = rule.ruleId; }}
                class="text-primary-300 hover:text-primary-200 text-xs font-medium"
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