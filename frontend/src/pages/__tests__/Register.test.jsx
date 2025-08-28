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
    api.mockResolvedValue({ ok: true });
    render(<Register goLogin={goLogin} onRegistered={onRegistered} />);

    await userEvent.type(screen.getByPlaceholderText(/email/i), 'x@example.com');
    await userEvent.type(screen.getByPlaceholderText(/username/i), 'alice');
    await userEvent.type(screen.getByPlaceholderText(/^password$/i), 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(api).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: { email: 'x@example.com', username: 'alice', password: 'Password1!' },
    });
    expect(onRegistered).toHaveBeenCalled();
    expect(await screen.findByText(/account created/i)).toBeInTheDocument();
  });

  it('shows error on failure', async () => {
    api.mockRejectedValue(new Error('Email in use'));
    render(<Register goLogin={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/email/i), 'x@example.com');
    await userEvent.type(screen.getByPlaceholderText(/username/i), 'alice');
    await userEvent.type(screen.getByPlaceholderText(/^password$/i), 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/email in use/i)).toBeInTheDocument();
  });

  it('Back to login button calls goLogin', async () => {
    const goLogin = vi.fn();
    render(<Register goLogin={goLogin} />);
    await userEvent.click(screen.getByRole('button', { name: /back to login/i }));
    expect(goLogin).toHaveBeenCalled();
  });
});

