<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { walletService, generateAuthHeaders } from '$lib/wallet';

  let revenueData = null;
  let agentSummary = null;
  let loading = true;
  let error = null;
  let selectedTimeframe = 'month';

  // Agent management
  let showAgentForm = false;
  let agentFormData = {
    agentId: '',
    maxPaymentSatoshis: 10000,
    dailyLimitSatoshis: 50000,
    monthlyLimitSatoshis: 1000000,
    expiresAt: ''
  };

  onMount(async () => {
    await loadDashboardData();
  });

  async function loadDashboardData() {
    try {
      loading = true;
      error = null;

      // Load revenue summary
      const revenuePromise = api.getRevenueSummary(selectedTimeframe);

      // Load agent summary
      const agentPromise = api.getAgentSummary();

      const [revenue, agents] = await Promise.all([revenuePromise, agentPromise]);

      revenueData = revenue;
      agentSummary = agents;

      console.log('Dashboard data loaded:', { revenue, agents });
    } catch (err) {
      error = err.message;
      console.error('Failed to load dashboard data:', err);
    } finally {
      loading = false;
    }
  }

  async function handleAuthorizeAgent() {
    try {
      if (!walletService.isConnected()) {
        await walletService.connect();
      }

      const authHeaders = await generateAuthHeaders(JSON.stringify(agentFormData));
      const result = await api.authorizeAgent(agentFormData, authHeaders);

      if (result.success) {
        alert('Agent authorized successfully!');
        showAgentForm = false;
        agentFormData = {
          agentId: '',
          maxPaymentSatoshis: 10000,
          dailyLimitSatoshis: 50000,
          monthlyLimitSatoshis: 1000000,
          expiresAt: ''
        };
        await loadDashboardData();
      } else {
        alert(`Authorization failed: ${result.reason}`);
      }
    } catch (err) {
      alert(`Authorization failed: ${err.message}`);
    }
  }

  function formatSatoshis(satoshis) {
    if (!satoshis) return '0 sats';
    if (satoshis >= 100000000) {
      return `${(satoshis / 100000000).toFixed(2)} BSV`;
    }
    if (satoshis >= 1000) {
      return `${(satoshis / 1000).toFixed(1)}k sats`;
    }
    return `${satoshis} sats`;
  }

  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  }
</script>

<div class="payments-dashboard">
  <header class="dashboard-header">
    <h1>D06 Payments & Revenue Dashboard</h1>
    <div class="header-controls">
      <select bind:value={selectedTimeframe} on:change={loadDashboardData}>
        <option value="day">Last Day</option>
        <option value="week">Last Week</option>
        <option value="month">Last Month</option>
      </select>
      <button class="btn-primary" on:click={() => showAgentForm = true}>
        Authorize Agent
      </button>
    </div>
  </header>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading payment dashboard...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <h2>Error Loading Dashboard</h2>
      <p>{error}</p>
      <button class="btn-secondary" on:click={loadDashboardData}>Retry</button>
    </div>
  {:else}
    <div class="dashboard-grid">
      <!-- Revenue Overview -->
      {#if revenueData}
        <section class="card revenue-card">
          <h2>Revenue Overview ({selectedTimeframe})</h2>
          <div class="metrics-grid">
            <div class="metric">
              <span class="metric-label">Total Revenue</span>
              <span class="metric-value primary">{formatSatoshis(revenueData.metrics.totalRevenueSatoshis)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Net Revenue</span>
              <span class="metric-value">{formatSatoshis(revenueData.metrics.netRevenueSatoshis)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Platform Fees</span>
              <span class="metric-value">{formatSatoshis(revenueData.metrics.platformFeeSatoshis)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Agent Commissions</span>
              <span class="metric-value">{formatSatoshis(revenueData.metrics.agentCommissionSatoshis)}</span>
            </div>
          </div>
          <div class="metrics-grid">
            <div class="metric">
              <span class="metric-label">Transactions</span>
              <span class="metric-value">{revenueData.metrics.transactionCount}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Active Days</span>
              <span class="metric-value">{revenueData.metrics.activeDays}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Daily Average</span>
              <span class="metric-value">{formatSatoshis(revenueData.metrics.averageDailyRevenue)}</span>
            </div>
          </div>
        </section>
      {/if}

      <!-- Agent Management -->
      {#if agentSummary}
        <section class="card agents-card">
          <h2>Agent Payment Summary</h2>
          <div class="metrics-grid">
            <div class="metric">
              <span class="metric-label">Total Agents</span>
              <span class="metric-value">{agentSummary.totals.totalAgents}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Active Agents</span>
              <span class="metric-value success">{agentSummary.totals.activeAgents}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Total Spent</span>
              <span class="metric-value">{formatSatoshis(agentSummary.totals.totalSpentAllAgents)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Average per Agent</span>
              <span class="metric-value">{formatSatoshis(agentSummary.totals.averageSpentPerAgent)}</span>
            </div>
          </div>

          {#if agentSummary.summary.length > 0}
            <div class="agents-list">
              <h3>Agent Details</h3>
              <div class="agents-table">
                <div class="table-header">
                  <span>Agent</span>
                  <span>Status</span>
                  <span>Spent</span>
                  <span>Budget Used</span>
                </div>
                {#each agentSummary.summary as agent}
                  <div class="table-row">
                    <span class="agent-name">{agent.agentName || agent.agentId}</span>
                    <span class="status status-{agent.status}">{agent.status}</span>
                    <span>{formatSatoshis(agent.totalSpentSatoshis)}</span>
                    <span class="budget-usage">
                      <div class="progress-bar">
                        <div
                          class="progress-fill"
                          style="width: {Math.min(agent.budgetUtilization?.monthlyPercent || 0, 100)}%"
                        ></div>
                      </div>
                      {(agent.budgetUtilization?.monthlyPercent || 0).toFixed(1)}%
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </section>
      {/if}
    </div>
  {/if}
</div>

<!-- Agent Authorization Modal -->
{#if showAgentForm}
  <div class="modal-overlay" on:click={() => showAgentForm = false}>
    <div class="modal" on:click|stopPropagation>
      <header class="modal-header">
        <h2>Authorize Agent for Payments</h2>
        <button class="close-btn" on:click={() => showAgentForm = false}>×</button>
      </header>

      <form on:submit|preventDefault={handleAuthorizeAgent}>
        <div class="form-group">
          <label for="agentId">Agent ID</label>
          <input
            id="agentId"
            type="text"
            bind:value={agentFormData.agentId}
            required
            placeholder="agent-uuid-or-identifier"
          />
        </div>

        <div class="form-group">
          <label for="maxPayment">Max Payment per Transaction (satoshis)</label>
          <input
            id="maxPayment"
            type="number"
            bind:value={agentFormData.maxPaymentSatoshis}
            required
            min="1"
          />
        </div>

        <div class="form-group">
          <label for="dailyLimit">Daily Spending Limit (satoshis)</label>
          <input
            id="dailyLimit"
            type="number"
            bind:value={agentFormData.dailyLimitSatoshis}
            required
            min="1"
          />
        </div>

        <div class="form-group">
          <label for="monthlyLimit">Monthly Spending Limit (satoshis)</label>
          <input
            id="monthlyLimit"
            type="number"
            bind:value={agentFormData.monthlyLimitSatoshis}
            required
            min="1"
          />
        </div>

        <div class="form-group">
          <label for="expiresAt">Expiration Date (optional)</label>
          <input
            id="expiresAt"
            type="date"
            bind:value={agentFormData.expiresAt}
          />
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" on:click={() => showAgentForm = false}>
            Cancel
          </button>
          <button type="submit" class="btn-primary">
            Authorize Agent
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .payments-dashboard {
    padding: 2rem;
    background: #0d1117;
    color: #e6edf3;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .dashboard-header h1 {
    font-size: 1.75rem;
    font-weight: 600;
    color: #f0f6fc;
    margin: 0;
  }

  .header-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .header-controls select {
    background: #21262d;
    border: 1px solid #30363d;
    color: #e6edf3;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    text-align: center;
  }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid #21262d;
    border-top: 2px solid #2f81f7;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .dashboard-grid {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  }

  .card {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 0.75rem;
    padding: 1.5rem;
  }

  .card h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1.5rem 0;
    color: #f0f6fc;
    border-bottom: 1px solid #21262d;
    padding-bottom: 0.75rem;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem;
    background: rgba(33, 38, 45, 0.5);
    border-radius: 0.5rem;
    border: 1px solid #30363d;
  }

  .metric-label {
    font-size: 0.75rem;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .metric-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: #e6edf3;
  }

  .metric-value.primary {
    color: #58a6ff;
  }

  .metric-value.success {
    color: #3fb950;
  }

  .agents-list h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: #f0f6fc;
  }

  .agents-table {
    display: grid;
    gap: 0.5rem;
  }

  .table-header, .table-row {
    display: grid;
    grid-template-columns: 1fr auto auto 120px;
    gap: 1rem;
    padding: 0.75rem;
    align-items: center;
  }

  .table-header {
    background: rgba(33, 38, 45, 0.3);
    border-radius: 0.375rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: #8b949e;
  }

  .table-row {
    background: rgba(33, 38, 45, 0.2);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    border: 1px solid transparent;
    transition: border-color 0.2s ease;
  }

  .table-row:hover {
    border-color: #30363d;
  }

  .agent-name {
    font-weight: 500;
    color: #e6edf3;
  }

  .status {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-active {
    background: rgba(35, 134, 54, 0.15);
    color: #3fb950;
  }

  .status-inactive {
    background: rgba(139, 148, 158, 0.15);
    color: #8b949e;
  }

  .budget-usage {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: #21262d;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #58a6ff;
    transition: width 0.3s ease;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 0.75rem;
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #21262d;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #f0f6fc;
  }

  .close-btn {
    background: none;
    border: none;
    color: #8b949e;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: #21262d;
    color: #e6edf3;
  }

  .modal form {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #e6edf3;
    font-size: 0.875rem;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 0.375rem;
    color: #e6edf3;
    font-size: 0.875rem;
    transition: border-color 0.2s ease;
  }

  .form-group input:focus {
    outline: none;
    border-color: #58a6ff;
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1);
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2rem;
  }

  /* Button Styles */
  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background: #238636;
    border-color: #238636;
    color: #ffffff;
  }

  .btn-primary:hover {
    background: #2ea043;
    border-color: #2ea043;
  }

  .btn-secondary {
    background: #21262d;
    border-color: #30363d;
    color: #e6edf3;
  }

  .btn-secondary:hover {
    background: #30363d;
    border-color: #444c56;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .payments-dashboard {
      padding: 1rem;
    }

    .dashboard-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .dashboard-grid {
      grid-template-columns: 1fr;
    }

    .metrics-grid {
      grid-template-columns: 1fr;
    }

    .table-header, .table-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .modal {
      width: 95%;
      margin: 1rem;
    }
  }
</style>