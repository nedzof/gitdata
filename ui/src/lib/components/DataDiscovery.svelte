<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let query = '';
  let limit = 10;
  let offset = 0;
  let listings = [];
  let selectedListing = null;
  let loading = false;
  let error = '';

  onMount(() => {
    loadListings();
  });

  async function loadListings() {
    try {
      loading = true;
      error = '';
      const result = await api.searchListings(query, limit, offset);
      listings = result.items || [];
    } catch (e) {
      error = e.message;
      listings = [];
    } finally {
      loading = false;
    }
  }

  async function showListingDetail(versionId) {
    try {
      selectedListing = await api.getListingDetail(versionId);
    } catch (e) {
      error = e.message;
    }
  }

  function closeDetail() {
    selectedListing = null;
  }

  function handleSearch(event) {
    event.preventDefault();
    offset = 0;
    loadListings();
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="glass-card p-6">
    <h2 class="text-2xl font-bold text-white mb-2">Data Discovery</h2>
    <p class="text-white/80">
      Search and discover data assets published on the BSV blockchain. Browse datasets, manifests, and digital content with built-in verification.
    </p>
  </div>

  <!-- Search Form -->
  <div class="glass-card p-6">
    <form on:submit={handleSearch} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="md:col-span-2">
          <label class="block text-white font-semibold mb-2">Search Query</label>
          <input
            bind:value={query}
            placeholder="Enter keywords, dataset ID, or content hash..."
            class="input-field w-full"
          />
        </div>
        <div>
          <label class="block text-white font-semibold mb-2">Results Limit</label>
          <input
            bind:value={limit}
            type="number"
            min="1"
            max="100"
            class="input-field w-full"
          />
        </div>
      </div>

      <button type="submit" class="btn-primary" disabled={loading}>
        {#if loading}
          <span class="animate-spin mr-2">⚪</span>
          Searching...
        {:else}
          🔍 Search Data
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

  <!-- Results -->
  <div class="space-y-4">
    {#if loading}
      <div class="glass-card p-8 text-center">
        <div class="animate-spin text-4xl mb-4">⚪</div>
        <p class="text-white/80">Searching for data...</p>
      </div>
    {:else if listings.length === 0}
      <div class="glass-card p-8 text-center">
        <div class="text-6xl mb-4 opacity-50">📊</div>
        <h3 class="text-xl font-semibold text-white mb-2">No Data Found</h3>
        <p class="text-white/80">Try adjusting your search criteria or browse all available data.</p>
      </div>
    {:else}
      {#each listings as listing}
        <div
          class="glass-card p-6 card-hover cursor-pointer"
          on:click={() => showListingDetail(listing.versionId)}
          on:keydown={(e) => e.key === 'Enter' && showListingDetail(listing.versionId)}
          role="button"
          tabindex="0"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-white mb-2">
                {listing.name || 'Untitled Dataset'}
              </h3>
              <div class="space-y-1">
                <p class="text-white/70 text-sm">
                  <span class="font-medium">ID:</span>
                  <code class="bg-white/20 px-2 py-1 rounded text-xs ml-1">{listing.versionId}</code>
                </p>
                {#if listing.datasetId}
                  <p class="text-white/70 text-sm">
                    <span class="font-medium">Dataset:</span> {listing.datasetId}
                  </p>
                {/if}
                {#if listing.updatedAt}
                  <p class="text-white/70 text-sm">
                    <span class="font-medium">Updated:</span> {listing.updatedAt}
                  </p>
                {/if}
              </div>
            </div>
            <div class="text-white/50 text-xl">→</div>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Pagination -->
  {#if listings.length > 0}
    <div class="flex justify-between items-center">
      <button
        on:click={() => { offset = Math.max(0, offset - limit); loadListings(); }}
        disabled={offset === 0 || loading}
        class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ← Previous
      </button>
      <span class="text-white/80">
        Showing {offset + 1} - {offset + listings.length}
      </span>
      <button
        on:click={() => { offset += limit; loadListings(); }}
        disabled={listings.length < limit || loading}
        class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  {/if}
</div>

<!-- Listing Detail Modal -->
{#if selectedListing}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    on:click={closeDetail}
    on:keydown={(e) => e.key === 'Escape' && closeDetail()}
    role="button"
    tabindex="0"
  >
    <div
      class="glass-card p-6 max-w-2xl w-full max-h-96 overflow-y-auto"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      tabindex="0"
    >
      <div class="flex justify-between items-start mb-4">
        <h3 class="text-xl font-bold text-white">Listing Detail</h3>
        <button
          on:click={closeDetail}
          class="text-white/60 hover:text-white text-2xl"
        >
          ×
        </button>
      </div>

      <div class="space-y-3 text-white/90">
        <div>
          <span class="font-semibold text-white">Version ID:</span>
          <code class="bg-white/20 px-2 py-1 rounded text-sm ml-2">{selectedListing.versionId}</code>
        </div>
        {#if selectedListing.manifest.name}
          <div>
            <span class="font-semibold text-white">Name:</span>
            <span class="ml-2">{selectedListing.manifest.name}</span>
          </div>
        {/if}
        {#if selectedListing.manifest.description}
          <div>
            <span class="font-semibold text-white">Description:</span>
            <span class="ml-2">{selectedListing.manifest.description}</span>
          </div>
        {/if}
        {#if selectedListing.manifest.datasetId}
          <div>
            <span class="font-semibold text-white">Dataset ID:</span>
            <span class="ml-2">{selectedListing.manifest.datasetId}</span>
          </div>
        {/if}
        {#if selectedListing.manifest.contentHash}
          <div>
            <span class="font-semibold text-white">Content Hash:</span>
            <code class="bg-white/20 px-2 py-1 rounded text-sm ml-2">{selectedListing.manifest.contentHash}</code>
          </div>
        {/if}
        {#if selectedListing.manifest.license}
          <div>
            <span class="font-semibold text-white">License:</span>
            <span class="ml-2">{selectedListing.manifest.license}</span>
          </div>
        {/if}
        {#if selectedListing.manifest.classification}
          <div>
            <span class="font-semibold text-white">Classification:</span>
            <span class="ml-2">{selectedListing.manifest.classification}</span>
          </div>
        {/if}
        {#if selectedListing.manifest.createdAt}
          <div>
            <span class="font-semibold text-white">Created:</span>
            <span class="ml-2">{selectedListing.manifest.createdAt}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}