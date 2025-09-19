<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  export let isLoggedIn = false;

  let datasets = [];
  let loading = false;
  let error = '';
  let searchQuery = '';
  let selectedDataset = null;
  let checkingReady = {};

  onMount(() => {
    loadDatasets();
  });

  async function loadDatasets() {
    try {
      loading = true;
      error = '';
      const result = await api.searchListings(searchQuery, 20, 0);
      datasets = result.items || [];
    } catch (e) {
      error = e.message;
      datasets = [];
    } finally {
      loading = false;
    }
  }

  async function checkDataReady(versionId) {
    try {
      checkingReady[versionId] = true;
      checkingReady = { ...checkingReady };

      // Check /ready endpoint (this would be a real API call)
      const response = await fetch(`/ready?versionId=${versionId}`);
      const result = await response.json();

      // Update dataset with ready status
      datasets = datasets.map(d =>
        d.versionId === versionId
          ? { ...d, ready: result.ready, readyReason: result.reason }
          : d
      );
    } catch (e) {
      console.error('Error checking ready status:', e);
    } finally {
      checkingReady[versionId] = false;
      checkingReady = { ...checkingReady };
    }
  }

  async function showDatasetDetail(versionId) {
    try {
      selectedDataset = await api.getListingDetail(versionId);
    } catch (e) {
      error = e.message;
    }
  }

  function closeDetail() {
    selectedDataset = null;
  }

  function handleSearch() {
    loadDatasets();
  }

  function getReadyStatus(dataset) {
    if (dataset.ready === true) return 'trusted';
    if (dataset.ready === false) return 'untrusted';
    return 'unknown';
  }

  function getReadyIcon(dataset) {
    if (dataset.ready === true) return '✅';
    if (dataset.ready === false) return '❌';
    return '❓';
  }

  function subscribeToDataset(dataset) {
    // This would open a subscription/payment flow
    alert(`Subscribe to ${dataset.name || dataset.versionId}?\nThis would integrate with the payment system.`);
  }
</script>

<div class="space-y-6">
  <!-- Search Header -->
  <div class="glass-card p-6">
    <h2 class="text-2xl font-bold text-white mb-4">Data Catalog</h2>
    <p class="text-white/80 mb-6">
      Browse verified datasets with proven lineage. Each dataset shows its trust status and lineage verification.
    </p>

    <form on:submit|preventDefault={handleSearch} class="flex gap-4">
      <div class="flex-1">
        <input
          bind:value={searchQuery}
          placeholder="Search datasets by name, ID, or content type..."
          class="input-field w-full"
        />
      </div>
      <button type="submit" class="btn-primary" disabled={loading}>
        {#if loading}
          <span class="animate-spin mr-2">⚪</span>
          Searching...
        {:else}
          🔍 Search
        {/if}
      </button>
    </form>
  </div>

  <!-- Error Display -->
  {#if error}
    <div class="glass-card p-4 border-red-400 bg-red-500/20">
      <p class="text-red-200 font-medium">❌ {error}</p>
    </div>
  {/if}

  <!-- Dataset Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {#if loading && datasets.length === 0}
      <div class="col-span-full glass-card p-8 text-center">
        <div class="animate-spin text-4xl mb-4">⚪</div>
        <p class="text-white/80">Loading datasets...</p>
      </div>
    {:else if datasets.length === 0}
      <div class="col-span-full glass-card p-8 text-center">
        <div class="text-6xl mb-4 opacity-50">📊</div>
        <h3 class="text-xl font-semibold text-white mb-2">No Datasets Found</h3>
        <p class="text-white/80">Try adjusting your search or browse all available data.</p>
      </div>
    {:else}
      {#each datasets as dataset}
        <div class="glass-card p-6 card-hover">
          <!-- Trust Status Badge -->
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-2">
              <span class="text-2xl">{getReadyIcon(dataset)}</span>
              <span class="text-sm font-semibold text-white/80">
                {#if dataset.ready === true}
                  TRUSTED
                {:else if dataset.ready === false}
                  VERIFICATION FAILED
                {:else}
                  NOT VERIFIED
                {/if}
              </span>
            </div>

            <button
              on:click={() => checkDataReady(dataset.versionId)}
              disabled={checkingReady[dataset.versionId]}
              class="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full transition-colors"
            >
              {#if checkingReady[dataset.versionId]}
                <span class="animate-spin">⚪</span>
              {:else}
                Verify
              {/if}
            </button>
          </div>

          <!-- Dataset Info -->
          <h3 class="text-lg font-semibold text-white mb-2">
            {dataset.name || 'Untitled Dataset'}
          </h3>

          <div class="space-y-2 text-sm text-white/70 mb-4">
            <div>
              <span class="font-medium">ID:</span>
              <code class="bg-white/20 px-2 py-1 rounded text-xs ml-1 break-all">
                {dataset.versionId}
              </code>
            </div>

            {#if dataset.datasetId}
              <div>
                <span class="font-medium">Dataset:</span>
                <span class="ml-1">{dataset.datasetId}</span>
              </div>
            {/if}

            {#if dataset.updatedAt}
              <div>
                <span class="font-medium">Updated:</span>
                <span class="ml-1">{new Date(dataset.updatedAt).toLocaleDateString()}</span>
              </div>
            {/if}

            {#if dataset.readyReason}
              <div class="mt-2 p-2 bg-white/10 rounded text-xs">
                <span class="font-medium">Status:</span>
                <span class="ml-1">{dataset.readyReason}</span>
              </div>
            {/if}
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <button
              on:click={() => showDatasetDetail(dataset.versionId)}
              class="flex-1 bg-white/20 hover:bg-white/30 text-white text-sm py-2 px-3 rounded-lg transition-colors"
            >
              View Details
            </button>

            {#if isLoggedIn}
              <button
                on:click={() => subscribeToDataset(dataset)}
                class="flex-1 btn-primary text-sm py-2 px-3"
                disabled={dataset.ready === false}
              >
                {dataset.ready === false ? 'Untrusted' : 'Subscribe'}
              </button>
            {:else}
              <button
                class="flex-1 bg-secondary-500/80 hover:bg-secondary-500 text-white text-sm py-2 px-3 rounded-lg transition-colors"
                on:click={() => alert('Please sign in to subscribe to datasets')}
              >
                Sign in to Subscribe
              </button>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Load More -->
  {#if datasets.length > 0}
    <div class="text-center">
      <button
        on:click={loadDatasets}
        class="btn-secondary"
        disabled={loading}
      >
        {#if loading}
          <span class="animate-spin mr-2">⚪</span>
          Loading...
        {:else}
          Load More Datasets
        {/if}
      </button>
    </div>
  {/if}
</div>

<!-- Dataset Detail Modal -->
{#if selectedDataset}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    on:click={closeDetail}
    on:keydown={(e) => e.key === 'Escape' && closeDetail()}
    role="button"
    tabindex="0"
  >
    <div
      class="glass-card p-6 max-w-4xl w-full max-h-96 overflow-y-auto"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      tabindex="0"
    >
      <div class="flex justify-between items-start mb-6">
        <div>
          <h3 class="text-2xl font-bold text-white mb-2">Dataset Details</h3>
          <div class="flex items-center gap-2">
            <span class="text-xl">{getReadyIcon(selectedDataset)}</span>
            <span class="text-sm font-semibold text-white/80">
              Lineage Verification Status
            </span>
          </div>
        </div>
        <button
          on:click={closeDetail}
          class="text-white/60 hover:text-white text-2xl"
        >
          ×
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Dataset Information -->
        <div class="space-y-4">
          <h4 class="text-lg font-semibold text-white">Dataset Information</h4>
          <div class="space-y-3 text-white/90 text-sm">
            <div>
              <span class="font-semibold text-white">Version ID:</span>
              <code class="bg-white/20 px-2 py-1 rounded text-xs ml-2 break-all">
                {selectedDataset.versionId}
              </code>
            </div>
            {#if selectedDataset.manifest.name}
              <div>
                <span class="font-semibold text-white">Name:</span>
                <span class="ml-2">{selectedDataset.manifest.name}</span>
              </div>
            {/if}
            {#if selectedDataset.manifest.description}
              <div>
                <span class="font-semibold text-white">Description:</span>
                <p class="ml-2 mt-1">{selectedDataset.manifest.description}</p>
              </div>
            {/if}
            {#if selectedDataset.manifest.contentHash}
              <div>
                <span class="font-semibold text-white">Content Hash:</span>
                <code class="bg-white/20 px-2 py-1 rounded text-xs ml-2 break-all">
                  {selectedDataset.manifest.contentHash}
                </code>
              </div>
            {/if}
          </div>
        </div>

        <!-- Lineage Information -->
        <div class="space-y-4">
          <h4 class="text-lg font-semibold text-white">Lineage & Trust</h4>
          <div class="space-y-3 text-white/90 text-sm">
            {#if selectedDataset.manifest.license}
              <div>
                <span class="font-semibold text-white">License:</span>
                <span class="ml-2">{selectedDataset.manifest.license}</span>
              </div>
            {/if}
            {#if selectedDataset.manifest.classification}
              <div>
                <span class="font-semibold text-white">Classification:</span>
                <span class="ml-2">{selectedDataset.manifest.classification}</span>
              </div>
            {/if}
            {#if selectedDataset.manifest.createdAt}
              <div>
                <span class="font-semibold text-white">Created:</span>
                <span class="ml-2">{new Date(selectedDataset.manifest.createdAt).toLocaleString()}</span>
              </div>
            {/if}

            <!-- Verification Actions -->
            <div class="mt-4 p-4 bg-white/10 rounded-lg">
              <h5 class="font-semibold text-white mb-2">Verification Actions</h5>
              <div class="space-y-2">
                <button
                  on:click={() => checkDataReady(selectedDataset.versionId)}
                  class="w-full btn-primary text-sm py-2"
                >
                  🔍 Check Trust Status
                </button>
                <button
                  class="w-full bg-white/20 hover:bg-white/30 text-white text-sm py-2 px-3 rounded-lg transition-colors"
                >
                  📋 View Lineage Chain
                </button>
                <button
                  class="w-full bg-white/20 hover:bg-white/30 text-white text-sm py-2 px-3 rounded-lg transition-colors"
                >
                  🔒 Verify SPV Proof
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {#if isLoggedIn}
        <div class="mt-6 pt-4 border-t border-white/20">
          <button
            on:click={() => subscribeToDataset(selectedDataset)}
            class="btn-primary px-8 py-3"
          >
            💳 Subscribe to This Dataset
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}