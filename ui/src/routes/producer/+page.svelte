<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let producerProfile = {
    producerId: '',
    identityKey: '',
    displayName: '',
    description: '',
    region: 'global',
    contactEmail: '',
    website: ''
  };

  let connectionStatus = {
    overlay: 'checking',
    database: 'checking',
    identity: 'checking'
  };

  let loading = false;
  let initialized = false;
  let overlayUrl = 'http://localhost:8788';

  onMount(async () => {
    await checkProducerStatus();
  });

  async function checkProducerStatus() {
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

      // Check if producer is already initialized
      try {
        const identity = localStorage.getItem('producer-identity');
        if (identity) {
          const parsedIdentity = JSON.parse(identity);
          producerProfile = { ...producerProfile, ...parsedIdentity };
          connectionStatus.identity = 'registered';
          initialized = true;
        } else {
          connectionStatus.identity = 'not-registered';
        }
      } catch {
        connectionStatus.identity = 'error';
      }

    } finally {
      loading = false;
    }
  }

  async function initializeProducer() {
    try {
      loading = true;

      // Generate identity key (simulate CLI behavior)
      const identityKey = 'producer_' + Math.random().toString(36).substr(2, 16);
      const producerId = producerProfile.displayName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();

      const newProfile = {
        ...producerProfile,
        producerId,
        identityKey,
        createdAt: new Date().toISOString()
      };

      // Store locally (simulate CLI config file)
      localStorage.setItem('producer-identity', JSON.stringify(newProfile));

      // Register with overlay network
      try {
        const response = await api.request('/v1/producers/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            producerId: newProfile.producerId,
            identityKey: newProfile.identityKey,
            displayName: newProfile.displayName,
            description: newProfile.description,
            contactEmail: newProfile.contactEmail,
            website: newProfile.website,
            region: newProfile.region
          })
        });

        producerProfile = newProfile;
        connectionStatus.identity = 'registered';
        initialized = true;

        alert('Producer identity initialized successfully!');

      } catch (error) {
        // Even if API fails, keep local identity for development
        producerProfile = newProfile;
        connectionStatus.identity = 'registered';
        initialized = true;
        console.warn('Producer registered locally, API registration failed:', error);
      }

    } catch (error) {
      alert('Failed to initialize producer: ' + error.message);
    } finally {
      loading = false;
    }
  }

  async function resetIdentity() {
    if (confirm('Are you sure you want to reset your producer identity? This action cannot be undone.')) {
      localStorage.removeItem('producer-identity');
      producerProfile = {
        producerId: '',
        identityKey: '',
        displayName: '',
        description: '',
        region: 'global',
        contactEmail: '',
        website: ''
      };
      connectionStatus.identity = 'not-registered';
      initialized = false;
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'connected':
      case 'registered':
        return '✅';
      case 'checking':
        return '⏳';
      case 'error':
      case 'not-registered':
        return '❌';
      default:
        return '❓';
    }
  }
</script>

<div class="producer-setup">
  <!-- Producer Navigation -->
  <nav class="producer-nav">
    <div class="nav-tabs">
      <a href="/producer" class="nav-tab active">🏭 Setup</a>
      <a href="/producer/analytics" class="nav-tab">📊 Analytics</a>
      <a href="/producer/services" class="nav-tab">🔧 Services</a>
    </div>
  </nav>

  <div class="header">
    <h1>Producer Identity Setup</h1>
    <p>Initialize and manage your BSV Overlay Network producer identity</p>
  </div>

  <!-- Connection Status -->
  <div class="status-panel">
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
        <span class="status-label">Producer Identity</span>
        <span class="status-value">{connectionStatus.identity}</span>
      </div>
    </div>
  </div>

  {#if !initialized}
    <!-- Producer Setup Form -->
    <div class="setup-form">
      <h2>🔧 Initialize Producer</h2>
      <form on:submit|preventDefault={initializeProducer}>
        <div class="form-grid">
          <div class="form-group">
            <label for="displayName">Producer Name *</label>
            <input
              id="displayName"
              type="text"
              bind:value={producerProfile.displayName}
              required
              placeholder="My Data Company"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="contactEmail">Contact Email *</label>
            <input
              id="contactEmail"
              type="email"
              bind:value={producerProfile.contactEmail}
              required
              placeholder="contact@company.com"
              class="form-input"
            />
          </div>

          <div class="form-group span-2">
            <label for="description">Description</label>
            <textarea
              id="description"
              bind:value={producerProfile.description}
              placeholder="Brief description of your data services"
              class="form-input"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="website">Website</label>
            <input
              id="website"
              type="url"
              bind:value={producerProfile.website}
              placeholder="https://company.com"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="region">Default Region</label>
            <select id="region" bind:value={producerProfile.region} class="form-input">
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
            disabled={loading || !producerProfile.displayName || !producerProfile.contactEmail}
            class="btn btn-primary"
          >
            {loading ? 'Initializing...' : 'Initialize Producer'}
          </button>
        </div>
      </form>
    </div>
  {:else}
    <!-- Producer Profile Display -->
    <div class="profile-panel">
      <h2>👤 Producer Profile</h2>
      <div class="profile-grid">
        <div class="profile-item">
          <label>Producer ID</label>
          <code>{producerProfile.producerId}</code>
        </div>
        <div class="profile-item">
          <label>Identity Key</label>
          <code>{producerProfile.identityKey}</code>
        </div>
        <div class="profile-item">
          <label>Display Name</label>
          <span>{producerProfile.displayName}</span>
        </div>
        <div class="profile-item">
          <label>Contact Email</label>
          <span>{producerProfile.contactEmail}</span>
        </div>
        <div class="profile-item span-2">
          <label>Description</label>
          <span>{producerProfile.description || 'No description provided'}</span>
        </div>
      </div>

      <div class="profile-actions">
        <button on:click={resetIdentity} class="btn btn-danger">
          Reset Identity
        </button>
        <a href="/producer/analytics" class="btn btn-secondary">
          View Analytics
        </a>
        <a href="/producer/services" class="btn btn-secondary">
          Manage Services
        </a>
      </div>
    </div>
  {/if}
</div>

<style>
  .producer-setup {
    max-width: 1200px;
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

  .status-panel, .setup-form, .profile-panel {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .status-panel h2, .setup-form h2, .profile-panel h2 {
    color: #f0f6fc;
    margin-bottom: 1rem;
    font-size: 1.25rem;
    font-weight: 600;
  }

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
    background: #0d1117;
    border: 1px solid #21262d;
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

  .form-actions {
    margin-top: 1.5rem;
    display: flex;
    justify-content: flex-end;
  }

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
    gap: 1rem;
    justify-content: flex-end;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s;
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
</style>