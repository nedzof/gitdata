<script>
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { bsvWalletService } from '$lib/bsv-wallet';

  let walletConnected = false;
  let walletPublicKey = '';
  let walletLoading = false;
  let walletError = '';

  onMount(() => {
    console.log('🔍 Layout: Initializing wallet status monitoring...');

    // Continuous wallet status monitoring
    async function updateWalletStatus() {
      try {
        // Use new verification method
        const isConnected = await bsvWalletService.verifyWalletConnection();
        const publicKey = bsvWalletService.getPublicKey();

        console.log('📊 Wallet status check:', { isConnected, publicKey: publicKey ? publicKey.slice(0, 10) + '...' : null });

        walletConnected = isConnected;
        walletPublicKey = publicKey || '';

        if (isConnected && publicKey) {
          walletError = '';
        }
      } catch (error) {
        console.warn('⚠️ Wallet status check error:', error);
        walletConnected = false;
        walletPublicKey = '';
      }
    }

    // Initial check (async)
    updateWalletStatus().catch(error => {
      console.warn('⚠️ Initial wallet status check failed:', error);
    });

    // Listen for wallet connection changes
    const unsubscribe = bsvWalletService.onConnectionChange((connected) => {
      console.log('🔔 Wallet connection change:', connected);
      walletConnected = connected;
      if (connected) {
        walletPublicKey = bsvWalletService.getPublicKey() || '';
        walletError = '';
        console.log('✅ Wallet connected in layout:', walletPublicKey.slice(0, 10) + '...');
      } else {
        walletPublicKey = '';
        console.log('❌ Wallet disconnected in layout');
      }
    });

    // Periodic wallet status check (every 5 seconds)
    const statusInterval = setInterval(async () => {
      await updateWalletStatus();
    }, 5000);

    // Cleanup
    return () => {
      unsubscribe();
      clearInterval(statusInterval);
    };
  });


  async function connectWallet() {
    console.log('🔘 Connect wallet button clicked');

    if (walletConnected) {
      console.log('🔄 Disconnecting wallet...');
      // Disconnect wallet
      try {
        await bsvWalletService.disconnect();
        walletConnected = false;
        walletPublicKey = '';
        walletError = '';
        console.log('✅ Wallet disconnected successfully');
      } catch (error) {
        console.error('❌ Failed to disconnect wallet:', error);
        walletError = 'Failed to disconnect wallet';
      }
      return;
    }

    // Connect wallet
    console.log('🔄 Connecting wallet...');
    walletLoading = true;
    walletError = '';

    try {
      const connection = await bsvWalletService.connect();
      walletConnected = true;
      walletPublicKey = connection.publicKey || '';
      console.log('✅ Wallet connected successfully');
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
      walletError = error.message || 'Failed to connect wallet';
      walletConnected = false;
    } finally {
      walletLoading = false;
    }
  }

  function formatPublicKey(key) {
    if (!key) return '';
    return key.length > 12 ? `${key.slice(0, 6)}...${key.slice(-6)}` : key;
  }
</script>

<div class="app">
  <header class="top-nav">
    <div class="nav-container">
      <div class="nav-left">
        <a href="/" class="logo">Gitdata</a>
      </div>

      <div class="nav-center">
        <div class="main-nav-buttons">
          <a href="/about" class="nav-link">What is Gitdata</a>
          <a href="/explorer" class="nav-link">Explorer</a>
          <a href="/docs" class="nav-link">Docu</a>
        </div>
      </div>

      <div class="nav-right">
        <div class="nav-right-buttons">
          <a href="/settings" class="settings-btn" title="Settings & Policies">
            ⚙️
          </a>
          <div class="wallet-container">
            <button
              class="wallet-btn"
              class:connected={walletConnected}
              class:loading={walletLoading}
              class:error={walletError}
              on:click={connectWallet}
              disabled={walletLoading}
            >
              {#if walletLoading}
                ⏳ Connecting...
              {:else if walletConnected}
                🟢 {formatPublicKey(walletPublicKey)}
              {:else}
                🔗 Connect Wallet
              {/if}
            </button>

            {#if walletError}
              <div class="wallet-error" title={walletError}>
                ⚠️ {walletError.length > 30 ? walletError.slice(0, 30) + '...' : walletError}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </header>

  <main class="content">
    <slot />
  </main>
</div>

<style>
  /* Navigation Tabs */
  .main-navigation {
    display: flex;
    gap: 0;
    justify-content: center;
  }

  .nav-tab {
    padding: 0.75rem 1.5rem;
    color: #6e7681;
    text-decoration: none;
    border-radius: 6px;
    transition: all 0.2s;
    font-weight: 500;
    white-space: nowrap;
  }

  .nav-tab:hover {
    color: #f0f6fc;
    background: #21262d;
  }

  /* Active state based on current page */
  .nav-tab[href="/publish"]:global(.active),
  .nav-tab[href="/consumer"]:global(.active) {
    color: #58a6ff;
    background: #0d1117;
  }

  /* Nav Right Buttons */
  .nav-right-buttons {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 6px;
    color: #8b949e;
    text-decoration: none;
    font-size: 1.1rem;
    transition: all 0.2s;
  }

  .settings-btn:hover {
    background: #30363d;
    border-color: #58a6ff;
    color: #f0f6fc;
  }

  .wallet-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .wallet-btn {
    background: #1f6feb;
    border: 1px solid #388bfd;
    border-radius: 6px;
    color: #ffffff;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    min-width: 140px;
  }

  .wallet-btn:hover {
    background: #388bfd;
    border-color: #58a6ff;
  }

  .wallet-btn.connected {
    background: #238636;
    border-color: #2ea043;
  }

  .wallet-btn.connected:hover {
    background: #2ea043;
    border-color: #46954a;
  }

  .wallet-btn.loading {
    background: #6e7681;
    border-color: #8b949e;
    cursor: not-allowed;
  }

  .wallet-btn.loading:hover {
    background: #6e7681;
    border-color: #8b949e;
  }

  .wallet-btn.error {
    background: #da3633;
    border-color: #f85149;
  }

  .wallet-btn.error:hover {
    background: #f85149;
    border-color: #ff7b72;
  }

  .wallet-btn:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .wallet-error {
    position: absolute;
    top: 100%;
    right: 0;
    background: #da3633;
    color: #ffffff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    margin-top: 4px;
    z-index: 1000;
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .wallet-error::before {
    content: '';
    position: absolute;
    bottom: 100%;
    right: 16px;
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-bottom: 4px solid #da3633;
  }

  /* Main Navigation Buttons */
  .nav-center {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .main-nav-buttons {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .nav-link {
    color: #8b949e;
    text-decoration: none;
    font-weight: 500;
    font-size: 14px;
    transition: color 0.2s;
    white-space: nowrap;
  }

  .nav-link:hover {
    color: #58a6ff;
  }

  /* Logo styling */
  .logo {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f0f6fc;
    text-decoration: none;
    transition: color 0.2s;
  }

  .logo:hover {
    color: #58a6ff;
  }

</style>