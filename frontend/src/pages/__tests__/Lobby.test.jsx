import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Lobby from '../Lobby.jsx';
import { MemoryRouter, useLocation } from 'react-router-dom';

function LocProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

describe('Lobby page dynamic auth actions', () => {
  it('shows Login / Register when signed out and navigates to /login', async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <LocProbe />
        <Lobby authed={false} onStart={() => {}} onBack={() => {}} />
      </MemoryRouter>
    );

    // Button label when not authed
    const btn = screen.getByRole('button', { name: /login \/? register/i });
    expect(btn).toBeInTheDocument();

    // Navigate to /login on click
    await userEvent.click(btn);
    expect(screen.getByTestId('loc')).toHaveTextContent('/login');
  });

  it('shows View Profile when signed in and calls onBack', async () => {
    const onBack = vi.fn();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <LocProbe />
        <Lobby authed={true} onStart={() => {}} onBack={onBack} />
      </MemoryRouter>
    );

    // Button label when authed
    const btn = screen.getByRole('button', { name: /view profile/i });
    expect(btn).toBeInTheDocument();

    // Calls onBack and does not change location by itself
    await userEvent.click(btn);
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByTestId('loc')).toHaveTextContent('/');
  });
});

