<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import LineageVisualization from './LineageVisualization.svelte';

  // Tab management
  let activeTab = 'catalog';

  // Asset Catalog state
  let assetView = 'data'; // 'data' or 'models'
  let catalogSubTab = 'listing'; // 'listing' or 'lineage'
  let searchQuery = '';
  let typeFilter = '';
  let producerFilter = '';
  let policyFilter = '';
  let assets = [];
  let producers = [];
  let loadingAssets = false;
  let selectedAssetId = '';

  // Publishing state
  let publishType = 'data'; // 'data' or 'model'
  let newAsset = {
    name: '',
    description: '',
    contentHash: '',
    price: 0,
    tags: '',
    classification: 'public',
    license: 'MIT'
  };
  let newModel = {
    name: '',
    description: '',
    framework: '',
    parameters: '',
    commitmentHash: '',
    price: 0
  };
  let publishing = false;

  // Governance Insights state
  let insights = {
    totalAssets: 0,
    totalModels: 0,
    totalProducers: 0,
    policyDistribution: { allow: 0, warn: 0, block: 0 },
    recentActivity: []
  };
  let loadingInsights = false;

  // Policy Management state
  let policies = [];
  let newPolicyName = '';
  let newPolicy = {
    minConfs: 6,
    allowRecalled: false,
    classificationAllowList: ['public', 'internal'],
    licenseAllowList: ['MIT', 'Apache-2.0', 'GPL-3.0'],
    maxLineageDepth: 10,
    maxDataAgeSeconds: 30 * 24 * 60 * 60,
    minProducerUptime: 95.0
  };
  let selectedPolicy = '';
  let testAssetId = '';
  let policyTestResult = null;
  let loadingPolicies = false;
  let creatingPolicy = false;
  let testingPolicy = false;

  onMount(() => {
    loadAssets();
    loadInsights();
    loadPolicies();
  });

  async function loadAssets() {
    try {
      loadingAssets = true;
      const response = await api.getListings();
      assets = response.data || [];

      // Extract unique producers
      const uniqueProducers = [...new Set(assets.map(a => a.producer).filter(Boolean))];
      producers = uniqueProducers;
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      loadingAssets = false;
    }
  }

  async function loadInsights() {
    try {
      loadingInsights = true;
      const response = await api.getListings();
      const allAssets = response.data || [];

      insights = {
        totalAssets: allAssets.filter(a => a.type !== 'model').length,
        totalModels: allAssets.filter(a => a.type === 'model').length,
        totalProducers: [...new Set(allAssets.map(a => a.producer).filter(Boolean))].length,
        policyDistribution: { allow: 0, warn: 0, block: 0 }, // Would need policy evaluation
        recentActivity: allAssets.slice(0, 10)
      };
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      loadingInsights = false;
    }
  }

  async function loadPolicies() {
    try {
      loadingPolicies = true;
      const response = await api.getPolicies();
      policies = response || [];
    } catch (error) {
      console.error('Failed to load policies:', error);
    } finally {
      loadingPolicies = false;
    }
  }

  async function createPolicy(event) {
    event.preventDefault();
    if (!newPolicyName.trim()) return;

    try {
      creatingPolicy = true;
      await api.createPolicy(newPolicyName, newPolicy);
      await loadPolicies();

      // Reset form
      newPolicyName = '';
      newPolicy = {
        minConfs: 6,
        allowRecalled: false,
        classificationAllowList: ['public', 'internal'],
        licenseAllowList: ['MIT', 'Apache-2.0', 'GPL-3.0'],
        maxLineageDepth: 10,
        maxDataAgeSeconds: 30 * 24 * 60 * 60,
        minProducerUptime: 95.0
      };
    } catch (error) {
      console.error('Failed to create policy:', error);
    } finally {
      creatingPolicy = false;
    }
  }

  async function testPolicy() {
    if (!selectedPolicy || !testAssetId) return;

    try {
      testingPolicy = true;
      const response = await api.testPolicy(selectedPolicy, testAssetId);
      policyTestResult = response;
    } catch (error) {
      console.error('Failed to test policy:', error);
      policyTestResult = { decision: 'error', reasons: ['Failed to test policy'] };
    } finally {
      testingPolicy = false;
    }
  }

  // Filter assets based on current view and filters
  $: filteredAssets = assets.filter(asset => {
    // View filter (data vs models)
    if (assetView === 'data' && asset.type === 'model') return false;
    if (assetView === 'models' && asset.type !== 'model') return false;

    // Search filter
    if (searchQuery && !asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !asset.versionId?.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    // Type filter
    if (typeFilter && asset.type !== typeFilter) return false;

    // Producer filter
    if (producerFilter && asset.producer !== producerFilter) return false;

    return true;
  });
</script>

<div class="governance-portal">
  <!-- Top Navigation -->
  <div class="portal-header">
    <h1>🏛️ Governance Portal</h1>
    <div class="global-controls">
      <input
        type="text"
        placeholder="Global search..."
        bind:value={searchQuery}
        class="global-search"
      />
      <button class="btn secondary">📚 Docs</button>
      <button class="btn primary">🔗 Connect Wallet</button>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="tab-nav">
    <button
      class="tab-btn"
      class:active={activeTab === 'catalog'}
      on:click={() => activeTab = 'catalog'}
    >
      📋 Asset Catalog
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'publishing'}
      on:click={() => activeTab = 'publishing'}
    >
      📤 Publishing
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'insights'}
      on:click={() => activeTab = 'insights'}
    >
      📊 Governance Insights
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'policies'}
      on:click={() => activeTab = 'policies'}
    >
      📋 Policy Management
    </button>
  </div>

  <!-- Tab Content -->
  <div class="tab-content">

    <!-- Asset Catalog Tab -->
    {#if activeTab === 'catalog'}
      <div class="catalog-tab">
        <div class="catalog-header">
          <h2>Asset Catalog - Discovery, Lineage & Trust</h2>

          <div class="catalog-controls">
            <!-- Asset Type Toggle -->
            <div class="view-toggle">
              <button
                class="toggle-btn"
                class:active={assetView === 'data'}
                on:click={() => assetView = 'data'}
              >
                📊 Data Assets
              </button>
              <button
                class="toggle-btn"
                class:active={assetView === 'models'}
                on:click={() => assetView = 'models'}
              >
                🤖 AI Models
              </button>
            </div>

            <!-- Sub-tab Navigation -->
            <div class="subtab-nav">
              <button
                class="subtab-btn"
                class:active={catalogSubTab === 'listing'}
                on:click={() => catalogSubTab = 'listing'}
              >
                📋 Listing
              </button>
              <button
                class="subtab-btn"
                class:active={catalogSubTab === 'lineage'}
                on:click={() => catalogSubTab = 'lineage'}
              >
                🔗 Lineage
              </button>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="filters">
          <div class="filter-group">
            <label>Type</label>
            <select bind:value={typeFilter}>
              <option value="">All Types</option>
              <option value="dataset">Dataset</option>
              <option value="model">Model</option>
              <option value="document">Document</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Producer</label>
            <select bind:value={producerFilter}>
              <option value="">All Producers</option>
              {#each producers as producer}
                <option value={producer}>{producer}</option>
              {/each}
            </select>
          </div>
          <div class="filter-group">
            <label>Policy Status</label>
            <select bind:value={policyFilter}>
              <option value="">All</option>
              <option value="allow">✅ Allowed</option>
              <option value="warn">⚠️ Warning</option>
              <option value="block">🚫 Blocked</option>
            </select>
          </div>
        </div>

        <!-- Catalog Content -->
        {#if catalogSubTab === 'listing'}
          <!-- Asset Listing -->
          {#if loadingAssets}
            <div class="loading">Loading assets...</div>
          {:else}
            <div class="asset-grid">
              {#each filteredAssets as asset}
                <div class="asset-card">
                  <div class="asset-header">
                    <h3>{asset.name || asset.versionId}</h3>
                    <span class="policy-badge allow">✅</span>
                  </div>
                  <p class="asset-producer">👤 {asset.producer || 'Unknown'}</p>
                  <p class="asset-type">📁 {asset.type || 'data'}</p>
                  <div class="asset-actions">
                    <button class="btn small">🔍 View Details</button>
                    <button
                      class="btn small secondary"
                      on:click={() => {
                        selectedAssetId = asset.versionId;
                        catalogSubTab = 'lineage';
                      }}
                    >
                      🔗 View Lineage
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:else if catalogSubTab === 'lineage'}
          <!-- Lineage Visualization -->
          <div class="lineage-section">
            {#if selectedAssetId}
              <div class="lineage-header">
                <h3>Lineage for: {selectedAssetId}</h3>
                <button
                  class="btn secondary"
                  on:click={() => catalogSubTab = 'listing'}
                >
                  ← Back to Listing
                </button>
              </div>
              <LineageVisualization
                versionId={selectedAssetId}
                assetType={assetView === 'models' ? 'model' : 'data'}
              />
            {:else}
              <div class="lineage-empty">
                <p>Select an asset from the listing to view its lineage</p>
                <button
                  class="btn primary"
                  on:click={() => catalogSubTab = 'listing'}
                >
                  📋 Go to Asset Listing
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>

    <!-- Publishing Tab -->
    {:else if activeTab === 'publishing'}
      <div class="publishing-tab">
        <h2>Publishing - Producer Marketplace & Registration</h2>

        <!-- Publish Type Selection -->
        <div class="publish-type-selector">
          <h3>What would you like to publish?</h3>
          <div class="type-options">
            <button
              class="type-option"
              class:active={publishType === 'data'}
              on:click={() => publishType = 'data'}
            >
              📊 Data Asset
            </button>
            <button
              class="type-option"
              class:active={publishType === 'model'}
              on:click={() => publishType = 'model'}
            >
              🤖 AI Model
            </button>
          </div>
        </div>

        <!-- Data Asset Publishing Form -->
        {#if publishType === 'data'}
          <div class="publish-form">
            <h4>Publish Data Asset</h4>
            <form>
              <div class="form-row">
                <div class="form-group">
                  <label>Asset Name</label>
                  <input bind:value={newAsset.name} placeholder="My Dataset" />
                </div>
                <div class="form-group">
                  <label>Classification</label>
                  <select bind:value={newAsset.classification}>
                    <option value="public">Public</option>
                    <option value="internal">Internal</option>
                    <option value="restricted">Restricted</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea bind:value={newAsset.description} placeholder="Describe your dataset..."></textarea>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Content Hash</label>
                  <input bind:value={newAsset.contentHash} placeholder="sha256:..." />
                </div>
                <div class="form-group">
                  <label>Price (sats)</label>
                  <input type="number" bind:value={newAsset.price} />
                </div>
              </div>
              <button type="submit" class="btn primary" disabled={publishing}>
                {publishing ? 'Publishing...' : '📤 Publish Asset'}
              </button>
            </form>
          </div>

        <!-- Model Registration Form -->
        {:else}
          <div class="publish-form">
            <h4>Register AI Model</h4>
            <form>
              <div class="form-row">
                <div class="form-group">
                  <label>Model Name</label>
                  <input bind:value={newModel.name} placeholder="My AI Model" />
                </div>
                <div class="form-group">
                  <label>Framework</label>
                  <input bind:value={newModel.framework} placeholder="PyTorch, TensorFlow..." />
                </div>
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea bind:value={newModel.description} placeholder="Describe your model..."></textarea>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Parameters</label>
                  <input bind:value={newModel.parameters} placeholder="7B, 13B..." />
                </div>
                <div class="form-group">
                  <label>Price (sats)</label>
                  <input type="number" bind:value={newModel.price} />
                </div>
              </div>
              <div class="form-group">
                <label>Commitment Hash</label>
                <input bind:value={newModel.commitmentHash} placeholder="Runtime commitment hash..." />
              </div>
              <button type="submit" class="btn primary" disabled={publishing}>
                {publishing ? 'Registering...' : '🤖 Register Model'}
              </button>
            </form>
          </div>
        {/if}
      </div>

    <!-- Governance Insights Tab -->
    {:else if activeTab === 'insights'}
      <div class="insights-tab">
        <h2>Governance Insights - Health & Compliance</h2>

        {#if loadingInsights}
          <div class="loading">Loading insights...</div>
        {:else}
          <div class="insights-grid">
            <!-- KPI Cards -->
            <div class="kpi-card">
              <h3>📊 Data Assets</h3>
              <div class="kpi-value">{insights.totalAssets}</div>
            </div>
            <div class="kpi-card">
              <h3>🤖 AI Models</h3>
              <div class="kpi-value">{insights.totalModels}</div>
            </div>
            <div class="kpi-card">
              <h3>👥 Producers</h3>
              <div class="kpi-value">{insights.totalProducers}</div>
            </div>

            <!-- Policy Distribution -->
            <div class="insight-card">
              <h3>Policy Status Distribution</h3>
              <div class="policy-stats">
                <div class="stat">
                  <span class="badge allow">✅ Allowed</span>
                  <span>{insights.policyDistribution.allow}</span>
                </div>
                <div class="stat">
                  <span class="badge warn">⚠️ Warning</span>
                  <span>{insights.policyDistribution.warn}</span>
                </div>
                <div class="stat">
                  <span class="badge block">🚫 Blocked</span>
                  <span>{insights.policyDistribution.block}</span>
                </div>
              </div>
            </div>

            <!-- Recent Activity -->
            <div class="insight-card">
              <h3>Recent Activity</h3>
              <div class="activity-list">
                {#each insights.recentActivity.slice(0, 5) as activity}
                  <div class="activity-item">
                    <span class="activity-name">{activity.name || activity.versionId}</span>
                    <span class="activity-producer">{activity.producer}</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>

    <!-- Policy Management Tab -->
    {:else if activeTab === 'policies'}
      <div class="policies-tab">
        <h2>Policy Management - Rules & Readiness</h2>

        <div class="policies-layout">
          <!-- Create Policy -->
          <div class="policy-creator">
            <h3>Create New Policy</h3>
            <form on:submit={createPolicy}>
              <div class="form-group">
                <label>Policy Name</label>
                <input bind:value={newPolicyName} placeholder="My Data Policy" required />
              </div>
              <div class="compact-grid">
                <div class="field-group">
                  <label>Min Confirmations</label>
                  <input type="number" bind:value={newPolicy.minConfs} min="0" />
                </div>
                <div class="field-group">
                  <label class="checkbox-label">
                    <input type="checkbox" bind:checked={newPolicy.allowRecalled} />
                    Allow Recalled
                  </label>
                </div>
                <div class="field-group">
                  <label>Classifications</label>
                  <input
                    type="text"
                    bind:value={newPolicy.classificationAllowList}
                    placeholder="public, internal"
                    on:blur={() => {
                      if (typeof newPolicy.classificationAllowList === 'string') {
                        newPolicy.classificationAllowList = newPolicy.classificationAllowList.split(',').map(s => s.trim());
                      }
                    }}
                  />
                </div>
                <div class="field-group">
                  <label>Licenses</label>
                  <input
                    type="text"
                    bind:value={newPolicy.licenseAllowList}
                    placeholder="MIT, Apache-2.0"
                    on:blur={() => {
                      if (typeof newPolicy.licenseAllowList === 'string') {
                        newPolicy.licenseAllowList = newPolicy.licenseAllowList.split(',').map(s => s.trim());
                      }
                    }}
                  />
                </div>
                <div class="field-group">
                  <label>Max Lineage</label>
                  <input type="number" bind:value={newPolicy.maxLineageDepth} min="1" />
                </div>
                <div class="field-group">
                  <label>Max Age (sec)</label>
                  <input type="number" bind:value={newPolicy.maxDataAgeSeconds} min="0" />
                </div>
                <div class="field-group">
                  <label>Min Uptime (%)</label>
                  <input type="number" bind:value={newPolicy.minProducerUptime} min="0" max="100" step="0.1" />
                </div>
              </div>
              <button type="submit" class="btn primary" disabled={creatingPolicy}>
                {creatingPolicy ? 'Creating...' : 'Create Policy'}
              </button>
            </form>
          </div>

          <!-- Policy Tester -->
          <div class="policy-tester">
            <h3>Policy Tester</h3>
            <div class="tester-form">
              <div class="form-group">
                <label>Policy</label>
                <select bind:value={selectedPolicy}>
                  <option value="">Select policy...</option>
                  {#each policies as policy}
                    <option value={policy.id}>{policy.name}</option>
                  {/each}
                </select>
              </div>
              <div class="form-group">
                <label>Asset ID</label>
                <input bind:value={testAssetId} placeholder="versionId or assetId" />
              </div>
              <button
                class="btn secondary"
                disabled={!selectedPolicy || !testAssetId || testingPolicy}
                on:click={testPolicy}
              >
                {testingPolicy ? 'Testing...' : '🧪 Test Policy'}
              </button>
            </div>

            {#if policyTestResult}
              <div class="test-result">
                <h4>Test Result</h4>
                <div class="result-decision decision-{policyTestResult.decision}">
                  {policyTestResult.decision.toUpperCase()}
                </div>
                {#if policyTestResult.reasons}
                  <div class="result-reasons">
                    <h5>Reasons:</h5>
                    <ul>
                      {#each policyTestResult.reasons as reason}
                        <li>{reason}</li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Existing Policies -->
          <div class="policies-list">
            <h3>Existing Policies</h3>
            {#if loadingPolicies}
              <div class="loading">Loading policies...</div>
            {:else if policies.length === 0}
              <p>No policies created yet.</p>
            {:else}
              <div class="policy-items">
                {#each policies as policy}
                  <div class="policy-item">
                    <h4>{policy.name}</h4>
                    <p>Min Confs: {policy.policy?.minConfs || 0}</p>
                    <p>Classifications: {policy.policy?.classificationAllowList?.join(', ') || 'None'}</p>
                    <div class="policy-actions">
                      <button class="btn small">Edit</button>
                      <button class="btn small secondary">Delete</button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .governance-portal {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    background: #0d1117;
    color: #f0f6fc;
    min-height: 100vh;
  }

  .portal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #30363d;
  }

  .portal-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0;
  }

  .global-controls {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .global-search {
    padding: 8px 12px;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    width: 250px;
  }

  .tab-nav {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
    border-bottom: 1px solid #30363d;
  }

  .tab-btn {
    padding: 12px 20px;
    background: transparent;
    border: none;
    color: #8b949e;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    color: #f0f6fc;
    background: #21262d;
  }

  .tab-btn.active {
    color: #58a6ff;
    border-bottom-color: #58a6ff;
  }

  .tab-content {
    min-height: 600px;
  }

  /* Asset Catalog Styles */
  .catalog-header {
    margin-bottom: 20px;
  }

  .catalog-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16px;
  }

  .view-toggle {
    display: flex;
    gap: 8px;
  }

  .toggle-btn {
    padding: 8px 16px;
    background: #21262d;
    border: 1px solid #30363d;
    color: #f0f6fc;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-btn.active {
    background: #238636;
    border-color: #238636;
  }

  .subtab-nav {
    display: flex;
    gap: 4px;
  }

  .subtab-btn {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid #30363d;
    color: #8b949e;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 12px;
  }

  .subtab-btn:hover {
    color: #f0f6fc;
    background: #21262d;
  }

  .subtab-btn.active {
    color: #58a6ff;
    border-color: #58a6ff;
    background: rgba(88, 166, 255, 0.1);
  }

  .filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
    padding: 16px;
    background: #21262d;
    border-radius: 8px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filter-group label {
    font-size: 12px;
    font-weight: 500;
    color: #8b949e;
  }

  .filter-group select {
    padding: 6px 8px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #f0f6fc;
    font-size: 13px;
  }

  .asset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }

  .asset-card {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 16px;
  }

  .asset-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .asset-header h3 {
    font-size: 16px;
    margin: 0;
    color: #f0f6fc;
  }

  .policy-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .policy-badge.allow {
    background: #238636;
    color: white;
  }

  .asset-producer, .asset-type {
    font-size: 12px;
    color: #8b949e;
    margin: 4px 0;
  }

  .asset-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  /* Lineage Section Styles */
  .lineage-section {
    margin-top: 20px;
  }

  .lineage-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #30363d;
  }

  .lineage-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .lineage-empty {
    text-align: center;
    padding: 60px 20px;
    color: #8b949e;
  }

  .lineage-empty p {
    margin-bottom: 20px;
    font-size: 16px;
  }

  /* Publishing Styles */
  .publish-type-selector {
    margin-bottom: 24px;
  }

  .type-options {
    display: flex;
    gap: 16px;
    margin-top: 12px;
  }

  .type-option {
    padding: 16px 24px;
    background: #21262d;
    border: 2px solid #30363d;
    border-radius: 8px;
    color: #f0f6fc;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;
    font-weight: 500;
  }

  .type-option.active {
    border-color: #58a6ff;
    background: rgba(88, 166, 255, 0.1);
  }

  .publish-form {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: 500;
    color: #f0f6fc;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 8px 12px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .form-group textarea {
    min-height: 80px;
    resize: vertical;
  }

  /* Insights Styles */
  .insights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
  }

  .kpi-card {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
  }

  .kpi-card h3 {
    font-size: 14px;
    margin: 0 0 8px 0;
    color: #8b949e;
  }

  .kpi-value {
    font-size: 32px;
    font-weight: 700;
    color: #58a6ff;
  }

  .insight-card {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    grid-column: span 2;
  }

  .policy-stats {
    display: flex;
    gap: 20px;
    margin-top: 12px;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .badge.allow { background: #238636; color: white; }
  .badge.warn { background: #bf8700; color: white; }
  .badge.block { background: #da3633; color: white; }

  .activity-list {
    margin-top: 12px;
  }

  .activity-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #30363d;
  }

  .activity-item:last-child {
    border-bottom: none;
  }

  .activity-name {
    font-weight: 500;
  }

  .activity-producer {
    color: #8b949e;
    font-size: 12px;
  }

  /* Policy Management Styles */
  .policies-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .policy-creator,
  .policy-tester,
  .policies-list {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
  }

  .policies-list {
    grid-column: span 2;
  }

  .compact-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
  }

  .field-group label {
    margin-bottom: 4px;
    color: #f0f6fc;
    font-weight: 500;
    font-size: 12px;
  }

  .field-group input {
    padding: 6px 8px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #f0f6fc;
    font-size: 13px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .test-result {
    margin-top: 16px;
    padding: 16px;
    background: #0d1117;
    border-radius: 6px;
  }

  .result-decision {
    padding: 8px 12px;
    border-radius: 4px;
    font-weight: 600;
    text-align: center;
    margin-bottom: 12px;
  }

  .result-decision.decision-allow {
    background: #238636;
    color: white;
  }

  .result-decision.decision-warn {
    background: #bf8700;
    color: white;
  }

  .result-decision.decision-block {
    background: #da3633;
    color: white;
  }

  .policy-items {
    display: grid;
    gap: 16px;
  }

  .policy-item {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
  }

  .policy-item h4 {
    margin: 0 0 8px 0;
    color: #f0f6fc;
  }

  .policy-item p {
    margin: 4px 0;
    font-size: 12px;
    color: #8b949e;
  }

  .policy-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  /* Button Styles */
  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
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

  .btn.small {
    padding: 4px 8px;
    font-size: 12px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: #8b949e;
  }
</style>