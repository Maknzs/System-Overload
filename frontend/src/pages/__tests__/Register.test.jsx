import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Register from '../Register.jsx';

vi.mock('../../api', () => ({
  api: vi.fn(),
}));
import { api } from '../../api';

describe('Register page', () => {
  it('registers and shows success, calls onRegistered', async () => {
    const goLogin = vi.fn();
    const onRegistered = vi.fn();
    api.mockImplementation(async (path, opts = {}) => {
      if (path === '/better-auth/sign-up/email' && opts.method === 'POST') return { token: null, user: { id: 'u1', email: 'x@example.com', name: 'alice' } };
      if (path === '/auth/register' && opts.method === 'POST') return { ok: true };
      return { ok: true };
    });
    render(<Register goLogin={goLogin} onRegistered={onRegistered} goBack={() => {}} />);

    await userEvent.type(screen.getByPlaceholderText(/email/i), 'x@example.com');
    await userEvent.type(screen.getByPlaceholderText(/username/i), 'alice');
    await userEvent.type(screen.getByPlaceholderText(/^password$/i), 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(api).toHaveBeenCalledWith('/better-auth/sign-up/email', {
      method: 'POST',
      body: { name: 'alice', email: 'x@example.com', password: 'Password1!' },
    });
    expect(api).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: { email: 'x@example.com', username: 'alice', password: 'Password1!' },
    });
    expect(onRegistered).toHaveBeenCalled();
    expect(await screen.findByText(/account created/i)).toBeInTheDocument();
  });

  it('shows error on failure', async () => {
    api.mockRejectedValue(new Error('Email in use'));
    render(<Register goLogin={() => {}} goBack={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/email/i), 'x@example.com');
    await userEvent.type(screen.getByPlaceholderText(/username/i), 'alice');
    await userEvent.type(screen.getByPlaceholderText(/^password$/i), 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/email in use/i)).toBeInTheDocument();
  });

  it('Back to login button calls goLogin', async () => {
    const goLogin = vi.fn();
    render(<Register goLogin={goLogin} goBack={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /back to login/i }));
    expect(goLogin).toHaveBeenCalled();
  });

  it('Back to lobby button calls goBack', async () => {
    const goBack = vi.fn();
    render(<Register goLogin={() => {}} goBack={goBack} />);
    await userEvent.click(screen.getByRole('button', { name: /back to lobby/i }));
    expect(goBack).toHaveBeenCalled();
  });
});
