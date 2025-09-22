<script lang="ts">
  import { onMount } from 'svelte';

  let logs = [];
  let walletInfo = null;
  let error = null;

  function addLog(message) {
    logs.push(`${new Date().toLocaleTimeString()}: ${message}`);
    logs = logs; // Trigger reactivity
    console.log(message);
  }

  onMount(() => {
    addLog('🎯 Debug page loaded');
    checkForWallets();
  });

  function checkForWallets() {
    addLog('🔍 Checking for wallets...');

    if (typeof window === 'undefined') {
      addLog('❌ Window object not available');
      return;
    }

    // Check all possible wallet locations
    const checks = [
      { name: 'window.bsv?.wallet', value: window.bsv?.wallet },
      { name: 'window.wallet', value: window.wallet },
      { name: 'window.metanet', value: window.metanet },
      { name: 'window.metaNet', value: window.metaNet },
      { name: 'window.MetaNet', value: window.MetaNet },
      { name: 'window.handcash?.wallet', value: window.handcash?.wallet },
      { name: 'window.yours?.wallet', value: window.yours?.wallet },
    ];

    let foundAny = false;
    checks.forEach(check => {
      if (check.value) {
        addLog(`✅ Found: ${check.name}`);
        foundAny = true;
      } else {
        addLog(`❌ Not found: ${check.name}`);
      }
    });

    if (!foundAny) {
      addLog('❌ No wallets found');

      // List ALL window properties to see what's available
      const allProps = Object.keys(window).sort();
      addLog(`🔍 Total window properties: ${allProps.length}`);

      // Look for anything that might be wallet-related with broader search
      const walletProps = allProps.filter(key =>
        key.toLowerCase().includes('wallet') ||
        key.toLowerCase().includes('metanet') ||
        key.toLowerCase().includes('meta') ||
        key.toLowerCase().includes('bsv') ||
        key.toLowerCase().includes('bitcoin') ||
        key.toLowerCase().includes('handcash') ||
        key.toLowerCase().includes('yours') ||
        key.toLowerCase().includes('chrome') ||
        key.toLowerCase().includes('extension')
      );

      if (walletProps.length > 0) {
        addLog(`🔍 Found potential wallet properties: ${walletProps.join(', ')}`);

        // Check each property for more details
        walletProps.forEach(prop => {
          const value = window[prop];
          if (value && typeof value === 'object') {
            const methods = Object.keys(value);
            addLog(`📋 ${prop} has methods: ${methods.slice(0, 5).join(', ')}${methods.length > 5 ? '...' : ''}`);
          }
        });
      } else {
        addLog('🔍 No potential wallet properties found');
      }

      // Check if there are any custom events or listeners that might indicate wallet presence
      addLog('🔍 Checking for common wallet events...');

      // Try to trigger wallet detection events
      try {
        window.dispatchEvent(new CustomEvent('wallet-detect'));
        window.dispatchEvent(new CustomEvent('metanet-detect'));
        addLog('📡 Dispatched wallet detection events');
      } catch (e) {
        addLog(`⚠️ Event dispatch error: ${e.message}`);
      }
    }
  }

  async function testBasicConnection() {
    addLog('🧪 Testing basic wallet connection...');
    error = null;

    try {
      // Try to find any wallet
      let wallet = null;

      if (window.metanet) {
        wallet = window.metanet;
        addLog('✅ Using window.metanet');
      } else if (window.metaNet) {
        wallet = window.metaNet;
        addLog('✅ Using window.metaNet');
      } else if (window.MetaNet) {
        wallet = window.MetaNet;
        addLog('✅ Using window.MetaNet');
      } else if (window.bsv?.wallet) {
        wallet = window.bsv.wallet;
        addLog('✅ Using window.bsv.wallet');
      } else if (window.wallet) {
        wallet = window.wallet;
        addLog('✅ Using window.wallet');
      } else {
        throw new Error('No wallet found');
      }

      addLog('🔄 Checking wallet availability...');

      // Check if wallet has isAvailable method
      if (wallet.isAvailable) {
        const available = await wallet.isAvailable();
        addLog(`📊 Wallet available: ${available}`);
        if (!available) {
          throw new Error('Wallet is not available');
        }
      } else {
        addLog('⚠️ Wallet does not have isAvailable method');
      }

      addLog('🔄 Getting public key...');

      // Try to get public key
      const result = await wallet.getPublicKey({
        identityKey: true
      });

      addLog(`✅ Got public key: ${result.publicKey.slice(0, 10)}...`);

      walletInfo = {
        publicKey: result.publicKey,
        walletType: 'MetaNet Desktop'
      };

    } catch (err) {
      error = err.message;
      addLog(`❌ Error: ${err.message}`);
    }
  }

  async function testWalletService() {
    addLog('🧪 Testing old wallet service...');
    try {
      const { walletService } = await import('$lib/wallet');
      const connection = await walletService.connect();
      addLog(`✅ Old wallet service connected: ${connection.publicKey?.slice(0, 10)}...`);
    } catch (err) {
      addLog(`❌ Old wallet service error: ${err.message}`);
    }
  }

  async function testBSVWalletService() {
    addLog('🧪 Testing BSV SDK wallet service...');
    try {
      const { bsvWalletService } = await import('$lib/bsv-wallet');
      const connection = await bsvWalletService.connect();
      addLog(`✅ BSV SDK wallet connected: ${connection.publicKey?.slice(0, 10)}...`);

      walletInfo = {
        publicKey: connection.publicKey,
        walletType: 'MetaNet Desktop (BSV SDK)'
      };
    } catch (err) {
      addLog(`❌ BSV SDK wallet error: ${err.message}`);
    }
  }

  async function checkBrowserExtensions() {
    addLog('🔍 Checking for browser extensions...');

    // Check for Chrome extension APIs that MetaNet might use
    if (typeof chrome !== 'undefined') {
      addLog('✅ Chrome extension API available');

      if (chrome.runtime) {
        addLog('✅ Chrome runtime available');
      }
    } else {
      addLog('❌ Chrome extension API not available');
    }

    // Check for common wallet extension patterns
    const extensionChecks = [
      'window.chrome',
      'window.browser',
      'window.msCrypto',
      'window.ethereum', // Some wallets might use this pattern
      'navigator.credentials',
      'navigator.wallet'
    ];

    extensionChecks.forEach(check => {
      const value = eval(check);
      if (value) {
        addLog(`✅ Found: ${check}`);
      } else {
        addLog(`❌ Not found: ${check}`);
      }
    });
  }

  function tryManualConnection() {
    addLog('🔧 Attempting manual connection methods...');

    // Try different connection approaches that MetaNet might use
    const connectionMethods = [
      () => window.open('metanet://connect', '_blank'),
      () => window.location.href = 'metanet://connect',
      () => {
        const event = new CustomEvent('metanet-connect-request');
        window.dispatchEvent(event);
      },
      () => {
        // Try postMessage to potential extension
        window.postMessage({ type: 'METANET_CONNECT_REQUEST' }, '*');
      }
    ];

    connectionMethods.forEach((method, i) => {
      try {
        method();
        addLog(`📡 Attempted connection method ${i + 1}`);
      } catch (e) {
        addLog(`❌ Connection method ${i + 1} failed: ${e.message}`);
      }
    });

    // Listen for responses
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type && event.data.type.includes('METANET')) {
        addLog(`📨 Received message: ${JSON.stringify(event.data)}`);
      }
    });

    addLog('👂 Listening for wallet responses...');
  }
</script>

<svelte:head>
  <title>Wallet Test - Gitdata</title>
</svelte:head>

<div class="container">
  <h1>🧪 Wallet Connection Test</h1>

  <div class="test-section">
    <h2>🔍 Available Tests</h2>
    <button on:click={checkForWallets} class="test-btn">
      Refresh Wallet Detection
    </button>
    <button on:click={testBasicConnection} class="test-btn">
      Test Basic Connection
    </button>
    <button on:click={testWalletService} class="test-btn">
      Test Old Wallet Service
    </button>
    <button on:click={testBSVWalletService} class="test-btn">
      Test BSV SDK Service
    </button>
    <button on:click={checkBrowserExtensions} class="test-btn">
      Check Browser Extensions
    </button>
    <button on:click={tryManualConnection} class="test-btn">
      Try Manual Connection
    </button>
  </div>

  {#if walletInfo}
    <div class="wallet-info">
      <h3>✅ Wallet Connected</h3>
      <p><strong>Type:</strong> {walletInfo.walletType}</p>
      <p><strong>Public Key:</strong> {walletInfo.publicKey}</p>
    </div>
  {/if}

  {#if error}
    <div class="error">
      <h3>❌ Error</h3>
      <p>{error}</p>
    </div>
  {/if}

  <div class="logs">
    <h3>📝 Debug Logs</h3>
    <div class="log-container">
      {#each logs as log}
        <div class="log-entry">{log}</div>
      {/each}
    </div>
  </div>

  <div class="instructions">
    <h3>📋 Instructions</h3>
    <ol>
      <li>Make sure MetaNet Desktop wallet is installed and running</li>
      <li>Click "Refresh Wallet Detection" to scan for wallets</li>
      <li>If a wallet is found, click "Test Basic Connection"</li>
      <li>Check the debug logs for detailed information</li>
    </ol>
  </div>
</div>

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
    background: #0d1117;
    color: #e6edf3;
    min-height: 100vh;
  }

  h1 {
    color: #58a6ff;
    text-align: center;
    margin-bottom: 30px;
  }

  h2 {
    color: #f0f6fc;
    margin-top: 30px;
  }

  h3 {
    color: #f0f6fc;
    margin-top: 20px;
  }

  .test-section {
    background: #161b22;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #30363d;
    margin-bottom: 20px;
  }

  .test-btn {
    background: #238636;
    color: #ffffff;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    margin: 5px;
    font-size: 14px;
    transition: all 0.2s;
  }

  .test-btn:hover {
    background: #2ea043;
    transform: translateY(-1px);
  }

  .wallet-info {
    background: #0f3027;
    border: 1px solid #238636;
    padding: 15px;
    border-radius: 6px;
    margin: 10px 0;
  }

  .error {
    background: #2d1517;
    border: 1px solid #f85149;
    padding: 15px;
    border-radius: 6px;
    margin: 10px 0;
  }

  .logs {
    background: #161b22;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #30363d;
    margin-top: 20px;
  }

  .log-container {
    max-height: 300px;
    overflow-y: auto;
    background: #0d1117;
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #21262d;
  }

  .log-entry {
    padding: 2px 0;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    border-bottom: 1px solid #21262d;
  }

  .log-entry:last-child {
    border-bottom: none;
  }

  .instructions {
    background: #161b22;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #30363d;
    margin-top: 20px;
  }

  .instructions ol {
    padding-left: 20px;
  }

  .instructions li {
    margin-bottom: 8px;
    line-height: 1.5;
  }
</style>