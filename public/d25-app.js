// D25 Application Logic
class D25App {
  constructor() {
    this.init();
  }

  init() {
    // Initialize base URL
    const baseUrlInput = document.getElementById('baseUrlInput');
    const saveBaseUrlBtn = document.getElementById('saveBaseUrlBtn');
    const baseUrlSaved = document.getElementById('baseUrlSaved');

    baseUrlInput.value = window.api.getBaseUrl();

    saveBaseUrlBtn.addEventListener('click', () => {
      const newUrl = baseUrlInput.value.trim();
      if (newUrl) {
        window.api.setBaseUrl(newUrl);
        baseUrlSaved.textContent = '✓ Gespeichert';
        setTimeout(() => { baseUrlSaved.textContent = ''; }, 2000);
      }
    });

    // Tab navigation
    this.initTabs();

    // Form handlers
    this.initForms();

    // Load initial data
    this.loadListings();
  }

  initTabs() {
    const tabButtons = document.querySelectorAll('nav button[data-tab]');
    const sections = document.querySelectorAll('section');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;

        // Hide all sections
        sections.forEach(section => section.classList.remove('active'));

        // Show target section
        const targetSection = document.getElementById(targetTab);
        if (targetSection) {
          targetSection.classList.add('active');
        }

        // Update tab state
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
      });
    });
  }

  initForms() {
    // Listings search
    document.getElementById('listingsSearchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.loadListings();
    });

    // Agent registration
    document.getElementById('agentRegisterForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.registerAgent();
    });

    // Agent search
    document.getElementById('agentSearchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.searchAgents();
    });

    // Rule creation
    document.getElementById('ruleCreateForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createRule();
    });

    // Rule run
    document.getElementById('ruleRunForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.runRule();
    });

    // Jobs filter
    document.getElementById('jobsFilterForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.loadJobs();
    });
  }

  async loadListings() {
    try {
      const query = document.getElementById('listingsQuery').value.trim();
      const limit = parseInt(document.getElementById('listingsLimit').value) || 10;
      const offset = parseInt(document.getElementById('listingsOffset').value) || 0;

      const result = await window.api.searchListings(query, limit, offset);
      this.displayListings(result.items);
    } catch (error) {
      this.showError('listingsResults', 'Fehler beim Laden der Listings: ' + error.message);
    }
  }

  displayListings(items) {
    const container = document.getElementById('listingsResults');

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <h3>No Data Found</h3>
          <p>Try adjusting your search criteria or browse all available data.</p>
        </div>`;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="result-item" onclick="d25App.showListingDetail('${item.versionId}')">
        <div class="result-title">${item.name || 'Untitled Dataset'}</div>
        <div class="result-meta">ID: <code>${item.versionId}</code></div>
        <div class="result-meta">Dataset: ${item.datasetId || 'N/A'}</div>
        <div class="result-meta">Updated: ${item.updatedAt || 'Unknown'}</div>
      </div>
    `).join('');
  }

  async showListingDetail(versionId) {
    try {
      const detail = await window.api.getListingDetail(versionId);
      const container = document.getElementById('listingDetail');

      container.innerHTML = `
        <h3>Listing Detail</h3>
        <div><strong>Version ID:</strong> ${detail.versionId}</div>
        <div><strong>Name:</strong> ${detail.manifest.name || 'N/A'}</div>
        <div><strong>Description:</strong> ${detail.manifest.description || 'N/A'}</div>
        <div><strong>Dataset ID:</strong> ${detail.manifest.datasetId || 'N/A'}</div>
        <div><strong>Content Hash:</strong> ${detail.manifest.contentHash || 'N/A'}</div>
        <div><strong>License:</strong> ${detail.manifest.license || 'N/A'}</div>
        <div><strong>Classification:</strong> ${detail.manifest.classification || 'N/A'}</div>
        <div><strong>Created:</strong> ${detail.manifest.createdAt || 'N/A'}</div>
      `;
    } catch (error) {
      this.showError('listingDetail', 'Fehler beim Laden der Details: ' + error.message);
    }
  }

  async registerAgent() {
    try {
      const name = document.getElementById('agentName').value.trim();
      const webhookUrl = document.getElementById('agentWebhook').value.trim();

      if (!name || !webhookUrl) {
        throw new Error('Name und Webhook URL sind erforderlich');
      }

      const result = await window.api.registerAgent(name, webhookUrl);
      this.showSuccess('agentsResults', `Agent registriert: ${result.agentId}`);

      // Clear form
      document.getElementById('agentRegisterForm').reset();

      // Refresh agents list
      this.searchAgents();
    } catch (error) {
      this.showError('agentsResults', 'Fehler bei Agent-Registrierung: ' + error.message);
    }
  }

  async searchAgents() {
    try {
      const query = document.getElementById('agentQuery').value.trim();
      const result = await window.api.searchAgents(query);
      this.displayAgents(result.items);
    } catch (error) {
      this.showError('agentsResults', 'Fehler beim Suchen der Agents: ' + error.message);
    }
  }

  displayAgents(items) {
    const container = document.getElementById('agentsResults');

    if (!items || items.length === 0) {
      container.innerHTML = '<div class="muted">Keine Agents gefunden.</div>';
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="list">
        <div><strong>${item.name}</strong></div>
        <div class="muted">ID: ${item.agentId}</div>
        <div class="muted">Status: ${item.status}</div>
        <div class="muted">Webhook: ${item.webhookUrl}</div>
        <div class="muted">Capabilities: ${item.capabilities.join(', ')}</div>
      </div>
    `).join('');
  }

  async createRule() {
    try {
      const name = document.getElementById('ruleName').value.trim();
      const query = document.getElementById('ruleQuery').value.trim();
      const agentId = document.getElementById('ruleAgentId').value.trim();

      if (!name || !agentId) {
        throw new Error('Rule Name und Agent ID sind erforderlich');
      }

      const result = await window.api.createRule(name, query, agentId);
      this.showSuccess('rulesFeedback', `Rule erstellt: ${result.ruleId}`);

      // Clear form
      document.getElementById('ruleCreateForm').reset();
    } catch (error) {
      this.showError('rulesFeedback', 'Fehler beim Erstellen der Rule: ' + error.message);
    }
  }

  async runRule() {
    try {
      const ruleId = document.getElementById('ruleIdRun').value.trim();

      if (!ruleId) {
        throw new Error('Rule ID ist erforderlich');
      }

      const result = await window.api.runRule(ruleId);
      this.showSuccess('rulesFeedback', `Rule ausgeführt: ${result.enqueued} Jobs enqueued`);

      // Clear form
      document.getElementById('ruleRunForm').reset();
    } catch (error) {
      this.showError('rulesFeedback', 'Fehler beim Ausführen der Rule: ' + error.message);
    }
  }

  async loadJobs() {
    try {
      const state = document.getElementById('jobsState').value;
      const result = await window.api.getJobs(state);
      this.displayJobs(result.items);
    } catch (error) {
      this.showError('jobsResults', 'Fehler beim Laden der Jobs: ' + error.message);
    }
  }

  displayJobs(items) {
    const container = document.getElementById('jobsResults');

    if (!items || items.length === 0) {
      container.innerHTML = '<div class="muted">Keine Jobs gefunden.</div>';
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="list">
        <div><strong>Job ID:</strong> ${item.job_id}</div>
        <div><strong>Rule ID:</strong> ${item.rule_id}</div>
        <div><strong>State:</strong> ${item.state}</div>
        <div><strong>Target ID:</strong> ${item.target_id || 'N/A'}</div>
        <div><strong>Attempts:</strong> ${item.attempts}</div>
        <div><strong>Created:</strong> ${new Date(item.created_at * 1000).toLocaleString()}</div>
        ${item.last_error ? `<div><strong>Error:</strong> ${item.last_error}</div>` : ''}
      </div>
    `).join('');
  }

  showError(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div style="color: red; background: #ffeeee; padding: 8px; border-radius: 4px;">${message}</div>`;
  }

  showSuccess(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div style="color: green; background: #eeffee; padding: 8px; border-radius: 4px;">${message}</div>`;
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.d25App = new D25App();
});