<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';

  // State management
  let policies = [];
  let filteredPolicies = [];
  let loading = false;

  // Filters
  let searchFilter = '';
  let statusFilter = '';
  let typeFilter = '';
  let currentPage = 0;
  let pageSize = 20;


  onMount(() => {
    loadPolicies();
  });

  async function loadPolicies() {
    loading = true;
    try {
      // Try policies API first
      try {
        const response = await fetch('/policies');
        if (response.ok) {
          const result = await response.json();
          policies = result.policies || result.items || [];
        } else {
          // Fallback to dummy data
          policies = generateDummyPolicies();
        }
      } catch (e) {
        console.warn('Policies API failed:', e);
        policies = generateDummyPolicies();
      }

      applyFilters();
    } catch (error) {
      console.error('Failed to load policies:', error);
      policies = [];
      applyFilters();
    } finally {
      loading = false;
    }
  }

  function generateDummyPolicies() {
    return [
      {
        policyId: 'pol_001',
        name: 'Production Data Access',
        description: 'Standard access controls for production datasets',
        enabled: true,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'access_control',
        rulesCount: 8,
        policy: {
          minConfs: 6,
          classificationAllowList: ['public', 'internal'],
          allowRecalled: false,
          maxLineageDepth: 10
        }
      },
      {
        policyId: 'pol_002',
        name: 'PII Protection Policy',
        description: 'Privacy controls for personally identifiable information',
        enabled: true,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'privacy',
        rulesCount: 12,
        policy: {
          piiFlagsBlockList: ['has_personal_info', 'has_contact_details'],
          minAnonymizationLevel: { type: 'k-anon', k: 5 },
          blockIfInThreatFeed: true
        }
      },
      {
        policyId: 'pol_003',
        name: 'ML Model Validation',
        description: 'Quality and bias checks for machine learning models',
        enabled: false,
        createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'mlops',
        rulesCount: 6,
        policy: {
          maxBiasScore: 0.2,
          maxDriftScore: 0.15,
          requiresValidSplit: true,
          minUniquenessRatio: 0.95
        }
      }
    ];
  }

  function applyFilters() {
    filteredPolicies = policies.filter(policy => {
      const matchesSearch = !searchFilter ||
        policy.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        policy.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
        policy.policyId.toLowerCase().includes(searchFilter.toLowerCase());

      const matchesStatus = !statusFilter ||
        (statusFilter === 'enabled' && policy.enabled) ||
        (statusFilter === 'disabled' && !policy.enabled);

      const matchesType = !typeFilter || policy.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }

  function goToPolicyDetail(policyId) {
    goto(`/policy/${encodeURIComponent(policyId)}`);
  }

  function createNewPolicy() {
    goto('/policy/new');
  }


  async function togglePolicy(policy) {
    try {
      // Optimistic update
      policy.enabled = !policy.enabled;
      policies = policies;
      applyFilters();

      // Try to persist the change
      await fetch(`/policies/${policy.policyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: policy.enabled })
      });
    } catch (error) {
      // Revert on error
      policy.enabled = !policy.enabled;
      policies = policies;
      applyFilters();
      console.error('Failed to toggle policy:', error);
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  function getStatusColor(enabled) {
    return enabled ? 'status-success' : 'status-error';
  }

  function getPolicyTypeLabel(type) {
    const typeMap = {
      'access_control': 'Access Control',
      'data_quality': 'Data Quality',
      'privacy': 'Privacy',
      'compliance': 'Compliance',
      'mlops': 'MLOps'
    };
    return typeMap[type] || type;
  }

  function nextPage() {
    if ((currentPage + 1) * pageSize < filteredPolicies.length) {
      currentPage++;
    }
  }

  function prevPage() {
    if (currentPage > 0) {
      currentPage--;
    }
  }

  // Reactive statements
  $: paginatedPolicies = filteredPolicies.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  $: uniqueTypes = [...new Set(policies.map(p => p.type))];
  $: totalPages = Math.ceil(filteredPolicies.length / pageSize);

  $: {
    searchFilter, statusFilter, typeFilter;
    applyFilters();
    currentPage = 0;
  }
</script>

<svelte:head>
  <title>Policy Governance - Gitdata</title>
  <meta name="description" content="Configure and manage data governance policies with advanced rule templates" />
</svelte:head>

<div class="policy-explorer">
  <!-- Header -->
  <div class="header-section">
    <h2>🛡️ Policy Governance Hub</h2>
    <p>
      Configure and manage data governance policies with advanced rule templates. Control access, ensure quality, and maintain compliance across your data ecosystem.
    </p>
  </div>


  <div class="policies-content">
      <!-- Filters Section -->
      <div class="filters-section">
        <div class="filter-row">
          <div class="filter-group">
            <label>Search</label>
            <input
              bind:value={searchFilter}
              placeholder="Search by name, description, or ID..."
            />
          </div>

          <div class="filter-group">
            <label>Status</label>
            <select bind:value={statusFilter}>
              <option value="">All Status</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Type</label>
            <select bind:value={typeFilter}>
              <option value="">All Types</option>
              {#each uniqueTypes as type}
                <option value={type}>{getPolicyTypeLabel(type)}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="policy-controls">
          <button class="btn primary" on:click={createNewPolicy}>
            + Create New Policy
          </button>
          <button class="btn secondary" on:click={loadPolicies}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Policy Table -->
      <div class="data-table">
        {#if loading}
          <div class="loading-state">
            <div class="spinner large">⚪</div>
            <p>Loading policies...</p>
          </div>
        {:else if paginatedPolicies.length === 0}
          <div class="empty-state">
            <div class="empty-icon">🛡️</div>
            <h3>No Policies Found</h3>
            <p>
              {filteredPolicies.length === 0 ? 'No policies match your current filters.' : 'Create your first policy to start governing your data.'}
            </p>
            <button class="btn primary" on:click={createNewPolicy}>
              Create Your First Policy
            </button>
          </div>
        {:else}
          <table>
            <thead>
              <tr>
                <th>Policy Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Rules</th>
                <th>Created</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each paginatedPolicies as policy}
                <tr class="data-row" on:click={() => goToPolicyDetail(policy.policyId)}>
                  <td>
                    <div class="policy-name-cell">
                      <a href="/policy/{encodeURIComponent(policy.policyId)}" class="policy-name">
                        {policy.name}
                      </a>
                      <p class="policy-description">{policy.description}</p>
                      <p class="policy-id">ID: <code>{policy.policyId}</code></p>
                    </div>
                  </td>
                  <td>
                    <span class="type-badge">{getPolicyTypeLabel(policy.type)}</span>
                  </td>
                  <td>
                    <span class="status {getStatusColor(policy.enabled)}">
                      {policy.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </td>
                  <td>
                    <span class="rules-count">{policy.rulesCount || Object.keys(policy.policy || {}).length} rules</span>
                  </td>
                  <td>{formatDate(policy.createdAt)}</td>
                  <td>{formatDate(policy.updatedAt)}</td>
                  <td>
                    <div class="action-buttons" on:click|stopPropagation>
                      <button
                        class="btn-toggle {policy.enabled ? 'enabled' : 'disabled'}"
                        on:click={() => togglePolicy(policy)}
                        title={policy.enabled ? 'Disable policy' : 'Enable policy'}
                      >
                        {policy.enabled ? '⏸️' : '▶️'}
                      </button>
                      <button
                        class="btn-details"
                        on:click={() => goToPolicyDetail(policy.policyId)}
                        title="View details"
                      >
                        🔍
                      </button>
                    </div>
                  </td>
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
</div>

<style>
  .policy-explorer {
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
    align-items: center;
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid #30363d;
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

  .policy-name-cell {
    max-width: 300px;
  }

  .policy-name {
    color: #58a6ff;
    text-decoration: none;
    font-weight: 600;
    display: block;
    margin-bottom: 4px;
  }

  .policy-name:hover {
    text-decoration: underline;
  }

  .policy-description {
    color: #8b949e;
    font-size: 13px;
    margin-bottom: 4px;
    line-height: 1.3;
  }

  .policy-id {
    font-size: 11px;
    color: #6e7681;
  }

  .policy-id code {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  }

  .type-badge {
    background: rgba(88, 166, 255, 0.2);
    color: #58a6ff;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
  }

  .status {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
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

  .rules-count {
    color: #8b949e;
    font-size: 13px;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .btn-toggle, .btn-details {
    background: none;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .btn-toggle.enabled {
    background: rgba(218, 54, 51, 0.1);
    border-color: #da3633;
    color: #da3633;
  }

  .btn-toggle.disabled {
    background: rgba(46, 160, 67, 0.1);
    border-color: #2ea043;
    color: #2ea043;
  }

  .btn-details {
    background: rgba(88, 166, 255, 0.1);
    border-color: #58a6ff;
    color: #58a6ff;
  }

  .btn-toggle:hover, .btn-details:hover {
    background: rgba(255, 255, 255, 0.1);
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
    text-decoration: none;
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


  @media (max-width: 768px) {
    .filter-row {
      grid-template-columns: 1fr;
    }

    .policy-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .data-table {
      overflow-x: auto;
    }


    .action-buttons {
      flex-direction: column;
      gap: 4px;
    }
  }
</style>