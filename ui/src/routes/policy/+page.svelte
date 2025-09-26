<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    // Redirect to the settings policy tab
    goto('/settings?tab=policy');
  });

</script>

<svelte:head>
  <title>Policy Management - Gitdata</title>
</svelte:head>

<div class="policy-page">
  <div class="page-header">
    <h1>Policy Management</h1>
    <p>Create and manage data governance policies</p>
  </div>

  <div class="content">
    <!-- Controls -->
    <div class="controls">
      <div class="filters">
        <input
          bind:value={searchFilter}
          placeholder="Search policies..."
          class="search-input"
        />

        <select bind:value={statusFilter} class="filter-select">
          <option value="">All Status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>

        <select bind:value={typeFilter} class="filter-select">
          <option value="">All Types</option>
          {#each uniqueTypes as type}
            <option value={type}>{getPolicyTypeLabel(type)}</option>
          {/each}
        </select>
      </div>

      <div class="actions">
        <button
          class="btn primary"
          on:click={() => showCreateForm = !showCreateForm}
        >
          {showCreateForm ? 'Cancel' : 'New Policy'}
        </button>
        <button class="btn secondary" on:click={loadPolicies}>
          Refresh
        </button>
      </div>
    </div>

    <!-- Create Form -->
    {#if showCreateForm}
      <div class="create-form">
        <h3>Create New Policy</h3>
        <form on:submit|preventDefault={createPolicy}>
          <div class="form-row">
            <input
              bind:value={newPolicy.name}
              placeholder="Policy name"
              required
              class="form-input"
            />
            <select bind:value={newPolicy.type} class="form-input">
              <option value="access_control">Access Control</option>
              <option value="privacy">Privacy</option>
              <option value="compliance">Compliance</option>
              <option value="mlops">MLOps</option>
            </select>
          </div>
          <textarea
            bind:value={newPolicy.description}
            placeholder="Policy description"
            required
            class="form-input"
            rows="2"
          ></textarea>
          <div class="form-actions">
            <label class="checkbox">
              <input type="checkbox" bind:checked={newPolicy.enabled} />
              Enable immediately
            </label>
            <button type="submit" class="btn primary" disabled={!newPolicy.name || !newPolicy.description}>
              Create Policy
            </button>
          </div>
        </form>
      </div>
    {/if}

    <!-- Policy List -->
    {#if loading}
      <div class="loading">Loading policies...</div>
    {:else if filteredPolicies.length === 0}
      <div class="empty">
        <p>No policies found</p>
        <button class="btn primary" on:click={() => showCreateForm = true}>
          Create your first policy
        </button>
      </div>
    {:else}
      <div class="policy-list">
        {#each filteredPolicies as policy}
          <div class="policy-card">
            <div class="policy-info">
              <div class="policy-header">
                <h4>{policy.name}</h4>
                <div class="policy-meta">
                  <span class="policy-type">{getPolicyTypeLabel(policy.type)}</span>
                  <span class="policy-id">{policy.policyId}</span>
                </div>
              </div>
              <p class="policy-description">{policy.description}</p>
              <div class="policy-details">
                <span>{policy.rulesCount} rules</span>
                <span>Created {formatDate(policy.createdAt)}</span>
                <span>Updated {formatDate(policy.updatedAt)}</span>
              </div>
            </div>
            <div class="policy-actions">
              <button
                class="toggle-btn {policy.enabled ? 'enabled' : 'disabled'}"
                on:click={() => togglePolicy(policy)}
                title={policy.enabled ? 'Disable policy' : 'Enable policy'}
              >
                {policy.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .policy-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  .page-header h1 {
    font-size: 2rem;
    color: #f0f6fc;
    margin-bottom: 0.5rem;
  }

  .page-header p {
    color: #8b949e;
    font-size: 1.1rem;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
  }

  .filters {
    display: flex;
    gap: 1rem;
    flex: 1;
  }

  .search-input, .filter-select {
    padding: 0.5rem 0.75rem;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 0.9rem;
  }

  .search-input {
    flex: 1;
    max-width: 300px;
  }

  .filter-select {
    min-width: 120px;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn.primary {
    background: #238636;
    color: white;
  }

  .btn.primary:hover:not(:disabled) {
    background: #2ea043;
  }

  .btn.primary:disabled {
    background: #484f58;
    color: #656d76;
    cursor: not-allowed;
  }

  .btn.secondary {
    background: #21262d;
    color: #f0f6fc;
    border: 1px solid #30363d;
  }

  .btn.secondary:hover {
    background: #30363d;
  }

  .create-form {
    padding: 1.5rem;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
  }

  .create-form h3 {
    color: #f0f6fc;
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .form-input {
    padding: 0.5rem 0.75rem;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 0.9rem;
    font-family: inherit;
  }

  .form-input:focus {
    outline: none;
    border-color: #58a6ff;
  }

  .form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
  }

  .checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #f0f6fc;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .loading, .empty {
    text-align: center;
    padding: 3rem;
    color: #8b949e;
  }

  .empty button {
    margin-top: 1rem;
  }

  .policy-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .policy-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    transition: border-color 0.2s;
  }

  .policy-card:hover {
    border-color: #58a6ff;
  }

  .policy-info {
    flex: 1;
  }

  .policy-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .policy-header h4 {
    color: #f0f6fc;
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
  }

  .policy-meta {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .policy-type {
    background: rgba(88, 166, 255, 0.2);
    color: #58a6ff;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .policy-id {
    color: #656d76;
    font-size: 0.8rem;
    font-family: monospace;
  }

  .policy-description {
    color: #8b949e;
    font-size: 0.9rem;
    margin: 0.5rem 0;
    line-height: 1.4;
  }

  .policy-details {
    display: flex;
    gap: 1rem;
    color: #656d76;
    font-size: 0.8rem;
  }

  .policy-actions {
    margin-left: 1rem;
  }

  .toggle-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 50px;
  }

  .toggle-btn.enabled {
    background: #238636;
    color: white;
  }

  .toggle-btn.enabled:hover {
    background: #2ea043;
  }

  .toggle-btn.disabled {
    background: #656d76;
    color: white;
  }

  .toggle-btn.disabled:hover {
    background: #8b949e;
  }

  @media (max-width: 768px) {
    .policy-page {
      padding: 1rem;
    }

    .controls {
      flex-direction: column;
      align-items: stretch;
    }

    .filters {
      flex-direction: column;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .policy-card {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .policy-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .policy-actions {
      margin-left: 0;
      align-self: flex-end;
    }
  }
</style>