<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { setAuthToken } from '$lib/api';

  onMount(() => {
    const token = page.url.searchParams.get('token');
    console.log('Login callback reached, token present:', !!token);
    
    if (token) {
      setAuthToken(token);
      
      // Notify opener if exists (for iframe flow)
      if (window.opener) {
        console.log('Notifying opener...');
        try {
          window.opener.postMessage({ type: 'pikirly-auth-success', token }, '*');
          // Give it a tiny bit of time to send before closing
          setTimeout(() => {
            console.log('Closing popup...');
            window.close();
          }, 500);
        } catch (e) {
          console.error('Failed to postMessage to opener:', e);
          window.location.href = '/host';
        }
      } else {
        console.log('No opener found, redirecting to host dashboard');
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
