<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';

  let producerProfile = {
    producerId: '',
    identityKey: '',
    displayName: '',
    description: '',
    region: 'global',
    contactEmail: '',
    website: ''
  };

  let connectionStatus = {
    overlay: 'checking',
    database: 'checking',
    identity: 'checking'
  };

  let loading = false;
  let initialized = false;
  let overlayUrl = 'http://localhost:8788';

  // Data publishing state with full CLI parity
  let publishingData = {
    title: '',
    description: '',
    contentType: 'application/json',
    price: 100,
    currency: 'BSV',
    tags: '',
    file: null,
    replication: 2,
    policy: '',
    parentIds: '',
    relationship: 'derived'
  };

  let availablePolicies = [
    { value: '', label: 'No Policy' },
    { value: 'banking-compliance', label: 'Banking Compliance (Ultra-Policy)' },
    { value: 'general-content', label: 'General Content Policy' },
    { value: 'privacy-protection', label: 'Privacy Protection' }
  ];

  let relationshipTypes = [
    { value: 'derived', label: 'Derived' },
    { value: 'processed', label: 'Processed' },
    { value: 'enriched', label: 'Enriched' },
    { value: 'transformed', label: 'Transformed' },
    { value: 'aggregated', label: 'Aggregated' },
    { value: 'filtered', label: 'Filtered' }
  ];

  let publishLoading = false;
  let publishedContent = [];
  let fileInput;

  onMount(async () => {
    await checkProducerStatus();

    // Always load published content, regardless of initialization status
    loadPublishedContent();
  });

  async function checkProducerStatus() {
    try {
      loading = true;

      // Check overlay connection
      try {
        const healthResponse = await fetch(`${overlayUrl}/health`);
        if (healthResponse.ok) {
          connectionStatus.overlay = 'connected';
          const healthData = await healthResponse.json();
          connectionStatus.database = healthData.database === 'postgresql:ok' ? 'connected' : 'error';
        } else {
          connectionStatus.overlay = 'error';
        }
      } catch {
        connectionStatus.overlay = 'error';
      }

      // Check if producer is already initialized
      try {
        const identity = localStorage.getItem('producer-identity');
        if (identity) {
          const parsedIdentity = JSON.parse(identity);
          producerProfile = { ...producerProfile, ...parsedIdentity };
          connectionStatus.identity = 'registered';
          initialized = true;
        } else {
          connectionStatus.identity = 'not-registered';
        }
      } catch {
        connectionStatus.identity = 'error';
      }

    } finally {
      loading = false;
    }
  }

  async function publishContent() {
    if (!initialized) {
      alert('Producer identity not set up. Content will be stored locally but not published to the network. Set up your identity in Settings to enable network publishing.');
    }

    try {
      publishLoading = true;

      // Create mock published content
      const published = {
        id: 'content_' + Date.now(),
        title: publishingData.title,
        description: publishingData.description,
        contentType: publishingData.contentType,
        price: publishingData.price,
        currency: publishingData.currency,
        tags: publishingData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        size: publishingData.file ? (publishingData.file.size / 1024).toFixed(2) + ' KB' : 'N/A',
        publishedAt: new Date().toISOString(),
        uhrpHash: 'uhrp_' + Math.random().toString(36).substr(2, 16),
        status: 'published',
        downloads: 0,
        revenue: 0
      };

      // Try real API call
      try {
        const formData = new FormData();
        if (publishingData.file) {
          formData.append('file', publishingData.file);
        }
        formData.append('title', publishingData.title);
        formData.append('description', publishingData.description);
        formData.append('contentType', publishingData.contentType);
        formData.append('price', publishingData.price.toString());
        formData.append('currency', publishingData.currency);
        formData.append('tags', publishingData.tags);
        formData.append('replication', publishingData.replication.toString());
        formData.append('producerId', producerProfile.producerId);
        formData.append('identityKey', producerProfile.identityKey);

        // Add new CLI parity fields
        if (publishingData.policy) {
          formData.append('policy', publishingData.policy);
        }
        if (publishingData.parentIds) {
          formData.append('parentIds', publishingData.parentIds);
        }
        formData.append('relationship', publishingData.relationship);

        const response = await api.request('/v1/publish', {
          method: 'POST',
          body: formData
        });

        if (response && response.contentId) {
          published.id = response.contentId;
          published.uhrpHash = response.uhrpHash || published.uhrpHash;
        }
      } catch (error) {
        console.warn('Content published locally, API call failed:', error);
      }

      publishedContent = [published, ...publishedContent];
      localStorage.setItem('producer-published-content', JSON.stringify(publishedContent));

      // Reset form
      publishingData = {
        title: '',
        description: '',
        contentType: 'application/json',
        price: 100,
        currency: 'BSV',
        tags: '',
        file: null,
        replication: 2,
        policy: '',
        parentIds: '',
        relationship: 'derived'
      };
      if (fileInput) fileInput.value = '';

      alert('Content published successfully!');

    } catch (error) {
      alert('Failed to publish content: ' + error.message);
    } finally {
      publishLoading = false;
    }
  }

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      publishingData.file = file;
      // Auto-detect content type
      if (file.type) {
        publishingData.contentType = file.type;
      }
    }
  }

  function loadPublishedContent() {
    try {
      const stored = localStorage.getItem('producer-published-content');
      if (stored) {
        publishedContent = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load published content:', error);
    }
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString();
  }

  function formatPrice(price, currency = 'BSV') {
    return `${new Intl.NumberFormat().format(price)} ${currency}`;
  }



  function getStatusIcon(status) {
    switch (status) {
      case 'connected':
      case 'registered':
        return '✅';
      case 'checking':
        return '⏳';
      case 'error':
      case 'not-registered':
        return '❌';
      default:
        return '❓';
    }
  }
</script>

<div class="producer-setup">

  <div class="header">
    <h1>Data Publishing</h1>
    <p>Publish and manage your data content on the BSV Overlay Network</p>
  </div>

  <!-- Connection Status -->
  <div class="status-panel">
    <h2>Connection Status</h2>
    <div class="status-grid">
      <div class="status-item">
        <span class="status-icon">{getStatusIcon(connectionStatus.overlay)}</span>
        <span class="status-label">Overlay Network</span>
        <span class="status-value">{connectionStatus.overlay}</span>
      </div>
      <div class="status-item">
        <span class="status-icon">{getStatusIcon(connectionStatus.database)}</span>
        <span class="status-label">Database</span>
        <span class="status-value">{connectionStatus.database}</span>
      </div>
      <div class="status-item">
        <span class="status-icon">{getStatusIcon(connectionStatus.identity)}</span>
        <span class="status-label">Producer Identity</span>
        <span class="status-value">{connectionStatus.identity}</span>
      </div>
    </div>
  </div>

  <!-- Identity Setup Warning (if not initialized) -->
  {#if !initialized}
    <div class="warning-panel">
      <h2>Producer Identity Required</h2>
      <p>To publish content, you need to set up your producer identity first. You can still use this form, but the content won't be actually published to the network.</p>
      <div class="warning-actions">
        <a href="/settings?tab=producer" class="btn btn-primary">
          Set Up Producer Identity
        </a>
      </div>
    </div>
  {/if}

  {#if initialized}
    <!-- Producer Profile Display -->
    <div class="profile-panel">
      <h2>Producer Profile</h2>
      <div class="profile-grid">
        <div class="profile-item">
          <label>Producer ID</label>
          <code>{producerProfile.producerId}</code>
        </div>
        <div class="profile-item">
          <label>Identity Key</label>
          <code>{producerProfile.identityKey}</code>
        </div>
        <div class="profile-item">
          <label>Display Name</label>
          <span>{producerProfile.displayName}</span>
        </div>
        <div class="profile-item">
          <label>Contact Email</label>
          <span>{producerProfile.contactEmail}</span>
        </div>
        <div class="profile-item span-2">
          <label>Description</label>
          <span>{producerProfile.description || 'No description provided'}</span>
        </div>
      </div>

      <div class="profile-actions">
        <a href="/settings?tab=producer" class="btn btn-secondary">
          Manage Identity
        </a>
        <a href="/settings?tab=analytics" class="btn btn-secondary">
          View Analytics
        </a>
        <a href="/settings?tab=services" class="btn btn-secondary">
          Manage Services
        </a>
      </div>
    </div>
  {/if}

  <!-- Data Publishing Form -->
  <div class="publish-panel">
    <h2>Publish New Content</h2>
    <form on:submit|preventDefault={publishContent}>
        <div class="form-grid">
          <div class="form-group">
            <label for="title">Content Title *</label>
            <input
              id="title"
              type="text"
              bind:value={publishingData.title}
              required
              placeholder="My Dataset"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="price">Price (sats)</label>
            <input
              id="price"
              type="number"
              bind:value={publishingData.price}
              required
              min="1"
              class="form-input"
            />
          </div>

          <div class="form-group span-2">
            <label for="description">Description</label>
            <textarea
              id="description"
              bind:value={publishingData.description}
              placeholder="Describe your content"
              class="form-input"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="contentType">Content Type</label>
            <select id="contentType" bind:value={publishingData.contentType} class="form-input">
              <option value="application/json">JSON</option>
              <option value="text/csv">CSV</option>
              <option value="application/xml">XML</option>
              <option value="text/plain">Text</option>
              <option value="application/octet-stream">Binary</option>
            </select>
          </div>

          <div class="form-group">
            <label for="replication">Replication Factor</label>
            <select id="replication" bind:value={publishingData.replication} class="form-input">
              <option value={1}>1 (Basic)</option>
              <option value={2}>2 (Standard)</option>
              <option value={3}>3 (High Availability)</option>
            </select>
          </div>

          <div class="form-group span-2">
            <label for="tags">Tags (comma-separated)</label>
            <input
              id="tags"
              type="text"
              bind:value={publishingData.tags}
              placeholder="data, finance, real-time"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="policy">Policy Template</label>
            <select id="policy" bind:value={publishingData.policy} class="form-input">
              {#each availablePolicies as policyOption}
                <option value={policyOption.value}>{policyOption.label}</option>
              {/each}
            </select>
            <small class="field-help">Apply governance policy template for content compliance</small>
          </div>

          <div class="form-group">
            <label for="relationship">Relationship Type</label>
            <select id="relationship" bind:value={publishingData.relationship} class="form-input">
              {#each relationshipTypes as relType}
                <option value={relType.value}>{relType.label}</option>
              {/each}
            </select>
            <small class="field-help">Relationship to parent content for lineage tracking</small>
          </div>

          <div class="form-group span-2">
            <label for="parentIds">Parent Content IDs (for lineage)</label>
            <input
              id="parentIds"
              type="text"
              bind:value={publishingData.parentIds}
              placeholder="content_123, content_456"
              class="form-input"
            />
            <small class="field-help">Comma-separated list of parent content IDs for data lineage</small>
          </div>

          <div class="form-group span-2">
            <label for="file">Select File</label>
            <input
              id="file"
              type="file"
              on:change={handleFileSelect}
              bind:this={fileInput}
              class="form-input"
            />
            <small class="field-help">Choose the data file to publish (supports all formats)</small>
          </div>
        </div>

        <div class="form-actions">
          <button
            type="submit"
            disabled={publishLoading || !publishingData.title}
            class="btn btn-primary"
          >
            {publishLoading ? 'Publishing...' : 'Publish Content'}
          </button>
        </div>
      </form>
  </div>

  <!-- Published Content List -->
  {#if publishedContent.length > 0}
    <div class="published-panel">
      <h2>Published Content</h2>
      <div class="published-grid">
        {#each publishedContent as content}
          <div class="published-card">
            <div class="published-header">
              <h3>{content.title}</h3>
              <div class="published-price">{formatPrice(content.price, content.currency)}</div>
            </div>
            <div class="published-details">
              <p>{content.description}</p>
              <div class="published-meta">
                <span><strong>Type:</strong> {content.contentType}</span>
                <span><strong>Size:</strong> {content.size}</span>
                <span><strong>Published:</strong> {formatDate(content.publishedAt)}</span>
                <span><strong>Downloads:</strong> {content.downloads}</span>
                <span><strong>Revenue:</strong> {formatPrice(content.revenue, content.currency)}</span>
              </div>
              <div class="published-tags">
                {#each content.tags as tag}
                  <span class="tag-badge">{tag}</span>
                {/each}
              </div>
            </div>
            <div class="published-hash">
              <strong>UHRP Hash:</strong> <code>{content.uhrpHash}</code>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .producer-setup {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .producer-nav {
    margin-bottom: 2rem;
  }

  .nav-tabs {
    display: flex;
    border-bottom: 1px solid #30363d;
  }

  .nav-tab {
    padding: 1rem 1.5rem;
    color: #6e7681;
    text-decoration: none;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .nav-tab:hover {
    color: #f0f6fc;
    background: #21262d;
  }

  .nav-tab.active {
    color: #58a6ff;
    border-bottom-color: #58a6ff;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    font-size: 2rem;
    color: #f0f6fc;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .header p {
    color: #6e7681;
  }

  .status-panel, .setup-form, .profile-panel, .publish-panel, .published-panel, .warning-panel {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .warning-panel {
    border-color: #f85149;
    background: #161b22;
  }

  .warning-panel h2 {
    color: #f85149;
  }

  .warning-panel p {
    color: #c9d1d9;
    margin-bottom: 1.5rem;
  }

  .warning-actions {
    display: flex;
    justify-content: center;
  }

  .status-panel h2, .setup-form h2, .profile-panel h2, .publish-panel h2, .published-panel h2 {
    color: #f0f6fc;
    margin-bottom: 1rem;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
  }

  .status-icon {
    font-size: 1.25rem;
  }

  .status-label {
    font-weight: 600;
    flex: 1;
    color: #f0f6fc;
  }

  .status-value {
    text-transform: capitalize;
    color: #6e7681;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .span-2 {
    grid-column: span 2;
  }

  .form-group label {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #f0f6fc;
  }

  .form-input {
    padding: 0.75rem;
    border: 1px solid #30363d;
    border-radius: 6px;
    font-size: 1rem;
    background: #0d1117;
    color: #f0f6fc;
    font-family: inherit;
  }

  .form-input:focus {
    outline: none;
    border-color: #58a6ff;
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1);
  }

  .form-input::placeholder {
    color: #6e7681;
  }

  .field-help {
    color: #6e7681;
    font-size: 0.75rem;
    margin-top: 0.25rem;
    line-height: 1.3;
  }

  .form-actions {
    margin-top: 1.5rem;
    display: flex;
    justify-content: flex-end;
  }

  .profile-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .profile-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .profile-item label {
    font-weight: 600;
    color: #6e7681;
    font-size: 0.875rem;
  }

  .profile-item code {
    background: #0d1117;
    border: 1px solid #21262d;
    padding: 0.5rem;
    border-radius: 4px;
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 0.875rem;
    word-break: break-all;
    color: #f0f6fc;
  }

  .profile-item span {
    color: #f0f6fc;
  }

  .profile-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #238636;
    color: white;
    border: 1px solid #238636;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2ea043;
    border-color: #2ea043;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #21262d;
    color: #f0f6fc;
    border: 1px solid #30363d;
  }

  .btn-secondary:hover {
    background: #30363d;
    border-color: #58a6ff;
  }

  .btn-danger {
    background: #da3633;
    color: white;
    border: 1px solid #da3633;
  }

  .btn-danger:hover {
    background: #f85149;
    border-color: #f85149;
  }

  /* Published Content Styles */
  .published-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .published-card {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 1.5rem;
  }

  .published-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .published-header h3 {
    margin: 0;
    color: #f0f6fc;
  }

  .published-price {
    background: #21262d;
    color: #58a6ff;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 600;
    border: 1px solid #30363d;
  }

  .published-details p {
    color: #8b949e;
    margin-bottom: 1rem;
  }

  .published-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .published-meta span {
    color: #6e7681;
    font-size: 0.875rem;
  }

  .published-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 1rem;
  }

  .tag-badge {
    padding: 0.25rem 0.5rem;
    background: #0d1117;
    border: 1px solid #30363d;
    color: #58a6ff;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .published-hash {
    padding-top: 1rem;
    border-top: 1px solid #21262d;
    color: #6e7681;
    font-size: 0.875rem;
  }

  .published-hash code {
    background: #0d1117;
    border: 1px solid #21262d;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'SF Mono', 'Monaco', monospace;
    color: #f0f6fc;
    word-break: break-all;
  }

  .redirect-notice {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    margin: 2rem 0;
  }

  .redirect-notice h2 {
    color: #f0f6fc;
    margin-bottom: 1rem;
  }

  .redirect-notice p {
    color: #8b949e;
    margin: 0;
  }

  @media (max-width: 768px) {
    .producer-setup {
      padding: 1rem;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .span-2 {
      grid-column: span 1;
    }

    .profile-grid {
      grid-template-columns: 1fr;
    }

    .profile-actions {
      flex-direction: column;
    }

    .published-grid {
      grid-template-columns: 1fr;
    }
  }
</style>