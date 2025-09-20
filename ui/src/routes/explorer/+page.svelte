<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let datasets = [];
  let filteredDatasets = [];
  let currentPage = 0;
  let pageSize = 20;
  let searchFilter = '';
  let typeFilter = '';
  let producerFilter = '';
  let loading = false;

  onMount(() => {
    loadDatasets();
  });

  async function loadDatasets() {
    loading = true;
    try {
      // First try to load from listings API (manifests)
      let datasets_loaded = false;

      try {
        const listingsResponse = await fetch('/listings?limit=200');
        if (listingsResponse.ok) {
          const listingsResult = await listingsResponse.json();
          if (listingsResult.items && listingsResult.items.length > 0) {
            datasets = listingsResult.items.map(item => ({
              versionId: item.versionId,
              type: item.name || 'Dataset',
              producer: item.producerId || 'Unknown',
              createdAt: item.updatedAt || new Date().toISOString(),
              price: 'Variable',
              license: 'See manifest'
            }));
            datasets_loaded = true;
          }
        }
      } catch (e) {
        console.warn('Listings API failed:', e);
      }

      // If no listings data, fall back to models API
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
              license: 'See details'
            }));
            datasets_loaded = true;
          }
        } catch (e) {
          console.warn('Models API failed:', e);
        }
      }

      // If still no data, show empty state
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

  function applyFilters() {
    filteredDatasets = datasets.filter(dataset => {
      return (
        (!searchFilter || dataset.versionId.toLowerCase().includes(searchFilter.toLowerCase()) ||
         dataset.producer.toLowerCase().includes(searchFilter.toLowerCase())) &&
        (!typeFilter || dataset.type === typeFilter) &&
        (!producerFilter || dataset.producer === producerFilter)
      );
    });
  }

  function goToDetail(versionId) {
    goto(`/explorer/version/${encodeURIComponent(versionId)}`);
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

  $: paginatedDatasets = filteredDatasets.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  $: uniqueTypes = [...new Set(datasets.map(d => d.type))];
  $: uniqueProducers = [...new Set(datasets.map(d => d.producer))];
  $: totalPages = Math.ceil(filteredDatasets.length / pageSize);

  $: {
    searchFilter, typeFilter, producerFilter;
    applyFilters();
    currentPage = 0;
  }
</script>

<div class="explorer">
  <h1>Data Explorer</h1>

  <div class="filters">
    <input
      bind:value={searchFilter}
      placeholder="Search by version ID or producer..."
    />

    <select bind:value={typeFilter}>
      <option value="">All Types</option>
      {#each uniqueTypes as type}
        <option value={type}>{type}</option>
      {/each}
    </select>

    <select bind:value={producerFilter}>
      <option value="">All Producers</option>
      {#each uniqueProducers as producer}
        <option value={producer}>{producer}</option>
      {/each}
    </select>
  </div>

  <div class="data-table">
    {#if loading}
      <div style="padding: 20px; text-align: center;">Loading...</div>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Version ID</th>
            <th>Type</th>
            <th>Producer</th>
            <th>Created</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {#each paginatedDatasets as dataset}
            <tr on:click={() => goToDetail(dataset.versionId)}>
              <td>
                <a href="/explorer/version/{encodeURIComponent(dataset.versionId)}" class="version-id">
                  {dataset.versionId}
                </a>
              </td>
              <td>{dataset.type}</td>
              <td>{dataset.producer}</td>
              <td>{formatDate(dataset.createdAt)}</td>
              <td>{dataset.price}</td>
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