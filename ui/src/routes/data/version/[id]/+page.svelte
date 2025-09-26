<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let versionId = '';
  let dataset = null;
  let lineage = [];
  let policyJson = '';
  let policyResult = null;
  let loading = false;
  let expandedNodes = new Set();
  let hoveredNode = null;

  $: versionId = $page.params.id;

  // Mock data fallback - matches the data from the main page
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
    }
  ];

  function getMockDataById(id) {
    return mockServices.find(service => service.id === id);
  }

  onMount(() => {
    if (versionId) {
      loadDataset();
    }
  });

  async function loadDataset() {
    loading = true;
    try {
      let dataset_loaded = false;

      // First try to load from listings API (manifests)
      try {
        const datasetResponse = await fetch(`/listings/${encodeURIComponent(versionId)}`);
        if (datasetResponse.ok) {
          const datasetResult = await datasetResponse.json();

          // Map the database result to our expected format
          dataset = {
            versionId: datasetResult.versionId,
            type: datasetResult.manifest?.name || 'Dataset',
            producer: datasetResult.manifest?.datasetId || 'Unknown',
            createdAt: datasetResult.manifest?.createdAt || new Date().toISOString(),
            license: datasetResult.manifest?.license || 'See manifest',
            contentHash: datasetResult.manifest?.contentHash || 'Unknown',
            price: 'Variable',
            size: 'Unknown'
          };
          dataset_loaded = true;
        }
      } catch (e) {
        console.warn('Listings API failed:', e);
      }

      // If not found in listings, try models API
      if (!dataset_loaded) {
        try {
          const modelResponse = await fetch(`/api/models/${encodeURIComponent(versionId)}`);
          if (modelResponse.ok) {
            const modelResult = await modelResponse.json();

            dataset = {
              versionId: modelResult.modelVersionId,
              type: `${modelResult.framework} Model`,
              producer: 'Model Registry',
              createdAt: new Date(modelResult.createdAt * 1000).toISOString(),
              license: 'See model details',
              contentHash: modelResult.modelHash,
              price: 'Variable',
              size: modelResult.sizeBytes ? `${(modelResult.sizeBytes / 1024 / 1024).toFixed(1)} MB` : 'Unknown'
            };
            dataset_loaded = true;
          }
        } catch (e) {
          console.warn('Models API failed:', e);
        }
      }

      // If not found in any API, try mock data fallback
      if (!dataset_loaded) {
        const mockData = getMockDataById(versionId);
        if (mockData) {
          dataset = {
            versionId: mockData.id,
            type: mockData.name,
            producer: mockData.producer,
            createdAt: new Date(mockData.updatedAt).toISOString(),
            license: mockData.classification === 'public' ? 'Public Domain' :
                     mockData.classification === 'premium' ? 'Premium License' :
                     'Restricted License',
            contentHash: `hash_${mockData.id}`,
            price: `${mockData.pricePerKB} sats/KB`,
            size: mockData.size
          };
          dataset_loaded = true;
        }
      }

      if (!dataset_loaded) {
        throw new Error('Dataset not found in any registry');
      }

      // Load lineage data - try multiple sources
      let lineage_loaded = false;

      // First try models lineage API (if this looks like a model ID)
      if (versionId.startsWith('md_')) {
        try {
          const modelLineageResponse = await fetch(`/api/models/${encodeURIComponent(versionId)}/lineage`);
          if (modelLineageResponse.ok) {
            const modelLineageResult = await modelLineageResponse.json();
            if (Array.isArray(modelLineageResult) && modelLineageResult.length > 0) {
              lineage = modelLineageResult.map((item, index) => ({
                versionId: item.versionId,
                license: 'See details',
                producer: 'System',
                current: item.versionId === versionId,
                createdAt: item.createdAt || new Date().toISOString(),
                size: 'Unknown',
                type: item.type || 'Unknown',
                dependencies: [],
                isRoot: index === modelLineageResult.length - 1
              }));
              lineage_loaded = true;
            }
          }
        } catch (e) {
          console.warn('Model lineage API failed:', e);
        }
      }

      // If no model lineage, try bundle API
      if (!lineage_loaded) {
        try {
          const lineageResponse = await fetch(`/bundle?versionId=${encodeURIComponent(versionId)}`);
          if (lineageResponse.ok) {
            const lineageResult = await lineageResponse.json();
            lineage = buildLineageFromBundle(lineageResult, versionId);
            lineage_loaded = true;
          }
        } catch (e) {
          console.warn('Bundle API failed:', e);
        }
      }

      // Fallback: single item lineage
      if (!lineage_loaded) {
        lineage = [{
          versionId: versionId,
          license: dataset.license,
          producer: dataset.producer,
          current: true,
          createdAt: dataset.createdAt,
          size: dataset.size,
          type: dataset.type,
          dependencies: [],
          isRoot: true
        }];
      }

      // Initialize all nodes as expanded
      expandedNodes = new Set(lineage.map(item => item.versionId));
    } catch (error) {
      console.error('Failed to load dataset:', error);
      dataset = null;
      lineage = [];
    } finally {
      loading = false;
    }
  }

  function buildLineageFromBundle(bundleData, currentVersionId) {
    // If bundle has lineage information, use it
    if (bundleData.lineage && Array.isArray(bundleData.lineage)) {
      return bundleData.lineage.map((item, index) => ({
        versionId: item.versionId || item.id || `unknown-${index}`,
        license: item.license || 'Unknown',
        producer: item.producer || 'Unknown',
        current: item.versionId === currentVersionId,
        createdAt: item.createdAt || new Date().toISOString(),
        size: item.size || 'Unknown',
        type: item.type || 'Unknown',
        dependencies: item.dependencies || [],
        isRoot: index === bundleData.lineage.length - 1
      }));
    } else {
      // Fallback: single item lineage
      return [{
        versionId: currentVersionId,
        license: 'Unknown',
        producer: 'Unknown',
        current: true,
        createdAt: new Date().toISOString(),
        size: 'Unknown',
        type: 'Unknown',
        dependencies: [],
        isRoot: true
      }];
    }
  }

  async function runPolicyCheck() {
    if (!policyJson.trim()) return;

    try {
      policyResult = { loading: true };

      // Parse the policy to validate JSON
      const policy = JSON.parse(policyJson);

      // Call the real ready API
      const response = await fetch(`/ready?versionId=${encodeURIComponent(versionId)}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      policyResult = {
        ready: result.ready || false,
        reason: result.reason || result.message || 'No reason provided',
        policy,
        details: result
      };
    } catch (error) {
      policyResult = {
        ready: false,
        reason: error.message.includes('JSON') ? 'Invalid JSON policy' : `Policy check failed: ${error.message}`,
        error: error.message
      };
    }
  }

  function downloadManifest() {
    const manifest = {
      versionId: dataset.versionId,
      metadata: dataset,
      lineage: lineage
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataset.versionId}-manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
  }

  function toggleNodeExpansion(nodeId) {
    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId);
    } else {
      expandedNodes.add(nodeId);
    }
    expandedNodes = expandedNodes; // Trigger reactivity
  }

  function navigateToNode(nodeId) {
    if (nodeId !== versionId) {
      goto(`/explorer/version/${encodeURIComponent(nodeId)}`);
    }
  }

  function setHoveredNode(nodeId) {
    hoveredNode = nodeId;
  }

  function clearHoveredNode() {
    hoveredNode = null;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
  }
</script>

{#if loading}
  <div class="detail">
    <div>Loading...</div>
  </div>
{:else if dataset}
  <div class="detail">
    <button class="back-btn" on:click={() => goto('/')}>
      ← Back to Home
    </button>
    <h1>{dataset.versionId}</h1>

    <div class="metadata">
      <h2>Metadata</h2>
      <dl>
        <dt>Producer</dt>
        <dd>{dataset.producer}</dd>

        <dt>Created</dt>
        <dd>{formatDate(dataset.createdAt)}</dd>

        <dt>Content Hash</dt>
        <dd>{dataset.contentHash}</dd>

        <dt>License</dt>
        <dd>{dataset.license}</dd>

        <dt>Price</dt>
        <dd>{dataset.price}</dd>

        <dt>Size</dt>
        <dd>{dataset.size}</dd>
      </dl>
    </div>

    <div class="lineage">
      <h2>Data Lineage
        <button class="lineage-controls" on:click={() => expandedNodes = new Set(lineage.map(item => item.versionId))}>
          Expand All
        </button>
        <button class="lineage-controls" on:click={() => expandedNodes = new Set()}>
          Collapse All
        </button>
      </h2>

      {#each lineage as item, index}
        <div
          class="lineage-item"
          class:current={item.current}
          class:hovered={hoveredNode === item.versionId}
          on:mouseenter={() => setHoveredNode(item.versionId)}
          on:mouseleave={clearHoveredNode}
        >
          <div class="lineage-node">
            {#if index === 0}
              <span class="tree-icon">◉</span>
            {:else if item.isRoot}
              <span class="tree-connector">└──</span> <span class="tree-icon">◉</span>
            {:else}
              <span class="tree-connector">└─┬</span> <span class="tree-icon">◉</span>
            {/if}

            <button
              class="version-link"
              class:clickable={!item.current}
              on:click={() => navigateToNode(item.versionId)}
              title={item.current ? 'Current version' : 'Click to navigate'}
            >
              {item.versionId}
            </button>

            {#if item.current}
              <span class="current-badge">(this)</span>
            {:else if item.isRoot}
              <span class="root-badge">(root)</span>
            {/if}

            <button
              class="expand-toggle"
              on:click={() => toggleNodeExpansion(item.versionId)}
              aria-label="Toggle details"
            >
              {expandedNodes.has(item.versionId) ? '▼' : '▶'}
            </button>

            <button
              class="copy-btn"
              on:click={() => copyToClipboard(item.versionId)}
              title="Copy version ID"
            >
              📋
            </button>
          </div>

          {#if expandedNodes.has(item.versionId)}
            <div class="lineage-details">
              <div class="lineage-meta">
                <strong>Type:</strong> {item.type}
              </div>
              <div class="lineage-meta">
                <strong>License:</strong> {item.license}
              </div>
              <div class="lineage-meta">
                <strong>Producer:</strong> {item.producer}
              </div>
              <div class="lineage-meta">
                <strong>Created:</strong> {formatDate(item.createdAt)}
              </div>
              <div class="lineage-meta">
                <strong>Size:</strong> {item.size}
              </div>
              {#if item.dependencies && item.dependencies.length > 0}
                <div class="lineage-meta">
                  <strong>Dependencies:</strong> {item.dependencies.join(', ')}
                </div>
              {/if}
            </div>
          {/if}

          {#if !item.isRoot && index < lineage.length - 1}
            <div class="tree-connector-line">│</div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="policy-check">
      <h2>Policy Check</h2>
      <textarea
        bind:value={policyJson}
        placeholder="Policy JSON: requireLicense, maxPrice, etc."
      ></textarea>
      <button on:click={runPolicyCheck} disabled={!policyJson.trim()}>
        Run /ready Check
      </button>

      {#if policyResult}
        {#if policyResult.loading}
          <div>Checking policy...</div>
        {:else}
          <div class="ready-status" class:ready={policyResult.ready} class:not-ready={!policyResult.ready}>
            {policyResult.ready ? 'Ready' : 'Not Ready'}
          </div>
          <div>{policyResult.reason}</div>
        {/if}
      {/if}
    </div>

    <div class="actions">
      <button class="primary" on:click={downloadManifest}>
        Download Manifest (JSON)
      </button>
      <button disabled={!dataset.price}>
        Download Data (if paid)
      </button>
    </div>
  </div>
{:else}
  <div class="detail">
    <h1>Dataset not found</h1>
    <p>The dataset with ID "{versionId}" could not be found.</p>
  </div>
{/if}

<style>
  .back-btn {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #8b949e;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .back-btn:hover {
    background: #30363d;
    border-color: #58a6ff;
    color: #f0f6fc;
  }
</style>