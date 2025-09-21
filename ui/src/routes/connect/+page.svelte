<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api';

  let activeTab = 'producers';
  let loading = false;

  // Producers
  let producers = [];
  let selectedProducer = null;

  // Agents
  let agents = [];
  let agentConfig = {
    name: '',
    endpoint: '',
    type: 'webhook',
    credentials: ''
  };

  // Subscriptions
  let subscriptions = [];

  // Asset connection (from catalog)
  let connectingAsset = null;

  onMount(async () => {
    // Check if we're connecting to a specific asset
    const assetId = $page.url.searchParams.get('asset');
    if (assetId) {
      connectingAsset = assetId;
      activeTab = 'producers';
    }

    await loadData();
  });

  async function loadData() {
    try {
      loading = true;

      if (activeTab === 'producers') {
        const response = await api.request('/producers');
        producers = response.producers || [];
      } else if (activeTab === 'agents') {
        const response = await api.request('/agents');
        agents = response.agents || [];
      } else if (activeTab === 'subscriptions') {
        const response = await api.request('/subscriptions');
        subscriptions = response.subscriptions || [];
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      loading = false;
    }
  }

  async function subscribeToProducer(producerId) {
    try {
      await api.request('/subscribe', {
        method: 'POST',
        body: {
          producerId,
          assetId: connectingAsset
        }
      });

      // Refresh subscriptions
      await loadData();
    } catch (error) {
      console.error('Failed to subscribe:', error);
    }
  }

  async function registerAgent() {
    try {
      await api.request('/agents', {
        method: 'POST',
        body: agentConfig
      });

      // Reset form and reload
      agentConfig = { name: '', endpoint: '', type: 'webhook', credentials: '' };
      await loadData();
    } catch (error) {
      console.error('Failed to register agent:', error);
    }
  }

  async function testAgent(agentId) {
    try {
      await api.request(`/agents/${agentId}/test`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Failed to test agent:', error);
    }
  }

  async function unsubscribe(subscriptionId) {
    try {
      await api.request(`/subscriptions/${subscriptionId}`, {
        method: 'DELETE'
      });

      await loadData();
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    }
  }

  function switchTab(tab) {
    activeTab = tab;
    loadData();
  }
</script>

<svelte:head>
  <title>Connect - Gitdata</title>
</svelte:head>

<div class="explorer">
  <div class="page-header">
    <div>
      <h1>🔗 Connect</h1>
      <p class="subtitle">Subscribe to producers, manage agents, and configure webhooks</p>
    </div>
  </div>

  {#if connectingAsset}
    <div class="connecting-asset">
      <p>
        <strong>Connecting to asset:</strong> {connectingAsset}
      </p>
    </div>
  {/if}

  <!-- Tabs -->
  <div class="tab-nav">
    <nav class="tab-buttons">
      <button
        on:click={() => switchTab('producers')}
        class="tab-btn {activeTab === 'producers' ? 'active' : ''}"
      >
        🏭 Producers
      </button>
      <button
        on:click={() => switchTab('agents')}
        class="tab-btn {activeTab === 'agents' ? 'active' : ''}"
      >
        🤖 Agents
      </button>
      <button
        on:click={() => switchTab('subscriptions')}
        class="tab-btn {activeTab === 'subscriptions' ? 'active' : ''}"
      >
        📋 Subscriptions
      </button>
    </nav>
  </div>

  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  {:else if activeTab === 'producers'}
    <!-- Producers Tab -->
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold">Available Producers</h2>
      </div>

      {#if producers.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-500">No producers available</p>
        </div>
      {:else}
        <div class="grid gap-4">
          {#each producers as producer}
            <div class="bg-white border border-gray-200 rounded-lg p-6">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <h3 class="font-semibold text-lg text-gray-900">{producer.name}</h3>
                  <p class="text-gray-600 mt-1">{producer.description}</p>

                  <div class="mt-4 space-y-2">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-gray-500">Data Types:</span>
                      <div class="flex gap-1">
                        {#each producer.dataTypes || [] as type}
                          <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{type}</span>
                        {/each}
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-gray-500">Pricing:</span>
                      <span class="text-sm text-gray-700">{producer.pricing || 'Contact for pricing'}</span>
                    </div>
                  </div>
                </div>

                <div class="flex gap-2">
                  <button
                    on:click={() => subscribeToProducer(producer.id)}
                    class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
                  >
                    Subscribe
                  </button>
                  <button
                    on:click={() => selectedProducer = producer}
                    class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
                  >
                    Details
                  </button>
                </div>
              </div>

              {#if producer.policies && producer.policies.length > 0}
                <div class="mt-4 pt-4 border-t border-gray-200">
                  <span class="text-sm font-medium text-gray-500">Required Policies:</span>
                  <div class="flex flex-wrap gap-1 mt-1">
                    {#each producer.policies as policy}
                      <span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">{policy}</span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else if activeTab === 'agents'}
    <!-- Agents Tab -->
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold">Agent Management</h2>
      </div>

      <!-- Agent Registration Form -->
      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <h3 class="text-lg font-semibold mb-4">Register New Agent</h3>
        <form on:submit|preventDefault={registerAgent} class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="agent-name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="agent-name"
                type="text"
                bind:value={agentConfig.name}
                required
                class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label for="agent-type" class="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                id="agent-type"
                bind:value={agentConfig.type}
                class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="webhook">Webhook</option>
                <option value="processor">Data Processor</option>
                <option value="validator">Validator</option>
              </select>
            </div>
          </div>
          <div>
            <label for="agent-endpoint" class="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
            <input
              id="agent-endpoint"
              type="url"
              bind:value={agentConfig.endpoint}
              required
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label for="agent-credentials" class="block text-sm font-medium text-gray-700 mb-1">Credentials (optional)</label>
            <input
              id="agent-credentials"
              type="password"
              bind:value={agentConfig.credentials}
              placeholder="API key or token"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Register Agent
          </button>
        </form>
      </div>

      <!-- Registered Agents -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Registered Agents</h3>
        {#if agents.length === 0}
          <p class="text-gray-500">No agents registered</p>
        {:else}
          {#each agents as agent}
            <div class="bg-white border border-gray-200 rounded-lg p-4">
              <div class="flex justify-between items-start">
                <div>
                  <h4 class="font-medium text-gray-900">{agent.name}</h4>
                  <p class="text-sm text-gray-600">{agent.endpoint}</p>
                  <span class="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {agent.type}
                  </span>
                </div>
                <div class="flex gap-2">
                  <button
                    on:click={() => testAgent(agent.id)}
                    class="text-blue-500 hover:text-blue-600 text-sm"
                  >
                    Test
                  </button>
                  <span class="text-gray-300">|</span>
                  <span class="text-sm {agent.status === 'active' ? 'text-green-600' : 'text-red-600'}">
                    {agent.status || 'inactive'}
                  </span>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>

  {:else if activeTab === 'subscriptions'}
    <!-- Subscriptions Tab -->
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold">Active Subscriptions</h2>
      </div>

      {#if subscriptions.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-500">No active subscriptions</p>
          <p class="text-gray-400 text-sm mt-2">Subscribe to producers from the Producers tab</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each subscriptions as subscription}
            <div class="bg-white border border-gray-200 rounded-lg p-6">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <h3 class="font-semibold text-lg text-gray-900">{subscription.producerName}</h3>
                  <p class="text-gray-600 mt-1">{subscription.description}</p>

                  <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span class="font-medium text-gray-500">Status:</span>
                      <span class="ml-1 {subscription.status === 'active' ? 'text-green-600' : 'text-yellow-600'}">
                        {subscription.status}
                      </span>
                    </div>
                    <div>
                      <span class="font-medium text-gray-500">Started:</span>
                      <span class="ml-1 text-gray-700">{subscription.startDate}</span>
                    </div>
                    <div>
                      <span class="font-medium text-gray-500">Updates:</span>
                      <span class="ml-1 text-gray-700">{subscription.updateCount || 0}</span>
                    </div>
                    <div>
                      <span class="font-medium text-gray-500">Cost:</span>
                      <span class="ml-1 text-gray-700">{subscription.cost || 'Free'}</span>
                    </div>
                  </div>
                </div>

                <div class="flex gap-2">
                  <button
                    on:click={() => unsubscribe(subscription.id)}
                    class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors"
                  >
                    Unsubscribe
                  </button>
                </div>
              </div>

              {#if subscription.lastUpdate}
                <div class="mt-4 pt-4 border-t border-gray-200">
                  <span class="text-sm font-medium text-gray-500">Last Update:</span>
                  <span class="ml-1 text-sm text-gray-700">{subscription.lastUpdate}</span>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Producer Details Modal -->
  {#if selectedProducer}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-start mb-4">
            <h3 class="text-xl font-semibold">{selectedProducer.name}</h3>
            <button
              on:click={() => selectedProducer = null}
              class="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div class="space-y-4">
            <p class="text-gray-600">{selectedProducer.description}</p>

            {#if selectedProducer.details}
              <div class="bg-gray-50 rounded-lg p-4">
                <h4 class="font-medium mb-2">Details</h4>
                <pre class="text-sm text-gray-700 whitespace-pre-wrap">{selectedProducer.details}</pre>
              </div>
            {/if}

            <div class="flex gap-2">
              <button
                on:click={() => {
                  subscribeToProducer(selectedProducer.id);
                  selectedProducer = null;
                }}
                class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Subscribe
              </button>
              <button
                on:click={() => selectedProducer = null}
                class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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

  .connecting-asset {
    background: #1f6feb;
    border: 1px solid #388bfd;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
    color: #ffffff;
  }

  .tab-nav {
    border-bottom: 1px solid #30363d;
    margin-bottom: 24px;
  }

  .tab-buttons {
    display: flex;
    gap: 32px;
  }

  .tab-btn {
    background: none;
    border: none;
    color: #8b949e;
    padding: 12px 0;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    color: #f0f6fc;
    border-bottom-color: #30363d;
  }

  .tab-btn.active {
    color: #58a6ff;
    border-bottom-color: #58a6ff;
  }

  /* Convert all other Tailwind classes to dark theme */
  :global(.bg-white) { background: #161b22 !important; }
  :global(.border-gray-200) { border-color: #30363d !important; }
  :global(.text-gray-900) { color: #ffffff !important; }
  :global(.text-gray-600) { color: #8b949e !important; }
  :global(.text-gray-500) { color: #6e7681 !important; }
  :global(.text-gray-700) { color: #f0f6fc !important; }
  :global(.bg-gray-100) { background: #21262d !important; }
  :global(.bg-blue-500) { background: #1f6feb !important; }
  :global(.bg-green-500) { background: #238636 !important; }
  :global(.bg-red-500) { background: #da3633 !important; }
  :global(.border-gray-300) { border-color: #30363d !important; }
  :global(.focus\:ring-blue-500) { box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1) !important; }
</style>