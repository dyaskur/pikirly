<script lang="ts">
  import { auth } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  
  $effect(() => {
    if (!$auth.loading && $auth.user) {
      goto('/host');
    }
  });
</script>

<div class="center">
  <div class="card fade-in" style="max-width: 400px; text-align: center;">
    <div style="font-size: 2.6rem; font-weight: 900; color: var(--brand); letter-spacing: -0.02em; margin-bottom: 8px;">Quizzr</div>
    <h2>Sign In</h2>
    <p class="muted">Sign in to create and host quizzes.</p>
    <a href="http://localhost:3001/auth/google" class="btn-primary" style="display: block; text-decoration: none; margin-top: 1.5rem; padding: 12px;">
      Sign in with Google
    </a>
  </div>
</div>
