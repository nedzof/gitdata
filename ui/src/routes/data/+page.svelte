<script>
  import DataExplorer from '$lib/components/DataExplorer.svelte';
</script>

<svelte:head>
  <title>Data Governance Hub - Gitdata</title>
  <meta name="description" content="Explore and govern your data with advanced policy controls" />
</svelte:head>

<main class="data-page">
  <DataExplorer />
</main>

<style>
  .data-page {
    padding: 20px;
    min-height: 100vh;
    background: #0d1117;
  }
</style>