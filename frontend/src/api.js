// In production behind Nginx proxy, API is same-origin at /api
const API_BASE = '/api';

export async function api(path, { method='GET', token, body } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Request failed: ${res.status}`);
  return data;
}
