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
    <div class="layout">
      <!-- Filters Panel -->
      <div class="filters">
        <h3>Filters</h3>

        {#if filters.classification.size > 0 || filters.producer.size > 0 || filters.relationshipType.size > 0}
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
        {/if}
      </div>

      <!-- Main Content -->
      <div class="main">
        <!-- Enhanced Visual Graph -->
        <div class="graph">
          <svg width="100%" height="300" viewBox="0 0 800 300">
            <defs>
              <!-- Gradients for nodes -->
              <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.2"/>
                <stop offset="100%" style="stop-color:#000000;stop-opacity:0.1"/>
              </linearGradient>

              <!-- Animated arrow marker -->
              <marker id="arrow" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,8 L12,4 z" fill="#58a6ff" opacity="0.8"/>
              </marker>

              <!-- Drop shadow filter -->
              <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.3"/>
              </filter>

              <!-- Glow effect for current node -->
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <!-- Background pattern -->
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#30363d" stroke-width="0.5" opacity="0.3"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)"/>

            <!-- Flow lines with better styling -->
            {#each visibleUpstream as node, i}
              <path
                d="M 130 {62 + i * 40} Q 240 {62 + i * 40} 350 140"
                stroke={getClassificationColor(node.classification)}
                stroke-width="2"
                fill="none"
                opacity="0.6"
                marker-end="url(#arrow)"
                class="flow-line"
              />
            {/each}

            {#each visibleDownstream as node, i}
              <path
                d="M 450 140 Q 560 {62 + i * 40} 640 {62 + i * 40}"
                stroke={getClassificationColor(node.classification)}
                stroke-width="2"
                fill="none"
                opacity="0.6"
                marker-end="url(#arrow)"
                class="flow-line"
              />
            {/each}

            <!-- Upstream nodes with enhanced styling -->
            {#each visibleUpstream as node, i}
              <g class="node upstream" on:click={() => selectNode(node)} transform="translate(50, {50 + i * 40})">
                <rect
                  width="80"
                  height="25"
                  fill={getClassificationColor(node.classification)}
                  rx="6"
                  filter="url(#dropShadow)"
                  class="node-bg"
                />
                <rect
                  width="80"
                  height="25"
                  fill="url(#nodeGradient)"
                  rx="6"
                />
                <text x="40" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="500">
                  {node.title.slice(0, 9)}...
                </text>
                <!-- Status indicator -->
                <circle cx="72" cy="8" r="3" fill="#58a6ff" opacity="0.8"/>
              </g>
            {/each}

            <!-- Current node with special styling -->
            <g class="node current" on:click={() => selectNode(lineageData.current)} transform="translate(350, 120)">
              <rect
                width="100"
                height="40"
                fill={getClassificationColor(lineageData.current.classification)}
                rx="8"
                filter="url(#glow)"
                class="current-node-bg"
              />
              <rect
                width="100"
                height="40"
                fill="url(#nodeGradient)"
                rx="8"
              />
              <rect
                width="100"
                height="40"
                stroke="#58a6ff"
                stroke-width="2"
                fill="none"
                rx="8"
                opacity="0.8"
              />
              <text x="50" y="25" text-anchor="middle" fill="white" font-size="13" font-weight="600">
                {lineageData.current.title.slice(0, 11)}...
              </text>
              <!-- Pulse indicator -->
              <circle cx="85" cy="15" r="4" fill="#58a6ff" class="pulse"/>
            </g>

            <!-- Downstream nodes with enhanced styling -->
            {#each visibleDownstream as node, i}
              <g class="node downstream" on:click={() => selectNode(node)} transform="translate(650, {50 + i * 40})">
                <rect
                  width="80"
                  height="25"
                  fill={getClassificationColor(node.classification)}
                  rx="6"
                  filter="url(#dropShadow)"
                  class="node-bg"
                />
                <rect
                  width="80"
                  height="25"
                  fill="url(#nodeGradient)"
                  rx="6"
                />
                <text x="40" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="500">
                  {node.title.slice(0, 9)}...
                </text>
                <!-- Status indicator -->
                <circle cx="72" cy="8" r="3" fill="#f85149" opacity="0.8"/>
              </g>
            {/each}

            <!-- Flow direction labels -->
            <text x="150" y="25" text-anchor="middle" fill="#58a6ff" font-size="12" font-weight="600" opacity="0.7">
              Sources
            </text>
            <text x="400" y="200" text-anchor="middle" fill="#238636" font-size="12" font-weight="600" opacity="0.7">
              Current
            </text>
            <text x="650" y="25" text-anchor="middle" fill="#f85149" font-size="12" font-weight="600" opacity="0.7">
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
        <div class="detail">
          <h3>Details</h3>
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

  .layout {
    display: grid;
    grid-template-columns: 200px 1fr 300px;
    gap: 20px;
    height: calc(100vh - 120px);
  }

  /* Filters Panel */
  .filters {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
    height: fit-content;
  }

  .filters h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
  }

  .active-filters {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-tag {
    background: #58a6ff;
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    cursor: pointer;
    display: inline-block;
  }

  .clear-filters {
    background: #f85149;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    margin-top: 8px;
  }

  /* Main Content */
  .main {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .graph {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
  }

  .graph svg {
    background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
    border-radius: 4px;
  }

  .node {
    cursor: pointer;
    transition: transform 0.2s ease, opacity 0.2s ease;
  }

  .node:hover {
    transform: scale(1.05);
  }

  .node-bg {
    transition: filter 0.2s ease;
  }

  .node:hover .node-bg {
    filter: brightness(1.2) url(#dropShadow);
  }

  .current-node-bg {
    animation: currentPulse 3s ease-in-out infinite;
  }

  .flow-line {
    transition: opacity 0.3s ease, stroke-width 0.3s ease;
  }

  .flow-line:hover {
    opacity: 0.9;
    stroke-width: 3;
  }

  .pulse {
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.2); }
  }

  @keyframes currentPulse {
    0%, 100% { filter: url(#glow) brightness(1); }
    50% { filter: url(#glow) brightness(1.1); }
  }

  .nodes {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
    overflow-y: auto;
    max-height: 400px;
  }

  .section {
    margin-bottom: 20px;
  }

  .section h3 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: #8b949e;
  }

  .node-card {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .node-card:hover {
    border-color: #58a6ff;
  }

  .node-card.selected {
    border-color: #58a6ff;
    background: rgba(88, 166, 255, 0.1);
  }

  .node-card.current {
    border-color: #238636;
  }

  .node-title {
    font-weight: 600;
    margin-bottom: 6px;
    font-size: 13px;
  }

  .node-meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .tag {
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    color: white;
  }

  .tag.producer {
    background: #6f42c1;
  }

  .tag.relation {
    background: #db6d28;
  }

  /* Detail Panel */
  .detail {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
    height: fit-content;
  }

  .detail h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
  }

  .detail h4 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
  }

  .detail-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .label {
    font-size: 12px;
    color: #8b949e;
    font-weight: 500;
  }

  .value {
    font-size: 12px;
    font-weight: 600;
  }

  @media (max-width: 1200px) {
    .layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
      height: auto;
    }

    .filters, .detail {
      order: 3;
    }
  }
</style>