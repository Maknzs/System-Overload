import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../Login.jsx';

vi.mock('../../api', () => ({
  api: vi.fn(),
}));
import { api } from '../../api';

describe('Login page', () => {
  it('submits and calls onLogin on success', async () => {
    const onLogin = vi.fn();
    const goRegister = vi.fn();
    api.mockImplementation(async (path, opts = {}) => {
      if (path === '/better-auth/sign-in/email' && opts.method === 'POST') {
        return { token: 'ba123', user: { name: 'alice', email: 'a@example.com' } };
      }
      if (path === '/auth/login' && opts.method === 'POST') {
        return { token: 't123', user: { username: 'alice', email: 'a@example.com' } };
      }
      return { ok: true };
    });

    render(<Login onLogin={onLogin} goRegister={goRegister} />);

    await userEvent.type(screen.getByPlaceholderText(/email/i), 'a@example.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(api).toHaveBeenCalledWith('/better-auth/sign-in/email', {
      method: 'POST',
      body: { email: 'a@example.com', password: 'Password1!' },
    });
    expect(api).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { emailOrUsername: 'a@example.com', password: 'Password1!' },
    });
    expect(onLogin).toHaveBeenCalledWith('t123', { username: 'alice', email: 'a@example.com' });
  });

  it('shows error on failure', async () => {
    const onLogin = vi.fn();
    api.mockImplementation(async (path) => {
      if (path === '/better-auth/sign-in/email') throw new Error('Invalid credentials');
      throw new Error('unhandled');
    });
    render(<Login onLogin={onLogin} goRegister={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/email/i), 'a@example.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'bad');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('navigates via Register button', async () => {
    const goRegister = vi.fn();
    render(<Login onLogin={() => {}} goRegister={goRegister} goBack={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /register/i }));
    expect(goRegister).toHaveBeenCalled();
  });

  it('Back to Lobby button calls goBack', async () => {
    const goBack = vi.fn();
    render(<Login onLogin={() => {}} goRegister={() => {}} goBack={goBack} />);
    await userEvent.click(screen.getByRole('button', { name: /back to lobby/i }));
    expect(goBack).toHaveBeenCalled();
  });
});
