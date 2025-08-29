import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import Login from '../Login.jsx';
import Register from '../Register.jsx';
import Menu from '../Menu.jsx';

// Mock api so components render without network
vi.mock('../../api', () => ({ api: vi.fn() }));

describe('Accessibility checks', () => {
  it('Login has no obvious a11y violations', async () => {
    const { container } = render(
      <Login onLogin={() => {}} goRegister={() => {}} goGuest={() => {}} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Register has no obvious a11y violations', async () => {
    const { container } = render(<Register goLogin={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Menu has no obvious a11y violations', async () => {
    const user = { email: 'a@example.com', username: 'alice', gamesPlayed: 0 };
    const { container } = render(
      <Menu user={user} onStart={() => {}} onLogout={() => {}} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
