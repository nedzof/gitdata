<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import { walletService } from '$lib/wallet';

  let activeTab = 'producers';
  let loading = false;

  // Producers
  let producers = [];
  let selectedProducer = null;

  // BRC100 Wallet Integration
  let walletData = {
    purchases: [],
    balance: 0,
    totalSpent: 0
  };
  let purchaseFilters = {
    status: 'all', // all, active, recalled, expired
    producer: 'all'
  };

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

  // Notification preferences
  let notificationConfig = {
    webhookUrl: '',
    emailNotifications: true,
    recallAlerts: true,
    newDataAlerts: true,
    priceChangeAlerts: false
  };

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
      } else if (activeTab === 'wallet') {
        await loadWalletData();
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

  async function loadWalletData() {
    try {
      if (!walletService.isConnected()) {
        console.warn('Wallet not connected, cannot load wallet data');
        walletData = { purchases: [], balance: 0, totalSpent: 0 };
        return;
      }

      // Load BRC100 wallet purchases and balance using real wallet methods
      const [purchaseHistory, balanceInfo] = await Promise.all([
        walletService.getPurchaseHistory().catch(() => []),
        walletService.getAvailableBalance().catch(() => ({ balance: 0, outputs: [] }))
      ]);

      // Transform wallet actions to purchase format
      walletData.purchases = purchaseHistory.map(action => ({
        versionId: action.outputs?.find(o => o.tags?.includes('data-purchase'))?.tags?.find(t => t.startsWith('version:'))?.split(':')[1] || action.txid,
        assetName: action.description || 'Unknown Asset',
        description: action.description,
        purchaseDate: new Date().toISOString(), // BRC-100 doesn't include timestamps in this format
        amountSat: Math.abs(action.satoshis),
        txid: action.txid,
        status: action.status,
        currentStatus: action.status === 'confirmed' ? 'active' : action.status,
        recalled: false, // Will be checked separately
        producerId: 'unknown',
        producerName: 'Unknown Producer',
        producerStatus: 'unknown'
      }));

      walletData.balance = balanceInfo.balance;
      walletData.totalSpent = walletData.purchases.reduce((sum, p) => sum + p.amountSat, 0);

      // Check for data recalls and producer status updates
      for (let purchase of walletData.purchases) {
        try {
          const statusResponse = await api.request(`/assets/${purchase.versionId}/status`);
          purchase.currentStatus = statusResponse.status;
          purchase.recalled = statusResponse.recalled || false;
          purchase.producerStatus = statusResponse.producerStatus || 'unknown';
        } catch (error) {
          console.warn(`Failed to check status for ${purchase.versionId}:`, error);
          purchase.currentStatus = 'unknown';
        }
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error);
      walletData = { purchases: [], balance: 0, totalSpent: 0 };
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

  async function checkDataRecall(versionId) {
    try {
      const response = await api.request(`/assets/${versionId}/recall-status`);
      return response;
    } catch (error) {
      console.error('Failed to check recall status:', error);
      return { recalled: false, reason: null };
    }
  }

  async function updateNotificationSettings() {
    try {
      await api.request('/notifications/settings', {
        method: 'PUT',
        body: notificationConfig
      });
      alert('Notification settings updated successfully!');
    } catch (error) {
      console.error('Failed to update notification settings:', error);
      alert('Failed to update notification settings');
    }
  }

  async function testWebhook() {
    try {
      await api.request('/notifications/test-webhook', {
        method: 'POST',
        body: { webhookUrl: notificationConfig.webhookUrl }
      });
      alert('Webhook test sent successfully!');
    } catch (error) {
      console.error('Failed to test webhook:', error);
      alert('Webhook test failed');
    }
  }

  function getFilteredPurchases() {
    let filtered = walletData.purchases;

    if (purchaseFilters.status !== 'all') {
      filtered = filtered.filter(purchase => {
        switch (purchaseFilters.status) {
          case 'active': return !purchase.recalled && purchase.currentStatus === 'active';
          case 'recalled': return purchase.recalled;
          case 'expired': return purchase.currentStatus === 'expired';
          default: return true;
        }
      });
    }

    if (purchaseFilters.producer !== 'all') {
      filtered = filtered.filter(purchase => purchase.producerId === purchaseFilters.producer);
    }

    return filtered;
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
        on:click={() => switchTab('wallet')}
        class="tab-btn {activeTab === 'wallet' ? 'active' : ''}"
      >
        💰 My Wallet
      </button>
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
  {:else if activeTab === 'wallet'}
    <!-- Wallet Tab -->
    <div class="space-y-6">
      {#if !walletService.isConnected()}
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h2 class="text-xl font-semibold mb-4 text-yellow-800">Wallet Not Connected</h2>
          <p class="text-yellow-700 mb-4">
            Connect your BRC-100 compatible wallet to view purchase history and manage transactions.
          </p>
          <button
            on:click={() => walletService.connect().catch(console.error)}
            class="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-md transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      {:else}
        <!-- Wallet Summary -->
        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <h2 class="text-xl font-semibold mb-4">BRC100 Wallet Summary</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">{walletData.balance}</div>
            <div class="text-sm text-gray-500">Available Balance (sats)</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-600">{walletData.purchases.length}</div>
            <div class="text-sm text-gray-500">Total Purchases</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-600">{walletData.totalSpent}</div>
            <div class="text-sm text-gray-500">Total Spent (sats)</div>
          </div>
        </div>
      </div>

      <!-- Notification Settings -->
      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <h3 class="text-lg font-semibold mb-4">Notification Settings</h3>
        <form on:submit|preventDefault={updateNotificationSettings} class="space-y-4">
          <div>
            <label for="webhook-url" class="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
            <div class="flex gap-2">
              <input
                id="webhook-url"
                type="url"
                bind:value={notificationConfig.webhookUrl}
                placeholder="https://your-app.com/webhook"
                class="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                on:click={testWebhook}
                class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Test
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <label class="flex items-center">
              <input
                type="checkbox"
                bind:checked={notificationConfig.recallAlerts}
                class="mr-2"
              />
              Data Recall Alerts
            </label>
            <label class="flex items-center">
              <input
                type="checkbox"
                bind:checked={notificationConfig.newDataAlerts}
                class="mr-2"
              />
              New Data Alerts
            </label>
            <label class="flex items-center">
              <input
                type="checkbox"
                bind:checked={notificationConfig.emailNotifications}
                class="mr-2"
              />
              Email Notifications
            </label>
            <label class="flex items-center">
              <input
                type="checkbox"
                bind:checked={notificationConfig.priceChangeAlerts}
                class="mr-2"
              />
              Price Change Alerts
            </label>
          </div>

          <button
            type="submit"
            class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Update Settings
          </button>
        </form>
      </div>

      <!-- Purchase Filters -->
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3">Filter Purchases</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              id="status-filter"
              bind:value={purchaseFilters.status}
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="recalled">Recalled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div>
            <label for="producer-filter" class="block text-sm font-medium text-gray-700 mb-1">Producer</label>
            <select
              id="producer-filter"
              bind:value={purchaseFilters.producer}
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Producers</option>
              {#each [...new Set(walletData.purchases.map(p => p.producerId))] as producerId}
                <option value={producerId}>{producerId}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <!-- Purchase History -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Purchase History</h3>
        {#if getFilteredPurchases().length === 0}
          <div class="text-center py-12">
            <p class="text-gray-500">No purchases found</p>
            <p class="text-gray-400 text-sm mt-2">Purchase data assets to see them here</p>
          </div>
        {:else}
          {#each getFilteredPurchases() as purchase}
            <div class="bg-white border border-gray-200 rounded-lg p-6">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <h4 class="font-semibold text-lg text-gray-900">{purchase.assetName || purchase.versionId}</h4>
                  <p class="text-gray-600 mt-1">{purchase.description || 'No description available'}</p>

                  <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span class="font-medium text-gray-500">Status:</span>
                      <span class="ml-1 {purchase.recalled ? 'text-red-600' : purchase.currentStatus === 'active' ? 'text-green-600' : 'text-yellow-600'}">
                        {purchase.recalled ? 'RECALLED' : purchase.currentStatus || 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span class="font-medium text-gray-500">Producer:</span>
                      <span class="ml-1 {purchase.producerStatus === 'up' ? 'text-green-600' : 'text-red-600'}">
                        {purchase.producerName || purchase.producerId}
                      </span>
                    </div>
                    <div>
                      <span class="font-medium text-gray-500">Purchased:</span>
                      <span class="ml-1 text-gray-700">{new Date(purchase.purchaseDate).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span class="font-medium text-gray-500">Cost:</span>
                      <span class="ml-1 text-gray-700">{purchase.amountSat} sats</span>
                    </div>
                  </div>
                </div>

                <div class="flex gap-2">
                  <button
                    on:click={() => window.open(`/analysis?id=${purchase.versionId}`, '_blank')}
                    class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md transition-colors text-sm"
                  >
                    View Lineage
                  </button>
                  <button
                    on:click={() => checkDataRecall(purchase.versionId)}
                    class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-md transition-colors text-sm"
                  >
                    Check Status
                  </button>
                </div>
              </div>

              {#if purchase.recalled}
                <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div class="flex items-center">
                    <span class="text-red-600 font-medium">⚠️ Data Recalled</span>
                  </div>
                  {#if purchase.recallReason}
                    <p class="text-red-700 text-sm mt-1">{purchase.recallReason}</p>
                  {/if}
                </div>
              {/if}

              {#if purchase.producerStatus === 'down'}
                <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <span class="text-yellow-700 font-medium">⚠️ Producer Offline</span>
                  <p class="text-yellow-700 text-sm mt-1">This producer is currently unavailable</p>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
      {/if}
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