<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  let assets = [];
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
    content: null
  };

  onMount(async () => {
    await loadAssets();
  });

  async function loadAssets() {
    try {
      loading = true;
      // This would call the backend to get assets from the catalog
      const response = await api.request('/catalog/assets');
      assets = response.assets || [];
    } catch (error) {
      console.error('Failed to load assets:', error);
      assets = [];
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
      const formData = new FormData();
      formData.append('name', publishData.name);
      formData.append('description', publishData.description);
      formData.append('type', publishData.type);
      formData.append('tags', publishData.tags);
      if (publishData.content) {
        formData.append('content', publishData.content);
      }

      await api.request('/catalog/publish', {
        method: 'POST',
        body: formData
      });

      // Reset form and reload assets
      publishData = { name: '', description: '', type: 'data', tags: '', content: null };
      showPublishForm = false;
      await loadAssets();
    } catch (error) {
      console.error('Failed to publish asset:', error);
    }
  }

  function handleFileSelect(event) {
    publishData.content = event.target.files[0];
  }
</script>

<svelte:head>
  <title>Catalog - Gitdata</title>
</svelte:head>

<main class="container mx-auto px-4 py-8">
  <div class="flex justify-between items-center mb-8">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">📋 Catalog</h1>
      <p class="text-gray-600 mt-2">Discover and publish data and AI assets</p>
    </div>
    <button
      on:click={() => showPublishForm = !showPublishForm}
      class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
    >
      {showPublishForm ? 'Cancel' : '+ Publish Asset'}
    </button>
  </div>

  <!-- Publishing Form -->
  {#if showPublishForm}
    <div class="bg-white border border-gray-200 rounded-lg p-6 mb-8">
      <h2 class="text-xl font-semibold mb-4">Publish New Asset</h2>
      <form on:submit|preventDefault={handlePublish} class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              id="name"
              type="text"
              bind:value={publishData.name}
              required
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label for="type" class="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              id="type"
              bind:value={publishData.type}
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="data">Data</option>
              <option value="ai">AI Model</option>
            </select>
          </div>
        </div>
        <div>
          <label for="description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            id="description"
            bind:value={publishData.description}
            rows="3"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>
        <div>
          <label for="tags" class="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
          <input
            id="tags"
            type="text"
            bind:value={publishData.tags}
            placeholder="finance, csv, quarterly"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="content" class="block text-sm font-medium text-gray-700 mb-1">File (optional)</label>
          <input
            id="content"
            type="file"
            on:change={handleFileSelect}
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="flex gap-2">
          <button
            type="submit"
            class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Publish
          </button>
          <button
            type="button"
            on:click={() => showPublishForm = false}
            class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Search and Filter -->
  <div class="mb-6 space-y-4">
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="flex-1">
        <input
          type="text"
          placeholder="Search assets..."
          bind:value={searchQuery}
          class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div class="flex gap-2">
        <button
          on:click={() => selectedType = 'all'}
          class="px-4 py-2 rounded-lg transition-colors {selectedType === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
        >
          All
        </button>
        <button
          on:click={() => selectedType = 'data'}
          class="px-4 py-2 rounded-lg transition-colors {selectedType === 'data' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
        >
          📊 Data
        </button>
        <button
          on:click={() => selectedType = 'ai'}
          class="px-4 py-2 rounded-lg transition-colors {selectedType === 'ai' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
        >
          🤖 AI
        </button>
      </div>
    </div>
  </div>

  <!-- Assets Grid -->
  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  {:else if filteredAssets().length === 0}
    <div class="text-center py-12">
      <p class="text-gray-500 text-lg">No assets found</p>
      <p class="text-gray-400 text-sm mt-2">Try adjusting your search or publish a new asset</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each filteredAssets() as asset}
        <div class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="text-2xl">{asset.type === 'ai' ? '🤖' : '📊'}</span>
              <h3 class="font-semibold text-lg text-gray-900">{asset.name}</h3>
            </div>
            <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {asset.type}
            </span>
          </div>

          <p class="text-gray-600 text-sm mb-4 line-clamp-3">{asset.description}</p>

          {#if asset.tags && asset.tags.length > 0}
            <div class="flex flex-wrap gap-1 mb-4">
              {#each asset.tags as tag}
                <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {tag}
                </span>
              {/each}
            </div>
          {/if}

          <div class="flex justify-between items-center text-sm text-gray-500">
            <span>ID: {asset.versionId}</span>
            <div class="flex gap-2">
              <a
                href="/analysis?id={asset.versionId}"
                class="text-blue-500 hover:text-blue-600"
              >
                View Lineage
              </a>
              <a
                href="/connect?asset={asset.versionId}"
                class="text-green-500 hover:text-green-600"
              >
                Connect
              </a>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</main>