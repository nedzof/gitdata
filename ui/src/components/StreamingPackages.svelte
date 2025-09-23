<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';

  // Stores for streaming packages data
  const streamingPackages = writable([]);
  const marketStats = writable({});
  const loading = writable(true);
  const error = writable(null);

  // Real-time update interval
  let updateInterval;
  let selectedStream = null;
  let showSubscribeModal = false;

  onMount(async () => {
    await loadStreamingPackages();
    await loadMarketStats();

    // Set up real-time updates every 30 seconds
    updateInterval = setInterval(async () => {
      await loadStreamingPackages();
      await loadMarketStats();
    }, 30000);
  });

  onDestroy(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });

  async function loadStreamingPackages() {
    try {
      const response = await fetch('/v1/streaming-market/streams');
      const data = await response.json();

      if (data.success) {
        streamingPackages.set(data.data.streams);
      } else {
        error.set(data.error);
      }
    } catch (err) {
      error.set(err.message);
    } finally {
      loading.set(false);
    }
  }

  async function loadMarketStats() {
    try {
      const response = await fetch('/v1/streaming-market/stats');
      const data = await response.json();

      if (data.success) {
        marketStats.set(data.data.overview);
      }
    } catch (err) {
      console.error('Failed to load market stats:', err);
    }
  }

  async function subscribeToStream(streamId, webhookUrl, subscriberId) {
    try {
      const response = await fetch(`/v1/streaming-market/streams/${streamId}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhookUrl,
          subscriberId,
          deliveryMode: 'both',
          minConfirmations: 1
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Successfully subscribed to stream!');
        showSubscribeModal = false;
      } else {
        alert('Subscription failed: ' + data.error);
      }
    } catch (err) {
      alert('Subscription error: ' + err.message);
    }
  }

  function openSubscribeModal(stream) {
    selectedStream = stream;
    showSubscribeModal = true;
  }

  function closeSubscribeModal() {
    showSubscribeModal = false;
    selectedStream = null;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function timeAgo(date) {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  function isStreamActive(stream) {
    if (!stream.last_packet_at) return false;
    const lastPacket = new Date(stream.last_packet_at);
    const now = new Date();
    return (now - lastPacket) < 300000; // 5 minutes
  }
</script>

<div class="streaming-packages">
  <div class="header">
    <h2>🌊 Real-time Data Streams</h2>
    <p>Subscribe to live data feeds from producers across the BSV Overlay Network</p>
  </div>

  {#if $loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading streaming packages...</p>
    </div>
  {:else if $error}
    <div class="error">
      <p>Error loading streams: {$error}</p>
      <button on:click={loadStreamingPackages}>Retry</button>
    </div>
  {:else}
    <!-- Market Statistics -->
    {#if Object.keys($marketStats).length > 0}
      <div class="market-stats">
        <div class="stat">
          <div class="stat-value">{$marketStats.activeStreams}</div>
          <div class="stat-label">Active Streams</div>
        </div>
        <div class="stat">
          <div class="stat-value">{$marketStats.packetsToday?.toLocaleString() || 0}</div>
          <div class="stat-label">Packets Today</div>
        </div>
        <div class="stat">
          <div class="stat-value">{$marketStats.totalSubscribers}</div>
          <div class="stat-label">Total Subscribers</div>
        </div>
        <div class="stat">
          <div class="stat-value">{$marketStats.totalRevenue} sats</div>
          <div class="stat-label">Revenue Generated</div>
        </div>
      </div>
    {/if}

    <!-- Streaming Packages Grid -->
    <div class="packages-grid">
      {#each $streamingPackages as stream (stream.version_id)}
        <div class="package-card streaming" class:active={isStreamActive(stream)}>
          <div class="package-header">
            <div class="package-title">
              <h3>{stream.title}</h3>
              {#if isStreamActive(stream)}
                <span class="live-indicator">🔴 LIVE</span>
              {:else}
                <span class="offline-indicator">⚫ OFFLINE</span>
              {/if}
            </div>
            <div class="package-category">{stream.category}</div>
          </div>

          <div class="package-stats">
            <div class="stat-row">
              <span class="label">Total Packets:</span>
              <span class="value">{stream.total_packets?.toLocaleString() || 0}</span>
            </div>
            <div class="stat-row">
              <span class="label">Today's Packets:</span>
              <span class="value">{stream.packets_today?.toLocaleString() || 0}</span>
            </div>
            <div class="stat-row">
              <span class="label">Subscribers:</span>
              <span class="value">{stream.active_subscribers || 0}</span>
            </div>
            <div class="stat-row">
              <span class="label">Avg Size:</span>
              <span class="value">{formatBytes(stream.avg_packet_size || 0)}</span>
            </div>
            <div class="stat-row">
              <span class="label">Last Packet:</span>
              <span class="value">{timeAgo(stream.last_packet_at)}</span>
            </div>
            {#if stream.price_per_packet}
              <div class="stat-row">
                <span class="label">Price:</span>
                <span class="value">{stream.price_per_packet} sats/packet</span>
              </div>
            {/if}
          </div>

          <div class="package-description">
            <p>{stream.description}</p>
          </div>

          {#if stream.tags && JSON.parse(stream.tags || '[]').length > 0}
            <div class="package-tags">
              {#each JSON.parse(stream.tags) as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}

          <div class="package-actions">
            <button class="btn-primary" on:click={() => openSubscribeModal(stream)}>
              📡 Subscribe to Stream
            </button>
            <a href="/stream/{stream.version_id}" class="btn-secondary">
              📊 View Details
            </a>
          </div>
        </div>
      {/each}
    </div>

    {#if $streamingPackages.length === 0}
      <div class="empty-state">
        <h3>No streaming packages available</h3>
        <p>Check back later for real-time data streams!</p>
      </div>
    {/if}
  {/if}
</div>

<!-- Subscribe Modal -->
{#if showSubscribeModal && selectedStream}
  <div class="modal-overlay" on:click={closeSubscribeModal}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>Subscribe to {selectedStream.title}</h3>
        <button class="close-btn" on:click={closeSubscribeModal}>×</button>
      </div>

      <form on:submit|preventDefault={(e) => {
        const formData = new FormData(e.target);
        subscribeToStream(
          selectedStream.version_id,
          formData.get('webhookUrl'),
          formData.get('subscriberId')
        );
      }}>
        <div class="form-group">
          <label for="subscriberId">Subscriber ID:</label>
          <input type="text" name="subscriberId" required placeholder="your-unique-id" />
        </div>

        <div class="form-group">
          <label for="webhookUrl">Webhook URL:</label>
          <input type="url" name="webhookUrl" required placeholder="https://your-server.com/webhook" />
        </div>

        <div class="form-group">
          <p class="info">
            You'll receive real-time data packets at your webhook URL when they're confirmed on the BSV blockchain.
          </p>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" on:click={closeSubscribeModal}>
            Cancel
          </button>
          <button type="submit" class="btn-primary">
            Subscribe
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .streaming-packages {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    text-align: center;
    margin-bottom: 30px;
  }

  .header h2 {
    font-size: 2.5rem;
    margin-bottom: 10px;
    background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .market-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    color: white;
  }

  .stat {
    text-align: center;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: bold;
    margin-bottom: 5px;
  }

  .stat-label {
    font-size: 0.9rem;
    opacity: 0.9;
  }

  .packages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }

  .package-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border: 2px solid transparent;
    transition: all 0.3s ease;
  }

  .package-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }

  .package-card.streaming {
    border-left: 4px solid #667eea;
  }

  .package-card.active {
    border-color: #10b981;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(255, 255, 255, 1) 100%);
  }

  .package-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 15px;
  }

  .package-title {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .package-title h3 {
    margin: 0;
    font-size: 1.3rem;
    color: #333;
  }

  .live-indicator {
    font-size: 0.8rem;
    color: #ef4444;
    font-weight: bold;
    animation: pulse 2s infinite;
  }

  .offline-indicator {
    font-size: 0.8rem;
    color: #6b7280;
    font-weight: bold;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .package-category {
    background: #f3f4f6;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    color: #6b7280;
  }

  .package-stats {
    margin-bottom: 15px;
    display: grid;
    gap: 5px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 0;
  }

  .stat-row .label {
    font-size: 0.9rem;
    color: #6b7280;
  }

  .stat-row .value {
    font-weight: 600;
    color: #374151;
  }

  .package-description {
    margin-bottom: 15px;
  }

  .package-description p {
    margin: 0;
    color: #6b7280;
    line-height: 1.4;
  }

  .package-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 15px;
  }

  .tag {
    background: #667eea;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
  }

  .package-actions {
    display: flex;
    gap: 10px;
  }

  .btn-primary, .btn-secondary {
    flex: 1;
    padding: 10px 15px;
    border-radius: 6px;
    text-decoration: none;
    text-align: center;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: #667eea;
    color: white;
  }

  .btn-primary:hover {
    background: #5a67d8;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
  }

  .loading {
    text-align: center;
    padding: 40px;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f4f6;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error {
    text-align: center;
    padding: 40px;
    color: #ef4444;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #6b7280;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 12px;
    padding: 0;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h3 {
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
  }

  .close-btn:hover {
    color: #374151;
  }

  .modal form {
    padding: 20px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
    color: #374151;
  }

  .form-group input {
    width: 100%;
    padding: 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
  }

  .form-group input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .form-group .info {
    margin: 0;
    font-size: 0.9rem;
    color: #6b7280;
    background: #f9fafb;
    padding: 10px;
    border-radius: 6px;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
</style>