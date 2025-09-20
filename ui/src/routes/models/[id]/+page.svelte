<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let model = null;
  let lineage = [];
  let loading = true;
  let error = null;
  let readyStatus = null;
  let loadingReady = false;

  $: modelId = $page.params.id;

  onMount(() => {
    if (modelId) {
      loadModel();
    }
  });

  async function loadModel() {
    if (!browser) return;

    loading = true;
    error = null;

    try {
      // Load model details
      const modelResponse = await fetch(`/api/models/${encodeURIComponent(modelId)}`);
      if (modelResponse.ok) {
        model = await modelResponse.json();
      } else {
        error = `Failed to load model: ${modelResponse.statusText}`;
        return;
      }

      // Load lineage from database
      try {
        const lineageResponse = await fetch(`/api/models/${encodeURIComponent(modelId)}/lineage`);
        if (lineageResponse.ok) {
          lineage = await lineageResponse.json();
        } else {
          console.warn(`Lineage request failed: ${lineageResponse.status} ${lineageResponse.statusText}`);
        }
      } catch (e) {
        console.warn('Failed to load lineage:', e);
        lineage = []; // Reset to empty array on error
      }

    } catch (e) {
      error = `Error loading model: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  async function checkReady() {
    if (!browser || !model) return;

    loadingReady = true;
    try {
      const response = await fetch(`/api/models/${encodeURIComponent(modelId)}/ready`);
      readyStatus = await response.json();
    } catch (e) {
      readyStatus = { error: e.message };
    } finally {
      loadingReady = false;
    }
  }

  async function refreshLineage() {
    if (!browser || !modelId) return;

    try {
      const lineageResponse = await fetch(`/api/models/${encodeURIComponent(modelId)}/lineage`);
      if (lineageResponse.ok) {
        lineage = await lineageResponse.json();
      } else {
        console.error(`Failed to refresh lineage: ${lineageResponse.status} ${lineageResponse.statusText}`);
      }
    } catch (e) {
      console.error('Error refreshing lineage:', e);
    }
  }

  function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
  }

  function formatSize(bytes) {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  function formatTags(tagsJson) {
    if (!tagsJson) return [];
    try {
      return JSON.parse(tagsJson);
    } catch {
      return [];
    }
  }
</script>

<div class="model-detail">
  <div class="nav">
    <a href="/models">← Back to Models</a>
  </div>

  {#if loading}
    <div class="loading">Loading model details...</div>
  {:else if error}
    <div class="error">
      <h2>Error</h2>
      <p>{error}</p>
    </div>
  {:else if model}
    <div class="model-info">
      <div class="model-header">
        <h1>{model.model_version_id}</h1>
        <div class="actions">
          <button on:click={checkReady} disabled={loadingReady}>
            {loadingReady ? 'Checking...' : 'Check Ready Status'}
          </button>
        </div>
      </div>

      <div class="details-grid">
        <div class="detail-section">
          <h2>Model Information</h2>
          <div class="detail-table">
            <div class="detail-row">
              <span class="label">Model Hash:</span>
              <span class="value hash">{model.model_hash}</span>
            </div>
            <div class="detail-row">
              <span class="label">Framework:</span>
              <span class="value">{model.framework || 'Unknown'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Size:</span>
              <span class="value">{formatSize(model.size_bytes)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Created:</span>
              <span class="value">{formatDate(model.created_at)}</span>
            </div>
            {#if model.training_index_version_id}
              <div class="detail-row">
                <span class="label">Training Index:</span>
                <span class="value">
                  <a href="/explorer/version/{encodeURIComponent(model.training_index_version_id)}" class="link">
                    {model.training_index_version_id}
                  </a>
                </span>
              </div>
            {/if}
            {#if formatTags(model.tags_json).length > 0}
              <div class="detail-row">
                <span class="label">Tags:</span>
                <span class="value">
                  <div class="tags">
                    {#each formatTags(model.tags_json) as tag}
                      <span class="tag">{tag}</span>
                    {/each}
                  </div>
                </span>
              </div>
            {/if}
          </div>
        </div>

        {#if readyStatus}
          <div class="detail-section">
            <h2>Ready Status</h2>
            <div class="ready-status">
              {#if readyStatus.error}
                <div class="status error">❌ Error: {readyStatus.error}</div>
              {:else}
                <div class="status success">✅ Ready</div>
                {#if readyStatus.versionId}
                  <div class="detail-row">
                    <span class="label">Version ID:</span>
                    <span class="value">{readyStatus.versionId}</span>
                  </div>
                {/if}
                {#if readyStatus.txid}
                  <div class="detail-row">
                    <span class="label">Transaction:</span>
                    <span class="value">
                      <a href="https://whatsonchain.com/tx/{readyStatus.txid}" target="_blank" class="link">
                        {readyStatus.txid.substring(0, 16)}...
                      </a>
                    </span>
                  </div>
                {/if}
              {/if}
            </div>
          </div>
        {/if}

        <!-- Lineage Section - Always show -->
        <div class="detail-section lineage-section">
          <div class="lineage-header">
            <div>
              <h2>Model Lineage</h2>
              <p class="section-description">Cryptographic trace of training data and model provenance</p>
            </div>
            <button on:click={refreshLineage} class="refresh-btn">
              🔄 Refresh Lineage
            </button>
          </div>

          {#if lineage && lineage.length > 0}
            <div class="lineage-tree">
              {#each lineage as item, index}
                <div class="lineage-item">
                  <div class="lineage-icon">
                    {#if item.type === 'training-index' || item.type === 'trainingIndex'}
                      📊
                    {:else if item.type === 'model-artifact' || item.type === 'modelArtifact'}
                      🤖
                    {:else if item.type === 'raw-data'}
                      📁
                    {:else if item.type === 'processed-data'}
                      🔄
                    {:else}
                      📄
                    {/if}
                  </div>
                  <div class="lineage-content">
                    <div class="lineage-title">
                      <a href="/explorer/version/{encodeURIComponent(item.versionId)}" class="link">
                        {item.name || item.versionId}
                      </a>
                    </div>
                    <div class="lineage-type">{item.type}</div>
                    {#if item.contentHash}
                      <div class="lineage-hash">{item.contentHash.substring(0, 16)}...</div>
                    {/if}
                    {#if item.description}
                      <div class="lineage-description">{item.description}</div>
                    {/if}
                  </div>
                </div>
                {#if index < lineage.length - 1}
                  <div class="lineage-arrow">↓</div>
                {/if}
              {/each}
            </div>
          {:else}
            <div class="no-lineage">
              <div class="text-6xl mb-4 opacity-50">🔗</div>
              <h3 class="text-lg font-semibold text-white mb-2">No Lineage Data Found</h3>
              <p class="text-white/80 mb-4">
                This model doesn't have lineage information in the database yet.
              </p>
              <button on:click={refreshLineage} class="btn-secondary">
                🔄 Check for Lineage Data
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .model-detail {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  .nav {
    margin-bottom: 24px;
  }

  .nav a {
    color: #58a6ff;
    text-decoration: none;
    font-size: 14px;
  }

  .nav a:hover {
    text-decoration: underline;
  }

  .loading {
    text-align: center;
    padding: 60px;
    color: #8b949e;
    font-size: 16px;
  }

  .error {
    text-align: center;
    padding: 60px;
  }

  .error h2 {
    color: #da3633;
    margin-bottom: 16px;
  }

  .error p {
    color: #8b949e;
  }

  .model-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    padding-bottom: 16px;
    border-bottom: 1px solid #30363d;
  }

  .model-header h1 {
    font-size: 28px;
    font-weight: 300;
    color: #ffffff;
    margin: 0;
  }

  .actions button {
    background: #1f6feb;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }

  .actions button:hover:not(:disabled) {
    background: #1a5cc8;
  }

  .actions button:disabled {
    background: #373e47;
    cursor: not-allowed;
  }

  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }

  .detail-section {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
  }

  .detail-section h2 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 500;
    color: #ffffff;
  }

  .section-description {
    color: #8b949e;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .detail-table {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 8px 0;
    border-bottom: 1px solid #21262d;
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .label {
    font-weight: 500;
    color: #f0f6fc;
    font-size: 14px;
    min-width: 120px;
  }

  .value {
    color: #8b949e;
    font-size: 14px;
    word-break: break-all;
    text-align: right;
    flex: 1;
  }

  .hash {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
    font-size: 12px;
  }

  .link {
    color: #58a6ff;
    text-decoration: none;
  }

  .link:hover {
    text-decoration: underline;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-end;
  }

  .tag {
    background: #21262d;
    color: #58a6ff;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    border: 1px solid #30363d;
  }

  .ready-status {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .status {
    padding: 12px;
    border-radius: 6px;
    font-weight: 500;
  }

  .status.success {
    background: #0d2818;
    color: #2ea043;
    border: 1px solid #2ea043;
  }

  .status.error {
    background: #2d0d0d;
    color: #da3633;
    border: 1px solid #da3633;
  }

  .lineage-section {
    grid-column: 1 / -1;
  }

  .lineage-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
  }

  .refresh-btn {
    background: #1f6feb;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
  }

  .refresh-btn:hover {
    background: #1a5cc8;
  }

  .lineage-tree {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .lineage-item {
    display: flex;
    align-items: center;
    gap: 16px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 16px;
    width: 100%;
    max-width: 500px;
  }

  .lineage-icon {
    font-size: 24px;
  }

  .lineage-content {
    flex: 1;
  }

  .lineage-title {
    font-weight: 500;
    margin-bottom: 4px;
  }

  .lineage-type {
    color: #8b949e;
    font-size: 14px;
    margin-bottom: 4px;
  }

  .lineage-hash {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
    font-size: 12px;
    color: #6e7681;
  }

  .lineage-description {
    color: #8b949e;
    font-size: 12px;
    margin-top: 4px;
    font-style: italic;
  }

  .lineage-arrow {
    color: #6e7681;
    font-size: 20px;
  }

  .no-lineage {
    text-align: center;
    padding: 40px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
  }

  .btn-secondary {
    background: #373e47;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }

  .btn-secondary:hover {
    background: #424a53;
  }

  @media (max-width: 768px) {
    .details-grid {
      grid-template-columns: 1fr;
      gap: 24px;
    }

    .model-header {
      flex-direction: column;
      gap: 16px;
      align-items: stretch;
    }

    .detail-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .value {
      text-align: left;
    }

    .tags {
      justify-content: flex-start;
    }

    .lineage-item {
      flex-direction: column;
      text-align: center;
      gap: 12px;
    }
  }
</style>