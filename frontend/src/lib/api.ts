const BASE_URL = 'http://localhost:3001';

export async function api(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const fetchOptions: RequestInit = {
    ...options,
    credentials: options.credentials ?? 'include',
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
    },
  };
  return fetch(url, fetchOptions);
}
