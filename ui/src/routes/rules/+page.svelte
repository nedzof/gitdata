<script>
  import AutomationRules from '$lib/components/AutomationRules.svelte';
</script>

<svelte:head>
  <title>Automation Rules - Gitdata</title>
  <meta name="description" content="Create and manage automation rules for data processing workflows" />
</svelte:head>

<main class="min-h-screen p-6">
  <div class="max-w-7xl mx-auto">
    <div class="mb-8">
      <nav class="text-white/80 text-sm mb-4">
        <a href="/" class="hover:text-white">Home</a>
        <span class="mx-2">→</span>
        <span class="text-white">Automation Rules</span>
      </nav>
    </div>

    <AutomationRules />
  </div>
</main>

<style>
  main {
    background: inherit;
  }

  :global(.glass-card) {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  }

  :global(.card-hover) {
    transition: all 0.3s ease;
  }

  :global(.card-hover:hover) {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.5);
  }

  :global(.input-field) {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 12px 16px;
    color: white;
    font-size: 14px;
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;
  }

  :global(.input-field:focus) {
    outline: none;
    border-color: rgba(99, 102, 241, 0.6);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  :global(.input-field::placeholder) {
    color: rgba(255, 255, 255, 0.5);
  }

  :global(.btn-primary) {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 12px 24px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  :global(.btn-primary:hover:not(:disabled)) {
    transform: translateY(-1px);
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
  }

  :global(.btn-primary:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global(.btn-secondary) {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 12px 24px;
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  :global(.btn-secondary:hover:not(:disabled)) {
    background: rgba(255, 255, 255, 0.2);
  }

  :global(.status-success) {
    background: rgba(34, 197, 94, 0.2);
    color: rgb(74, 222, 128);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  :global(.status-error) {
    background: rgba(239, 68, 68, 0.2);
    color: rgb(248, 113, 113);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  :global(.status-pending) {
    background: rgba(245, 158, 11, 0.2);
    color: rgb(251, 191, 36);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  :global(.primary-300) {
    color: rgb(165, 180, 252);
  }

  :global(.primary-200) {
    color: rgb(199, 210, 254);
  }
</style>