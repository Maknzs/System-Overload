import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';

vi.mock('./api', () => {
  const api = vi.fn(async (path, opts = {}) => {
    // Default mock: unauthenticated unless overridden per-test
    if (path === '/auth/me') {
      throw new Error('unauthorized');
    }
    if (path === '/better-auth/session') {
      throw new Error('unauthorized');
    }
    if (path === '/better-auth/sign-out' && opts.method === 'POST') {
      return { ok: true };
    }
    throw new Error(`unhandled api call: ${path}`);
  });
  return { api };
});
import { api } from './api';

describe('App routing and token persistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('root redirects to Lobby when unauthenticated', async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /lobby/i })).toBeInTheDocument();
  });

  it('legacy /lobby path redirects to root Lobby', async () => {
    render(
      <MemoryRouter initialEntries={["/lobby"]}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /lobby/i })).toBeInTheDocument();
  });

  it('login stores token, navigates to lobby; can view profile and logout', async () => {
    // Arrange API mock for BA login + legacy login and session
    api.mockImplementation(async (path, opts = {}) => {
      if (path === '/better-auth/sign-in/email' && opts.method === 'POST') {
        return { token: 'ba123', user: { email: 'a@example.com', name: 'alice' } };
      }
      if (path === '/auth/login' && opts.method === 'POST') {
        return {
          token: 't123',
          user: { username: 'alice', email: 'a@example.com', gamesPlayed: 0 },
        };
      }
      if (path === '/better-auth/session') {
        return { user: { email: 'a@example.com', name: 'alice' } };
      }
      if (path === '/auth/me') {
        return { username: 'alice', email: 'a@example.com', gamesPlayed: 0 };
      }
      if (path === '/better-auth/sign-out' && opts.method === 'POST') {
        return { ok: true };
      }
      throw new Error(`unhandled api call: ${path}`);
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText(/email/i), 'a@example.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));

    // Navigates to lobby and persists token
    await screen.findByRole('heading', { name: /lobby/i });
    expect(localStorage.getItem('token')).toBe('t123');

    // Go to profile then logout
    await userEvent.click(screen.getByRole('button', { name: /view profile/i }));
    await userEvent.click(screen.getByRole('button', { name: /logout/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /login/i })
      ).toBeInTheDocument()
    );
    expect(localStorage.getItem('token')).toBeNull();
  });
});
