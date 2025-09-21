<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let assets = [];
  let availableAssets = []; // For parent selection
  let loading = true;
  let searchQuery = '';
  let selectedType = 'all'; // 'all', 'data', 'ai'
  let showPublishForm = false;

  // Publishing form data
  let publishData = {
    name: '',
    description: '',
    type: 'data',
    tags: '',
    content: null,
    parents: [] // Array of parent asset IDs for lineage
  };

  onMount(async () => {
    await loadAssets();
  });

  async function loadAssets() {
    try {
      loading = true;
      // Load published assets for display
      assets = [];

      // Load available assets for parent selection from search endpoint
      try {
        const searchResponse = await api.request('/search', {
          method: 'GET'
        });
        availableAssets = searchResponse.results || [];
      } catch (searchError) {
        console.log('Search endpoint not available yet, using empty list for parents');
        availableAssets = [];
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
      assets = [];
      availableAssets = [];
    } finally {
      loading = false;
    }
  }

  function filteredAssets() {
    let filtered = assets;

    if (selectedType !== 'all') {
      filtered = filtered.filter(asset => asset.type === selectedType);
    }

    if (searchQuery) {
      filtered = filtered.filter(asset =>
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (asset.tags && asset.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
      );
    }

    return filtered;
  }

  async function handlePublish() {
    try {
      // Create D01A compliant manifest
      const manifest = {
        datasetId: publishData.name.toLowerCase().replace(/\s+/g, '-'),
        description: publishData.description,
        provenance: {
          createdAt: new Date().toISOString(),
          issuer: '02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899' // Demo issuer
        },
        policy: {
          license: 'cc-by-4.0',
          classification: 'public'
        },
        content: {
          contentHash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''), // Valid 64-char hex hash
          mediaType: publishData.type === 'data' ? 'application/json' : 'application/octet-stream',
          sizeBytes: publishData.content ? publishData.content.size : 1024
        },
        parents: publishData.parents || [],
        tags: publishData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };

      const response = await api.request('/submit/dlm1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ manifest })
      });

      console.log('Published successfully:', response);

      // Reset form
      publishData = { name: '', description: '', type: 'data', tags: '', content: null, parents: [] };
      showPublishForm = false;
      alert('Asset published successfully!');
    } catch (error) {
      console.error('Failed to publish asset:', error);
      alert('Failed to publish asset: ' + (error.message || error));
    }
  }

  function handleFileSelect(event) {
    publishData.content = event.target.files[0];
  }
</script>

<svelte:head>
  <title>Catalog - Gitdata</title>
</svelte:head>

<div class="explorer">
  <div class="page-header">
    <div>
      <h1>📋 Catalog</h1>
      <p class="subtitle">Discover and publish data and AI assets</p>
    </div>
    <button
      on:click={() => showPublishForm = !showPublishForm}
      class="button primary"
    >
      {showPublishForm ? 'Cancel' : '+ Publish Asset'}
    </button>
  </div>

  <!-- Publishing Form -->
  {#if showPublishForm}
    <div class="form-section">
      <h2>Publish New Asset</h2>
      <form on:submit|preventDefault={handlePublish}>
        <div class="form-grid">
          <div class="form-group">
            <label for="name">Name</label>
            <input
              id="name"
              type="text"
              bind:value={publishData.name}
              required
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="type">Type</label>
            <select
              id="type"
              bind:value={publishData.type}
              class="form-input"
            >
              <option value="data">Data</option>
              <option value="ai">AI Model</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="description">Description</label>
          <textarea
            id="description"
            bind:value={publishData.description}
            rows="3"
            class="form-input"
          ></textarea>
        </div>
        <div class="form-group">
          <label for="tags">Tags (comma separated)</label>
          <input
            id="tags"
            type="text"
            bind:value={publishData.tags}
            placeholder="finance, csv, quarterly"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="parents">Parent Assets (for lineage tracking)</label>
          <div class="parent-selection">
            {#if availableAssets.length > 0}
              <div class="parent-options">
                {#each availableAssets as asset}
                  <label class="parent-option">
                    <input
                      type="checkbox"
                      value={asset.version_id}
                      bind:group={publishData.parents}
                      class="parent-checkbox"
                    />
                    <span class="parent-label">
                      <strong>{asset.title || asset.dataset_id || asset.version_id?.slice(0, 8)}</strong>
                      {#if asset.title && asset.dataset_id}
                        <small>({asset.dataset_id})</small>
                      {/if}
                    </span>
                  </label>
                {/each}
              </div>
            {:else}
              <p class="no-parents">No existing assets available for lineage. This will be the first asset.</p>
            {/if}
            {#if publishData.parents.length > 0}
              <div class="selected-parents">
                <strong>Selected parents:</strong>
                {#each publishData.parents as parentId}
                  <span class="selected-parent-tag">
                    {availableAssets.find(a => a.version_id === parentId)?.title ||
                     availableAssets.find(a => a.version_id === parentId)?.dataset_id ||
                     parentId?.slice(0, 8)}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        </div>
        <div class="form-group">
          <label for="content">File (optional)</label>
          <input
            id="content"
            type="file"
            on:change={handleFileSelect}
            class="form-input"
          />
        </div>
        <div class="form-actions">
          <button type="submit" class="button primary">
            Publish
          </button>
          <button
            type="button"
            on:click={() => showPublishForm = false}
            class="button"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Search and Filter -->
  <div class="filters">
    <div class="search-section">
      <input
        type="text"
        placeholder="Search assets..."
        bind:value={searchQuery}
        class="search-input"
      />
    </div>
    <div class="filter-buttons">
      <button
        on:click={() => selectedType = 'all'}
        class="filter-btn {selectedType === 'all' ? 'active' : ''}"
      >
        All
      </button>
      <button
        on:click={() => selectedType = 'data'}
        class="filter-btn {selectedType === 'data' ? 'active' : ''}"
      >
        📊 Data
      </button>
      <button
        on:click={() => selectedType = 'ai'}
        class="filter-btn {selectedType === 'ai' ? 'active' : ''}"
      >
        🤖 AI
      </button>
    </div>
  </div>

  <!-- Assets Grid -->
  {#if loading}
    <div class="loading-state">
      <div class="spinner">⚪</div>
      <span>Loading assets...</span>
    </div>
  {:else if filteredAssets().length === 0}
    <div class="empty-state">
      <p>No assets found</p>
      <p class="empty-hint">Try adjusting your search or publish a new asset</p>
    </div>
  {:else}
    <div class="assets-grid">
      {#each filteredAssets() as asset}
        <div class="asset-card">
          <div class="asset-header">
            <div class="asset-title">
              <span class="asset-icon">{asset.type === 'ai' ? '🤖' : '📊'}</span>
              <h3>{asset.name}</h3>
            </div>
            <span class="asset-type">{asset.type}</span>
          </div>

          <p class="asset-description">{asset.description}</p>

          {#if asset.tags && asset.tags.length > 0}
            <div class="asset-tags">
              {#each asset.tags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}

          <div class="asset-footer">
            <span class="asset-id">ID: {asset.versionId}</span>
            <div class="asset-actions">
              <a href="/analysis?id={asset.versionId}" class="asset-link">
                View Lineage
              </a>
              <a href="/connect?asset={asset.versionId}" class="asset-link primary">
                Connect
              </a>
            </div>
          </div>
        </div>
      {/each}
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

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
  }

  .form-section {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 24px;
  }

  .form-section h2 {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 20px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    color: #f0f6fc;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 6px;
  }

  .form-input,
  .search-input {
    width: 100%;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    padding: 8px 12px;
    font-size: 14px;
    font-family: inherit;
    transition: border-color 0.2s;
  }

  .form-input:focus,
  .search-input:focus {
    outline: none;
    border-color: #58a6ff;
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1);
  }

  .form-input::placeholder,
  .search-input::placeholder {
    color: #6e7681;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }

  .button {
    background: #21262d;
    border: 1px solid #30363d;
    color: #f0f6fc;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
    text-decoration: none;
    display: inline-block;
    transition: all 0.2s;
  }

  .button:hover {
    background: #30363d;
    border-color: #58a6ff;
  }

  .button.primary {
    background: #238636;
    border-color: #238636;
    color: #ffffff;
  }

  .button.primary:hover {
    background: #2ea043;
  }

  .filters {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
  }

  .search-section {
    flex: 1;
    min-width: 250px;
  }

  .filter-buttons {
    display: flex;
    gap: 8px;
  }

  .filter-btn {
    background: #21262d;
    border: 1px solid #30363d;
    color: #f0f6fc;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-btn:hover {
    background: #30363d;
  }

  .filter-btn.active {
    background: #58a6ff;
    border-color: #58a6ff;
    color: #ffffff;
  }

  .loading-state {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 48px 20px;
    color: #8b949e;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .empty-state {
    text-align: center;
    padding: 48px 20px;
    color: #8b949e;
  }

  .empty-state p {
    font-size: 18px;
    margin-bottom: 8px;
  }

  .empty-hint {
    font-size: 14px;
    color: #6e7681;
  }

  .assets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }

  .asset-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    transition: all 0.2s;
  }

  .asset-card:hover {
    border-color: #58a6ff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .asset-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .asset-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .asset-icon {
    font-size: 20px;
  }

  .asset-title h3 {
    color: #ffffff;
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .asset-type {
    background: #21262d;
    color: #8b949e;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .asset-description {
    color: #8b949e;
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .asset-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }

  .tag {
    background: #1f6feb;
    color: #ffffff;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
  }

  .asset-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid #30363d;
  }

  .asset-id {
    color: #6e7681;
    font-size: 12px;
    font-family: 'SF Mono', monospace;
  }

  .asset-actions {
    display: flex;
    gap: 8px;
  }

  .asset-link {
    color: #58a6ff;
    text-decoration: none;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .asset-link:hover {
    background: #21262d;
    text-decoration: underline;
  }

  .asset-link.primary {
    background: #238636;
    color: #ffffff;
  }

  .asset-link.primary:hover {
    background: #2ea043;
    text-decoration: none;
  }

  /* Parent selection styles */
  .parent-selection {
    margin-top: 8px;
  }

  .parent-options {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 12px;
    background: #0d1117;
  }

  .parent-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .parent-option:hover {
    background: #21262d;
  }

  .parent-checkbox {
    margin: 0;
    accent-color: #58a6ff;
  }

  .parent-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .parent-label strong {
    color: #f0f6fc;
    font-size: 14px;
  }

  .parent-label small {
    color: #8b949e;
    font-size: 12px;
  }

  .no-parents {
    color: #8b949e;
    font-size: 14px;
    text-align: center;
    padding: 20px;
    border: 1px solid #30363d;
    border-radius: 6px;
    background: #0d1117;
  }

  .selected-parents {
    margin-top: 12px;
    padding: 12px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
  }

  .selected-parents strong {
    color: #f0f6fc;
    font-size: 14px;
    display: block;
    margin-bottom: 8px;
  }

  .selected-parent-tag {
    display: inline-block;
    background: #1f6feb;
    color: #ffffff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    margin-right: 6px;
    margin-bottom: 4px;
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 16px;
    }

    .filters {
      flex-direction: column;
      align-items: stretch;
    }

    .search-section {
      min-width: auto;
    }

    .filter-buttons {
      justify-content: center;
    }

    .assets-grid {
      grid-template-columns: 1fr;
    }
  }
</style>