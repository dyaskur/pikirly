<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { api, setAuthToken } from '$lib/api';

  let error: string | null = $state(null);

  onMount(async () => {
    const token = page.url.searchParams.get('token');
    const pairingCode = page.url.searchParams.get('pairingCode');
    
    // Check if URL has error (e.g. from backend redirect)
    if (page.url.searchParams.has('error')) {
      error = page.url.searchParams.get('message') || 'An error occurred during sign in.';
      return;
    }

    console.log('Login callback reached, token present:', !!token, 'pairing code:', !!pairingCode);
    if (token) {
      setAuthToken(token);

      // Notify opener if exists (for standard iframe flow)
      if (window.opener) {
        console.log('Notifying opener...');
        try {
          window.opener.postMessage({ type: 'pikirly-auth-success', token }, window.location.origin);
        } catch (e) {
          console.error('Failed to postMessage to opener:', e);
        }
      }

      // Give it a tiny bit of time before closing/redirecting
      setTimeout(() => {
        if (window.opener || pairingCode) {
          console.log('Closing popup...');
          window.close();
        } else {
          console.log('No opener found, redirecting to host dashboard');
          window.location.href = '/host';
        }
      }, 1000);
    } else {
      error = 'No authentication token received.';
    }
  });
</script>

<div class="flex items-center justify-center min-h-screen">
  <div class="text-center">
    {#if error}
      <div class="card bg-error/10 p-8">
        <h2 class="text-2xl font-bold text-error mb-4">Sign In Failed</h2>
        <p>{error}</p>
        <button class="btn btn-primary mt-6" onclick={() => window.close()}>Close Window</button>
      </div>
    {:else}
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p>Completing sign in...</p>
    {/if}
  </div>
</div>
