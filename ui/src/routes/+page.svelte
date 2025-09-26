<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let loading = true;
  let searchQuery = '';
  let selectedPolicy = 'all';
  let services = [];

  // Simplified market stats
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
      pricePerKB: 25,
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
      pricePerKB: 15,
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
      pricePerKB: 8,
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
      pricePerKB: 50,
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
      pricePerKB: 12,
      size: '1.2 GB',
      updatedAt: '2024-01-14',
      confirmations: 9,
      classification: 'public',
      status: 'active'
    },
    {
      id: 'service_6',
      name: 'Cryptocurrency Order Books',
      type: 'streaming',
      producer: 'CryptoFlow',
      format: 'application/x-stream',
      pricePerKB: 35,
      size: 'Live',
      updatedAt: '2024-01-15',
      confirmations: 20,
      classification: 'premium',
      status: 'active'
    },
    {
      id: 'service_7',
      name: 'Scientific Research Papers',
      type: 'data',
      producer: 'ResearchHub',
      format: 'application/pdf',
      pricePerKB: 5,
      size: '4.8 GB',
      updatedAt: '2024-01-13',
      confirmations: 18,
      classification: 'public',
      status: 'active'
    },
    {
      id: 'service_8',
      name: 'Social Media Analytics',
      type: 'data',
      producer: 'SocialTrends',
      format: 'application/json',
      pricePerKB: 30,
      size: '1.8 GB',
      updatedAt: '2024-01-14',
      confirmations: 11,
      classification: 'restricted',
      status: 'active'
    },
    {
      id: 'service_9',
      name: 'Traffic Pattern Data',
      type: 'streaming',
      producer: 'UrbanSense',
      format: 'application/x-timeseries',
      pricePerKB: 18,
      size: 'Live',
      updatedAt: '2024-01-15',
      confirmations: 7,
      classification: 'public',
      status: 'active'
    },
    {
      id: 'service_10',
      name: 'Medical Image Database',
      type: 'data',
      producer: 'MedTech Solutions',
      format: 'application/dicom',
      pricePerKB: 75,
      size: '12.3 GB',
      updatedAt: '2024-01-12',
      confirmations: 25,
      classification: 'restricted',
      status: 'active'
    },
    {
      id: 'service_11',
      name: 'Energy Grid Monitoring',
      type: 'streaming',
      producer: 'SmartGrid Co',
      format: 'application/x-timeseries',
      pricePerKB: 22,
      size: 'Live',
      updatedAt: '2024-01-15',
      confirmations: 14,
      classification: 'premium',
      status: 'active'
    },
    {
      id: 'service_12',
      name: 'News Article Archive',
      type: 'data',
      producer: 'NewsFlow',
      format: 'text/plain',
      pricePerKB: 3,
      size: '8.9 GB',
      updatedAt: '2024-01-13',
      confirmations: 16,
      classification: 'public',
      status: 'active'
    },
    {
      id: 'service_13',
      name: 'Satellite Imagery Feed',
      type: 'streaming',
      producer: 'SkyWatch',
      format: 'image/tiff',
      pricePerKB: 60,
      size: 'Live',
      updatedAt: '2024-01-15',
      confirmations: 19,
      classification: 'premium',
      status: 'active'
    },
    {
      id: 'service_14',
      name: 'E-commerce Transaction Logs',
      type: 'data',
      producer: 'CommerceInsights',
      format: 'application/json',
      pricePerKB: 40,
      size: '3.2 GB',
      updatedAt: '2024-01-14',
      confirmations: 13,
      classification: 'restricted',
      status: 'active'
    },
    {
      id: 'service_15',
      name: 'Biometric Data Streams',
      type: 'streaming',
      producer: 'HealthTech',
      format: 'application/x-stream',
      pricePerKB: 85,
      size: 'Live',
      updatedAt: '2024-01-15',
      confirmations: 22,
      classification: 'restricted',
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
      marketStats.averagePrice = services.length > 0 ? services.reduce((sum, s) => sum + s.pricePerKB, 0) / services.length : 0;
      marketStats.priceChange24h = (Math.random() - 0.5) * 20; // Mock price change -10% to +10%

    } finally {
      loading = false;
    }
  }

  function getFormatDisplay(mediaType) {
    const formats = {
      'application/json': { name: 'JSON', icon: '', type: 'static' },
      'text/csv': { name: 'CSV', icon: '', type: 'static' },
      'application/x-stream': { name: 'Live Stream', icon: '', type: 'stream' },
      'application/x-timeseries': { name: 'Time Series', icon: '', type: 'realtime' },
      'text/plain': { name: 'Text', icon: '', type: 'static' }
    };
    return formats[mediaType] || { name: 'Data', icon: '', type: 'static' };
  }

  function getStatusIcon(classification) {
    return ''; // Remove all icons for clean appearance
  }

  function handleSearch(event) {
    event.preventDefault();
    if (searchQuery.trim()) {
      goto(`/data/version/${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  // Filter services based on search query and policy
  $: filteredServices = services.filter(service => {
    const matchesSearch = searchQuery === '' ||
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.producer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPolicy = selectedPolicy === 'all' ||
      service.classification === selectedPolicy;

    return matchesSearch && matchesPolicy;
  });
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
        <div class="stat-value">{marketStats?.totalVolume24h?.toFixed(0) || '0'} sats</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Price/KB</div>
        <div class="stat-value">{marketStats?.averagePrice?.toFixed(0) || '0'} sats</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">24h Change</div>
        <div class="stat-value" class:positive={marketStats?.priceChange24h > 0} class:negative={marketStats?.priceChange24h < 0}>
          {marketStats?.priceChange24h > 0 ? '+' : ''}{marketStats?.priceChange24h?.toFixed(1) || '0.0'}%
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
          <select bind:value={selectedPolicy} class="policy-filter">
            <option value="all">All Policies</option>
            <option value="public">Public</option>
            <option value="premium">Premium</option>
            <option value="restricted">Restricted</option>
          </select>
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
                    <div class="service-details">
                      <div class="service-name">{service.name}</div>
                      <div class="service-id">ID: {service.id}</div>
                    </div>
                  </div>
                </td>
                <td class="type-cell">
                  <span class="type-badge type-{getFormatDisplay(service.format).type}">
                    {getFormatDisplay(service.format).name}
                  </span>
                </td>
                <td class="price-cell">
                  <span class="price-value">{service.pricePerKB} sats</span>
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

<!-- Floating Action Button -->
<button
  class="publish-fab"
  on:click={() => goto('/producer')}
  title="Publish your data to the marketplace"
>
  📊 Publish Data
</button>

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
    color: #46954a;
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
    grid-template-columns: 180px 1fr 180px;
    gap: 1rem;
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
    padding: 0.75rem 0.5rem;
  }

  .sidebar-panel h3 {
    margin: 0 0 0.75rem 0;
    font-size: 0.8rem;
    font-weight: 500;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  /* Trending Services */
  .trending-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .trending-item {
    padding: 0.5rem 0;
    border-bottom: 1px solid #21262d;
  }

  .trending-item:last-child {
    border-bottom: none;
  }

  .trending-name {
    font-size: 0.8rem;
    font-weight: 500;
    color: #8b949e;
    margin-bottom: 0.25rem;
    line-height: 1.2;
  }

  .trending-stats {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
  }

  .trending-change.positive {
    color: #46954a;
    font-weight: 400;
  }

  .trending-volume {
    color: #6e7681;
  }

  /* Activity Feed */
  .activity-feed {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .activity-item {
    padding: 0.375rem 0;
    border-bottom: 1px solid #21262d;
  }

  .activity-item:last-child {
    border-bottom: none;
  }

  .activity-content {
    flex: 1;
  }

  .activity-text {
    font-size: 0.8rem;
    color: #8b949e;
    margin-bottom: 0.25rem;
    line-height: 1.3;
  }

  .activity-text strong {
    color: #c9d1d9;
    font-weight: 400;
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

  /* Floating Action Button */
  .publish-fab {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: linear-gradient(135deg, #238636, #2ea043);
    color: white;
    border: none;
    border-radius: 50px;
    padding: 1rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 32px rgba(35, 134, 54, 0.4);
    z-index: 1000;
    animation: float 3s ease-in-out infinite;
    white-space: nowrap;
  }

  .publish-fab:hover {
    background: linear-gradient(135deg, #2ea043, #46954a);
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 16px 48px rgba(35, 134, 54, 0.6);
    animation-play-state: paused;
  }

  .publish-fab:active {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 12px 36px rgba(35, 134, 54, 0.5);
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0);
      box-shadow: 0 8px 32px rgba(35, 134, 54, 0.4);
    }
    50% {
      transform: translateY(-3px);
      box-shadow: 0 12px 40px rgba(35, 134, 54, 0.5);
    }
  }

  /* Search Section */
  .search-section {
    margin-bottom: 1rem;
  }

  .search-form {
    display: flex;
    gap: 0.5rem;
    width: 100%;
  }

  .search-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #21262d;
    border-radius: 4px;
    background: #0d1117;
    color: #f0f6fc;
    font-size: 0.875rem;
  }

  .policy-filter {
    padding: 0.5rem 0.75rem;
    border: 1px solid #21262d;
    border-radius: 4px;
    background: #0d1117;
    color: #f0f6fc;
    font-size: 0.875rem;
    min-width: 120px;
  }

  .policy-filter:focus {
    outline: none;
    border-color: #30363d;
    box-shadow: none;
  }

  .search-input:focus {
    outline: none;
    border-color: #30363d;
    box-shadow: none;
  }

  .search-input::placeholder {
    color: #6e7681;
  }

  .search-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    color: #8b949e;
    border: 1px solid #21262d;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    font-size: 0.875rem;
  }

  .search-btn:hover {
    background: rgba(33, 38, 45, 0.5);
    border-color: #30363d;
    color: #f0f6fc;
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
    background: transparent;
    border: 1px solid #21262d;
    border-radius: 6px;
    overflow: hidden;
  }

  .services-table {
    width: 100%;
    border-collapse: collapse;
  }

  .services-table thead {
    background: #0d1117;
    border-bottom: 1px solid #21262d;
  }

  .services-table th {
    padding: 0.75rem 0.5rem;
    text-align: left;
    font-weight: 500;
    color: #8b949e;
    border-right: 1px solid #21262d;
    font-size: 0.8rem;
  }

  .services-table th:last-child {
    border-right: none;
  }

  .services-table td {
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid #21262d;
    border-right: 1px solid #21262d;
    vertical-align: top;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .services-table td:last-child {
    border-right: none;
  }

  .service-row:hover {
    background: rgba(33, 38, 45, 0.3);
  }

  /* Column Widths - CoinGecko style */
  .rank-col { width: 50px; }
  .service-col { width: 500px; }
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
    font-weight: 500;
    color: #6e7681;
  }

  .service-info {
    display: flex;
    align-items: flex-start;
  }

  .service-details {
    min-width: 0;
  }

  .service-name {
    font-weight: 500;
    color: #f0f6fc;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    line-height: 1.3;
  }

  .service-id {
    font-size: 0.625rem;
    color: #6e7681;
    font-family: 'SF Mono', monospace;
    line-height: 1.2;
  }

  /* Badges */
  .type-badge, .status-badge {
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.625rem;
    font-weight: 500;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
  }

  .type-badge.type-static {
    background: transparent;
    color: #2ea043;
    border: 1px solid #21262d;
  }

  .type-badge.type-stream {
    background: transparent;
    color: #da3633;
    border: 1px solid #21262d;
  }

  .type-badge.type-realtime {
    background: transparent;
    color: #fd7e14;
    border: 1px solid #21262d;
  }

  .status-badge.status-active {
    background: rgba(35, 134, 54, 0.15);
    color: #2ea043;
    border: 1px solid rgba(35, 134, 54, 0.3);
  }

  .status-badge.status-inactive {
    background: transparent;
    color: #8b949e;
    border: 1px solid #21262d;
  }

  /* Price and other cells */
  .price-value {
    font-weight: 500;
    color: #f0f6fc;
    font-size: 0.875rem;
  }

  .producer-cell, .updated-cell, .size-cell {
    color: #f0f6fc;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  /* Action Button */
  .access-btn {
    padding: 0.375rem 0.75rem;
    background: #0969da;
    color: white;
    border: 1px solid #0969da;
    border-radius: 4px;
    font-weight: 500;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
    line-height: 1;
  }

  .access-btn:hover {
    background: #0860ca;
    border-color: #0860ca;
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