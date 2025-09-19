<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let user = null;
  let subscriptions = [];
  let suggestions = [];
  let webhooks = [];
  let loading = false;
  let error = '';
  let activeTab = 'overview';

  // Webhook creation
  let newWebhookUrl = '';
  let newWebhookEvents = ['data.ready', 'data.updated'];
  let showWebhookForm = false;

  onMount(() => {
    // Get user from localStorage
    const userData = localStorage.getItem('gitdata_user');
    if (userData) {
      user = JSON.parse(userData);
      loadDashboardData();
    }
  });

  async function loadDashboardData() {
    try {
      loading = true;
      error = '';

      // Load user subscriptions, suggestions, and webhooks
      await Promise.all([
        loadSubscriptions(),
        loadSuggestions(),
        loadWebhooks()
      ]);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadSubscriptions() {
    try {
      // Mock subscriptions for demo - in real app would call API
      subscriptions = [
        {
          id: 'sub_001',
          datasetId: 'financial-markets-2024',
          name: 'Financial Markets Data 2024',
          status: 'active',
          lastUpdate: new Date().toISOString(),
          trustStatus: 'trusted',
          price: '0.001 BSV/GB'
        },
        {
          id: 'sub_002',
          datasetId: 'weather-global-hourly',
          name: 'Global Weather Data (Hourly)',
          status: 'active',
          lastUpdate: new Date().toISOString(),
          trustStatus: 'trusted',
          price: '0.0005 BSV/GB'
        }
      ];
    } catch (e) {
      console.warn('Failed to load subscriptions:', e.message);
    }
  }

  async function loadSuggestions() {
    try {
      // Mock personalized suggestions based on user's subscriptions
      suggestions = [
        {
          versionId: 'suggestion_001',
          name: 'Economic Indicators Dataset',
          description: 'Comprehensive economic data that complements your financial markets subscription',
          trustStatus: 'trusted',
          reason: 'Recommended based on your Financial Markets subscription',
          price: '0.002 BSV/GB'
        },
        {
          versionId: 'suggestion_002',
          name: 'Climate Change Impact Data',
          description: 'Environmental impact data that correlates with weather patterns',
          trustStatus: 'verified',
          reason: 'Recommended based on your Weather Data subscription',
          price: '0.001 BSV/GB'
        }
      ];
    } catch (e) {
      console.warn('Failed to load suggestions:', e.message);
    }
  }

  async function loadWebhooks() {
    try {
      // Mock webhooks for demo
      webhooks = [
        {
          id: 'wh_001',
          url: 'https://myapp.com/webhooks/gitdata',
          events: ['data.ready', 'data.updated'],
          status: 'active',
          created: new Date().toISOString(),
          lastTriggered: new Date(Date.now() - 3600000).toISOString()
        }
      ];
    } catch (e) {
      console.warn('Failed to load webhooks:', e.message);
    }
  }

  async function createWebhook() {
    if (!newWebhookUrl) return;

    try {
      // Mock webhook creation
      const newWebhook = {
        id: `wh_${Date.now()}`,
        url: newWebhookUrl,
        events: [...newWebhookEvents],
        status: 'active',
        created: new Date().toISOString(),
        lastTriggered: null
      };

      webhooks = [...webhooks, newWebhook];
      newWebhookUrl = '';
      showWebhookForm = false;
    } catch (e) {
      error = e.message;
    }
  }

  async function deleteWebhook(webhookId) {
    if (confirm('Are you sure you want to delete this webhook?')) {
      webhooks = webhooks.filter(w => w.id !== webhookId);
    }
  }

  function getTrustIcon(status) {
    switch (status) {
      case 'trusted': return '✅';
      case 'verified': return '🔒';
      case 'pending': return '⏳';
      default: return '❓';
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  function setActiveTab(tab) {
    activeTab = tab;
  }
</script>

<div class="space-y-6">
  <!-- Welcome Header -->
  <div class="glass-card p-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-white mb-2">
          Welcome back, {user?.name || 'User'}! 👋
        </h2>
        <p class="text-white/80">
          Manage your data subscriptions, discover new datasets, and configure webhooks for real-time updates.
        </p>
      </div>
      <div class="text-right">
        <div class="text-white/70 text-sm">Active Subscriptions</div>
        <div class="text-3xl font-bold text-white">{subscriptions.length}</div>
      </div>
    </div>
  </div>

  <!-- Navigation Tabs -->
  <div class="glass-card p-1">
    <div class="flex rounded-lg overflow-hidden">
      <button
        on:click={() => setActiveTab('overview')}
        class="flex-1 py-3 px-4 text-sm font-medium transition-colors {activeTab === 'overview' ? 'bg-white text-primary-700' : 'text-white hover:bg-white/20'}"
      >
        📊 Overview
      </button>
      <button
        on:click={() => setActiveTab('subscriptions')}
        class="flex-1 py-3 px-4 text-sm font-medium transition-colors {activeTab === 'subscriptions' ? 'bg-white text-primary-700' : 'text-white hover:bg-white/20'}"
      >
        📡 Subscriptions
      </button>
      <button
        on:click={() => setActiveTab('suggestions')}
        class="flex-1 py-3 px-4 text-sm font-medium transition-colors {activeTab === 'suggestions' ? 'bg-white text-primary-700' : 'text-white hover:bg-white/20'}"
      >
        🎯 Suggestions
      </button>
      <button
        on:click={() => setActiveTab('webhooks')}
        class="flex-1 py-3 px-4 text-sm font-medium transition-colors {activeTab === 'webhooks' ? 'bg-white text-primary-700' : 'text-white hover:bg-white/20'}"
      >
        🔗 Webhooks
      </button>
    </div>
  </div>

  <!-- Error Display -->
  {#if error}
    <div class="glass-card p-4 border-red-400 bg-red-500/20">
      <p class="text-red-200 font-medium">❌ {error}</p>
    </div>
  {/if}

  <!-- Tab Content -->
  {#if activeTab === 'overview'}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Quick Stats -->
      <div class="glass-card p-6">
        <h3 class="text-lg font-semibold text-white mb-4">Quick Stats</h3>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-white/80">Active Subscriptions</span>
            <span class="text-xl font-bold text-green-400">{subscriptions.length}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-white/80">New Suggestions</span>
            <span class="text-xl font-bold text-blue-400">{suggestions.length}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-white/80">Active Webhooks</span>
            <span class="text-xl font-bold text-purple-400">{webhooks.length}</span>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="glass-card p-6">
        <h3 class="text-lg font-semibold text-white mb-4">Recent Activity</h3>
        <div class="space-y-3 text-sm">
          <div class="flex items-center gap-3 text-white/80">
            <span class="text-green-400">✅</span>
            <span>Financial Markets data updated 2 hours ago</span>
          </div>
          <div class="flex items-center gap-3 text-white/80">
            <span class="text-blue-400">🔗</span>
            <span>Webhook triggered for weather data</span>
          </div>
          <div class="flex items-center gap-3 text-white/80">
            <span class="text-purple-400">🎯</span>
            <span>2 new dataset suggestions available</span>
          </div>
        </div>
      </div>
    </div>

  {:else if activeTab === 'subscriptions'}
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-xl font-semibold text-white">Your Subscriptions</h3>
        <button class="btn-primary">
          ➕ Browse More Data
        </button>
      </div>

      {#if loading}
        <div class="glass-card p-8 text-center">
          <div class="animate-spin text-4xl mb-4">⚪</div>
          <p class="text-white/80">Loading subscriptions...</p>
        </div>
      {:else if subscriptions.length === 0}
        <div class="glass-card p-8 text-center">
          <div class="text-6xl mb-4 opacity-50">📡</div>
          <h3 class="text-xl font-semibold text-white mb-2">No Subscriptions Yet</h3>
          <p class="text-white/80 mb-4">Start by browsing the data catalog to find datasets you need.</p>
          <button class="btn-primary">Browse Data Catalog</button>
        </div>
      {:else}
        {#each subscriptions as subscription}
          <div class="glass-card p-6">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xl">{getTrustIcon(subscription.trustStatus)}</span>
                  <h4 class="text-lg font-semibold text-white">{subscription.name}</h4>
                </div>
                <div class="space-y-2 text-sm text-white/80">
                  <div>
                    <span class="font-medium">Dataset ID:</span>
                    <code class="bg-white/20 px-2 py-1 rounded text-xs ml-2">{subscription.datasetId}</code>
                  </div>
                  <div>
                    <span class="font-medium">Status:</span>
                    <span class="ml-2 capitalize text-green-400">{subscription.status}</span>
                  </div>
                  <div>
                    <span class="font-medium">Price:</span>
                    <span class="ml-2">{subscription.price}</span>
                  </div>
                  <div>
                    <span class="font-medium">Last Update:</span>
                    <span class="ml-2">{formatDate(subscription.lastUpdate)}</span>
                  </div>
                </div>
              </div>
              <div class="flex gap-2 ml-4">
                <button class="bg-white/20 hover:bg-white/30 text-white text-sm py-2 px-4 rounded-lg transition-colors">
                  ⚙️ Configure
                </button>
                <button class="bg-red-500/20 hover:bg-red-500/30 text-red-200 text-sm py-2 px-4 rounded-lg transition-colors">
                  ❌ Unsubscribe
                </button>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

  {:else if activeTab === 'suggestions'}
    <div class="space-y-4">
      <h3 class="text-xl font-semibold text-white">Personalized Suggestions</h3>

      {#if suggestions.length === 0}
        <div class="glass-card p-8 text-center">
          <div class="text-6xl mb-4 opacity-50">🎯</div>
          <h3 class="text-xl font-semibold text-white mb-2">No Suggestions Available</h3>
          <p class="text-white/80">We'll suggest relevant datasets based on your subscription history.</p>
        </div>
      {:else}
        {#each suggestions as suggestion}
          <div class="glass-card p-6">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xl">{getTrustIcon(suggestion.trustStatus)}</span>
                  <h4 class="text-lg font-semibold text-white">{suggestion.name}</h4>
                </div>
                <p class="text-white/80 mb-3">{suggestion.description}</p>
                <div class="space-y-2 text-sm text-white/70">
                  <div class="flex items-center gap-2">
                    <span class="text-blue-400">💡</span>
                    <span>{suggestion.reason}</span>
                  </div>
                  <div>
                    <span class="font-medium">Price:</span>
                    <span class="ml-2">{suggestion.price}</span>
                  </div>
                </div>
              </div>
              <div class="flex gap-2 ml-4">
                <button class="bg-white/20 hover:bg-white/30 text-white text-sm py-2 px-4 rounded-lg transition-colors">
                  👁️ Preview
                </button>
                <button class="btn-primary text-sm py-2 px-4">
                  ➕ Subscribe
                </button>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

  {:else if activeTab === 'webhooks'}
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-xl font-semibold text-white">Webhook Configuration</h3>
        <button
          on:click={() => showWebhookForm = !showWebhookForm}
          class="btn-primary"
        >
          ➕ Add Webhook
        </button>
      </div>

      <!-- Webhook Creation Form -->
      {#if showWebhookForm}
        <div class="glass-card p-6">
          <h4 class="text-lg font-semibold text-white mb-4">Create New Webhook</h4>
          <form on:submit|preventDefault={createWebhook} class="space-y-4">
            <div>
              <label class="block text-white font-medium mb-2">Webhook URL</label>
              <input
                bind:value={newWebhookUrl}
                placeholder="https://your-app.com/webhooks/gitdata"
                class="input-field w-full"
                required
              />
            </div>
            <div>
              <label class="block text-white font-medium mb-2">Events to Subscribe</label>
              <div class="space-y-2">
                <label class="flex items-center gap-2">
                  <input type="checkbox" bind:group={newWebhookEvents} value="data.ready" class="rounded">
                  <span class="text-white/80">Data Ready (trust verification completed)</span>
                </label>
                <label class="flex items-center gap-2">
                  <input type="checkbox" bind:group={newWebhookEvents} value="data.updated" class="rounded">
                  <span class="text-white/80">Data Updated (new version available)</span>
                </label>
                <label class="flex items-center gap-2">
                  <input type="checkbox" bind:group={newWebhookEvents} value="subscription.expired" class="rounded">
                  <span class="text-white/80">Subscription Expired</span>
                </label>
              </div>
            </div>
            <div class="flex gap-2">
              <button type="submit" class="btn-primary">Create Webhook</button>
              <button
                type="button"
                on:click={() => showWebhookForm = false}
                class="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      {/if}

      <!-- Existing Webhooks -->
      {#if webhooks.length === 0}
        <div class="glass-card p-8 text-center">
          <div class="text-6xl mb-4 opacity-50">🔗</div>
          <h3 class="text-xl font-semibold text-white mb-2">No Webhooks Configured</h3>
          <p class="text-white/80">Set up webhooks to receive real-time notifications about your data subscriptions.</p>
        </div>
      {:else}
        {#each webhooks as webhook}
          <div class="glass-card p-6">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xl">🔗</span>
                  <h4 class="text-lg font-semibold text-white break-all">{webhook.url}</h4>
                </div>
                <div class="space-y-2 text-sm text-white/80">
                  <div>
                    <span class="font-medium">Events:</span>
                    <span class="ml-2">{webhook.events.join(', ')}</span>
                  </div>
                  <div>
                    <span class="font-medium">Status:</span>
                    <span class="ml-2 capitalize text-green-400">{webhook.status}</span>
                  </div>
                  <div>
                    <span class="font-medium">Created:</span>
                    <span class="ml-2">{formatDate(webhook.created)}</span>
                  </div>
                  {#if webhook.lastTriggered}
                    <div>
                      <span class="font-medium">Last Triggered:</span>
                      <span class="ml-2">{formatDate(webhook.lastTriggered)}</span>
                    </div>
                  {/if}
                </div>
              </div>
              <div class="flex gap-2 ml-4">
                <button class="bg-white/20 hover:bg-white/30 text-white text-sm py-2 px-4 rounded-lg transition-colors">
                  🧪 Test
                </button>
                <button
                  on:click={() => deleteWebhook(webhook.id)}
                  class="bg-red-500/20 hover:bg-red-500/30 text-red-200 text-sm py-2 px-4 rounded-lg transition-colors"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>