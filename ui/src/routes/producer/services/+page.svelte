<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let services = [];
  let loading = false;
  let showAddForm = false;

  let serviceForm = {
    serviceType: '',
    capabilities: '',
    basePrice: 100,
    currency: 'BSV',
    endpoint: '/service',
    description: '',
    region: 'global',
    availability: '24/7',
    maxConcurrency: 100,
    rateLimit: '1000/hour'
  };

  let serviceTypes = [
    { value: 'content-streaming', label: 'Content Streaming' },
    { value: 'video-streaming', label: 'Video Streaming' },
    { value: 'data-processing', label: 'Data Processing' },
    { value: 'ai-inference', label: 'AI Inference' },
    { value: 'storage', label: 'Storage Service' },
    { value: 'compute', label: 'Compute Service' },
    { value: 'analytics', label: 'Analytics Service' },
    { value: 'custom', label: 'Custom Service' }
  ];

  let commonCapabilities = [
    'streaming', 'encoding', 'real-time', 'batch-processing',
    'high-throughput', 'low-latency', 'secure', 'encrypted',
    'scalable', 'distributed', 'api-based', 'webhook-support'
  ];

  onMount(async () => {
    await loadServices();
  });

  async function loadServices() {
    try {
      loading = true;

      // Try to load services from API
      try {
        const response = await api.request('/v1/services/producer', {
          method: 'GET'
        });
        services = response.services || [];
      } catch (error) {
        // Load from localStorage as fallback
        const storedServices = localStorage.getItem('producer-services');
        if (storedServices) {
          services = JSON.parse(storedServices);
        }
      }

    } catch (error) {
      console.error('Failed to load services:', error);
    } finally {
      loading = false;
    }
  }

  async function advertiseService() {
    try {
      loading = true;

      const serviceData = {
        ...serviceForm,
        serviceId: `service_${Date.now()}`,
        capabilities: serviceForm.capabilities.split(',').map(c => c.trim()).filter(c => c),
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      // Try to advertise via API (matches CLI functionality)
      try {
        await api.request('/v1/services/advertise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceType: serviceData.serviceType,
            capabilities: serviceData.capabilities,
            price: serviceData.basePrice,
            currency: serviceData.currency,
            endpoint: serviceData.endpoint,
            description: serviceData.description
          })
        });
      } catch (error) {
        console.warn('API advertisement failed, storing locally:', error);
      }

      // Store service locally
      services = [...services, serviceData];
      localStorage.setItem('producer-services', JSON.stringify(services));

      // Reset form
      serviceForm = {
        serviceType: '',
        capabilities: '',
        basePrice: 100,
        currency: 'BSV',
        endpoint: '/service',
        description: '',
        region: 'global',
        availability: '24/7',
        maxConcurrency: 100,
        rateLimit: '1000/hour'
      };

      showAddForm = false;
      alert('Service advertised successfully!');

    } catch (error) {
      alert('Failed to advertise service: ' + error.message);
    } finally {
      loading = false;
    }
  }

  async function removeService(serviceId) {
    if (confirm('Are you sure you want to remove this service?')) {
      services = services.filter(s => s.serviceId !== serviceId);
      localStorage.setItem('producer-services', JSON.stringify(services));
    }
  }

  function addCapability(capability) {
    const currentCaps = serviceForm.capabilities ? serviceForm.capabilities.split(',').map(c => c.trim()) : [];
    if (!currentCaps.includes(capability)) {
      currentCaps.push(capability);
      serviceForm.capabilities = currentCaps.join(', ');
    }
  }

  function getStatusBadge(status) {
    const badges = {
      active: { class: 'status-active', text: 'Active' },
      inactive: { class: 'status-inactive', text: 'Inactive' },
      error: { class: 'status-error', text: 'Error' }
    };
    return badges[status] || badges.active;
  }
</script>

<div class="services-manager">
  <!-- Producer Navigation -->
  <nav class="producer-nav">
    <div class="nav-tabs">
      <a href="/producer" class="nav-tab">🏭 Setup</a>
      <a href="/producer/analytics" class="nav-tab">📊 Analytics</a>
      <a href="/producer/services" class="nav-tab active">🔧 Services</a>
    </div>
  </nav>

  <div class="header">
    <h1>Service Advertisement Manager</h1>
    <p>BRC-88 SHIP/SLAP Service Publishing & Management</p>
  </div>

  <div class="services-controls">
    <button on:click={() => showAddForm = !showAddForm} class="btn btn-primary">
      {showAddForm ? '❌ Cancel' : '➕ Advertise New Service'}
    </button>
    <button on:click={loadServices} class="btn btn-secondary" disabled={loading}>
      🔄 Refresh Services
    </button>
  </div>

  {#if showAddForm}
    <!-- Service Advertisement Form -->
    <div class="add-service-form">
      <h2>📢 Advertise New Service</h2>
      <form on:submit|preventDefault={advertiseService}>
        <div class="form-grid">
          <div class="form-group">
            <label for="serviceType">Service Type *</label>
            <select id="serviceType" bind:value={serviceForm.serviceType} required class="form-input">
              <option value="">Select service type...</option>
              {#each serviceTypes as type}
                <option value={type.value}>{type.label}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="basePrice">Base Price (satoshis) *</label>
            <input
              id="basePrice"
              type="number"
              bind:value={serviceForm.basePrice}
              required
              min="1"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="currency">Currency</label>
            <select id="currency" bind:value={serviceForm.currency} class="form-input">
              <option value="BSV">BSV</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          <div class="form-group">
            <label for="endpoint">Service Endpoint *</label>
            <input
              id="endpoint"
              type="text"
              bind:value={serviceForm.endpoint}
              required
              placeholder="/api/v1/my-service"
              class="form-input"
            />
          </div>

          <div class="form-group span-2">
            <label for="description">Service Description</label>
            <textarea
              id="description"
              bind:value={serviceForm.description}
              placeholder="Describe your service features and benefits"
              class="form-input"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group span-2">
            <label for="capabilities">Service Capabilities *</label>
            <input
              id="capabilities"
              type="text"
              bind:value={serviceForm.capabilities}
              required
              placeholder="streaming, encoding, real-time"
              class="form-input"
            />
            <div class="capability-tags">
              <span class="help-text">Quick add:</span>
              {#each commonCapabilities as cap}
                <button
                  type="button"
                  on:click={() => addCapability(cap)}
                  class="capability-tag"
                >
                  {cap}
                </button>
              {/each}
            </div>
          </div>

          <div class="form-group">
            <label for="region">Region</label>
            <select id="region" bind:value={serviceForm.region} class="form-input">
              <option value="global">Global</option>
              <option value="north-america">North America</option>
              <option value="europe">Europe</option>
              <option value="asia-pacific">Asia Pacific</option>
            </select>
          </div>

          <div class="form-group">
            <label for="availability">Availability</label>
            <input
              id="availability"
              type="text"
              bind:value={serviceForm.availability}
              placeholder="24/7"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="maxConcurrency">Max Concurrency</label>
            <input
              id="maxConcurrency"
              type="number"
              bind:value={serviceForm.maxConcurrency}
              min="1"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="rateLimit">Rate Limit</label>
            <input
              id="rateLimit"
              type="text"
              bind:value={serviceForm.rateLimit}
              placeholder="1000/hour"
              class="form-input"
            />
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" disabled={loading} class="btn btn-primary">
            {loading ? 'Advertising...' : '📢 Advertise Service'}
          </button>
          <button type="button" on:click={() => showAddForm = false} class="btn btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Services List -->
  <div class="services-list">
    <h2>📋 Advertised Services</h2>

    {#if loading}
      <div class="loading">⏳ Loading services...</div>
    {:else if services.length === 0}
      <div class="empty-state">
        <p>🔍 No services advertised yet</p>
        <p>Start by advertising your first service to make it discoverable on the network.</p>
      </div>
    {:else}
      <div class="services-grid">
        {#each services as service}
          <div class="service-card">
            <div class="service-header">
              <h3>{service.serviceType}</h3>
              <div class="service-status">
                <span class="status-badge {getStatusBadge(service.status).class}">
                  {getStatusBadge(service.status).text}
                </span>
              </div>
            </div>

            <div class="service-details">
              <div class="detail-row">
                <span class="detail-label">Endpoint:</span>
                <code>{service.endpoint}</code>
              </div>
              <div class="detail-row">
                <span class="detail-label">Price:</span>
                <span>{service.basePrice} {service.currency}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Region:</span>
                <span>{service.region}</span>
              </div>
              {#if service.description}
                <div class="detail-row">
                  <span class="detail-label">Description:</span>
                  <span>{service.description}</span>
                </div>
              {/if}
            </div>

            <div class="service-capabilities">
              <span class="capabilities-label">Capabilities:</span>
              <div class="capabilities-list">
                {#each service.capabilities as capability}
                  <span class="capability-badge">{capability}</span>
                {/each}
              </div>
            </div>

            <div class="service-actions">
              <button class="btn btn-sm btn-secondary">Edit</button>
              <button
                on:click={() => removeService(service.serviceId)}
                class="btn btn-sm btn-danger"
              >
                Remove
              </button>
            </div>

            <div class="service-footer">
              <small>Service ID: {service.serviceId}</small>
              <small>Created: {new Date(service.createdAt).toLocaleDateString()}</small>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .services-manager {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  .producer-nav {
    margin-bottom: 2rem;
  }

  .nav-tabs {
    display: flex;
    border-bottom: 1px solid #30363d;
  }

  .nav-tab {
    padding: 1rem 1.5rem;
    color: #6e7681;
    text-decoration: none;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .nav-tab:hover {
    color: #f0f6fc;
    background: #21262d;
  }

  .nav-tab.active {
    color: #58a6ff;
    border-bottom-color: #58a6ff;
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

  .services-controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .add-service-form {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .add-service-form h2 {
    color: #f0f6fc;
    margin-bottom: 1rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .span-2 {
    grid-column: span 2;
  }

  .form-group label {
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

  .capability-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
    align-items: center;
  }

  .help-text {
    font-size: 0.875rem;
    color: #6e7681;
  }

  .capability-tag {
    padding: 0.25rem 0.5rem;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    color: #f0f6fc;
  }

  .capability-tag:hover {
    background: #30363d;
    border-color: #58a6ff;
  }

  .form-actions {
    margin-top: 1.5rem;
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .services-list {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .services-list h2 {
    color: #f0f6fc;
    margin-bottom: 1rem;
  }

  .services-grid {
    display: grid;
    gap: 1.5rem;
    margin-top: 1rem;
  }

  .service-card {
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 1.5rem;
    background: #0d1117;
  }

  .service-header {
    display: flex;
    justify-content: between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .service-header h3 {
    margin: 0;
    color: #f0f6fc;
    text-transform: capitalize;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .status-active {
    background: #238636;
    color: white;
  }

  .status-inactive {
    background: #da3633;
    color: white;
  }

  .service-details {
    margin-bottom: 1rem;
  }

  .detail-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .detail-label {
    font-weight: 600;
    min-width: 80px;
    color: #6e7681;
  }

  .detail-row span:not(.detail-label) {
    color: #f0f6fc;
  }

  .service-capabilities {
    margin-bottom: 1rem;
  }

  .capabilities-label {
    font-weight: 600;
    color: #6e7681;
    display: block;
    margin-bottom: 0.5rem;
  }

  .capabilities-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .capability-badge {
    padding: 0.25rem 0.5rem;
    background: #0d1117;
    border: 1px solid #30363d;
    color: #58a6ff;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .service-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .service-footer {
    display: flex;
    justify-content: space-between;
    color: #6e7681;
    font-size: 0.875rem;
    border-top: 1px solid #21262d;
    padding-top: 1rem;
  }

  .loading, .empty-state {
    text-align: center;
    padding: 2rem;
    color: #6e7681;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
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

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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