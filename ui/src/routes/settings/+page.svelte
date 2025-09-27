<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { certificateService } from '$lib/services/certificateService';
  import { bsvWalletService } from '$lib/bsv-wallet';

  let activeTab = 'profile'; // Default to profile tab
  let overlayUrl = 'http://localhost:8788';

  // Clean unified identity - no legacy compatibility
  let identity = {
    id: '',
    key: '',
    displayName: '',
    description: '',
    region: 'global',
    contactEmail: '',
    website: '',
    preferences: {
      maxPricePerKB: 0.1,
      preferredFormats: [],
      autoDownload: false
    }
  };

  let identityStatus = {
    overlay: 'checking',
    database: 'checking',
    identity: 'checking'
  };

  let identityLoading = false;
  let identityInitialized = false;
  let loading = false;

  // Certificate management variables
  let userCertificate = null;
  let certificateLoading = false;
  let showCertificateDetails = false;

  // Certificate pulling variables
  let showPullForm = false;
  let pullUrl = 'http://localhost:3002'; // Default coolcert URL
  let pullLoading = false;
  let showImportForm = false;
  let importJson = '';

  // Wallet connection status
  let walletConnected = false;
  let walletPublicKey = null;

  // Policy management variables
  let policies = [];
  let policyLoading = false;
  let showCreatePolicy = false;
  let showAdvancedRules = false;
  let policySearchFilter = '';
  let policyStatusFilter = 'all';
  let policyTypeFilter = 'all';
  let filteredPolicies = [];

  let newPolicy = {
    name: '',
    description: '',
    type: 'access_control',
    enabled: true,
    policy: {
      minConfs: 6,
      allowRecalled: false
    }
  };

  // Analytics variables
  let analyticsData = null;
  let analyticsLoading = true;
  let reportType = 'usage';
  let timeRange = '24h';
  let contentId = '';
  let exportFormat = 'json';

  let reportTypes = [
    { value: 'usage', label: 'Usage Analytics' },
    { value: 'revenue', label: 'Revenue Analytics' },
    { value: 'performance', label: 'Performance Analytics' }
  ];

  let timeRanges = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
  ];

  let exportFormats = [
    { value: 'json', label: 'JSON' },
    { value: 'csv', label: 'CSV' },
    { value: 'pdf', label: 'PDF Report' }
  ];

  // Services management variables
  let services = [];
  let servicesLoading = true;
  let showAddService = false;

  let newService = {
    serviceName: '',
    serviceType: 'data-processing',
    capabilities: [],
    pricing: {
      model: 'per_kb',
      amount: 0.01,
      currency: 'BSV'
    },
    endpoints: {
      webhook: '',
      api: ''
    }
  };

  onMount(async () => {
    console.log('🔧 Settings page initialized');
    await checkWalletConnection();
    await loadIdentity();
    await loadCertificateOnly();
    await loadPolicies();
    await loadAnalytics();
    await loadServices();
  });

  async function checkWalletConnection() {
    try {
      console.log('🔍 Checking wallet connection...');

      // PeerPay-style wallet verification
      const isConnected = await bsvWalletService.verifyWalletConnection();
      const publicKey = bsvWalletService.getPublicKey();

      console.log('📊 Wallet status:', { isConnected, publicKey: publicKey?.slice(0, 10) + '...' || null });

      walletConnected = isConnected;
      walletPublicKey = publicKey;
    } catch (error) {
      console.warn('⚠️ Wallet check failed:', error);
      walletConnected = false;
      walletPublicKey = null;
    }
  }

  async function connectWallet() {
    try {
      console.log('🔗 Connecting MetaNet Desktop wallet...');

      // PeerPay-style connection
      const connectionResult = await bsvWalletService.connect();

      walletConnected = connectionResult.isConnected;
      walletPublicKey = connectionResult.publicKey;

      console.log('✅ Wallet connected successfully');

      // Auto-load identity after wallet connection
      if (walletConnected) {
        await loadIdentity();
      }
    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
      alert('Failed to connect MetaNet wallet: ' + error.message);
    }
  }

  async function loadIdentity() {
    try {
      console.log('👤 Loading unified identity from wallet certificate...');
      identityStatus.identity = 'loading';

      // CoolCert approach: Identity comes from certificate in wallet
      if (!walletConnected || !walletPublicKey) {
        identityStatus.identity = 'none';
        console.log('ℹ️ No wallet connected - identity requires wallet connection');
        return;
      }

      // Load certificates from wallet first
      await certificateService.loadCertificatesFromWallet();
      const certificates = certificateService.getAllCertificates();

      if (certificates.length > 0) {
        const cert = certificates[0];

        // Identity is derived from certificate - CoolCert style
        identity = {
          id: cert.subject || walletPublicKey,
          key: walletPublicKey,
          displayName: cert.fields?.display_name || 'Gitdata User',
          description: cert.fields?.description || '',
          region: cert.fields?.region || 'global',
          contactEmail: cert.fields?.contactEmail || '',
          website: cert.fields?.website || '',
          preferences: {
            maxPricePerKB: 0.1,
            preferredFormats: [],
            autoDownload: false
          }
        };
        identityInitialized = true;
        identityStatus.identity = 'ready';
        console.log('✅ Identity loaded from certificate successfully');
      } else {
        // No certificate = no identity
        identityStatus.identity = 'none';
        console.log('ℹ️ No certificate found - identity requires certificate');
      }
    } catch (error) {
      console.error('❌ Failed to load identity:', error);
      identityStatus.identity = 'error';
    }
  }

  async function createIdentity() {
    try {
      identityLoading = true;
      console.log('🆕 Creating identity through certificate acquisition...');

      // Enhanced wallet connection check
      if (!walletConnected) {
        console.log('🔗 Wallet not connected, attempting connection...');
        await connectWallet();

        // Double-check after connection attempt
        if (!walletConnected) {
          throw new Error('MetaNet Desktop wallet must be connected to create identity. Please connect your wallet first.');
        }
      }

      // Validate required fields
      if (!identity.displayName.trim()) {
        alert('Display name is required');
        return;
      }

      try {
        console.log('🔐 CoolCert-style identity creation via certificate acquisition...');

        // CoolCert approach: Acquire certificate which becomes the identity
        const certificate = await bsvWalletService.acquireGitdataCertificate(identity.displayName);
        console.log('✅ Certificate acquired successfully:', certificate);

        // Certificate in wallet now represents identity
        identity = {
          id: certificate.subject || walletPublicKey,
          key: walletPublicKey,
          displayName: identity.displayName,
          description: identity.description,
          region: identity.region,
          contactEmail: identity.contactEmail,
          website: identity.website,
          preferences: identity.preferences
        };

        identityInitialized = true;
        identityStatus.identity = 'ready';

        console.log('✅ Identity created successfully through certificate');
        alert('Identity certificate acquired successfully!');

        // Refresh certificate display
        await loadCertificateOnly();

      } catch (certError) {
        console.error('❌ Certificate acquisition failed:', certError);
        throw new Error(`Failed to acquire identity certificate: ${certError.message}\n\n⚠️ Identity cannot be created without MetaNet Desktop wallet connection.`);
      }

    } catch (error) {
      alert('Failed to create identity: ' + error.message);
    } finally {
      identityLoading = false;
    }
  }

  // Only load existing certificates, don't auto-issue
  async function loadCertificateOnly() {
    try {
      certificateLoading = true;
      await certificateService.loadCertificatesFromWallet();
      const certificates = certificateService.getAllCertificates();
      if (certificates.length > 0) {
        userCertificate = certificates[0];
      }
      // Don't auto-issue - let user explicitly request certificate
    } catch (error) {
      console.error('Failed to load certificate:', error);
    } finally {
      certificateLoading = false;
    }
  }

  async function loadPolicies() {
    try {
      policyLoading = true;
      const response = await api.request('/policies');
      if (response.ok) {
        const data = await response.json();
        policies = data.policies || [];
        updateFilteredPolicies();
      }
    } catch (error) {
      console.error('Failed to load policies:', error);
    } finally {
      policyLoading = false;
    }
  }

  async function loadAnalytics() {
    try {
      analyticsLoading = true;
      const response = await api.request(`/v1/analytics/${reportType}?timeRange=${timeRange}&contentId=${contentId}`);
      if (response.ok) {
        analyticsData = await response.json();
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      analyticsData = null;
    } finally {
      analyticsLoading = false;
    }
  }

  async function loadServices() {
    try {
      servicesLoading = true;
      const response = await api.request('/v1/services');
      if (response.ok) {
        const data = await response.json();
        services = data.services || [];
      }
    } catch (error) {
      console.error('Failed to load services:', error);
    } finally {
      servicesLoading = false;
    }
  }

  function updateFilteredPolicies() {
    filteredPolicies = policies.filter(policy => {
      const matchesSearch = policy.name.toLowerCase().includes(policySearchFilter.toLowerCase()) ||
                           policy.description.toLowerCase().includes(policySearchFilter.toLowerCase());
      const matchesStatus = policyStatusFilter === 'all' || policy.enabled === (policyStatusFilter === 'enabled');
      const matchesType = policyTypeFilter === 'all' || policy.type === policyTypeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }

  // Update filtered policies when filters change
  $: policySearchFilter, policyStatusFilter, policyTypeFilter, updateFilteredPolicies();
</script>

<div class="gitbook-layout">
  <!-- Sidebar Navigation -->
  <nav class="sidebar">
    <div class="sidebar-header">
      <h2>Settings</h2>
      <button class="back-btn" on:click={() => goto('/')}>← Back to Home</button>
    </div>

    <div class="sidebar-nav">
      <button
        class="nav-item"
        class:active={activeTab === 'profile'}
        on:click={() => activeTab = 'profile'}
      >
        <span class="nav-icon">👤</span>
        Identity Profile
      </button>

      <button
        class="nav-item"
        class:active={activeTab === 'wallet'}
        on:click={() => activeTab = 'wallet'}
      >
        <span class="nav-icon">🔐</span>
        Wallet & Certificate
      </button>

      <button
        class="nav-item"
        class:active={activeTab === 'policies'}
        on:click={() => activeTab = 'policies'}
      >
        <span class="nav-icon">📋</span>
        Policy Management
      </button>

      <button
        class="nav-item"
        class:active={activeTab === 'analytics'}
        on:click={() => activeTab = 'analytics'}
      >
        <span class="nav-icon">📊</span>
        Analytics
      </button>

      <button
        class="nav-item"
        class:active={activeTab === 'services'}
        on:click={() => activeTab = 'services'}
      >
        <span class="nav-icon">⚙️</span>
        Services
      </button>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="content">
    <!-- Identity Profile Tab -->
    {#if activeTab === 'profile'}
      <div class="content-header">
        <h1>Identity Profile</h1>
        <p>Manage your unified identity for both buying and selling data</p>
      </div>

      <div class="content-card">
        <div class="card-header">
          <h3>Create New Identity</h3>
          <p>Create a unified identity for accessing the BSV data marketplace</p>
        </div>

        {#if !identityInitialized}
          <div class="form-group">
            <label for="displayName">Display Name *</label>
            <input
              id="displayName"
              type="text"
              bind:value={identity.displayName}
              placeholder="Enter your display name"
              required
            />
          </div>

          <div class="form-group">
            <label for="description">Description</label>
            <textarea
              id="description"
              bind:value={identity.description}
              placeholder="Describe yourself or your organization"
              rows="3"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="region">Region</label>
              <select id="region" bind:value={identity.region}>
                <option value="global">Global</option>
                <option value="us">United States</option>
                <option value="eu">Europe</option>
                <option value="asia">Asia Pacific</option>
              </select>
            </div>

            <div class="form-group">
              <label for="contactEmail">Contact Email</label>
              <input
                id="contactEmail"
                type="email"
                bind:value={identity.contactEmail}
                placeholder="your@email.com"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="website">Website</label>
            <input
              id="website"
              type="url"
              bind:value={identity.website}
              placeholder="https://yoursite.com"
            />
          </div>

          <div class="form-actions">
            <button class="create-btn" on:click={createIdentity} disabled={identityLoading}>
              {identityLoading ? 'Creating Identity...' : 'Create Identity'}
            </button>
          </div>
        {:else}
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Identity ID</span>
              <span class="value monospace">{identity.id}</span>
            </div>
            <div class="info-item">
              <span class="label">Public Key</span>
              <span class="value monospace">{identity.key}</span>
            </div>
            <div class="info-item">
              <span class="label">Display Name</span>
              <span class="value">{identity.displayName}</span>
            </div>
            <div class="info-item">
              <span class="label">Region</span>
              <span class="value">{identity.region}</span>
            </div>
            {#if identity.contactEmail}
              <div class="info-item">
                <span class="label">Contact Email</span>
                <span class="value">{identity.contactEmail}</span>
              </div>
            {/if}
            {#if identity.website}
              <div class="info-item">
                <span class="label">Website</span>
                <span class="value">{identity.website}</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Wallet & Certificate Tab -->
    {#if activeTab === 'wallet'}
      <div class="content-header">
        <h1>Wallet & Certificate</h1>
        <p>MetaNet Desktop wallet connection and certificate management</p>
      </div>

      <div class="content-card">
        <div class="card-header">
          <h3>MetaNet Desktop Wallet</h3>
          <p>Connect your MetaNet Desktop wallet for identity authentication</p>
        </div>

        <div class="wallet-status">
          {#if walletConnected}
            <div class="status-indicator connected">
              <span class="status-dot"></span>
              <span>Wallet Connected</span>
            </div>
            <div class="wallet-info">
              <span class="label">Public Key:</span>
              <span class="value monospace">{walletPublicKey?.slice(0, 20)}...</span>
            </div>
          {:else}
            <div class="status-indicator disconnected">
              <span class="status-dot"></span>
              <span>Wallet Disconnected</span>
            </div>
            <button class="connect-btn" on:click={connectWallet}>
              Connect MetaNet Wallet
            </button>
          {/if}
        </div>
      </div>

      <div class="content-card">
        <div class="card-header">
          <h3>BSV Certificate</h3>
          <p>Your BSV certificate for authenticated transactions</p>
        </div>

        {#if certificateLoading}
          <div class="loading">Loading certificate...</div>
        {:else if userCertificate}
          <div class="certificate-info">
            <div class="cert-field">
              <span class="label">Certificate Type:</span>
              <span class="value">{userCertificate.type || 'gitdata-participant'}</span>
            </div>
            <div class="cert-field">
              <span class="label">Subject:</span>
              <span class="value">{userCertificate.subject || 'Not specified'}</span>
            </div>
            <div class="cert-field">
              <span class="label">Display Name:</span>
              <span class="value">{userCertificate.fields?.display_name || 'Not specified'}</span>
            </div>
            <div class="cert-field">
              <span class="label">Status:</span>
              <span class="value certificate-valid">Valid</span>
            </div>
          </div>
        {:else}
          <div class="empty-state">
            <p>No certificate found. A certificate will be automatically created when you create your identity.</p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Policy Management Tab -->
    {#if activeTab === 'policies'}
      <div class="content-header">
        <h1>Policy Management</h1>
        <p>Manage access control and compliance policies</p>
      </div>

      <div class="content-card">
        <div class="card-header">
          <h3>Policy Overview</h3>
          <p>Create and manage policies for data access and compliance</p>
        </div>

        <div class="policy-stats">
          <div class="stat-card">
            <div class="stat-number">{policies.length}</div>
            <div class="stat-label">Total Policies</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{policies.filter(p => p.enabled).length}</div>
            <div class="stat-label">Active</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{policies.filter(p => !p.enabled).length}</div>
            <div class="stat-label">Inactive</div>
          </div>
        </div>

        {#if policyLoading}
          <div class="loading">Loading policies...</div>
        {:else}
          <div class="empty-state">
            <p>Policy management features are available in the full version.</p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Analytics Tab -->
    {#if activeTab === 'analytics'}
      <div class="content-header">
        <h1>Analytics</h1>
        <p>View usage and performance analytics</p>
      </div>

      <div class="content-card">
        <div class="card-header">
          <h3>Analytics Overview</h3>
          <p>Monitor your data marketplace activity</p>
        </div>

        {#if analyticsLoading}
          <div class="loading">Loading analytics...</div>
        {:else}
          <div class="empty-state">
            <p>Analytics features are available in the full version.</p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Services Tab -->
    {#if activeTab === 'services'}
      <div class="content-header">
        <h1>Services</h1>
        <p>Manage your marketplace services</p>
      </div>

      <div class="content-card">
        <div class="card-header">
          <h3>Service Management</h3>
          <p>Configure and monitor your services</p>
        </div>

        {#if servicesLoading}
          <div class="loading">Loading services...</div>
        {:else}
          <div class="empty-state">
            <p>Service management features are available in the full version.</p>
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>

<style>
  /* GitBook-style Layout */
  .gitbook-layout {
    display: flex;
    min-height: 100vh;
    background: #0d1117;
    color: #f0f6fc;
  }

  .sidebar {
    width: 280px;
    background: #161b22;
    border-right: 1px solid #30363d;
    flex-shrink: 0;
  }

  .sidebar-header {
    padding: 2rem 1.5rem 1rem;
    border-bottom: 1px solid #30363d;
  }

  .sidebar-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #f0f6fc;
    margin: 0 0 1rem 0;
  }

  .back-btn {
    background: none;
    border: 1px solid #30363d;
    color: #8b949e;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: #21262d;
    border-color: #6e7681;
    color: #f0f6fc;
  }

  .sidebar-nav {
    padding: 1rem 0;
  }

  .nav-item {
    width: 100%;
    background: none;
    border: none;
    color: #8b949e;
    padding: 0.75rem 1.5rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 14px;
  }

  .nav-item:hover {
    background: #21262d;
    color: #f0f6fc;
  }

  .nav-item.active {
    background: #0969da;
    color: #ffffff;
  }

  .nav-icon {
    font-size: 16px;
  }

  .content {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
  }

  .content-header {
    margin-bottom: 2rem;
  }

  .content-header h1 {
    font-size: 2rem;
    font-weight: 600;
    color: #f0f6fc;
    margin: 0 0 0.5rem 0;
  }

  .content-header p {
    color: #8b949e;
    font-size: 1rem;
    margin: 0;
  }

  .content-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .card-header {
    margin-bottom: 1.5rem;
  }

  .card-header h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #f0f6fc;
    margin: 0 0 0.5rem 0;
  }

  .card-header p {
    color: #8b949e;
    margin: 0;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #f0f6fc;
    font-weight: 500;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 0.75rem;
    color: #f0f6fc;
    font-size: 14px;
  }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: #0969da;
    box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.3);
  }

  .form-actions {
    margin-top: 2rem;
  }

  .create-btn {
    background: #238636;
    border: 1px solid #2ea043;
    border-radius: 6px;
    color: #ffffff;
    padding: 0.75rem 1.5rem;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .create-btn:hover:not(:disabled) {
    background: #2ea043;
    border-color: #46954a;
  }

  .create-btn:disabled {
    background: #6e7681;
    border-color: #8b949e;
    cursor: not-allowed;
    opacity: 0.7;
  }

  .info-grid {
    display: grid;
    gap: 1rem;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid #30363d;
  }

  .info-item:last-child {
    border-bottom: none;
  }

  .info-item .label {
    color: #8b949e;
    font-weight: 500;
  }

  .info-item .value {
    color: #f0f6fc;
  }

  .monospace {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-size: 0.875rem;
  }

  .wallet-status {
    margin-bottom: 1rem;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .status-indicator.connected .status-dot {
    background: #2ea043;
  }

  .status-indicator.disconnected .status-dot {
    background: #f85149;
  }

  .wallet-info {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .connect-btn {
    background: #0969da;
    border: 1px solid #1f6feb;
    border-radius: 6px;
    color: #ffffff;
    padding: 0.75rem 1.5rem;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .connect-btn:hover {
    background: #1f6feb;
    border-color: #388bfd;
  }

  .certificate-info {
    display: grid;
    gap: 0.75rem;
  }

  .cert-field {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #30363d;
  }

  .cert-field:last-child {
    border-bottom: none;
  }

  .certificate-valid {
    color: #2ea043;
    font-weight: 500;
  }

  .policy-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
  }

  .stat-number {
    font-size: 1.5rem;
    font-weight: 600;
    color: #f0f6fc;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    color: #8b949e;
    font-size: 0.875rem;
  }

  .loading {
    text-align: center;
    color: #8b949e;
    padding: 2rem;
  }

  .empty-state {
    text-align: center;
    color: #8b949e;
    padding: 2rem;
    background: #0d1117;
    border: 1px dashed #30363d;
    border-radius: 8px;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .gitbook-layout {
      flex-direction: column;
    }

    .sidebar {
      width: 100%;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .content {
      padding: 1rem;
    }

    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>