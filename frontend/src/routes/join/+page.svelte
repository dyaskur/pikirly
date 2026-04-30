<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getSocket } from '$lib/socket';
  import { playerSession } from '$lib/stores/player';

  let pin = $state(($page.url.searchParams.get('pin') ?? '').slice(0, 6));
  let nickname = $state('');
  let joining = $state(false);
  let error = $state<string | null>(null);

  function submit(e: Event) {
    e.preventDefault();
    error = null;
    const cleanPin = pin.trim();
    const cleanNick = nickname.trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      error = 'Enter a 6-digit PIN';
      return;
    }
    if (cleanNick.length < 2) {
      error = 'Nickname needs at least 2 characters';
      return;
    }

    joining = true;
    const socket = getSocket();
    socket.emit('join_game', { gameId: cleanPin, nickname: cleanNick }, (res) => {
      joining = false;
      if (!res.ok) {
        error = friendly(res.error);
        return;
      }
      playerSession.set({ gameId: cleanPin, playerId: res.playerId, nickname: cleanNick });
      goto(`/play/${cleanPin}`);
    });
  }

  function friendly(code: string): string {
    switch (code) {
      case 'game_not_found': return 'No game with that PIN.';
      case 'invalid_nickname': return 'That nickname is invalid.';
      case 'nickname_taken': return 'That nickname is taken — try another.';
      case 'game_in_progress': return 'This game has already started.';
      default: return code;
    }
  }
</script>

<div class="center">
  <div class="card fade-in">
    <h2 style="margin-bottom: 4px;">Join the game</h2>
    <div class="muted" style="margin-bottom: 22px;">Pop in your PIN and pick a nickname.</div>

    <form onsubmit={submit} class="spaced">
      <div>
        <label for="join-pin" style="display:block; font-weight: 700; margin-bottom: 6px;">Game PIN</label>
        <input
          id="join-pin"
          type="text"
          inputmode="numeric"
          maxlength="6"
          bind:value={pin}
          oninput={(e) => { pin = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6); }}
          autocomplete="off"
          style="text-align:center; font-size: 1.6rem; letter-spacing: 0.4em; font-weight: 800;"
        />
      </div>

      <div>
        <label for="join-nick" style="display:block; font-weight: 700; margin-bottom: 6px;">Nickname</label>
        <input
          id="join-nick"
          type="text"
          maxlength="24"
          placeholder="e.g. RocketRabbit"
          bind:value={nickname}
        />
      </div>

      <button type="submit" class="btn-primary" disabled={joining}>
        {joining ? 'Joining…' : 'Enter game'}
      </button>
    </form>

    {#if error}
      <div class="error">{error}</div>
    {/if}
  </div>
</div>
