<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let searchId = '';
  let loading = false;
  let dataset = null;
  let lineageTree = null;
  let error = null;
  let expandedNodes = new Set();

  // Mock relationship types
  const relationshipTypes = {
    'derived': { label: 'Derived', description: 'New insights from existing data', color: '#58a6ff' },
    'processed': { label: 'Processed', description: 'Cleaned and transformed', color: '#56d364' },
    'enriched': { label: 'Enriched', description: 'Enhanced with additional data', color: '#f78166' },
    'filtered': { label: 'Filtered', description: 'Subset or filtered data', color: '#e3b341' },
    'aggregated': { label: 'Aggregated', description: 'Summarized or grouped', color: '#bc8cff' }
  };

  // Mock data for demonstration
  const mockDatasets = {
    'service_1': {
      id: 'service_1',
      name: 'AI Training Dataset',
      type: 'Machine Learning',
      classification: 'public',
      size: '2.5 GB',
      producer: 'DataCorp Inc',
      created: '2024-01-15T10:30:00Z',
      hash: 'hash_ai_training_001',
      lineage: [
        {
          id: 'raw_data_001',
          name: 'Raw Sensor Data',
          relationship: 'processed',
          level: 0,
          created: '2024-01-10T08:00:00Z',
          producer: 'SensorNet Inc'
        },
        {
          id: 'service_1',
          name: 'AI Training Dataset',
          relationship: 'current',
          level: 1,
          created: '2024-01-15T10:30:00Z',
          producer: 'DataCorp Inc'
        },
        {
          id: 'model_v1',
          name: 'Trained Neural Network',
          relationship: 'derived',
          level: 2,
          created: '2024-01-20T14:15:00Z',
          producer: 'ML Research Lab'
        }
      ]
    },
    'service_2': {
      id: 'service_2',
      name: 'Real-time Market Feed',
      type: 'Financial Data',
      classification: 'premium',
      size: 'Live Stream',
      producer: 'MarketStream',
      created: '2024-01-15T09:00:00Z',
      hash: 'hash_market_feed_002',
      lineage: [
        {
          id: 'exchange_data',
          name: 'Raw Exchange Data',
          relationship: 'aggregated',
          level: 0,
          created: '2024-01-15T08:30:00Z',
          producer: 'Exchange APIs'
        },
        {
          id: 'service_2',
          name: 'Real-time Market Feed',
          relationship: 'current',
          level: 1,
          created: '2024-01-15T09:00:00Z',
          producer: 'MarketStream'
        },
        {
          id: 'analytics_feed',
          name: 'Market Analytics',
          relationship: 'enriched',
          level: 2,
          created: '2024-01-15T10:45:00Z',
          producer: 'Analytics Corp'
        },
        {
          id: 'filtered_feed',
          name: 'High-Volume Stocks',
          relationship: 'filtered',
          level: 2,
          created: '2024-01-15T11:20:00Z',
          producer: 'Trading Firm'
        }
      ]
    },
    'genomic_001': {
      id: 'genomic_001',
      name: 'Population Genomic Variants',
      type: 'Genomic Data',
      classification: 'restricted',
      size: '15.2 GB',
      producer: 'Research Institute',
      created: '2024-01-12T16:45:00Z',
      hash: 'hash_genomic_variants_001',
      lineage: [
        {
          id: 'raw_sequences',
          name: 'Raw DNA Sequences',
          relationship: 'processed',
          level: 0,
          created: '2024-01-05T12:00:00Z',
          producer: 'Sequencing Lab'
        },
        {
          id: 'aligned_reads',
          name: 'Aligned Sequence Reads',
          relationship: 'processed',
          level: 1,
          created: '2024-01-08T15:30:00Z',
          producer: 'Bioinformatics Team'
        },
        {
          id: 'genomic_001',
          name: 'Population Genomic Variants',
          relationship: 'current',
          level: 2,
          created: '2024-01-12T16:45:00Z',
          producer: 'Research Institute'
        },
        {
          id: 'disease_variants',
          name: 'Disease-Associated Variants',
          relationship: 'filtered',
          level: 3,
          created: '2024-01-16T11:15:00Z',
          producer: 'Medical Research'
        },
        {
          id: 'population_stats',
          name: 'Population Statistics',
          relationship: 'aggregated',
          level: 3,
          created: '2024-01-18T09:30:00Z',
          producer: 'Stats Division'
        }
      ]
    }
  };

  function searchDataset() {
    if (!searchId.trim()) return;

    loading = true;
    error = null;
    dataset = null;
    lineageTree = null;

    // Simulate API delay
    setTimeout(() => {
      const found = mockDatasets[searchId.trim()];
      if (found) {
        dataset = found;
        lineageTree = buildLineageTree(found.lineage);
        expandedNodes = new Set(found.lineage.map(item => item.id));
      } else {
        error = `Dataset "${searchId}" not found`;
      }
      loading = false;
    }, 300);
  }

  function buildLineageTree(lineage) {
    const tree = {};
    const levels = {};

    // Group by level
    lineage.forEach(item => {
      if (!levels[item.level]) levels[item.level] = [];
      levels[item.level].push(item);
    });

    return levels;
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
  }

  function getRelationshipInfo(type) {
    return relationshipTypes[type] || { label: type, description: type, color: '#8b949e' };
  }

  function toggleNode(nodeId) {
    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId);
    } else {
      expandedNodes.add(nodeId);
    }
    expandedNodes = expandedNodes;
  }

  function navigateToDataset(id) {
    goto(`/data/version/${encodeURIComponent(id)}`);
  }

  function handleKeyPress(event) {
    if (event.key === 'Enter') {
      searchDataset();
    }
  }

  onMount(() => {
    // Auto-search if there's a query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get('id');
    if (queryId) {
      searchId = queryId;
      searchDataset();
    }
  });
</script>

<div class="explorer-page">
  <button class="back-btn" on:click={() => goto('/')}>
    ← Back to Home
  </button>

  <div class="hero-section">
    <h1>Data Explorer</h1>
    <p class="hero-description">
      Search datasets and explore their complete lineage and relationships.
    </p>
  </div>

  <div class="search-section">
    <div class="search-bar">
      <input
        type="text"
        bind:value={searchId}
        placeholder="Enter dataset ID (e.g., service_1, genomic_001)"
        on:keypress={handleKeyPress}
        class="search-input"
      />
      <button on:click={searchDataset} disabled={loading} class="search-btn">
        {loading ? 'Searching...' : 'Search'}
      </button>
    </div>

    <div class="examples">
      <span>Examples:</span>
      <button class="example-link" on:click={() => { searchId = 'service_1'; searchDataset(); }}>service_1</button>
      <button class="example-link" on:click={() => { searchId = 'genomic_001'; searchDataset(); }}>genomic_001</button>
      <button class="example-link" on:click={() => { searchId = 'service_2'; searchDataset(); }}>service_2</button>
    </div>
  </div>

  {#if error}
    <div class="error-message">
      {error}
    </div>
  {/if}

  {#if dataset}
    <div class="dataset-info">
      <h2>{dataset.name}</h2>
      <div class="info-grid">
        <div class="info-item">
          <strong>ID:</strong> {dataset.id}
        </div>
        <div class="info-item">
          <strong>Type:</strong> {dataset.type}
        </div>
        <div class="info-item">
          <strong>Size:</strong> {dataset.size}
        </div>
        <div class="info-item">
          <strong>Producer:</strong> {dataset.producer}
        </div>
        <div class="info-item">
          <strong>Classification:</strong>
          <span class="classification classification-{dataset.classification}">
            {dataset.classification}
          </span>
        </div>
        <div class="info-item">
          <strong>Created:</strong> {formatDate(dataset.created)}
        </div>
        <div class="info-item">
          <strong>Hash:</strong> <code>{dataset.hash}</code>
        </div>
      </div>
    </div>

    <div class="lineage-section">
      <h2>Lineage Tree</h2>
      <div class="legend">
        {#each Object.entries(relationshipTypes) as [key, info]}
          <div class="legend-item">
            <span class="legend-color" style="background-color: {info.color}"></span>
            <span class="legend-label">{info.label}</span>
            <span class="legend-desc">{info.description}</span>
          </div>
        {/each}
      </div>

      {#if lineageTree}
        <div class="lineage-tree">
          {#each Object.entries(lineageTree) as [level, nodes]}
            <div class="lineage-level">
              <div class="level-header">Level {level}</div>
              {#each nodes as node}
                <div class="lineage-node" class:current={node.relationship === 'current'}>
                  <div class="node-header">
                    <button
                      class="node-toggle"
                      on:click={() => toggleNode(node.id)}
                    >
                      {expandedNodes.has(node.id) ? '▼' : '▶'}
                    </button>

                    <div
                      class="relationship-badge"
                      style="background-color: {getRelationshipInfo(node.relationship).color}"
                      title={getRelationshipInfo(node.relationship).description}
                    >
                      {getRelationshipInfo(node.relationship).label}
                    </div>

                    <button
                      class="node-title"
                      on:click={() => navigateToDataset(node.id)}
                      title="Click to view details"
                    >
                      {node.name}
                    </button>

                    {#if node.relationship === 'current'}
                      <span class="current-badge">CURRENT</span>
                    {/if}
                  </div>

                  {#if expandedNodes.has(node.id)}
                    <div class="node-details">
                      <div><strong>ID:</strong> {node.id}</div>
                      <div><strong>Producer:</strong> {node.producer}</div>
                      <div><strong>Created:</strong> {formatDate(node.created)}</div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .explorer-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    color: #e6edf3;
  }

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
    margin-bottom: 2rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .back-btn:hover {
    background: #30363d;
    border-color: #58a6ff;
    color: #f0f6fc;
  }

  .hero-section {
    text-align: center;
    margin-bottom: 3rem;
  }

  .hero-section h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #f0f6fc;
    margin-bottom: 1rem;
  }

  .hero-description {
    font-size: 1.1rem;
    color: #8b949e;
    max-width: 600px;
    margin: 0 auto;
  }

  .search-section {
    margin-bottom: 2rem;
  }

  .search-bar {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }

  .search-input {
    flex: 1;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    padding: 12px 16px;
    font-size: 16px;
  }

  .search-input:focus {
    outline: none;
    border-color: #58a6ff;
  }

  .search-btn {
    background: #238636;
    border: 1px solid #2ea043;
    border-radius: 6px;
    color: #ffffff;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .search-btn:hover:not(:disabled) {
    background: #2ea043;
    border-color: #46954a;
  }

  .search-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .examples {
    text-align: center;
    color: #8b949e;
    font-size: 14px;
  }

  .example-link {
    background: none;
    border: none;
    color: #58a6ff;
    cursor: pointer;
    text-decoration: underline;
    margin: 0 0.5rem;
  }

  .error-message {
    background: #da3633;
    color: #ffffff;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 2rem;
    text-align: center;
  }

  .dataset-info {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .dataset-info h2 {
    color: #58a6ff;
    margin-bottom: 1rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .info-item {
    color: #c9d1d9;
  }

  .classification {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .classification-public { background: #238636; color: #ffffff; }
  .classification-premium { background: #f78166; color: #ffffff; }
  .classification-restricted { background: #da3633; color: #ffffff; }

  code {
    background: #21262d;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'SF Mono', monospace;
    font-size: 12px;
  }

  .lineage-section {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .lineage-section h2 {
    color: #58a6ff;
    margin-bottom: 1rem;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #21262d;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 12px;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
  }

  .legend-label {
    font-weight: 600;
    color: #f0f6fc;
  }

  .legend-desc {
    color: #8b949e;
  }

  .lineage-tree {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .lineage-level {
    border-left: 2px solid #30363d;
    padding-left: 1rem;
  }

  .level-header {
    font-weight: 600;
    color: #8b949e;
    margin-bottom: 0.5rem;
    font-size: 12px;
    text-transform: uppercase;
  }

  .lineage-node {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    margin-bottom: 0.5rem;
    transition: all 0.2s;
  }

  .lineage-node.current {
    border-color: #58a6ff;
    background: #0d1521;
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .node-toggle {
    background: none;
    border: none;
    color: #8b949e;
    cursor: pointer;
    font-size: 12px;
    width: 20px;
    text-align: center;
  }

  .relationship-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #ffffff;
    text-transform: uppercase;
  }

  .node-title {
    background: none;
    border: none;
    color: #f0f6fc;
    cursor: pointer;
    text-decoration: none;
    font-weight: 500;
    flex: 1;
    text-align: left;
  }

  .node-title:hover {
    color: #58a6ff;
  }

  .current-badge {
    background: #238636;
    color: #ffffff;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
  }

  .node-details {
    padding: 0 0.75rem 0.75rem 2.5rem;
    color: #8b949e;
    font-size: 14px;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .explorer-page {
      padding: 1rem;
    }

    .search-bar {
      flex-direction: column;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .legend {
      flex-direction: column;
    }
  }
</style>