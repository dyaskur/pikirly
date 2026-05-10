<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { setAuthToken } from '$lib/api';

  onMount(() => {
    const token = page.url.searchParams.get('token');
    if (token) {
      setAuthToken(token);
      
      // Notify opener if exists (for iframe flow)
      if (window.opener) {
        window.opener.postMessage({ type: 'pikirly-auth-success', token }, '*');
        window.close();
      } else {
        // Fallback for standalone
        window.location.href = '/host';
      }
    }
  });
</script>

<div class="flex items-center justify-center min-h-screen">
  <div class="text-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
    <p>Completing sign in...</p>
  </div>
</div>
