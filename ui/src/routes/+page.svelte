<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';

  let services = [];
  let loading = true;
  let searchQuery = '';

  // Market statistics
  let marketStats = {
    totalServices: 0,
    activeServices: 0,
    totalVolume24h: 0,
    averagePrice: 0,
    priceChange24h: 0
  };

  // Activity feed data
  let recentActivity = [
    { type: 'new_service', service: 'AI Training Dataset', producer: 'DataCorp Inc', time: '2m ago' },
    { type: 'purchase', service: 'Real-time Market Feed', user: 'user_abc123', time: '5m ago' },
    { type: 'price_update', service: 'IoT Sensor Network', change: '+15%', time: '12m ago' },
    { type: 'new_producer', producer: 'FinTech Solutions', time: '18m ago' },
    { type: 'purchase', service: 'Weather Data Archive', user: 'user_xyz789', time: '23m ago' }
  ];

  // Trending services
  let trendingServices = [
    { name: 'Real-time Market Feed', change: '+45%', volume: '$2.4k' },
    { name: 'AI Training Dataset', change: '+32%', volume: '$1.8k' },
    { name: 'IoT Sensor Network', change: '+28%', volume: '$1.2k' }
  ];

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

      // Calculate market statistics
      marketStats.totalServices = services.length;
      marketStats.activeServices = services.filter(s => s.status === 'active').length;
      marketStats.totalVolume24h = services.reduce((sum, s) => sum + (s.pricePerKB * 1000 * Math.random() * 10), 0); // Mock volume
      marketStats.averagePrice = services.reduce((sum, s) => sum + s.pricePerKB, 0) / services.length;
      marketStats.priceChange24h = (Math.random() - 0.5) * 20; // Mock price change -10% to +10%

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

  <!-- Market Overview Stats -->
  <section class="market-overview">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Services</div>
        <div class="stat-value">{marketStats.totalServices}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Services</div>
        <div class="stat-value">{marketStats.activeServices}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">24h Volume</div>
        <div class="stat-value">${marketStats.totalVolume24h.toFixed(0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Price/KB</div>
        <div class="stat-value">${marketStats.averagePrice.toFixed(3)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">24h Change</div>
        <div class="stat-value" class:positive={marketStats.priceChange24h > 0} class:negative={marketStats.priceChange24h < 0}>
          {marketStats.priceChange24h > 0 ? '+' : ''}{marketStats.priceChange24h.toFixed(1)}%
        </div>
      </div>
    </div>
  </section>

  <!-- Main Content Layout -->
  <div class="main-content">
    <!-- Left Sidebar - Trending Services -->
    <aside class="left-sidebar">
      <div class="sidebar-panel">
        <h3>Trending Services</h3>
        <div class="trending-list">
          {#each trendingServices as service}
            <div class="trending-item">
              <div class="trending-name">{service.name}</div>
              <div class="trending-stats">
                <span class="trending-change positive">{service.change}</span>
                <span class="trending-volume">{service.volume}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </aside>

    <!-- Center Content - Services Table -->
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

    <!-- Right Sidebar - Activity Feed -->
    <aside class="right-sidebar">
      <div class="sidebar-panel">
        <h3>Recent Activity</h3>
        <div class="activity-feed">
          {#each recentActivity as activity}
            <div class="activity-item">
              <div class="activity-content">
                {#if activity.type === 'new_service'}
                  <div class="activity-text">New service: <strong>{activity.service}</strong></div>
                  <div class="activity-meta">by {activity.producer} • {activity.time}</div>
                {:else if activity.type === 'purchase'}
                  <div class="activity-text">Purchase: <strong>{activity.service}</strong></div>
                  <div class="activity-meta">{activity.user} • {activity.time}</div>
                {:else if activity.type === 'price_update'}
                  <div class="activity-text"><strong>{activity.service}</strong> {activity.change}</div>
                  <div class="activity-meta">{activity.time}</div>
                {:else if activity.type === 'new_producer'}
                  <div class="activity-text">New producer: <strong>{activity.producer}</strong></div>
                  <div class="activity-meta">{activity.time}</div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </aside>
  </div>
</main>

<style>
  .landing {
    min-height: 100vh;
    background: #0d1117;
    color: #f0f6fc;
  }

  /* Market Overview Stats - Subtle */
  .market-overview {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2.5rem 2rem 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: transparent;
    border: none;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-value {
    font-size: 1rem;
    font-weight: 500;
    color: #f0f6fc;
  }

  .stat-value.positive {
    color: #238636;
  }

  .stat-value.negative {
    color: #da3633;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6e7681;
    margin-right: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  /* Main Content Layout */
  .main-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
    display: grid;
    grid-template-columns: 220px 1fr 220px;
    gap: 1.5rem;
  }

  /* Sidebars */
  .left-sidebar,
  .right-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .sidebar-panel {
    background: transparent;
    border: none;
    padding: 1rem 0.5rem;
  }

  .sidebar-panel h3 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: #6e7681;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  /* Trending Services */
  .trending-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .trending-item {
    padding: 0.75rem 0;
    border-bottom: 1px solid #21262d;
  }

  .trending-item:last-child {
    border-bottom: none;
  }

  .trending-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #f0f6fc;
    margin-bottom: 0.25rem;
  }

  .trending-stats {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
  }

  .trending-change.positive {
    color: #238636;
    font-weight: 600;
  }

  .trending-volume {
    color: #6e7681;
  }

  /* Activity Feed */
  .activity-feed {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .activity-item {
    padding: 0.5rem 0;
    border-bottom: 1px solid #21262d;
  }

  .activity-item:last-child {
    border-bottom: none;
  }

  .activity-content {
    flex: 1;
  }

  .activity-text {
    font-size: 0.875rem;
    color: #f0f6fc;
    margin-bottom: 0.25rem;
  }

  .activity-meta {
    font-size: 0.75rem;
    color: #6e7681;
  }


  /* Services Section */
  .services-section {
    /* Remove max-width and margin since it's now in grid */
    padding: 0;
  }

  /* Search Section */
  .search-section {
    margin-bottom: 2rem;
  }

  .search-form {
    display: flex;
    gap: 0.5rem;
    width: 100%;
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
    padding: 1.5rem 1.25rem;
    text-align: left;
    font-weight: 600;
    color: #f0f6fc;
    border-bottom: 1px solid #30363d;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .services-table td {
    padding: 1.5rem 1.25rem;
    border-bottom: 1px solid #21262d;
    vertical-align: middle;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .service-row:hover {
    background: #0d1117;
  }

  /* Column Widths - CoinGecko style */
  .rank-col { width: 60px; }
  .service-col { width: 320px; }
  .type-col { width: 140px; }
  .price-col { width: 120px; }
  .size-col { width: 100px; }
  .producer-col { width: 180px; }
  .updated-col { width: 120px; }
  .status-col { width: 100px; }
  .action-col { width: 100px; }

  /* Cell Styling */
  .rank-cell {
    text-align: center;
    font-weight: 600;
    color: #6e7681;
  }

  .service-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .service-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .service-details {
    min-width: 0;
  }

  .service-name {
    font-weight: 600;
    color: #f0f6fc;
    margin-bottom: 0.375rem;
    font-size: 0.95rem;
    line-height: 1.3;
  }

  .service-id {
    font-size: 0.8rem;
    color: #6e7681;
    font-family: 'SF Mono', monospace;
    line-height: 1.2;
  }

  /* Badges */
  .type-badge, .status-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
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
    font-size: 0.95rem;
  }

  .producer-cell, .updated-cell, .size-cell {
    color: #f0f6fc;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  /* Action Button */
  .access-btn {
    padding: 0.625rem 1.25rem;
    background: #238636;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
    line-height: 1;
  }

  .access-btn:hover {
    background: #2ea043;
  }

  /* Responsive Design */
  @media (max-width: 1200px) {
    .main-content {
      grid-template-columns: 200px 1fr 200px;
      gap: 1rem;
      padding: 0 1rem;
    }

    .market-overview {
      padding: 1rem 1rem 0;
    }

    .stats-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .services-table-container {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .services-table {
      min-width: 800px;
    }
  }

  @media (max-width: 768px) {
    .main-content {
      grid-template-columns: 1fr;
      gap: 1rem;
      padding: 0 0.5rem;
    }

    .left-sidebar,
    .right-sidebar {
      order: 1;
    }

    .services-section {
      order: 0;
    }

    .market-overview {
      padding: 1rem 0.5rem 0;
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }

    .stat-card {
      padding: 1rem;
    }

    .services-table th,
    .services-table td {
      padding: 1rem 0.75rem;
      font-size: 0.875rem;
    }
  }
</style>