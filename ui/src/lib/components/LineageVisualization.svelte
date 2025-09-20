<script>
  import { onMount, createEventDispatcher } from 'svelte';

  export let versionId = '';
  export let assetType = 'data'; // 'data' or 'model'

  const dispatch = createEventDispatcher();

  let loading = false;
  let error = null;
  let lineageData = null;
  let selectedNode = null;

  onMount(() => {
    if (versionId) {
      loadLineage();
    }
  });

  async function loadLineageFromOpenLineage(versionId) {
    // Load from OpenLineage API endpoint
    const namespace = 'overlay:prod'; // Could be configurable
    const response = await fetch(`/openlineage/lineage?node=dataset:${namespace}:${encodeURIComponent(versionId)}&depth=3&direction=both`);

    if (!response.ok) {
      throw new Error(`OpenLineage API error: ${response.status}`);
    }

    const openLineageData = await response.json();

    // Transform OpenLineage format to our visualization format
    return transformOpenLineageData(openLineageData);
  }

  async function loadLineageFromBundle(versionId) {
    // Fallback to /bundle endpoint for SPV truth
    const response = await fetch(`/bundle?versionId=${encodeURIComponent(versionId)}`);

    if (!response.ok) {
      throw new Error(`Bundle API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform bundle data to OpenLineage-compatible format
    return {
      nodes: [
        {
          id: versionId,
          name: `asset:${versionId}`,
          type: 'DATASET',
          level: 1,
          facets: {
            contentHash: data.contentHash,
            producer: data.producer,
            createdAt: data.createdAt
          }
        }
      ],
      edges: [],
      graph: {
        [versionId]: {
          id: versionId,
          type: 'DATASET',
          name: `asset:${versionId}`,
          parents: data.parents || [],
          facets: {
            contentHash: data.contentHash,
            producer: data.producer,
            createdAt: data.createdAt
          }
        }
      }
    };
  }

  function transformOpenLineageData(openLineageData) {
    // Transform OpenLineage lineage response into our visualization format
    const nodes = [];
    const edges = [];

    // Process nodes from OpenLineage response
    if (openLineageData.nodes) {
      openLineageData.nodes.forEach((node, index) => {
        nodes.push({
          id: node.name,
          name: node.name,
          type: node.type || 'DATASET',
          level: index % 3, // Simple level assignment for visualization
          facets: node.facets || {}
        });
      });
    }

    // Process edges from OpenLineage response
    if (openLineageData.edges) {
      openLineageData.edges.forEach(edge => {
        // Extract dataset names from the "dataset:namespace:name" format
        const fromMatch = edge.from.match(/dataset:[^:]+:(.+)$/);
        const toMatch = edge.to.match(/dataset:[^:]+:(.+)$/);

        if (fromMatch && toMatch) {
          edges.push({
            from: fromMatch[1],
            to: toMatch[1]
          });
        }
      });
    }

    return { nodes, edges };
  }

  async function loadLineage() {
    if (!versionId) return;

    try {
      loading = true;
      error = null;
      dispatch('load');

      let data;
      try {
        // Try OpenLineage API first
        data = await loadLineageFromOpenLineage(versionId);
      } catch (err) {
        console.warn('OpenLineage API failed, falling back to bundle:', err);
        // Fallback to bundle endpoint
        data = await loadLineageFromBundle(versionId);
      }

      lineageData = data;
    } catch (err) {
      console.error('Failed to load lineage:', err);
      error = err.message;
      dispatch('error', { message: err.message });
    } finally {
      loading = false;
    }
  }

  function selectNode(nodeId) {
    selectedNode = nodeId;
  }

  function renderNode(node, isRoot = false) {
    const nodeClass = isRoot ? 'node root-node' : 'node';
    const typeIcon = assetType === 'model' ? '🤖' : '📊';

    return {
      id: node.id,
      label: node.name || node.id,
      icon: typeIcon,
      class: nodeClass,
      facets: node.facets || {}
    };
  }

  // Reactive statement to load lineage when versionId changes
  $: if (versionId) {
    loadLineage();
  }

  // Mock lineage data for demonstration when no real data is available
  $: mockLineageData = lineageData || {
    nodes: [
      { id: 'parent1', name: 'Dataset A', type: 'DATASET', level: 0 },
      { id: 'parent2', name: 'Dataset B', type: 'DATASET', level: 0 },
      { id: versionId || 'current', name: 'Current Asset', type: assetType === 'ai' ? 'MODEL' : 'DATASET', level: 1 },
      { id: 'child1', name: 'Model Output', type: 'MODEL', level: 2 }
    ],
    edges: [
      { from: 'parent1', to: versionId || 'current' },
      { from: 'parent2', to: versionId || 'current' },
      { from: versionId || 'current', to: 'child1' }
    ]
  };
</script>

<div class="lineage-visualization">
  <div class="visualization-header">
    <h3>🔗 OpenLineage Visualization</h3>
    <div class="source-indicator">
      <span class="source-badge openlineage">📊 OpenLineage</span>
    </div>
  </div>

  {#if !versionId}
    <div class="empty-state">
      <p>Select an asset to view its lineage</p>
    </div>
  {:else if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading lineage graph...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p>❌ Failed to load lineage: {error}</p>
      <button class="btn secondary" on:click={loadLineage}>🔄 Retry</button>
    </div>
  {:else}
    <div class="lineage-content">
      <!-- Graph Visualization Area -->
      <div class="graph-container">
        <div class="graph-controls">
          <button class="btn small secondary" on:click={loadLineage}>🔄 Refresh</button>
        </div>

        <!-- Simple SVG-based lineage visualization -->
        <div class="graph-svg-container">
          <svg width="100%" height="400" viewBox="0 0 800 400">
            <!-- Background grid -->
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#30363d" stroke-width="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            <!-- Render edges -->
            {#each mockLineageData.edges as edge}
              <line
                x1={150 + edge.from === 'parent1' ? 0 : edge.from === 'parent2' ? 0 : 200}
                y1={100 + (edge.from === 'parent1' ? 0 : edge.from === 'parent2' ? 100 : 200)}
                x2={150 + (edge.to === versionId || edge.to === 'current' ? 200 : 400)}
                y2={100 + (edge.to === versionId || edge.to === 'current' ? 100 : 200)}
                stroke="#58a6ff"
                stroke-width="2"
                marker-end="url(#arrowhead)"
              />
            {/each}

            <!-- Arrow marker -->
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7"
                      refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#58a6ff" />
              </marker>
            </defs>

            <!-- Render nodes -->
            {#each mockLineageData.nodes as node}
              <g
                class="graph-node"
                class:selected={selectedNode === node.id}
                on:click={() => selectNode(node.id)}
                style="cursor: pointer;"
              >
                <circle
                  cx={150 + (node.level * 200)}
                  cy={100 + (node.id === 'parent2' ? 100 : node.level === 2 ? 200 : node.level === 1 ? 100 : 50)}
                  r="30"
                  fill={node.id === (versionId || 'current') ? '#238636' : '#21262d'}
                  stroke={selectedNode === node.id ? '#58a6ff' : '#30363d'}
                  stroke-width={selectedNode === node.id ? '3' : '2'}
                />
                <text
                  x={150 + (node.level * 200)}
                  y={100 + (node.id === 'parent2' ? 100 : node.level === 2 ? 200 : node.level === 1 ? 100 : 50)}
                  text-anchor="middle"
                  dy="0.3em"
                  fill="#f0f6fc"
                  font-size="20"
                >
                  {node.type === 'model' ? '🤖' : '📊'}
                </text>
                <text
                  x={150 + (node.level * 200)}
                  y={140 + (node.id === 'parent2' ? 100 : node.level === 2 ? 200 : node.level === 1 ? 100 : 50)}
                  text-anchor="middle"
                  fill="#f0f6fc"
                  font-size="12"
                  font-weight="500"
                >
                  {node.name}
                </text>
              </g>
            {/each}
          </svg>
        </div>

        <!-- Graph Legend -->
        <div class="graph-legend">
          <div class="legend-item">
            <div class="legend-icon dataset">📊</div>
            <span>Data Asset</span>
          </div>
          <div class="legend-item">
            <div class="legend-icon model">🤖</div>
            <span>AI Model</span>
          </div>
          <div class="legend-item">
            <div class="legend-icon current">🎯</div>
            <span>Current Asset</span>
          </div>
        </div>
      </div>

      <!-- Node Details Panel -->
      {#if selectedNode}
        <div class="node-details">
          <h4>Node Details</h4>
          {#each mockLineageData.nodes as node}
            {#if node.id === selectedNode}
              <div class="detail-item">
                <label>ID:</label>
                <span>{node.id}</span>
              </div>
              <div class="detail-item">
                <label>Name:</label>
                <span>{node.name}</span>
              </div>
              <div class="detail-item">
                <label>Type:</label>
                <span>{node.type}</span>
              </div>
              <div class="detail-item">
                <label>Level:</label>
                <span>{node.level}</span>
              </div>

              <div class="detail-actions">
                <button class="btn small primary" on:click={() => {}}>
                  🔍 View Asset
                </button>
                <button class="btn small secondary" on:click={() => {}}>
                  🔒 Verify SPV
                </button>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- Data Source Information -->
    <div class="data-source-info">
      <h4>OpenLineage Data Lineage</h4>
      <div class="source-comparison">
        <div class="source-card">
          <h5>📊 OpenLineage API</h5>
          <p>Standard metadata collection and lineage tracking</p>
          <ul>
            <li>✅ Industry standard format</li>
            <li>✅ Rich metadata facets</li>
            <li>✅ Job and dataset tracking</li>
            <li>✅ Vendor-neutral specification</li>
          </ul>
        </div>
        <div class="source-card">
          <h5>🔒 SPV Bundle (Fallback)</h5>
          <p>On-chain verified lineage via /bundle endpoint</p>
          <ul>
            <li>✅ Cryptographically secured</li>
            <li>✅ Reorg-resistant</li>
            <li>⚠️ Limited metadata</li>
            <li>⚠️ Slower for complex graphs</li>
          </ul>
        </div>
      </div>
      <div class="disclaimer">
        <p><strong>Note:</strong> OpenLineage provides rich metadata visualization. SPV bundle serves as cryptographic fallback for trust verification.</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .lineage-visualization {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    color: #f0f6fc;
  }

  .visualization-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #30363d;
  }

  .visualization-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .source-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .source-badge.openlineage {
    background: #0969da;
    color: white;
  }

  .source-badge.bundle {
    background: #238636;
    color: white;
  }

  .empty-state,
  .loading-state,
  .error-state {
    text-align: center;
    padding: 40px;
    color: #8b949e;
  }

  .loading-state .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #30363d;
    border-top: 2px solid #58a6ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 12px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .lineage-content {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
  }

  .graph-container {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
  }

  .graph-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .graph-svg-container {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 4px;
    overflow: hidden;
  }

  .graph-node {
    transition: all 0.2s ease;
  }

  .graph-node:hover circle {
    stroke: #58a6ff !important;
    stroke-width: 3;
  }

  .graph-legend {
    display: flex;
    gap: 16px;
    margin-top: 12px;
    font-size: 12px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
  }

  .legend-icon.dataset {
    background: #21262d;
    border: 1px solid #30363d;
  }

  .legend-icon.model {
    background: #21262d;
    border: 1px solid #30363d;
  }

  .legend-icon.current {
    background: #238636;
    border: 1px solid #238636;
  }

  .node-details {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
    height: fit-content;
  }

  .node-details h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .detail-item label {
    font-weight: 500;
    color: #8b949e;
  }

  .detail-actions {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .data-source-info {
    margin-top: 24px;
    padding: 16px;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
  }

  .data-source-info h4 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
  }

  .source-comparison {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  .source-card {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
  }

  .source-card h5 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
  }

  .source-card p {
    margin: 0 0 12px 0;
    font-size: 12px;
    color: #8b949e;
  }

  .source-card ul {
    margin: 0;
    padding-left: 16px;
    font-size: 11px;
  }

  .disclaimer {
    background: #2d1b00;
    border: 1px solid #bf8700;
    border-radius: 4px;
    padding: 12px;
    font-size: 12px;
  }

  .btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .btn.primary {
    background: #238636;
    color: white;
  }

  .btn.primary:hover:not(:disabled) {
    background: #2ea043;
  }

  .btn.secondary {
    background: #21262d;
    color: #f0f6fc;
    border: 1px solid #30363d;
  }

  .btn.secondary:hover:not(:disabled) {
    background: #30363d;
  }

  .btn.small {
    padding: 4px 8px;
    font-size: 11px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>