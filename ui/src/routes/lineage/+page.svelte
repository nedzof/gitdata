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
        <!-- Simple Visual Graph -->
        <div class="graph">
          <svg width="100%" height="300" viewBox="0 0 800 300">
            <!-- Upstream nodes -->
            {#each visibleUpstream as node, i}
              <g class="node" on:click={() => selectNode(node)} transform="translate(50, {50 + i * 40})">
                <rect width="80" height="25" fill={getClassificationColor(node.classification)} rx="3"/>
                <text x="40" y="17" text-anchor="middle" fill="white" font-size="12">
                  {node.title.slice(0, 8)}...
                </text>
                <line x1="85" y1="12" x2="120" y2="12" stroke="#666" stroke-width="2" marker-end="url(#arrow)"/>
              </g>
            {/each}

            <!-- Current node -->
            <g class="node current" on:click={() => selectNode(lineageData.current)} transform="translate(350, 120)">
              <rect width="100" height="40" fill={getClassificationColor(lineageData.current.classification)} stroke="#fff" stroke-width="2" rx="5"/>
              <text x="50" y="25" text-anchor="middle" fill="white" font-size="14" font-weight="bold">
                {lineageData.current.title.slice(0, 10)}...
              </text>
            </g>

            <!-- Downstream nodes -->
            {#each visibleDownstream as node, i}
              <g class="node" on:click={() => selectNode(node)} transform="translate(600, {50 + i * 40})">
                <line x1="0" y1="12" x2="35" y2="12" stroke="#666" stroke-width="2" marker-end="url(#arrow)"/>
                <rect x="40" width="80" height="25" fill={getClassificationColor(node.classification)} rx="3"/>
                <text x="80" y="17" text-anchor="middle" fill="white" font-size="12">
                  {node.title.slice(0, 8)}...
                </text>
              </g>
            {/each}

            <!-- Arrow marker -->
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#666"/>
              </marker>
            </defs>
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
    background: #0d1117;
    border-radius: 4px;
  }

  .node {
    cursor: pointer;
  }

  .node:hover rect {
    stroke: #fff;
    stroke-width: 1;
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