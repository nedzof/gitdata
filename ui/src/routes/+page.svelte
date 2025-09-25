<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';

  let services = [];
  let loading = true;
  let searchQuery = '';

  // Mock data structure based on the market page
  const mockServices = [
    {
      id: 'service_1',
      name: 'AI Training Dataset',
      type: 'data',
      producer: 'DataCorp Inc',
      format: 'application/json',
      pricePerKB: 0.025,
      size: '2.5 GB',
      updatedAt: '2024-01-15',
      confirmations: 12,
      classification: 'public',
      status: 'active'
    },
    {
      id: 'service_2',
      name: 'Real-time Market Feed',
      type: 'streaming',
      producer: 'MarketStream',
      format: 'application/x-stream',
      pricePerKB: 0.015,
      size: 'Live',
      updatedAt: '2024-01-15',
      confirmations: 8,
      classification: 'premium',
      status: 'active'
    },
    {
      id: 'service_3',
      name: 'IoT Sensor Network',
      type: 'streaming',
      producer: 'IoTHub',
      format: 'application/x-timeseries',
      pricePerKB: 0.008,
      size: 'Live',
      updatedAt: '2024-01-15',
      confirmations: 15,
      classification: 'public',
      status: 'active'
    },
    {
      id: 'service_4',
      name: 'Financial Analytics',
      type: 'data',
      producer: 'FinTech Solutions',
      format: 'text/csv',
      pricePerKB: 0.050,
      size: '850 MB',
      updatedAt: '2024-01-14',
      confirmations: 6,
      classification: 'restricted',
      status: 'active'
    },
    {
      id: 'service_5',
      name: 'Weather Data Archive',
      type: 'data',
      producer: 'WeatherNet',
      format: 'application/json',
      pricePerKB: 0.012,
      size: '1.2 GB',
      updatedAt: '2024-01-14',
      confirmations: 9,
      classification: 'public',
      status: 'active'
    }
  ];

  onMount(async () => {
    await loadServices();
  });

  async function loadServices() {
    try {
      loading = true;
      // Try to load from API first, fall back to mock data
      try {
        const response = await api.request('/v1/services/advertised');
        if (response.success && response.data) {
          services = response.data;
        } else {
          services = mockServices;
        }
      } catch {
        services = mockServices;
      }
    } finally {
      loading = false;
    }
  }

  function getFormatDisplay(mediaType) {
    const formats = {
      'application/json': { name: 'JSON', icon: '📄', type: 'static' },
      'text/csv': { name: 'CSV', icon: '📊', type: 'static' },
      'application/x-stream': { name: 'Live Stream', icon: '🔴', type: 'stream' },
      'application/x-timeseries': { name: 'Time Series', icon: '⏱️', type: 'realtime' },
      'text/plain': { name: 'Text', icon: '📝', type: 'static' }
    };
    return formats[mediaType] || { name: 'Data', icon: '📦', type: 'static' };
  }

  function getStatusIcon(classification) {
    switch (classification) {
      case 'public': return '🌐';
      case 'premium': return '⭐';
      case 'restricted': return '🔒';
      default: return '📦';
    }
  }

  function handleSearch(event) {
    event.preventDefault();
    if (searchQuery.trim()) {
      goto(`/data/version/${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  // Filter services based on search query
  $: filteredServices = services.filter(service =>
    searchQuery === '' ||
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.producer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.id.toLowerCase().includes(searchQuery.toLowerCase())
  );
</script>

<main class="landing">

  <!-- Services Marketplace Table -->
  <section class="services-section">
    <!-- Search Bar -->
    <div class="search-section">
      <form class="search-form" on:submit={handleSearch}>
        <input
          class="search-input"
          bind:value={searchQuery}
          placeholder="Search services, producers, or IDs..."
          type="text"
        />
        <button type="submit" class="search-btn">Search</button>
      </form>
    </div>

    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading services...</p>
      </div>
    {:else}
      <div class="services-table-container">
        <table class="services-table">
          <thead>
            <tr>
              <th class="rank-col">#</th>
              <th class="service-col">Service</th>
              <th class="type-col">Type</th>
              <th class="price-col">Price/KB</th>
              <th class="size-col">Size</th>
              <th class="producer-col">Producer</th>
              <th class="updated-col">Updated</th>
              <th class="status-col">Status</th>
              <th class="action-col">Action</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredServices as service, index}
              <tr class="service-row">
                <td class="rank-cell">{index + 1}</td>
                <td class="service-cell">
                  <div class="service-info">
                    <span class="service-icon">
                      {getStatusIcon(service.classification)}
                    </span>
                    <div class="service-details">
                      <div class="service-name">{service.name}</div>
                      <div class="service-id">ID: {service.id}</div>
                    </div>
                  </div>
                </td>
                <td class="type-cell">
                  <span class="type-badge type-{getFormatDisplay(service.format).type}">
                    {getFormatDisplay(service.format).icon} {getFormatDisplay(service.format).name}
                  </span>
                </td>
                <td class="price-cell">
                  <span class="price-value">${service.pricePerKB.toFixed(3)}</span>
                </td>
                <td class="size-cell">{service.size}</td>
                <td class="producer-cell">{service.producer}</td>
                <td class="updated-cell">{new Date(service.updatedAt).toLocaleDateString()}</td>
                <td class="status-cell">
                  <span class="status-badge status-{service.status}">
                    {service.status}
                  </span>
                </td>
                <td class="action-cell">
                  <button class="access-btn" on:click={() => window.location.href = '/consumer'}>
                    Access
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</main>

<style>
  .landing {
    min-height: 100vh;
    background: #0d1117;
    color: #f0f6fc;
  }


  /* Services Section */
  .services-section {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  /* Search Section */
  .search-section {
    margin-bottom: 2rem;
  }

  .search-form {
    display: flex;
    gap: 0.5rem;
    max-width: 600px;
    margin: 0 auto;
  }

  .search-input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid #30363d;
    border-radius: 6px;
    background: #0d1117;
    color: #f0f6fc;
    font-size: 1rem;
  }

  .search-input:focus {
    outline: none;
    border-color: #58a6ff;
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1);
  }

  .search-input::placeholder {
    color: #6e7681;
  }

  .search-btn {
    padding: 0.75rem 1.5rem;
    background: #238636;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .search-btn:hover {
    background: #2ea043;
  }

  .section-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .section-header h2 {
    font-size: 1.5rem;
    color: #f0f6fc;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .section-header p {
    color: #6e7681;
  }

  /* Loading State */
  .loading-state {
    text-align: center;
    padding: 3rem;
    color: #6e7681;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #30363d;
    border-top: 3px solid #58a6ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Services Table */
  .services-table-container {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    overflow: hidden;
  }

  .services-table {
    width: 100%;
    border-collapse: collapse;
  }

  .services-table thead {
    background: #21262d;
  }

  .services-table th {
    padding: 1rem 0.75rem;
    text-align: left;
    font-weight: 600;
    color: #f0f6fc;
    border-bottom: 1px solid #30363d;
    font-size: 0.875rem;
  }

  .services-table td {
    padding: 1rem 0.75rem;
    border-bottom: 1px solid #21262d;
    vertical-align: middle;
  }

  .service-row:hover {
    background: #0d1117;
  }

  /* Column Widths */
  .rank-col { width: 50px; }
  .service-col { width: 250px; }
  .type-col { width: 120px; }
  .price-col { width: 100px; }
  .size-col { width: 80px; }
  .producer-col { width: 150px; }
  .updated-col { width: 100px; }
  .status-col { width: 80px; }
  .action-col { width: 80px; }

  /* Cell Styling */
  .rank-cell {
    text-align: center;
    font-weight: 600;
    color: #6e7681;
  }

  .service-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .service-icon {
    font-size: 1.25rem;
  }

  .service-name {
    font-weight: 600;
    color: #f0f6fc;
    margin-bottom: 0.25rem;
  }

  .service-id {
    font-size: 0.75rem;
    color: #6e7681;
    font-family: 'SF Mono', monospace;
  }

  /* Badges */
  .type-badge, .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .type-badge.type-static {
    background: #238636;
    color: white;
  }

  .type-badge.type-stream {
    background: #da3633;
    color: white;
  }

  .type-badge.type-realtime {
    background: #fb8500;
    color: white;
  }

  .status-badge.status-active {
    background: #238636;
    color: white;
  }

  .status-badge.status-inactive {
    background: #6e7681;
    color: white;
  }

  /* Price and other cells */
  .price-value {
    font-weight: 600;
    color: #58a6ff;
  }

  .producer-cell, .updated-cell, .size-cell {
    color: #f0f6fc;
  }

  /* Action Button */
  .access-btn {
    padding: 0.5rem 1rem;
    background: #238636;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .access-btn:hover {
    background: #2ea043;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      gap: 1rem;
    }

    .services-table-container {
      overflow-x: auto;
    }

    .services-table {
      min-width: 800px;
    }

    .services-section {
      padding: 1rem;
    }
  }
</style>