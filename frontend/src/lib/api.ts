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
  console.log(`[API] Calling ${endpoint}...`);
  
  const headers = new Headers(options.headers);
  // Only declare a JSON body when one is actually being sent — Fastify rejects
  // empty-body requests that advertise Content-Type: application/json.
  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Add a 15s timeout to all API calls
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[API] Request to ${endpoint} timed out after 15s`);
    controller.abort();
  }, 15000);

  const fetchOptions: RequestInit = {
    ...options,
    credentials: options.credentials ?? 'include',
    headers,
    signal: controller.signal,
  };

  try {
    const res = await fetch(url, fetchOptions);
    console.log(`[API] ${endpoint} returned ${res.status}`);
    return res;
  } catch (err) {
    console.error(`[API] ${endpoint} failed:`, err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
