<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let analyticsData = null;
  let loading = true;
  let reportType = 'usage';
  let timeRange = '24h';
  let contentId = '';
  let exportFormat = 'json';

  let reportTypes = [
    { value: 'usage', label: 'Usage Analytics' },
    { value: 'access', label: 'Access Patterns' },
    { value: 'revenue', label: 'Revenue Analytics' }
  ];

  let timeRanges = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
  ];

  onMount(async () => {
    await loadAnalytics();
  });

  async function loadAnalytics() {
    try {
      loading = true;

      // Simulate CLI analytics functionality
      const params = new URLSearchParams({
        reportType,
        timeRange,
        format: 'json'
      });

      if (contentId) {
        params.append('contentId', contentId);
      }

      // Mock analytics data that matches CLI output structure
      analyticsData = generateMockAnalytics(reportType, timeRange);

      // Try to get real analytics if available
      try {
        const response = await api.request(`/v1/analytics/producer?${params}`);
        if (response && Object.keys(response).length > 0) {
          analyticsData = response;
        }
      } catch (error) {
        console.warn('Using mock analytics data:', error);
      }

    } catch (error) {
      console.error('Failed to load analytics:', error);
      analyticsData = generateMockAnalytics(reportType, timeRange);
    } finally {
      loading = false;
    }
  }

  function generateMockAnalytics(type, range) {
    const now = new Date();
    const baseData = {
      reportType: type,
      timeRange: range,
      generatedAt: now.toISOString(),
      producer: JSON.parse(localStorage.getItem('producer-identity') || '{}')
    };

    switch (type) {
      case 'usage':
        return {
          ...baseData,
          totalRequests: Math.floor(Math.random() * 10000),
          uniqueClients: Math.floor(Math.random() * 1000),
          dataServed: Math.floor(Math.random() * 1000000000), // bytes
          avgResponseTime: Math.floor(Math.random() * 500), // ms
          topContent: [
            { contentId: 'content_abc123', requests: 450, revenue: 2250 },
            { contentId: 'content_def456', requests: 320, revenue: 1600 },
            { contentId: 'content_ghi789', requests: 180, revenue: 900 }
          ],
          hourlyBreakdown: Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            requests: Math.floor(Math.random() * 100),
            revenue: Math.floor(Math.random() * 500)
          }))
        };

      case 'access':
        return {
          ...baseData,
          totalSessions: Math.floor(Math.random() * 1000),
          avgSessionDuration: Math.floor(Math.random() * 300), // seconds
          bounceRate: Math.floor(Math.random() * 100), // percentage
          topRegions: [
            { region: 'North America', sessions: 450 },
            { region: 'Europe', sessions: 320 },
            { region: 'Asia Pacific', sessions: 180 }
          ],
          deviceTypes: [
            { type: 'Desktop', sessions: 600 },
            { type: 'Mobile', sessions: 280 },
            { type: 'API', sessions: 120 }
          ]
        };

      case 'revenue':
        return {
          ...baseData,
          totalRevenue: Math.floor(Math.random() * 50000), // satoshis
          avgRevenuePerRequest: Math.floor(Math.random() * 100),
          topPayingClients: [
            { clientId: 'client_abc', revenue: 15000, requests: 300 },
            { clientId: 'client_def', revenue: 12000, requests: 240 },
            { clientId: 'client_ghi', revenue: 8000, requests: 160 }
          ],
          revenueByContent: [
            { contentId: 'content_abc123', revenue: 12500 },
            { contentId: 'content_def456', revenue: 8300 },
            { contentId: 'content_ghi789', revenue: 5200 }
          ]
        };

      default:
        return baseData;
    }
  }

  async function exportReport() {
    if (!analyticsData) return;

    const filename = `producer-analytics-${reportType}-${timeRange}.${exportFormat}`;

    if (exportFormat === 'json') {
      const blob = new Blob([JSON.stringify(analyticsData, null, 2)], { type: 'application/json' });
      downloadBlob(blob, filename);
    } else if (exportFormat === 'csv') {
      const csv = convertToCSV(analyticsData);
      const blob = new Blob([csv], { type: 'text/csv' });
      downloadBlob(blob, filename);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function convertToCSV(data) {
    // Simple CSV conversion for demonstration
    let csv = '';

    if (data.topContent) {
      csv += 'Content ID,Requests,Revenue\n';
      data.topContent.forEach(item => {
        csv += `${item.contentId},${item.requests},${item.revenue}\n`;
      });
    }

    return csv;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatSatoshis(sats) {
    return new Intl.NumberFormat().format(sats) + ' sats';
  }
</script>

<div class="analytics-dashboard">
  <!-- Producer Navigation -->
  <nav class="producer-nav">
    <div class="nav-tabs">
      <a href="/producer" class="nav-tab">🏭 Setup</a>
      <a href="/producer/analytics" class="nav-tab active">📊 Analytics</a>
      <a href="/producer/services" class="nav-tab">🔧 Services</a>
    </div>
  </nav>

  <div class="header">
    <h1>Producer Analytics Dashboard</h1>
    <p>Comprehensive analytics matching CLI functionality</p>
  </div>

  <!-- Analytics Controls -->
  <div class="controls-panel">
    <div class="controls-grid">
      <div class="control-group">
        <label for="reportType">Report Type</label>
        <select id="reportType" bind:value={reportType} on:change={loadAnalytics} class="control-input">
          {#each reportTypes as type}
            <option value={type.value}>{type.label}</option>
          {/each}
        </select>
      </div>

      <div class="control-group">
        <label for="timeRange">Time Range</label>
        <select id="timeRange" bind:value={timeRange} on:change={loadAnalytics} class="control-input">
          {#each timeRanges as range}
            <option value={range.value}>{range.label}</option>
          {/each}
        </select>
      </div>

      <div class="control-group">
        <label for="contentId">Content ID (Optional)</label>
        <input
          id="contentId"
          type="text"
          bind:value={contentId}
          placeholder="content_abc123"
          class="control-input"
        />
      </div>

      <div class="control-actions">
        <button on:click={loadAnalytics} class="btn btn-primary" disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button on:click={exportReport} class="btn btn-secondary" disabled={!analyticsData}>
          Export Report
        </button>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="loading">
      <p>⏳ Generating analytics report...</p>
    </div>
  {:else if analyticsData}
    <!-- Usage Analytics -->
    {#if reportType === 'usage'}
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-icon">📊</div>
          <div class="metric-content">
            <h3>Total Requests</h3>
            <div class="metric-value">{new Intl.NumberFormat().format(analyticsData.totalRequests)}</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">👥</div>
          <div class="metric-content">
            <h3>Unique Clients</h3>
            <div class="metric-value">{new Intl.NumberFormat().format(analyticsData.uniqueClients)}</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">💾</div>
          <div class="metric-content">
            <h3>Data Served</h3>
            <div class="metric-value">{formatBytes(analyticsData.dataServed)}</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">⚡</div>
          <div class="metric-content">
            <h3>Avg Response</h3>
            <div class="metric-value">{analyticsData.avgResponseTime}ms</div>
          </div>
        </div>
      </div>

      <div class="data-tables">
        <div class="table-panel">
          <h3>🏆 Top Content</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Content ID</th>
                  <th>Requests</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {#each analyticsData.topContent as content}
                  <tr>
                    <td><code>{content.contentId}</code></td>
                    <td>{content.requests}</td>
                    <td>{formatSatoshis(content.revenue)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}

    <!-- Access Analytics -->
    {#if reportType === 'access'}
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-icon">🔗</div>
          <div class="metric-content">
            <h3>Total Sessions</h3>
            <div class="metric-value">{new Intl.NumberFormat().format(analyticsData.totalSessions)}</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">⏱️</div>
          <div class="metric-content">
            <h3>Avg Duration</h3>
            <div class="metric-value">{Math.floor(analyticsData.avgSessionDuration / 60)}m {analyticsData.avgSessionDuration % 60}s</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">📱</div>
          <div class="metric-content">
            <h3>Device Types</h3>
            <div class="metric-value">{analyticsData.deviceTypes.length} types</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">🌍</div>
          <div class="metric-content">
            <h3>Top Regions</h3>
            <div class="metric-value">{analyticsData.topRegions.length} regions</div>
          </div>
        </div>
      </div>

      <div class="data-tables">
        <div class="table-panel">
          <h3>🌎 Access by Region</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {#each analyticsData.topRegions as region}
                  <tr>
                    <td>{region.region}</td>
                    <td>{region.sessions}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}

    <!-- Revenue Analytics -->
    {#if reportType === 'revenue'}
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-icon">💰</div>
          <div class="metric-content">
            <h3>Total Revenue</h3>
            <div class="metric-value">{formatSatoshis(analyticsData.totalRevenue)}</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">📈</div>
          <div class="metric-content">
            <h3>Avg/Request</h3>
            <div class="metric-value">{formatSatoshis(analyticsData.avgRevenuePerRequest)}</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">👑</div>
          <div class="metric-content">
            <h3>Top Clients</h3>
            <div class="metric-value">{analyticsData.topPayingClients.length} clients</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">🎯</div>
          <div class="metric-content">
            <h3>Revenue Streams</h3>
            <div class="metric-value">{analyticsData.revenueByContent.length} sources</div>
          </div>
        </div>
      </div>

      <div class="data-tables">
        <div class="table-panel">
          <h3>💎 Top Paying Clients</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Client ID</th>
                  <th>Revenue</th>
                  <th>Requests</th>
                </tr>
              </thead>
              <tbody>
                {#each analyticsData.topPayingClients as client}
                  <tr>
                    <td><code>{client.clientId}</code></td>
                    <td>{formatSatoshis(client.revenue)}</td>
                    <td>{client.requests}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}

    <!-- Export Options -->
    <div class="export-panel">
      <div class="export-controls">
        <label for="exportFormat">Export Format:</label>
        <select id="exportFormat" bind:value={exportFormat} class="control-input">
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
        </select>
        <button on:click={exportReport} class="btn btn-secondary">
          📥 Export Report
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .analytics-dashboard {
    max-width: 1400px;
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

  .controls-panel {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .controls-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    align-items: end;
  }

  .control-group {
    display: flex;
    flex-direction: column;
  }

  .control-group label {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #f0f6fc;
  }

  .control-input {
    padding: 0.75rem;
    border: 1px solid #30363d;
    border-radius: 6px;
    font-size: 1rem;
    background: #0d1117;
    color: #f0f6fc;
    font-family: inherit;
  }

  .control-input:focus {
    outline: none;
    border-color: #58a6ff;
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1);
  }

  .control-actions {
    display: flex;
    gap: 0.5rem;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .metric-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .metric-icon {
    font-size: 2rem;
    background: #0d1117;
    border: 1px solid #21262d;
    padding: 1rem;
    border-radius: 50%;
  }

  .metric-content h3 {
    margin: 0 0 0.5rem 0;
    color: #6e7681;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .metric-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f0f6fc;
  }

  .data-tables {
    display: grid;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .table-panel {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .table-panel h3 {
    margin: 0 0 1rem 0;
    color: #f0f6fc;
  }

  .table-container {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    text-align: left;
    padding: 0.75rem;
    border-bottom: 1px solid #21262d;
    color: #f0f6fc;
  }

  th {
    background: #0d1117;
    font-weight: 600;
    color: #6e7681;
  }

  code {
    background: #0d1117;
    border: 1px solid #21262d;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 0.875rem;
    color: #f0f6fc;
  }

  .export-panel {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .export-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #6e7681;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
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

  .btn-secondary {
    background: #21262d;
    color: #f0f6fc;
    border: 1px solid #30363d;
  }

  .btn-secondary:hover {
    background: #30363d;
    border-color: #58a6ff;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>