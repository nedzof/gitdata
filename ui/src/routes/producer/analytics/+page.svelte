<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    // Redirect to settings page with analytics tab
    goto('/settings?tab=analytics', { replaceState: true });
  });
</script>

<div class="redirect-page">
  <div class="redirect-content">
    <h1>🔄 Redirecting...</h1>
    <p>Analytics functionality has been moved to the Settings page.</p>
    <p>You will be redirected automatically.</p>
    <p>If you're not redirected, <a href="/settings?tab=analytics">click here</a>.</p>
  </div>
</div>

<style>
  .redirect-page {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
    padding: 2rem;
  }

  .redirect-content {
    text-align: center;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 3rem;
    max-width: 500px;
  }

  .redirect-content h1 {
    color: #f0f6fc;
    margin-bottom: 1rem;
    font-size: 1.5rem;
  }

  .redirect-content p {
    color: #6e7681;
    margin-bottom: 0.5rem;
    line-height: 1.5;
  }

  .redirect-content a {
    color: #58a6ff;
    text-decoration: none;
  }

  .redirect-content a:hover {
    text-decoration: underline;
  }
</style>