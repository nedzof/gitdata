<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { baseUrl } from '$lib/api';

  let currentBaseUrl = 'http://localhost:8788';
  let showSaved = false;

  onMount(() => {
    const saved = localStorage.getItem('bsv_overlay_base_url');
    if (saved) {
      currentBaseUrl = saved;
      baseUrl.set(saved);
    }
  });

  function saveBaseUrl() {
    baseUrl.set(currentBaseUrl);
    localStorage.setItem('bsv_overlay_base_url', currentBaseUrl);
    showSaved = true;
    setTimeout(() => showSaved = false, 2000);
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-600">
  <!-- Header -->
  <header class="glass-card mx-4 mt-4 p-6">
    <div class="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-4">
      <div class="text-center lg:text-left">
        <h1 class="text-3xl lg:text-4xl font-bold text-white text-shadow-lg">
          Gitdata
        </h1>
        <p class="text-white/80 text-lg font-medium">
          Trust Layer for the AI Economy
        </p>
      </div>

      <div class="flex items-center gap-3 glass p-3 rounded-xl">
        <label for="baseUrlInput" class="text-white font-semibold text-sm">API:</label>
        <input
          id="baseUrlInput"
          bind:value={currentBaseUrl}
          placeholder="http://localhost:8788"
          class="input-field min-w-48"
        />
        <button
          on:click={saveBaseUrl}
          class="btn-primary text-sm py-2 px-4"
        >
          Save
        </button>
        {#if showSaved}
          <span class="text-green-400 font-medium text-sm">✓ Saved</span>
        {/if}
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto p-4">
    <slot />
  </main>
</div>