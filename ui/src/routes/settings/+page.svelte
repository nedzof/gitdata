<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let activeTab = 'profile'; // Default to profile tab
  let overlayUrl = 'http://localhost:8788';

  // Producer state
  let producerProfile = {
    producerId: '',
    identityKey: '',
    displayName: '',
    description: '',
    region: 'global',
    contactEmail: '',
    website: ''
  };

  let producerConnectionStatus = {
    overlay: 'checking',
    database: 'checking',
    identity: 'checking'
  };

  let producerLoading = false;
  let producerInitialized = false;

  // Consumer state
  let consumerProfile = {
    consumerId: '',
    identityKey: '',
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

  let consumerLoading = false;
  let consumerInitialized = false;

  // Policy state
  let policies = [];
  let filteredPolicies = [];
  let policyLoading = false;

  // Policy filters
  let showCreateForm = false;
  let newPolicy = {
    name: '',
    description: '',
    type: 'access_control',
    enabled: true
  };

  let loading = false;

  // Analytics variables
  let analyticsData = null;
  let analyticsLoading = true;
  let reportType = 'usage';
  let timeRange = '24h';
  let contentId = '';
  let exportFormat = 'json';

  let reportTypes = [
    { value: 'usage', label: 'Usage Analytics' },
    { value: 'access', label: 'Access Patterns' },
    { value: 'revenue', label: 'Revenue Analytics' }
  ];

  let timeRanges = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
  ];

  // Services variables
  let services = [];
  let servicesLoading = false;
  let showServicesForm = false;

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

  // Policy filter variables
  let policySearchFilter = '';
  let policyStatusFilter = '';
  let policyTypeFilter = '';
  let currentPolicyPage = 0;
  let policyPageSize = 10;
  let showCreatePolicy = false;

  // Reactive variables for policy interface
  $: uniquePolicyTypes = [...new Set(policies.map(p => p.type))];

  $: {
    policySearchFilter, policyStatusFilter, policyTypeFilter;
    applyFilters();
  }

  function applyFilters() {
    filteredPolicies = policies.filter(policy => {
      const matchesSearch = !policySearchFilter ||
        policy.name.toLowerCase().includes(policySearchFilter.toLowerCase()) ||
        policy.description.toLowerCase().includes(policySearchFilter.toLowerCase()) ||
        policy.policyId.toLowerCase().includes(policySearchFilter.toLowerCase());

      const matchesStatus = !policyStatusFilter ||
        (policyStatusFilter === 'enabled' && policy.enabled) ||
        (policyStatusFilter === 'disabled' && !policy.enabled);

      const matchesType = !policyTypeFilter || policy.type === policyTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }

  onMount(async () => {
    // Check URL parameters for tab switching
    const urlParams = new URLSearchParams($page.url.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['profile', 'policy', 'analytics', 'services'].includes(tabParam)) {
      activeTab = tabParam;
    }
    // Legacy support for old URLs
    if (tabParam === 'producer' || tabParam === 'consumer') {
      activeTab = 'profile';
    }

    await checkProducerStatus();
    await checkConsumerStatus();

    // Load policies if on policy tab
    if (activeTab === 'policy') {
      await loadPolicies();
    }

    // Load analytics if on analytics tab
    if (activeTab === 'analytics') {
      await loadAnalytics();
    }

    // Load services if on services tab
    if (activeTab === 'services') {
      await loadServices();
    }

    // Check for new policy creation
    const newParam = urlParams.get('new');
    if (newParam === 'true' && activeTab === 'policy') {
      showCreatePolicy = true;
    }
  });

  async function checkProducerStatus() {
    try {
      producerLoading = true;

      // Check overlay connection
      try {
        const healthResponse = await fetch(`${overlayUrl}/health`);
        if (healthResponse.ok) {
          producerConnectionStatus.overlay = 'connected';
          const healthData = await healthResponse.json();
          producerConnectionStatus.database = healthData.database === 'postgresql:ok' ? 'connected' : 'error';
        } else {
          producerConnectionStatus.overlay = 'error';
        }
      } catch {
        producerConnectionStatus.overlay = 'error';
      }

      // Check if producer is already initialized
      try {
        const identity = localStorage.getItem('producer-identity');
        if (identity) {
          const parsedIdentity = JSON.parse(identity);
          producerProfile = { ...producerProfile, ...parsedIdentity };
          producerConnectionStatus.identity = 'registered';
          producerInitialized = true;
        } else {
          producerConnectionStatus.identity = 'not-registered';
        }
      } catch {
        producerConnectionStatus.identity = 'error';
      }

    } finally {
      producerLoading = false;
    }
  }

  async function checkConsumerStatus() {
    try {
      consumerLoading = true;

      // Check if consumer is already initialized
      try {
        const identity = localStorage.getItem('consumer-identity');
        if (identity) {
          const parsedIdentity = JSON.parse(identity);
          consumerProfile = { ...consumerProfile, ...parsedIdentity };
          consumerInitialized = true;
        }
      } catch {
        // Not initialized
      }

    } finally {
      consumerLoading = false;
    }
  }

  async function initializeProducer() {
    try {
      producerLoading = true;

      // Generate identity key
      const identityKey = 'user_' + Math.random().toString(36).substr(2, 16);
      const producerId = producerProfile.displayName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();

      const newProfile = {
        ...producerProfile,
        producerId,
        identityKey,
        createdAt: new Date().toISOString()
      };

      // Also create consumer profile with same data
      const newConsumerProfile = {
        ...consumerProfile,
        consumerId: producerId, // Same ID for unified identity
        identityKey,
        displayName: producerProfile.displayName,
        contactEmail: producerProfile.contactEmail,
        description: producerProfile.description,
        website: producerProfile.website,
        region: producerProfile.region,
        createdAt: new Date().toISOString()
      };

      // Store both identities locally
      localStorage.setItem('producer-identity', JSON.stringify(newProfile));
      localStorage.setItem('consumer-identity', JSON.stringify(newConsumerProfile));

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
      } catch (error) {
        console.warn('Identity registered locally, API registration failed:', error);
      }

      producerProfile = newProfile;
      consumerProfile = newConsumerProfile;
      producerConnectionStatus.identity = 'registered';
      producerInitialized = true;
      consumerInitialized = true;

      alert('Identity created successfully! You can now buy and sell data.');

    } catch (error) {
      alert('Failed to create identity: ' + error.message);
    } finally {
      producerLoading = false;
    }
  }

  async function initializeConsumer() {
    try {
      consumerLoading = true;

      const identityKey = 'consumer_' + Math.random().toString(36).substr(2, 16);
      const consumerId = consumerProfile.displayName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();

      const newProfile = {
        ...consumerProfile,
        consumerId,
        identityKey,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem('consumer-identity', JSON.stringify(newProfile));

      consumerProfile = newProfile;
      consumerInitialized = true;

      alert('Consumer identity initialized successfully!');

    } catch (error) {
      alert('Failed to initialize consumer: ' + error.message);
    } finally {
      consumerLoading = false;
    }
  }

  function resetProducerIdentity() {
    if (confirm('Are you sure you want to reset your marketplace identity? This will remove both your producer and consumer capabilities.')) {
      localStorage.removeItem('producer-identity');
      localStorage.removeItem('consumer-identity');

      producerProfile = {
        producerId: '',
        identityKey: '',
        displayName: '',
        description: '',
        region: 'global',
        contactEmail: '',
        website: ''
      };

      consumerProfile = {
        consumerId: '',
        identityKey: '',
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

      producerConnectionStatus.identity = 'not-registered';
      producerInitialized = false;
      consumerInitialized = false;
    }
  }

  function resetConsumerIdentity() {
    if (confirm('Are you sure you want to reset your consumer identity?')) {
      localStorage.removeItem('consumer-identity');
      consumerProfile = {
        consumerId: '',
        identityKey: '',
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
      consumerInitialized = false;
    }
  }

  // Policy Functions
  async function loadPolicies() {
    loading = true;
    try {
      // Try policies API first
      try {
        const response = await fetch('/policies');
        if (response.ok) {
          const result = await response.json();
          policies = result.policies || result.items || [];
        } else {
          // Fallback to dummy data
          policies = generateDummyPolicies();
        }
      } catch (e) {
        console.warn('Policies API failed:', e);
        policies = generateDummyPolicies();
      }

      applyFilters();
    } catch (error) {
      console.error('Failed to load policies:', error);
      policies = [];
      applyFilters();
    } finally {
      loading = false;
    }
  }

  function generateDummyPolicies() {
    return [
      {
        policyId: 'pol_001',
        name: 'Production Data Access',
        description: 'Standard access controls for production datasets',
        enabled: true,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'access_control',
        rulesCount: 8,
        policy: {
          minConfs: 6,
          classificationAllowList: ['public', 'internal'],
          allowRecalled: false,
          maxLineageDepth: 10
        }
      },
      {
        policyId: 'pol_002',
        name: 'PII Protection Policy',
        description: 'Privacy controls for personally identifiable information',
        enabled: true,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'privacy',
        rulesCount: 12,
        policy: {
          piiFlagsBlockList: ['has_personal_info', 'has_contact_details'],
          minAnonymizationLevel: { type: 'k-anon', k: 5 },
          blockIfInThreatFeed: true
        }
      },
      {
        policyId: 'pol_003',
        name: 'ML Model Validation',
        description: 'Quality and bias checks for machine learning models',
        enabled: false,
        createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'mlops',
        rulesCount: 6,
        policy: {
          maxBiasScore: 0.2,
          maxDriftScore: 0.15,
          requiresValidSplit: true,
          minUniquenessRatio: 0.95
        }
      }
    ];
  }


  function goToPolicyDetail(policyId) {
    // Stay within settings, just add policy parameter for future detail view
    goto(`/settings?tab=policy&policy=${encodeURIComponent(policyId)}`);
  }

  function createNewPolicy() {
    showCreatePolicy = true;
    // Update URL to reflect new policy creation state
    goto('/settings?tab=policy&new=true');
  }

  function cancelPolicyCreation() {
    showCreatePolicy = false;
    // Reset form
    newPolicy = {
      name: '',
      description: '',
      type: 'access_control',
      enabled: true,
      policy: {
        minConfs: 6,
        classificationAllowList: ['public'],
        allowRecalled: false,
        maxLineageDepth: 10
      }
    };
    // Clear URL parameter
    goto('/settings?tab=policy');
  }

  async function saveNewPolicy() {
    try {
      // Generate policy ID
      const policyId = 'pol_' + Math.random().toString(36).substr(2, 9);

      const policyToCreate = {
        ...newPolicy,
        policyId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rulesCount: Object.keys(newPolicy.policy || {}).length
      };

      // Try to save via API
      try {
        await fetch('/policies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(policyToCreate)
        });
      } catch (error) {
        console.warn('Policy API save failed, saving locally:', error);
      }

      // Add to local policies array
      policies = [policyToCreate, ...policies];
      applyFilters();

      alert('Policy created successfully!');
      cancelPolicyCreation();

    } catch (error) {
      console.error('Failed to create policy:', error);
      alert('Failed to create policy: ' + error.message);
    }
  }

  async function togglePolicy(policy) {
    try {
      // Optimistic update
      policy.enabled = !policy.enabled;
      policies = policies;
      applyFilters();

      // Try to persist the change
      await fetch(`/policies/${policy.policyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: policy.enabled })
      });
    } catch (error) {
      // Revert on error
      policy.enabled = !policy.enabled;
      policies = policies;
      applyFilters();
      console.error('Failed to toggle policy:', error);
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  function getStatusColor(enabled) {
    return enabled ? 'status-success' : 'status-error';
  }

  function getPolicyTypeLabel(type) {
    const typeMap = {
      'access_control': 'Access Control',
      'data_quality': 'Data Quality',
      'privacy': 'Privacy',
      'compliance': 'Compliance',
      'mlops': 'MLOps'
    };
    return typeMap[type] || type;
  }

  function nextPolicyPage() {
    if ((currentPolicyPage + 1) * policyPageSize < filteredPolicies.length) {
      currentPolicyPage++;
    }
  }

  function prevPolicyPage() {
    if (currentPolicyPage > 0) {
      currentPolicyPage--;
    }
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

  // Analytics Functions
  async function loadAnalytics() {
    try {
      analyticsLoading = true;

      // Simulate CLI analytics functionality
      const params = new URLSearchParams({
        reportType,
        timeRange,
        format: 'json'
      });

      if (contentId) {
        params.append('contentId', contentId);
      }

      // Mock analytics data that matches CLI output structure
      analyticsData = generateMockAnalytics(reportType, timeRange);

      // Try to get real analytics if available
      try {
        const response = await api.request(`/v1/analytics/producer?${params}`);
        if (response && Object.keys(response).length > 0) {
          analyticsData = response;
        }
      } catch (error) {
        console.warn('Using mock analytics data:', error);
      }

    } catch (error) {
      console.error('Failed to load analytics:', error);
      analyticsData = generateMockAnalytics(reportType, timeRange);
    } finally {
      analyticsLoading = false;
    }
  }

  function generateMockAnalytics(type, range) {
    const now = new Date();
    const baseData = {
      reportType: type,
      timeRange: range,
      generatedAt: now.toISOString(),
      producer: JSON.parse(localStorage.getItem('producer-identity') || '{}')
    };

    switch (type) {
      case 'usage':
        return {
          ...baseData,
          totalRequests: Math.floor(Math.random() * 10000),
          uniqueClients: Math.floor(Math.random() * 1000),
          dataServed: Math.floor(Math.random() * 1000000000), // bytes
          avgResponseTime: Math.floor(Math.random() * 500), // ms
          topContent: [
            { contentId: 'content_abc123', requests: 450, revenue: 2250 },
            { contentId: 'content_def456', requests: 320, revenue: 1600 },
            { contentId: 'content_ghi789', requests: 180, revenue: 900 }
          ],
          hourlyBreakdown: Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            requests: Math.floor(Math.random() * 100),
            revenue: Math.floor(Math.random() * 500)
          }))
        };

      case 'access':
        return {
          ...baseData,
          totalSessions: Math.floor(Math.random() * 1000),
          avgSessionDuration: Math.floor(Math.random() * 300), // seconds
          bounceRate: Math.floor(Math.random() * 100), // percentage
          topRegions: [
            { region: 'North America', sessions: 450 },
            { region: 'Europe', sessions: 320 },
            { region: 'Asia Pacific', sessions: 180 }
          ],
          deviceTypes: [
            { type: 'Desktop', sessions: 600 },
            { type: 'Mobile', sessions: 280 },
            { type: 'API', sessions: 120 }
          ]
        };

      case 'revenue':
        return {
          ...baseData,
          totalRevenue: Math.floor(Math.random() * 50000), // satoshis
          avgRevenuePerRequest: Math.floor(Math.random() * 100),
          topPayingClients: [
            { clientId: 'client_abc', revenue: 15000, requests: 300 },
            { clientId: 'client_def', revenue: 12000, requests: 240 },
            { clientId: 'client_ghi', revenue: 8000, requests: 160 }
          ],
          revenueByContent: [
            { contentId: 'content_abc123', revenue: 12500 },
            { contentId: 'content_def456', revenue: 8300 },
            { contentId: 'content_ghi789', revenue: 5200 }
          ]
        };

      default:
        return baseData;
    }
  }

  async function exportReport() {
    if (!analyticsData) return;

    const filename = `producer-analytics-${reportType}-${timeRange}.${exportFormat}`;

    if (exportFormat === 'json') {
      const blob = new Blob([JSON.stringify(analyticsData, null, 2)], { type: 'application/json' });
      downloadBlob(blob, filename);
    } else if (exportFormat === 'csv') {
      const csv = convertToCSV(analyticsData);
      const blob = new Blob([csv], { type: 'text/csv' });
      downloadBlob(blob, filename);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function convertToCSV(data) {
    // Simple CSV conversion for demonstration
    let csv = '';

    if (data.topContent) {
      csv += 'Content ID,Requests,Revenue\n';
      data.topContent.forEach(item => {
        csv += `${item.contentId},${item.requests},${item.revenue}\n`;
      });
    }

    return csv;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatSatoshis(sats) {
    return new Intl.NumberFormat().format(sats) + ' sats';
  }

  // Services Functions
  async function loadServices() {
    try {
      servicesLoading = true;

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
      servicesLoading = false;
    }
  }

  async function advertiseService() {
    try {
      servicesLoading = true;

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

      showServicesForm = false;
      alert('Service advertised successfully!');

    } catch (error) {
      alert('Failed to advertise service: ' + error.message);
    } finally {
      servicesLoading = false;
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

  // Reactive statements for policies
  $: paginatedPolicies = filteredPolicies.slice(currentPolicyPage * policyPageSize, (currentPolicyPage + 1) * policyPageSize);
  $: uniquePolicyTypes = [...new Set(policies.map(p => p.type))];
  $: totalPolicyPages = Math.ceil(filteredPolicies.length / policyPageSize);

  $: {
    policySearchFilter, policyStatusFilter, policyTypeFilter;
    applyFilters();
    currentPolicyPage = 0;
  }

</script>

<div class="gitbook-layout">
  <!-- Sidebar Navigation -->
  <nav class="sidebar">
    <div class="sidebar-header">
      <h2>Settings</h2>
    </div>

    <div class="nav-menu">
      <button
        class="nav-item {activeTab === 'profile' ? 'active' : ''}"
        on:click={() => activeTab = 'profile'}
      >
        <span class="nav-icon">👤</span>
        <span class="nav-label">Profile</span>
      </button>

      <button
        class="nav-item {activeTab === 'analytics' ? 'active' : ''}"
        on:click={() => activeTab = 'analytics'}
      >
        <span class="nav-icon">📊</span>
        <span class="nav-label">Analytics</span>
      </button>

      <button
        class="nav-item {activeTab === 'services' ? 'active' : ''}"
        on:click={() => activeTab = 'services'}
      >
        <span class="nav-icon">🔧</span>
        <span class="nav-label">Services</span>
      </button>

      <button
        class="nav-item {activeTab === 'policy' ? 'active' : ''}"
        on:click={() => activeTab = 'policy'}
      >
        <span class="nav-icon">🛡️</span>
        <span class="nav-label">Policies</span>
      </button>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="main-content">
    <div class="content-wrapper">
      <!-- Tab Content -->
  {#if activeTab === 'profile'}
    <div class="tab-content-open">

      <!-- Unified Identity Section -->
      <div class="unified-identity-section">
        {#if !producerInitialized}
          <div class="identity-setup-card">
            <div class="setup-header">
              <h3>👤 Create Your Identity</h3>
              <p>Set up your marketplace identity to buy and sell data</p>
            </div>

            <form on:submit|preventDefault={initializeProducer}>
              <div class="form-grid">
                <div class="form-group">
                  <label for="displayName">Display Name *</label>
                  <input
                    id="displayName"
                    type="text"
                    bind:value={producerProfile.displayName}
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
                    bind:value={producerProfile.contactEmail}
                    required
                    placeholder="contact@company.com"
                    class="form-input"
                  />
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

                <div class="form-group span-2">
                  <label for="description">Description</label>
                  <textarea
                    id="description"
                    bind:value={producerProfile.description}
                    placeholder="Brief description of your organization or use case"
                    class="form-input"
                    rows="3"
                  ></textarea>
                </div>
              </div>

              <!-- Preferences Section -->
              <div class="preferences-section">
                <h4>Purchasing Preferences</h4>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="maxPrice">Max Price per KB</label>
                    <input
                      id="maxPrice"
                      type="number"
                      step="0.001"
                      bind:value={consumerProfile.preferences.maxPricePerKB}
                      class="form-input"
                      placeholder="0.1"
                    />
                  </div>
                  <div class="form-group">
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        bind:checked={consumerProfile.preferences.autoDownload}
                      />
                      Auto-download purchased content
                    </label>
                  </div>
                </div>
              </div>

              <div class="form-actions">
                <button
                  type="submit"
                  disabled={producerLoading || !producerProfile.displayName || !producerProfile.contactEmail}
                  class="btn btn-primary"
                >
                  {producerLoading ? 'Creating Identity...' : 'Create Identity'}
                </button>
              </div>
            </form>
          </div>
        {:else}
          <div class="identity-profile-card">
            <div class="profile-header">
              <div class="profile-info">
                <h3>👤 {producerProfile.displayName}</h3>
                <p>{producerProfile.description || 'No description provided'}</p>
              </div>
              <div class="profile-status">
                <span class="identity-status active">Active</span>
              </div>
            </div>

            <div class="profile-details">
              <div class="detail-grid">
                <div class="detail-item">
                  <label>Identity ID</label>
                  <code>{producerProfile.producerId}</code>
                </div>
                <div class="detail-item">
                  <label>Contact Email</label>
                  <span>{producerProfile.contactEmail}</span>
                </div>
                <div class="detail-item">
                  <label>Website</label>
                  <span>{producerProfile.website || 'Not specified'}</span>
                </div>
                <div class="detail-item">
                  <label>Region</label>
                  <span class="region-badge">{producerProfile.region}</span>
                </div>
              </div>
            </div>

            <div class="profile-capabilities">
              <h4>Marketplace Capabilities</h4>
              <div class="capability-grid">
                <div class="capability-item">
                  <span class="capability-icon">🏭</span>
                  <div class="capability-info">
                    <strong>Data Producer</strong>
                    <span>Publish and sell data</span>
                  </div>
                </div>
                <div class="capability-item">
                  <span class="capability-icon">🛒</span>
                  <div class="capability-info">
                    <strong>Data Consumer</strong>
                    <span>Purchase and access data</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="profile-actions">
              <button on:click={resetProducerIdentity} class="btn btn-secondary">
                Reset Identity
              </button>
              <a href="/market" class="btn btn-primary">
                Browse Marketplace
              </a>
            </div>
          </div>
        {/if}
      </div>
    </div>

  {:else if activeTab === 'analytics'}
    <div class="tab-content-open">
      <div class="page-header">
        <h1>Analytics Dashboard</h1>
        <p>Comprehensive analytics matching CLI functionality</p>
      </div>

      <!-- Analytics Controls -->
      <div class="analytics-controls-panel">
        <div class="analytics-controls-grid">
          <div class="control-group">
            <label for="analyticsReportType">Report Type</label>
            <select id="analyticsReportType" bind:value={reportType} on:change={loadAnalytics} class="control-input">
              {#each reportTypes as type}
                <option value={type.value}>{type.label}</option>
              {/each}
            </select>
          </div>

          <div class="control-group">
            <label for="analyticsTimeRange">Time Range</label>
            <select id="analyticsTimeRange" bind:value={timeRange} on:change={loadAnalytics} class="control-input">
              {#each timeRanges as range}
                <option value={range.value}>{range.label}</option>
              {/each}
            </select>
          </div>

          <div class="control-group">
            <label for="analyticsContentId">Content ID (Optional)</label>
            <input
              id="analyticsContentId"
              type="text"
              bind:value={contentId}
              placeholder="content_abc123"
              class="control-input"
            />
          </div>

          <div class="control-actions">
            <button on:click={loadAnalytics} class="btn btn-primary" disabled={analyticsLoading}>
              {analyticsLoading ? 'Loading...' : 'Refresh'}
            </button>
            <button on:click={exportReport} class="btn btn-secondary" disabled={!analyticsData}>
              Export Report
            </button>
          </div>
        </div>
      </div>

      {#if analyticsLoading}
        <div class="loading">
          <p>⏳ Generating analytics report...</p>
        </div>
      {:else if analyticsData}
        <!-- Usage Analytics -->
        {#if reportType === 'usage'}
          <div class="analytics-metrics-grid">
            <div class="analytics-metric-card">
              <div class="metric-icon">📊</div>
              <div class="metric-content">
                <h3>Total Requests</h3>
                <div class="metric-value">{new Intl.NumberFormat().format(analyticsData.totalRequests)}</div>
              </div>
            </div>

            <div class="analytics-metric-card">
              <div class="metric-icon">👥</div>
              <div class="metric-content">
                <h3>Unique Clients</h3>
                <div class="metric-value">{new Intl.NumberFormat().format(analyticsData.uniqueClients)}</div>
              </div>
            </div>

            <div class="analytics-metric-card">
              <div class="metric-icon">💾</div>
              <div class="metric-content">
                <h3>Data Served</h3>
                <div class="metric-value">{formatBytes(analyticsData.dataServed)}</div>
              </div>
            </div>

            <div class="analytics-metric-card">
              <div class="metric-icon">⚡</div>
              <div class="metric-content">
                <h3>Avg Response</h3>
                <div class="metric-value">{analyticsData.avgResponseTime}ms</div>
              </div>
            </div>
          </div>

          <div class="analytics-data-tables">
            <div class="analytics-table-panel">
              <h3>🏆 Top Content</h3>
              <div class="analytics-table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Content ID</th>
                      <th>Requests</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each analyticsData.topContent as content}
                      <tr>
                        <td><code>{content.contentId}</code></td>
                        <td>{content.requests}</td>
                        <td>{formatSatoshis(content.revenue)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        {/if}

        <!-- Access Analytics -->
        {#if reportType === 'access'}
          <div class="analytics-metrics-grid">
            <div class="analytics-metric-card">
              <div class="metric-icon">🔗</div>
              <div class="metric-content">
                <h3>Total Sessions</h3>
                <div class="metric-value">{new Intl.NumberFormat().format(analyticsData.totalSessions)}</div>
              </div>
            </div>

            <div class="analytics-metric-card">
              <div class="metric-icon">⏱️</div>
              <div class="metric-content">
                <h3>Avg Duration</h3>
                <div class="metric-value">{Math.floor(analyticsData.avgSessionDuration / 60)}m {analyticsData.avgSessionDuration % 60}s</div>
              </div>
            </div>

            <div class="analytics-metric-card">
              <div class="metric-icon">📱</div>
              <div class="metric-content">
                <h3>Device Types</h3>
                <div class="metric-value">{analyticsData.deviceTypes.length} types</div>
              </div>
            </div>

            <div class="analytics-metric-card">
              <div class="metric-icon">🌍</div>
              <div class="metric-content">
                <h3>Top Regions</h3>
                <div class="metric-value">{analyticsData.topRegions.length} regions</div>
              </div>
            </div>
          </div>

          <div class="analytics-data-tables">
            <div class="analytics-table-panel">
              <h3>🌎 Access by Region</h3>
              <div class="analytics-table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Region</th>
                      <th>Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each analyticsData.topRegions as region}
                      <tr>
                        <td>{region.region}</td>
                        <td>{region.sessions}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        {/if}

        <!-- Revenue Analytics -->
        {#if reportType === 'revenue'}
          <div class="analytics-metrics-grid">
            <div class="analytics-metric-card">
              <div class="metric-icon">💰</div>
              <div class="metric-content">
                <h3>Total Revenue</h3>
                <div class="metric-value">{formatSatoshis(analyticsData.totalRevenue)}</div>
              </div>
            </div>

            <div class="analytics-metric-card">
              <div class="metric-icon">📈</div>
              <div class="metric-content">
                <h3>Avg/Request</h3>
                <div class="metric-value">{formatSatoshis(analyticsData.avgRevenuePerRequest)}</div>
              </div>
            </div>

            <div class="analytics-metric-card">
              <div class="metric-icon">👑</div>
              <div class="metric-content">
                <h3>Top Clients</h3>
                <div class="metric-value">{analyticsData.topPayingClients.length} clients</div>
              </div>
            </div>

            <div class="analytics-metric-card">
              <div class="metric-icon">🎯</div>
              <div class="metric-content">
                <h3>Revenue Streams</h3>
                <div class="metric-value">{analyticsData.revenueByContent.length} sources</div>
              </div>
            </div>
          </div>

          <div class="analytics-data-tables">
            <div class="analytics-table-panel">
              <h3>💎 Top Paying Clients</h3>
              <div class="analytics-table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Client ID</th>
                      <th>Revenue</th>
                      <th>Requests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each analyticsData.topPayingClients as client}
                      <tr>
                        <td><code>{client.clientId}</code></td>
                        <td>{formatSatoshis(client.revenue)}</td>
                        <td>{client.requests}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        {/if}

        <!-- Export Options -->
        <div class="analytics-export-panel">
          <div class="export-controls">
            <label for="analyticsExportFormat">Export Format:</label>
            <select id="analyticsExportFormat" bind:value={exportFormat} class="control-input">
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
            <button on:click={exportReport} class="btn btn-secondary">
              📥 Export Report
            </button>
          </div>
        </div>
      {/if}
    </div>

  {:else if activeTab === 'services'}
    <div class="tab-content-open">
      <div class="page-header">
        <h1>Service Advertisement Manager</h1>
        <p>BRC-88 SHIP/SLAP Service Publishing & Management</p>
      </div>

      <div class="services-controls">
        <button on:click={() => showServicesForm = !showServicesForm} class="btn btn-primary">
          {showServicesForm ? '❌ Cancel' : '➕ Advertise New Service'}
        </button>
        <button on:click={loadServices} class="btn btn-secondary" disabled={servicesLoading}>
          🔄 Refresh Services
        </button>
      </div>

      {#if showServicesForm}
        <!-- Service Advertisement Form -->
        <div class="add-service-form">
          <h2>📢 Advertise New Service</h2>
          <form on:submit|preventDefault={advertiseService}>
            <div class="services-form-grid">
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
                <label for="serviceDescription">Service Description</label>
                <textarea
                  id="serviceDescription"
                  bind:value={serviceForm.description}
                  placeholder="Describe your service features and benefits"
                  class="form-input"
                  rows="3"
                ></textarea>
              </div>

              <div class="form-group span-2">
                <label for="serviceCapabilities">Service Capabilities *</label>
                <input
                  id="serviceCapabilities"
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
                <label for="serviceRegion">Region</label>
                <select id="serviceRegion" bind:value={serviceForm.region} class="form-input">
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
              <button type="submit" disabled={servicesLoading} class="btn btn-primary">
                {servicesLoading ? 'Advertising...' : '📢 Advertise Service'}
              </button>
              <button type="button" on:click={() => showServicesForm = false} class="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      {/if}

      <!-- Services List -->
      <div class="services-list">
        <h2>📋 Advertised Services</h2>

        {#if servicesLoading}
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

  {:else if activeTab === 'policy'}
    <div class="tab-content-open">
      <div class="page-header">
        <h1>Policy Management</h1>
        <p>Create and manage data governance policies</p>
      </div>

      <div class="content">
        <!-- Controls -->
        <div class="controls">
          <div class="filters">
            <input
              bind:value={policySearchFilter}
              placeholder="Search policies..."
              class="search-input"
            />

            <select bind:value={policyStatusFilter} class="filter-select">
              <option value="">All Status</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>

            <select bind:value={policyTypeFilter} class="filter-select">
              <option value="">All Types</option>
              {#each uniquePolicyTypes as type}
                <option value={type}>{getPolicyTypeLabel(type)}</option>
              {/each}
            </select>
          </div>

          <div class="actions">
            <button
              class="btn primary"
              on:click={() => showCreateForm = !showCreateForm}
            >
              {showCreateForm ? 'Cancel' : 'New Policy'}
            </button>
            <button class="btn secondary" on:click={loadPolicies}>
              Refresh
            </button>
          </div>
        </div>

        <!-- Create Form -->
        {#if showCreateForm}
          <div class="create-form">
            <h3>Create New Policy</h3>
            <form on:submit|preventDefault={saveNewPolicy}>
              <div class="form-row">
                <input
                  bind:value={newPolicy.name}
                  placeholder="Policy name"
                  required
                  class="form-input"
                />
                <select bind:value={newPolicy.type} class="form-input">
                  <option value="access_control">Access Control</option>
                  <option value="privacy">Privacy</option>
                  <option value="compliance">Compliance</option>
                  <option value="mlops">MLOps</option>
                </select>
              </div>
              <textarea
                bind:value={newPolicy.description}
                placeholder="Policy description"
                required
                class="form-input"
                rows="2"
              ></textarea>
              <div class="form-actions">
                <label class="checkbox">
                  <input type="checkbox" bind:checked={newPolicy.enabled} />
                  Enable immediately
                </label>
                <button type="submit" class="btn primary" disabled={!newPolicy.name || !newPolicy.description}>
                  Create Policy
                </button>
              </div>
            </form>
          </div>
        {/if}

        <!-- Policy List -->
        {#if loading}
          <div class="loading">Loading policies...</div>
        {:else if filteredPolicies.length === 0}
          <div class="empty">
            <p>No policies found</p>
            <button class="btn primary" on:click={() => showCreateForm = true}>
              Create your first policy
            </button>
          </div>
        {:else}
          <div class="policy-list">
            {#each filteredPolicies as policy}
              <div class="policy-card">
                <div class="policy-info">
                  <div class="policy-header">
                    <h4>{policy.name}</h4>
                    <div class="policy-meta">
                      <span class="policy-type">{getPolicyTypeLabel(policy.type)}</span>
                      <span class="policy-id">{policy.policyId}</span>
                    </div>
                  </div>
                  <p class="policy-description">{policy.description}</p>
                  <div class="policy-details">
                    <span>{policy.rulesCount} rules</span>
                    <span>Created {formatDate(policy.createdAt)}</span>
                    <span>Updated {formatDate(policy.updatedAt)}</span>
                  </div>
                </div>
                <div class="policy-actions">
                  <button
                    class="toggle-btn {policy.enabled ? 'enabled' : 'disabled'}"
                    on:click={() => togglePolicy(policy)}
                    title={policy.enabled ? 'Disable policy' : 'Enable policy'}
                  >
                    {policy.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
    </div>
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

  /* Sidebar Navigation */
  .sidebar {
    width: 280px;
    background: #161b22;
    border-right: 1px solid #21262d;
    display: flex;
    flex-direction: column;
    position: fixed;
    height: 100vh;
    left: 0;
    top: 0;
    overflow-y: auto;
    z-index: 10;
  }

  .sidebar-header {
    padding: 2rem 1.5rem 1rem 1.5rem;
    border-bottom: 1px solid #21262d;
  }

  .sidebar-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #f0f6fc;
    margin: 0;
  }

  .nav-menu {
    padding: 1rem 0;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.75rem 1.5rem;
    margin: 0;
    background: transparent;
    border: none;
    color: #8b949e;
    font-size: 0.95rem;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    border-left: 3px solid transparent;
  }

  .nav-item:hover {
    background: #21262d;
    color: #f0f6fc;
  }

  .nav-item.active {
    background: rgba(88, 166, 255, 0.1);
    color: #58a6ff;
    border-left-color: #58a6ff;
  }

  .nav-icon {
    width: 20px;
    display: inline-block;
    margin-right: 0.75rem;
    font-size: 1rem;
  }

  .nav-label {
    flex: 1;
  }

  /* Main Content */
  .main-content {
    flex: 1;
    margin-left: 280px;
    padding: 2rem;
    background: #0d1117;
    min-height: 100vh;
  }

  .content-wrapper {
    max-width: 1200px;
    margin: 0;
    width: 100%;
  }

  /* Page Header */
  .page-header {
    margin-bottom: 2rem;
  }

  .page-header h1 {
    font-size: 2rem;
    color: #f0f6fc;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .page-header p {
    color: #8b949e;
    font-size: 1rem;
  }

  /* Analytics Components */
  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .analytics-card {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .card-header h3 {
    color: #f0f6fc;
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .analytics-content {
    display: flex;
    justify-content: space-between;
  }

  .metric {
    text-align: center;
  }

  .metric-value {
    display: block;
    font-size: 1.8rem;
    font-weight: 700;
    color: #58a6ff;
    margin-bottom: 0.25rem;
  }

  .metric-label {
    font-size: 0.85rem;
    color: #8b949e;
  }

  /* Services Components */
  .services-section {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .service-actions {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .service-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .service-card {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 1.25rem;
  }

  .service-header {
    display: flex;
    justify-content: between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .service-header h3 {
    color: #f0f6fc;
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    flex: 1;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-badge.active {
    background: rgba(46, 160, 67, 0.2);
    color: #2ea043;
  }

  .status-badge.paused {
    background: rgba(255, 123, 114, 0.2);
    color: #ff7b72;
  }

  .service-description {
    color: #8b949e;
    font-size: 0.9rem;
    margin: 0.5rem 0 1rem 0;
    line-height: 1.4;
  }

  .service-stats {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .stat {
    color: #6e7681;
    font-size: 0.85rem;
  }

  .service-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* Tab Content */
  .tab-content-open {
    padding: 0;
    background: transparent;
  }

  .tab-content-open h2 {
    color: #f0f6fc;
    margin-bottom: 1.5rem;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .tab-content-open h3 {
    color: #f0f6fc;
    margin-bottom: 1rem;
    font-size: 1.25rem;
    font-weight: 600;
  }

  /* Unified Identity Section */
  .unified-identity-section {
    margin-top: 2rem;
  }

  .identity-setup-card {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 2rem;
    max-width: 800px;
  }

  .setup-header {
    margin-bottom: 2rem;
    text-align: center;
  }

  .setup-header h3 {
    color: #f0f6fc;
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .setup-header p {
    color: #8b949e;
    font-size: 1rem;
  }

  .preferences-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid #21262d;
  }

  .preferences-section h4 {
    color: #f0f6fc;
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .identity-profile-card {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 2rem;
    max-width: 800px;
  }

  .profile-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #21262d;
  }

  .profile-info h3 {
    color: #f0f6fc;
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .profile-info p {
    color: #8b949e;
    font-size: 1rem;
    margin: 0;
  }

  .profile-status {
    display: flex;
    align-items: center;
  }

  .identity-status {
    padding: 0.5rem 1rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .identity-status.active {
    background: rgba(46, 160, 67, 0.2);
    color: #2ea043;
  }

  .profile-details {
    margin-bottom: 2rem;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-item label {
    font-weight: 600;
    color: #6e7681;
    font-size: 0.8rem;
    text-transform: uppercase;
  }

  .detail-item code {
    background: #0d1117;
    border: 1px solid #21262d;
    padding: 0.75rem;
    border-radius: 6px;
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 0.85rem;
    word-break: break-all;
    color: #f0f6fc;
  }

  .detail-item span {
    color: #f0f6fc;
    font-size: 0.95rem;
  }

  .region-badge {
    background: rgba(88, 166, 255, 0.2);
    color: #58a6ff;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: capitalize;
    display: inline-block;
  }

  .profile-capabilities {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #21262d;
  }

  .profile-capabilities h4 {
    color: #f0f6fc;
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .capability-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .capability-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
  }

  .capability-icon {
    font-size: 1.5rem;
  }

  .capability-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .capability-info strong {
    color: #f0f6fc;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .capability-info span {
    color: #8b949e;
    font-size: 0.8rem;
  }

  .profile-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #f0f6fc;
    font-size: 0.9rem;
    cursor: pointer;
    margin-top: 1.5rem;
  }

  /* Forms */
  .setup-form {
    margin-bottom: 2rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
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
    display: flex;
    justify-content: flex-end;
  }

  /* Profile Panel */
  .profile-panel {
    margin-top: 1.5rem;
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

  /* Buttons */
  .btn {
    padding: 0.65rem 1.25rem;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    font-size: 0.9rem;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn.small {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
  }

  .btn.primary {
    background: #238636;
    color: white;
    border: 1px solid #2ea043;
  }

  .btn.primary:hover:not(:disabled) {
    background: #2ea043;
    border-color: #46954a;
  }

  .btn.primary:disabled {
    background: #484f58;
    color: #656d76;
    cursor: not-allowed;
  }

  .btn.secondary {
    background: #21262d;
    color: #f0f6fc;
    border: 1px solid #30363d;
  }

  .btn.secondary:hover {
    background: #30363d;
    border-color: #58a6ff;
  }

  .btn-danger {
    background: #21262d;
    color: #f85149;
    border: 1px solid #da3633;
  }

  .btn-danger:hover {
    background: #da3633;
    border-color: #f85149;
    color: white;
  }

  /* Responsive Design */
  @media (max-width: 1024px) {
    .sidebar {
      width: 240px;
    }

    .main-content {
      margin-left: 240px;
    }
  }

  @media (max-width: 768px) {
    .sidebar {
      position: relative;
      width: 100%;
      height: auto;
    }

    .main-content {
      margin-left: 0;
      padding: 1rem;
    }

    .analytics-grid {
      grid-template-columns: 1fr;
    }

    .analytics-content {
      flex-direction: column;
      gap: 1rem;
    }

    .service-stats {
      flex-direction: column;
      gap: 0.5rem;
    }
  }

  /* Policy Info */
  .policy-info {
    color: #8b949e;
    line-height: 1.6;
  }

  .policy-info h3 {
    color: #c9d1d9;
    margin-top: 2rem;
    margin-bottom: 0.5rem;
  }

  /* Status Panels */
  .status-panel {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .status-panel h3 {
    color: #c9d1d9;
    margin-bottom: 1rem;
    font-size: 1.1rem;
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
    color: #c9d1d9;
  }

  .status-value {
    text-transform: capitalize;
    color: #6e7681;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .settings-page {
      padding: 1rem;
    }

    .form-grid, .filters-grid, .search-grid {
      grid-template-columns: 1fr;
    }

    .span-2 {
      grid-column: span 1;
    }

    .profile-grid, .status-grid, .analytics-grid {
      grid-template-columns: 1fr;
    }

    .nav-tabs {
      flex-direction: column;
    }

    .nav-tab {
      text-align: left;
    }

  }

  /* Policy Explorer Styles */
  .policy-explorer {
    max-width: 100%;
  }

  .header-section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 20px;
  }

  .header-section h2 {
    font-size: 24px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .header-section p {
    color: #8b949e;
    line-height: 1.5;
  }

  .filters-section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .filter-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
  }

  .filter-group label {
    margin-bottom: 8px;
    color: #f0f6fc;
    font-weight: 600;
    font-size: 14px;
  }

  .filter-group input, .filter-group select {
    padding: 8px 12px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .filter-group input:focus, .filter-group select:focus {
    border-color: #1f6feb;
    outline: none;
  }

  .policy-controls {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid #30363d;
  }

  .data-table {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 20px;
  }

  .data-table table {
    width: 100%;
    border-collapse: collapse;
  }

  .data-table th, .data-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid #30363d;
  }

  .data-table th {
    background: #21262d;
    color: #f0f6fc;
    font-weight: 600;
    font-size: 14px;
  }

  .data-table td {
    color: #8b949e;
    font-size: 14px;
  }

  .data-row {
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .data-row:hover {
    background: #161b22;
  }

  .policy-name-cell {
    max-width: 300px;
  }

  .policy-name {
    color: #58a6ff;
    text-decoration: none;
    font-weight: 600;
    display: block;
    margin-bottom: 4px;
  }

  .policy-name:hover {
    text-decoration: underline;
  }

  .policy-description {
    color: #8b949e;
    font-size: 13px;
    margin-bottom: 4px;
    line-height: 1.3;
  }

  .policy-id {
    font-size: 11px;
    color: #6e7681;
  }

  .policy-id code {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  }

  .type-badge {
    background: rgba(88, 166, 255, 0.2);
    color: #58a6ff;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
  }

  .status {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status.status-success {
    background: #0d2818;
    color: #2ea043;
    border: 1px solid #2ea043;
  }

  .status.status-error {
    background: #2d0d0d;
    color: #da3633;
    border: 1px solid #da3633;
  }

  .rules-count {
    color: #8b949e;
    font-size: 13px;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .btn-toggle, .btn-details {
    background: none;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .btn-toggle.enabled {
    background: rgba(218, 54, 51, 0.1);
    border-color: #da3633;
    color: #da3633;
  }

  .btn-toggle.disabled {
    background: rgba(46, 160, 67, 0.1);
    border-color: #2ea043;
    color: #2ea043;
  }

  .btn-details {
    background: rgba(88, 166, 255, 0.1);
    border-color: #58a6ff;
    color: #58a6ff;
  }

  .btn-toggle:hover, .btn-details:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .loading-state, .empty-state {
    padding: 40px 20px;
    text-align: center;
  }

  .loading-state p, .empty-state p {
    color: #8b949e;
    margin-top: 16px;
  }

  .empty-state .empty-icon {
    font-size: 48px;
    opacity: 0.5;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 20px 0;
  }

  .page-info {
    color: #8b949e;
    font-size: 14px;
  }

  .btn.primary {
    background: #238636;
    color: white;
  }

  .btn.primary:hover:not(:disabled) {
    background: #2ea043;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  .spinner.large {
    font-size: 32px;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Policy Creation Form Styles */
  .policy-creation-form {
    max-width: 100%;
  }

  .policy-creation-form .header-section {
    margin-bottom: 2rem;
  }

  .policy-creation-form .form-grid {
    margin-bottom: 2rem;
  }

  .policy-creation-form .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding-top: 2rem;
    border-top: 1px solid #30363d;
  }

  /* Clean Policy Interface Styles */
  .page-header {
    margin-bottom: 2rem;
  }

  .page-header h1 {
    font-size: 2rem;
    color: #f0f6fc;
    margin-bottom: 0.5rem;
  }

  .page-header p {
    color: #8b949e;
    font-size: 1.1rem;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
  }

  .filters {
    display: flex;
    gap: 1rem;
    flex: 1;
  }

  .search-input, .filter-select {
    padding: 0.5rem 0.75rem;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 0.9rem;
  }

  .search-input {
    flex: 1;
    max-width: 300px;
  }

  .filter-select {
    min-width: 120px;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn.primary {
    background: #238636;
    color: white;
  }

  .btn.primary:hover:not(:disabled) {
    background: #2ea043;
  }

  .btn.primary:disabled {
    background: #484f58;
    color: #656d76;
    cursor: not-allowed;
  }

  .btn.secondary {
    background: #21262d;
    color: #f0f6fc;
    border: 1px solid #30363d;
  }

  .btn.secondary:hover {
    background: #30363d;
  }

  .create-form {
    padding: 1.5rem;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
  }

  .create-form h3 {
    color: #f0f6fc;
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .form-input {
    padding: 0.5rem 0.75rem;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 0.9rem;
    font-family: inherit;
  }

  .form-input:focus {
    outline: none;
    border-color: #58a6ff;
  }

  .form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
  }

  .checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #f0f6fc;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .loading, .empty {
    text-align: center;
    padding: 3rem;
    color: #8b949e;
  }

  .empty button {
    margin-top: 1rem;
  }

  .policy-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .policy-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    transition: border-color 0.2s;
  }

  .policy-card:hover {
    border-color: #58a6ff;
  }

  .policy-info {
    flex: 1;
  }

  .policy-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .policy-header h4 {
    color: #f0f6fc;
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
  }

  .policy-meta {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .policy-type {
    background: rgba(88, 166, 255, 0.2);
    color: #58a6ff;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .policy-id {
    color: #656d76;
    font-size: 0.8rem;
    font-family: monospace;
  }

  .policy-description {
    color: #8b949e;
    font-size: 0.9rem;
    margin: 0.5rem 0;
    line-height: 1.4;
  }

  .policy-details {
    display: flex;
    gap: 1rem;
    color: #656d76;
    font-size: 0.8rem;
  }

  .policy-actions {
    margin-left: 1rem;
  }

  .toggle-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 50px;
  }

  .toggle-btn.enabled {
    background: #238636;
    color: white;
  }

  .toggle-btn.enabled:hover {
    background: #2ea043;
  }

  .toggle-btn.disabled {
    background: #656d76;
    color: white;
  }

  .toggle-btn.disabled:hover {
    background: #8b949e;
  }

  @media (max-width: 768px) {
    .controls {
      flex-direction: column;
      align-items: stretch;
    }

    .filters {
      flex-direction: column;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .policy-card {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .policy-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .policy-actions {
      margin-left: 0;
      align-self: flex-end;
    }
  }

  /* Analytics Specific Styles */
  .analytics-controls-panel {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .analytics-controls-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    align-items: end;
  }

  .analytics-metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .analytics-metric-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .analytics-data-tables {
    display: grid;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .analytics-table-panel {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .analytics-table-panel h3 {
    margin: 0 0 1rem 0;
    color: #f0f6fc;
  }

  .analytics-table-container {
    overflow-x: auto;
  }

  .analytics-export-panel {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
  }

  /* Services Specific Styles */
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

  .services-form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
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
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .service-header h3 {
    margin: 0;
    color: #f0f6fc;
    text-transform: capitalize;
  }

  .status-active {
    background: #238636;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .status-inactive {
    background: #da3633;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
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

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #6e7681;
  }

  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
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