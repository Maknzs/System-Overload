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
    const goGuest = vi.fn();
    api.mockResolvedValue({ token: 't123', user: { username: 'alice', email: 'a@example.com' } });

    render(<Login onLogin={onLogin} goRegister={goRegister} goGuest={goGuest} />);

    await userEvent.type(screen.getByPlaceholderText(/email or username/i), 'alice');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(api).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { emailOrUsername: 'alice', password: 'Password1!' },
    });
    expect(onLogin).toHaveBeenCalledWith('t123', { username: 'alice', email: 'a@example.com' });
  });

  it('shows error on failure', async () => {
    const onLogin = vi.fn();
    api.mockRejectedValue(new Error('Invalid credentials'));
    render(<Login onLogin={onLogin} goRegister={() => {}} goGuest={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/email or username/i), 'alice');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'bad');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('navigates via Register and Guest buttons', async () => {
    const goRegister = vi.fn();
    const goGuest = vi.fn();
    render(<Login onLogin={() => {}} goRegister={goRegister} goGuest={goGuest} />);
    await userEvent.click(screen.getByRole('button', { name: /register/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue as guest/i }));
    expect(goRegister).toHaveBeenCalled();
    expect(goGuest).toHaveBeenCalled();
  });
});

