import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';

vi.mock('./api', () => {
  const api = vi.fn(async (path, _opts = {}) => {
    // Default mock: unauthenticated unless overridden per-test
    if (path === '/auth/me') {
      throw new Error('unauthorized');
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

  it('protects the menu route when no token is present', async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );
    // Redirects to Login
    expect(await screen.findByRole('heading', { name: /login/i })).toBeInTheDocument();
  });

  it('login stores token, navigates to menu; logout clears token and returns to login', async () => {
    // Arrange API mock for login and subsequent /auth/me fetch
    api.mockImplementation(async (path, opts = {}) => {
      if (path === '/auth/login' && opts.method === 'POST') {
        return {
          token: 't123',
          user: { username: 'alice', email: 'a@example.com', gamesPlayed: 0 },
        };
      }
      if (path === '/auth/me') {
        return { username: 'alice', email: 'a@example.com', gamesPlayed: 0 };
      }
      throw new Error(`unhandled api call: ${path}`);
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>
    );

    await userEvent.type(
      screen.getByPlaceholderText(/email or username/i),
      'alice'
    );
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));

    // Navigates to menu and persists token
    await screen.findByText(/system overload/i);
    expect(localStorage.getItem('token')).toBe('t123');

    // Logout
    await userEvent.click(screen.getByRole('button', { name: /logout/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /login/i })
      ).toBeInTheDocument()
    );
    expect(localStorage.getItem('token')).toBeNull();
  });
});
