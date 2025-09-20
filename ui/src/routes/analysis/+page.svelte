<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import LineageVisualization from '$lib/components/LineageVisualization.svelte';

  let versionId = '';
  let loading = false;
  let error = null;
  let showVisualization = false;

  onMount(() => {
    // Check if we have an ID parameter from URL
    const urlId = $page.url.searchParams.get('id');
    if (urlId) {
      versionId = urlId;
      showVisualization = true;
    }
  });

  function handleSubmit(event) {
    event.preventDefault();
    if (versionId.trim()) {
      showVisualization = true;
      error = null;

      // Update URL without page reload
      const url = new URL(window.location);
      url.searchParams.set('id', versionId.trim());
      window.history.pushState({}, '', url);
    }
  }

  function clearVisualization() {
    showVisualization = false;
    versionId = '';
    error = null;

    // Clear URL parameter
    const url = new URL(window.location);
    url.searchParams.delete('id');
    window.history.pushState({}, '', url);
  }

  function handleVisualizationError(event) {
    error = event.detail.message;
    loading = false;
  }

  function handleVisualizationLoad() {
    loading = false;
  }
</script>

<svelte:head>
  <title>Analysis - Gitdata</title>
</svelte:head>

<div class="explorer">
  <div class="page-header">
    <h1>📊 Analysis</h1>
    <p class="subtitle">Visualize data lineage and dependencies using OpenLineage standard</p>
  </div>

  <!-- Input Section -->
  <div class="bg-white border border-gray-200 rounded-lg p-6 mb-8">
    <h2 class="text-xl font-semibold mb-4">Data Lineage Visualization</h2>
    <p class="text-gray-600 mb-4">
      Enter a version ID, transaction ID, or content hash from the catalog to visualize its data lineage using OpenLineage standard.
    </p>

    <form on:submit={handleSubmit} class="space-y-4">
      <div class="flex gap-4">
        <div class="flex-1">
          <label for="version-id" class="block text-sm font-medium text-gray-700 mb-2">
            Asset ID / Version ID
          </label>
          <input
            id="version-id"
            type="text"
            bind:value={versionId}
            placeholder="Enter versionId, txid, or contentHash..."
            required
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="flex items-end">
          <button
            type="submit"
            class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md transition-colors"
          >
            Visualize
          </button>
        </div>
      </div>
    </form>

    {#if showVisualization}
      <div class="mt-4 flex justify-between items-center">
        <div class="text-sm text-gray-600">
          <strong>Analyzing:</strong> {versionId}
        </div>
        <button
          on:click={clearVisualization}
          class="text-red-500 hover:text-red-600 text-sm underline"
        >
          Clear Visualization
        </button>
      </div>
    {/if}
  </div>

  <!-- Error Display -->
  {#if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">
            Visualization Error
          </h3>
          <div class="mt-2 text-sm text-red-700">
            {error}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Loading State -->
  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <span class="ml-3 text-gray-600">Loading lineage data...</span>
    </div>
  {/if}

  <!-- Visualization Section -->
  {#if showVisualization}
    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div class="p-4 border-b border-gray-200 bg-gray-50">
        <h3 class="text-lg font-semibold text-gray-900">Data Lineage Graph</h3>
        <p class="text-sm text-gray-600 mt-1">
          Interactive visualization showing data flow and dependencies. Click nodes for details.
        </p>
      </div>

      <div class="p-6">
        <LineageVisualization
          {versionId}
          on:error={handleVisualizationError}
          on:load={handleVisualizationLoad}
        />
      </div>
    </div>
  {:else if !loading && !error}
    <!-- Empty State -->
    <div class="text-center py-12">
      <div class="mx-auto h-24 w-24 text-gray-400">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h3 class="mt-4 text-lg font-medium text-gray-900">No Visualization</h3>
      <p class="mt-2 text-gray-500">
        Enter an asset ID above to visualize its data lineage and dependencies.
      </p>
      <div class="mt-6">
        <a
          href="/catalog"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
        >
          Browse Catalog for Asset IDs
        </a>
      </div>
    </div>
  {/if}

  <!-- Help Section -->
  <div class="help-section">
    <h3>How to Use</h3>
    <div class="help-content">
      <p><strong>1. Get Asset IDs:</strong> Visit the <a href="/catalog">Catalog</a> to browse available data and AI assets and copy their version IDs.</p>
      <p><strong>2. Enter ID:</strong> Paste the version ID, transaction ID, or content hash in the input field above.</p>
      <p><strong>3. Visualize:</strong> Click "Visualize" to generate an interactive lineage graph showing data flow and dependencies.</p>
      <p><strong>4. Interact:</strong> Click on nodes in the graph to view detailed information about datasets, jobs, and transformations.</p>
    </div>
  </div>
</div>

<style>
  .subtitle {
    color: #8b949e;
    font-size: 16px;
    margin-bottom: 32px;
    font-family: system-ui, sans-serif;
  }

  .help-section {
    background: #1f6feb;
    border: 1px solid #388bfd;
    border-radius: 8px;
    padding: 20px;
    margin-top: 32px;
  }

  .help-section h3 {
    color: #ffffff;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .help-content {
    color: #c3d0f0;
  }

  .help-content p {
    margin-bottom: 8px;
    font-size: 14px;
    line-height: 1.5;
  }

  .help-content a {
    color: #ffffff;
    text-decoration: underline;
  }

  /* Global overrides for Tailwind classes */
  :global(.bg-white) { background: #161b22 !important; }
  :global(.border-gray-200) { border-color: #30363d !important; }
  :global(.text-gray-900) { color: #ffffff !important; }
  :global(.text-gray-600) { color: #8b949e !important; }
  :global(.text-gray-500) { color: #6e7681 !important; }
  :global(.text-gray-700) { color: #f0f6fc !important; }
  :global(.bg-gray-50) { background: #21262d !important; }
  :global(.border-gray-300) { border-color: #30363d !important; }
  :global(.bg-blue-500) { background: #1f6feb !important; }
  :global(.bg-blue-100) { background: #0d1117 !important; }
  :global(.text-blue-700) { color: #58a6ff !important; }
  :global(.bg-red-50) { background: #161b22 !important; }
  :global(.border-red-200) { border-color: #da3633 !important; }
  :global(.text-red-800) { color: #f85149 !important; }
  :global(.text-red-700) { color: #f85149 !important; }
  :global(.focus\\:ring-2) { box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1) !important; }
  :global(.focus\\:ring-blue-500) { border-color: #58a6ff !important; }
</style>