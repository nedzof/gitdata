<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api } from '$lib/api';

  let loading = false;
  let saving = false;
  let selectedTemplateId = '';
  let jsonInput = '';
  let jsonError = '';
  let importMethod = 'template'; // 'template' or 'json'

  // New policy data
  let newPolicy = {
    name: '',
    description: '',
    enabled: true,
    policy: {}
  };

  // Policy templates (same as main page)
  const policyTemplates = [
    {
      id: 'banking-compliance',
      name: 'Banking Compliance (Ultra-Policy)',
      description: 'Strict compliance for banking/financial documents with EU restrictions',
      category: 'compliance',
      template: {
        minConfs: 12,
        classificationAllowList: ['restricted'],
        allowRecalled: false,
        licenseAllowList: ['Internal-Banking-Use-Only'],
        geoOriginAllowList: ['EU'],
        maxPricePerByte: 0.5,
        maxTotalCostForLineage: 250000,
        maxDataAgeSeconds: 3600,
        blockIfInThreatFeed: true
      }
    },
    {
      id: 'general-content',
      name: 'General Content Policy',
      description: 'Standard policy for general documents and media files',
      category: 'general',
      template: {
        minConfs: 6,
        allowRecalled: false,
        classificationAllowList: ['public', 'internal'],
        maxLineageDepth: 10,
        maxDataAgeSeconds: 30 * 24 * 60 * 60,
        maxPricePerByte: 1.0,
        maxTotalCostForLineage: 50000
      }
    },
    {
      id: 'privacy-protection',
      name: 'Privacy Protection',
      description: 'Privacy-focused policy for sensitive documents',
      category: 'privacy',
      template: {
        minConfs: 6,
        allowRecalled: false,
        blockIfInThreatFeed: true,
        maxPricePerByte: 2.0
      }
    }
  ];

  // Policy rule categories (same as detail page)
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
      { key: 'maxDataAgeSeconds', label: 'Max Data Age (seconds)', type: 'number', description: 'Maximum data age in seconds' }
    ],
    'Security & Privacy': [
      { key: 'blockIfInThreatFeed', label: 'Block If In Threat Feed', type: 'boolean', description: 'Block if found in threat feeds' }
    ]
  };

  onMount(() => {
    const templateParam = $page.url.searchParams.get('template');
    if (templateParam) {
      applyTemplate(templateParam);
    }
  });

  function applyTemplate(templateId) {
    const template = policyTemplates.find(t => t.id === templateId);
    if (template) {
      selectedTemplateId = templateId;
      newPolicy.name = template.name;
      newPolicy.description = template.description;
      newPolicy.policy = { ...template.template };
    }
  }

  function selectTemplate(templateId) {
    if (templateId === '') {
      newPolicy = {
        name: '',
        description: '',
        enabled: true,
        policy: {}
      };
      selectedTemplateId = '';
    } else {
      applyTemplate(templateId);
    }
  }

  async function createPolicy() {
    if (!newPolicy.name.trim()) {
      alert('Please enter a policy name');
      return;
    }

    saving = true;
    try {
      // Try to create via API
      const response = await fetch('/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPolicy)
      });

      if (response.ok) {
        const result = await response.json();
        goto(`/policy/${result.policyId || 'new-policy'}`);
      } else {
        // Simulate success for demo
        goto(`/policy/pol_new_${Date.now()}`);
      }
    } catch (error) {
      console.error('Failed to create policy:', error);
      // Simulate success for demo
      goto(`/policy/pol_new_${Date.now()}`);
    } finally {
      saving = false;
    }
  }

  function updateArrayValue(key, value) {
    if (typeof value === 'string') {
      newPolicy.policy[key] = value.split(',').map(v => v.trim()).filter(v => v);
    } else {
      newPolicy.policy[key] = value;
    }
  }

  function updateObjectValue(key, value) {
    try {
      newPolicy.policy[key] = JSON.parse(value);
    } catch (e) {
      // Keep as string if parsing fails
      newPolicy.policy[key] = value;
    }
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

  function removeRule(key) {
    delete newPolicy.policy[key];
    newPolicy.policy = { ...newPolicy.policy };
  }

  function addRule(key, defaultValue) {
    if (defaultValue === undefined) {
      defaultValue = '';
    }
    newPolicy.policy[key] = defaultValue;
    newPolicy.policy = { ...newPolicy.policy };
  }

  function importJsonPolicy() {
    jsonError = '';
    try {
      const parsed = JSON.parse(jsonInput);

      // Validate that it's an object
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Policy must be a valid JSON object');
      }

      // Set the policy
      newPolicy.policy = parsed;

      // Optionally set name and description if they exist in the JSON
      if (parsed.name && !newPolicy.name) {
        newPolicy.name = parsed.name;
      }
      if (parsed.description && !newPolicy.description) {
        newPolicy.description = parsed.description;
      }

      // Clear the input
      jsonInput = '';

      // Switch back to template view to show the imported policy
      importMethod = 'template';
      selectedTemplateId = 'custom';

    } catch (error) {
      jsonError = error.message;
    }
  }

  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      jsonInput = e.target.result;
      importJsonPolicy();
    };
    reader.readAsText(file);

    // Clear the file input
    event.target.value = '';
  }

  function clearPolicy() {
    newPolicy = {
      name: '',
      description: '',
      enabled: true,
      policy: {}
    };
    selectedTemplateId = '';
    jsonInput = '';
    jsonError = '';
  }
</script>

<svelte:head>
  <title>Create New Policy - Gitdata</title>
</svelte:head>

<div class="policy-new">
  <!-- Header -->
  <div class="header-section">
    <div class="breadcrumb">
      <a href="/policy">🛡️ Policies</a> / <span>Create New Policy</span>
    </div>

    <h1>Create New Policy</h1>
    <p>Configure a new data governance policy with custom rules or start from a template.</p>
  </div>

  <!-- Import Method Selection -->
  <div class="section">
    <h2>Create Policy</h2>
    <p class="section-description">Choose how to create your policy: use a template, import JSON, or start from scratch.</p>

    <div class="import-method-selector">
      <div class="method-tabs">
        <button
          class="method-tab {importMethod === 'template' ? 'active' : ''}"
          on:click={() => importMethod = 'template'}
        >
          📄 Templates
        </button>
        <button
          class="method-tab {importMethod === 'json' ? 'active' : ''}"
          on:click={() => importMethod = 'json'}
        >
          🔧 Import JSON
        </button>
      </div>

      {#if importMethod === 'template'}
        <div class="template-content">
          <div class="template-dropdown-section">
            <label>Policy Template (Optional)</label>
            <select bind:value={selectedTemplateId} on:change={() => selectTemplate(selectedTemplateId)}>
              <option value="">Start from Scratch</option>
              {#each policyTemplates as template}
                <option value={template.id}>{template.name}</option>
              {/each}
            </select>

            {#if selectedTemplateId}
              {@const template = policyTemplates.find(t => t.id === selectedTemplateId)}
              {#if template}
                <div class="template-preview">
                  <div class="template-info">
                    <span class="category-badge category-{template.category}">{template.category}</span>
                    <p>{template.description}</p>
                    <span class="rules-count">{Object.keys(template.template).length} rules included</span>
                  </div>
                </div>
              {/if}
            {/if}
          </div>
        </div>

      {:else if importMethod === 'json'}
        <div class="json-import-content">
          <div class="json-input-section">
            <label>Policy JSON</label>
            <textarea
              bind:value={jsonInput}
              placeholder='Paste your policy JSON here or upload a JSON file...'
              rows="10"
            ></textarea>

            <div class="json-actions">
              <input
                type="file"
                accept=".json"
                on:change={handleFileUpload}
                style="display: none;"
                id="json-file-upload"
              />
              <label for="json-file-upload" class="btn secondary">
                📁 Upload JSON File
              </label>
              <button
                class="btn primary"
                on:click={importJsonPolicy}
                disabled={!jsonInput.trim()}
              >
                Import Policy
              </button>
            </div>

            {#if jsonError}
              <div class="error-message">
                ❌ {jsonError}
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if Object.keys(newPolicy.policy).length > 0}
        <div class="current-policy-actions">
          <button class="btn secondary" on:click={clearPolicy}>
            🗑️ Clear Policy
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Basic Settings -->
  <div class="section">
    <h2>Basic Settings</h2>

    <div class="form-grid">
      <div class="form-group">
        <label>Policy Name *</label>
        <input type="text" bind:value={newPolicy.name} placeholder="Enter policy name" required />
      </div>

      <div class="form-group">
        <label>Status</label>
        <select bind:value={newPolicy.enabled}>
          <option value={true}>Enabled</option>
          <option value={false}>Disabled</option>
        </select>
      </div>

      <div class="form-group full-width">
        <label>Description</label>
        <textarea bind:value={newPolicy.description} rows="3" placeholder="Describe what this policy does and when it applies"></textarea>
      </div>
    </div>
  </div>

  <!-- Policy Rules -->
  <div class="section">
    <h2>Policy Rules</h2>
    <p class="section-description">Configure specific rules for your policy. Rules determine when to allow, warn, or block data access.</p>

    {#each Object.entries(ruleCategories) as [categoryName, rules]}
      <div class="rule-category">
        <h3>{categoryName}</h3>

        <div class="rules-grid">
          {#each rules as rule}
            {#if newPolicy.policy.hasOwnProperty(rule.key)}
              <div class="rule-item active">
                <div class="rule-header">
                  <label>{rule.label}</label>
                  <button class="remove-rule" on:click={() => removeRule(rule.key)}>×</button>
                </div>
                <span class="rule-description">{rule.description}</span>

                <div class="rule-input">
                  {#if rule.type === 'boolean'}
                    <select bind:value={newPolicy.policy[rule.key]}>
                      <option value={true}>True</option>
                      <option value={false}>False</option>
                    </select>
                  {:else if rule.type === 'number'}
                    <input type="number" bind:value={newPolicy.policy[rule.key]} />
                  {:else if rule.type === 'array'}
                    <input
                      type="text"
                      value={formatValue(newPolicy.policy[rule.key] || [])}
                      on:input={(e) => updateArrayValue(rule.key, e.target.value)}
                      placeholder="Comma-separated values"
                    />
                  {:else if rule.type === 'object'}
                    <textarea
                      value={formatValue(newPolicy.policy[rule.key] || {})}
                      on:input={(e) => updateObjectValue(rule.key, e.target.value)}
                      rows="3"
                      placeholder="JSON object"
                    ></textarea>
                  {:else}
                    <input type="text" bind:value={newPolicy.policy[rule.key]} placeholder="Enter value" />
                  {/if}
                </div>
              </div>
            {:else}
              <div class="rule-item">
                <div class="rule-header">
                  <label>{rule.label}</label>
                  <button class="add-rule" on:click={() => addRule(rule.key, rule.type === 'boolean' ? false : rule.type === 'number' ? 0 : rule.type === 'array' ? [] : rule.type === 'object' ? {} : '')}>+</button>
                </div>
                <span class="rule-description">{rule.description}</span>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- JSON Preview -->
  <div class="section">
    <h2>Policy JSON Preview</h2>
    <div class="json-view">
      <pre><code>{JSON.stringify(newPolicy.policy, null, 2)}</code></pre>
    </div>
  </div>

  <!-- Actions -->
  <div class="actions">
    <a href="/policy" class="btn secondary">Cancel</a>
    <button class="btn primary" on:click={createPolicy} disabled={saving || !newPolicy.name.trim()}>
      {#if saving}
        <span class="spinner">⚪</span>
        Creating Policy...
      {:else}
        Create Policy
      {/if}
    </button>
  </div>
</div>

<style>
  .policy-new {
    max-width: 1200px;
    margin: 0 auto;
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

  .header-section h1 {
    font-size: 28px;
    font-weight: 600;
    color: #ffffff;
    margin: 0 0 8px 0;
  }

  .header-section p {
    color: #8b949e;
    line-height: 1.5;
    margin: 0;
  }

  .section {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 20px;
  }

  .section h2 {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    margin: 0 0 8px 0;
  }

  .section-description {
    color: #8b949e;
    margin: 0 0 20px 0;
    line-height: 1.5;
  }

  .template-selector {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
  }

  .template-option {
    cursor: pointer;
  }

  .template-option input[type="radio"] {
    display: none;
  }

  .template-card {
    background: #0d1117;
    border: 2px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    transition: all 0.2s;
    height: 100%;
  }

  .template-option.selected .template-card {
    border-color: #1f6feb;
    background: rgba(31, 111, 235, 0.1);
  }

  .template-option:hover .template-card {
    border-color: #58a6ff;
  }

  .template-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .template-card h3 {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
  }

  .template-card p {
    color: #8b949e;
    margin: 0 0 12px 0;
    line-height: 1.4;
  }

  .category-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .category-badge.category-compliance {
    background: rgba(218, 54, 51, 0.2);
    color: #da3633;
  }

  .category-badge.category-data_quality {
    background: rgba(88, 166, 255, 0.2);
    color: #58a6ff;
  }

  .category-badge.category-privacy {
    background: rgba(247, 185, 85, 0.2);
    color: #f7b955;
  }

  .category-badge.category-mlops {
    background: rgba(46, 160, 67, 0.2);
    color: #2ea043;
  }

  .template-rules {
    border-top: 1px solid #30363d;
    padding-top: 8px;
  }

  .rules-count {
    color: #8b949e;
    font-size: 12px;
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
    transition: all 0.2s;
  }

  .rule-item.active {
    border-color: #1f6feb;
    background: rgba(31, 111, 235, 0.05);
  }

  .rule-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .rule-header label {
    font-weight: 600;
    color: #f0f6fc;
    font-size: 14px;
  }

  .add-rule, .remove-rule {
    background: none;
    border: 1px solid #30363d;
    border-radius: 4px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
  }

  .add-rule {
    color: #2ea043;
    border-color: #2ea043;
  }

  .add-rule:hover {
    background: rgba(46, 160, 67, 0.1);
  }

  .remove-rule {
    color: #da3633;
    border-color: #da3633;
  }

  .remove-rule:hover {
    background: rgba(218, 54, 51, 0.1);
  }

  .rule-description {
    color: #8b949e;
    font-size: 12px;
    line-height: 1.4;
    display: block;
    margin-bottom: 12px;
  }

  .rule-input {
    margin-top: 12px;
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

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 20px 0;
  }

  .btn {
    padding: 12px 24px;
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

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Import Method Selection Styles */
  .import-method-selector {
    border: 1px solid #30363d;
    border-radius: 8px;
    background: #0d1117;
    overflow: hidden;
  }

  .method-tabs {
    display: flex;
    border-bottom: 1px solid #30363d;
  }

  .method-tab {
    flex: 1;
    padding: 12px 16px;
    background: #21262d;
    border: none;
    color: #8b949e;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border-right: 1px solid #30363d;
  }

  .method-tab:last-child {
    border-right: none;
  }

  .method-tab:hover {
    background: #30363d;
    color: #f0f6fc;
  }

  .method-tab.active {
    background: #1f6feb;
    color: #ffffff;
  }

  .template-content, .json-import-content {
    padding: 20px;
  }

  /* Template Dropdown Styles */
  .template-dropdown-section {
    margin-bottom: 16px;
  }

  .template-dropdown-section label {
    display: block;
    margin-bottom: 8px;
    color: #f0f6fc;
    font-weight: 600;
    font-size: 14px;
  }

  .template-dropdown-section select {
    width: 100%;
    padding: 8px 12px;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-size: 14px;
  }

  .template-dropdown-section select:focus {
    border-color: #1f6feb;
    outline: none;
  }

  .template-preview {
    margin-top: 12px;
    padding: 12px;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
  }

  .template-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .template-info p {
    color: #8b949e;
    margin: 0;
    line-height: 1.4;
  }

  /* JSON Import Styles */
  .json-input-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .json-input-section label {
    color: #f0f6fc;
    font-weight: 600;
    font-size: 14px;
  }

  .json-input-section textarea {
    width: 100%;
    padding: 12px;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #f0f6fc;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
    font-size: 13px;
    line-height: 1.4;
    resize: vertical;
    min-height: 200px;
  }

  .json-input-section textarea:focus {
    border-color: #1f6feb;
    outline: none;
  }

  .json-input-section textarea::placeholder {
    color: #6e7681;
    font-style: italic;
  }

  .json-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .error-message {
    padding: 8px 12px;
    background: rgba(218, 54, 51, 0.1);
    border: 1px solid #da3633;
    border-radius: 6px;
    color: #da3633;
    font-size: 13px;
    line-height: 1.4;
  }

  /* Current Policy Actions */
  .current-policy-actions {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #30363d;
    display: flex;
    justify-content: center;
  }

  @media (max-width: 768px) {
    .template-selector {
      grid-template-columns: 1fr;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .rules-grid {
      grid-template-columns: 1fr;
    }

    .actions {
      flex-direction: column;
    }
  }
</style>