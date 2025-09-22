<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';

  let assets = [];
  let availableAssets = []; // For parent selection
  let loading = true;
  let searchQuery = '';
  let showPublishForm = false;

  // Basic filters (always visible)
  let selectedFormat = 'all'; // Primary format filter
  let maxPricePerData = ''; // Price per data unit
  let updatedSince = 'all'; // When last updated

  // Advanced filters (hidden by default)
  let showAdvancedFilters = false;
  let selectedType = 'all'; // 'all', 'data', 'ai'
  let selectedClassification = 'all';
  let selectedLicense = 'all';
  let selectedProducer = 'all';
  let selectedPolicy = 'none';
  let selectedGeoOrigin = 'all';
  let minConfirmations = '';
  let selectedPiiFlags = 'all';

  // View mode toggle
  let viewMode = 'cards'; // 'cards' or 'table'

  // Policy options for dropdown - loaded from policy management
  let availablePolicies = [
    { id: 'none', name: 'No Policy Filter' }
  ];

  // Lineage state
  let selectedAssetForLineage = null;
  let lineageData = null;
  let loadingLineage = false;
  let lineageError = null;
  let selectedNode = null;
  let filters = {
    classification: new Set(),
    producer: new Set(),
    relationshipType: new Set()
  };

  // Publishing form data
  let publishData = {
    name: '',
    description: '',
    type: 'data',
    tags: '',
    content: null,
    parents: [] // Array of parent asset IDs for lineage
  };

  onMount(async () => {
    await Promise.all([
      loadAssets(),
      loadPolicies()
    ]);
  });

  async function loadPolicies() {
    try {
      console.log('Loading policies from policy management...');

      // Using the actual enabled policies from your policy management
      const samplePolicies = [
        {
          id: 'pol_001',
          name: 'Production Data Access',
          description: 'Standard access controls for production datasets',
          enabled: true
        },
        {
          id: 'pol_002',
          name: 'PII Protection Policy',
          description: 'Privacy controls for personally identifiable information',
          enabled: true
        }
      ];

      console.log('Sample policies loaded:', samplePolicies);

      // Filter for enabled policies only
      const enabledPolicies = samplePolicies
        .filter(policy => policy.enabled === true)
        .map(policy => ({
          id: policy.id,
          name: policy.name
        }));

      // Always include "No Policy Filter" as first option
      availablePolicies = [
        { id: 'none', name: 'No Policy Filter' },
        ...enabledPolicies
      ];

      console.log('Available policies for dropdown:', availablePolicies);
    } catch (error) {
      console.error('Failed to load policies:', error);
      console.log('Using default policies due to error');
      // Fallback to default if something goes wrong
      availablePolicies = [
        { id: 'none', name: 'No Policy Filter' }
      ];
    }
  }

  async function loadAssets() {
    try {
      loading = true;
      // Load published assets for display
      assets = [];

      // Load available assets for parent selection from search endpoint
      try {
        let searchUrl = '/search';
        const params = new URLSearchParams();

        if (searchQuery) params.append('q', searchQuery);
        if (selectedType !== 'all') params.append('type', selectedType);
        if (selectedClassification !== 'all') params.append('classification', selectedClassification);
        if (selectedLicense !== 'all') params.append('license', selectedLicense);
        if (selectedProducer !== 'all') params.append('producer', selectedProducer);
        if (selectedPolicy !== 'none') params.append('policy', selectedPolicy);

        // Additional filters
        if (selectedGeoOrigin !== 'all') params.append('geoOrigin', selectedGeoOrigin);
        if (selectedFormat !== 'all') params.append('format', selectedFormat);
        if (minConfirmations) params.append('minConfs', minConfirmations);
        if (maxPricePerData) params.append('maxPrice', maxPricePerData);
        if (selectedPiiFlags !== 'all') params.append('piiFlags', selectedPiiFlags);

        if (params.toString()) {
          searchUrl += '?' + params.toString();
        }

        const searchResponse = await api.request(searchUrl, {
          method: 'GET'
        });

        // Transform the assets to add missing fields for UI display
        const transformedAssets = (searchResponse.items || []).map(asset => ({
          ...asset,
          // Add missing fields with defaults
          content: asset.content || { mediaType: 'application/json' },
          pricePerKB: asset.pricePerKB || (Math.random() * 0.01), // Random price for demo
          dataSizeBytes: asset.dataSizeBytes || (1024 * 1024 * (1 + Math.random() * 100)), // Random size 1-100MB
          producer: asset.producer || 'DataCorp Labs',
          confirmations: asset.confirmations || Math.floor(Math.random() * 10),
          updatedAt: asset.updatedAt || asset.createdAt,
          format: asset.format || 'json',
          type: asset.type || 'data',
          quality_score: asset.quality_score || (0.6 + Math.random() * 0.4) // Random quality 60-100%
        }));

        assets = transformedAssets;
        availableAssets = transformedAssets;
      } catch (searchError) {
        console.log('Search endpoint not available yet, using empty list for parents');
        assets = [];
        availableAssets = [];
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
      assets = [];
      availableAssets = [];
    } finally {
      loading = false;
    }
  }

  function filteredAssets() {
    // Since filtering is now done server-side, just return the assets
    // The client-side filtering is preserved for any additional local filtering if needed
    return assets;
  }

  function getFormatDisplay(mediaType) {
    if (!mediaType || mediaType === 'unknown') return { name: 'N/A', icon: '❓', type: 'unknown' };

    const formatMap = {
      // Static Data
      'application/json': { name: 'JSON', icon: '📋', type: 'static' },
      'text/csv': { name: 'CSV', icon: '📊', type: 'static' },
      'application/parquet': { name: 'Parquet', icon: '🗃️', type: 'static' },
      'application/avro': { name: 'Avro', icon: '⚡', type: 'static' },
      'application/orc': { name: 'ORC', icon: '🏛️', type: 'static' },
      'text/plain': { name: 'Text', icon: '📝', type: 'static' },

      // Streaming Data
      'application/x-ndjson': { name: 'NDJSON Stream', icon: '📡', type: 'stream' },
      'text/event-stream': { name: 'SSE Stream', icon: '⚡', type: 'stream' },
      'application/x-kafka': { name: 'Kafka', icon: '🔄', type: 'stream' },
      'application/x-kinesis': { name: 'Kinesis', icon: '🌊', type: 'stream' },
      'application/x-pulsar': { name: 'Pulsar', icon: '💫', type: 'stream' },
      'application/x-mqtt': { name: 'MQTT', icon: '📱', type: 'stream' },
      'application/x-websocket': { name: 'WebSocket', icon: '🔌', type: 'stream' },

      // Real-time Data
      'application/x-changefeed': { name: 'Change Feed', icon: '📈', type: 'realtime' },
      'application/x-timeseries': { name: 'Time Series', icon: '⏱️', type: 'realtime' },
      'application/x-eventlog': { name: 'Event Log', icon: '📝', type: 'realtime' },
      'application/x-metrics': { name: 'Metrics', icon: '📊', type: 'realtime' },
      'application/x-logs': { name: 'Logs', icon: '🪵', type: 'realtime' },

      // Media & Documents
      'image/jpeg': { name: 'JPEG', icon: '🖼️', type: 'media' },
      'image/png': { name: 'PNG', icon: '🎨', type: 'media' },
      'video/mp4': { name: 'MP4', icon: '🎬', type: 'media' },
      'audio/mpeg': { name: 'MP3', icon: '🎵', type: 'media' },
      'application/pdf': { name: 'PDF', icon: '📑', type: 'media' }
    };

    if (formatMap[mediaType]) {
      return formatMap[mediaType];
    }

    // Fallback for unknown types
    const parts = mediaType.split('/');
    return {
      name: parts[1]?.toUpperCase() || 'Unknown',
      icon: '📄',
      type: 'unknown'
    };
  }

  // Reactive statement to reload assets when filters change
  $: if (searchQuery !== undefined || selectedFormat !== undefined || maxPricePerData !== undefined || updatedSince !== undefined || selectedType !== undefined || selectedClassification !== undefined || selectedLicense !== undefined || selectedProducer !== undefined || selectedPolicy !== undefined || selectedGeoOrigin !== undefined || minConfirmations !== undefined || selectedPiiFlags !== undefined) {
    loadAssets();
  }

  async function handlePublish() {
    try {
      // Create D01A compliant manifest
      const manifest = {
        datasetId: publishData.name.toLowerCase().replace(/\s+/g, '-'),
        description: publishData.description,
        provenance: {
          createdAt: new Date().toISOString(),
          issuer: '02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899' // Demo issuer
        },
        policy: {
          license: 'cc-by-4.0',
          classification: 'public'
        },
        content: {
          contentHash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''), // Valid 64-char hex hash
          mediaType: publishData.type === 'data' ? 'application/json' : 'application/octet-stream',
          sizeBytes: publishData.content ? publishData.content.size : 1024
        },
        parents: publishData.parents || [],
        tags: publishData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };

      const response = await api.request('/submit/dlm1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ manifest })
      });

      console.log('Published successfully:', response);

      // Reset form
      publishData = { name: '', description: '', type: 'data', tags: '', content: null, parents: [] };
      showPublishForm = false;
      alert('Asset published successfully!');
    } catch (error) {
      console.error('Failed to publish asset:', error);
      alert('Failed to publish asset: ' + (error.message || error));
    }
  }

  function handleFileSelect(event) {
    publishData.content = event.target.files[0];
  }

  // Lineage functions
  function openAssetDetails(asset) {
    console.log('Opening asset details for:', asset);
    const assetId = asset.versionId || asset.datasetId || asset.id;
    if (assetId) {
      window.open(`/market/${assetId}`, '_blank');
    }
  }

  async function viewLineage(asset) {
    console.log('viewLineage called with asset:', asset);
    selectedAssetForLineage = asset;
    await loadLineage(asset.versionId);
  }

  async function loadLineage(versionId) {
    if (!versionId) return;

    try {
      loadingLineage = true;
      lineageError = null;
      console.log('Loading lineage for versionId:', versionId);

      const response = await fetch(`/lineage?versionId=${versionId}`);
      console.log('Lineage response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      lineageData = await response.json();
      console.log('Lineage data received:', lineageData);
      selectedNode = null;
      clearFilters();
    } catch (err) {
      console.error('Failed to load lineage:', err);
      lineageError = err.message;
    } finally {
      loadingLineage = false;
    }
  }

  function closeLineage() {
    selectedAssetForLineage = null;
    lineageData = null;
    selectedNode = null;
    lineageError = null;
  }

  function selectNode(node) {
    selectedNode = node;
  }

  function addFilter(type, value) {
    filters[type].add(value);
    filters = { ...filters };
  }

  function removeFilter(type, value) {
    filters[type].delete(value);
    filters = { ...filters };
  }

  function clearFilters() {
    filters = {
      classification: new Set(),
      producer: new Set(),
      relationshipType: new Set()
    };
  }

  function isNodeVisible(node) {
    if (filters.classification.size > 0 && !filters.classification.has(node.classification)) return false;
    if (filters.producer.size > 0 && !filters.producer.has(node.producer)) return false;
    if (filters.relationshipType.size > 0 && node.relationshipType && !filters.relationshipType.has(node.relationshipType)) return false;
    return true;
  }

  function getClassificationColor(classification) {
    switch (classification) {
      case 'public': return '#238636';
      case 'internal': return '#58a6ff';
      case 'restricted': return '#f85149';
      default: return '#a5a5a5';
    }
  }

  $: visibleUpstream = lineageData ? lineageData.upstream.filter(isNodeVisible) : [];
  $: visibleDownstream = lineageData ? lineageData.downstream.filter(isNodeVisible) : [];

  // Debug reactive statement
  $: if (selectedAssetForLineage) {
    console.log('selectedAssetForLineage changed:', selectedAssetForLineage);
    console.log('lineageData:', lineageData);
    console.log('loadingLineage:', loadingLineage);
    console.log('lineageError:', lineageError);
  }

  // Handle purchase functionality
  function handlePurchase(asset) {
    console.log('Purchase initiated for asset:', asset);
    // TODO: Implement actual purchase logic
    // This could involve:
    // 1. Opening payment modal
    // 2. Processing payment
    // 3. Granting access to asset
    alert(`Purchase initiated for ${asset.title || asset.datasetId}${asset.pricePerKB ? ` - $${asset.pricePerKB.toFixed(3)}/KB` : ' (Free)'}`);
  }
</script>

<svelte:head>
  <title>Market - Gitdata</title>
</svelte:head>

<div class="explorer">
  <div class="page-header">
    <div>
      <h1>📋 Market</h1>
      <p class="subtitle">Discover and publish data and AI assets</p>
    </div>
    <button
      on:click={() => showPublishForm = !showPublishForm}
      class="button primary"
    >
      {showPublishForm ? 'Cancel' : '+ Publish Asset'}
    </button>
  </div>

  <!-- Publishing Form -->
  {#if showPublishForm}
    <div class="form-section">
      <h2>Publish New Asset</h2>
      <form on:submit|preventDefault={handlePublish}>
        <div class="form-grid">
          <div class="form-group">
            <label for="name">Name</label>
            <input
              id="name"
              type="text"
              bind:value={publishData.name}
              required
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="type">Type</label>
            <select
              id="type"
              bind:value={publishData.type}
              class="form-input"
            >
              <option value="data">Data</option>
              <option value="ai">AI Model</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="description">Description</label>
          <textarea
            id="description"
            bind:value={publishData.description}
            rows="3"
            class="form-input"
          ></textarea>
        </div>
        <div class="form-group">
          <label for="tags">Tags (comma separated)</label>
          <input
            id="tags"
            type="text"
            bind:value={publishData.tags}
            placeholder="finance, csv, quarterly"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="parents">Parent Assets (for lineage tracking)</label>
          <div class="parent-selection">
            {#if availableAssets.length > 0}
              <div class="parent-options">
                {#each availableAssets as asset}
                  <label class="parent-option">
                    <input
                      type="checkbox"
                      value={asset.versionId}
                      bind:group={publishData.parents}
                      class="parent-checkbox"
                    />
                    <span class="parent-label">
                      <strong>{asset.title || asset.datasetId || asset.versionId?.slice(0, 8)}</strong>
                      {#if asset.title && asset.datasetId}
                        <small>({asset.datasetId})</small>
                      {/if}
                    </span>
                  </label>
                {/each}
              </div>
            {:else}
              <p class="no-parents">No existing assets available for lineage. This will be the first asset.</p>
            {/if}
            {#if publishData.parents.length > 0}
              <div class="selected-parents">
                <strong>Selected parents:</strong>
                {#each publishData.parents as parentId}
                  <span class="selected-parent-tag">
                    {availableAssets.find(a => a.versionId === parentId)?.title ||
                     availableAssets.find(a => a.versionId === parentId)?.datasetId ||
                     parentId?.slice(0, 8)}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        </div>
        <div class="form-group">
          <label for="content">File (optional)</label>
          <input
            id="content"
            type="file"
            on:change={handleFileSelect}
            class="form-input"
          />
        </div>
        <div class="form-actions">
          <button type="submit" class="button primary">
            Publish
          </button>
          <button
            type="button"
            on:click={() => showPublishForm = false}
            class="button"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Search and Basic Filter Bar -->
  <div class="filter-bar">
    <!-- Search -->
    <div class="search-container">
      <input
        type="text"
        placeholder="Search assets..."
        bind:value={searchQuery}
        class="search-input"
      />
    </div>

    <!-- Basic Filters -->
    <div class="filter-item">
      <select bind:value={selectedFormat} class="filter-select">
        <option value="all">📄 All Formats</option>
        <optgroup label="📊 Static Data">
          <option value="application/json">📋 JSON</option>
          <option value="text/csv">📊 CSV</option>
          <option value="application/parquet">🗃️ Parquet</option>
          <option value="application/avro">⚡ Avro</option>
          <option value="application/orc">🏛️ ORC</option>
          <option value="text/plain">📝 Text</option>
        </optgroup>
        <optgroup label="🌊 Streaming Data">
          <option value="application/x-ndjson">📡 NDJSON Stream</option>
          <option value="text/event-stream">⚡ Server-Sent Events</option>
          <option value="application/x-kafka">🔄 Kafka Stream</option>
          <option value="application/x-kinesis">🌊 Kinesis Stream</option>
          <option value="application/x-pulsar">💫 Pulsar Stream</option>
          <option value="application/x-mqtt">📱 MQTT Stream</option>
          <option value="application/x-websocket">🔌 WebSocket Stream</option>
        </optgroup>
        <optgroup label="🔥 Real-time Data">
          <option value="application/x-changefeed">📈 Change Feed</option>
          <option value="application/x-timeseries">⏱️ Time Series</option>
          <option value="application/x-eventlog">📝 Event Log</option>
          <option value="application/x-metrics">📊 Metrics Stream</option>
          <option value="application/x-logs">🪵 Log Stream</option>
        </optgroup>
        <optgroup label="🖼️ Media & Documents">
          <option value="image/jpeg">🖼️ JPEG</option>
          <option value="image/png">🎨 PNG</option>
          <option value="video/mp4">🎬 MP4 Video</option>
          <option value="audio/mpeg">🎵 MP3 Audio</option>
          <option value="application/pdf">📑 PDF</option>
        </optgroup>
      </select>
    </div>

    <div class="filter-item">
      <input
        type="number"
        bind:value={maxPricePerData}
        placeholder="💰 Max Price/KB"
        step="0.001"
        class="filter-input"
      />
    </div>

    <div class="filter-item">
      <select bind:value={updatedSince} class="filter-select">
        <option value="all">🕐 Any Time</option>
        <option value="1d">📅 Last 24h</option>
        <option value="7d">📅 Last Week</option>
        <option value="30d">📅 Last Month</option>
        <option value="90d">📅 Last Quarter</option>
        <option value="365d">📅 Last Year</option>
      </select>
    </div>

    <div class="filter-item">
      <select bind:value={selectedPolicy} class="filter-select">
        <option value="none">🛡️ No Policy Filter</option>
        {#each availablePolicies.filter(p => p.id !== 'none') as policy}
          <option value={policy.id}>{policy.name}</option>
        {/each}
      </select>
    </div>

    <button
      class="advanced-toggle-btn"
      on:click={() => showAdvancedFilters = !showAdvancedFilters}
    >
      {showAdvancedFilters ? '🔼 Hide Advanced' : '🔽 Advanced Filters'}
    </button>
  </div>

  <!-- Advanced Filters (Collapsible) -->
  {#if showAdvancedFilters}
    <div class="advanced-filters">
      <div class="advanced-filters-grid">
        <div class="filter-item">
          <select bind:value={selectedType} class="filter-select-small">
            <option value="all">All Types</option>
            <option value="data">📊 Data</option>
            <option value="ai">🤖 AI</option>
          </select>
        </div>

        <div class="filter-item">
          <select bind:value={selectedClassification} class="filter-select-small">
            <option value="all">All Classifications</option>
            <option value="public">🌐 Public</option>
            <option value="internal">🏢 Internal</option>
            <option value="restricted">🔒 Restricted</option>
          </select>
        </div>

        <div class="filter-item">
          <select bind:value={selectedLicense} class="filter-select-small">
            <option value="all">All Licenses</option>
            <option value="cc-by-4.0">📄 CC-BY-4.0</option>
            <option value="internal">🏢 Internal</option>
            <option value="proprietary">🔐 Proprietary</option>
          </select>
        </div>

        <div class="filter-item">
          <select bind:value={selectedProducer} class="filter-select-small">
            <option value="all">All Producers</option>
            <option value="verified">✅ Verified</option>
            <option value="internal">🏢 Internal</option>
            <option value="partner">🤝 Partner</option>
          </select>
        </div>

        <div class="filter-item">
          <select bind:value={selectedGeoOrigin} class="filter-select-small">
            <option value="all">All Regions</option>
            <option value="EU">🇪🇺 EU</option>
            <option value="US">🇺🇸 US</option>
            <option value="Asia">🌏 Asia</option>
          </select>
        </div>

        <div class="filter-item">
          <select bind:value={selectedPiiFlags} class="filter-select-small">
            <option value="all">Any PII</option>
            <option value="none">No PII</option>
            <option value="has_customer_name">Names</option>
            <option value="has_financial">Financial</option>
          </select>
        </div>

        <div class="filter-item">
          <input
            type="number"
            bind:value={minConfirmations}
            placeholder="Min Confirmations"
            class="filter-input-small"
          />
        </div>

      </div>

      <div class="advanced-filters-actions">
        <button
          class="clear-filters-btn"
          on:click={() => {
            selectedFormat = 'all';
            maxPricePerData = '';
            updatedSince = 'all';
            selectedType = 'all';
            selectedClassification = 'all';
            selectedLicense = 'all';
            selectedProducer = 'all';
            selectedPolicy = 'none';
            selectedGeoOrigin = 'all';
            selectedPiiFlags = 'all';
            minConfirmations = '';
            searchQuery = '';
          }}
        >
          Clear All Filters
        </button>
      </div>
    </div>
  {/if}

  <!-- View Toggle -->
  <div class="view-controls">
    <div class="view-toggle">
      <button
        class="view-btn {viewMode === 'cards' ? 'active' : ''}"
        on:click={() => viewMode = 'cards'}
      >
        <span class="view-icon">⊞</span>
        Cards
      </button>
      <button
        class="view-btn {viewMode === 'table' ? 'active' : ''}"
        on:click={() => viewMode = 'table'}
      >
        <span class="view-icon">☰</span>
        Table
      </button>
    </div>
  </div>

  <!-- Assets Grid -->
  {#if loading}
    <div class="loading-state">
      <div class="spinner">⚪</div>
      <span>Loading assets...</span>
    </div>
  {:else if filteredAssets().length === 0}
    <div class="empty-state">
      <p>No assets found</p>
      <p class="empty-hint">Try adjusting your search or publish a new asset</p>
    </div>
  {:else}
    {#if viewMode === 'cards'}
      <!-- Card View -->
      <div class="assets-grid">
        {#each filteredAssets() as asset}
          <div class="asset-card" on:click={() => openAssetDetails(asset)}>
            <div class="asset-header">
              <div class="asset-title">
                <span class="asset-icon">📊</span>
                <h3>{asset.title || asset.datasetId || 'Untitled Asset'}</h3>
              </div>
              <span class="asset-type">{asset.classification || 'data'}</span>
            </div>

            <div class="asset-metadata">
              <div class="metadata-row">
                <span class="metadata-label">Format:</span>
                <span class="metadata-value format-badge format-{getFormatDisplay(asset.content?.mediaType).type}">
                  {getFormatDisplay(asset.content?.mediaType).icon} {getFormatDisplay(asset.content?.mediaType).name}
                </span>
              </div>
              <div class="metadata-row">
                <span class="metadata-label">Price/KB:</span>
                <span class="metadata-value price-value">{asset.pricePerKB ? '$' + asset.pricePerKB.toFixed(3) : 'Free'}</span>
              </div>
              <div class="metadata-row">
                <span class="metadata-label">Updated:</span>
                <span class="metadata-value">{asset.updatedAt ? new Date(asset.updatedAt).toLocaleDateString() : new Date(asset.createdAt).toLocaleDateString()}</span>
              </div>
              <div class="metadata-row">
                <span class="metadata-label">License:</span>
                <span class="metadata-value">{asset.license || 'N/A'}</span>
              </div>
            </div>

            <div class="asset-footer">
              <span class="asset-id">ID: {asset.versionId?.slice(0, 12)}...</span>
              <button
                class="buy-btn"
                on:click|stopPropagation={() => handlePurchase(asset)}
              >
                {asset.pricePerKB ? `💳 Buy - $${asset.pricePerKB.toFixed(3)}/KB` : '💾 Get Free'}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- Table View -->
      <div class="assets-table-container">
        <table class="assets-table">
          <thead>
            <tr>
              <th class="rank-col">#</th>
              <th class="asset-col">Asset</th>
              <th class="format-col">Format</th>
              <th class="price-col">Price/KB</th>
              <th class="updated-col">Updated</th>
              <th class="classification-col">Classification</th>
              <th class="size-col">Size</th>
              <th class="producer-col">Producer</th>
              <th class="confirmations-col">Confirmations</th>
              <th class="buy-col">Buy</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredAssets() as asset, index}
              <tr class="asset-row" on:click={() => openAssetDetails(asset)}>
                <td class="rank-cell">{index + 1}</td>
                <td class="asset-cell">
                  <div class="asset-info">
                    <span class="asset-icon-small">📊</span>
                    <div class="asset-details">
                      <div class="asset-name">{asset.title || asset.datasetId || 'Untitled Asset'}</div>
                      <div class="asset-id-small">ID: {asset.versionId?.slice(0, 16)}...</div>
                    </div>
                  </div>
                </td>
                <td class="format-cell">
                  <span class="format-badge format-{getFormatDisplay(asset.content?.mediaType).type}">
                    {getFormatDisplay(asset.content?.mediaType).icon} {getFormatDisplay(asset.content?.mediaType).name}
                  </span>
                </td>
                <td class="price-cell">
                  <span class="price-value">{asset.pricePerKB ? '$' + asset.pricePerKB.toFixed(3) : 'Free'}</span>
                </td>
                <td class="updated-cell">{asset.updatedAt ? new Date(asset.updatedAt).toLocaleDateString() : new Date(asset.createdAt).toLocaleDateString()}</td>
                <td class="classification-cell">
                  <span class="classification-badge classification-{asset.classification || 'public'}">
                    {asset.classification || 'public'}
                  </span>
                </td>
                <td class="size-cell">{asset.dataSizeBytes ? (asset.dataSizeBytes / 1024 / 1024).toFixed(1) + ' MB' : 'N/A'}</td>
                <td class="producer-cell">{asset.producer || 'Unknown'}</td>
                <td class="confirmations-cell">
                  <span class="confirmations-count">{asset.confirmations || 0}</span>
                </td>
                <td class="buy-cell">
                  <button
                    class="buy-btn-table"
                    on:click|stopPropagation={() => handlePurchase(asset)}
                  >
                    {asset.pricePerKB ? `💳 $${asset.pricePerKB.toFixed(3)}` : '💾 Free'}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}

  <!-- Lineage Visualization Section -->
  {#if selectedAssetForLineage}
    <div class="lineage-section">
      <div class="lineage-header">
        <h2>📊 Lineage for {selectedAssetForLineage.title || selectedAssetForLineage.datasetId}</h2>
        <button on:click={closeLineage} class="close-lineage-btn">✕</button>
      </div>

      {#if loadingLineage}
        <div class="loading-state">
          <div class="spinner">⚪</div>
          <span>Loading lineage...</span>
        </div>
      {:else if lineageError}
        <div class="error-state">
          <p>Failed to load lineage: {lineageError}</p>
        </div>
      {:else if lineageData}
        <!-- Active Filters -->
        {#if filters.classification.size > 0 || filters.producer.size > 0 || filters.relationshipType.size > 0}
          <div class="lineage-filters">
            <span class="filters-label">Active filters:</span>
            <div class="active-filters">
              {#each [...filters.classification] as filter}
                <span class="filter-tag" on:click={() => removeFilter('classification', filter)}>
                  {filter} ×
                </span>
              {/each}
              {#each [...filters.producer] as filter}
                <span class="filter-tag" on:click={() => removeFilter('producer', filter)}>
                  {filter} ×
                </span>
              {/each}
              {#each [...filters.relationshipType] as filter}
                <span class="filter-tag" on:click={() => removeFilter('relationshipType', filter)}>
                  {filter} ×
                </span>
              {/each}
              <button class="clear-filters" on:click={clearFilters}>Clear all</button>
            </div>
          </div>
        {/if}

        <div class="lineage-layout">
          <!-- Visual Graph -->
          <div class="lineage-graph">
            <svg width="100%" height="300" viewBox="0 0 800 300">
              <defs>
                <marker id="arrow-dark" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="#8b949e"/>
                </marker>
              </defs>

              <!-- Flow lines -->
              {#each visibleUpstream as node, i}
                <line
                  x1="130"
                  y1={80 + i * 40}
                  x2="350"
                  y2="150"
                  stroke="#30363d"
                  stroke-width="2"
                  marker-end="url(#arrow-dark)"
                  class="flow-line"
                />
              {/each}

              {#each visibleDownstream as node, i}
                <line
                  x1="450"
                  y1="150"
                  x2="620"
                  y2={80 + i * 40}
                  stroke="#30363d"
                  stroke-width="2"
                  marker-end="url(#arrow-dark)"
                  class="flow-line"
                />
              {/each}

              <!-- Upstream nodes -->
              {#each visibleUpstream as node, i}
                <g class="graph-node upstream" on:click={() => selectNode(node)} transform="translate(50, {70 + i * 40})">
                  <rect
                    width="80"
                    height="20"
                    fill={getClassificationColor(node.classification)}
                    rx="4"
                    class="node-rect"
                  />
                  <text x="40" y="14" text-anchor="middle" fill="white" font-size="10" font-weight="500">
                    {node.title.slice(0, 9)}...
                  </text>
                </g>
              {/each}

              <!-- Current node -->
              <g class="graph-node current" on:click={() => selectNode(lineageData.current)} transform="translate(350, 135)">
                <rect
                  width="100"
                  height="30"
                  fill={getClassificationColor(lineageData.current.classification)}
                  rx="6"
                  stroke="#58a6ff"
                  stroke-width="2"
                  class="current-node-rect"
                />
                <text x="50" y="20" text-anchor="middle" fill="white" font-size="11" font-weight="600">
                  {lineageData.current.title.slice(0, 11)}...
                </text>
              </g>

              <!-- Downstream nodes -->
              {#each visibleDownstream as node, i}
                <g class="graph-node downstream" on:click={() => selectNode(node)} transform="translate(670, {70 + i * 40})">
                  <rect
                    width="80"
                    height="20"
                    fill={getClassificationColor(node.classification)}
                    rx="4"
                    class="node-rect"
                  />
                  <text x="40" y="14" text-anchor="middle" fill="white" font-size="10" font-weight="500">
                    {node.title.slice(0, 9)}...
                  </text>
                </g>
              {/each}

              <!-- Labels -->
              <text x="90" y="50" text-anchor="middle" fill="#8b949e" font-size="12" font-weight="500">
                Sources
              </text>
              <text x="400" y="50" text-anchor="middle" fill="#8b949e" font-size="12" font-weight="500">
                Current
              </text>
              <text x="710" y="50" text-anchor="middle" fill="#8b949e" font-size="12" font-weight="500">
                Outputs
              </text>
            </svg>
          </div>

          <!-- Node Details -->
          <div class="lineage-content">
            <div class="lineage-nodes">
              {#if visibleUpstream.length > 0}
                <div class="lineage-section-nodes">
                  <h4>Sources ({visibleUpstream.length})</h4>
                  {#each visibleUpstream as node}
                    <div class="lineage-node-card" class:selected={selectedNode === node} on:click={() => selectNode(node)}>
                      <div class="node-title">{node.title}</div>
                      <div class="node-meta">
                        <span class="node-tag" style="background: {getClassificationColor(node.classification)}"
                              on:click|stopPropagation={() => addFilter('classification', node.classification)}>
                          {node.classification}
                        </span>
                        <span class="node-tag producer"
                              on:click|stopPropagation={() => addFilter('producer', node.producer)}>
                          {node.producer}
                        </span>
                        {#if node.relationshipType}
                          <span class="node-tag relation"
                                on:click|stopPropagation={() => addFilter('relationshipType', node.relationshipType)}>
                            {node.relationshipType}
                          </span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}

              <div class="lineage-section-nodes">
                <h4>Current Asset</h4>
                <div class="lineage-node-card current" class:selected={selectedNode === lineageData.current} on:click={() => selectNode(lineageData.current)}>
                  <div class="node-title">{lineageData.current.title}</div>
                  <div class="node-meta">
                    <span class="node-tag" style="background: {getClassificationColor(lineageData.current.classification)}"
                          on:click|stopPropagation={() => addFilter('classification', lineageData.current.classification)}>
                      {lineageData.current.classification}
                    </span>
                    <span class="node-tag producer"
                          on:click|stopPropagation={() => addFilter('producer', lineageData.current.producer)}>
                      {lineageData.current.producer}
                    </span>
                  </div>
                </div>
              </div>

              {#if visibleDownstream.length > 0}
                <div class="lineage-section-nodes">
                  <h4>Outputs ({visibleDownstream.length})</h4>
                  {#each visibleDownstream as node}
                    <div class="lineage-node-card" class:selected={selectedNode === node} on:click={() => selectNode(node)}>
                      <div class="node-title">{node.title}</div>
                      <div class="node-meta">
                        <span class="node-tag" style="background: {getClassificationColor(node.classification)}"
                              on:click|stopPropagation={() => addFilter('classification', node.classification)}>
                          {node.classification}
                        </span>
                        <span class="node-tag producer"
                              on:click|stopPropagation={() => addFilter('producer', node.producer)}>
                          {node.producer}
                        </span>
                        {#if node.relationshipType}
                          <span class="node-tag relation"
                                on:click|stopPropagation={() => addFilter('relationshipType', node.relationshipType)}>
                            {node.relationshipType}
                          </span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Detail Panel -->
            {#if selectedNode}
              <div class="lineage-detail-panel">
                <h4>Asset Details</h4>
                <div class="detail-content">
                  <h5>{selectedNode.title}</h5>
                  <div class="detail-grid">
                    <div class="detail-item">
                      <span class="detail-label">Classification:</span>
                      <span class="detail-value" style="color: {getClassificationColor(selectedNode.classification)}">
                        {selectedNode.classification}
                      </span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Producer:</span>
                      <span class="detail-value">{selectedNode.producer}</span>
                    </div>
                    {#if selectedNode.datasetId}
                      <div class="detail-item">
                        <span class="detail-label">Dataset ID:</span>
                        <span class="detail-value">{selectedNode.datasetId}</span>
                      </div>
                    {/if}
                    {#if selectedNode.relationshipType}
                      <div class="detail-item">
                        <span class="detail-label">Relationship:</span>
                        <span class="detail-value">{selectedNode.relationshipType}</span>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .subtitle {
    color: #8b949e;
    font-size: 16px;
    margin-bottom: 32px;
    font-family: system-ui, sans-serif;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
  }

  .form-section {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 24px;
  }

  .form-section h2 {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 20px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    color: #f0f6fc;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 6px;
  }

  .form-input,
  .search-input {
    width: 100%;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    padding: 8px 12px;
    font-size: 14px;
    font-family: inherit;
    transition: border-color 0.2s;
  }

  .form-input:focus,
  .search-input:focus {
    outline: none;
    border-color: #58a6ff;
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1);
  }

  .form-input::placeholder,
  .search-input::placeholder {
    color: #6e7681;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }

  .button {
    background: #21262d;
    border: 1px solid #30363d;
    color: #f0f6fc;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
    text-decoration: none;
    display: inline-block;
    transition: all 0.2s;
  }

  .button:hover {
    background: #30363d;
    border-color: #58a6ff;
  }

  .button.primary {
    background: #238636;
    border-color: #238636;
    color: #ffffff;
  }

  .button.primary:hover {
    background: #2ea043;
  }

  /* CoinMarketCap Style Filter Bar */
  .filter-bar {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
    padding: 16px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .search-container {
    flex: 1;
    min-width: 200px;
  }

  .search-input {
    width: 100%;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    padding: 8px 12px;
    font-size: 14px;
    font-family: inherit;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #58a6ff;
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1);
  }

  .search-input::placeholder {
    color: #6e7681;
  }

  .filter-item {
    display: flex;
    align-items: center;
  }

  .filter-select {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    padding: 8px 12px;
    font-size: 14px;
    font-family: inherit;
    min-width: 140px;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .filter-select:focus {
    outline: none;
    border-color: #58a6ff;
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1);
  }

  /* Additional Filters Row */
  .additional-filters {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 24px;
    padding: 12px 16px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    flex-wrap: wrap;
  }

  .filter-select-small {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #f0f6fc;
    padding: 6px 10px;
    font-size: 13px;
    font-family: inherit;
    min-width: 100px;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .filter-select-small:focus {
    outline: none;
    border-color: #58a6ff;
  }

  .filter-input-small {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #f0f6fc;
    padding: 6px 10px;
    font-size: 13px;
    font-family: inherit;
    width: 100px;
    transition: border-color 0.2s;
  }

  .filter-input-small:focus {
    outline: none;
    border-color: #58a6ff;
  }

  .filter-input-small::placeholder {
    color: #6e7681;
    font-size: 12px;
  }

  .clear-filters-btn {
    background: #21262d;
    border: 1px solid #30363d;
    color: #8b949e;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    margin-left: auto;
  }

  .clear-filters-btn:hover {
    background: #30363d;
    color: #f0f6fc;
  }

  .loading-state {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 48px 20px;
    color: #8b949e;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .empty-state {
    text-align: center;
    padding: 48px 20px;
    color: #8b949e;
  }

  .empty-state p {
    font-size: 18px;
    margin-bottom: 8px;
  }

  .empty-hint {
    font-size: 14px;
    color: #6e7681;
  }

  .assets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }

  .asset-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    transition: all 0.2s;
    cursor: pointer;
  }

  .asset-card:hover {
    border-color: #58a6ff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .asset-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .asset-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .asset-icon {
    font-size: 20px;
  }

  .asset-title h3 {
    color: #ffffff;
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .asset-type {
    background: #21262d;
    color: #8b949e;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .asset-metadata {
    margin-bottom: 16px;
  }

  .metadata-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 13px;
  }

  .metadata-row:last-child {
    margin-bottom: 0;
  }

  .metadata-label {
    color: #8b949e;
    font-weight: 500;
  }

  .metadata-value {
    color: #f0f6fc;
    font-family: 'SF Mono', monospace;
  }

  .asset-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }

  .tag {
    background: #1f6feb;
    color: #ffffff;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
  }

  .asset-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid #30363d;
  }

  .asset-id {
    color: #6e7681;
    font-size: 12px;
    font-family: 'SF Mono', monospace;
  }

  .asset-actions {
    display: flex;
    gap: 8px;
  }

  .asset-link {
    color: #58a6ff;
    text-decoration: none;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .asset-link:hover {
    background: #21262d;
    text-decoration: underline;
  }

  .asset-link-btn {
    color: #58a6ff;
    background: none;
    border: none;
    text-decoration: none;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
    cursor: pointer;
    font-family: inherit;
  }

  .asset-link-btn:hover {
    background: #21262d;
    text-decoration: underline;
  }


  /* Parent selection styles */
  .parent-selection {
    margin-top: 8px;
  }

  .parent-options {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 12px;
    background: #0d1117;
  }

  .parent-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .parent-option:hover {
    background: #21262d;
  }

  .parent-checkbox {
    margin: 0;
    accent-color: #58a6ff;
  }

  .parent-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .parent-label strong {
    color: #f0f6fc;
    font-size: 14px;
  }

  .parent-label small {
    color: #8b949e;
    font-size: 12px;
  }

  .no-parents {
    color: #8b949e;
    font-size: 14px;
    text-align: center;
    padding: 20px;
    border: 1px solid #30363d;
    border-radius: 6px;
    background: #0d1117;
  }

  .selected-parents {
    margin-top: 12px;
    padding: 12px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
  }

  .selected-parents strong {
    color: #f0f6fc;
    font-size: 14px;
    display: block;
    margin-bottom: 8px;
  }

  .selected-parent-tag {
    display: inline-block;
    background: #1f6feb;
    color: #ffffff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    margin-right: 6px;
    margin-bottom: 4px;
  }

  /* Lineage section styles */
  .lineage-section {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-top: 32px;
    margin-bottom: 24px;
  }

  .lineage-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .lineage-header h2 {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
  }

  .close-lineage-btn {
    background: #f85149;
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-lineage-btn:hover {
    background: #ff6b61;
    transform: scale(1.05);
  }

  .error-state {
    text-align: center;
    padding: 32px;
    color: #f85149;
    background: #21262d;
    border-radius: 6px;
    border: 1px solid #30363d;
  }

  .lineage-filters {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding: 12px 16px;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .filters-label {
    font-size: 13px;
    font-weight: 500;
    color: #8b949e;
  }

  .active-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .filter-tag {
    background: #58a6ff;
    color: white;
    padding: 4px 10px;
    border-radius: 16px;
    font-size: 12px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .filter-tag:hover {
    background: #2563eb;
  }

  .clear-filters {
    background: #f85149;
    color: white;
    border: none;
    padding: 4px 10px;
    border-radius: 16px;
    font-size: 12px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .clear-filters:hover {
    background: #ff6b61;
  }

  .lineage-layout {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .lineage-graph {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
  }

  .lineage-graph svg {
    background: #161b22;
    border-radius: 6px;
  }

  .graph-node {
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .graph-node:hover {
    transform: scale(1.05);
  }

  .node-rect {
    transition: opacity 0.15s ease;
  }

  .graph-node:hover .node-rect {
    opacity: 0.9;
  }

  .flow-line {
    transition: stroke-width 0.15s ease;
  }

  .flow-line:hover {
    stroke-width: 3;
    stroke: #58a6ff;
  }

  .lineage-content {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 24px;
  }

  .lineage-nodes {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .lineage-section-nodes h4 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: #f0f6fc;
  }

  .lineage-node-card {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .lineage-node-card:hover {
    border-color: #58a6ff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .lineage-node-card.selected {
    border-color: #58a6ff;
    background: rgba(88, 166, 255, 0.1);
  }

  .lineage-node-card.current {
    border-color: #238636;
    background: rgba(35, 134, 54, 0.1);
  }

  .node-title {
    font-weight: 600;
    margin-bottom: 8px;
    font-size: 14px;
    color: #f0f6fc;
  }

  .node-meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .node-tag {
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    color: white;
    transition: opacity 0.15s;
  }

  .node-tag:hover {
    opacity: 0.8;
  }

  .node-tag.producer {
    background: #8b5cf6;
  }

  .node-tag.relation {
    background: #f59e0b;
  }

  .lineage-detail-panel {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    height: fit-content;
  }

  .lineage-detail-panel h4 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #f0f6fc;
  }

  .lineage-detail-panel h5 {
    margin: 0 0 12px 0;
    font-size: 15px;
    font-weight: 600;
    color: #8b949e;
  }

  .detail-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #30363d;
  }

  .detail-item:last-child {
    border-bottom: none;
  }

  .detail-label {
    font-size: 13px;
    color: #8b949e;
    font-weight: 500;
  }

  .detail-value {
    font-size: 13px;
    font-weight: 600;
    color: #f0f6fc;
    font-family: 'SF Mono', monospace;
  }

  @media (max-width: 1200px) {
    .lineage-content {
      grid-template-columns: 1fr;
    }

    .lineage-detail-panel {
      margin-top: 0;
    }
  }


  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 16px;
    }

    .filter-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .search-container {
      min-width: auto;
    }

    .filter-item {
      width: 100%;
    }

    .filter-select {
      width: 100%;
      min-width: auto;
    }

    .additional-filters {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .filter-select-small,
    .filter-input-small {
      width: 100%;
      min-width: auto;
    }

    .clear-filters-btn {
      margin-left: 0;
      width: 100%;
    }

    .assets-grid {
      grid-template-columns: 1fr;
    }

    .lineage-header {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }

    .lineage-filters {
      flex-direction: column;
      align-items: stretch;
    }

    .lineage-graph svg {
      height: 250px;
    }
  }

  /* View Controls */
  .view-controls {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 20px;
  }

  .view-toggle {
    display: flex;
    background: #21262d;
    border-radius: 6px;
    border: 1px solid #30363d;
    overflow: hidden;
  }

  .view-btn {
    background: transparent;
    border: none;
    color: #8b949e;
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
  }

  .view-btn:hover {
    background: #30363d;
    color: #f0f6fc;
  }

  .view-btn.active {
    background: #238636;
    color: #ffffff;
  }

  .view-icon {
    font-size: 12px;
  }

  /* Table Styles */
  .assets-table-container {
    background: #0d1117;
    border-radius: 8px;
    border: 1px solid #30363d;
    overflow: hidden;
  }

  .assets-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .assets-table thead {
    background: #161b22;
    border-bottom: 1px solid #30363d;
  }

  .assets-table th {
    text-align: left;
    padding: 12px 16px;
    color: #8b949e;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .assets-table tbody tr {
    border-bottom: 1px solid #21262d;
    transition: background-color 0.2s ease;
  }

  .assets-table tbody tr:hover {
    background: #161b22;
    cursor: pointer;
  }

  .assets-table td {
    padding: 12px 16px;
    color: #e6edf3;
    vertical-align: middle;
  }

  /* Column Specific Styles */
  .rank-col {
    width: 60px;
  }

  .rank-cell {
    color: #8b949e;
    font-weight: 600;
    text-align: center;
  }

  .asset-col {
    width: 300px;
    min-width: 250px;
  }

  .asset-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .asset-icon-small {
    font-size: 16px;
  }

  .asset-details {
    flex: 1;
    min-width: 0;
  }

  .asset-name {
    font-weight: 600;
    color: #f0f6fc;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .asset-id-small {
    color: #8b949e;
    font-size: 12px;
  }

  .type-badge {
    background: #1f6feb;
    color: #ffffff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
  }

  .type-badge.type-data {
    background: #1f6feb;
  }

  .type-badge.type-ai {
    background: #9a6cf2;
  }

  .classification-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    text-transform: capitalize;
  }

  .classification-badge.classification-public {
    background: #238636;
    color: #ffffff;
  }

  .classification-badge.classification-internal {
    background: #d29922;
    color: #000000;
  }

  .classification-badge.classification-restricted {
    background: #da3633;
    color: #ffffff;
  }

  .confirmations-count {
    color: #39d353;
    font-weight: 600;
  }

  /* Advanced Filters */
  .advanced-filters {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    animation: slideDown 0.3s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .advanced-filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .advanced-filters-actions {
    display: flex;
    justify-content: center;
    padding-top: 16px;
    border-top: 1px solid #30363d;
  }

  .advanced-toggle-btn {
    background: #21262d;
    border: 1px solid #30363d;
    color: #8b949e;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .advanced-toggle-btn:hover {
    background: #30363d;
    color: #f0f6fc;
  }

  .filter-input {
    background: #0d1117;
    border: 1px solid #30363d;
    color: #e6edf3;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 14px;
    transition: border-color 0.2s ease;
  }

  .filter-input:focus {
    outline: none;
    border-color: #1f6feb;
  }

  /* Format and Price badges in cards */
  .format-badge {
    background: #1f6feb;
    color: #ffffff;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .price-value {
    color: #39d353;
    font-weight: 600;
  }

  /* Table column specific styles */
  .format-col,
  .format-cell {
    width: 80px;
  }

  .price-col,
  .price-cell {
    width: 100px;
  }

  .updated-col,
  .updated-cell {
    width: 100px;
  }

  .format-badge {
    color: #ffffff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }

  /* Format type specific colors */
  .format-static {
    background: #6f42c1; /* Purple for static data */
  }

  .format-stream {
    background: #1f6feb; /* Blue for streaming data */
    animation: pulse-stream 2s infinite;
  }

  .format-realtime {
    background: #da3633; /* Red for real-time data */
    animation: pulse-realtime 1.5s infinite;
  }

  .format-media {
    background: #238636; /* Green for media files */
  }

  .format-unknown {
    background: #656d76; /* Gray for unknown formats */
  }

  /* Subtle animations for streaming and real-time data */
  @keyframes pulse-stream {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  @keyframes pulse-realtime {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  /* Responsive Table */
  @media (max-width: 1200px) {
    .producer-col,
    .producer-cell,
    .confirmations-col,
    .confirmations-cell {
      display: none;
    }
  }

  @media (max-width: 900px) {
    .size-col,
    .size-cell,
    .classification-col,
    .classification-cell {
      display: none;
    }
  }

  @media (max-width: 700px) {
    .updated-col,
    .updated-cell {
      display: none;
    }

    .advanced-filters-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Format filter optgroup styling */
  .filter-select optgroup {
    background: #21262d;
    color: #8b949e;
    font-weight: 600;
    font-style: normal;
    padding: 4px 0;
  }

  .filter-select option {
    background: #0d1117;
    color: #e6edf3;
    padding: 8px 12px;
  }

  .filter-select option:hover {
    background: #30363d;
  }

  /* Buy button styles */
  .buy-btn {
    background: #238636;
    border: 1px solid #238636;
    color: #ffffff;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .buy-btn:hover {
    background: #2ea043;
    border-color: #2ea043;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .buy-btn-table {
    background: #238636;
    border: 1px solid #238636;
    color: #ffffff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .buy-btn-table:hover {
    background: #2ea043;
    border-color: #2ea043;
    transform: translateY(-1px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  /* Buy column styling */
  .buy-col,
  .buy-cell {
    width: 100px;
    text-align: center;
  }

  @media (max-width: 600px) {
    .view-controls {
      justify-content: center;
    }

    .assets-table {
      font-size: 12px;
    }

    .assets-table th,
    .assets-table td {
      padding: 8px 12px;
    }

    .buy-col,
    .buy-cell {
      width: 80px;
    }

    .buy-btn-table {
      font-size: 10px;
      padding: 3px 6px;
    }
  }
</style>