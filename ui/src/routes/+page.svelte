<script>
  import { goto } from '$app/navigation';

  let searchQuery = '';

  function handleSearch(event) {
    event.preventDefault();
    if (searchQuery.trim()) {
      goto(`/data/version/${encodeURIComponent(searchQuery.trim())}`);
    }
  }
</script>

<main class="landing">
  <h1>Gitdata</h1>
  <p class="subtitle">A trust layer for the AI economy</p>

  <form class="search-main" on:submit={handleSearch}>
    <input
      class="search-input"
      bind:value={searchQuery}
      placeholder="versionId, txid, contentHash..."
      autofocus
    />
  </form>

  <div class="links">
    <a href="/docs">📚 Docs</a>
    <a href="/data">📊 Data & Policies</a>
    <a href="/models">🤖 Models</a>
    <a href="/automation">⚙️ Automation Hub</a>
  </div>
</main>