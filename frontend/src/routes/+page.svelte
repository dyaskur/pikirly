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

  async function bootstrapStage() {
    if (!meetContext) return;
    
    // Check if game already exists for this meeting
    try {
      const res = await api(`/games/by-meeting/${meetContext.meetingCode}`);
      if (res.ok) {
        const { gameId } = await res.json();
        
        // If we are signed in, we might be the host
        if ($auth.user) {
          // Check if we have a host session for this game
          if ($hostSession?.gameId === gameId) {
            goto(`/host/${gameId}?mode=meet`);
            return;
          }
        }
        
        // Otherwise, we are a player
        goto(`/join?pin=${gameId}&mode=meet`);
      }
    } catch (e) {
      console.error('Stage bootstrap error:', e);
    }
  }

  onMount(async () => {
    if (mode === 'meet') {
      meetContext = await getMeetContext();
      if (meetContext?.surface === 'stage') {
        void bootstrapStage();
      }
    }
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
  {#if meetContext}
    {#if meetContext.surface === 'side'}
      <MeetBootstrap />
    {:else}
      <MeetStage {meetContext} />
    {/if}
  {:else}
    <div class="center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
