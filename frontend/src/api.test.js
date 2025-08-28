import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api } from './api';

const BASE = '/api';

function makeResponse({ status = 200, body = '', headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k) => headers[k.toLowerCase()] ?? headers[k],
    },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('api()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('adds Authorization header when token exists', async () => {
    localStorage.setItem('token', 'abc123');
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse({ status: 200, body: { ok: true }, headers: { 'content-type': 'application/json' } })
    );
    await api('/account/games-played', { method: 'POST' });
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, opts] = spy.mock.calls[0];
    expect(url).toBe(`${BASE}/account/games-played`);
    expect(opts.headers.Authorization).toBe('Bearer abc123');
  });

  it('handles non-JSON error bodies and shapes the message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse({ status: 500, body: '<html>nope</html>', headers: { 'content-type': 'text/html' } })
    );
    await expect(api('/health')).rejects.toThrow(/non-JSON response: text\/html/);
  });

  it('parses JSON success', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse({ status: 200, body: { ok: true }, headers: { 'content-type': 'application/json' } })
    );
    const res = await api('/health');
    expect(res).toEqual({ ok: true });
  });

  it('helper: updateEmail sends correct method and payload', async () => {
    const { api: defaultExport } = await vi.importActual('./api');
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse({ status: 200, body: { ok: true }, headers: { 'content-type': 'application/json' } })
    );
    await defaultExport.updateEmail({ newEmail: 'x@example.com', currentPassword: 'Password1!' });
    const [url, opts] = spy.mock.calls[0];
    expect(url).toBe(`${BASE}/account/email`);
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ newEmail: 'x@example.com', currentPassword: 'Password1!' });
  });

  it('helper: updateUsername sends correct method and payload', async () => {
    const { api: defaultExport } = await vi.importActual('./api');
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse({ status: 200, body: { ok: true }, headers: { 'content-type': 'application/json' } })
    );
    await defaultExport.updateUsername({ newUsername: 'newu', currentPassword: 'Password1!' });
    const [url, opts] = spy.mock.calls[0];
    expect(url).toBe(`${BASE}/account/username`);
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ newUsername: 'newu', currentPassword: 'Password1!' });
  });

  it('helper: updatePassword sends correct method and payload', async () => {
    const { api: defaultExport } = await vi.importActual('./api');
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse({ status: 200, body: { ok: true }, headers: { 'content-type': 'application/json' } })
    );
    await defaultExport.updatePassword({ currentPassword: 'Password1!', newPassword: 'NewPass1!' });
    const [url, opts] = spy.mock.calls[0];
    expect(url).toBe(`${BASE}/account/password`);
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ currentPassword: 'Password1!', newPassword: 'NewPass1!' });
  });

  it('helper: incrementGamesPlayed POSTs to correct endpoint', async () => {
    const { api: defaultExport } = await vi.importActual('./api');
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(
      makeResponse({ status: 200, body: { ok: true }, headers: { 'content-type': 'application/json' } })
    );
    await defaultExport.incrementGamesPlayed();
    const [url, opts] = spy.mock.calls[0];
    expect(url).toBe(`${BASE}/account/games-played`);
    expect(opts.method).toBe('POST');
  });
});

