<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';

  // State management
  let activeTab = 'data';
  let datasets = [];
  let filteredDatasets = [];
  let policies = [];
  let selectedPolicy = '';
  let policyPreview = false;

  // Data filters
  let currentPage = 0;
  let pageSize = 20;
  let searchFilter = '';
  let typeFilter = '';
  let producerFilter = '';
  let policyFilter = '';
  let loading = false;

  // Policy configuration
  let newPolicyName = '';
  let newPolicy = {
    minConfs: 6,
    allowRecalled: false,
    classificationAllowList: ['public', 'internal'],
    licenseAllowList: ['MIT', 'Apache-2.0', 'GPL-3.0', 'CC-BY-4.0'],
    maxLineageDepth: 10,
    maxDataAgeSeconds: 30 * 24 * 60 * 60, // 30 days
    minProducerUptime: 95.0
  };
  let creatingPolicy = false;

  onMount(() => {
    loadAllData();
  });

  async function loadAllData() {
    await Promise.all([
      loadDatasets(),
      loadPolicies()
    ]);
  }

  async function loadDatasets() {
    loading = true;
    try {
      let datasets_loaded = false;

      // Try listings API first
      try {
        const listingsResponse = await fetch(`/listings?limit=200${policyPreview && selectedPolicy ? '&policyPreview=true&policyId=' + selectedPolicy : ''}`);
        if (listingsResponse.ok) {
          const listingsResult = await listingsResponse.json();
          if (listingsResult.items && listingsResult.items.length > 0) {
            datasets = listingsResult.items.map(item => ({
              versionId: item.versionId,
              type: item.name || 'Dataset',
              producer: item.producerId || 'Unknown',
              createdAt: item.updatedAt || new Date().toISOString(),
              price: 'Variable',
              license: 'See manifest',
              policyDecision: item.policyDecision || null,
              policyReasons: item.policyReasons || []
            }));
            datasets_loaded = true;
          }
        }
      } catch (e) {
        console.warn('Listings API failed:', e);
      }

      // Fallback to models API
      if (!datasets_loaded) {
        try {
          const modelsResponse = await fetch('/api/models/search?limit=200');
          if (modelsResponse.ok) {
            const modelsResult = await modelsResponse.json();
            datasets = (modelsResult.items || []).map(item => ({
              versionId: item.modelVersionId,
              type: `${item.framework} Model`,
              producer: 'Model Registry',
              createdAt: new Date(item.createdAt * 1000).toISOString(),
              price: 'Variable',
              license: 'See details',
              policyDecision: null,
              policyReasons: []
            }));
            datasets_loaded = true;
          }
        } catch (e) {
          console.warn('Models API failed:', e);
        }
      }

      if (!datasets_loaded) {
        datasets = [];
      }

      applyFilters();
    } catch (error) {
      console.error('Failed to load datasets:', error);
      datasets = [];
      applyFilters();
    } finally {
      loading = false;
    }
  }

  async function loadPolicies() {
    try {
      const result = await api.getPolicies();
      policies = result.items || [];
    } catch (e) {
      console.warn('Failed to load policies:', e.message);
      policies = [];
    }
  }

  function applyFilters() {
    filteredDatasets = datasets.filter(dataset => {
      const matchesSearch = !searchFilter ||
        dataset.versionId.toLowerCase().includes(searchFilter.toLowerCase()) ||
        dataset.producer.toLowerCase().includes(searchFilter.toLowerCase());

      const matchesType = !typeFilter || dataset.type === typeFilter;
      const matchesProducer = !producerFilter || dataset.producer === producerFilter;

      const matchesPolicy = !policyFilter ||
        (dataset.policyDecision && dataset.policyDecision === policyFilter);

      return matchesSearch && matchesType && matchesProducer && matchesPolicy;
    });
  }

  function goToDetail(versionId) {
    goto(`/data/version/${encodeURIComponent(versionId)}`);
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  function nextPage() {
    if ((currentPage + 1) * pageSize < filteredDatasets.length) {
      currentPage++;
    }
  }

  function prevPage() {
    if (currentPage > 0) {
      currentPage--;
    }
  }

  function getPolicyDecisionColor(decision) {
    switch (decision) {
      case 'allow': return 'policy-allow';
      case 'warn': return 'policy-warn';
      case 'block': return 'policy-block';
      default: return 'policy-unknown';
    }
  }

  async function createPolicy(event) {
    event.preventDefault();
    if (!newPolicyName.trim()) {
      alert('Policy name is required');
      return;
    }

    try {
      creatingPolicy = true;
      const result = await api.createPolicy(newPolicyName.trim(), newPolicy);
      console.log('Policy created:', result);

      // Reset form
      newPolicyName = '';
      newPolicy = {
        minConfs: 6,
        allowRecalled: false,
        classificationAllowList: ['public', 'internal'],
        licenseAllowList: ['MIT', 'Apache-2.0', 'GPL-3.0', 'CC-BY-4.0'],
        maxLineageDepth: 10,
        maxDataAgeSeconds: 30 * 24 * 60 * 60,
        minProducerUptime: 95.0
      };

      await loadPolicies();
    } catch (e) {
      alert('Failed to create policy: ' + e.message);
    } finally {
      creatingPolicy = false;
    }
  }

  async function togglePolicyPreview() {
    policyPreview = !policyPreview;
    await loadDatasets();
  }

  // Reactive statements
  $: paginatedDatasets = filteredDatasets.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  $: uniqueTypes = [...new Set(datasets.map(d => d.type))];
  $: uniqueProducers = [...new Set(datasets.map(d => d.producer))];
  $: totalPages = Math.ceil(filteredDatasets.length / pageSize);

  $: {
    searchFilter, typeFilter, producerFilter, policyFilter;
    applyFilters();
    currentPage = 0;
  }

  $: {
    selectedPolicy;
    if (policyPreview) {
      loadDatasets();
    }
  }
</script>

<div class="data-explorer">
  <!-- Header -->
  <div class="header-section">
    <h2>📊 Data Governance Hub</h2>
    <p>
      Explore, filter, and govern your data with advanced policy controls. View data through policy lenses and configure governance rules.
    </p>
  </div>

  <!-- Tab Navigation -->
  <div class="tab-navigation">
    <button
      class="tab-button {activeTab === 'data' ? 'active' : ''}"
      on:click={() => activeTab = 'data'}
    >
      📊 Data Explorer ({filteredDatasets.length})
    </button>
    <button
      class="tab-button {activeTab === 'policies' ? 'active' : ''}"
      on:click={() => activeTab = 'policies'}
    >
      🛡️ Policy Configurator ({policies.length})
    </button>
  </div>

  {#if activeTab === 'data'}
    <div class="data-tab">
      <!-- Data Filters -->
      <div class="filters-section">
        <div class="filter-row">
          <div class="filter-group">
            <label>Search</label>
            <input
              bind:value={searchFilter}
              placeholder="Search by version ID or producer..."
            />
          </div>

          <div class="filter-group">
            <label>Type</label>
            <select bind:value={typeFilter}>
              <option value="">All Types</option>
              {#each uniqueTypes as type}
                <option value={type}>{type}</option>
              {/each}
            </select>
          </div>

          <div class="filter-group">
            <label>Producer</label>
            <select bind:value={producerFilter}>
              <option value="">All Producers</option>
              {#each uniqueProducers as producer}
                <option value={producer}>{producer}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Policy Controls -->
        <div class="policy-controls">
          <div class="policy-preview-toggle">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={policyPreview} on:change={togglePolicyPreview} />
              Enable Policy Preview
            </label>
          </div>

          {#if policyPreview}
            <div class="filter-group">
              <label>Policy</label>
              <select bind:value={selectedPolicy}>
                <option value="">Select a policy...</option>
                {#each policies.filter(p => p.enabled) as policy}
                  <option value={policy.policyId}>{policy.name}</option>
                {/each}
              </select>
            </div>

            <div class="filter-group">
              <label>Policy Decision</label>
              <select bind:value={policyFilter}>
                <option value="">All Decisions</option>
                <option value="allow">Allow</option>
                <option value="warn">Warn</option>
                <option value="block">Block</option>
              </select>
            </div>
          {/if}

          <button class="btn secondary" on:click={loadDatasets}>
            🔄 Refresh Data
          </button>
        </div>
      </div>

      <!-- Data Table -->
      <div class="data-table">
        {#if loading}
          <div class="loading-state">
            <div class="spinner large">⚪</div>
            <p>Loading data...</p>
          </div>
        {:else if paginatedDatasets.length === 0}
          <div class="empty-state">
            <div class="empty-icon">📊</div>
            <h3>No Data Found</h3>
            <p>
              {filteredDatasets.length === 0 ? 'No data matches your current filters.' : 'Adjust your search criteria or add some data.'}
            </p>
          </div>
        {:else}
          <table>
            <thead>
              <tr>
                <th>Version ID</th>
                <th>Type</th>
                <th>Producer</th>
                <th>Created</th>
                <th>Price</th>
                {#if policyPreview && selectedPolicy}
                  <th>Policy Decision</th>
                {/if}
              </tr>
            </thead>
            <tbody>
              {#each paginatedDatasets as dataset}
                <tr on:click={() => goToDetail(dataset.versionId)} class="data-row">
                  <td>
                    <a href="/data/version/{encodeURIComponent(dataset.versionId)}" class="version-id">
                      {dataset.versionId}
                    </a>
                  </td>
                  <td>{dataset.type}</td>
                  <td>{dataset.producer}</td>
                  <td>{formatDate(dataset.createdAt)}</td>
                  <td>{dataset.price}</td>
                  {#if policyPreview && selectedPolicy}
                    <td>
                      {#if dataset.policyDecision}
                        <span class="policy-badge {getPolicyDecisionColor(dataset.policyDecision)}">
                          {dataset.policyDecision.toUpperCase()}
                        </span>
                        {#if dataset.policyReasons.length > 0}
                          <div class="policy-reasons">
                            {dataset.policyReasons.slice(0, 2).join(', ')}
                            {#if dataset.policyReasons.length > 2}...{/if}
                          </div>
                        {/if}
                      {:else}
                        <span class="policy-badge policy-unknown">UNKNOWN</span>
                      {/if}
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

      <!-- Pagination -->
      {#if totalPages > 1}
        <div class="pagination">
          <button class="btn secondary" on:click={prevPage} disabled={currentPage === 0}>
            ← Previous
          </button>
          <span class="page-info">Page {currentPage + 1} of {totalPages}</span>
          <button class="btn secondary" on:click={nextPage} disabled={currentPage >= totalPages - 1}>
            Next →
          </button>
        </div>
      {/if}
    </div>

  {:else if activeTab === 'policies'}
    <div class="policies-tab">
      <!-- Create New Policy -->
      <div class="form-section">
        <h3>Create New Policy</h3>
        <form on:submit={createPolicy}>
          <div class="form-group">
            <label>Policy Name</label>
            <input
              bind:value={newPolicyName}
              placeholder="My Data Policy"
              required
            />
          </div>

          <div class="policy-fields">
            <h4>Security & Trust</h4>
            <div class="field-grid">
              <div class="field-group">
                <label>Minimum Confirmations</label>
                <input type="number" bind:value={newPolicy.minConfs} min="0" />
              </div>
              <div class="field-group">
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={newPolicy.allowRecalled} />
                  Allow Recalled Data
                </label>
              </div>
            </div>

            <h4>Compliance</h4>
            <div class="field-grid">
              <div class="field-group">
                <label>Allowed Classifications</label>
                <input
                  type="text"
                  bind:value={newPolicy.classificationAllowList}
                  placeholder="public, internal, restricted"
                  on:blur={() => {
                    if (typeof newPolicy.classificationAllowList === 'string') {
                      newPolicy.classificationAllowList = newPolicy.classificationAllowList.split(',').map(s => s.trim());
                    }
                  }}
                />
              </div>
              <div class="field-group">
                <label>Allowed Licenses</label>
                <input
                  type="text"
                  bind:value={newPolicy.licenseAllowList}
                  placeholder="MIT, Apache-2.0, GPL-3.0"
                  on:blur={() => {
                    if (typeof newPolicy.licenseAllowList === 'string') {
                      newPolicy.licenseAllowList = newPolicy.licenseAllowList.split(',').map(s => s.trim());
                    }
                  }}
                />
              </div>
            </div>

            <h4>Data Quality</h4>
            <div class="field-grid">
              <div class="field-group">
                <label>Max Lineage Depth</label>
                <input type="number" bind:value={newPolicy.maxLineageDepth} min="1" />
              </div>
              <div class="field-group">
                <label>Max Data Age (seconds)</label>
                <input type="number" bind:value={newPolicy.maxDataAgeSeconds} min="0" />
              </div>
              <div class="field-group">
                <label>Min Producer Uptime (%)</label>
                <input type="number" bind:value={newPolicy.minProducerUptime} min="0" max="100" step="0.1" />
              </div>
            </div>
          </div>

          <button type="submit" class="btn primary" disabled={creatingPolicy}>
            {#if creatingPolicy}
              <span class="spinner">⚪</span>
              Creating...
            {:else}
              🛡️ Create Policy
            {/if}
          </button>
        </form>
      </div>

      <!-- Existing Policies -->
      <div class="policies-list">
        <h3>Existing Policies</h3>
        {#if policies.length === 0}
          <div class="empty-state">
            <div class="empty-icon">🛡️</div>
            <h3>No Policies Found</h3>
            <p>Create your first policy to start governing your data.</p>
          </div>
        {:else}
          <div class="data-table">
            {#each policies as policy}
              <div class="policy-card">
                <div class="card-header">
                  <div class="card-title">
                    <h4>{policy.name}</h4>
                    <p class="policy-id">ID: <code>{policy.policyId}</code></p>
                  </div>
                  <span class="status {policy.enabled ? 'status-success' : 'status-error'}">
                    {policy.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <div class="card-content">
                  <div class="policy-summary">
                    {#if policy.policy.minConfs}
                      <span class="policy-rule">Min {policy.policy.minConfs} confirmations</span>
                    {/if}
                    {#if policy.policy.classificationAllowList}
                      <span class="policy-rule">{policy.policy.classificationAllowList.length} allowed classifications</span>
                    {/if}
                    {#if policy.policy.maxLineageDepth}
                      <span class="policy-rule">Max {policy.policy.maxLineageDepth} lineage depth</span>
                    {/if}
                    {#if policy.policy.minProducerUptime}
                      <span class="policy-rule">Min {policy.policy.minProducerUptime}% uptime</span>
                    {/if}
                  </div>
                  <div class="policy-meta">
                    <span class="label">Created:</span>
                    <span>{new Date(policy.createdAt * 1000).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .data-explorer {
    max-width: 1400px;
    margin: 0 auto;
  }

  .header-section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 20px;
  }

  .header-section h2 {
    font-size: 24px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .header-section p {
    color: #8b949e;
    line-height: 1.5;
  }

  .tab-navigation {
    display: flex;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 4px;
    margin-bottom: 20px;
  }

  .tab-button {
    flex: 1;
    padding: 12px 16px;
    background: none;
    border: none;
    color: #8b949e;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .tab-button:hover {
    color: #f0f6fc;
    background: rgba(255, 255, 255, 0.05);
  }

  .tab-button.active {
    background: #238636;
    color: white;
  }

  .filters-section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .filter-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
  }

  .filter-group label {
    margin-bottom: 8px;
    color: #f0f6fc;
    font-weight: 600;
    font-size: 14px;
  }

  .filter-group input, .filter-group select {
    padding: 8px 12px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .filter-group input:focus, .filter-group select:focus {
    border-color: #1f6feb;
    outline: none;
  }

  .policy-controls {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid #30363d;
    flex-wrap: wrap;
  }

  .policy-preview-toggle {
    display: flex;
    align-items: center;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    color: #f0f6fc;
    font-size: 14px;
    font-weight: 500;
  }

  .checkbox-label input[type="checkbox"] {
    margin-right: 8px;
  }

  .data-table {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 20px;
  }

  .data-table table {
    width: 100%;
    border-collapse: collapse;
  }

  .data-table th, .data-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid #30363d;
  }

  .data-table th {
    background: #21262d;
    color: #f0f6fc;
    font-weight: 600;
    font-size: 14px;
  }

  .data-table td {
    color: #8b949e;
    font-size: 14px;
  }

  .data-row {
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .data-row:hover {
    background: #161b22;
  }

  .version-id {
    color: #58a6ff;
    text-decoration: none;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  }

  .version-id:hover {
    text-decoration: underline;
  }

  .policy-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .policy-badge.policy-allow {
    background: #0d2818;
    color: #2ea043;
    border: 1px solid #2ea043;
  }

  .policy-badge.policy-warn {
    background: #2d2000;
    color: #ffc107;
    border: 1px solid #ffc107;
  }

  .policy-badge.policy-block {
    background: #2d0d0d;
    color: #da3633;
    border: 1px solid #da3633;
  }

  .policy-badge.policy-unknown {
    background: rgba(255, 255, 255, 0.1);
    color: #8b949e;
    border: 1px solid #30363d;
  }

  .policy-reasons {
    font-size: 11px;
    color: #6c7983;
    margin-top: 2px;
  }

  .loading-state, .empty-state {
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

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 20px 0;
  }

  .page-info {
    color: #8b949e;
    font-size: 14px;
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

  /* Policy Configuration Styles */
  .form-section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 20px;
  }

  .form-section h3 {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 16px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .policy-fields h4 {
    font-size: 16px;
    font-weight: 600;
    color: #f0f6fc;
    margin: 20px 0 12px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid #30363d;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
  }

  .field-group label {
    margin-bottom: 8px;
    color: #f0f6fc;
    font-weight: 500;
    font-size: 14px;
  }

  .field-group input {
    padding: 8px 12px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .policies-list {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
  }

  .policies-list h3 {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 16px;
  }

  .policy-card {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .card-title h4 {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 4px;
  }

  .policy-id {
    color: #8b949e;
    font-size: 14px;
  }

  .policy-id code {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
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

  .card-content {
    color: #8b949e;
    font-size: 14px;
  }

  .policy-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .policy-rule {
    background: rgba(88, 166, 255, 0.2);
    color: #58a6ff;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
  }

  .policy-meta {
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .label {
    font-weight: 600;
    color: #f0f6fc;
  }

  @media (max-width: 768px) {
    .filter-row {
      grid-template-columns: 1fr;
    }

    .policy-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .field-grid {
      grid-template-columns: 1fr;
    }

    .data-table {
      overflow-x: auto;
    }

    .tab-navigation {
      flex-direction: column;
    }

    .card-header {
      flex-direction: column;
      gap: 12px;
    }
  }
</style>