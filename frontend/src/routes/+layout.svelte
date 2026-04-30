<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';

  let { children } = $props();

  onMount(() => {
    auth.init();
  });
</script>

<div class="app">
  {@render children()}
</div>
