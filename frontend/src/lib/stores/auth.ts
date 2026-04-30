import { writable } from 'svelte/store';
import { api } from '$lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
}

function createAuthStore() {
  const { subscribe, set } = writable<AuthState>({ user: null, loading: true });

  return {
    subscribe,
    init: async () => {
      try {
        const res = await api('/auth/me');
        if (res.ok) {
          const user = await res.json();
          set({ user, loading: false });
        } else {
          set({ user: null, loading: false });
        }
      } catch (e) {
        set({ user: null, loading: false });
      }
    },
    logout: async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
      } finally {
        set({ user: null, loading: false });
      }
    }
  };
}

export const auth = createAuthStore();
