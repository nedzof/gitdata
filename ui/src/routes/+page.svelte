<script>
  import DataCatalog from '$lib/components/DataCatalog.svelte';
  import UserDashboard from '$lib/components/UserDashboard.svelte';
  import { onMount } from 'svelte';

  let isLoggedIn = false;
  let activeView = 'catalog';

  onMount(() => {
    // Check if user is logged in (simple localStorage check for now)
    isLoggedIn = localStorage.getItem('gitdata_user') !== null;
    if (isLoggedIn) {
      activeView = 'dashboard';
    }
  });

  function handleLogin() {
    // Simulate login for demo
    localStorage.setItem('gitdata_user', JSON.stringify({ id: 'demo', name: 'Demo User' }));
    isLoggedIn = true;
    activeView = 'dashboard';
  }

  function handleLogout() {
    localStorage.removeItem('gitdata_user');
    isLoggedIn = false;
    activeView = 'catalog';
  }

  function setView(view) {
    activeView = view;
  }
</script>

<svelte:head>
  <title>Gitdata - Trust Layer for the AI Economy</title>
</svelte:head>

<!-- Hero Section -->
<div class="glass-card p-8 mb-8 text-center">
  <h1 class="text-4xl lg:text-5xl font-bold text-white mb-4">
    The Trust Layer for the AI Economy
  </h1>
  <p class="text-xl text-white/90 mb-6 max-w-3xl mx-auto">
    Verifiable data lineage for AI models. Browse datasets with proven provenance,
    check trust status, and subscribe to trusted data feeds.
  </p>

  {#if !isLoggedIn}
    <div class="flex justify-center gap-4">
      <button
        on:click={handleLogin}
        class="btn-primary px-8 py-3 text-lg"
      >
        Sign In
      </button>
      <button
        on:click={() => setView('catalog')}
        class="btn-secondary px-8 py-3 text-lg"
      >
        Browse Data
      </button>
    </div>
  {:else}
    <div class="flex justify-center gap-4">
      <button
        on:click={() => setView('dashboard')}
        class="btn-primary px-6 py-3 {activeView === 'dashboard' ? 'bg-white text-primary-700' : ''}"
      >
        📊 My Dashboard
      </button>
      <button
        on:click={() => setView('catalog')}
        class="btn-secondary px-6 py-3 {activeView === 'catalog' ? 'bg-white text-secondary-700' : ''}"
      >
        🔍 Browse Data
      </button>
      <button
        on:click={handleLogout}
        class="text-white/70 hover:text-white px-4 py-3"
      >
        Sign Out
      </button>
    </div>
  {/if}
</div>

<!-- Main Content -->
<div class="animate-fade-in">
  {#if activeView === 'catalog'}
    <DataCatalog {isLoggedIn} />
  {:else if activeView === 'dashboard' && isLoggedIn}
    <UserDashboard />
  {/if}
</div>