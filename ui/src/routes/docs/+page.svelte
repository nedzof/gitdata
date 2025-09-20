<svelte:head>
  <title>Documentation - Gitdata</title>
</svelte:head>

<div class="explorer">
  <h1>📚 Documentation</h1>
  <p class="subtitle">A trust layer for the AI economy</p>

  <div class="docs-grid">
    <!-- Quick Start -->
    <div class="docs-section">
      <h2>🚀 Quick Start</h2>
      <div class="docs-content">
        <p>Get started with Gitdata in minutes. Verify data trust and explore the AI economy.</p>
        <div class="quick-links">
          <a href="/catalog" class="link-card">
            <span class="link-icon">📋</span>
            <div>
              <strong>Browse Catalog</strong>
              <p>Discover available data and AI assets</p>
            </div>
          </a>
          <a href="/analysis" class="link-card">
            <span class="link-icon">📊</span>
            <div>
              <strong>Analyze Data</strong>
              <p>Visualize lineage and dependencies</p>
            </div>
          </a>
          <a href="/policy" class="link-card">
            <span class="link-icon">🛡️</span>
            <div>
              <strong>Configure Policies</strong>
              <p>Set up data governance rules</p>
            </div>
          </a>
        </div>
      </div>
    </div>

    <!-- API Reference -->
    <div class="docs-section">
      <h2>🔌 API Reference</h2>
      <div class="docs-content">
        <div class="api-endpoint">
          <h3>/ready</h3>
          <p>Check if a dataset meets specified policy requirements.</p>

          <div class="code-example">
            <h4>Request</h4>
            <div class="copy-code">
              <button class="copy-button" on:click={() => navigator.clipboard.writeText('GET /ready?versionId=TOXSIM-REPORT-12')}>
                Copy
              </button>
              <pre><code>GET /ready?versionId=TOXSIM-REPORT-12</code></pre>
            </div>
          </div>

          <div class="code-example">
            <h4>Response</h4>
            <div class="copy-code">
              <button class="copy-button" on:click={() => navigator.clipboard.writeText(JSON.stringify({ready: true, reason: "All policy conditions satisfied"}, null, 2))}>
                Copy
              </button>
              <pre><code>{JSON.stringify({
  ready: true,
  reason: "All policy conditions satisfied"
}, null, 2)}</code></pre>
            </div>
          </div>
        </div>

        <div class="api-endpoint">
          <h3>/data</h3>
          <p>Retrieve data listings and search functionality.</p>

          <div class="code-example">
            <h4>Request</h4>
            <div class="copy-code">
              <button class="copy-button" on:click={() => navigator.clipboard.writeText('GET /data?limit=10&offset=0&q=TOXSIM')}>
                Copy
              </button>
              <pre><code>GET /data?limit=10&offset=0&q=TOXSIM</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Usage Examples -->
    <div class="docs-section">
      <h2>💡 Usage Examples</h2>
      <div class="docs-content">
        <div class="example-group">
          <h3>Verify Data Trust</h3>
          <div class="copy-code">
            <button class="copy-button" on:click={() => navigator.clipboard.writeText('curl "http://localhost:8788/ready?versionId=TOXSIM-REPORT-12"')}>
              Copy
            </button>
            <pre><code>curl "http://localhost:8788/ready?versionId=TOXSIM-REPORT-12"</code></pre>
          </div>
        </div>

        <div class="example-group">
          <h3>Search Data</h3>
          <div class="copy-code">
            <button class="copy-button" on:click={() => navigator.clipboard.writeText('curl "http://localhost:8788/data?q=molecular&limit=5"')}>
              Copy
            </button>
            <pre><code>curl "http://localhost:8788/data?q=molecular&limit=5"</code></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Architecture -->
    <div class="docs-section">
      <h2>🏗️ Architecture</h2>
      <div class="docs-content">
        <p>Gitdata provides cryptographic verification of data lineage and enables secure data transactions between AI agents and humans.</p>

        <div class="architecture-grid">
          <div class="arch-component">
            <h4>🔗 Data Lineage</h4>
            <p>Track data flow and transformations using OpenLineage standard</p>
          </div>
          <div class="arch-component">
            <h4>🛡️ Policy Engine</h4>
            <p>Enforce governance rules and compliance requirements</p>
          </div>
          <div class="arch-component">
            <h4>🤖 Agent Integration</h4>
            <p>Connect AI agents for automated data processing</p>
          </div>
          <div class="arch-component">
            <h4>📊 Trust Verification</h4>
            <p>Cryptographic proof of data integrity and authenticity</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="actions">
    <a href="/" class="button">← Back to Home</a>
    <a href="/catalog" class="button primary">Explore Catalog →</a>
  </div>
</div>

<style>
  .subtitle {
    color: #8b949e;
    font-size: 16px;
    margin-bottom: 32px;
    font-family: system-ui, sans-serif;
  }

  .docs-grid {
    display: grid;
    gap: 32px;
    margin-bottom: 32px;
  }

  .docs-section {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 24px;
  }

  .docs-section h2 {
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .docs-content p {
    color: #8b949e;
    margin-bottom: 20px;
    line-height: 1.6;
  }

  .quick-links {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }

  .link-card {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 16px;
    text-decoration: none;
    color: #f0f6fc;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .link-card:hover {
    background: #30363d;
    border-color: #58a6ff;
    transform: translateY(-2px);
  }

  .link-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .link-card strong {
    color: #ffffff;
    font-size: 14px;
    display: block;
    margin-bottom: 4px;
  }

  .link-card p {
    color: #8b949e;
    font-size: 12px;
    margin: 0;
  }

  .api-endpoint {
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid #30363d;
  }

  .api-endpoint:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  .api-endpoint h3 {
    color: #58a6ff;
    font-size: 18px;
    margin: 0 0 8px 0;
    font-family: 'SF Mono', monospace;
  }

  .api-endpoint p {
    color: #8b949e;
    margin-bottom: 16px;
  }

  .code-example {
    margin: 16px 0;
  }

  .code-example h4 {
    color: #8b949e;
    font-size: 12px;
    margin: 0 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .example-group {
    margin-bottom: 24px;
  }

  .example-group h3 {
    color: #ffffff;
    font-size: 16px;
    margin: 0 0 12px 0;
  }

  .architecture-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-top: 20px;
  }

  .arch-component {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
  }

  .arch-component h4 {
    color: #ffffff;
    font-size: 14px;
    margin: 0 0 8px 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .arch-component p {
    color: #8b949e;
    font-size: 12px;
    margin: 0;
    line-height: 1.4;
  }

  .button {
    display: inline-block;
    background: #21262d;
    border: 1px solid #30363d;
    color: #f0f6fc;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    text-decoration: none;
    font-family: inherit;
    transition: all 0.2s;
  }

  .button:hover {
    background: #30363d;
    border-color: #58a6ff;
  }

  .button.primary {
    background: #238636;
    border-color: #238636;
    color: #ffffff;
  }

  .button.primary:hover {
    background: #2ea043;
  }

  pre {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 12px;
    margin: 8px 0;
    font-family: 'SF Mono', monospace;
    font-size: 13px;
    overflow-x: auto;
  }

  code {
    color: #f0f6fc;
  }

  @media (max-width: 768px) {
    .quick-links {
      grid-template-columns: 1fr;
    }

    .architecture-grid {
      grid-template-columns: 1fr;
    }
  }
</style>