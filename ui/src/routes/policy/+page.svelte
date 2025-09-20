<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  let activeTab = 'configurator';
  let loading = false;

  // Policy Configurator
  let policyConfig = {
    name: '',
    description: '',
    type: 'access_control',
    rules: [],
    targets: [],
    conditions: []
  };

  let newRule = {
    field: '',
    operator: 'equals',
    value: '',
    action: 'allow'
  };

  // Policy Management
  let policies = [];
  let policyTemplates = [];

  // Policy Types and Options
  const policyTypes = [
    { value: 'access_control', label: 'Access Control', description: 'Control who can access data' },
    { value: 'data_quality', label: 'Data Quality', description: 'Ensure data meets quality standards' },
    { value: 'retention', label: 'Data Retention', description: 'Manage data lifecycle and retention' },
    { value: 'privacy', label: 'Privacy Protection', description: 'Protect sensitive and personal data' },
    { value: 'compliance', label: 'Compliance', description: 'Ensure regulatory compliance' }
  ];

  const operators = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Not Contains' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'regex_match', label: 'Regex Match' }
  ];

  const actions = [
    { value: 'allow', label: 'Allow' },
    { value: 'deny', label: 'Deny' },
    { value: 'require_approval', label: 'Require Approval' },
    { value: 'log_only', label: 'Log Only' },
    { value: 'transform', label: 'Transform Data' }
  ];

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    try {
      loading = true;

      if (activeTab === 'management') {
        const [policiesResponse, templatesResponse] = await Promise.all([
          api.request('/policies'),
          api.request('/policy-templates')
        ]);
        policies = policiesResponse.policies || [];
        policyTemplates = templatesResponse.templates || [];
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      loading = false;
    }
  }

  function addRule() {
    if (newRule.field && newRule.value) {
      policyConfig.rules = [...policyConfig.rules, { ...newRule, id: Date.now() }];
      newRule = { field: '', operator: 'equals', value: '', action: 'allow' };
    }
  }

  function removeRule(ruleId) {
    policyConfig.rules = policyConfig.rules.filter(rule => rule.id !== ruleId);
  }

  async function savePolicy() {
    try {
      await api.request('/policies', {
        method: 'POST',
        body: policyConfig
      });

      // Reset form
      policyConfig = {
        name: '',
        description: '',
        type: 'access_control',
        rules: [],
        targets: [],
        conditions: []
      };

      // Switch to management tab to see the new policy
      activeTab = 'management';
      await loadData();
    } catch (error) {
      console.error('Failed to save policy:', error);
    }
  }

  async function deletePolicy(policyId) {
    try {
      await api.request(`/policies/${policyId}`, {
        method: 'DELETE'
      });
      await loadData();
    } catch (error) {
      console.error('Failed to delete policy:', error);
    }
  }

  async function togglePolicy(policyId, enabled) {
    try {
      await api.request(`/policies/${policyId}`, {
        method: 'PATCH',
        body: { enabled }
      });
      await loadData();
    } catch (error) {
      console.error('Failed to toggle policy:', error);
    }
  }

  function switchTab(tab) {
    activeTab = tab;
    loadData();
  }

  function addTarget(target) {
    if (target && !policyConfig.targets.includes(target)) {
      policyConfig.targets = [...policyConfig.targets, target];
    }
  }

  function removeTarget(target) {
    policyConfig.targets = policyConfig.targets.filter(t => t !== target);
  }
</script>

<svelte:head>
  <title>Policy - Gitdata</title>
</svelte:head>

<div class="explorer">
  <div class="page-header">
    <h1>🛡️ Policy</h1>
    <p class="subtitle">Configure and manage data governance policies</p>
  </div>

  <!-- Tabs -->
  <div class="border-b border-gray-200 mb-8">
    <nav class="flex space-x-8">
      <button
        on:click={() => switchTab('configurator')}
        class="py-2 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'configurator' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
      >
        ⚙️ Policy Configurator
      </button>
      <button
        on:click={() => switchTab('management')}
        class="py-2 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'management' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
      >
        📋 Policy Management
      </button>
      <button
        on:click={() => switchTab('templates')}
        class="py-2 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'templates' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
      >
        📄 Templates
      </button>
    </nav>
  </div>

  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  {:else if activeTab === 'configurator'}
    <!-- Policy Configurator Tab -->
    <div class="space-y-6">
      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">Create New Policy</h2>

        <!-- Basic Information -->
        <div class="space-y-4 mb-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="policy-name" class="block text-sm font-medium text-gray-700 mb-1">Policy Name</label>
              <input
                id="policy-name"
                type="text"
                bind:value={policyConfig.name}
                placeholder="e.g., PII Access Control"
                class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label for="policy-type" class="block text-sm font-medium text-gray-700 mb-1">Policy Type</label>
              <select
                id="policy-type"
                bind:value={policyConfig.type}
                class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {#each policyTypes as type}
                  <option value={type.value}>{type.label}</option>
                {/each}
              </select>
            </div>
          </div>
          <div>
            <label for="policy-description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              id="policy-description"
              bind:value={policyConfig.description}
              rows="3"
              placeholder="Describe what this policy does and when it applies..."
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
        </div>

        <!-- Policy Rules -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold mb-3">Policy Rules</h3>

          <!-- Add New Rule -->
          <div class="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 class="font-medium mb-3">Add Rule</h4>
            <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input
                type="text"
                bind:value={newRule.field}
                placeholder="Field name"
                class="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                bind:value={newRule.operator}
                class="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {#each operators as operator}
                  <option value={operator.value}>{operator.label}</option>
                {/each}
              </select>
              <input
                type="text"
                bind:value={newRule.value}
                placeholder="Value"
                class="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                bind:value={newRule.action}
                class="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {#each actions as action}
                  <option value={action.value}>{action.label}</option>
                {/each}
              </select>
              <button
                on:click={addRule}
                class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Add Rule
              </button>
            </div>
          </div>

          <!-- Existing Rules -->
          {#if policyConfig.rules.length > 0}
            <div class="space-y-2">
              {#each policyConfig.rules as rule}
                <div class="flex items-center justify-between bg-white border border-gray-200 rounded-md p-3">
                  <div class="text-sm">
                    <span class="font-mono bg-gray-100 px-2 py-1 rounded">{rule.field}</span>
                    <span class="mx-2 text-gray-500">{rule.operator}</span>
                    <span class="font-mono bg-gray-100 px-2 py-1 rounded">{rule.value}</span>
                    <span class="mx-2 text-gray-500">→</span>
                    <span class="font-semibold {rule.action === 'allow' ? 'text-green-600' : rule.action === 'deny' ? 'text-red-600' : 'text-yellow-600'}">{rule.action}</span>
                  </div>
                  <button
                    on:click={() => removeRule(rule.id)}
                    class="text-red-500 hover:text-red-600 text-sm"
                  >
                    Remove
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-gray-500 text-sm">No rules defined yet. Add rules above to specify policy behavior.</p>
          {/if}
        </div>

        <!-- Save Policy -->
        <div class="flex justify-end">
          <button
            on:click={savePolicy}
            disabled={!policyConfig.name || policyConfig.rules.length === 0}
            class="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md transition-colors"
          >
            Save Policy
          </button>
        </div>
      </div>
    </div>

  {:else if activeTab === 'management'}
    <!-- Policy Management Tab -->
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold">Active Policies</h2>
        <button
          on:click={() => switchTab('configurator')}
          class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
        >
          + Create Policy
        </button>
      </div>

      {#if policies.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-500">No policies configured</p>
          <p class="text-gray-400 text-sm mt-2">Create your first policy using the configurator</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each policies as policy}
            <div class="bg-white border border-gray-200 rounded-lg p-6">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <h3 class="font-semibold text-lg text-gray-900">{policy.name}</h3>
                    <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {policyTypes.find(t => t.value === policy.type)?.label || policy.type}
                    </span>
                    <span class="text-xs px-2 py-1 rounded {policy.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                      {policy.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p class="text-gray-600 mb-4">{policy.description}</p>

                  {#if policy.rules && policy.rules.length > 0}
                    <div class="mb-4">
                      <h4 class="text-sm font-medium text-gray-700 mb-2">Rules ({policy.rules.length})</h4>
                      <div class="space-y-1">
                        {#each policy.rules.slice(0, 3) as rule}
                          <div class="text-xs text-gray-600">
                            <span class="font-mono bg-gray-100 px-1 rounded">{rule.field}</span>
                            {rule.operator}
                            <span class="font-mono bg-gray-100 px-1 rounded">{rule.value}</span>
                            → <span class="font-semibold">{rule.action}</span>
                          </div>
                        {/each}
                        {#if policy.rules.length > 3}
                          <div class="text-xs text-gray-500">... and {policy.rules.length - 3} more rules</div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <div class="text-sm text-gray-500">
                    <span>Created: {policy.createdAt || 'Unknown'}</span>
                    {#if policy.lastApplied}
                      <span class="ml-4">Last Applied: {policy.lastApplied}</span>
                    {/if}
                  </div>
                </div>

                <div class="flex flex-col gap-2 ml-4">
                  <button
                    on:click={() => togglePolicy(policy.id, !policy.enabled)}
                    class="text-sm px-3 py-1 rounded transition-colors {policy.enabled ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}"
                  >
                    {policy.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    on:click={() => deletePolicy(policy.id)}
                    class="text-sm bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else if activeTab === 'templates'}
    <!-- Templates Tab -->
    <div class="space-y-6">
      <h2 class="text-xl font-semibold">Policy Templates</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each policyTypes as type}
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h3 class="font-semibold text-lg text-gray-900 mb-2">{type.label}</h3>
            <p class="text-gray-600 text-sm mb-4">{type.description}</p>
            <div class="space-y-2">
              <div class="text-xs text-gray-500">Common use cases:</div>
              {#if type.value === 'access_control'}
                <ul class="text-xs text-gray-600 space-y-1">
                  <li>• Role-based access</li>
                  <li>• IP restrictions</li>
                  <li>• Time-based access</li>
                </ul>
              {:else if type.value === 'data_quality'}
                <ul class="text-xs text-gray-600 space-y-1">
                  <li>• Null value checks</li>
                  <li>• Format validation</li>
                  <li>• Range verification</li>
                </ul>
              {:else if type.value === 'retention'}
                <ul class="text-xs text-gray-600 space-y-1">
                  <li>• Auto-deletion</li>
                  <li>• Archive scheduling</li>
                  <li>• Compliance retention</li>
                </ul>
              {:else if type.value === 'privacy'}
                <ul class="text-xs text-gray-600 space-y-1">
                  <li>• PII masking</li>
                  <li>• Anonymization</li>
                  <li>• Consent management</li>
                </ul>
              {:else if type.value === 'compliance'}
                <ul class="text-xs text-gray-600 space-y-1">
                  <li>• GDPR compliance</li>
                  <li>• SOX auditing</li>
                  <li>• Industry standards</li>
                </ul>
              {/if}
            </div>
            <button
              on:click={() => {
                policyConfig.type = type.value;
                switchTab('configurator');
              }}
              class="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors text-sm"
            >
              Use Template
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .subtitle {
    color: #8b949e;
    font-size: 16px;
    margin-bottom: 32px;
    font-family: system-ui, sans-serif;
  }

  /* Global overrides for all Tailwind classes to match dark theme */
  :global(.bg-white) { background: #161b22 !important; }
  :global(.border-gray-200) { border-color: #30363d !important; }
  :global(.text-gray-900) { color: #ffffff !important; }
  :global(.text-gray-600) { color: #8b949e !important; }
  :global(.text-gray-500) { color: #6e7681 !important; }
  :global(.text-gray-700) { color: #f0f6fc !important; }
  :global(.bg-gray-50) { background: #21262d !important; }
  :global(.bg-gray-100) { background: #21262d !important; }
  :global(.border-gray-300) { border-color: #30363d !important; }
  :global(.bg-blue-500) { background: #1f6feb !important; }
  :global(.bg-blue-100) { background: #0d1117 !important; }
  :global(.text-blue-600) { color: #58a6ff !important; }
  :global(.text-blue-700) { color: #58a6ff !important; }
  :global(.border-blue-500) { border-color: #58a6ff !important; }
  :global(.bg-green-500) { background: #238636 !important; }
  :global(.bg-green-100) { background: #0d1117 !important; }
  :global(.text-green-600) { color: #2ea043 !important; }
  :global(.text-green-700) { color: #2ea043 !important; }
  :global(.bg-red-500) { background: #da3633 !important; }
  :global(.bg-red-100) { background: #0d1117 !important; }
  :global(.text-red-600) { color: #f85149 !important; }
  :global(.text-red-700) { color: #f85149 !important; }
  :global(.bg-yellow-100) { background: #0d1117 !important; }
  :global(.text-yellow-600) { color: #f7b955 !important; }
  :global(.text-yellow-700) { color: #f7b955 !important; }
  :global(.focus\\:ring-2) { box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1) !important; }
  :global(.focus\\:ring-blue-500) { border-color: #58a6ff !important; }
  :global(.hover\\:bg-gray-300) { background: #30363d !important; }
  :global(.hover\\:bg-gray-200) { background: #30363d !important; }
  :global(.hover\\:text-gray-700) { color: #f0f6fc !important; }
  :global(.hover\\:border-gray-300) { border-color: #58a6ff !important; }
  :global(.border-transparent) { border-color: transparent !important; }
</style>