<div class="detail">
  <h1>Gitdata Documentation</h1>

  <div class="metadata">
    <h2>Overview</h2>
    <p>
      Gitdata is a trust layer for the AI economy, providing cryptographic verification
      of data lineage and enabling secure data transactions between AI agents and humans.
    </p>
  </div>

  <div class="metadata">
    <h2>API Endpoints</h2>

    <h3>/ready</h3>
    <p>Check if a dataset meets specified policy requirements.</p>

    <h4>Request</h4>
    <div class="copy-code">
      <button class="copy-button" on:click={() => navigator.clipboard.writeText('GET /ready?versionId=TOXSIM-REPORT-12')}>
        Copy
      </button>
      <pre><code>GET /ready?versionId=TOXSIM-REPORT-12</code></pre>
    </div>

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

    <h3>/data</h3>
    <p>Retrieve data listings and search functionality.</p>

    <h4>Request</h4>
    <div class="copy-code">
      <button class="copy-button" on:click={() => navigator.clipboard.writeText('GET /data?limit=10&offset=0&q=TOXSIM')}>
        Copy
      </button>
      <pre><code>GET /data?limit=10&offset=0&q=TOXSIM</code></pre>
    </div>
  </div>

  <div class="metadata">
    <h2>Usage Examples</h2>

    <h3>Verify Data Trust</h3>
    <div class="copy-code">
      <button class="copy-button" on:click={() => navigator.clipboard.writeText('curl "http://localhost:8788/ready?versionId=TOXSIM-REPORT-12"')}>
        Copy
      </button>
      <pre><code>curl "http://localhost:8788/ready?versionId=TOXSIM-REPORT-12"</code></pre>
    </div>

    <h3>Search Data</h3>
    <div class="copy-code">
      <button class="copy-button" on:click={() => navigator.clipboard.writeText('curl "http://localhost:8788/data?q=molecular&limit=5"')}>
        Copy
      </button>
      <pre><code>curl "http://localhost:8788/data?q=molecular&limit=5"</code></pre>
    </div>
  </div>

  <div class="actions">
    <a href="/" class="button">← Back to Search</a>
    <a href="/explorer" class="button primary">Explore Data →</a>
  </div>
</div>

<style>
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

  h3 {
    color: #58a6ff;
    font-size: 18px;
    margin: 24px 0 8px 0;
  }

  h4 {
    color: #8b949e;
    font-size: 14px;
    margin: 16px 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  pre {
    background: #161b22;
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
</style>