<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  // Tab management
  let activeTab = 'setup';

  // Consumer Identity Data
  let consumerProfile = {
    consumerId: '',
    identityKey: '',
    displayName: '',
    description: '',
    region: 'global',
    contactEmail: '',
    website: '',
    walletAddress: ''
  };

  let connectionStatus = {
    overlay: 'checking',
    database: 'checking',
    identity: 'checking',
    wallet: 'checking'
  };

  let loading = false;
  let initialized = false;
  let overlayUrl = 'http://localhost:8788';

  // Discovery Data
  let discoveredServices = [];
  let discoveryLoading = false;
  let discoveryFilters = {
    serviceType: '',
    capabilities: '',
    maxPrice: '',
    location: 'any',
    producer: ''
  };

  let serviceTypes = [
    'content-streaming',
    'data-processing',
    'ai-inference',
    'video-streaming',
    'storage',
    'analytics',
    'compute'
  ];

  // Search & Purchase Data
  let searchResults = [];
  let searchLoading = false;
  let searchQuery = {
    contentType: '',
    tags: '',
    maxPrice: '',
    producer: '',
    limit: 10
  };

  let purchaseHistory = [];
  let subscriptions = [];
  let downloadQueue = [];

  // Analytics Data
  let consumerAnalytics = {
    totalSpent: 0,
    totalDownloads: 0,
    activeSubscriptions: 0,
    favoriteProducers: []
  };

  onMount(async () => {
    await checkConsumerStatus();
    await loadConsumerData();
  });

  // Consumer Setup Functions
  async function checkConsumerStatus() {
    try {
      loading = true;

      // Check overlay connection
      try {
        const healthResponse = await fetch(`${overlayUrl}/health`);
        if (healthResponse.ok) {
          connectionStatus.overlay = 'connected';
          const healthData = await healthResponse.json();
          connectionStatus.database = healthData.database === 'postgresql:ok' ? 'connected' : 'error';
        } else {
          connectionStatus.overlay = 'error';
        }
      } catch {
        connectionStatus.overlay = 'error';
      }

      // Check if consumer is already initialized
      try {
        const identity = localStorage.getItem('consumer-identity');
        if (identity) {
          const parsedIdentity = JSON.parse(identity);
          consumerProfile = { ...consumerProfile, ...parsedIdentity };
          connectionStatus.identity = 'registered';
          initialized = true;
        } else {
          connectionStatus.identity = 'not-registered';
        }
      } catch {
        connectionStatus.identity = 'error';
      }

      // Check wallet connection
      connectionStatus.wallet = consumerProfile.walletAddress ? 'connected' : 'not-connected';

    } finally {
      loading = false;
    }
  }

  async function initializeConsumer() {
    try {
      loading = true;

      const identityKey = 'consumer_' + Math.random().toString(36).substr(2, 16);
      const consumerId = consumerProfile.displayName.toLowerCase().replace(/\\s+/g, '-') + '-' + Date.now();

      const newProfile = {
        ...consumerProfile,
        consumerId,
        identityKey,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem('consumer-identity', JSON.stringify(newProfile));

      try {
        const response = await api.request('/v1/consumers/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consumerId: newProfile.consumerId,
            identityKey: newProfile.identityKey,
            displayName: newProfile.displayName,
            description: newProfile.description,
            contactEmail: newProfile.contactEmail,
            website: newProfile.website,
            region: newProfile.region
          })
        });

        consumerProfile = newProfile;
        connectionStatus.identity = 'registered';
        initialized = true;
        alert('Consumer identity initialized successfully!');
      } catch (error) {
        consumerProfile = newProfile;
        connectionStatus.identity = 'registered';
        initialized = true;
        console.warn('Consumer registered locally, API registration failed:', error);
      }

    } catch (error) {
      alert('Failed to initialize consumer: ' + error.message);
    } finally {
      loading = false;
    }
  }

  async function resetIdentity() {
    if (confirm('Are you sure you want to reset your consumer identity? This will clear all saved data.')) {
      localStorage.removeItem('consumer-identity');
      localStorage.removeItem('consumer-purchases');
      localStorage.removeItem('consumer-subscriptions');
      consumerProfile = {
        consumerId: '',
        identityKey: '',
        displayName: '',
        description: '',
        region: 'global',
        contactEmail: '',
        website: '',
        walletAddress: ''
      };
      connectionStatus.identity = 'not-registered';
      initialized = false;
      purchaseHistory = [];
      subscriptions = [];
    }
  }

  // Discovery Functions
  async function discoverServices() {
    try {
      discoveryLoading = true;

      // Mock discovery data - matches CLI discover functionality
      discoveredServices = [
        {
          id: 'service_1',
          producer: 'DataCorp',
          producerId: 'producer_datacorp_123',
          serviceType: 'content-streaming',
          capabilities: ['streaming', 'encoding', 'real-time'],
          price: 150,
          currency: 'BSV',
          location: 'North America',
          availability: 99.5,
          description: 'High-quality content streaming with real-time encoding',
          endpoint: 'https://api.datacorp.com/stream',
          reputation: 4.8
        },
        {
          id: 'service_2',
          producer: 'AILabs',
          producerId: 'producer_ailabs_456',
          serviceType: 'ai-inference',
          capabilities: ['machine-learning', 'nlp', 'computer-vision'],
          price: 200,
          currency: 'BSV',
          location: 'Europe',
          availability: 98.9,
          description: 'Advanced AI inference services for ML workloads',
          endpoint: 'https://api.ailabs.com/infer',
          reputation: 4.9
        },
        {
          id: 'service_3',
          producer: 'StorageNet',
          producerId: 'producer_storagenet_789',
          serviceType: 'storage',
          capabilities: ['distributed', 'encrypted', 'high-availability'],
          price: 75,
          currency: 'BSV',
          location: 'Global',
          availability: 99.9,
          description: 'Distributed encrypted storage with global replication',
          endpoint: 'https://api.storagenet.com/store',
          reputation: 4.7
        }
      ];

      // Apply filters
      if (discoveryFilters.serviceType) {
        discoveredServices = discoveredServices.filter(s => s.serviceType === discoveryFilters.serviceType);
      }
      if (discoveryFilters.maxPrice) {
        discoveredServices = discoveredServices.filter(s => s.price <= parseInt(discoveryFilters.maxPrice));
      }
      if (discoveryFilters.capabilities) {
        const reqCapabilities = discoveryFilters.capabilities.toLowerCase().split(',').map(c => c.trim());
        discoveredServices = discoveredServices.filter(s =>
          reqCapabilities.some(cap => s.capabilities.some(sc => sc.toLowerCase().includes(cap)))
        );
      }

      // Try real API call
      try {
        const params = new URLSearchParams({
          serviceType: discoveryFilters.serviceType || '',
          capabilities: discoveryFilters.capabilities || '',
          maxPrice: discoveryFilters.maxPrice || '',
          location: discoveryFilters.location || 'any'
        });

        const response = await api.request(`/v1/discover?${params}`);
        if (response && response.services) {
          discoveredServices = response.services;
        }
      } catch (error) {
        console.warn('Using mock discovery data:', error);
      }

    } catch (error) {
      console.error('Failed to discover services:', error);
    } finally {
      discoveryLoading = false;
    }
  }

  // Search Functions
  async function searchContent() {
    try {
      searchLoading = true;

      // Mock search results - matches CLI search functionality
      searchResults = [
        {
          id: 'content_1',
          title: 'Financial Dataset 2024',
          description: 'Comprehensive financial market data with real-time updates',
          contentType: 'application/json',
          size: '125MB',
          price: 500,
          currency: 'BSV',
          producer: 'FinanceData Inc',
          producerId: 'producer_finance_123',
          tags: ['finance', 'markets', 'real-time'],
          uhrpHash: 'uhrp_abc123...',
          created: '2024-01-15T10:30:00Z',
          rating: 4.8,
          downloads: 1250
        },
        {
          id: 'content_2',
          title: 'Machine Learning Training Set',
          description: 'Large-scale ML training dataset with labeled examples',
          contentType: 'application/octet-stream',
          size: '2.1GB',
          price: 750,
          currency: 'BSV',
          producer: 'ML Research Lab',
          producerId: 'producer_mllab_456',
          tags: ['machine-learning', 'training', 'dataset'],
          uhrpHash: 'uhrp_def456...',
          created: '2024-01-10T14:20:00Z',
          rating: 4.9,
          downloads: 850
        }
      ];

      // Apply search filters
      if (searchQuery.contentType) {
        searchResults = searchResults.filter(r => r.contentType.includes(searchQuery.contentType));
      }
      if (searchQuery.tags) {
        const searchTags = searchQuery.tags.toLowerCase().split(',').map(t => t.trim());
        searchResults = searchResults.filter(r =>
          searchTags.some(tag => r.tags.some(rt => rt.toLowerCase().includes(tag)))
        );
      }
      if (searchQuery.maxPrice) {
        searchResults = searchResults.filter(r => r.price <= parseInt(searchQuery.maxPrice));
      }
      if (searchQuery.producer) {
        searchResults = searchResults.filter(r =>
          r.producer.toLowerCase().includes(searchQuery.producer.toLowerCase())
        );
      }

      searchResults = searchResults.slice(0, searchQuery.limit);

      // Try real API call
      try {
        const params = new URLSearchParams({
          contentType: searchQuery.contentType || '',
          tags: searchQuery.tags || '',
          maxPrice: searchQuery.maxPrice || '',
          producer: searchQuery.producer || '',
          limit: searchQuery.limit.toString()
        });

        const response = await api.request(`/v1/search?${params}`);
        if (response && response.results) {
          searchResults = response.results;
        }
      } catch (error) {
        console.warn('Using mock search data:', error);
      }

    } catch (error) {
      console.error('Failed to search content:', error);
    } finally {
      searchLoading = false;
    }
  }

  // Purchase Functions
  async function purchaseContent(content) {
    if (!initialized) {
      alert('Please initialize your consumer identity first');
      return;
    }

    try {
      const purchase = {
        id: 'purchase_' + Date.now(),
        contentId: content.id,
        contentTitle: content.title,
        producer: content.producer,
        producerId: content.producerId,
        price: content.price,
        currency: content.currency,
        uhrpHash: content.uhrpHash,
        purchasedAt: new Date().toISOString(),
        status: 'completed',
        downloadUrl: `${overlayUrl}/download/${content.uhrpHash}`
      };

      purchaseHistory = [purchase, ...purchaseHistory];
      localStorage.setItem('consumer-purchases', JSON.stringify(purchaseHistory));

      // Try real API call
      try {
        await api.request('/v1/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId: content.id,
            amount: content.price,
            currency: content.currency,
            consumerIdentity: consumerProfile.identityKey
          })
        });
      } catch (error) {
        console.warn('Purchase stored locally, API call failed:', error);
      }

      alert(`Successfully purchased: ${content.title}`);
      updateAnalytics();

    } catch (error) {
      alert('Failed to purchase content: ' + error.message);
    }
  }

  async function downloadContent(purchase) {
    try {
      // Add to download queue
      const download = {
        id: purchase.id,
        title: purchase.contentTitle,
        status: 'downloading',
        progress: 0,
        startedAt: new Date().toISOString()
      };

      downloadQueue = [download, ...downloadQueue];

      // Simulate download progress
      const progressInterval = setInterval(() => {
        const item = downloadQueue.find(d => d.id === download.id);
        if (item && item.progress < 100) {
          item.progress += Math.random() * 20;
          if (item.progress >= 100) {
            item.progress = 100;
            item.status = 'completed';
            clearInterval(progressInterval);
          }
          downloadQueue = [...downloadQueue];
        }
      }, 500);

      // Try real download
      try {
        const response = await fetch(purchase.downloadUrl);
        if (response.ok) {
          console.log('Download initiated successfully');
        }
      } catch (error) {
        console.warn('Download simulation only:', error);
      }

    } catch (error) {
      alert('Failed to download content: ' + error.message);
    }
  }

  // Subscription Functions
  async function subscribeToService(service) {
    if (!initialized) {
      alert('Please initialize your consumer identity first');
      return;
    }

    try {
      const subscription = {
        id: 'sub_' + Date.now(),
        serviceId: service.id,
        serviceName: service.serviceType,
        producer: service.producer,
        producerId: service.producerId,
        pricePerRequest: service.price,
        currency: service.currency,
        subscribedAt: new Date().toISOString(),
        status: 'active',
        totalRequests: 0,
        totalSpent: 0
      };

      subscriptions = [subscription, ...subscriptions];
      localStorage.setItem('consumer-subscriptions', JSON.stringify(subscriptions));

      // Try real API call
      try {
        await api.request('/v1/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: service.id,
            producerId: service.producerId,
            consumerIdentity: consumerProfile.identityKey
          })
        });
      } catch (error) {
        console.warn('Subscription stored locally, API call failed:', error);
      }

      alert(`Successfully subscribed to: ${service.producer} - ${service.serviceType}`);
      updateAnalytics();

    } catch (error) {
      alert('Failed to subscribe to service: ' + error.message);
    }
  }

  async function loadConsumerData() {
    try {
      // Load stored data
      const storedPurchases = localStorage.getItem('consumer-purchases');
      if (storedPurchases) {
        purchaseHistory = JSON.parse(storedPurchases);
      }

      const storedSubscriptions = localStorage.getItem('consumer-subscriptions');
      if (storedSubscriptions) {
        subscriptions = JSON.parse(storedSubscriptions);
      }

      updateAnalytics();
    } catch (error) {
      console.error('Failed to load consumer data:', error);
    }
  }

  function updateAnalytics() {
    consumerAnalytics = {
      totalSpent: purchaseHistory.reduce((sum, p) => sum + p.price, 0),
      totalDownloads: purchaseHistory.length,
      activeSubscriptions: subscriptions.filter(s => s.status === 'active').length,
      favoriteProducers: [...new Set(purchaseHistory.map(p => p.producer))].slice(0, 5)
    };
  }

  // Utility Functions
  function getStatusIcon(status) {
    switch (status) {
      case 'connected':
      case 'registered':
        return '✅';
      case 'checking':
        return '⏳';
      case 'error':
      case 'not-registered':
      case 'not-connected':
        return '❌';
      default:
        return '❓';
    }
  }

  function formatPrice(price, currency = 'BSV') {
    return `${new Intl.NumberFormat().format(price)} ${currency}`;
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString();
  }

  function formatRating(rating) {
    return '⭐'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '⭐' : '') + ` (${rating})`;
  }

  // Tab switching
  function switchTab(tab) {
    activeTab = tab;
    if (tab === 'discover' && discoveredServices.length === 0) {
      discoverServices();
    }
    if (tab === 'search' && searchResults.length === 0) {
      // Don't auto-search, wait for user input
    }
  }
</script>

<div class="consumer-dashboard">
  <div class="header">
    <h1>Consumer Dashboard</h1>
    <p>BSV Overlay Network Consumer Management & Discovery</p>
  </div>

  <!-- Tab Navigation -->
  <nav class="tab-nav">
    <div class="tab-buttons">
      <button
        class="tab-btn"
        class:active={activeTab === 'setup'}
        on:click={() => switchTab('setup')}
      >
        🏠 Setup
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'discover'}
        on:click={() => switchTab('discover')}
      >
        🔍 Discover
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'search'}
        on:click={() => switchTab('search')}
      >
        🔎 Search
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'purchases'}
        on:click={() => switchTab('purchases')}
      >
        🛒 Purchases
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'subscriptions'}
        on:click={() => switchTab('subscriptions')}
      >
        📡 Subscriptions
      </button>
    </div>
  </nav>

  <!-- Tab Content -->
  <div class="tab-content">

    <!-- Setup Tab -->
    {#if activeTab === 'setup'}
      <div class="setup-panel">
        <!-- Connection Status -->
        <div class="status-section">
          <h2>🔌 Connection Status</h2>
          <div class="status-grid">
            <div class="status-item">
              <span class="status-icon">{getStatusIcon(connectionStatus.overlay)}</span>
              <span class="status-label">Overlay Network</span>
              <span class="status-value">{connectionStatus.overlay}</span>
            </div>
            <div class="status-item">
              <span class="status-icon">{getStatusIcon(connectionStatus.database)}</span>
              <span class="status-label">Database</span>
              <span class="status-value">{connectionStatus.database}</span>
            </div>
            <div class="status-item">
              <span class="status-icon">{getStatusIcon(connectionStatus.identity)}</span>
              <span class="status-label">Consumer Identity</span>
              <span class="status-value">{connectionStatus.identity}</span>
            </div>
            <div class="status-item">
              <span class="status-icon">{getStatusIcon(connectionStatus.wallet)}</span>
              <span class="status-label">Wallet</span>
              <span class="status-value">{connectionStatus.wallet}</span>
            </div>
          </div>
        </div>

        <!-- Analytics Overview -->
        {#if initialized}
          <div class="analytics-section">
            <h2>📊 Your Activity</h2>
            <div class="analytics-grid">
              <div class="analytics-item">
                <div class="analytics-icon">💰</div>
                <div class="analytics-content">
                  <h3>Total Spent</h3>
                  <div class="analytics-value">{formatPrice(consumerAnalytics.totalSpent)}</div>
                </div>
              </div>
              <div class="analytics-item">
                <div class="analytics-icon">📥</div>
                <div class="analytics-content">
                  <h3>Downloads</h3>
                  <div class="analytics-value">{consumerAnalytics.totalDownloads}</div>
                </div>
              </div>
              <div class="analytics-item">
                <div class="analytics-icon">📡</div>
                <div class="analytics-content">
                  <h3>Active Subscriptions</h3>
                  <div class="analytics-value">{consumerAnalytics.activeSubscriptions}</div>
                </div>
              </div>
            </div>
          </div>
        {/if}

        {#if !initialized}
          <!-- Consumer Setup Form -->
          <div class="setup-form">
            <h2>🔧 Initialize Consumer</h2>
            <form on:submit|preventDefault={initializeConsumer}>
              <div class="form-grid">
                <div class="form-group">
                  <label for="displayName">Consumer Name *</label>
                  <input
                    id="displayName"
                    type="text"
                    bind:value={consumerProfile.displayName}
                    required
                    placeholder="My Company"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label for="contactEmail">Contact Email *</label>
                  <input
                    id="contactEmail"
                    type="email"
                    bind:value={consumerProfile.contactEmail}
                    required
                    placeholder="contact@company.com"
                    class="form-input"
                  />
                </div>

                <div class="form-group span-2">
                  <label for="description">Description</label>
                  <textarea
                    id="description"
                    bind:value={consumerProfile.description}
                    placeholder="Brief description of your use case"
                    class="form-input"
                    rows="3"
                  ></textarea>
                </div>

                <div class="form-group">
                  <label for="website">Website</label>
                  <input
                    id="website"
                    type="url"
                    bind:value={consumerProfile.website}
                    placeholder="https://company.com"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label for="region">Default Region</label>
                  <select id="region" bind:value={consumerProfile.region} class="form-input">
                    <option value="global">Global</option>
                    <option value="north-america">North America</option>
                    <option value="europe">Europe</option>
                    <option value="asia-pacific">Asia Pacific</option>
                  </select>
                </div>
              </div>

              <div class="form-actions">
                <button
                  type="submit"
                  disabled={loading || !consumerProfile.displayName || !consumerProfile.contactEmail}
                  class="btn btn-primary"
                >
                  {loading ? 'Initializing...' : 'Initialize Consumer'}
                </button>
              </div>
            </form>
          </div>
        {:else}
          <!-- Consumer Profile Display -->
          <div class="profile-section">
            <h2>👤 Consumer Profile</h2>
            <div class="profile-grid">
              <div class="profile-item">
                <label>Consumer ID</label>
                <code>{consumerProfile.consumerId}</code>
              </div>
              <div class="profile-item">
                <label>Identity Key</label>
                <code>{consumerProfile.identityKey}</code>
              </div>
              <div class="profile-item">
                <label>Display Name</label>
                <span>{consumerProfile.displayName}</span>
              </div>
              <div class="profile-item">
                <label>Contact Email</label>
                <span>{consumerProfile.contactEmail}</span>
              </div>
              <div class="profile-item span-2">
                <label>Description</label>
                <span>{consumerProfile.description || 'No description provided'}</span>
              </div>
            </div>

            <div class="profile-actions">
              <button on:click={resetIdentity} class="btn btn-danger">
                Reset Identity
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Discover Tab -->
    {#if activeTab === 'discover'}
      <div class="discover-panel">
        <!-- Discovery Filters -->
        <div class="filters-section">
          <h2>🔍 Service Discovery</h2>
          <div class="filters-grid">
            <div class="filter-group">
              <label for="serviceType">Service Type</label>
              <select id="serviceType" bind:value={discoveryFilters.serviceType} class="form-input">
                <option value="">All Services</option>
                {#each serviceTypes as type}
                  <option value={type}>{type}</option>
                {/each}
              </select>
            </div>

            <div class="filter-group">
              <label for="capabilities">Capabilities</label>
              <input
                id="capabilities"
                type="text"
                bind:value={discoveryFilters.capabilities}
                placeholder="streaming, encoding, real-time"
                class="form-input"
              />
            </div>

            <div class="filter-group">
              <label for="maxPrice">Max Price (sats)</label>
              <input
                id="maxPrice"
                type="number"
                bind:value={discoveryFilters.maxPrice}
                placeholder="1000"
                class="form-input"
              />
            </div>

            <div class="filter-group">
              <label for="location">Location</label>
              <select id="location" bind:value={discoveryFilters.location} class="form-input">
                <option value="any">Any Location</option>
                <option value="North America">North America</option>
                <option value="Europe">Europe</option>
                <option value="Asia Pacific">Asia Pacific</option>
                <option value="Global">Global</option>
              </select>
            </div>
          </div>

          <div class="filter-actions">
            <button on:click={discoverServices} class="btn btn-primary" disabled={discoveryLoading}>
              {discoveryLoading ? 'Discovering...' : '🔍 Discover Services'}
            </button>
          </div>
        </div>

        <!-- Discovery Results -->
        <div class="results-section">
          <h2>📡 Available Services</h2>

          {#if discoveryLoading}
            <div class="loading">⏳ Discovering services...</div>
          {:else if discoveredServices.length === 0}
            <div class="empty-state">
              <p>🔍 No services found</p>
              <p>Try adjusting your filters or discover all available services.</p>
            </div>
          {:else}
            <div class="services-grid">
              {#each discoveredServices as service}
                <div class="service-card">
                  <div class="service-header">
                    <h3>{service.producer}</h3>
                    <div class="service-type">{service.serviceType}</div>
                  </div>

                  <div class="service-details">
                    <p class="service-description">{service.description}</p>

                    <div class="service-info">
                      <div class="info-row">
                        <span class="info-label">Price:</span>
                        <span class="info-value">{formatPrice(service.price, service.currency)}/request</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Location:</span>
                        <span class="info-value">{service.location}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Availability:</span>
                        <span class="info-value">{service.availability}%</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Rating:</span>
                        <span class="info-value">{formatRating(service.reputation)}</span>
                      </div>
                    </div>

                    <div class="service-capabilities">
                      <span class="capabilities-label">Capabilities:</span>
                      <div class="capabilities-list">
                        {#each service.capabilities as capability}
                          <span class="capability-badge">{capability}</span>
                        {/each}
                      </div>
                    </div>
                  </div>

                  <div class="service-actions">
                    <button
                      on:click={() => subscribeToService(service)}
                      class="btn btn-primary"
                      disabled={!initialized}
                    >
                      📡 Subscribe
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Search Tab -->
    {#if activeTab === 'search'}
      <div class="search-panel">
        <!-- Search Filters -->
        <div class="search-section">
          <h2>🔎 Content Search</h2>
          <div class="search-grid">
            <div class="search-group">
              <label for="contentType">Content Type</label>
              <input
                id="contentType"
                type="text"
                bind:value={searchQuery.contentType}
                placeholder="application/json"
                class="form-input"
              />
            </div>

            <div class="search-group">
              <label for="tags">Tags</label>
              <input
                id="tags"
                type="text"
                bind:value={searchQuery.tags}
                placeholder="finance, data, real-time"
                class="form-input"
              />
            </div>

            <div class="search-group">
              <label for="searchMaxPrice">Max Price (sats)</label>
              <input
                id="searchMaxPrice"
                type="number"
                bind:value={searchQuery.maxPrice}
                placeholder="1000"
                class="form-input"
              />
            </div>

            <div class="search-group">
              <label for="producerSearch">Producer</label>
              <input
                id="producerSearch"
                type="text"
                bind:value={searchQuery.producer}
                placeholder="Producer name"
                class="form-input"
              />
            </div>

            <div class="search-group">
              <label for="limit">Results Limit</label>
              <select id="limit" bind:value={searchQuery.limit} class="form-input">
                <option value={5}>5 results</option>
                <option value={10}>10 results</option>
                <option value={25}>25 results</option>
                <option value={50}>50 results</option>
              </select>
            </div>
          </div>

          <div class="search-actions">
            <button on:click={searchContent} class="btn btn-primary" disabled={searchLoading}>
              {searchLoading ? 'Searching...' : '🔎 Search Content'}
            </button>
          </div>
        </div>

        <!-- Search Results -->
        <div class="results-section">
          <h2>📋 Search Results</h2>

          {#if searchLoading}
            <div class="loading">⏳ Searching content...</div>
          {:else if searchResults.length === 0}
            <div class="empty-state">
              <p>🔎 No content found</p>
              <p>Try searching with different criteria or browse all available content.</p>
            </div>
          {:else}
            <div class="content-grid">
              {#each searchResults as content}
                <div class="content-card">
                  <div class="content-header">
                    <h3>{content.title}</h3>
                    <div class="content-price">{formatPrice(content.price, content.currency)}</div>
                  </div>

                  <div class="content-details">
                    <p class="content-description">{content.description}</p>

                    <div class="content-info">
                      <div class="info-row">
                        <span class="info-label">Producer:</span>
                        <span class="info-value">{content.producer}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Type:</span>
                        <span class="info-value">{content.contentType}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Size:</span>
                        <span class="info-value">{content.size}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Rating:</span>
                        <span class="info-value">{formatRating(content.rating)}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Downloads:</span>
                        <span class="info-value">{content.downloads}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Created:</span>
                        <span class="info-value">{formatDate(content.created)}</span>
                      </div>
                    </div>

                    <div class="content-tags">
                      <span class="tags-label">Tags:</span>
                      <div class="tags-list">
                        {#each content.tags as tag}
                          <span class="tag-badge">{tag}</span>
                        {/each}
                      </div>
                    </div>
                  </div>

                  <div class="content-actions">
                    <button
                      on:click={() => purchaseContent(content)}
                      class="btn btn-primary"
                      disabled={!initialized}
                    >
                      🛒 Purchase
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Purchases Tab -->
    {#if activeTab === 'purchases'}
      <div class="purchases-panel">
        <div class="purchases-header">
          <h2>🛒 Purchase History</h2>
          <div class="purchases-summary">
            <span>Total Purchases: {purchaseHistory.length}</span>
            <span>Total Spent: {formatPrice(consumerAnalytics.totalSpent)}</span>
          </div>
        </div>

        {#if purchaseHistory.length === 0}
          <div class="empty-state">
            <p>🛒 No purchases yet</p>
            <p>Search and purchase content to build your library.</p>
            <button on:click={() => switchTab('search')} class="btn btn-primary">
              🔎 Search Content
            </button>
          </div>
        {:else}
          <div class="purchases-grid">
            {#each purchaseHistory as purchase}
              <div class="purchase-card">
                <div class="purchase-header">
                  <h3>{purchase.contentTitle}</h3>
                  <div class="purchase-price">{formatPrice(purchase.price, purchase.currency)}</div>
                </div>

                <div class="purchase-details">
                  <div class="detail-row">
                    <span class="detail-label">Producer:</span>
                    <span class="detail-value">{purchase.producer}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Purchased:</span>
                    <span class="detail-value">{formatDate(purchase.purchasedAt)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value status-{purchase.status}">{purchase.status}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">UHRP Hash:</span>
                    <code class="detail-value">{purchase.uhrpHash}</code>
                  </div>
                </div>

                <div class="purchase-actions">
                  <button
                    on:click={() => downloadContent(purchase)}
                    class="btn btn-secondary"
                  >
                    📥 Download
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Download Queue -->
        {#if downloadQueue.length > 0}
          <div class="download-section">
            <h3>📥 Download Queue</h3>
            <div class="download-queue">
              {#each downloadQueue as download}
                <div class="download-item">
                  <div class="download-info">
                    <span class="download-title">{download.title}</span>
                    <span class="download-status">{download.status}</span>
                  </div>
                  <div class="download-progress">
                    <div class="progress-bar">
                      <div class="progress-fill" style="width: {download.progress}%"></div>
                    </div>
                    <span class="progress-text">{Math.round(download.progress)}%</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Subscriptions Tab -->
    {#if activeTab === 'subscriptions'}
      <div class="subscriptions-panel">
        <div class="subscriptions-header">
          <h2>📡 Active Subscriptions</h2>
          <div class="subscriptions-summary">
            <span>Active: {consumerAnalytics.activeSubscriptions}</span>
            <span>Total: {subscriptions.length}</span>
          </div>
        </div>

        {#if subscriptions.length === 0}
          <div class="empty-state">
            <p>📡 No subscriptions yet</p>
            <p>Discover and subscribe to services for ongoing access.</p>
            <button on:click={() => switchTab('discover')} class="btn btn-primary">
              🔍 Discover Services
            </button>
          </div>
        {:else}
          <div class="subscriptions-grid">
            {#each subscriptions as subscription}
              <div class="subscription-card">
                <div class="subscription-header">
                  <h3>{subscription.producer}</h3>
                  <div class="subscription-status status-{subscription.status}">{subscription.status}</div>
                </div>

                <div class="subscription-details">
                  <div class="detail-row">
                    <span class="detail-label">Service:</span>
                    <span class="detail-value">{subscription.serviceName}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Price:</span>
                    <span class="detail-value">{formatPrice(subscription.pricePerRequest, subscription.currency)}/request</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Subscribed:</span>
                    <span class="detail-value">{formatDate(subscription.subscribedAt)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Requests:</span>
                    <span class="detail-value">{subscription.totalRequests}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Total Spent:</span>
                    <span class="detail-value">{formatPrice(subscription.totalSpent, subscription.currency)}</span>
                  </div>
                </div>

                <div class="subscription-actions">
                  <button class="btn btn-secondary">📊 View Usage</button>
                  <button class="btn btn-danger">❌ Unsubscribe</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .consumer-dashboard {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    font-size: 2rem;
    color: #f0f6fc;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .header p {
    color: #6e7681;
  }

  /* Tab Navigation */
  .tab-nav {
    margin-bottom: 2rem;
  }

  .tab-buttons {
    display: flex;
    border-bottom: 1px solid #30363d;
  }

  .tab-btn {
    background: none;
    border: none;
    padding: 1rem 1.5rem;
    color: #6e7681;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    font-family: inherit;
  }

  .tab-btn:hover {
    color: #f0f6fc;
    background: #21262d;
  }

  .tab-btn.active {
    color: #58a6ff;
    border-bottom-color: #58a6ff;
  }

  /* Common Panel Styles */
  .setup-panel, .discover-panel, .search-panel, .purchases-panel, .subscriptions-panel {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .status-section, .analytics-section, .setup-form, .profile-section,
  .filters-section, .search-section, .results-section {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .status-section h2, .analytics-section h2, .setup-form h2, .profile-section h2,
  .filters-section h2, .search-section h2, .results-section h2 {
    color: #f0f6fc;
    margin-bottom: 1rem;
    font-size: 1.25rem;
    font-weight: 600;
  }

  /* Status Grid */
  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
  }

  .status-icon {
    font-size: 1.25rem;
  }

  .status-label {
    font-weight: 600;
    flex: 1;
    color: #f0f6fc;
  }

  .status-value {
    text-transform: capitalize;
    color: #6e7681;
  }

  /* Analytics Grid */
  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .analytics-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
  }

  .analytics-icon {
    font-size: 1.5rem;
    background: #21262d;
    border: 1px solid #30363d;
    padding: 0.75rem;
    border-radius: 50%;
  }

  .analytics-content h3 {
    margin: 0 0 0.25rem 0;
    color: #6e7681;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .analytics-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f0f6fc;
  }

  /* Form Styles */
  .form-grid, .filters-grid, .search-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .form-group, .filter-group, .search-group {
    display: flex;
    flex-direction: column;
  }

  .span-2 {
    grid-column: span 2;
  }

  .form-group label, .filter-group label, .search-group label {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #f0f6fc;
  }

  .form-input {
    padding: 0.75rem;
    border: 1px solid #30363d;
    border-radius: 6px;
    font-size: 1rem;
    background: #0d1117;
    color: #f0f6fc;
    font-family: inherit;
  }

  .form-input:focus {
    outline: none;
    border-color: #58a6ff;
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1);
  }

  .form-input::placeholder {
    color: #6e7681;
  }

  .form-actions, .filter-actions, .search-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }

  /* Profile Grid */
  .profile-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .profile-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .profile-item label {
    font-weight: 600;
    color: #6e7681;
    font-size: 0.875rem;
  }

  .profile-item code {
    background: #0d1117;
    border: 1px solid #21262d;
    padding: 0.5rem;
    border-radius: 4px;
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 0.875rem;
    word-break: break-all;
    color: #f0f6fc;
  }

  .profile-item span {
    color: #f0f6fc;
  }

  .profile-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }

  /* Grid Layouts */
  .services-grid, .content-grid, .purchases-grid, .subscriptions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  /* Card Styles */
  .service-card, .content-card, .purchase-card, .subscription-card {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 1.5rem;
  }

  .service-header, .content-header, .purchase-header, .subscription-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .service-header h3, .content-header h3, .purchase-header h3, .subscription-header h3 {
    margin: 0;
    color: #f0f6fc;
  }

  .service-type, .content-price, .purchase-price {
    background: #238636;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .subscription-status {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .status-active {
    background: #238636;
    color: white;
  }

  .status-completed {
    background: #238636;
    color: white;
  }

  .status-inactive {
    background: #da3633;
    color: white;
  }

  .service-description, .content-description {
    color: #6e7681;
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .service-info, .content-info {
    margin-bottom: 1rem;
  }

  .info-row, .detail-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .info-label, .detail-label {
    font-weight: 600;
    color: #6e7681;
  }

  .info-value, .detail-value {
    color: #f0f6fc;
  }

  .service-capabilities, .content-tags {
    margin-bottom: 1rem;
  }

  .capabilities-label, .tags-label {
    font-weight: 600;
    color: #6e7681;
    display: block;
    margin-bottom: 0.5rem;
  }

  .capabilities-list, .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .capability-badge, .tag-badge {
    padding: 0.25rem 0.5rem;
    background: #0d1117;
    border: 1px solid #30363d;
    color: #58a6ff;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .service-actions, .content-actions, .purchase-actions, .subscription-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  /* Header Styles */
  .purchases-header, .subscriptions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #30363d;
  }

  .purchases-summary, .subscriptions-summary {
    display: flex;
    gap: 2rem;
    color: #6e7681;
    font-size: 0.875rem;
  }

  /* Download Queue */
  .download-section {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 1.5rem;
    margin-top: 1.5rem;
  }

  .download-section h3 {
    color: #f0f6fc;
    margin-bottom: 1rem;
  }

  .download-queue {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .download-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
  }

  .download-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .download-title {
    color: #f0f6fc;
    font-weight: 600;
  }

  .download-status {
    color: #6e7681;
    font-size: 0.875rem;
  }

  .download-progress {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-width: 200px;
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: #21262d;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #238636;
    transition: width 0.3s ease;
  }

  .progress-text {
    color: #f0f6fc;
    font-size: 0.875rem;
    font-weight: 600;
    min-width: 40px;
  }

  /* Common Utility Styles */
  .loading, .empty-state {
    text-align: center;
    padding: 2rem;
    color: #6e7681;
  }

  .empty-state p {
    margin-bottom: 1rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    font-family: inherit;
  }

  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }

  .btn-primary {
    background: #238636;
    color: white;
    border: 1px solid #238636;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2ea043;
    border-color: #2ea043;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #21262d;
    color: #f0f6fc;
    border: 1px solid #30363d;
  }

  .btn-secondary:hover {
    background: #30363d;
    border-color: #58a6ff;
  }

  .btn-danger {
    background: #da3633;
    color: white;
    border: 1px solid #da3633;
  }

  .btn-danger:hover {
    background: #f85149;
    border-color: #f85149;
  }

  code {
    background: #0d1117;
    border: 1px solid #21262d;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 0.875rem;
    color: #f0f6fc;
  }
</style>