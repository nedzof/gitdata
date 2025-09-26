<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { certificateService } from '$lib/services/certificateService';
  import { bsvWalletService } from '$lib/bsv-wallet';

  let activeTab = 'profile'; // Default to profile tab
  let overlayUrl = 'http://localhost:8788';

  // Unified Identity state (replaces separate producer/consumer)
  let userIdentity = {
    identityId: '',
    identityKey: '',
    displayName: '',
    description: '',
    region: 'global',
    contactEmail: '',
    website: '',
    canBuy: true,
    canSell: true,
    preferences: {
      maxPricePerKB: 0.1,
      preferredFormats: [],
      autoDownload: false
    }
  };

  let identityConnectionStatus = {
    overlay: 'checking',
    database: 'checking',
    identity: 'checking'
  };

  let identityLoading = false;
  let identityInitialized = false;

  // Legacy references for backward compatibility
  let producerProfile = userIdentity;
  let consumerProfile = userIdentity;
  let producerLoading = false;
  let producerInitialized = false;
  let consumerLoading = false;
  let consumerInitialized = false;


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

    await checkIdentityStatus();

    // Check wallet connection status
    walletConnected = bsvWalletService.isWalletConnected();
    walletPublicKey = bsvWalletService.getPublicKey();

    // Load existing certificate if available (only load, don't auto-issue)
    loadCertificateOnly().catch(error => console.warn('Certificate loading error:', error));

    // Load analytics if on analytics tab
    if (activeTab === 'analytics') {
      await loadAnalytics();
    }

    // Load services if on services tab
    if (activeTab === 'services') {
      await loadServices();
    }

    // Load policies if on policy tab
    if (activeTab === 'policy') {
      await loadPolicies();
    }

  });

  async function checkIdentityStatus() {
    try {
      identityLoading = true;

      // Check overlay connection
      try {
        const healthResponse = await fetch(`${overlayUrl}/health`);
        if (healthResponse.ok) {
          identityConnectionStatus.overlay = 'connected';
          const healthData = await healthResponse.json();
          identityConnectionStatus.database = healthData.database === 'postgresql:ok' ? 'connected' : 'error';
        } else {
          identityConnectionStatus.overlay = 'error';
        }
      } catch {
        identityConnectionStatus.overlay = 'error';
      }

      // Check if unified identity is already initialized
      try {
        const identity = localStorage.getItem('user-identity') ||
                         localStorage.getItem('producer-identity') ||
                         localStorage.getItem('consumer-identity');
        if (identity) {
          const parsedIdentity = JSON.parse(identity);

          // Migrate old format to new unified format
          userIdentity = {
            identityId: parsedIdentity.identityId || parsedIdentity.producerId || parsedIdentity.consumerId || '',
            identityKey: parsedIdentity.identityKey || '',
            displayName: parsedIdentity.displayName || '',
            description: parsedIdentity.description || '',
            region: parsedIdentity.region || 'global',
            contactEmail: parsedIdentity.contactEmail || '',
            website: parsedIdentity.website || '',
            canBuy: true,
            canSell: true,
            preferences: parsedIdentity.preferences || {
              maxPricePerKB: 0.1,
              preferredFormats: [],
              autoDownload: false
            }
          };

          // Update legacy references for compatibility
          producerProfile = userIdentity;
          consumerProfile = userIdentity;

          identityConnectionStatus.identity = 'registered';
          identityInitialized = true;
          producerInitialized = true;
          consumerInitialized = true;

          // Migrate to new storage key if needed
          if (!localStorage.getItem('user-identity')) {
            localStorage.setItem('user-identity', JSON.stringify(userIdentity));
            localStorage.removeItem('producer-identity');
            localStorage.removeItem('consumer-identity');
          }
        } else {
          identityConnectionStatus.identity = 'not-registered';
        }
      } catch {
        identityConnectionStatus.identity = 'error';
      }

    } finally {
      identityLoading = false;
    }
  }

  async function initializeIdentity() {
    try {
      identityLoading = true;

      // Generate unified identity (can both buy and sell data)
      const identityKey = 'user_' + Math.random().toString(36).substr(2, 16);
      const identityId = userIdentity.displayName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();

      const newIdentity = {
        ...userIdentity,
        identityId,
        identityKey,
        contactEmail: userIdentity.contactEmail || 'noemail@example.com',
        website: userIdentity.website || '',
        region: userIdentity.region || 'global',
        createdAt: new Date().toISOString(),
        // Identity can both buy and sell
        canBuy: true,
        canSell: true
      };

      // Store unified identity
      localStorage.setItem('user-identity', JSON.stringify(newIdentity));

      // Register identity with overlay network
      try {
        const response = await api.request('/v1/identity/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identityId: newIdentity.identityId,
            identityKey: newIdentity.identityKey,
            displayName: newIdentity.displayName,
            description: newIdentity.description,
            contactEmail: newIdentity.contactEmail,
            website: newIdentity.website,
            region: newIdentity.region,
            canBuy: newIdentity.canBuy,
            canSell: newIdentity.canSell
          })
        });
      } catch (error) {
        console.warn('Identity registered locally, API registration failed:', error);
      }

      // CRITICAL: Identity creation is NOT successful until wallet import succeeds
      console.log('🔗 Connecting to MetaNet Desktop wallet for identity creation...');

      try {
        // Step 1: Connect to wallet (this will show the authentication popup)
        const walletConnection = await bsvWalletService.connect();
        console.log('✅ Wallet connected:', walletConnection.publicKey.slice(0, 10) + '...');

        // Update wallet connection status
        walletConnected = true;
        walletPublicKey = walletConnection.publicKey;

        // Step 2: Acquire and import certificate to wallet
        console.log('🔐 Acquiring certificate for identity...');
        const certificate = await bsvWalletService.acquireGitdataCertificate(newIdentity.displayName);
        console.log('✅ Certificate acquired and imported to wallet');

        // Step 3: Only now is identity creation successful
        // Update unified identity and maintain backward compatibility
        userIdentity = newIdentity;
        producerProfile = { ...newIdentity, producerId: newIdentity.identityId };
        consumerProfile = { ...newIdentity, consumerId: newIdentity.identityId };
        identityConnectionStatus.identity = 'registered';
        identityInitialized = true;
        producerInitialized = true;
        consumerInitialized = true;

        alert('✅ Identity created successfully!\n\n🔐 Your BSV certificate has been imported to MetaNet Desktop wallet.\n\n📋 You can now buy and sell data with verified identity.');

      } catch (walletError) {
        // If wallet operations fail, identity creation fails completely
        console.error('❌ Wallet integration failed:', walletError);
        throw new Error(`Identity creation failed: ${walletError.message}\n\n⚠️  Identity cannot be created without MetaNet Desktop wallet connection.`);
      }

    } catch (error) {
      alert('Failed to create identity: ' + error.message);
    } finally {
      identityLoading = false;
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
    console.log('Reset Producer Identity button clicked!');
    if (confirm('Are you sure you want to reset your marketplace identity? This will remove both your producer and consumer capabilities.')) {
      console.log('User confirmed reset - proceeding with reset...');
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

  // Policy Management Functions
  const basicRules = [
    { key: 'minConfs', label: 'Min Confirmations', type: 'number', description: 'Minimum SPV confirmations required' },
    { key: 'allowRecalled', label: 'Allow Recalled', type: 'boolean', description: 'Allow recalled/flagged data' },
    { key: 'classificationAllowList', label: 'Allowed Classifications', type: 'array', description: 'Allowed data classifications (public, internal, etc.)' },
    { key: 'maxDataAgeSeconds', label: 'Max Data Age (seconds)', type: 'number', description: 'Maximum data age in seconds' },
    { key: 'maxPricePerByte', label: 'Max Price Per Byte', type: 'number', description: 'Maximum price per byte limit' }
  ];

  const advancedRules = [
    { key: 'producerAllowList', label: 'Producer Allow List', type: 'array', description: 'Allowed producer public keys' },
    { key: 'producerBlockList', label: 'Producer Block List', type: 'array', description: 'Blocked producer public keys' },
    { key: 'maxLineageDepth', label: 'Max Lineage Depth', type: 'number', description: 'Maximum allowed lineage depth' },
    { key: 'requiredAncestor', label: 'Required Ancestor', type: 'string', description: 'Required ancestor version ID' },
    { key: 'licenseAllowList', label: 'License Allow List', type: 'array', description: 'Allowed data licenses' },
    { key: 'piiFlagsBlockList', label: 'PII Flags Block List', type: 'array', description: 'Blocked PII flag types' },
    { key: 'geoOriginAllowList', label: 'Geo Origin Allow List', type: 'array', description: 'Allowed geographic origins' },
    { key: 'requiredSchemaHash', label: 'Required Schema Hash', type: 'string', description: 'Required exact schema hash' },
    { key: 'requiredMimeTypes', label: 'Required MIME Types', type: 'array', description: 'Required MIME types' },
    { key: 'requiredOntologyTags', label: 'Required Ontology Tags', type: 'array', description: 'Required ontology tags' },
    { key: 'minProducerUptime', label: 'Min Producer Uptime (%)', type: 'number', description: 'Minimum producer uptime percentage' },
    { key: 'requiresBillingAccount', label: 'Requires Billing Account', type: 'boolean', description: 'Billing account required' },
    { key: 'blockIfInThreatFeed', label: 'Block If In Threat Feed', type: 'boolean', description: 'Block if found in threat feeds' },
    { key: 'minAnonymizationLevel', label: 'Min Anonymization Level', type: 'object', description: 'Minimum anonymization requirements' }
  ];

  const policyTypes = [
    { value: 'access_control', label: 'Access Control' },
    { value: 'privacy', label: 'Privacy' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'data_quality', label: 'Data Quality' },
    { value: 'mlops', label: 'MLOps' }
  ];

  async function loadPolicies() {
    policyLoading = true;
    try {
      // Try API first, fallback to dummy data
      try {
        const response = await fetch('/api/policies');
        if (response.ok) {
          const result = await response.json();
          policies = result.policies || [];
        } else {
          policies = generateDummyPolicies();
        }
      } catch (e) {
        policies = generateDummyPolicies();
      }
    } catch (error) {
      console.error('Failed to load policies:', error);
      policies = [];
    } finally {
      policyLoading = false;
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
        rulesCount: 5,
        policy: {
          minConfs: 6,
          classificationAllowList: ['public', 'internal'],
          allowRecalled: false,
          maxLineageDepth: 10,
          maxDataAgeSeconds: 30 * 24 * 60 * 60
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
        rulesCount: 6,
        policy: {
          minConfs: 6,
          allowRecalled: false,
          piiFlagsBlockList: ['has_personal_info', 'has_contact_details'],
          minAnonymizationLevel: { type: 'k-anon', k: 5 },
          blockIfInThreatFeed: true,
          requiresBillingAccount: true
        }
      },
      {
        policyId: 'pol_003',
        name: 'High Quality Data Only',
        description: 'Ensures only high-quality, recent data is accessed',
        enabled: false,
        createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'data_quality',
        rulesCount: 4,
        policy: {
          minConfs: 12,
          allowRecalled: false,
          maxDataAgeSeconds: 24 * 60 * 60, // 1 day
          maxPricePerByte: 0.001,
          minProducerUptime: 99.0
        }
      },
      {
        policyId: 'pol_004',
        name: 'Compliance Ready',
        description: 'Full compliance with regulatory requirements',
        enabled: true,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'compliance',
        rulesCount: 7,
        policy: {
          minConfs: 6,
          allowRecalled: false,
          classificationAllowList: ['public'],
          licenseAllowList: ['CC-BY', 'CC-BY-SA', 'MIT'],
          geoOriginAllowList: ['US', 'EU', 'CA'],
          requiresBillingAccount: true,
          blockIfInThreatFeed: true
        }
      }
    ];
  }

  async function createPolicy() {
    try {
      policyLoading = true;

      // Generate policy ID
      const policyId = 'pol_' + Math.random().toString(36).substr(2, 9);

      const policyToCreate = {
        ...newPolicy,
        policyId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rulesCount: Object.keys(newPolicy.policy).length
      };

      // Try to save via API
      try {
        await fetch('/api/policies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(policyToCreate)
        });
      } catch (error) {
        console.warn('Policy API save failed, storing locally:', error);
      }

      // Add to policies list
      policies = [policyToCreate, ...policies];

      // Reset form
      newPolicy = {
        name: '',
        description: '',
        type: 'access_control',
        enabled: true,
        policy: {
          minConfs: 6,
          allowRecalled: false
        }
      };

      showCreatePolicy = false;
      alert('Policy created successfully!');

    } catch (error) {
      console.error('Failed to create policy:', error);
      alert('Failed to create policy: ' + error.message);
    } finally {
      policyLoading = false;
    }
  }

  async function togglePolicy(policy) {
    try {
      // Optimistic update
      policy.enabled = !policy.enabled;
      policies = policies;

      // Try to persist the change
      await fetch(`/api/policies/${policy.policyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: policy.enabled })
      });
    } catch (error) {
      // Revert on error
      policy.enabled = !policy.enabled;
      policies = policies;
      console.error('Failed to toggle policy:', error);
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  function updateRuleValue(key, value, type) {
    if (type === 'array') {
      newPolicy.policy[key] = typeof value === 'string' ?
        value.split(',').map(v => v.trim()).filter(v => v) : value;
    } else if (type === 'number') {
      newPolicy.policy[key] = value ? parseFloat(value) : undefined;
    } else if (type === 'boolean') {
      newPolicy.policy[key] = value === 'true' ? true : value === 'false' ? false : undefined;
    } else if (type === 'object') {
      try {
        newPolicy.policy[key] = JSON.parse(value);
      } catch (e) {
        newPolicy.policy[key] = value;
      }
    } else {
      newPolicy.policy[key] = value || undefined;
    }

    // Remove undefined values
    if (newPolicy.policy[key] === undefined) {
      delete newPolicy.policy[key];
    }
  }

  function formatRuleValue(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  // Certificate Management Functions
  // Only load existing certificates, don't auto-issue
  async function loadCertificateOnly() {
    try {
      certificateLoading = true;
      // Try to load existing certificates
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

  // Load existing certificates and auto-issue if none exist (for backwards compatibility)
  async function loadCertificate() {
    try {
      certificateLoading = true;
      // Try to load existing certificates
      await certificateService.loadCertificatesFromWallet();
      const certificates = certificateService.getAllCertificates();
      if (certificates.length > 0) {
        userCertificate = certificates[0];
      } else {
        // Try to issue a new certificate if none exists
        await issueCertificate();
      }
    } catch (error) {
      console.error('Failed to load certificate:', error);
    } finally {
      certificateLoading = false;
    }
  }

  async function issueCertificate() {
    try {
      certificateLoading = true;

      // Create combined profile from producer and consumer data
      const combinedProfile = {
        identityKey: producerProfile.identityKey || consumerProfile.identityKey,
        displayName: producerProfile.displayName || consumerProfile.displayName,
        description: producerProfile.description || consumerProfile.description,
        region: producerProfile.region || consumerProfile.region,
        contactEmail: producerProfile.contactEmail || consumerProfile.contactEmail,
        website: producerProfile.website || consumerProfile.website,
        producerInitialized,
        consumerInitialized,
        overlayUrl,
        capabilities: ['data-production', 'data-consumption'] // Default capabilities
      };

      const certificate = await certificateService.issueCertificate(combinedProfile);
      userCertificate = certificate;

      alert('Certificate issued successfully! You are now a verified Gitdata participant.');
    } catch (error) {
      console.error('Certificate issuance failed:', error);
      alert('Failed to issue certificate: ' + error.message);
    } finally {
      certificateLoading = false;
    }
  }


  function downloadCertificate() {
    if (!userCertificate) return;

    try {
      const certificateJson = certificateService.exportCertificate(userCertificate.subject);
      const blob = new Blob([certificateJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `gitdata-certificate-${userCertificate.subject}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Certificate download failed:', error);
      alert('Failed to download certificate');
    }
  }

  async function saveToWallet() {
    if (!userCertificate) return;

    try {
      certificateLoading = true;

      if (!walletConnected) {
        alert('Please ensure MetaNet Desktop is running and connected before importing certificate to wallet.');
        return;
      }

      await certificateService.saveCertificateToWallet(userCertificate.subject);

      // Show success message with instructions
      alert(`✅ Certificate imported to MetaNet wallet successfully!\n\n📋 Your Gitdata Participant Certificate is now saved in your BSV Desktop wallet.\n\n🔍 Check your wallet's certificate section to view and manage your imported certificate.`);

      console.log('🎉 Certificate import completed successfully');
    } catch (error) {
      console.error('Save to wallet failed:', error);

      // Show detailed error message
      let errorMessage = 'Failed to import certificate to wallet.';
      if (error.message.includes('not supported')) {
        errorMessage += '\n\n⚠️ Your MetaNet wallet may not support certificate import. The certificate has been saved as a wallet record instead.';
      } else {
        errorMessage += '\n\nError: ' + error.message;
      }

      alert(errorMessage);
    } finally {
      certificateLoading = false;
    }
  }

  function formatCertificateDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  function getCertificateStatus(certificate) {
    if (!certificate) return 'none';
    if (certificate.fields.revoked) return 'revoked';
    if (certificate.expiresAt && new Date() > new Date(certificate.expiresAt)) return 'expired';
    return 'valid';
  }

  function getCertificateStatusColor(status) {
    switch (status) {
      case 'valid': return 'status-success';
      case 'expired': return 'status-warning';
      case 'revoked': return 'status-error';
      default: return 'status-inactive';
    }
  }

  // Certificate Pulling Functions
  async function pullCertificate() {
    try {
      pullLoading = true;
      const participantId = producerProfile.identityKey || consumerProfile.identityKey;

      if (!participantId) {
        alert('Please initialize your identity first');
        return;
      }

      const certificate = await certificateService.pullCertificate(pullUrl, participantId);
      userCertificate = certificate;
      showPullForm = false;
      pullUrl = 'http://localhost:3002'; // Reset to default

      alert('Certificate successfully pulled from external certifier!');
    } catch (error) {
      console.error('Certificate pull failed:', error);
      alert('Failed to pull certificate: ' + error.message);
    } finally {
      pullLoading = false;
    }
  }

  async function importCertificate() {
    try {
      if (!importJson.trim()) {
        alert('Please enter certificate JSON data');
        return;
      }

      const certificate = certificateService.importCertificate(importJson);
      userCertificate = certificate;
      showImportForm = false;
      importJson = '';

      alert('Certificate successfully imported!');
    } catch (error) {
      console.error('Certificate import failed:', error);
      alert('Failed to import certificate: ' + error.message);
    }
  }

  // Reactive statements for tab switching
  $: {
    if (activeTab === 'analytics' && !analyticsData) {
      loadAnalytics();
    }
    if (activeTab === 'services' && services.length === 0 && !servicesLoading) {
      loadServices();
    }
    if (activeTab === 'policy' && policies.length === 0 && !policyLoading) {
      loadPolicies();
    }
  }

  // Filter policies reactively
  $: {
    filteredPolicies = policies.filter(policy => {
      const matchesSearch = policy.name.toLowerCase().includes(policySearchFilter.toLowerCase()) ||
                           policy.description.toLowerCase().includes(policySearchFilter.toLowerCase());
      const matchesStatus = policyStatusFilter === 'all' ||
                           (policyStatusFilter === 'active' && policy.enabled) ||
                           (policyStatusFilter === 'inactive' && !policy.enabled);
      const matchesType = policyTypeFilter === 'all' || policy.type === policyTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }


</script>

<div class="gitbook-layout">
  <!-- Sidebar Navigation -->
  <nav class="sidebar">
    <div class="sidebar-header">
      <h2>Settings</h2>
      <button class="back-btn" on:click={() => goto('/')}>← Back to Home</button>
    </div>

    <div class="nav-menu">
      <button
        class="nav-item {activeTab === 'profile' ? 'active' : ''}"
        on:click={() => activeTab = 'profile'}
      >
        <span class="nav-icon">•</span>
        <span class="nav-label">Identity</span>
      </button>

      <button
        class="nav-item {activeTab === 'policy' ? 'active' : ''}"
        on:click={() => activeTab = 'policy'}
      >
        <span class="nav-icon">•</span>
        <span class="nav-label">Policy</span>
      </button>

      <button
        class="nav-item {activeTab === 'analytics' ? 'active' : ''}"
        on:click={() => activeTab = 'analytics'}
      >
        <span class="nav-icon">•</span>
        <span class="nav-label">Analytics</span>
      </button>

      <button
        class="nav-item {activeTab === 'services' ? 'active' : ''}"
        on:click={() => activeTab = 'services'}
      >
        <span class="nav-icon">•</span>
        <span class="nav-label">Services</span>
      </button>

    </div>
  </nav>

  <!-- Main Content -->
  <main class="main-content">
    <div class="content-wrapper">
      <!-- Tab Content -->
  {#if activeTab === 'profile'}
    <div class="section-content">

      <!-- Unified Identity Section -->
      <div class="unified-identity-section">
        {#if !producerInitialized}
          <div class="page-header">
            <h1>Create Your Identity</h1>
            <p>Set up your marketplace identity to buy and sell data</p>
          </div>

            <form on:submit|preventDefault={initializeIdentity}>
              <div class="form-grid">
                <div class="form-group span-2">
                  <label for="displayName">Display Name *</label>
                  <input
                    id="displayName"
                    type="text"
                    bind:value={userIdentity.displayName}
                    required
                    placeholder="My Company"
                    class="form-input"
                  />
                </div>

                <div class="form-group span-2">
                  <label for="description">Description *</label>
                  <textarea
                    id="description"
                    bind:value={userIdentity.description}
                    required
                    placeholder="Brief description of your organization or use case"
                    class="form-input"
                    rows="3"
                  ></textarea>
                </div>
              </div>

              <div class="form-actions">
                <button
                  type="submit"
                  disabled={identityLoading || !userIdentity.displayName || !userIdentity.description}
                  class="btn btn-primary"
                >
                  {identityLoading ? 'Creating Identity...' : 'Create Identity'}
                </button>
              </div>
            </form>
        {:else}
          <div class="page-header">
            <h1>{producerProfile.displayName}</h1>
            <p>{producerProfile.description || 'No description provided'}</p>
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
                  <span>{producerProfile.contactEmail === 'noemail@example.com' ? 'Not provided' : producerProfile.contactEmail}</span>
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


            <div class="profile-actions">
              <button on:click={resetProducerIdentity} class="btn btn-secondary">
                Reset Identity
              </button>
              <a href="/" class="btn btn-primary">
                Browse Marketplace
              </a>
            </div>
        {/if}
      </div>
    </div>
  {:else if activeTab === 'identity'}
    <div class="section-content">
      <!-- Identity Certificate -->
      <div class="certificate-section">
        <h1>Identity Certificate</h1>

        {#if certificateLoading}
          <div class="loading-state">
            <p>Loading certificate...</p>
          </div>
        {:else if userCertificate}
          <div class="certificate-readonly">
            <div class="certificate-header">
              <h3>Gitdata Participant Certificate</h3>
              <span class="certificate-status verified">VALID</span>
            </div>
            <div class="certificate-info">
              <div class="info-row">
                <label>Name:</label>
                <span>{userCertificate.fields?.display_name || 'Unknown'}</span>
              </div>
              <div class="info-row">
                <label>Status:</label>
                <span class="verified">{userCertificate.fields?.participant || 'verified'}</span>
              </div>
              <div class="info-row">
                <label>Identity Key:</label>
                <code>{userCertificate.subject?.substring(0, 32) || 'N/A'}...</code>
              </div>
              <div class="info-row">
                <label>Serial Number:</label>
                <code>{userCertificate.serialNumber?.substring(0, 16) || 'N/A'}...</code>
              </div>
              <div class="info-row">
                <label>Issued:</label>
                <span>{userCertificate.issuedAt ? formatCertificateDate(userCertificate.issuedAt) : 'N/A'}</span>
              </div>
              {#if userCertificate.expiresAt}
                <div class="info-row">
                  <label>Expires:</label>
                  <span>{formatCertificateDate(userCertificate.expiresAt)}</span>
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <div class="no-certificate">
            <p>No certificate found</p>
            <button on:click={loadCertificate} class="btn btn-primary">Load Certificate</button>
          </div>
        {/if}
      </div>
    </div>
  {:else if activeTab === 'policy'}
    <div class="section-content">
      <div class="page-header">
        <h1>Policy Management</h1>
        <p>Content and data governance policies</p>
      </div>

      <!-- Controls -->
      <div class="policy-controls">
        <div class="policy-filters">
          <input
            type="text"
            bind:value={policySearchFilter}
            placeholder="Search policies..."
            class="search-input"
          />

          <select bind:value={policyStatusFilter} class="filter-select">
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <select bind:value={policyTypeFilter} class="filter-select">
            <option value="all">All Types</option>
            {#each policyTypes as type}
              <option value={type.value}>{type.label}</option>
            {/each}
          </select>
        </div>

        <div class="policy-actions">
          <button on:click={() => showCreatePolicy = !showCreatePolicy} class="btn btn-primary">
            {showCreatePolicy ? 'Cancel' : 'Create Policy'}
          </button>
          <button on:click={loadPolicies} class="btn btn-secondary" disabled={policyLoading}>
            {policyLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <!-- Create Policy Form -->
      {#if showCreatePolicy}
        <div class="policy-form">
          <h2>Create New Policy</h2>

          <form on:submit|preventDefault={createPolicy}>
            <div class="form-grid">
              <div class="form-group">
                <label for="policyName">Policy Name *</label>
                <input
                  id="policyName"
                  type="text"
                  bind:value={newPolicy.name}
                  required
                  placeholder="My Policy"
                  class="form-input"
                />
              </div>

              <div class="form-group">
                <label for="policyType">Policy Type *</label>
                <select id="policyType" bind:value={newPolicy.type} class="form-input">
                  {#each policyTypes as type}
                    <option value={type.value}>{type.label}</option>
                  {/each}
                </select>
              </div>

              <div class="form-group span-2">
                <label for="policyDescription">Description</label>
                <textarea
                  id="policyDescription"
                  bind:value={newPolicy.description}
                  placeholder="Describe the purpose and scope of this policy"
                  class="form-input"
                  rows="2"
                ></textarea>
              </div>

              <div class="form-group">
                <label>
                  <input type="checkbox" bind:checked={newPolicy.enabled} />
                  Enable policy immediately
                </label>
              </div>
            </div>

            <!-- Basic Rules -->
            <div class="rules-section">
              <h3>Basic Rules (Applicable to All Data Types)</h3>
              <div class="rules-grid">
                {#each basicRules as rule}
                  <div class="rule-item">
                    <label>{rule.label}</label>
                    <p class="rule-description">{rule.description}</p>

                    {#if rule.type === 'boolean'}
                      <select
                        value={newPolicy.policy[rule.key] === true ? 'true' : newPolicy.policy[rule.key] === false ? 'false' : ''}
                        on:change={(e) => updateRuleValue(rule.key, e.target.value, rule.type)}
                        class="form-input"
                      >
                        <option value="">Not Set</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    {:else if rule.type === 'number'}
                      <input
                        type="number"
                        value={newPolicy.policy[rule.key] || ''}
                        on:input={(e) => updateRuleValue(rule.key, e.target.value, rule.type)}
                        class="form-input"
                      />
                    {:else if rule.type === 'array'}
                      <input
                        type="text"
                        value={formatRuleValue(newPolicy.policy[rule.key] || [])}
                        on:input={(e) => updateRuleValue(rule.key, e.target.value, rule.type)}
                        placeholder="Comma-separated values"
                        class="form-input"
                      />
                    {:else}
                      <input
                        type="text"
                        value={newPolicy.policy[rule.key] || ''}
                        on:input={(e) => updateRuleValue(rule.key, e.target.value, rule.type)}
                        class="form-input"
                      />
                    {/if}
                  </div>
                {/each}
              </div>
            </div>

            <!-- Advanced Rules (Hidden by default) -->
            <div class="advanced-rules-section">
              <button
                type="button"
                class="btn btn-secondary advanced-toggle"
                on:click={() => showAdvancedRules = !showAdvancedRules}
              >
                {showAdvancedRules ? 'Hide' : 'Show'} Advanced Rules ({advancedRules.length})
              </button>

              {#if showAdvancedRules}
                <div class="rules-grid">
                  {#each advancedRules as rule}
                    <div class="rule-item">
                      <label>{rule.label}</label>
                      <p class="rule-description">{rule.description}</p>

                      {#if rule.type === 'boolean'}
                        <select
                          value={newPolicy.policy[rule.key] === true ? 'true' : newPolicy.policy[rule.key] === false ? 'false' : ''}
                          on:change={(e) => updateRuleValue(rule.key, e.target.value, rule.type)}
                          class="form-input"
                        >
                          <option value="">Not Set</option>
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      {:else if rule.type === 'number'}
                        <input
                          type="number"
                          value={newPolicy.policy[rule.key] || ''}
                          on:input={(e) => updateRuleValue(rule.key, e.target.value, rule.type)}
                          class="form-input"
                        />
                      {:else if rule.type === 'array'}
                        <input
                          type="text"
                          value={formatRuleValue(newPolicy.policy[rule.key] || [])}
                          on:input={(e) => updateRuleValue(rule.key, e.target.value, rule.type)}
                          placeholder="Comma-separated values"
                          class="form-input"
                        />
                      {:else if rule.type === 'object'}
                        <textarea
                          value={formatRuleValue(newPolicy.policy[rule.key] || {})}
                          on:input={(e) => updateRuleValue(rule.key, e.target.value, rule.type)}
                          placeholder="JSON object"
                          class="form-input"
                          rows="3"
                        ></textarea>
                      {:else}
                        <input
                          type="text"
                          value={newPolicy.policy[rule.key] || ''}
                          on:input={(e) => updateRuleValue(rule.key, e.target.value, rule.type)}
                          class="form-input"
                        />
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="form-actions">
              <button type="submit" disabled={policyLoading || !newPolicy.name} class="btn btn-primary">
                {policyLoading ? 'Creating...' : 'Create Policy'}
              </button>
              <button type="button" on:click={() => showCreatePolicy = false} class="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      {/if}

      <!-- Policies List -->
      <div class="policies-list">
        <h2>Existing Policies ({filteredPolicies.length})</h2>

        {#if policyLoading}
          <div class="loading">
            Loading policies...
          </div>
        {:else if filteredPolicies.length === 0}
          <div class="empty-state">
            {#if policies.length === 0}
              <p>No policies created yet</p>
              <button on:click={() => showCreatePolicy = true} class="btn btn-primary">Create Your First Policy</button>
            {:else}
              <p>No policies match your current filters</p>
              <button on:click={() => { policySearchFilter = ''; policyStatusFilter = 'all'; policyTypeFilter = 'all'; }} class="btn btn-secondary">Clear Filters</button>
            {/if}
          </div>
        {:else}
          <div class="policies-grid">
            {#each filteredPolicies as policy}
              <div class="policy-card">
                <div class="policy-header">
                  <div class="policy-info">
                    <h3>{policy.name}</h3>
                    <div class="policy-meta">
                      <span class="policy-type">{policyTypes.find(t => t.value === policy.type)?.label || policy.type}</span>
                      <span class="policy-id">ID: {policy.policyId}</span>
                    </div>
                  </div>
                  <div class="policy-status">
                    <span class="status-badge {policy.enabled ? 'enabled' : 'disabled'}">
                      {policy.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <p class="policy-description">{policy.description}</p>

                <div class="policy-details">
                  <span class="rules-count">{policy.rulesCount || Object.keys(policy.policy).length} rules</span>
                  <span class="created-date">Created {formatDate(policy.createdAt)}</span>
                  <span class="updated-date">Updated {formatDate(policy.updatedAt)}</span>
                </div>

                <div class="policy-actions">
                  <button
                    on:click={() => togglePolicy(policy)}
                    class="btn btn-sm {policy.enabled ? 'btn-secondary' : 'btn-primary'}"
                  >
                    {policy.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <a href="/policy/{policy.policyId}" class="btn btn-sm btn-secondary">
                    View Details
                  </a>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

  {:else if activeTab === 'analytics'}
    <div class="section-content">
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
    <div class="section-content">
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
  }

  .sidebar-header {
    padding: 2rem 1.5rem 1rem 1.5rem;
    border-bottom: 1px solid #21262d;
  }

  .sidebar-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #f0f6fc;
    margin: 0 0 1rem 0;
  }

  .back-btn {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #8b949e;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .back-btn:hover {
    background: #30363d;
    border-color: #58a6ff;
    color: #f0f6fc;
  }

  .nav-menu {
    padding: 1rem 0;
    flex: 1;
  }

  .nav-item {
    width: 100%;
    background: none;
    border: none;
    padding: 0.75rem 1.5rem;
    text-align: left;
    color: #8b949e;
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
    background: #1f6feb;
    color: #ffffff;
    font-weight: 500;
  }

  .nav-icon {
    font-size: 16px;
    width: 20px;
    display: flex;
    justify-content: center;
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
  }

  .section-content {
    background: #0d1117;
  }

  .section-content h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #f0f6fc;
    margin-bottom: 1rem;
  }

  .section-content > p {
    font-size: 1.125rem;
    color: #8b949e;
    margin-bottom: 2rem;
    line-height: 1.6;
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



  .profile-status {
    display: flex;
    align-items: center;
    margin-top: 1rem;
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
    padding: 1rem 0;
    border-bottom: 1px solid #21262d;
    transition: border-color 0.2s;
  }

  .policy-card:hover {
    border-bottom-color: #58a6ff;
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

  /* Policy Management Styles - GitBook Cards */
  .policy-controls {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 8px;
  }

  .policy-filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .search-input, .filter-select {
    padding: 0.75rem 1rem;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
  }

  .search-input {
    flex: 1;
    min-width: 200px;
  }

  .filter-select {
    min-width: 140px;
  }

  .policy-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .policy-form {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 8px;
  }

  .policy-form h2 {
    color: #58a6ff;
    font-size: 1.25rem;
    margin: 0 0 1rem 0;
    font-weight: 600;
  }

  .rules-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #30363d;
  }

  .rules-section h3 {
    color: #f0f6fc;
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  .rules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .rule-item {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 1rem;
  }

  .rule-item label {
    font-weight: 600;
    color: #f0f6fc;
    font-size: 0.9rem;
    display: block;
    margin-bottom: 0.25rem;
  }

  .rule-description {
    color: #8b949e;
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
    line-height: 1.3;
  }

  .advanced-rules-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #30363d;
  }

  .advanced-toggle {
    margin-bottom: 1rem;
  }

  .policies-list {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .policies-list h2 {
    color: #f0f6fc;
    margin-bottom: 1rem;
  }

  .policies-grid {
    display: grid;
    gap: 1rem;
  }

  .policy-card {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
    transition: border-color 0.2s;
  }

  .policy-card:hover {
    border-color: #58a6ff;
  }

  .policy-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .policy-info h3 {
    color: #f0f6fc;
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
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
    text-transform: capitalize;
  }

  .policy-id {
    color: #6e7681;
    font-size: 0.8rem;
    font-family: monospace;
  }

  .policy-status {
    display: flex;
    align-items: center;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-badge.enabled {
    background: rgba(46, 160, 67, 0.2);
    color: #2ea043;
  }

  .status-badge.disabled {
    background: rgba(218, 54, 51, 0.2);
    color: #da3633;
  }

  .policy-description {
    color: #8b949e;
    line-height: 1.4;
    margin-bottom: 1rem;
  }

  .policy-details {
    display: flex;
    gap: 1rem;
    color: #6e7681;
    font-size: 0.8rem;
    margin-bottom: 1rem;
  }

  .policy-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #8b949e;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #8b949e;
  }

  .empty-state button {
    margin-top: 1rem;
  }

  /* Certificate Management Styles */
  .certificate-section {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .certificate-section h1 {
    color: #f0f6fc;
    margin-bottom: 1rem;
    font-size: 1.25rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .certificate-readonly {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 1rem;
  }

  .certificate-readonly .certificate-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #21262d;
  }

  .certificate-readonly .certificate-header h3 {
    color: #f0f6fc;
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .certificate-info .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #161b22;
  }

  .certificate-info .info-row:last-child {
    border-bottom: none;
  }

  .certificate-info label {
    color: #8b949e;
    font-weight: 500;
    min-width: 120px;
  }

  .certificate-info span {
    color: #f0f6fc;
    font-family: 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', Consolas, 'Courier New', monospace;
  }

  .certificate-info code {
    background: #161b22;
    color: #79c0ff;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.85rem;
    border: 1px solid #21262d;
  }

  .certificate-info .verified {
    color: #2ea043;
    font-weight: 600;
  }

  .no-certificate {
    text-align: center;
    padding: 2rem;
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
  }

  .no-certificate p {
    color: #8b949e;
    margin-bottom: 1rem;
  }

  .loading-state {
    text-align: center;
    padding: 2rem;
    color: #8b949e;
  }

  .certificate-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-item {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 1rem;
    text-align: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #58a6ff;
    display: block;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    color: #8b949e;
    font-size: 0.8rem;
    text-transform: uppercase;
    font-weight: 600;
  }

  .certificate-actions {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    align-items: center;
  }

  .certificate-cards {
    display: grid;
    gap: 1rem;
  }

  .certificate-card {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 1.5rem;
    transition: border-color 0.2s;
  }

  .certificate-card:hover {
    border-color: #58a6ff;
  }

  .certificate-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .certificate-info h3 {
    color: #f0f6fc;
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .certificate-subject {
    color: #8b949e;
    font-size: 0.9rem;
    font-family: monospace;
    word-break: break-all;
  }

  .certificate-status {
    display: flex;
    align-items: center;
  }

  .certificate-fields {
    margin-bottom: 1rem;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .field-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field-label {
    color: #6e7681;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .field-value {
    color: #f0f6fc;
    font-size: 0.9rem;
  }

  .certificate-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid #21262d;
    color: #6e7681;
    font-size: 0.8rem;
  }

  .issuance-form {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 1.5rem;
    margin-top: 1rem;
  }

  .issuance-form h3 {
    color: #58a6ff;
    margin-bottom: 1rem;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .benefits-section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: rgba(88, 166, 255, 0.05);
    border: 1px solid rgba(88, 166, 255, 0.2);
    border-radius: 6px;
  }

  .benefits-section h4 {
    color: #58a6ff;
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
  }

  .benefits-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .benefits-list li {
    color: #8b949e;
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .benefits-list li:before {
    content: "✓";
    color: #2ea043;
    font-weight: 600;
  }

  .issuance-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .certificate-download {
    margin-left: auto;
  }

  .certificate-empty {
    text-align: center;
    padding: 2rem;
    color: #8b949e;
  }

  .certificate-empty .icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  /* Certificate Pull & Import Styles */
  .alternative-options {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #21262d;
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
  }

  .or-divider {
    color: #6e7681;
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .pull-form, .import-form {
    margin-top: 1.5rem;
    padding: 1.5rem;
    background: rgba(88, 166, 255, 0.05);
    border: 1px solid rgba(88, 166, 255, 0.2);
    border-radius: 8px;
  }

  .pull-form h4, .import-form h4 {
    color: #58a6ff;
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
  }

  .pull-form p, .import-form p {
    color: #8b949e;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }

  .help-text {
    color: #6e7681;
    font-size: 0.8rem;
    margin-top: 0.25rem;
    display: block;
  }

  .form-input[type="url"] {
    font-family: monospace;
  }

  .form-input textarea {
    resize: vertical;
    font-family: monospace;
    font-size: 0.85rem;
  }

  .btn-large {
    padding: 1rem 2rem;
    font-size: 1.1rem;
    font-weight: 600;
  }

  /* Wallet Integration Styles */
  .wallet-notice {
    margin: 1.5rem 0;
    padding: 1rem;
    background: rgba(255, 123, 114, 0.1);
    border: 1px solid rgba(255, 123, 114, 0.3);
    border-radius: 6px;
    text-align: center;
  }

  .wallet-notice p {
    margin: 0.5rem 0;
    color: #ff7b72;
  }

  .wallet-notice strong {
    color: #ff9492;
  }

  .wallet-key {
    font-size: 0.8rem;
    background: #21262d;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    color: #58a6ff;
  }

  .req-item .verified {
    color: #2ea043;
    font-weight: 600;
  }

  .req-item .inactive {
    color: #8b949e;
    font-weight: 500;
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
    .section-content h1 {
      font-size: 2rem;
    }
    .policy-filters {
      flex-direction: column;
    }
    .rules-grid {
      grid-template-columns: 1fr;
    }
    .analytics-grid {
      grid-template-columns: 1fr;
    }
    .policies-grid {
      grid-template-columns: 1fr;
    }
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>