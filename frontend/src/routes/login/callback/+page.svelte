<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { api, setAuthToken } from '$lib/api';

  onMount(async () => {
    const token = page.url.searchParams.get('token');
    const pairingCode = page.url.searchParams.get('pairingCode');
    console.log('Login callback reached, token present:', !!token, 'pairing code:', !!pairingCode);
    
    if (token) {
      setAuthToken(token);
      
      // If pairing code exists, notify the backend so the side panel can poll it
      if (pairingCode) {
        console.log('Saving pairing code...');
        try {
          await api('/auth/pairing/save', {
            method: 'POST',
            body: JSON.stringify({ pairingCode, token })
          });
          console.log('Pairing code saved successfully.');
        } catch (e) {
          console.error('Failed to save pairing code:', e);
        }
      }
      
      // Notify opener if exists (for standard iframe flow)
      if (window.opener) {
        console.log('Notifying opener...');
        try {
          window.opener.postMessage({ type: 'pikirly-auth-success', token }, '*');
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
    }
  });
</script>

<div class="flex items-center justify-center min-h-screen">
  <div class="text-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
    <p>Completing sign in...</p>
  </div>
</div>
