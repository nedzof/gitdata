<script>
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

  onMount(() => {
    if (versionId) {
      loadDataset();
    }
  });

  async function loadDataset() {
    loading = true;
    try {
      // Mock data based on D25 example
      dataset = {
        versionId: versionId,
        type: 'Analysis Report',
        producer: 'ToxSimAgent',
        createdAt: '2024-01-15T10:30:00Z',
        license: 'Internal-Use-Only',
        contentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        price: '100 sats',
        size: '2.3 MB'
      };

      // Mock lineage data with extended information
      lineage = [
        {
          versionId: 'TOXSIM-REPORT-12',
          license: 'Internal-Use-Only',
          producer: 'ToxSimAgent',
          current: true,
          createdAt: '2024-01-15T10:30:00Z',
          size: '2.3 MB',
          type: 'Analysis Report',
          dependencies: ['MOLECULA-DESIGNS-45']
        },
        {
          versionId: 'MOLECULA-DESIGNS-45',
          license: 'Research-License-v2',
          producer: 'MoleculaAgent',
          current: false,
          createdAt: '2024-01-14T09:15:00Z',
          size: '1.8 MB',
          type: 'Design Data',
          dependencies: ['GENOSCREEN-RESULT-01']
        },
        {
          versionId: 'GENOSCREEN-RESULT-01',
          license: 'Data-Provider-ABC-License',
          producer: 'GenoScreenerAgent',
          current: false,
          createdAt: '2024-01-13T14:45:00Z',
          size: '5.2 MB',
          type: 'Screening Results',
          dependencies: ['PHARMA-GENOME-73']
        },
        {
          versionId: 'PHARMA-GENOME-73',
          license: 'PharmaCorp-Proprietary',
          producer: 'human@pharmaco.corp',
          current: false,
          isRoot: true,
          createdAt: '2024-01-12T11:20:00Z',
          size: '12.7 MB',
          type: 'Genome Data',
          dependencies: []
        }
      ];

      // Initialize all nodes as expanded
      expandedNodes = new Set(lineage.map(item => item.versionId));
    } catch (error) {
      console.error('Failed to load dataset:', error);
    } finally {
      loading = false;
    }
  }

  async function runPolicyCheck() {
    if (!policyJson.trim()) return;

    try {
      policyResult = { loading: true };

      // Mock policy check
      await new Promise(resolve => setTimeout(resolve, 1000));

      const policy = JSON.parse(policyJson);
      const ready = Math.random() > 0.3; // 70% chance of ready

      policyResult = {
        ready,
        reason: ready
          ? 'All policy conditions satisfied'
          : 'License compatibility issue detected',
        policy
      };
    } catch (error) {
      policyResult = {
        ready: false,
        reason: 'Invalid JSON policy',
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