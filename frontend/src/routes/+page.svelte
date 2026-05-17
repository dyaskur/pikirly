<script lang="ts">
  import { goto } from '$app/navigation';
  import { getSocket } from '$lib/socket';
  import { hostSession } from '$lib/stores/host';
  import { auth } from '$lib/stores/auth';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { getMeetContext, type MeetContext } from '$lib/meet';
  import MeetBootstrap from '$lib/components/MeetBootstrap.svelte';
  import MeetStage from '$lib/components/MeetStage.svelte';

  let pin = $state('');
  let creating = $state(false);
  let createError = $state<string | null>(null);

  let meetContext = $state<MeetContext | null>(null);
  let mode = $derived(page.url.searchParams.get('mode'));
  let bootstrapping = $state(true);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  async function bootstrapStage() {
    if (!meetContext) return;
    
    // Check if game already exists for this meeting
    try {
      const { api } = await import('$lib/api');
      const res = await api(`/games/by-meeting/${meetContext.meetingCode}`);
      const data = await res.json();
      
      if (res.ok && data.ok) {
        const { gameId, hostUserId } = data;
        const { navigateMeet } = await import('$lib/meet');
        
        // Stop polling if we found a game
        if (pollInterval) clearInterval(pollInterval);

        // Check if we are the host of this game
        if ($auth.user && $auth.user.id === hostUserId) {
          // If we don't have the token in this iframe (partitioning), try to reclaim it
          if (!$hostSession || $hostSession.gameId !== gameId) {
            console.log('[STAGE] Reclaiming host session for game:', gameId);
            const reclaimRes = await api(`/games/${gameId}/reclaim`, { method: 'POST' });
            const reclaimData = await reclaimRes.json();
            if (reclaimRes.ok && reclaimData.ok) {
              const { hostSession: hostSessionStore } = await import('$lib/stores/host');
              hostSessionStore.set({ gameId, hostToken: reclaimData.hostToken });
            }
          }
          await navigateMeet(`/host/${gameId}`);
          return;
        }
        
        // Otherwise, we are a player
        await navigateMeet(`/join?pin=${gameId}`);
      } else {
        bootstrapping = false;
        // Start polling if no game found yet
        if (!pollInterval && meetContext.surface === 'stage') {
          pollInterval = setInterval(bootstrapStage, 3000);
        }
      }
    } catch (e) {
      console.error('Stage bootstrap error:', e);
      bootstrapping = false;
    }
  }

  onMount(() => {
    const init = async () => {
      if (mode === 'meet') {
        meetContext = await getMeetContext();
        if (meetContext?.surface === 'stage') {
          await bootstrapStage();
        } else {
          bootstrapping = false;
        }
      } else {
        bootstrapping = false;
      }
    };

    void init();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  });

  function joinSubmit(e: Event) {
    e.preventDefault();
    const trimmed = pin.trim();
    if (!/^\d{6}$/.test(trimmed)) return;
    goto(`/join?pin=${trimmed}`);
  }

  async function startHosting() {
    if (!$auth.user) {
      goto('/login');
      return;
    }
    goto('/host');
  }
</script>

{#if mode === 'meet'}
  {#if bootstrapping}
    <div class="center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
      <p class="muted">Initializing Pikirly for Meet...</p>
    </div>
  {:else if meetContext}
    {#if meetContext.surface === 'side'}
      <MeetBootstrap />
    {:else}
      <div class="center">
        <div class="card p-12 text-center max-w-lg">
          <div class="text-6xl mb-6">🎮</div>
          <h1 class="text-3xl font-bold mb-4">Pikirly for Meet</h1>
          <p class="text-lg mb-8">Waiting for the host to start a game in the side panel...</p>
          <div class="animate-pulse flex justify-center">
            <div class="h-2 w-32 bg-primary/20 rounded"></div>
          </div>
        </div>
      </div>
    {/if}
  {:else}
    <div class="center">
      <div class="card p-8 border-2 border-brand bg-white text-center">
        <p class="text-error font-bold">Failed to connect to Google Meet SDK.</p>
        <p class="muted mt-2">This app can only be used inside a Google Meet call.</p>
      </div>
    </div>
  {/if}
{:else}
  <div class="center">
    <div class="card fade-in" style="max-width: 480px;">
    <div style="text-align:center; margin-bottom:24px;">
      <div style="font-size: 2.6rem; font-weight: 900; color: var(--brand); letter-spacing: -0.02em;">Pikirly</div>
      <div class="muted" style="margin-top: 4px;">Real-time multiplayer quizzes</div>
    </div>

    <form onsubmit={joinSubmit} class="spaced">
      <label for="home-pin" style="display:block; font-weight: 700; margin-bottom: 6px;">Game PIN</label>
      <input
        id="home-pin"
        type="text"
        inputmode="numeric"
        maxlength="6"
        placeholder="123456"
        bind:value={pin}
        oninput={(e) => { pin = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6); }}
        autocomplete="off"
        style="text-align:center; font-size: 1.6rem; letter-spacing: 0.4em; font-weight: 800;"
      />
      <button type="submit" class="btn-primary" disabled={!/^\d{6}$/.test(pin.trim())}>
        Join game
      </button>
    </form>

    <div style="display:flex; align-items:center; gap:12px; margin: 22px 0 14px; color: var(--muted);">
      <div style="height:1px; background:#e5e7eb; flex:1;"></div>
      <span style="font-size: 0.85rem;">or</span>
      <div style="height:1px; background:#e5e7eb; flex:1;"></div>
    </div>

    <button class="btn-secondary" onclick={startHosting} disabled={creating}>
      {creating ? 'Creating game…' : 'Host a new game'}
    </button>
    {#if createError}
      <div class="error">{createError}</div>
    {/if}
  </div>
</div>
{/if}
