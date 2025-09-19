<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let models = [];
  let filteredModels = [];
  let currentPage = 0;
  let pageSize = 20;
  let searchFilter = '';
  let frameworkFilter = '';
  let loading = false;
  let showConnectForm = false;

  // Model connection form
  let modelHash = '';
  let framework = '';
  let sizeBytes = '';
  let tags = '';
  let trainingIndex = '';
  let anchorMode = 'synthetic'; // 'synthetic' or 'advanced'
  let connectLoading = false;
  let connectResult = null;

  onMount(() => {
    loadModels();
  });

  async function loadModels() {
    if (!browser) return;

    loading = true;
    try {
      const response = await fetch('/api/models/search');
      if (response.ok) {
        const data = await response.json();
        models = data.items || [];
      } else {
        console.error('Failed to load models:', response.statusText);
        models = [];
      }
      applyFilters();
    } catch (error) {
      console.error('Failed to load models:', error);
      models = [];
    } finally {
      loading = false;
    }
  }

  function applyFilters() {
    filteredModels = models.filter(model => {
      return (
        (!searchFilter || model.model_version_id.toLowerCase().includes(searchFilter.toLowerCase()) ||
         model.model_hash.toLowerCase().includes(searchFilter.toLowerCase())) &&
        (!frameworkFilter || model.framework === frameworkFilter)
      );
    });
  }

  function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  function formatSize(bytes) {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  function nextPage() {
    if ((currentPage + 1) * pageSize < filteredModels.length) {
      currentPage++;
    }
  }

  function prevPage() {
    if (currentPage > 0) {
      currentPage--;
    }
  }

  async function connectModel() {
    if (!browser) return;

    connectLoading = true;
    connectResult = null;

    try {
      const payload = {
        modelHash,
        framework: framework || undefined,
        sizeBytes: sizeBytes ? parseInt(sizeBytes, 10) : undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        trainingIndex: trainingIndex || undefined,
        anchorMode
      };

      const response = await fetch('/api/models/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      connectResult = { success: response.ok, data: result };

      if (response.ok) {
        // Reload models list to show the new model
        loadModels();
        // Reset form
        resetConnectForm();
      }
    } catch (error) {
      connectResult = { success: false, error: error.message };
    } finally {
      connectLoading = false;
    }
  }

  function resetConnectForm() {
    modelHash = '';
    framework = '';
    sizeBytes = '';
    tags = '';
    trainingIndex = '';
    anchorMode = 'synthetic';
  }

  $: paginatedModels = filteredModels.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  $: uniqueFrameworks = [...new Set(models.map(m => m.framework).filter(Boolean))];
  $: totalPages = Math.ceil(filteredModels.length / pageSize);

  $: {
    searchFilter, frameworkFilter;
    applyFilters();
    currentPage = 0;
  }
</script>

<div class="models">
  <div class="header">
    <h1>Model Provenance & Lineage</h1>
    <button class="connect-btn" on:click={() => showConnectForm = !showConnectForm}>
      {showConnectForm ? 'Hide Connect Form' : 'Connect New Model'}
    </button>
  </div>

  {#if showConnectForm}
    <div class="connect-form">
      <h2>Connect Model to Blockchain</h2>
      <p>Register your AI model with cryptographic lineage tracking</p>

      <form on:submit|preventDefault={connectModel}>
        <div class="form-grid">
          <div class="form-group">
            <label for="modelHash">Model Hash (SHA256)*</label>
            <input
              id="modelHash"
              bind:value={modelHash}
              placeholder="64-character hex string"
              pattern="[0-9a-fA-F]{64}"
              required
            />
          </div>

          <div class="form-group">
            <label for="framework">Framework</label>
            <input
              id="framework"
              bind:value={framework}
              placeholder="e.g., PyTorch, TensorFlow, etc."
            />
          </div>

          <div class="form-group">
            <label for="sizeBytes">Size (bytes)</label>
            <input
              id="sizeBytes"
              bind:value={sizeBytes}
              type="number"
              placeholder="Model size in bytes"
            />
          </div>

          <div class="form-group">
            <label for="tags">Tags</label>
            <input
              id="tags"
              bind:value={tags}
              placeholder="classification, computer-vision, nlp"
            />
          </div>

          <div class="form-group">
            <label for="trainingIndex">Training Index</label>
            <input
              id="trainingIndex"
              bind:value={trainingIndex}
              placeholder="Optional training data version ID"
            />
          </div>

          <div class="form-group">
            <label for="anchorMode">Anchor Mode*</label>
            <select id="anchorMode" bind:value={anchorMode}>
              <option value="synthetic">Synthetic (Free, immediate)</option>
              <option value="advanced">Advanced (SPV, requires BSV)</option>
            </select>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" disabled={connectLoading || !modelHash}>
            {connectLoading ? 'Connecting...' : 'Connect Model'}
          </button>
          <button type="button" on:click={resetConnectForm}>Reset</button>
        </div>
      </form>

      {#if connectResult}
        <div class="result {connectResult.success ? 'success' : 'error'}">
          {#if connectResult.success}
            <h3>✅ Model Connected Successfully</h3>
            <p><strong>Version ID:</strong> {connectResult.data.modelVersionId}</p>
            <p><strong>Mode:</strong> {connectResult.data.anchorMode}</p>
            {#if connectResult.data.txid}
              <p><strong>Transaction:</strong> {connectResult.data.txid}</p>
            {/if}
          {:else}
            <h3>❌ Connection Failed</h3>
            <p>{connectResult.data?.error || connectResult.error || 'Unknown error'}</p>
            {#if connectResult.data?.hint}
              <p><em>{connectResult.data.hint}</em></p>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <div class="filters">
    <input
      bind:value={searchFilter}
      placeholder="Search by version ID or model hash..."
    />

    <select bind:value={frameworkFilter}>
      <option value="">All Frameworks</option>
      {#each uniqueFrameworks as fw}
        <option value={fw}>{fw}</option>
      {/each}
    </select>
  </div>

  <div class="data-table">
    {#if loading}
      <div style="padding: 20px; text-align: center;">Loading models...</div>
    {:else if filteredModels.length === 0}
      <div style="padding: 20px; text-align: center;">
        {models.length === 0 ? 'No models registered yet.' : 'No models match your filters.'}
      </div>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Version ID</th>
            <th>Model Hash</th>
            <th>Framework</th>
            <th>Size</th>
            <th>Tags</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {#each paginatedModels as model}
            <tr>
              <td>
                <a href="/models/{encodeURIComponent(model.model_version_id)}" class="version-id">
                  {model.model_version_id}
                </a>
              </td>
              <td class="hash">{model.model_hash.substring(0, 16)}...</td>
              <td>{model.framework || 'Unknown'}</td>
              <td>{formatSize(model.size_bytes)}</td>
              <td>
                {#if model.tags_json}
                  {JSON.parse(model.tags_json).join(', ')}
                {:else}
                  -
                {/if}
              </td>
              <td>{formatDate(model.created_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  {#if totalPages > 1}
    <div class="pagination">
      <button on:click={prevPage} disabled={currentPage === 0}>
        Previous
      </button>
      <span>Page {currentPage + 1} of {totalPages}</span>
      <button on:click={nextPage} disabled={currentPage >= totalPages - 1}>
        Next
      </button>
    </div>
  {/if}
</div>

<style>
  .models {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
  }

  .header h1 {
    font-size: 28px;
    font-weight: 300;
    color: #ffffff;
  }

  .connect-btn {
    background: #1f6feb;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }

  .connect-btn:hover {
    background: #1a5cc8;
  }

  .connect-form {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 30px;
  }

  .connect-form h2 {
    margin-bottom: 8px;
    color: #ffffff;
  }

  .connect-form p {
    color: #8b949e;
    margin-bottom: 20px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-group label {
    margin-bottom: 4px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .form-group input,
  .form-group select {
    padding: 8px 12px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .form-group input:focus,
  .form-group select:focus {
    border-color: #1f6feb;
    outline: none;
  }

  .form-actions {
    display: flex;
    gap: 12px;
  }

  .form-actions button {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
  }

  .form-actions button[type="submit"] {
    background: #238636;
    color: white;
    border: none;
  }

  .form-actions button[type="submit"]:hover:not(:disabled) {
    background: #2ea043;
  }

  .form-actions button[type="submit"]:disabled {
    background: #373e47;
    cursor: not-allowed;
  }

  .form-actions button[type="button"] {
    background: #21262d;
    color: #f0f6fc;
    border: 1px solid #30363d;
  }

  .form-actions button[type="button"]:hover {
    background: #30363d;
  }

  .result {
    margin-top: 20px;
    padding: 16px;
    border-radius: 6px;
    border: 1px solid;
  }

  .result.success {
    background: #0d2818;
    border-color: #2ea043;
  }

  .result.error {
    background: #2d0d0d;
    border-color: #da3633;
  }

  .result h3 {
    margin: 0 0 8px 0;
    color: #f0f6fc;
  }

  .result p {
    margin: 4px 0;
    color: #8b949e;
  }

  .filters {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
  }

  .filters input,
  .filters select {
    padding: 8px 12px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .filters input {
    flex: 1;
  }

  .data-table {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #21262d;
  }

  th {
    background: #161b22;
    color: #f0f6fc;
    font-weight: 500;
    font-size: 14px;
  }

  td {
    color: #8b949e;
    font-size: 14px;
  }

  tbody tr:hover {
    background: #161b22;
  }

  .version-id {
    color: #58a6ff;
    text-decoration: none;
  }

  .version-id:hover {
    text-decoration: underline;
  }

  .hash {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
    font-size: 12px;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-top: 20px;
  }

  .pagination button {
    padding: 8px 16px;
    background: #21262d;
    color: #f0f6fc;
    border: 1px solid #30363d;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }

  .pagination button:hover:not(:disabled) {
    background: #30363d;
  }

  .pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination span {
    color: #8b949e;
    font-size: 14px;
  }

  @media (max-width: 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }

    .filters {
      flex-direction: column;
    }

    .header {
      flex-direction: column;
      gap: 16px;
      align-items: stretch;
    }

    table {
      font-size: 12px;
    }

    th,
    td {
      padding: 8px;
    }
  }
</style>