<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  let versionId = '';
  let dataset = null;
  let lineage = [];
  let policyJson = '';
  let policyResult = null;
  let loading = false;

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

      // Mock lineage data
      lineage = [
        {
          versionId: 'TOXSIM-REPORT-12',
          license: 'Internal-Use-Only',
          producer: 'ToxSimAgent',
          current: true
        },
        {
          versionId: 'MOLECULA-DESIGNS-45',
          license: 'Research-License-v2',
          producer: 'MoleculaAgent',
          current: false
        },
        {
          versionId: 'GENOSCREEN-RESULT-01',
          license: 'Data-Provider-ABC-License',
          producer: 'GenoScreenerAgent',
          current: false
        },
        {
          versionId: 'PHARMA-GENOME-73',
          license: 'PharmaCorp-Proprietary',
          producer: 'human@pharmaco.corp',
          current: false,
          isRoot: true
        }
      ];
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
      <h2>Data Lineage</h2>
      {#each lineage as item, index}
        <div class="lineage-item" class:current={item.current}>
          {#if index === 0}
            ◉ {item.versionId} {item.current ? '(this)' : ''}
          {:else if item.isRoot}
            └── ◉ {item.versionId} (root)
          {:else}
            └─┬ ◉ {item.versionId}
          {/if}
          <div class="lineage-meta">
            - License: {item.license}
          </div>
          <div class="lineage-meta">
            - Producer: {item.producer}
          </div>
          {#if !item.isRoot && index < lineage.length - 1}
            <div class="lineage-meta">│</div>
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