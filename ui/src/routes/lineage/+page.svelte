<script>
  import { onMount } from 'svelte';

  let datasets = [];
  let selectedDataset = '';
  let lineageData = null;
  let loading = false;
  let error = null;
  let selectedNode = null;
  let filters = {
    classification: new Set(),
    producer: new Set(),
    relationshipType: new Set()
  };

  onMount(() => {
    loadDatasets();
  });

  async function loadDatasets() {
    try {
      const response = await fetch('/search?limit=100');
      const data = await response.json();
      datasets = data.items || [];
    } catch (err) {
      console.error('Failed to load datasets:', err);
    }
  }

  async function loadLineage() {
    if (!selectedDataset) return;

    try {
      loading = true;
      error = null;

      const response = await fetch(`/lineage?versionId=${selectedDataset}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      lineageData = await response.json();
      selectedNode = null;
      clearFilters();
    } catch (err) {
      console.error('Failed to load lineage:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function onDatasetSelect(event) {
    selectedDataset = event.target.value;
    if (selectedDataset) {
      loadLineage();
    } else {
      lineageData = null;
      selectedNode = null;
    }
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
      case 'internal': return '#0969da';
      case 'restricted': return '#da3633';
      default: return '#6f42c1';
    }
  }

  $: visibleUpstream = lineageData ? lineageData.upstream.filter(isNodeVisible) : [];
  $: visibleDownstream = lineageData ? lineageData.downstream.filter(isNodeVisible) : [];
</script>

<svelte:head>
  <title>Lineage Visualization - Gitdata</title>
</svelte:head>

<div class="lineage-page">
  <h1>🔗 Lineage</h1>

  <select bind:value={selectedDataset} on:change={onDatasetSelect} class="dataset-select">
    <option value="">Choose dataset...</option>
    {#each datasets as dataset}
      <option value={dataset.versionId}>{dataset.title}</option>
    {/each}
  </select>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if lineageData}
    <!-- Horizontal Filters -->
    {#if filters.classification.size > 0 || filters.producer.size > 0 || filters.relationshipType.size > 0}
      <div class="filters-horizontal">
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

    <div class="layout">

      <!-- Main Content -->
      <div class="main">
        <!-- Clean Visual Graph -->
        <div class="graph">
          <svg width="100%" height="240" viewBox="0 0 800 240">
            <defs>
              <!-- Simple arrow marker -->
              <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#6b7280"/>
              </marker>
            </defs>

            <!-- Simple flow lines -->
            {#each visibleUpstream as node, i}
              <line
                x1="130"
                y1={60 + i * 35}
                x2="350"
                y2="120"
                stroke="#e5e7eb"
                stroke-width="2"
                marker-end="url(#arrow)"
                class="flow-line"
              />
            {/each}

            {#each visibleDownstream as node, i}
              <line
                x1="450"
                y1="120"
                x2="620"
                y2={60 + i * 35}
                stroke="#e5e7eb"
                stroke-width="2"
                marker-end="url(#arrow)"
                class="flow-line"
              />
            {/each}

            <!-- Upstream nodes -->
            {#each visibleUpstream as node, i}
              <g class="node upstream" on:click={() => selectNode(node)} transform="translate(50, {50 + i * 35})">
                <rect
                  width="80"
                  height="20"
                  fill={getClassificationColor(node.classification)}
                  rx="4"
                  class="node-bg"
                />
                <text x="40" y="14" text-anchor="middle" fill="white" font-size="11" font-weight="500">
                  {node.title.slice(0, 9)}...
                </text>
              </g>
            {/each}

            <!-- Current node -->
            <g class="node current" on:click={() => selectNode(lineageData.current)} transform="translate(350, 105)">
              <rect
                width="100"
                height="30"
                fill={getClassificationColor(lineageData.current.classification)}
                rx="6"
                stroke="#374151"
                stroke-width="2"
                class="current-node-bg"
              />
              <text x="50" y="20" text-anchor="middle" fill="white" font-size="12" font-weight="600">
                {lineageData.current.title.slice(0, 11)}...
              </text>
            </g>

            <!-- Downstream nodes -->
            {#each visibleDownstream as node, i}
              <g class="node downstream" on:click={() => selectNode(node)} transform="translate(670, {50 + i * 35})">
                <rect
                  width="80"
                  height="20"
                  fill={getClassificationColor(node.classification)}
                  rx="4"
                  class="node-bg"
                />
                <text x="40" y="14" text-anchor="middle" fill="white" font-size="11" font-weight="500">
                  {node.title.slice(0, 9)}...
                </text>
              </g>
            {/each}

            <!-- Simple labels -->
            <text x="90" y="30" text-anchor="middle" fill="#6b7280" font-size="11" font-weight="500">
              Sources
            </text>
            <text x="400" y="30" text-anchor="middle" fill="#6b7280" font-size="11" font-weight="500">
              Current
            </text>
            <text x="710" y="30" text-anchor="middle" fill="#6b7280" font-size="11" font-weight="500">
              Outputs
            </text>
          </svg>
        </div>

        <!-- Node List -->
        <div class="nodes">
          {#if visibleUpstream.length > 0}
            <div class="section">
              <h3>Upstream ({visibleUpstream.length})</h3>
              {#each visibleUpstream as node}
                <div class="node-card" class:selected={selectedNode === node} on:click={() => selectNode(node)}>
                  <div class="node-title">{node.title}</div>
                  <div class="node-meta">
                    <span class="tag" style="background: {getClassificationColor(node.classification)}"
                          on:click|stopPropagation={() => addFilter('classification', node.classification)}>
                      {node.classification}
                    </span>
                    <span class="tag producer"
                          on:click|stopPropagation={() => addFilter('producer', node.producer)}>
                      {node.producer}
                    </span>
                    {#if node.relationshipType}
                      <span class="tag relation"
                            on:click|stopPropagation={() => addFilter('relationshipType', node.relationshipType)}>
                        {node.relationshipType}
                      </span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <div class="section">
            <h3>Current</h3>
            <div class="node-card current" class:selected={selectedNode === lineageData.current} on:click={() => selectNode(lineageData.current)}>
              <div class="node-title">{lineageData.current.title}</div>
              <div class="node-meta">
                <span class="tag" style="background: {getClassificationColor(lineageData.current.classification)}"
                      on:click|stopPropagation={() => addFilter('classification', lineageData.current.classification)}>
                  {lineageData.current.classification}
                </span>
                <span class="tag producer"
                      on:click|stopPropagation={() => addFilter('producer', lineageData.current.producer)}>
                  {lineageData.current.producer}
                </span>
              </div>
            </div>
          </div>

          {#if visibleDownstream.length > 0}
            <div class="section">
              <h3>Downstream ({visibleDownstream.length})</h3>
              {#each visibleDownstream as node}
                <div class="node-card" class:selected={selectedNode === node} on:click={() => selectNode(node)}>
                  <div class="node-title">{node.title}</div>
                  <div class="node-meta">
                    <span class="tag" style="background: {getClassificationColor(node.classification)}"
                          on:click|stopPropagation={() => addFilter('classification', node.classification)}>
                      {node.classification}
                    </span>
                    <span class="tag producer"
                          on:click|stopPropagation={() => addFilter('producer', node.producer)}>
                      {node.producer}
                    </span>
                    {#if node.relationshipType}
                      <span class="tag relation"
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
      </div>

      <!-- Detail Panel -->
      {#if selectedNode}
        <div class="detail-panel">
          <h3>Dataset Details</h3>
          <div class="detail-content">
            <h4>{selectedNode.title}</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="label">Classification:</span>
                <span class="value" style="color: {getClassificationColor(selectedNode.classification)}">
                  {selectedNode.classification}
                </span>
              </div>
              <div class="detail-item">
                <span class="label">Producer:</span>
                <span class="value">{selectedNode.producer}</span>
              </div>
              {#if selectedNode.datasetId}
                <div class="detail-item">
                  <span class="label">Dataset ID:</span>
                  <span class="value">{selectedNode.datasetId}</span>
                </div>
              {/if}
              {#if selectedNode.relationshipType}
                <div class="detail-item">
                  <span class="label">Relationship:</span>
                  <span class="value">{selectedNode.relationshipType}</span>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="empty">Select a dataset to view its lineage</div>
  {/if}
</div>

<style>
  .lineage-page {
    padding: 20px;
    color: #f0f6fc;
    max-width: 1400px;
    margin: 0 auto;
  }

  h1 {
    margin: 0 0 20px 0;
    font-size: 24px;
  }

  .dataset-select {
    width: 300px;
    padding: 8px 12px;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #f0f6fc;
    margin-bottom: 20px;
  }

  .loading, .error, .empty {
    padding: 40px;
    text-align: center;
    color: #8b949e;
  }

  /* Horizontal Filters */
  .filters-horizontal {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding: 12px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .filters-label {
    font-size: 13px;
    font-weight: 500;
    color: #64748b;
  }

  .active-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .filter-tag {
    background: #3b82f6;
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
    background: #ef4444;
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
    background: #dc2626;
  }

  .layout {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Main Content */
  .main {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
  }

  .graph {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .graph svg {
    background: #f8fafc;
    border-radius: 6px;
  }

  .node {
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .node:hover {
    transform: scale(1.03);
  }

  .node-bg {
    transition: opacity 0.15s ease;
  }

  .node:hover .node-bg {
    opacity: 0.9;
  }

  .flow-line {
    transition: stroke-width 0.15s ease;
  }

  .flow-line:hover {
    stroke-width: 3;
  }

  .nodes {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    overflow-y: auto;
    max-height: 500px;
  }

  .section {
    margin-bottom: 20px;
  }

  .section h3 {
    margin: 0 0 12px 0;
    font-size: 15px;
    font-weight: 600;
    color: #374151;
  }

  .node-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .node-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .node-card.selected {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.05);
  }

  .node-card.current {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.05);
  }

  .node-title {
    font-weight: 600;
    margin-bottom: 8px;
    font-size: 14px;
    color: #111827;
  }

  .node-meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .tag {
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    color: white;
    transition: opacity 0.15s;
  }

  .tag:hover {
    opacity: 0.8;
  }

  .tag.producer {
    background: #8b5cf6;
  }

  .tag.relation {
    background: #f59e0b;
  }

  /* Detail Panel */
  .detail-panel {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    height: fit-content;
  }

  .detail-panel h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }

  .detail-panel h4 {
    margin: 0 0 12px 0;
    font-size: 15px;
    font-weight: 600;
    color: #374151;
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
    border-bottom: 1px solid #f1f5f9;
  }

  .detail-item:last-child {
    border-bottom: none;
  }

  .label {
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
  }

  .value {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }

  @media (max-width: 1000px) {
    .main {
      grid-template-columns: 1fr;
    }

    .detail-panel {
      margin-top: 20px;
    }
  }
</style>