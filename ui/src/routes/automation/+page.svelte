<script>
  import AutomationHub from '$lib/components/AutomationHub.svelte';
</script>

<svelte:head>
  <title>Automation Hub - Gitdata</title>
  <meta name="description" content="Unified automation management: agents, rules, jobs, and policies" />
</svelte:head>

<main class="automation-page">
  <AutomationHub />
</main>

<style>
  .automation-page {
    padding: 20px;
    min-height: 100vh;
    background: #0d1117;
  }
</style>