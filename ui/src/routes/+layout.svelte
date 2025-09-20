<script>
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let searchQuery = '';
  let walletConnected = false;

  function handleGlobalSearch(event) {
    event.preventDefault();
    if (searchQuery.trim()) {
      goto(`/data/version/${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  function connectWallet() {
    // Placeholder for wallet connection logic
    walletConnected = !walletConnected;
  }
</script>

<div class="app">
  <header class="top-nav">
    <div class="nav-container">
      <div class="nav-left">
        <a href="/" class="logo">Gitdata</a>
        <a href="/docs" class="primary-btn">📚 Docs</a>
      </div>

      <div class="nav-center">
        <form class="global-search" on:submit={handleGlobalSearch}>
          <input
            class="search-input-nav"
            bind:value={searchQuery}
            placeholder="Search versionId, txid, contentHash..."
          />
        </form>
      </div>

      <div class="nav-right">
        <button class="wallet-btn" class:connected={walletConnected} on:click={connectWallet}>
          {#if walletConnected}
            🟢 Connected
          {:else}
            🔗 Connect Wallet
          {/if}
        </button>
      </div>
    </div>
  </header>

  <main class="content">
    <slot />
  </main>
</div>