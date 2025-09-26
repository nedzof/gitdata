<script>
  import { goto } from '$app/navigation';
</script>

<div class="about-page">
  <button class="back-btn" on:click={() => goto('/')}>
    ← Back to Home
  </button>

  <div class="hero-section">
    <h1>What is Gitdata?</h1>
  </div>

  <div class="content-text">
    <p>Imagine a research facility generates climate data from thousands of sensors across continents. Scientists at universities worldwide require this data for critical research, but current systems force them through gatekeepers, paying hefty licensing fees, enduring months of negotiations, and receiving datasets with unknown modification histories.</p>

    <p>Imagine instead that the research facility publishes their data directly to a decentralized network. Each data point carries cryptographic proof of its origin and every subsequent transformation. Scientists discover the data through algorithmic search, not corporate intermediaries. They pay directly to data producers in real-time, fraction by fraction, as they consume exactly what they need.</p>

    <p>The climate data streams live to analysis tools. Payment flows automatically based on usage. The complete chain from raw sensor readings to published research papers exists on-chain. No data broker extracts rent. No gatekeeper controls access. No modification goes unrecorded.</p>

    <p>Researchers working with medical datasets face identical constraints. Financial analysts seeking market data encounter the same barriers. Agricultural scientists requiring soil composition data meet the same obstacles. Every domain where data creates value suffers under the current intermediated system.</p>

    <p>Imagine removing these barriers entirely. Data producers set their own terms and receive direct compensation. Data consumers access exactly what they need when they need it. Smart contracts enforce usage policies automatically. Every participant operates under transparent rules enforced by code, not corporate discretion.</p>

    <p>Imagine developers building applications that consume data from hundreds of sources simultaneously, paying microsatoshis per API call, with full lineage tracking ensuring data integrity throughout complex processing pipelines.</p>

    <p>This is Gitdata.</p>

    <h2>Access</h2>
    <p><a href="/settings">Settings</a> | <a href="/explorer">Explorer</a> | <a href="/docs">Documentation</a></p>
  </div>
</div>

<style>
  .about-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    line-height: 1.6;
    color: #e6edf3;
  }

  .back-btn {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #8b949e;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 2rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .back-btn:hover {
    background: #30363d;
    border-color: #58a6ff;
    color: #f0f6fc;
  }

  .hero-section {
    text-align: center;
    margin-bottom: 3rem;
  }

  .hero-section h1 {
    font-size: 3rem;
    font-weight: 700;
    color: #f0f6fc;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, #58a6ff, #79c0ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-description {
    font-size: 1.25rem;
    color: #8b949e;
    max-width: 600px;
    margin: 0 auto;
  }

  .content-text {
    margin-bottom: 2rem;
  }

  .content-text h2 {
    color: #58a6ff;
    font-size: 1.25rem;
    margin: 1.5rem 0 0.5rem 0;
    font-weight: 600;
  }

  .content-text h2:first-child {
    margin-top: 0;
  }

  .content-text p {
    color: #c9d1d9;
    margin: 0 0 0.5rem 0;
    line-height: 1.4;
  }

  .content-text a {
    color: #58a6ff;
    text-decoration: none;
  }

  .content-text a:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .about-page {
      padding: 1rem;
    }

    .hero-section h1 {
      font-size: 2rem;
    }

    .hero-description {
      font-size: 1rem;
    }
  }
</style>