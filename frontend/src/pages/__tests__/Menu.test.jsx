import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Menu from '../Menu.jsx';

vi.mock('../../api', () => {
  const impl = (
    path,
    _opts = {}
  ) => {
    if (path === '/auth/me') return Promise.resolve({ email: 'u@example.com', username: 'newu', gamesPlayed: 1 });
    return Promise.resolve({ ok: true });
  };
  impl.updateEmail = vi.fn().mockResolvedValue({ ok: true });
  impl.updateUsername = vi.fn().mockResolvedValue({ ok: true });
  impl.updatePassword = vi.fn().mockResolvedValue({ ok: true });
  return { api: impl };
});
import { api } from '../../api';

const user = { email: 'a@example.com', username: 'alice', gamesPlayed: 0 };

describe('Menu page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders user info and handles logout/start', async () => {
    const onStart = vi.fn();
    const onLogout = vi.fn();
    render(<Menu user={user} onStart={onStart} onLogout={onLogout} />);
    expect(screen.getByText(/username:/i).textContent).toMatch(/alice/);
    expect(screen.getByText(/email:/i).textContent).toMatch(/a@example.com/);
    await userEvent.click(screen.getByRole('button', { name: /start new local game/i }));
    await userEvent.click(screen.getByRole('button', { name: /logout/i }));
    expect(onStart).toHaveBeenCalled();
    expect(onLogout).toHaveBeenCalled();
  });

  it('updates email successfully and shows success pill', async () => {
    const onUserUpdate = vi.fn();
    render(<Menu user={user} onUserUpdate={onUserUpdate} />);

    await userEvent.click(screen.getByRole('button', { name: /change email/i }));
    await userEvent.type(screen.getByPlaceholderText(/new email/i), 'new@example.com');
    await userEvent.type(screen.getByPlaceholderText(/current password/i), 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(api.updateEmail).toHaveBeenCalledWith({ newEmail: 'new@example.com', currentPassword: 'Password1!' });
    expect(await screen.findByText(/changes saved/i)).toBeInTheDocument();
  });

  it('updates username successfully', async () => {
    render(<Menu user={user} />);
    await userEvent.click(screen.getByRole('button', { name: /change username/i }));
    const form = screen.getByText(/username/i).closest('.card');
    const utils = within(form);
    await userEvent.type(utils.getByPlaceholderText(/new username/i), 'newu');
    const pwField = utils.getAllByPlaceholderText(/current password/i)[0];
    await userEvent.type(pwField, 'Password1!');
    await userEvent.click(utils.getByRole('button', { name: /^save$/i }));
    expect(api.updateUsername).toHaveBeenCalledWith({ newUsername: 'newu', currentPassword: 'Password1!' });
  });

  it('prevents password update when confirmation mismatch', async () => {
    render(<Menu user={user} />);
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));
    await userEvent.type(screen.getByPlaceholderText(/^current password$/i), 'Password1!');
    await userEvent.type(screen.getByPlaceholderText(/^new password$/i), 'NewPass1!');
    await userEvent.type(screen.getByPlaceholderText(/confirm new password/i), 'Mismatch!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(api.updatePassword).not.toHaveBeenCalled();
  });
});
