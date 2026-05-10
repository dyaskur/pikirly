const BASE_URL = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

export function getAuthToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('pikirly.token');
}

export function setAuthToken(token: string | null) {
  if (typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem('pikirly.token', token);
  else localStorage.removeItem('pikirly.token');
}

export async function api(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...options,
    credentials: options.credentials ?? 'include',
    headers,
  };
  return fetch(url, fetchOptions);
}
