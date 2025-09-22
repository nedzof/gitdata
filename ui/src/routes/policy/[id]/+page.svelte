<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api } from '$lib/api';

  let policyId = '';
  let policy = null;
  let loading = false;
  let editing = false;
  let saving = false;

  // Editable policy data
  let editPolicy = {
    name: '',
    description: '',
    enabled: true,
    policy: {}
  };

  // Policy rule categories based on D28-policy.md
  const ruleCategories = {
    'SPV & Confirmations': [
      { key: 'minConfs', label: 'Min Confirmations', type: 'number', description: 'Minimum SPV confirmations required' },
      { key: 'allowRecalled', label: 'Allow Recalled', type: 'boolean', description: 'Allow recalled/flagged data' }
    ],
    'Producer & Provenance': [
      { key: 'producerAllowList', label: 'Producer Allow List', type: 'array', description: 'Allowed producer public keys' },
      { key: 'producerBlockList', label: 'Producer Block List', type: 'array', description: 'Blocked producer public keys' },
      { key: 'maxLineageDepth', label: 'Max Lineage Depth', type: 'number', description: 'Maximum allowed lineage depth' },
      { key: 'requiredAncestor', label: 'Required Ancestor', type: 'string', description: 'Required ancestor version ID' }
    ],
    'Compliance & Legal': [
      { key: 'classificationAllowList', label: 'Classification Allow List', type: 'array', description: 'Allowed data classifications' },
      { key: 'licenseAllowList', label: 'License Allow List', type: 'array', description: 'Allowed data licenses' },
      { key: 'piiFlagsBlockList', label: 'PII Flags Block List', type: 'array', description: 'Blocked PII flag types' },
      { key: 'geoOriginAllowList', label: 'Geo Origin Allow List', type: 'array', description: 'Allowed geographic origins' }
    ],
    'Content & Schema': [
      { key: 'requiredSchemaHash', label: 'Required Schema Hash', type: 'string', description: 'Required exact schema hash' },
      { key: 'requiredMimeTypes', label: 'Required MIME Types', type: 'array', description: 'Required MIME types' },
      { key: 'requiredOntologyTags', label: 'Required Ontology Tags', type: 'array', description: 'Required ontology tags' }
    ],
    'Economics & Operations': [
      { key: 'maxPricePerByte', label: 'Max Price Per Byte', type: 'number', description: 'Maximum price per byte limit' },
      { key: 'maxTotalCostForLineage', label: 'Max Total Cost', type: 'number', description: 'Maximum total lineage cost' },
      { key: 'maxDataAgeSeconds', label: 'Max Data Age (seconds)', type: 'number', description: 'Maximum data age in seconds' },
      { key: 'minProducerUptime', label: 'Min Producer Uptime (%)', type: 'number', description: 'Minimum producer uptime percentage' },
      { key: 'requiresBillingAccount', label: 'Requires Billing Account', type: 'boolean', description: 'Billing account required' }
    ],
    'Data Quality & Profiling': [
      { key: 'minRowCount', label: 'Min Row Count', type: 'number', description: 'Minimum number of rows' },
      { key: 'maxRowCount', label: 'Max Row Count', type: 'number', description: 'Maximum number of rows' },
      { key: 'maxNullValuePercentage', label: 'Max Null Value %', type: 'number', description: 'Maximum null value percentage' },
      { key: 'requiredDistributionProfileHash', label: 'Required Profile Hash', type: 'string', description: 'Required distribution profile hash' },
      { key: 'maxOutlierScore', label: 'Max Outlier Score', type: 'number', description: 'Maximum outlier score' },
      { key: 'minUniquenessRatio', label: 'Min Uniqueness Ratio', type: 'number', description: 'Minimum uniqueness ratio' }
    ],
    'MLOps & Model Validation': [
      { key: 'requiredFeatureSetId', label: 'Required Feature Set ID', type: 'string', description: 'Required feature set identifier' },
      { key: 'requiresValidSplit', label: 'Requires Valid Split', type: 'boolean', description: 'Valid train/val/test split required' },
      { key: 'maxBiasScore', label: 'Max Bias Score', type: 'number', description: 'Maximum bias score allowed' },
      { key: 'maxDriftScore', label: 'Max Drift Score', type: 'number', description: 'Maximum drift score allowed' },
      { key: 'requiredParentModelId', label: 'Required Parent Model ID', type: 'string', description: 'Required parent model identifier' }
    ],
    'Security & Privacy': [
      { key: 'blockIfInThreatFeed', label: 'Block If In Threat Feed', type: 'boolean', description: 'Block if found in threat feeds' },
      { key: 'minAnonymizationLevel', label: 'Min Anonymization Level', type: 'object', description: 'Minimum anonymization requirements' }
    ]
  };

  onMount(() => {
    policyId = $page.params.id;
    loadPolicy();
  });

  async function loadPolicy() {
    loading = true;
    try {
      // Try to fetch from API
      try {
        const response = await fetch(`/policies/${policyId}`);
        if (response.ok) {
          policy = await response.json();
        } else {
          // Fallback to dummy policy
          policy = generateDummyPolicy(policyId);
        }
      } catch (e) {
        console.warn('Policy API failed:', e);
        policy = generateDummyPolicy(policyId);
      }

      // Initialize edit data
      editPolicy = {
        name: policy.name,
        description: policy.description,
        enabled: policy.enabled,
        policy: { ...policy.policy }
      };
    } catch (error) {
      console.error('Failed to load policy:', error);
      // Redirect back to policies list if not found
      goto('/policy');
    } finally {
      loading = false;
    }
  }

  function generateDummyPolicy(id) {
    const dummyPolicies = {
      'pol_001': {
        policyId: 'pol_001',
        name: 'Production Data Access',
        description: 'Standard access controls for production datasets',
        enabled: true,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'access_control',
        policy: {
          minConfs: 6,
          classificationAllowList: ['public', 'internal'],
          allowRecalled: false,
          maxLineageDepth: 10,
          minProducerUptime: 95.0,
          maxDataAgeSeconds: 30 * 24 * 60 * 60
        }
      },
      'pol_002': {
        policyId: 'pol_002',
        name: 'PII Protection Policy',
        description: 'Privacy controls for personally identifiable information',
        enabled: true,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'privacy',
        policy: {
          minConfs: 6,
          allowRecalled: false,
          piiFlagsBlockList: ['has_personal_info', 'has_contact_details'],
          minAnonymizationLevel: { type: 'k-anon', k: 5 },
          blockIfInThreatFeed: true,
          requiresBillingAccount: true
        }
      },
      'pol_003': {
        policyId: 'pol_003',
        name: 'ML Model Validation',
        description: 'Quality and bias checks for machine learning models',
        enabled: false,
        createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'mlops',
        policy: {
          minConfs: 6,
          allowRecalled: false,
          maxBiasScore: 0.2,
          maxDriftScore: 0.15,
          requiresValidSplit: true,
          minUniquenessRatio: 0.95,
          maxNullValuePercentage: 5.0,
          requiredFeatureSetId: 'ml-features-v2'
        }
      }
    };

    return dummyPolicies[id] || {
      policyId: id,
      name: 'Unknown Policy',
      description: 'Policy not found',
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'unknown',
      policy: {}
    };
  }

  async function savePolicy() {
    saving = true;
    try {
      // Try to save via API
      await fetch(`/policies/${policyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPolicy)
      });

      // Update local policy data
      policy = {
        ...policy,
        ...editPolicy,
        updatedAt: new Date().toISOString()
      };

      editing = false;
    } catch (error) {
      console.error('Failed to save policy:', error);
      alert('Failed to save policy. Please try again.');
    } finally {
      saving = false;
    }
  }

  async function deletePolicy() {
    if (!confirm(`Are you sure you want to delete the policy "${policy.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await fetch(`/policies/${policyId}`, {
        method: 'DELETE'
      });
      goto('/policy');
    } catch (error) {
      console.error('Failed to delete policy:', error);
      alert('Failed to delete policy. Please try again.');
    }
  }

  function cancelEdit() {
    editPolicy = {
      name: policy.name,
      description: policy.description,
      enabled: policy.enabled,
      policy: { ...policy.policy }
    };
    editing = false;
  }

  function updateArrayValue(key, value) {
    if (typeof value === 'string') {
      editPolicy.policy[key] = value.split(',').map(v => v.trim()).filter(v => v);
    } else {
      editPolicy.policy[key] = value;
    }
  }

  function updateObjectValue(key, value) {
    try {
      editPolicy.policy[key] = JSON.parse(value);
    } catch (e) {
      // Keep as string if parsing fails
      editPolicy.policy[key] = value;
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
  }

  function formatValue(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  function getStatusColor(enabled) {
    return enabled ? 'status-success' : 'status-error';
  }
</script>

<svelte:head>
  <title>{policy ? policy.name : 'Loading...'} - Policy Details</title>
</svelte:head>

<div class="policy-detail">
  {#if loading}
    <div class="loading-state">
      <div class="spinner large">⚪</div>
      <p>Loading policy details...</p>
    </div>
  {:else if policy}
    <!-- Header -->
    <div class="header-section">
      <div class="header-content">
        <div class="breadcrumb">
          <a href="/policy">🛡️ Policies</a> / <span>{policy.name}</span>
        </div>

        <div class="policy-header">
          <div class="policy-title">
            <h1>{policy.name}</h1>
            <div class="policy-meta">
              <span class="status {getStatusColor(policy.enabled)}">
                {policy.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
              <span class="policy-id">ID: <code>{policy.policyId}</code></span>
            </div>
          </div>

          <div class="header-actions">
            {#if editing}
              <button class="btn secondary" on:click={cancelEdit} disabled={saving}>
                Cancel
              </button>
              <button class="btn primary" on:click={savePolicy} disabled={saving}>
                {#if saving}
                  <span class="spinner">⚪</span>
                  Saving...
                {:else}
                  Save Changes
                {/if}
              </button>
            {:else}
              <button class="btn secondary" on:click={() => editing = true}>
                ✏️ Edit Policy
              </button>
              <button class="btn danger" on:click={deletePolicy}>
                🗑️ Delete
              </button>
            {/if}
          </div>
        </div>

        <p class="policy-description">{policy.description}</p>
      </div>
    </div>

    <!-- Policy Content -->
    <div class="policy-content">
      <!-- Basic Settings -->
      <div class="section">
        <h2>Basic Settings</h2>

        {#if editing}
          <div class="form-grid">
            <div class="form-group">
              <label>Policy Name</label>
              <input type="text" bind:value={editPolicy.name} />
            </div>

            <div class="form-group">
              <label>Status</label>
              <select bind:value={editPolicy.enabled}>
                <option value={true}>Enabled</option>
                <option value={false}>Disabled</option>
              </select>
            </div>

            <div class="form-group full-width">
              <label>Description</label>
              <textarea bind:value={editPolicy.description} rows="3"></textarea>
            </div>
          </div>
        {:else}
          <div class="info-grid">
            <div class="info-item">
              <label>Created</label>
              <span>{formatDate(policy.createdAt)}</span>
            </div>
            <div class="info-item">
              <label>Last Updated</label>
              <span>{formatDate(policy.updatedAt)}</span>
            </div>
            <div class="info-item">
              <label>Rules Count</label>
              <span>{Object.keys(policy.policy).length} rules configured</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Policy Rules -->
      <div class="section">
        <h2>Policy Rules</h2>

        {#each Object.entries(ruleCategories) as [categoryName, rules]}
          {#if rules.some(rule => policy.policy.hasOwnProperty(rule.key) || editing)}
            <div class="rule-category">
              <h3>{categoryName}</h3>

              <div class="rules-grid">
                {#each rules as rule}
                  {#if policy.policy.hasOwnProperty(rule.key) || editing}
                    <div class="rule-item">
                      <div class="rule-header">
                        <label>{rule.label}</label>
                        <span class="rule-description">{rule.description}</span>
                      </div>

                      {#if editing}
                        <div class="rule-input">
                          {#if rule.type === 'boolean'}
                            <select bind:value={editPolicy.policy[rule.key]}>
                              <option value={true}>True</option>
                              <option value={false}>False</option>
                              <option value={undefined}>Not Set</option>
                            </select>
                          {:else if rule.type === 'number'}
                            <input type="number" bind:value={editPolicy.policy[rule.key]} />
                          {:else if rule.type === 'array'}
                            <input
                              type="text"
                              value={formatValue(editPolicy.policy[rule.key] || [])}
                              on:input={(e) => updateArrayValue(rule.key, e.target.value)}
                              placeholder="Comma-separated values"
                            />
                          {:else if rule.type === 'object'}
                            <textarea
                              value={formatValue(editPolicy.policy[rule.key] || {})}
                              on:input={(e) => updateObjectValue(rule.key, e.target.value)}
                              rows="3"
                              placeholder="JSON object"
                            ></textarea>
                          {:else}
                            <input type="text" bind:value={editPolicy.policy[rule.key]} />
                          {/if}
                        </div>
                      {:else}
                        <div class="rule-value">
                          <code>{formatValue(policy.policy[rule.key])}</code>
                        </div>
                      {/if}
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}
        {/each}

        {#if Object.keys(policy.policy).length === 0}
          <div class="empty-rules">
            <p>No rules configured for this policy.</p>
            {#if !editing}
              <button class="btn primary" on:click={() => editing = true}>
                Configure Rules
              </button>
            {/if}
          </div>
        {/if}
      </div>

      <!-- JSON View -->
      <div class="section">
        <h2>Raw Policy JSON</h2>
        <div class="json-view">
          <pre><code>{JSON.stringify(editing ? editPolicy.policy : policy.policy, null, 2)}</code></pre>
        </div>
      </div>
    </div>
  {:else}
    <div class="error-state">
      <h1>Policy Not Found</h1>
      <p>The requested policy could not be found.</p>
      <a href="/policy" class="btn primary">← Back to Policies</a>
    </div>
  {/if}
</div>

<style>
  .policy-detail {
    max-width: 1200px;
    margin: 0 auto;
  }

  .loading-state, .error-state {
    text-align: center;
    padding: 60px 20px;
  }

  .loading-state p, .error-state p {
    color: #8b949e;
    margin-top: 16px;
  }

  .error-state h1 {
    color: #ffffff;
    margin-bottom: 8px;
  }

  .header-section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 20px;
  }

  .breadcrumb {
    margin-bottom: 16px;
  }

  .breadcrumb a {
    color: #58a6ff;
    text-decoration: none;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  .breadcrumb span {
    color: #8b949e;
  }

  .policy-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .policy-title h1 {
    font-size: 28px;
    font-weight: 600;
    color: #ffffff;
    margin: 0 0 8px 0;
  }

  .policy-meta {
    display: flex;
    align-items: center;
    gap: 12px;
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

  .policy-id {
    font-size: 13px;
    color: #6e7681;
  }

  .policy-id code {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }

  .policy-description {
    color: #8b949e;
    line-height: 1.5;
    margin: 0;
  }

  .policy-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
  }

  .section h2 {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    margin: 0 0 20px 0;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-group.full-width {
    grid-column: 1 / -1;
  }

  .form-group label {
    margin-bottom: 8px;
    color: #f0f6fc;
    font-weight: 600;
    font-size: 14px;
  }

  .form-group input, .form-group select, .form-group textarea {
    padding: 8px 12px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
    border-color: #1f6feb;
    outline: none;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
  }

  .info-item label {
    font-weight: 600;
    color: #f0f6fc;
    font-size: 14px;
    margin-bottom: 4px;
  }

  .info-item span {
    color: #8b949e;
    font-size: 14px;
  }

  .rule-category {
    margin-bottom: 32px;
  }

  .rule-category h3 {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    margin: 0 0 16px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid #30363d;
  }

  .rules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
  }

  .rule-item {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
  }

  .rule-header {
    margin-bottom: 12px;
  }

  .rule-header label {
    font-weight: 600;
    color: #f0f6fc;
    font-size: 14px;
    display: block;
    margin-bottom: 4px;
  }

  .rule-description {
    color: #8b949e;
    font-size: 12px;
    line-height: 1.4;
  }

  .rule-input input, .rule-input select, .rule-input textarea {
    width: 100%;
    padding: 6px 8px;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #f0f6fc;
    font-size: 13px;
  }

  .rule-input input:focus, .rule-input select:focus, .rule-input textarea:focus {
    border-color: #1f6feb;
    outline: none;
  }

  .rule-value code {
    background: rgba(255, 255, 255, 0.1);
    color: #f0f6fc;
    padding: 6px 8px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
    font-size: 13px;
    display: block;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .empty-rules {
    text-align: center;
    padding: 40px 20px;
    color: #8b949e;
  }

  .json-view {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
    overflow-x: auto;
  }

  .json-view pre {
    margin: 0;
    color: #f0f6fc;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
    font-size: 13px;
    line-height: 1.4;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    border: none;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
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

  .btn.danger {
    background: #da3633;
    color: white;
  }

  .btn.danger:hover:not(:disabled) {
    background: #f85149;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  @media (max-width: 768px) {
    .policy-header {
      flex-direction: column;
      gap: 16px;
    }

    .header-actions {
      width: 100%;
      justify-content: stretch;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .rules-grid {
      grid-template-columns: 1fr;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>