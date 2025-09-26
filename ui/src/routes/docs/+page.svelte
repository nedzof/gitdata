<script>
  import { goto } from '$app/navigation';

  let activeSection = 'overview';
</script>

<div class="gitbook-layout">
  <!-- Sidebar Navigation -->
  <nav class="sidebar">
    <div class="sidebar-header">
      <h2>Documentation</h2>
      <button class="back-btn" on:click={() => goto('/')}>
        ← Back to Home
      </button>
    </div>

    <div class="nav-menu">
      <button
        class="nav-item {activeSection === 'overview' ? 'active' : ''}"
        on:click={() => activeSection = 'overview'}
      >
        <span class="nav-icon">•</span>
        <span class="nav-label">Overview</span>
      </button>

      <button
        class="nav-item {activeSection === 'api' ? 'active' : ''}"
        on:click={() => activeSection = 'api'}
      >
        <span class="nav-icon">•</span>
        <span class="nav-label">API Endpoints</span>
      </button>

      <button
        class="nav-item {activeSection === 'producer-cli' ? 'active' : ''}"
        on:click={() => activeSection = 'producer-cli'}
      >
        <span class="nav-icon">•</span>
        <span class="nav-label">Producer CLI</span>
      </button>

      <button
        class="nav-item {activeSection === 'consumer-cli' ? 'active' : ''}"
        on:click={() => activeSection = 'consumer-cli'}
      >
        <span class="nav-icon">•</span>
        <span class="nav-label">Consumer CLI</span>
      </button>

      <button
        class="nav-item {activeSection === 'data-structures' ? 'active' : ''}"
        on:click={() => activeSection = 'data-structures'}
      >
        <span class="nav-icon">•</span>
        <span class="nav-label">Data Structures</span>
      </button>

      <button
        class="nav-item {activeSection === 'config' ? 'active' : ''}"
        on:click={() => activeSection = 'config'}
      >
        <span class="nav-icon">•</span>
        <span class="nav-label">Configuration</span>
      </button>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="main-content">
    <div class="content-wrapper">

{#if activeSection === 'overview'}
  <div class="section-content">
    <h1>Gitdata Documentation</h1>
    <p>Comprehensive documentation for the Gitdata decentralized data marketplace built on the BSV blockchain.</p>

    <div class="overview-grid">
      <div class="overview-card" on:click={() => activeSection = 'api'}>
        <h3>API Reference</h3>
        <p>REST endpoints for dataset manifests, policy compliance, and lineage information.</p>
      </div>

      <div class="overview-card" on:click={() => activeSection = 'producer-cli'}>
        <h3>Producer CLI</h3>
        <p>Command-line tools for publishing datasets, managing identity, and advertising services.</p>
      </div>

      <div class="overview-card" on:click={() => activeSection = 'consumer-cli'}>
        <h3>Consumer CLI</h3>
        <p>Tools for discovering, purchasing, and accessing data on the Gitdata network.</p>
      </div>

      <div class="overview-card" on:click={() => activeSection = 'data-structures'}>
        <h3>Data Structures</h3>
        <p>Schema definitions for manifests, lineage nodes, and policy specifications.</p>
      </div>
    </div>
  </div>

{:else if activeSection === 'api'}
  <div class="section-content">
    <h1>API Endpoints</h1>
    <p>REST API endpoints for interacting with the Gitdata network.</p>

    <div class="api-section">
      <h3>/listings</h3>
      <p>Retrieve dataset manifests and metadata.</p>
      <div class="code-block">
        <pre><code>GET /listings/service_1</code></pre>
      </div>
    </div>

    <div class="api-section">
      <h3>/ready</h3>
      <p>Policy compliance verification for datasets.</p>
      <div class="code-block">
        <pre><code>GET /ready?versionId=service_1&policy=%7B%7D</code></pre>
      </div>
    </div>

    <div class="api-section">
      <h3>/bundle</h3>
      <p>Dataset lineage and dependency information.</p>
      <div class="code-block">
        <pre><code>GET /bundle?versionId=service_1</code></pre>
      </div>
    </div>
  </div>

{:else if activeSection === 'producer-cli'}
  <div class="section-content">
    <h1>Producer CLI Commands</h1>
    <p>Complete command-line interface for BSV Overlay Network data producers with BRC stack integration.</p>

    <div class="cli-section">
      <h3>Global Options</h3>
      <p>Options available for all commands.</p>
      <div class="code-block">
        <pre><code>--config &lt;file&gt;         Configuration file path
--overlay-url &lt;url&gt;     Override overlay network URL
--debug                 Enable debug logging</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>init</h3>
      <p>Initialize producer and check overlay network connection.</p>
      <div class="code-block">
        <pre><code># Basic initialization
npx tsx cli/producer/producer.ts init

# Generate identity key and register with overlay
npx tsx cli/producer/producer.ts init --generate-key --register

# Options:
#   --generate-key    Generate new identity key
#   --register        Register with overlay network</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>identity</h3>
      <p>Producer identity management using BRC-31 authentication.</p>
      <div class="code-block">
        <pre><code># Setup producer identity
npx tsx cli/producer/producer.ts identity setup --generate-key --register-overlay --display-name "My Producer"

# Verify identity and reputation
npx tsx cli/producer/producer.ts identity verify --check-reputation --validate-advertisements

# Setup Options:
#   --generate-key         Generate new identity key
#   --register-overlay     Register with overlay network
#   --backup-key &lt;file&gt;    Backup identity key to file
#   --display-name &lt;name&gt;  Producer display name
#   --description &lt;desc&gt;   Producer description

# Verify Options:
#   --check-reputation          Check reputation score
#   --validate-advertisements   Validate service advertisements
#   --test-payment-endpoints    Test payment endpoints</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>register</h3>
      <p>Register producer with full BRC stack integration.</p>
      <div class="code-block">
        <pre><code># Register producer
npx tsx cli/producer/producer.ts register --name "My Producer" --description "Data provider" --capabilities "streaming,analytics"

# Required Options:
#   --name &lt;name&gt;              Producer name
#   --description &lt;desc&gt;       Producer description
#   --capabilities &lt;caps&gt;      Comma-separated capabilities

# Optional Options:
#   --regions &lt;regions&gt;        Comma-separated regions (default: from config)
#   --generate-identity        Generate new identity
#   --advertise-on-overlay     Advertise on overlay network</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>advertise</h3>
      <p>Advertise services via BRC-88 SHIP/SLAP.</p>
      <div class="code-block">
        <pre><code># Basic service advertisement
npx tsx cli/producer/producer.ts advertise --service-type data-feed --capabilities streaming,encoding --price 100

# Required Options:
#   --service-type &lt;type&gt;      Service type

# Optional Options:
#   --capabilities &lt;caps&gt;      Service capabilities (comma-separated)
#   --price &lt;price&gt;           Base price in satoshis (default: 100)
#   --currency &lt;currency&gt;     Currency (default: BSV)
#   --endpoint &lt;endpoint&gt;     Service endpoint (default: /service)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>advertise-advanced</h3>
      <p>Advanced service advertisement commands.</p>
      <div class="code-block">
        <pre><code># Create advanced service advertisement
npx tsx cli/producer/producer.ts advertise-advanced create \
  --service-type api \
  --capability data-processing \
  --pricing-model per-request \
  --rate 50 \
  --availability 99.5 \
  --max-consumers 1000

# Required Options:
#   --service-type &lt;type&gt;      Service type
#   --capability &lt;cap&gt;        Service capability
#   --pricing-model &lt;model&gt;   Pricing model (per-request, per-minute, per-mb, subscription)
#   --rate &lt;rate&gt;            Base rate in satoshis

# Optional Options:
#   --availability &lt;pct&gt;      Availability percentage (default: 99.0)
#   --max-consumers &lt;num&gt;     Maximum consumers (default: 1000)
#   --geographic-scope &lt;regions&gt;  Geographic regions (default: global)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>publish</h3>
      <p>Publish content to overlay network with BRC-22 + BRC-26.</p>
      <div class="code-block">
        <pre><code># Basic content publishing
npx tsx cli/producer/producer.ts publish --file data.json --price 50 --title "Dataset"

# Advanced publishing with lineage and policy
npx tsx cli/producer/producer.ts publish \
  --file data.json \
  --content-type application/json \
  --price 100 \
  --title "Training Dataset" \
  --tags "ai,training,ml" \
  --policy banking-compliance \
  --parent-ids "content_123,content_456" \
  --relationship "enriched"

# Required Options:
#   --file &lt;path&gt;             Content file path

# Optional Options:
#   --content-type &lt;type&gt;     Content MIME type
#   --price &lt;price&gt;          Price in satoshis (default: 50)
#   --replication &lt;num&gt;      Replication factor (default: 2)
#   --title &lt;title&gt;          Content title
#   --tags &lt;tags&gt;            Content tags (comma-separated)
#   --policy &lt;template&gt;      Policy template (banking-compliance, general-content, privacy-protection)
#   --parent-ids &lt;ids&gt;       Parent content IDs for lineage (comma-separated)
#   --relationship &lt;type&gt;    Relationship type (default: derived)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>publish-dataset</h3>
      <p>Publish datasets with advanced BRC-22 + BRC-26 options.</p>
      <div class="code-block">
        <pre><code># Single dataset publishing
npx tsx cli/producer/producer.ts publish-dataset dataset \
  --file dataset.csv \
  --title "Market Data" \
  --description "Real-time market analysis" \
  --tags "finance,market,realtime" \
  --price 2000 \
  --license commercial

# Batch publishing
npx tsx cli/producer/producer.ts publish-dataset batch \
  --directory ./datasets \
  --pattern "*.csv" \
  --base-price 1500 \
  --parallel-uploads 5 \
  --auto-generate-descriptions

# Dataset Required Options:
#   --file &lt;path&gt;             Dataset file path
#   --title &lt;title&gt;           Dataset title

# Dataset Optional Options:
#   --description &lt;desc&gt;      Dataset description
#   --tags &lt;tags&gt;            Comma-separated tags
#   --price &lt;price&gt;          Price in satoshis (default: 1000)
#   --license &lt;license&gt;      License type (default: commercial)
#   --distribute-nodes &lt;num&gt;  Number of distribution nodes (default: 3)

# Batch Required Options:
#   --directory &lt;dir&gt;         Source directory

# Batch Optional Options:
#   --pattern &lt;pattern&gt;       File pattern (default: *)
#   --base-price &lt;price&gt;     Base price in satoshis (default: 1000)
#   --parallel-uploads &lt;num&gt;  Parallel uploads (default: 3)
#   --auto-generate-descriptions  Auto-generate descriptions</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>stream</h3>
      <p>Start streaming session with real-time pricing.</p>
      <div class="code-block">
        <pre><code># Basic streaming
npx tsx cli/producer/producer.ts stream --stream-id "live-feed-001" --duration 60

# Advanced streaming configuration
npx tsx cli/producer/producer.ts stream \
  --stream-id "market-data-stream" \
  --stream-type "live-data" \
  --pricing-model "per-second" \
  --rate 5 \
  --quality "high" \
  --duration 300

# Options:
#   --stream-id &lt;id&gt;          Stream identifier
#   --stream-type &lt;type&gt;      Stream type (default: live-data)
#   --pricing-model &lt;model&gt;   Pricing model (default: per-second)
#   --rate &lt;rate&gt;            Rate in satoshis (default: 10)
#   --quality &lt;quality&gt;      Stream quality (default: high)
#   --duration &lt;seconds&gt;     Duration in seconds (default: 30)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>stream-advanced</h3>
      <p>Advanced streaming service management.</p>
      <div class="code-block">
        <pre><code># Create live data stream
npx tsx cli/producer/producer.ts stream-advanced create \
  --stream-id "real-time-analytics" \
  --title "Real-time Analytics Feed" \
  --format json \
  --update-frequency 500 \
  --price-per-minute 75 \
  --max-consumers 200

# Start streaming service
npx tsx cli/producer/producer.ts stream-advanced start \
  --stream-id "real-time-analytics" \
  --source "https://api.data-provider.com/stream" \
  --redundancy 2

# Create Required Options:
#   --stream-id &lt;id&gt;         Stream identifier
#   --title &lt;title&gt;          Stream title

# Create Optional Options:
#   --format &lt;format&gt;        Stream format (json, csv, binary) (default: json)
#   --update-frequency &lt;ms&gt;  Update frequency in ms (default: 1000)
#   --price-per-minute &lt;price&gt; Price per minute in satoshis (default: 50)
#   --max-consumers &lt;num&gt;    Maximum consumers (default: 100)

# Start Required Options:
#   --stream-id &lt;id&gt;         Stream identifier

# Start Optional Options:
#   --source &lt;url&gt;           Data source URL
#   --redundancy &lt;num&gt;       Redundancy factor (default: 1)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>analytics</h3>
      <p>Generate producer analytics reports with BRC-64 tracking.</p>
      <div class="code-block">
        <pre><code># Basic analytics report
npx tsx cli/producer/producer.ts analytics --report-type usage --time-range 24h

# Detailed analytics with export
npx tsx cli/producer/producer.ts analytics \
  --report-type revenue \
  --time-range 7d \
  --content-id "content_abc123" \
  --format csv \
  --output "./reports/revenue_report.csv"

# Options:
#   --config &lt;path&gt;          Producer configuration file path
#   --report-type &lt;type&gt;     Report type (usage, access, revenue) (default: usage)
#   --time-range &lt;range&gt;     Time range (1h, 24h, 7d, 30d) (default: 24h)
#   --content-id &lt;id&gt;        Content ID for content-specific analytics
#   --format &lt;format&gt;        Output format (json, csv) (default: json)
#   --export-format &lt;format&gt; Export format (json, csv) (default: json)
#   --output &lt;path&gt;          Output file path</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>analytics-advanced</h3>
      <p>Advanced producer analytics and tracking commands.</p>
      <div class="code-block">
        <pre><code># View detailed analytics
npx tsx cli/producer/producer.ts analytics-advanced view \
  --period 30d \
  --metrics "revenue,downloads,unique_consumers" \
  --export-format csv

# Track specific event
npx tsx cli/producer/producer.ts analytics-advanced track \
  --event "content_access" \
  --resource-id "content_xyz789" \
  --consumer-id "consumer_abc123" \
  --revenue 150 \
  --metadata '&#123;"source":"api","quality":"high"&#125;'

# View Options:
#   --period &lt;period&gt;        Time period (24h, 7d, 30d) (default: 7d)
#   --metrics &lt;metrics&gt;      Metrics to include (comma-separated)
#   --export-format &lt;format&gt; Export format (json, csv) (default: json)

# Track Required Options:
#   --event &lt;event&gt;          Event type
#   --resource-id &lt;id&gt;       Resource identifier

# Track Optional Options:
#   --consumer-id &lt;id&gt;       Consumer identifier
#   --revenue &lt;amount&gt;       Revenue amount (default: 0)
#   --metadata &lt;json&gt;        Event metadata (JSON)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>session-status</h3>
      <p>Check streaming session status.</p>
      <div class="code-block">
        <pre><code># Check session status
npx tsx cli/producer/producer.ts session-status --session-id "stream_123" --format table

# Required Options:
#   --session-id &lt;id&gt;        Streaming session ID

# Optional Options:
#   --config &lt;path&gt;          Producer configuration file path
#   --format &lt;format&gt;        Output format (json, table) (default: json)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>policy</h3>
      <p>D28 Policy management for producer content.</p>
      <div class="code-block">
        <pre><code># Create policy
npx tsx cli/producer/producer.ts policy create \
  --name "Financial Data Policy" \
  --description "Strict policy for financial datasets" \
  --template financial-strict

# List policies
npx tsx cli/producer/producer.ts policy list --enabled-only

# Show policy details
npx tsx cli/producer/producer.ts policy show --policy-id "policy_123" --export-json

# Update policy
npx tsx cli/producer/producer.ts policy update \
  --policy-id "policy_123" \
  --name "Updated Policy Name" \
  --enable

# Delete policy
npx tsx cli/producer/producer.ts policy delete --policy-id "policy_123" --confirm

# Define content metadata
npx tsx cli/producer/producer.ts policy define-metadata \
  --content-id "content_abc" \
  --classification "commercial" \
  --mime-type "application/json" \
  --license "proprietary" \
  --price 500 \
  --size 1048576 \
  --schema-hash "sha256_hash" \
  --ontology-tags "financial,trading" \
  --pii-flags "none" \
  --geo-origin "US" \
  --row-count 10000 \
  --null-percentage 0.1

# Evaluate content against policy
npx tsx cli/producer/producer.ts policy evaluate \
  --version-id "version_123" \
  --policy-id "policy_456" \
  --metadata-file "./metadata.json"

# List policy templates
npx tsx cli/producer/producer.ts policy templates

# Available Templates:
#   banking-compliance     Banking Compliance (Ultra-Policy)
#   general-content        General Content Policy
#   privacy-protection     Privacy Protection</code></pre>
      </div>
    </div>
  </div>

{:else if activeSection === 'consumer-cli'}
  <div class="section-content">
    <h1>Consumer CLI Commands</h1>
    <p>Complete command-line interface for BSV Overlay Network data consumers with BRC stack integration.</p>

    <div class="cli-section">
      <h3>Global Options</h3>
      <p>Options available for all commands.</p>
      <div class="code-block">
        <pre><code>--config                Configuration file path
--debug                 Enable debug logging</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>init</h3>
      <p>Initialize consumer (alias for identity setup).</p>
      <div class="code-block">
        <pre><code># Basic initialization
python3 cli/consumer/overlay-consumer-cli.py init

# Full initialization with key generation and registration
python3 cli/consumer/overlay-consumer-cli.py init \
  --generate-key \
  --register-overlay \
  --overlay-url http://localhost:3000 \
  --wallet-setup

# Options:
#   --generate-key      Generate new identity key
#   --register-overlay  Register with overlay network
#   --overlay-url       Overlay network URL
#   --wallet-setup      Setup wallet configuration
#   --config            Configuration file path (subcommand override)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>identity</h3>
      <p>Consumer identity management using BRC-31 authentication.</p>
      <div class="code-block">
        <pre><code># Setup consumer identity
python3 cli/consumer/overlay-consumer-cli.py identity setup --generate-key --register-overlay

# Verify identity and reputation
python3 cli/consumer/overlay-consumer-cli.py identity verify --check-reputation

# Setup Options:
#   --generate-key      Generate new identity key
#   --register-overlay  Register with overlay network

# Verify Options:
#   --check-reputation  Check reputation score</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>discover</h3>
      <p>Discover producer services via BRC-88 SHIP/SLAP.</p>
      <div class="code-block">
        <pre><code># Basic service discovery
python3 cli/consumer/overlay-consumer-cli.py discover --service-type data-feed

# Advanced discovery with filters
python3 cli/consumer/overlay-consumer-cli.py discover \
  --capability real-time \
  --region north-america \
  --max-price 200 \
  --service-type streaming \
  --format json \
  --show-capabilities

# Options:
#   --config              Configuration file path
#   --capability          Required capability
#   --capabilities        Required capabilities (alias for --capability)
#   --region              Geographic region
#   --location            Geographic location (alias for --region)
#   --max-price           Maximum price in satoshis
#   --service-type        Type of service
#   --format              Output format (json, text) (default: json)
#   --show-capabilities   Show detailed capabilities</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>subscribe</h3>
      <p>Subscribe to data streams with BRC-41 micropayments.</p>
      <div class="code-block">
        <pre><code># Subscribe to stream
python3 cli/consumer/overlay-consumer-cli.py subscribe \
  --producer-id "producer_abc123" \
  --stream-id "live-market-data" \
  --payment-method http \
  --max-price-per-minute 150 \
  --duration 2hour

# Required Options:
#   --producer-id         Producer ID
#   --stream-id           Stream ID

# Optional Options:
#   --config              Configuration file path
#   --payment-method      Payment method (http, d21-native) (default: http)
#   --max-price-per-minute Maximum price per minute (default: 100)
#   --duration            Subscription duration (default: 1hour)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>purchase</h3>
      <p>Purchase dataset access with payment processing.</p>
      <div class="code-block">
        <pre><code># Purchase dataset
python3 cli/consumer/overlay-consumer-cli.py purchase \
  --dataset-id "dataset_xyz789" \
  --payment-method d21-native \
  --amount 500 \
  --download-immediately

# Required Options:
#   --dataset-id          Dataset ID

# Optional Options:
#   --config              Configuration file path
#   --payment-method      Payment method (http, d21-native) (default: http)
#   --amount              Payment amount in satoshis
#   --download-immediately Download immediately after purchase</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>download</h3>
      <p>Download content via UHRP with integrity verification.</p>
      <div class="code-block">
        <pre><code># Download with verification
python3 cli/consumer/overlay-consumer-cli.py download \
  --uhrp-hash "uhrp_hash_abc123" \
  --verify-integrity \
  --output "./downloads/dataset.json" \
  --access-token "token_xyz789"

# Required Options:
#   --uhrp-hash           UHRP hash

# Optional Options:
#   --config              Configuration file path
#   --verify-integrity    Verify content integrity
#   --output              Output file path
#   --access-token        Access token from payment</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>history</h3>
      <p>View consumption history with BRC-64 tracking.</p>
      <div class="code-block">
        <pre><code># View consumption history
python3 cli/consumer/overlay-consumer-cli.py history \
  --days 30 \
  --show-costs \
  --export-format csv

# Options:
#   --config              Configuration file path
#   --days                Number of days to include (default: 30)
#   --show-costs          Include cost information
#   --export-format       Export format (csv, json)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>search</h3>
      <p>Search for content with advanced filtering.</p>
      <div class="code-block">
        <pre><code># Search for content
python3 cli/consumer/overlay-consumer-cli.py search \
  --content-type application/json \
  --tags "ai,training,dataset" \
  --max-price 1000 \
  --producer "producer_key_123" \
  --limit 20 \
  --format json

# Options:
#   --config              Configuration file path
#   --content-type        Content type to search for
#   --tags                Tags to search for (comma-separated)
#   --max-price           Maximum price in satoshis
#   --producer            Producer identity key
#   --limit               Maximum number of results (default: 10)
#   --format              Output format (json, text) (default: json)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>quote</h3>
      <p>Get pricing quotes from providers.</p>
      <div class="code-block">
        <pre><code># Get pricing quote
python3 cli/consumer/overlay-consumer-cli.py quote \
  --provider "producer_key_abc123" \
  --service-type "data-processing" \
  --resource-id "resource_xyz789" \
  --expected-cost 250 \
  --format json

# Required Options:
#   --provider            Provider identity key
#   --service-type        Service type
#   --resource-id         Resource ID

# Optional Options:
#   --config              Configuration file path
#   --expected-cost       Expected cost for the quote
#   --format              Output format (json, text) (default: json)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>pay</h3>
      <p>Process payments for quotes.</p>
      <div class="code-block">
        <pre><code># Process payment
python3 cli/consumer/overlay-consumer-cli.py pay \
  --quote-id "quote_abc123" \
  --confirm \
  --wait-for-confirmation \
  --format json

# Required Options:
#   --quote-id            Quote ID to pay

# Optional Options:
#   --config              Configuration file path
#   --confirm             Confirm payment
#   --wait-for-confirmation Wait for payment confirmation
#   --format              Output format (json, text) (default: json)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>access</h3>
      <p>Access content with payment verification.</p>
      <div class="code-block">
        <pre><code># Access content
python3 cli/consumer/overlay-consumer-cli.py access \
  --content-id "content_abc123" \
  --uhrp-url "uhrp://hash_xyz789" \
  --output "./content/data.json" \
  --format json

# Required Options:
#   --content-id          Content ID to access
#   --uhrp-url            UHRP URL for content

# Optional Options:
#   --config              Configuration file path
#   --output              Output file path
#   --format              Output format (json, text) (default: json)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>report</h3>
      <p>Generate comprehensive usage reports.</p>
      <div class="code-block">
        <pre><code># Generate usage report
python3 cli/consumer/overlay-consumer-cli.py report \
  --report-type usage \
  --time-range 30d \
  --include-payments \
  --include-content \
  --output "./reports/usage_report.csv" \
  --format csv

# Required Options:
#   --report-type         Report type (usage, payments, activity)

# Optional Options:
#   --config              Configuration file path
#   --time-range          Time range (e.g., 24h, 7d, 30d) (default: 24h)
#   --include-payments    Include payment details
#   --include-content     Include content details
#   --output              Output file path
#   --format              Output format (json, text, csv) (default: json)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>subscription-status</h3>
      <p>Check subscription status and details.</p>
      <div class="code-block">
        <pre><code># Check subscription status
python3 cli/consumer/overlay-consumer-cli.py subscription-status \
  --subscription-id "sub_abc123" \
  --format json

# Required Options:
#   --subscription-id     Subscription ID

# Optional Options:
#   --config              Configuration file path
#   --format              Output format (json, text) (default: json)</code></pre>
      </div>
    </div>

    <div class="cli-section">
      <h3>ready</h3>
      <p>D28 Policy-based content readiness validation.</p>
      <div class="code-block">
        <pre><code># Check content readiness with policy
python3 cli/consumer/overlay-consumer-cli.py ready \
  --version-id "version_abc123" \
  --policy '&#123;"maxPrice":100,"requiredLicense":"commercial"&#125;' \
  --validate-brc-stack \
  --exit-code-on-failure

# Alternative using policy ID
python3 cli/consumer/overlay-consumer-cli.py ready \
  --version-id "version_abc123" \
  --policy-id "policy_xyz789" \
  --validate-brc-stack

# Required Options:
#   --version-id          Version ID to check

# Optional Options:
#   --policy              Policy JSON string (alternative to --policy-id)
#   --policy-id           Existing policy ID to use for validation
#   --validate-brc-stack  Validate all BRC components
#   --exit-code-on-failure Exit with code 1 on failure</code></pre>
      </div>
    </div>
  </div>

{:else if activeSection === 'data-structures'}
  <div class="section-content">
    <h1>Data Structures</h1>
    <p>Schema definitions and data formats used throughout the Gitdata ecosystem.</p>

    <div class="data-section">
      <h3>Dataset Manifest</h3>
      <p>Structure for dataset metadata and versioning information.</p>
      <div class="code-block">
        <pre><code>&#123;
  "versionId": "service_1",
  "name": "AI Training Dataset",
  "producer": "DataCorp Inc",
  "contentHash": "hash_ai_training_001",
  "size": "2.5 GB",
  "classification": "public"
&#125;</code></pre>
      </div>
    </div>

    <div class="data-section">
      <h3>Lineage Node</h3>
      <p>Representation of data dependencies and processing relationships.</p>
      <div class="code-block">
        <pre><code>&#123;
  "id": "raw_data_001",
  "relationship": "processed",
  "level": 0,
  "dependencies": ["sensor_network_001"]
&#125;</code></pre>
      </div>
    </div>

    <div class="data-section">
      <h3>Policy Format</h3>
      <p>JSON specifications for governance rules and access control.</p>
      <div class="code-block">
        <pre><code>&#123;
  "maxPrice": 100,
  "requiredLicense": "public",
  "allowedProducers": ["DataCorp Inc", "Research Institute"]
&#125;</code></pre>
      </div>
    </div>
  </div>

{:else if activeSection === 'config'}
  <div class="section-content">
    <h1>Configuration</h1>
    <p>Environment setup and configuration options for the Gitdata system.</p>

    <div class="config-section">
      <h3>Environment Variables</h3>
      <p>Required environment variables for database and service configuration.</p>
      <div class="code-block">
        <pre><code>DB_HOST=localhost
DB_PORT=5432
DB_NAME=gitdata
DB_USER=postgres
DB_PASSWORD=password
REDIS_URL=redis://localhost:6379
BRC31_ENABLED=true</code></pre>
      </div>
    </div>

    <div class="config-section">
      <h3>Quick Links</h3>
      <p>Access other sections of the Gitdata interface.</p>
      <div class="quick-links">
        <a href="/settings" class="quick-link">Settings</a>
        <a href="/explorer" class="quick-link">Explorer</a>
        <a href="/about" class="quick-link">About</a>
      </div>
    </div>
  </div>
{/if}

    </div>
  </main>
</div>

<style>
  /* GitBook-style Layout */
  .gitbook-layout {
    display: flex;
    min-height: 100vh;
    background: #0d1117;
    color: #f0f6fc;
  }

  /* Sidebar Navigation */
  .sidebar {
    width: 280px;
    background: #161b22;
    border-right: 1px solid #21262d;
    display: flex;
    flex-direction: column;
    position: fixed;
    height: 100vh;
    left: 0;
    top: 0;
    overflow-y: auto;
  }

  .sidebar-header {
    padding: 2rem 1.5rem 1rem 1.5rem;
    border-bottom: 1px solid #21262d;
  }

  .sidebar-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #f0f6fc;
    margin: 0 0 1rem 0;
  }

  .back-btn {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #8b949e;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .back-btn:hover {
    background: #30363d;
    border-color: #58a6ff;
    color: #f0f6fc;
  }

  .nav-menu {
    padding: 1rem 0;
    flex: 1;
  }

  .nav-item {
    width: 100%;
    background: none;
    border: none;
    padding: 0.75rem 1.5rem;
    text-align: left;
    color: #8b949e;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 14px;
  }

  .nav-item:hover {
    background: #21262d;
    color: #f0f6fc;
  }

  .nav-item.active {
    background: #1f6feb;
    color: #ffffff;
    font-weight: 500;
  }

  .nav-icon {
    font-size: 16px;
    width: 20px;
    display: flex;
    justify-content: center;
  }

  .nav-label {
    flex: 1;
  }

  /* Main Content */
  .main-content {
    flex: 1;
    margin-left: 280px;
    padding: 2rem;
    background: #0d1117;
    min-height: 100vh;
  }

  .content-wrapper {
    max-width: 1200px;
    margin: 0;
  }

  .section-content {
    background: #0d1117;
  }

  .section-content h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #f0f6fc;
    margin-bottom: 1rem;
  }

  .section-content > p {
    font-size: 1.125rem;
    color: #8b949e;
    margin-bottom: 2rem;
    line-height: 1.6;
  }

  /* Overview Grid */
  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
  }

  .overview-card {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .overview-card:hover {
    border-color: #58a6ff;
    transform: translateY(-2px);
  }

  .overview-card h3 {
    color: #f0f6fc;
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .overview-card p {
    color: #8b949e;
    margin: 0;
    line-height: 1.5;
  }

  /* Section Styling */
  .api-section,
  .cli-section,
  .data-section,
  .config-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 8px;
  }

  .api-section h3,
  .cli-section h3,
  .data-section h3,
  .config-section h3 {
    color: #58a6ff;
    font-size: 1.25rem;
    margin: 0 0 0.5rem 0;
    font-weight: 600;
  }

  .api-section p,
  .cli-section p,
  .data-section p,
  .config-section p {
    color: #c9d1d9;
    margin: 0 0 1rem 0;
    line-height: 1.5;
  }

  /* Code Blocks */
  .code-block {
    margin-top: 1rem;
  }

  .code-block pre {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 1rem;
    margin: 0;
    overflow-x: auto;
    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
    font-size: 13px;
    line-height: 1.4;
  }

  .code-block code {
    color: #f0f6fc;
  }

  /* Quick Links */
  .quick-links {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .quick-link {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    color: #58a6ff;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .quick-link:hover {
    background: #30363d;
    border-color: #58a6ff;
    color: #f0f6fc;
  }

  /* Responsive Design */
  @media (max-width: 1024px) {
    .sidebar {
      width: 240px;
    }
    .main-content {
      margin-left: 240px;
    }
  }

  @media (max-width: 768px) {
    .sidebar {
      position: relative;
      width: 100%;
      height: auto;
    }
    .main-content {
      margin-left: 0;
      padding: 1rem;
    }
    .overview-grid {
      grid-template-columns: 1fr;
    }
    .section-content h1 {
      font-size: 2rem;
    }
    .code-block pre {
      font-size: 12px;
    }
    .quick-links {
      flex-direction: column;
    }
  }
</style>