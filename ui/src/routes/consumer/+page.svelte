<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    // Redirect to the main producer interface
    goto('/producer');
  });
</script>

<svelte:head>
  <title>Redirecting - Gitdata</title>
</svelte:head>

<div style="text-align: center; padding: 2rem;">
  <p>Redirecting to data marketplace...</p>
</div>