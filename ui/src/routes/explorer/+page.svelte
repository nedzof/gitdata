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
      // Mock data for now
      datasets = [
        {
          versionId: 'TOXSIM-REPORT-12',
          type: 'Analysis Report',
          producer: 'ToxSimAgent',
          createdAt: '2024-01-15T10:30:00Z',
          price: '100 sats',
          license: 'Internal-Use-Only'
        },
        {
          versionId: 'MOLECULA-DESIGNS-45',
          type: 'Design Data',
          producer: 'MoleculaAgent',
          createdAt: '2024-01-14T09:15:00Z',
          price: '250 sats',
          license: 'Research-License-v2'
        },
        {
          versionId: 'GENOSCREEN-RESULT-01',
          type: 'Screening Results',
          producer: 'GenoScreenerAgent',
          createdAt: '2024-01-13T14:45:00Z',
          price: '500 sats',
          license: 'Data-Provider-ABC-License'
        },
        {
          versionId: 'PHARMA-GENOME-73',
          type: 'Genome Data',
          producer: 'human@pharmaco.corp',
          createdAt: '2024-01-12T11:20:00Z',
          price: '1000 sats',
          license: 'PharmaCorp-Proprietary'
        }
      ];
      applyFilters();
    } catch (error) {
      console.error('Failed to load datasets:', error);
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